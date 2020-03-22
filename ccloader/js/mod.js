import { Plugin } from './plugin.js';

/** @typedef Modloader import ccloader.js */

export class Mod {
	/**
	 *
	 * @param {import('./ccloader').ModLoader} modloader
	 * @param {string} file
	 */
	constructor(modloader, baseDirectory){
		this.baseDirectory = baseDirectory.replace(/\\/g, '/').replace(/\/\//g, '/') + '/';
		this.filemanager = modloader.filemanager;
		this.manifestUtil = modloader.manifestUtil;
		this.window = modloader._getGameWindow();

		this._loadManifest();
	}

	load() {
		return this._loadStage('main');
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

	/**
	 * @returns {Promise<void>}
	 */
	async onload() {
		return new Promise(resolve => {
			if(this.loaded) {
				resolve();
			} else {
				this.onloaded = () => resolve();
			}
		});
	}

	get name() {
		if(!this.loaded)
			return undefined;
		return this.manifest.id;
	}
	get displayedName() {
		if(!this.loaded)
			return undefined;
		return this.manifest.ccmodHumanName;
	}
	get description(){
		if(!this.loaded)
			return undefined;
		return this.manifest.description;
	}
	get assets(){
		if(!this.loaded)
			return undefined;
		return this.manifest.assets;
	}
	get dependencies(){
		if(!this.loaded)
			return undefined;
		return this.manifest.ccmodDependencies;
	}
	get version(){
		if(!this.loaded)
			return undefined;
		return this.manifest.version;
	}
	get module() {
		if(!this.loaded)
			return false;
		return !!this.manifest.module;
	}
	get hidden() {
		if(!this.loaded)
			return false;
		return !!this.manifest.hidden;
	}
	get main() {
		if(!this.loaded)
			return '';
		return this.manifest.main;
	}
	get preload() {
		if(!this.loaded)
			return '';
		return this.manifest.preload;
	}
	get postload() {
		if(!this.loaded)
			return '';
		return this.manifest.postload;
	}
	get prestart() {
		if(!this.loaded)
			return '';
		return this.manifest.prestart;
	}
	get plugin() {
		if(!this.loaded)
			return '';
		return this.manifest.plugin;
	}

	get isEnabled(){
		if(!this.loaded || this.disabled)
			return false;

		return localStorage.getItem('modEnabled-' + this.name.toLowerCase()) !== 'false';
	}

	/**
	 *
	 * @param {string} path
	 */
	getAsset(path){
		if(!this.loaded)
			return;

		path = path.replace(/\\/g, '/').trim();

		if(this.runtimeAssets && this.runtimeAssets[path]) {
			return this.runtimeAssets;
		}

		for(const asset of this.assets) {
			if(asset.endsWith(path)) {
				return asset;
			}
		}
	}

	/**
	 *
	 * @param {string} original
	 * @param {string} newPath
	 */
	setAsset(original, newPath){
		this.runtimeAssets[original] = newPath;
	}


	async _loadPlugin() {
		this.window._tmp = this.plugin;
		const module = await this.window.eval.bind(this)(`
			import('../../assets/' + window._tmp);
		`);
		delete this.window._tmp;

		const plugin = module.default;
		if (!plugin
			|| !plugin.prototype
			|| !(plugin.prototype instanceof Plugin)) {
			return;
		}

		/** @type {Plugin} */
		this.pluginInstance = new plugin(this);
		return this.pluginInstance;
	}

	async _loadManifest() {
		let file;
		let text;
		let legacy = false;
		try {
			file = this.baseDirectory + 'ccmod.json';
			text = await this.filemanager.getResourceAsync(file);
		} catch (e1) {
			try {
				legacy = true;
				file = this.baseDirectory + 'package.json';
				text = await this.filemanager.getResourceAsync(file);
			} catch (e2) {
				console.warn(e1);
				console.warn(e2);
				return;
			}
		}

		try {
			let data = JSON.parse(text);
			if (legacy) {
				this.manifestUtil.validateLegacy(data);
				data = this.manifestUtil.convertFromLegacy(data);
			}
			this.manifestUtil.validate(data, legacy);
			this.manifest = data;
		} catch (err) {
			throw new Error(`invalid mod manifest in '${file}': ${err.message}`)
		}

		this.manifest.main = this._normalizeScript(this.manifest.legacy_main);
		this.manifest.preload = this._normalizeScript(this.manifest.preload);
		this.manifest.postload = this._normalizeScript(this.manifest.postload);
		this.manifest.prestart = this._normalizeScript(this.manifest.prestart);
		this.manifest.plugin = this._normalizeScript(this.manifest.plugin);

		this.manifest.assets = await this._findAssets(`${this.baseDirectory}assets/`);

		return 'hello';

		this.loaded = true;
		if(this.onloaded) {
			this.onloaded();
		}
	}

	/**
	 * @param {string} name
	 * @param {boolean} forceModule
	 * @returns {Promise<void>}
	 */
	async _loadStage(name, forceModule) {
		if(!this.loaded)
			return;

		if (this.pluginInstance) {
			await this.pluginInstance[name]();
		}

		if(!this.manifest[name])
			return;

		return await this.filemanager.loadMod(this.manifest[name], this.module || forceModule);
	}

	/**
	 *
	 * @param {string} [input]
	 * @returns {string | undefined}
	 */
	_normalizeScript(input) {
		if (!input) {
			return undefined;
		}
		if(!this._isPathAbsolute(input)) {
			return this._normalizePath(this.baseDirectory + input);
		}
		return this._normalizePath(input);
	}

	_getModNameFromFile(){
		let name = this.baseDirectory.replace(/\/+$/, '');
		let index = name.lastIndexOf('/');
		if (index >= 0) name = name.substring(index + 1);
		return name;
	}

	/**
	 *
	 * @param {string} path
	 */
	_isPathAbsolute(path){
		return /^(?:\/|[a-z]+:\/\/)/.test(path);
	}

	/**
	 *
	 * @param {string} path
	 */
	_normalizePath(path){
		if(path.replace(/\\/g, '/').indexOf('assets/') == 0)
			return path.substr(7);
		else
			return path;
	}

	/**
	 *
	 * @param {string} dir
	 */
	async _findAssets(dir){
		debugger;
		if(window.isLocal || this.filemanager.isPacked(dir)){
			return await this.filemanager.findFiles(dir, ['.json', '.json.patch', '.png', '.ogg']);
		} else {
			const assets = this.manifest.assets;
			if (!assets) {
				return [];
			}

			const result = [];
			for(const asset of assets) {
				result.push(this.baseDirectory + asset);
			}
			return result;
		}
	}
}
