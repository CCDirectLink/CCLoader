/** @typedef Modloader import ccloader.js */

export class Mod {
	/**
	 *
	 * @param {import('./ccloader').ModLoader} modloader
	 */
	constructor(modloader){
		this.filemanager = modloader.filemanager;

		this.name = '';
		this.displayName = '';
		this.description = '';
		this.icons = {};
		this.version = '0.0.0';
		this.module = false;
		this.hidden = false;

		this.main = '';
		this.preload = '';
		this.postload = '';
		this.prestart = '';
		this.plugin = '';

		this.disabled = false;
		this.baseDirectory = '';

		/** @type {string[]} */
		this.assets = [];
		/** @type {Record<string, string|string[]>} */
		this.runtimeAssets = {};
		/** @type {Record<string, string>} */
		this.dependencies = {};
	}

	async load() {
		await this._loadStage('main');
		await this._loadStage('poststart');
	}
	loadPrestart() {
		return this._loadStage('prestart');
	}
	loadPostload() {
		return this._loadStage('postload');
	}
	loadPreload() {
		return this._loadStage('preload');
	}
	loadPlugin() {
		return this._loadPlugin();
	}
	
	get isEnabled(){
		if(this.disabled)
			return false;
		if(this.hidden)
			return true;

		return localStorage.getItem('modEnabled-' + this.name.toLowerCase()) !== 'false';
	}

	/**
	 *
	 * @param {string} path
	 * @returns {string|string[]|undefined}
	 */
	getAsset(path){
		path = path.replace(/\\/g, '/').trim();

		if (this.runtimeAssets[path]) {
			return this.runtimeAssets[path];
		}

		const base = this.baseDirectory.substring(7) + 'assets/';
		for (const asset of this.assets) {
			if (asset.startsWith(base)) {
				if (asset.substring(base.length) === path) {
					return asset;
				}
			} else {
				if (path.endsWith(asset)) {
					return asset;
				}
			}
		}
	}

	/**
	 *
	 * @param {string} original
	 * @param {string|string[]} newPath
	 */
	setAsset(original, newPath){
		this.runtimeAssets[original] = newPath;
	}

	/**
	 * Adds a patch to the mod.
	 * @param {string} original The original file path without .patch
	 * @param {string[]} patchPath The patch file path with .patch
	 */
	addPatch(original, ...patchPath) {
		const originalPatchPath = original + '.patch';
		let list = this.runtimeAssets[originalPatchPath] || [];
		if (typeof patchPath === 'string') {
			list = [list, ...patchPath];
		} else {
			list.push(...patchPath);
		}
		this.runtimeAssets[originalPatchPath] = list;
	}


	async _loadPlugin() {
		window._tmp = this.plugin;
		const module = await window.eval.bind(this)(`
			import('../../assets/' + window._tmp);
		`);
		delete window._tmp;

		const plugin = module.default;
		if (!plugin || !plugin.prototype) {
			return;
		}

		/** @type {Plugin} */
		this.pluginInstance = new plugin(this);
		return this.pluginInstance;
	}

	/**
	 * @param {string} name
	 * @param {boolean} forceModule
	 * @returns {Promise<void>}
	 */
	async _loadStage(name, forceModule) {
		if (this.pluginInstance && this.pluginInstance[name]) {
			await this.pluginInstance[name]();
		}

		if(!this[name])
			return;

		return await this.filemanager.loadMod(this[name], this.module || forceModule);
	}
}
