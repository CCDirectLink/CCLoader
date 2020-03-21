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
		this._loadManifest2().then(manifest => console.log(baseDirectory, manifest));
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
		return this.manifest.name;
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
		let data;
		// try {
		// 	file = this.baseDirectory + 'ccmod.json'
		// 	data = await this.filemanager.getResourceAsync(file);
		// } catch (e1) {
			try {
				file = this.baseDirectory + 'package.json'
				data = await this.filemanager.getResourceAsync(file);
			} catch (_e2) {
				// console.error(e1);
				console.error(e2);
				return;
			}
		// }

		try {
			/** @type {{name: string, ccmodHumanName?: string, version?: string, description?: string, main?: string, preload?: string, postload?: string, prestart?: string, assets: string[], ccmodDependencies: {[key: string]: string}}} */
			this.manifest = JSON.parse(data);
			if(!this.manifest)
				return;
		} catch (e) {
			console.error('Could not load mod: ' + file, e);
			return;
		}

		this.manifest.main = this._normalizeScript(this.manifest.main);
		this.manifest.preload = this._normalizeScript(this.manifest.preload);
		this.manifest.postload = this._normalizeScript(this.manifest.postload);
		this.manifest.prestart = this._normalizeScript(this.manifest.prestart);
		this.manifest.plugin = this._normalizeScript(this.manifest.plugin);

		if(!this.manifest.ccmodDependencies) {
			this.manifest.ccmodDependencies = this.manifest.dependencies;
		}

		if(!this.manifest.name) {
			this.manifest.name = this._getBaseName(this.baseDirectory);
		}

		const assets = await this._findAssets(this.baseDirectory + 'assets/');
		this.manifest.assets = assets;
		this.loaded = true;
		if(this.onloaded) {
			this.onloaded();
		}
	}

	async _loadManifest2() {
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

		let data = JSON.parse(text);
		if (legacy) data = this.manifestUtil.convertLegacyManifest(data);
		let errors = this.manifestUtil.validateManifest(data, legacy);
		if (errors.length > 0) {
			throw new Error([
				`invalid mod manifest in file '${file}':`,
				...errors.map(err => `- ${err}`)
			].join('\n'));
		}

		return data;
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
	_getBaseName(path){
		path = path.replace(/\/+$/, '');
		if(path.indexOf('/') >= 0)
			path = path.substring(path.lastIndexOf('/') + 1);
		return path;
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
