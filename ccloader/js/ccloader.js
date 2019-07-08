import { Filemanager } from './filemanager.js';
import { Acorn } from './acorn.js';
import { Mod } from './mod.js';
import { UI } from './ui.js';
import { Loader } from './loader.js';
import { Plugin } from './plugin.js';

const CCLOADER_VERSION = '2.14.0';

export class ModLoader {
	constructor() {
		this.Plugin = Plugin;

		this.filemanager = new Filemanager(this);
		this.ui = new UI(this);
		this.acorn = new Acorn();
		this.loader = new Loader(this.filemanager);
		
		this.frame = document.getElementById('frame');
		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');
		
		this.modsLoaded = 0;
		/** @type {Mod[]} */
		this.mods = [];
		
		this._buildCrosscodeVersion();
		this._initializeTable();
	}

	/**
	 * Loads and starts the game. It then loads the definitions and mods
	 */
	async startGame() {
		await this.loader.initialize();

		await this._loadModPackages();
		this._orderCheckMods();
		this._registerMods();

		await this._initializeGame();
		
		this._setStatus('Loading Game');
		this._setupGamewindow();

		await this._waitForGame();

		this._executeMainDb();
		this._setStatus('Initializing Mods');
		this._executeDb();

		await this._initializeMods();

		this._getGameWindow().document.body.dispatchEvent(new Event('modsLoaded'));
		this._removeOverlay();
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
	 * Orders mods and checks their dependencies
	 */
	_orderCheckMods() {
		const mods = [];

		let lastCount = 0;
		while (this.mods.length != lastCount) {
			lastCount = this.mods.length;
			for (let i = this.mods.length - 1; i >= 0; i--) {
				const mod = this.mods[i];
				if (!mod.isEnabled || this._canLoad(mod, mods)) {
					mods.push(mod);
					this.mods.splice(i, 1);
				}
			}
		}

		if (this.mods.length > 0) {
			console.log(`Could not load mods due to missing dependencies: "${this.mods.map(m => m.name).join('", "')}"`);
			for (const mod of this.mods) {
				mod.disabled = true;
				mods.push(mod);
			}
		}

		this.mods = mods;
	}

	/**
	 * 
	 * @param {string} text 
	 */
	_setStatus(text) {
		if (this.status && this.status.isConnected) {
			this.status.innerHTML = text;
		}
	}

	/**
	 * 
	 * @returns {window}
	 */
	_getGameWindow() {
		return this.frame.contentWindow;
	}
	
	/**
	 * Loads a cached table if available and creates a new one otherwise
	 */
	_initializeTable() {
		if (this._definitionsNeeded()) {
			const tableName = this.filemanager.getTableName();
			if (this.filemanager.tableExists(tableName)) {
				this._loadTable(tableName);
			} else {
				this._createTable(tableName);
			}
		} else {
			this._loadTable('final.table');
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
		const hash = this._definitionsNeeded() ? this.filemanager.getDefintionHash() : 'final';
		this.table = this.filemanager.loadTable(tableName, hash);
		if(!this.table) {
			this._createTable(tableName);
		}
	}

	/**
	 * Loads the mod tables
	 * @param {{[key: string]: string}} entries
	 */
	_executeModTables(entries) {
		for (const mod of this.mods) {
			if (mod.isEnabled) {
				const table = mod.initializeTable(this);
				if (table) {
					Object.assign(entries, table.entries);
					mod.executeTable(this);
				}
			}
		}
	}

	/**
	 * @param {{[key: string]: string}} entries
	 */
	_finalizeEntries(entries) {
		Object.defineProperty(this._getGameWindow(), 'entries', {
			value : Object.freeze(entries),
			writable : false
		});
	}

	_executeMainDb() {
		if (!this.table) {
			return this._removeOverlay();
		}

		this.table.execute(this._getGameWindow(), this._getGameWindow());
	}

	/**
	 * Applies all definitions and loads the mods
	 */
	_executeDb() {
		const entries = Object.assign({}, this.table.entries);

		try {
			this._executeModTables(entries);
			this._finalizeEntries(entries);
		} catch (err) {
			console.error('An error occured while loading mod tables', err);
		}
	}

	/**
	 * Sets up all global objects from ccloader in the game window
	 * @returns {{[key: string]: string}} entries
	 */
	_setupGamewindow() {
		this.ui.applyBindings(this._getGameWindow().console);

		Object.assign(this._getGameWindow(), {
			Plugin: Plugin,
			reloadTables: () => this.reloadTables(),
			getEntry: name => this._getGameWindow().entries[name],
			getEntryName: value => 
				Object.keys(this._getGameWindow().entries)
					.find(key => this._getGameWindow().entries[key] === value)
		});

		this.versions = this._getGameWindow().versions = {
			ccloader: CCLOADER_VERSION,
			crosscode: this.ccVersion
		};

		this._getGameWindow().document.createEvent('Event').initEvent('modsLoaded', true, true);
	}
	
	/**
	 * Searches for mods and stores them in this.mods
	 */
	_getModPackages() {
		const modFiles = this.filemanager.getAllModsFiles();
		const pluginFiles = this.filemanager.getAllPluginFiles();

		this.mods = [];
		for (const modFile of modFiles) {
			this.mods.push(new Mod(this, modFile, false));
		}
		for (const pluginFile of pluginFiles) {
			this.mods.push(new Mod(this, pluginFile, true));
		}
	}

	_registerMods() {
		this._getGameWindow().inactiveMods = [];
		this._getGameWindow().activeMods = [];
		
		for (const mod of this.mods) {
			if (mod.isEnabled) {
				this._getGameWindow().activeMods.push(mod);
				if (mod.preload) {
					if (mod.name === 'Simplify') {
						this.loader.addPreloadFirst(mod.preload, mod.module);
					} else {	
						this.loader.addPreload(mod.preload, mod.module);
					}
				}
				if (mod.postload) {
					this.loader.addPostload(mod.postload, mod.module);
				}
			} else {
				this._getGameWindow().inactiveMods.push(mod);
			}
		}
	}

	/**
	 * Loads the package.json of the mods. This makes sure all necessary data needed for loading the mod is available
	 */
	_loadModPackages() {
		this._getModPackages();
		return Promise.all(this.mods.map((mod) => mod.onload(this.mods)));
	}

	async _initializeMods() {
		for (const mod of this.mods) {
			if (mod.isEnabled) {
				this.versions[mod.name] = mod.version;

				try {
					await mod.load();
				} catch (e) {
					console.warn(`Could not load "${mod.name}": ${e}`);
				}
			}
		}
	}

	/**
	 * @returns {Promise<void>}
	 */
	_initializeGame() {
		return new Promise((resolve, reject) => {
			if (typeof global !== 'undefined') {
				this._enableNode();
			}

			this.frame.onload = () => {
				this._getGameWindow().onbeforeunload = () => this.startGame();
				resolve();
			};
			this.frame.onerror = event => reject(event);
			this.loader.startGame(this.frame);
		});
	}

	_enableNode() {
		Object.assign(this._getGameWindow(), {
			require,
			process,
			global,
			Buffer,
			root: global.root
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
		if (this.status && this.overlay && this.status.isConnected && this.overlay.isConnected) {
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
	/**
	 * 
	 * @param {Mod} mod 
	 * @param {Mod[]} mods 
	 */
	_canLoad(mod, mods) {
		const deps = mod.dependencies;
		if(!deps) {
			return true;
		}

		for (const depName in deps){
			if(!Object.prototype.hasOwnProperty.call(deps, depName))
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

			for(let i = 0; i < mods.length && !satisfied; i++){
				if(mods[i].isEnabled && mods[i].name === depName){
					if(semver.satisfies(semver.valid(mods[i].version), depRange)){
						satisfied = true;
					}
				}
			}

			if(!satisfied){
				return false;
			}
		}

		if (mod.isPlugin) {
			return mod.pluginInst.checkDependencies(mods);
		}

		return true;
	}

	_definitionsNeeded() {
		return !semver.satisfies(this.ccVersion, '^1.0.4');
	}
}

