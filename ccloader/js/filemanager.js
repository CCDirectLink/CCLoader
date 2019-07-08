import { Db } from './db.js';

const fs = require('fs');
const path = require('path');

const isBrowser = window.isBrowser;
const isLocal = !isBrowser;

export class Filemanager {
	/**
	 * 
	 * @param {import('./ccloader').ModLoader} modloader 
	 */
	constructor(modloader) {
		this.modloader = modloader;

		if (isBrowser) {
			try {
				this.modList = JSON.parse(this.getResource('mods.json'));
			} catch (e) {
				console.error('Could not load mod list. Proceeding to load without any mods. ', e);
				this.modList = [];
			}
		}
	}

	/**
	 * Loads a script into the scope of ccloader
	 * @param {string} file
	 * @param {boolean} isModule
	 */
	loadScript(file, isModule) {
		return this._loadScript(file, document, isModule ? 'module' : 'text/javascript');
	}

	/**
	 * 
	 * @param {string} file 
	 * @param {boolean} isModule 
	 */
	loadMod(file, isModule){
		return this._loadScript(file, this.modloader.frame.contentDocument, isModule ? 'module' : 'text/javascript');
	}

	getTableName(){
		return this._getHash('assets/js/game.compiled.js');
	}
	getDefintionHash(){
		return this._getHash('ccloader/data/definitions.db');
	}
	/**
	 * 
	 * @param {string} def 
	 */
	getModDefintionHash(def){
		return this._getHash('assets/' + def);
	}
	/**
	 * 
	 * @param {string} folder 
	 */
	getAllModsFiles(folder){
		return this._getResources(folder, path.sep + 'package.json');
	}

	/**
	 * 
	 * @param {string} folder 
	 */
	getAllPluginFiles(folder){
		return this._getResources(folder, path.sep + 'plugin.js');
	}

	/**
	 * 
	 * @param {string} table 
	 */
	tableExists(table){
		if(!table)
			return false;
		
		return this._resourceExists('ccloader/data/' + table);
	}
	/**
	 * 
	 * @param {string} table 
	 */
	modTableExists(table){
		if(!table)
			return false;
		
		return this._resourceExists('ccloader/data/assets/' + table);
	}
	/**
	 * 
	 * @param {string} resource 
	 */
	getResource(resource){
		try {
			if(isLocal)
				return fs.readFileSync(resource, 'utf-8');
			else {
				const req = new XMLHttpRequest();
				req.open('GET', '/' + resource, false);
				req.send(null);

				if(req.readyState === req.DONE && req.status === 200) {
					return req.responseText;
				} else {
					return undefined;
				}
			}
		} catch(e){
			return undefined;
		}
	}
	
	/**
	 * 
	 * @param {string} resource 
	 * @returns {Promise<string>}
	 */
	getResourceAsync(resource){
		return new Promise((resolve, reject) => {
			if(isLocal) {
				fs.readFile(resource, 'utf-8', (err, result) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				});
			} else {
				const req = new XMLHttpRequest();
				req.open('GET', '/' + resource, true);

				req.onerror = err => reject(err);
				req.onreadystatechange = () => {
					if (req.readyState === req.DONE && req.status === 200) {
						resolve(req.responseText);
					}
				};

				req.send(null);
			}
		});
	}

	/**
	 * 
	 * @param {string} dir
	 * @param {string[]} [endings]
	 * @returns {Promise<string[]>}
	 */
	async findFiles(dir, endings) {
		try {
			const files = await this._getFiles(dir);
			if (files.length === 0) {
				return [];
			}
	
			const promises = [];
			for (const file of files){
				promises.push(this._checkFileForAsset(dir, file, endings));
			}
			const results = await Promise.all(promises);
	
			return [].concat(...results); //Flattens the arrays
		} catch (e) {
			return [];
		}
	}

	/**
	 * 
	 * @param {string} tableName 
	 * @param {Db} table 
	 * @param {string?} hash
	 * @returns {void}
	 */
	saveTable(tableName, table, hash){
		if(!hash){
			return this.saveTable(tableName, table, this.getDefintionHash());
		}
		
		if(isLocal) {
			try {
				this._createDirectory(path.dirname('ccloader/data/' + tableName));
			} catch(e) {}
			table.hash = hash;
			fs.writeFileSync('ccloader/data/' + tableName, JSON.stringify(table), 'utf-8');
		}
	}
	/**
	 * 
	 * @param {string} tableName 
	 * @param {string} hash
	 * @returns {Db | undefined}
	 */
	loadTable(tableName, hash){
		const text = this.getResource('ccloader/data/' + tableName);
		if(!text) {
			return undefined;
		}
		
		try {
			const json = JSON.parse(text);
			const table = new Db();
			
			if(!json || !json.hash)
				return undefined;
			
			if(hash && hash != json.hash)
				return undefined;
			
			table.load(json);
			return table;
		} catch (e) {
			console.error('Could not load definitions: ' + tableName, e);
		}
	}

	/**
	 * 
	 * @param {string} path 
	 * @returns {Promise<Image>}
	 */
	loadImage(path) {
		return new Promise((resolve, reject) => {
			const result = new Image();
			result.onload = () => resolve(result);
			result.onerror = err => reject(err);
			result.src = path;
		});
	}
	

	/**
	 * Returns all files with the given ending in the folder
	 * @param {string?} folder 
	 * @param {string?} ending 
	 */
	_getResources(folder, ending){
		if(!folder)
			folder = 'assets/mods/';
		
		if(isLocal)
			return this._getResourcesLocal(folder, ending);
		else {
			var results = [];
			for(var i in this.modList){
				if(this._resourceExists('assets/mods/' + this.modList[i] + ending)){
					results.push('assets/mods/' + this.modList[i] + ending);
				}
			}
			return results;
		}
	}

	/**
	 * 
	 * @param {string} dir
	 * @returns {Promise<string[]>}
	 */
	_getFiles(dir) {
		return new Promise((resolve, reject) => {
			fs.readdir(dir, (err, files) => {
				if (err) {
					reject(err);
				} else {
					resolve(files);
				}
			});
		});
	}

	/**
	 * 
	 * @param {string} file
	 * @returns {Promise<fs.Stats>}
	 */
	_getStats(file) {
		return new Promise((resolve, reject) => {
			fs.stat(file, (err, stats) => {
				if (err) {
					reject(err);
				} else {
					resolve(stats);
				}
			});
		});
	}

	/**
	 * 
	 * @param {string} dir 
	 * @param {string} file 
	 * @param {string[]} [endings]
	 * @returns {Promise<string[]>} 
	 */
	async _checkFileForAsset(dir, file, endings) {
		const filePath = path.resolve(dir, file);

		try {
			const stats = await this._getStats(filePath);
			if(stats && stats.isDirectory()){
				return await this.findFiles(filePath);
			} else  if (!endings || endings.some(ending => filePath.endsWith(ending))) {
				return [path.relative(process.cwd() + '/assets/', filePath).replace(/\\/g, '/')];
			}
		} catch (e) {
			return [];
		}
	}

	/**
	 * 
	 * @param {string} file 
	 * @returns {string}
	 */
	_getHash(file) {
		return Crypto.MD5(this.getResource(file)) + '.table';
	}
	/**
	 * 
	 * @param {string} resource 
	 */
	_resourceExists(resource){
		if(isLocal){
			try{
				fs.statSync(resource);
				return true;
			} catch(e) {
				return false;
			}
		} else {
			try{
				const req = new XMLHttpRequest();
				req.open('HEAD', '/' + resource, false);
				req.send();
				return req.status != 404;
			}catch(e){
				return false;
			}
		}
	}
	/**
	 * 
	 * @param {string} url 
	 * @param {document} doc
	 * @param {string} type 
	 * @returns {Promise<void>}
	 */
	_loadScript(url, doc, type){
		if (!type) {
			type = 'text/javascript';
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.onload = () => resolve();
			script.onerror = () => reject();
			script.type = type;
			script.src = url;
			doc.body.appendChild(script);
		});
	}
	/**
	 * Returns all files with the given ending in the folder
	 * @param {string} folder 
	 * @param {string?} ending 
	 */
	_getResourcesLocal(folder, ending){
		/** @type {string[]} */
		let results = [];
		
		if(isLocal) {
			try{
				fs.readdirSync(folder).forEach(file => {
					try {
						file = path.join(folder, file);
						
						if (this._isDirectory(file)) {
							if (!file.includes('node_modules')) {
								const innerResults = this._getResourcesLocal(file, ending);
								results = results.concat(innerResults);
							}
						} else if(file.endsWith(ending)){
							results.push(file);
						}
					} catch(e) { }
				});
			} catch(e) { }
		}
		
		return results;
	}

	/**
	 * 
	 * @param {string} file
	 * @returns {boolean}
	 */
	_isDirectory(file){
		const stat = fs.statSync(file);
		return stat && stat.isDirectory();
	}
	_createDirectories(){
		if(isLocal){
			this._createDirectory('ccloader/data/assets/mods');
		}
	}
	/**
	 * 
	 * @param {string} dir 
	 */
	_createDirectory(dir){
		if (isBrowser) {
			return;
		}
		
		if(fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
			return;
		}
		
		const parent = path.join(dir, '..');
		this._createDirectory(parent);

		fs.mkdirSync(dir);
	}
}