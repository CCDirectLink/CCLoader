import { Filemanager } from './filemanager.js';
import { Acorn } from './acorn.js';
import { Mod } from './mod.js';

const CCLOADER_VERSION = '2.2.1';

export class ModLoader {
	constructor() {
		this.filemanager = new Filemanager(this);
		this.acorn = new Acorn();
		
		this.frame = document.getElementById('frame');
		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');
		
		this.modsLoaded = 0;
		/** @type {Mod[]} */
		this.mods = [];
		
		this._initializeTable();
	}

	/**
	 * Loads and starts the game. It then loads the definitions and mods
	 */
	startGame() {
		this._initializeGame()
			.then(() => {
				this._setStatus('Loading Game');

				this._getGameWindow().reloadTables = () => this.reloadTables();
				this._getGameWindow().document.createEvent('Event').initEvent('modsLoaded', true, true);
	
				this._waitForGame()
					.then(() => this._executeDb());
			})
			.catch(err => console.error('Something went wrong while loading the game', err));
	}

	/**
	 * Reloads all definitions
	 */
	reloadTables() {
		this.modTables = {};
		this._createTable(this.filemanager.getTableName());
		this.table.execute(this._getGameWindow(), this._getGameWindow());
		for (const mod of this.mods) {
			mod.executeTable(this);
		}
	}

	/**
	 * 
	 * @param {string} text 
	 */
	_setStatus(text) {
		if (this.status) {
			this.status.innerHTML = text;
		}
	}

	_getGameWindow() {
		return this.frame.contentWindow;
	}
	
	/**
	 * Loads a cached table if available and creates a new one otherwise
	 */
	_initializeTable() {
		const tableName = this.filemanager.getTableName();
		if (this.filemanager.tableExists(tableName)) {
			this._loadTable(tableName);
		} else {
			this._createTable(tableName);
		}
	}

	/**
	 * Creates the table from the definitions.db. It will also generate a cached table if possible.
	 * @param {string} tableName 
	 */
	_createTable(tableName) {
		this._setStatus('Initializing Mapping');
		console.log('Reading files...');
		const jscode = this.filemanager.getResource('assets/js/game.compiled.js');
		const dbtext = this.filemanager.getResource('ccloader/data/definitions.db');
		
		try {
			const dbdef = JSON.parse(dbtext);
			console.log('Parsing...');
			this.acorn.parse(jscode);
			console.log('Analysing...');
			this.table = this.acorn.analyse(dbdef);
			console.log('Writing...');
			this.filemanager.saveTable(tableName, this.table);
			console.log('Finished!');
		} catch (e) {
			console.error('Could not load definitions.', e);
		}
	}

	/**
	 * Loads the cached table
	 * @param {string} tableName 
	 */
	_loadTable(tableName) {
		const hash = this.filemanager.getDefintionHash();
		this.table = this.filemanager.loadTable(tableName, hash);
		if(!this.table) {
			this._createTable(tableName);
		}
	}

	/**
	 * Loads the mods package.json and mod tables
	 */
	_initializeModTables() {
		this._getModList();
		return this._loadMods()
			.then(() => {
				for (const mod of this.mods) {
					if (mod.isEnabled) {
						mod.initializeTable(this);
					}
				}
			});
	}

	/**
	 * Applies all definitions and loads the mods
	 */
	_executeDb() {
		if (!this.table) {
			return this._removeOverlay();
		}

		this.table.execute(this._getGameWindow(), this._getGameWindow());

		const entries = this._getGameWindow().entries = {};
		this._getGameWindow().getEntry = name => entries[name];
		for (const name in this.table.entries) {
			Object.defineProperty(entries, name, {value: this.table.entries[name], writable: false});
		}

		this._setStatus('Initializing Mods');
		this._initializeModTables()
			.then(() => this._initializeMods(entries))
			.then(() => this._waitForMods())
			.then(() => {
				this._getGameWindow().document.body.dispatchEvent(new Event('modsLoaded'));
				this._removeOverlay();
			})
			.catch(err => console.error('An error occured while loading mods', err));
	}
	
	/**
	 * Searches for mods and stores them in this.mods
	 */
	_getModList() {
		const modFiles = this.filemanager.getAllModsFiles();
		this.mods = [];
		for (const modFile of modFiles) {
			this.mods.push(new Mod(this, modFile));
		}
	}

	/**
	 * Loads the package.json of the mods. This makes sure all necessary data needed for loading the mod is available
	 */
	_loadMods() {
		return new Promise(resolve => {
			const length = this.mods.length;
			let count = 0;
	
			for (const mod of this.mods) {
				mod.onload()
					.then(() => {
						count++;
						if(count >= length)
							resolve();
					});
			}

			if(count >= length) //Needed if 0 mods are loaded
				resolve();
		});
	}
	
	/**
	 * @param {{[key: string]: string}} entries
	 */
	_initializeMods(entries) {
		this._buildCrosscodeVersion();

		this._getGameWindow().inactiveMods = [];
		this._getGameWindow().activeMods = [];
		
		for (const mod of this.mods) {
			if (mod.isEnabled && this._canLoad(mod)) {
				this._getGameWindow().activeMods.push(mod);

				mod.executeTable(this);
				if (mod.table) {
					for (const name in mod.table.entries) {
						if (!entries[name]) {
							Object.defineProperty(entries, name, {value: mod.table.entries[name], writable: false});
						}
					}
				}

				(mod => {
					mod.load()
						.then(() => {
							this.modsLoaded++;
						})
						.catch(() => {
							console.warn(`Could not load "${mod.name}"`);
							this.modsLoaded++;
						});
				})(mod);
			} else {
				this._getGameWindow().inactiveMods.push(mod);
				this.modsLoaded++;
			}
		}
	}
	

	/**
	 * @returns {Promise<void>}
	 */
	_initializeGame() {
		return new Promise((resolve, reject) => {
			this.frame.onload = () => resolve();
			this.frame.onerror = event => reject(event);
			this.frame.src = window.isLocal ? '../assets/node-webkit.html' : '/assets/node-webkit.html';
		});
	}

	/**
	 * Waits for all mods to be completely loaded
	 * @returns {Promise<void>}
	 */
	_waitForMods() {
		return new Promise(resolve => {
			const intervalid = setInterval(() => {
				if(this.modsLoaded >= this._getGameWindow().activeMods.length){
					clearInterval(intervalid);
					resolve();
				}
			}, 1000);
		});
	}

	/**
	 * Waits for the game to be completely loaded
	 * @returns {Promise<void>}
	 */
	_waitForGame() {
		return new Promise(resolve => {
			const intervalid = setInterval(() => {
				if (this._getGameWindow().ig && this._getGameWindow().ig.ready) {
					clearInterval(intervalid);
					resolve();
				}}, 1000);
		});
	}

	_removeOverlay() {
		if (this.status && this.overlay) {
			this.status.outerHTML = '';
			this.overlay.outerHTML = '';
		}
	}

	_buildCrosscodeVersion(){
		try {
			const json = JSON.parse(localStorage.getItem('cc.version'));
			this.ccVersion = json.major + '.' + json.minor + '.' + json.patch;
		} catch (e) {
			console.error('Could not find crosscode version. Assuming "0.0.0".', e);
			this.ccVersion = '0.0.0';
		}
	}
	
	//Requires bind
	_canLoad(mod) {
		const deps = mod.dependencies;
		if(!deps) {
			return true;
		}

		for (const depName in deps){
			if(!deps.hasOwnProperty(depName))
				continue;

			const depRange = semver.validRange(deps[depName]);
			if(!depRange){
				console.warn('Invalid dependency version "' + deps[depName] + '" of "' + depName + '" of "' + mod.name + '"');
			}

			let satisfied = false;

			if(depName == 'ccloader' && semver.satisfies(CCLOADER_VERSION, depRange)) {
				satisfied = true;
			}
			if(depName == 'crosscode' && semver.satisfies(this.ccVersion, depRange)) {
				satisfied = true;
			}

			for(let i = 0; i < this.mods.length && !satisfied; i++){
				if(this.mods[i].name === depName){
					if(semver.satisfies(semver.valid(this.mods[i].version), depRange)){
						satisfied = true;
					}
				}
			}

			if(!satisfied){
				return false;
			}
		}

		return true;
	}
}

