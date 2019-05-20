/** @typedef Modloader import ccloader.js */

const path = require('path');

export class Mod {
	/**
	 * 
	 * @param {import('./ccloader').ModLoader} modloader
	 * @param {string} file 
	 * @param {string} ccVersion
	 */
	constructor(modloader, file, ccVersion){
		this.file = file;
		this.filemanager = modloader.filemanager;
		this.ccVersion = ccVersion;

		const data = this.filemanager.getResource(file);
		if(!data) {
			return;
		}
		
		try {
			/** @type {{name: string, version?: string, description?: string, main?: string, preload?: string, postload?: string, table?: string, assets: string[], dependencies: {[key: string]: string}}} */
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
		
		if(this.manifest.table){
			if(!this._isPathAbsolute(this.manifest.table)) {
				this.manifest.table = this._getBaseName(file) + '/' + this.manifest.table;
			}
			this.manifest.table = this._normalizePath(this.manifest.table);
		}
		
		if(!this.manifest.name) {
			this.manifest.name = this._getModNameFromFile();
		}
		
		this._findAssets(this._getBaseName(file) + '/assets/').then(data => {
			this.manifest.assets = data;
			this.loaded = true;
			if(this.onloaded) {
				this.onloaded();
			}
		});
	}

	/**
	 * @returns {Promise<void>}
	 */
	async load() {
		if(!this.loaded)
			return;

		if(!this.manifest.main)
			return;

		return await this.filemanager.loadMod(this.manifest.main, this.module);
	}

	/**
	 * @returns {Promise<void>}
	 */
	onload() {
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
		return this.manifest.dependencies;
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
	get main() {
		if(!this.load)
			return '';
		return this.manifest.main;
	}
	get preload() {
		if(!this.load)
			return '';
		return this.manifest.preload;
	}
	get postload() {
		if(!this.load)
			return '';
		return this.manifest.postload;
	}

	/**
	 * 
	 * @param {string} path 
	 */
	getAsset(path){
		if(!this.loaded || !this.manifest.assets)
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
	get baseDirectory(){
		return this._getBaseName(this.file).replace(/\\/g, '/').replace(/\/\//g, '/') + '/';
	}

	/**
	 * @param {import('./ccloader').ModLoader} ccloader
	 */
	initializeTable(ccloader){
		if(!this.loaded || !this.manifest.table)
			return;
		
		const hash = this.filemanager.getModDefintionHash(this.manifest.table);
		const tablePath = path.join(this._getBaseName(this.file), hash);
			
		this.table = this.filemanager.loadTable(tablePath, hash);
		if(!this.table){
			console.log('[' + this.manifest.name + '] Creating mod definition database..');
			if(ccloader.acorn.needsParsing) {
				console.log('[' + this.manifest.name + '] Parsing...');
				const jscode = this.filemanager.getResource('assets/js/game.compiled.js');
				ccloader.acorn.parse(jscode);
			}

			try {
				const dbtext = this.filemanager.getResource('assets/' + this.manifest.table);
				const dbdef = JSON.parse(dbtext);
				console.log('[' + this.manifest.name + '] Analysing...');
				this.table = ccloader.acorn.analyse(dbdef);
				console.log('[' + this.manifest.name + '] Writing...');
				this.filemanager.saveTable(tablePath, this.table, hash);
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
	 */
	executeTable(ccloader){
		if(!this.loaded || !this.table)
			return;

		this.table.execute(ccloader._getGameWindow(), ccloader._getGameWindow());
	}

	get isEnabled(){
		if(!this.loaded || this.disabled)
			return false;
		
		try {
			const globals = window['frame'].contentWindow.cc.ig.storage[window.frame.contentWindow.cc.ig.varNames.storageGlobals];
			
			if(!globals || !globals.options)
				return true;
			
			return globals.options['modEnabled-' + this.manifest.name.toLowerCase()] !== false;
		} catch (err) {
			console.error(`An error occured while accessing the games internal storage. Disabling mod "${this.name}"`, err);
			return false;
		}
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
		if(window.isLocal){
			return await this.filemanager.findFiles(dir, ['.json', '.json.patch', '.png', '.ogg']);
		} else {
			if(!this.manifest.assets)
				return [];

			let dir = this._getBaseName(this.file) + '/';

			const result = [];
			for(const asset of this.manifest.assets) {
				result.push(dir + asset);
			}
			return result;
		}
	}
}
