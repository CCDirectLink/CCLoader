const ignored = new Set(['.git', 'node_modules', '.cc-dev-session.json']);
const manifests = new Set(['ccmod.json', 'package.json']);
const errorMessage = error => error && error.message || String(error);

export function supportsReload(instance) {
    return !!instance && typeof instance.unload === 'function' && typeof instance.reload === 'function';
}

// Watch directories instead of file inodes, so editor atomic saves work.
// One watcher per directory also works on platforms without recursive fs.watch.
export class DirectoryWatcher {
    constructor({ fs, path, root, onChange, onError, debounce = 200 }) {
        Object.assign(this, { fs, path, root, onChange, onError, debounce });
        this.watchers = new Map();
        this.pending = new Set();
        this.closed = false;
        this.refresh();
    }

    refresh() {
        if (this.closed) return;
        const found = new Set();
        const visit = directory => {
            try {
                if (!this.fs.lstatSync(directory).isDirectory() || this.fs.lstatSync(directory).isSymbolicLink()) return;
                found.add(directory);
                if (!this.watchers.has(directory)) {
                    const watcher = this.fs.watch(directory, (_event, name) => {
                        if (this.closed) return;
                        if (name && ignored.has(String(name))) return;
                        const file = name ? this.path.join(directory, String(name)) : directory;
                        this.pending.add(this.path.relative(this.root, file).replace(/\\/g, '/'));
                        clearTimeout(this.timer);
                        this.timer = setTimeout(() => {
                            this.refresh();
                            const files = Array.from(this.pending);
                            this.pending.clear();
                            this.onChange(files);
                        }, this.debounce);
                    });
                    watcher.on('error', error => {
                        watcher.close();
                        this.watchers.delete(directory);
                        this.onError(error);
                    });
                    this.watchers.set(directory, watcher);
                }
                for (const name of this.fs.readdirSync(directory)) {
                    if (!ignored.has(name)) {
                        const child = this.path.join(directory, name);
                        const stat = this.fs.lstatSync(child);
                        if (stat.isDirectory() && !stat.isSymbolicLink()) visit(child);
                    }
                }
            } catch (error) {
                // Removed directories are normal during atomic saves.
                if (error.code !== 'ENOENT') this.onError(error);
            }
        };
        visit(this.root);
        for (const [directory, watcher] of this.watchers) {
            if (!found.has(directory)) {
                watcher.close();
                this.watchers.delete(directory);
            }
        }
    }

    close() {
        this.closed = true;
        clearTimeout(this.timer);
        for (const watcher of this.watchers.values()) watcher.close();
        this.watchers.clear();
        this.pending.clear();
    }
}

export class Reloader {
    constructor({ fs, path, root, assetURL, importModule = url => import(url), report = console.error, debounce = 200 }) {
        Object.assign(this, { fs, path, root, assetURL, importModule, report, debounce });
        this.states = new Map();
        this.revision = 0;
        this.closed = false;
        this.session = Date.now().toString(36);
    }

    discover(mods) {
        for (const mod of mods) {
            if (mod.name === 'cc-dev' || !mod.isEnabled || !mod.plugin || !supportsReload(mod.pluginInstance)) continue;
            if (mod.filemanager && mod.filemanager.isPacked(mod.baseDirectory)) continue;
            try {
                // baseDirectory is game-relative; plugin is assets-relative.
                const directory = this.path.resolve(this.root, mod.baseDirectory);
                const entry = this.path.resolve(this.root, 'assets', mod.plugin);
                const relative = this.path.relative(directory, entry);
                if (relative.startsWith('..' + this.path.sep) || relative === '..' || this.path.isAbsolute(relative)) {
                    throw new Error('Plugin must be inside its mod directory');
                }
                if (!this.fs.statSync(directory).isDirectory()) continue;
                if (this.states.has(mod.name)) continue;
                const state = { mod, entry, instance: mod.pluginInstance, phase: 'active', error: null, queue: Promise.resolve() };
                this.states.set(mod.name, state);
                state.watcher = new DirectoryWatcher({
                    fs: this.fs, path: this.path, root: directory, debounce: this.debounce,
                    onChange: files => {
                        if (files.some(file => manifests.has(file))) {
                            state.error = 'Manifest changed; restart the game to apply it.';
                            this.report('[cc-dev] ' + mod.name + ': ' + state.error);
                            return;
                        }
                        this.reload(mod.name, files).catch(() => {});
                    },
                    onError: error => {
                        state.error = 'Watcher: ' + errorMessage(error);
                        this.report('[cc-dev] ' + mod.name, error);
                    }
                });
            } catch (error) {
                this.report('[cc-dev] Cannot watch ' + mod.name, error);
            }
        }
    }

    status() {
        return Array.from(this.states.values(), state => ({
            id: state.mod.name, phase: state.phase, error: state.error,
            directories: state.watcher ? state.watcher.watchers.size : 0
        }));
    }

    reload(id, changedFiles = []) {
        const state = this.states.get(id);
        if (!state) return Promise.reject(new Error('Mod does not support hot reload: ' + id));
        if (this.closed) return Promise.reject(new Error('cc-dev is stopped'));
        const task = state.queue.then(() => this.replace(state, changedFiles));
        state.queue = task.catch(error => {
            state.error = errorMessage(error);
            this.report('[cc-dev] ' + id, error);
        });
        return task;
    }

    async replace(state, changedFiles) {
        if (this.closed) throw new Error('cc-dev is stopped');
        const previousPhase = state.phase;
        state.phase = 'importing';
        let Plugin;
        try {
            const url = new URL(state.mod.plugin.split(/[\\/]/).map(encodeURIComponent).join('/'), this.assetURL);
            url.searchParams.set('cc-dev', this.session + '-' + (++this.revision));
            Plugin = (await this.importModule(url.href)).default;
            if (typeof Plugin !== 'function' || !supportsReload(Plugin.prototype)) {
                throw new Error('Updated plugin must export a class with unload() and reload()');
            }
        } catch (error) {
            state.phase = previousPhase;
            throw error;
        }
        if (this.closed) { state.phase = previousPhase; throw new Error('cc-dev is stopped'); }
        const context = { changedFiles: changedFiles.slice(), reason: 'reload' };
        if (state.instance) {
            state.phase = 'unloading';
            try {
                await state.instance.unload(context);
            } catch (error) {
                state.phase = 'cleanup-failed';
                throw error;
            }
            state.instance = null;
            state.mod.pluginInstance = null;
        }
        state.phase = 'inactive';
        if (this.closed) throw new Error('cc-dev is stopped');
        let next;
        try {
            next = new Plugin(state.mod);
            state.phase = 'reloading';
            await next.reload(context);
            if (this.closed) throw new Error('cc-dev stopped during reload');
        } catch (error) {
            if (next) {
                try { await next.unload({ changedFiles: context.changedFiles, reason: 'failed-reload' }); }
                catch (cleanupError) {
                    // Retain the instance so a later retry must finish cleanup first.
                    state.instance = next;
                    state.phase = 'cleanup-failed';
                    throw new Error(errorMessage(error) + '; cleanup failed: ' + errorMessage(cleanupError));
                }
            }
            state.phase = 'inactive';
            throw error;
        }
        state.instance = next;
        state.mod.pluginInstance = next;
        state.phase = 'active';
        state.error = null;
        return { id: state.mod.name, phase: state.phase };
    }

    stop() {
        this.closed = true;
        for (const state of this.states.values()) if (state.watcher) state.watcher.close();
        // Stopping the development utility leaves successfully loaded mods running.
    }
}
