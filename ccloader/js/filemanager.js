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
	 * 
	 * @param {string} file 
	 * @param {boolean} isModule 
	 */
	loadMod(file, isModule){
		return this._loadScript(file, this.modloader.frame.contentDocument, isModule ? 'module' : 'text/javascript');
	}

	/**
	 * 
	 * @param {string} folder 
	 */
	async getAllModsFiles(folder){
		return await this._getResources(folder, path.sep + 'package.json');
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
				frame.contentWindow.fetch(`/${resource}`).then(data => data.text()).then(resolve).catch(reject)
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
	async _getResources(folder, ending){
		if(!folder)
			folder = 'assets/mods/';
		
		if(isLocal)
			return this._getResourcesLocal(folder, ending);
		else {
			var results = [];
			for(var i in this.modList){
				if(await this._resourceExistsAsync('assets/mods/' + this.modList[i] + ending)){
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
	 * @param {string} resource 
	 */
	/*_resourceExists(resource){
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
	}*/

	/**
	 * Async version of _resourceExists
	 * @param {string} resource
	 * @returns {Promise<boolean>}  
	 */
	async _resourceExistsAsync(resource) {
		let response;
		try {
			response = await frame.contentWindow.fetch(`/${resource}`);	
		} catch (e) {
			// some issue with network
			throw e;
		}
		
		if (response.ok) {
			return true;
		}

		if (response.status == 404) {
			return false;
		}

		// some issue we can't control
		throw Error(response.statusText);

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
			doc.head.appendChild(script);
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

	
	// -------------- DEPRECATED --------------

	/**
	 * @deprecated
	 */
	getTableName(){
		return this._getHash('assets/js/game.compiled.js');
	}

	/**
	 * @deprecated
	 */
	getDefintionHash(){
		return this._getHash('ccloader/data/definitions.db');
	}

	/**
	 * 
	 * @param {string} def 
	 * @deprecated
	 */
	getModDefintionHash(def){
		return this._getHash('assets/' + def);
	}

	/**
	 * 
	 * @param {string} table 
	 * @deprecated
	 */
	tableExists(table){
		if(!table)
			return false;
		
		return this._resourceExists('ccloader/data/' + table);
	}

	/**
	 * 
	 * @param {string} table 
	 * @deprecated
	 */
	modTableExists(table){
		if(!table)
			return false;
		
		return this._resourceExists('ccloader/data/assets/' + table);
	}

	/**
	 * 
	 * @param {string} tableName 
	 * @param {Db} table 
	 * @param {string?} hash
	 * @returns {void}
	 * @deprecated
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
	 * @deprecated
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
	 * @param {string} file 
	 * @returns {string}
	 * @deprecated
	 */
	_getHash(file) {
		return Crypto.MD5(this.getResource(file)) + '.table';
	}
}