import { Reloader } from './reloader.js';
import { DevServer } from './http.js';

export default class CCDev {
    constructor(mod) {
        this.mod = mod;
        this.started = false;
    }

    preload() {
        if (!window.require || window.isBrowser || window.CrossAndroid) return;
        const process = window.require('process');
        if (process.env.CC_DEV !== '1') return;
        const fs = window.require('fs');
        const path = window.require('path');
        this.root = process.cwd();
        this.fs = fs;
        this.path = path;
        this.env = process.env;
        this.reloader = new Reloader({
            fs, path, root: this.root,
            assetURL: new URL('../../', import.meta.url).href
        });
        // plugin.js lives in assets/mods/cc-dev/, so assets/ is two levels up.
        this.api = Object.freeze({
            status: () => ({ ready: this.started, mods: this.reloader.status() }),
            reload: id => this.reloader.reload(id)
        });
        window.ccDev = this.api;
        this.onKeyDown = event => {
            const isI = event.code === 'KeyI' || event.key === 'i' || event.key === 'I' || event.keyCode === 73;
            if (!isI || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.repeat) return;
            event.preventDefault();
            event.stopPropagation();
            try {
                window.require('nw.gui').Window.get().showDevTools();
            } catch (error) {
                console.error('[cc-dev] Cannot open DevTools; an NW.js SDK build may be required.', error);
            }
        };
        window.addEventListener('keydown', this.onKeyDown, true);
        this.onLoaded = () => {
            this.start().catch(error => console.error('[cc-dev]', error));
        };
        this.onUnload = () => { this.stop().catch(error => console.error('[cc-dev]', error)); };
        // CCLoader dispatches a non-bubbling event on document.body.
        document.addEventListener('modsLoaded', this.onLoaded, { once: true, capture: true });
        window.addEventListener('unload', this.onUnload, { once: true });
    }

    async start() {
        if (this.started || !this.reloader || this.reloader.closed) return;
        this.started = true;
        this.reloader.discover(window.activeMods);
        if (this.env.CC_DEV_HTTP === '0') return;
        const port = this.env.CC_DEV_PORT === undefined ? 0 : Number(this.env.CC_DEV_PORT);
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('CC_DEV_PORT must be an integer from 0 to 65535');
        // Construct in the renderer realm, not Node's realm, to access ig/sc/window.
        const AsyncFunction = window.Function('return Object.getPrototypeOf(async function() {}).constructor')();
        this.server = new DevServer({
            http: window.require('http'), crypto: window.require('crypto'), fs: this.fs,
            sessionFile: this.path.join(this.root, '.cc-dev-session.json'), port,
            dev: this.api,
            evaluate: (code, captured, dev) => new AsyncFunction('console', 'dev', code).call(window, captured, dev)
        });
        await this.server.start();
        console.info('[cc-dev] HTTP ready; connection details: ' + this.server.sessionFile);
    }

    async stop() {
        document.removeEventListener('modsLoaded', this.onLoaded, true);
        window.removeEventListener('unload', this.onUnload);
        window.removeEventListener('keydown', this.onKeyDown, true);
        if (this.reloader) this.reloader.stop();
        if (this.server) await this.server.stop();
        if (window.ccDev === this.api) delete window.ccDev;
        this.started = false;
    }
}
