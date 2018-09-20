import { Db } from './db.js';

const fs = require('fs');
const path = require('path');

const isBrowser = window.isBrowser;
const isLocal = !isBrowser;

export class Filemanager {
	/**
	 * 
	 * @param {ModLoader} modloader 
	 */
	constructor(modloader) {
		this.modloader = modloader;

		if (isBrowser) {
			this.modList = JSON.parse(this.getResource('mods.json'));
		}
	}

	/**
	 * 
	 * @param {string} file 
	 */
	loadMod(file){
		return this._loadScript(file, this.modloader.frame.contentDocument);
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

				if(req.status === 200) {
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
		if(!text)
			return undefined;
		
		const json = JSON.parse(text);
		const table = new Db();
		
		if(!json || !json.hash)
			return undefined;
		
		if(hash && hash != json.hash)
			return undefined;
		
		table.load(json);
		return table;
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
	 * @returns {Promise<void>}
	 */
	_loadScript(url, doc){
		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.onload = () => resolve();
			script.onerror = () => reject();
			script.type = 'text/javascript';
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
							const innerResults = this._getResourcesLocal(file, ending);
							results = results.concat(innerResults);
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