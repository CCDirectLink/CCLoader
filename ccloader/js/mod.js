import { Plugin } from './plugin.js';

/** @typedef Modloader import ccloader.js */

const path = require('path');

export class Mod {
	/**
	 * 
	 * @param {import('./ccloader').ModLoader} modloader
	 * @param {string} file 
	 */
	constructor(modloader, file){
		this.file = file;
		this.filemanager = modloader.filemanager;
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
		return this.manifest.name;
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

	get baseDirectory(){
		return this._getBaseName(this.file).replace(/\\/g, '/').replace(/\/\//g, '/') + '/';
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

	resolvePath(relativePath) {
		const basePath = this._getBaseName(this.file);
        if (!relativePath) {
            return this._normalizePath(basePath);
        }
        return this._normalizePath(basePath + '/' + relativePath);
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
		const file = this.file;
		let data;
		try {
			data = await this.filemanager.getResourceAsync(file);
		} catch (e) {
			console.error(e);
			return;
		}
		
		try {
			/** @type {{name: string, version?: string, description?: string, main?: string, preload?: string, postload?: string, prestart?: string, table?: string, assets: string[], ccmodDependencies: {[key: string]: string}}} */
			this.manifest = JSON.parse(data);
			if(!this.manifest)
				return;
		} catch (e) {
			console.error('Could not load mod: ' + file, e);
			return;
		}

		this.manifest.main = this._normalizeScript(file, this.manifest.main);
		this.manifest.preload = this._normalizeScript(file, this.manifest.preload);
		this.manifest.postload = this._normalizeScript(file, this.manifest.postload);
		this.manifest.prestart = this._normalizeScript(file, this.manifest.prestart);
		this.manifest.plugin = this._normalizeScript(file, this.manifest.plugin);
		
		if(!this.manifest.ccmodDependencies) {
			this.manifest.ccmodDependencies = this.manifest.dependencies;
		}
		
		if(this.manifest.table){
			if(!this._isPathAbsolute(this.manifest.table)) {
				this.manifest.table = this._getBaseName(file) + '/' + this.manifest.table;
			}
			this.manifest.table = this._normalizePath(this.manifest.table);
		}
		
		if(!this.manifest.name) {
			this.manifest.name = this._getModNameFromFile();
		}
		
		const assets = await this._findAssets(this._getBaseName(file) + '/assets/');
		this.manifest.assets = assets;
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
	 * @param {string} manifestFile
	 * @param {string} [input]
	 * @returns {string | undefined}
	 */
	_normalizeScript(manifestFile, input) {
		if (!input) {
			return undefined;
		}
		if(!this._isPathAbsolute(input)) {
			return this._normalizePath(this._getBaseName(manifestFile) + '/' + input);
		}
		return this._normalizePath(input);
	}
	
	_getModNameFromFile(){
		if (!this.file.includes('package.json')) {
			return 'Unknown mod';
		}

		let name = this.file.match(/\/[^/]*\/package.json/g).pop().replace(/\//g, '');
		name = name.substr(0, name.length - 6);
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
		if(path.indexOf('/') >= 0)
			return path.substring(0, path.lastIndexOf('/'));
		else if(path.indexOf('\\') >= 0)
			return path.substring(0, path.lastIndexOf('\\'));
		else
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
			const base = this._getBaseName(this.file) + '/';

			const result = [];
			for(const asset of assets) {
				result.push(base + asset);
			}
			return result;
		}
	}

	// -------------- DEPRECATED --------------

	/**
	 * @param {import('./ccloader').ModLoader} ccloader
	 * @deprecated
	 */
	async initializeTable(ccloader){
		if(!this.loaded || !this.manifest.table)
			return;
		
		const hash = await this.filemanager.getModDefintionHash(this.manifest.table);
		const tablePath = path.join(this._getBaseName(this.file), hash);
			
		this.table = await this.filemanager.loadTable(tablePath, hash);
		if(!this.table){
			console.log('[' + this.manifest.name + '] Creating mod definition database..');
			if(ccloader.acorn.needsParsing) {
				console.log('[' + this.manifest.name + '] Parsing...');
				const jscode = await this.filemanager.getResourceAsync('assets/js/game.compiled.js');
				ccloader.acorn.parse(jscode);
			}

			try {
				const dbtext = await this.filemanager.getResourceAsync('assets/' + this.manifest.table);
				const dbdef = JSON.parse(dbtext);
				console.log('[' + this.manifest.name + '] Analysing...');
				this.table = ccloader.acorn.analyse(dbdef);
				console.log('[' + this.manifest.name + '] Writing...');
				await this.filemanager.saveTable(tablePath, this.table, hash);
				console.log('[' + this.manifest.name + '] Finished!');
			} catch (e) {
				console.error(`Could not load definitions of mod ${this.manifest.name}. Disabling.`, e);
				this.disabled = true;
			}
		}

		return this.table;
	}

	/**
	 * @param {ModLoader} ccloader
	 * @deprecated
	 */
	executeTable(ccloader){
		if(!this.loaded || !this.table)
			return;

		this.table.execute(ccloader._getGameWindow(), ccloader._getGameWindow());
	}
}
