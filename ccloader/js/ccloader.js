import { Filemanager } from './filemanager.js';
import { UI } from './ui.js';
import { Loader } from './loader.js';
import { Plugin } from './plugin.js';
import { Greenworks } from './greenworks.js';
import { Package } from './package.js';
import { Modset } from './modset.js';

const CCLOADER_VERSION = '2.22.1';
const KNOWN_EXTENSIONS = ["post-game", "manlea", "ninja-skin", "fish-gear", "flying-hedgehag", "scorpion-robo", "snowman-tank"]

export class ModLoader {
	constructor() {
		this.filemanager = new Filemanager(this);
		this.ui = new UI(this);
		this.loader = new Loader(this.filemanager);

		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');

		/** @type {Modset[]} */
		this.modsets = [];

		/** @type {Mod[]} */
		this.mods = [];
		/** @type {{[name: string]: string}} */
		this.versions = {};
		/** @type {string[]} */
		this.extensions = this.filemanager.getExtensions();
	}

	/**
	 * Loads and starts the game. It then loads the definitions and mods
	 */
	async startGame() {
		await this._buildCrosscodeVersion();

		await this.loader.initialize();

		await this._loadModPackages();
		this._registerModsets();
		this._orderCheckMods();
		this._registerMods();

		this._setupGamewindow();

		await this._loadPlugins();
		await this._executePreload();

		this.loader.setStatus('Loading Game');
		await this.loader.startGame(); //Executes until postload

		await this._executePostload();
		this.loader.continue();
		await this._waitForGame();

		// At this point the game UI has become interactive, though the legacy
		// "main" entrypoint is loaded a couple hundred milliseconds later, so
		// CCLoader status overlay is still visible. I think it will result in
		// better UX if we give the user an "illusion" of interactivity before
		// "main" is removed for good.
		window.focus();

		await this._executeMain();


		this._fireLoadEvent();
		this.loader.removeOverlay();
		// Re-focus the game iframe a second time because at this point CCLoader has
		// **really** finished loading the game along with the active mods.
		window.focus();
	}

	async _initializeServiceWorker() {
		this._serviceWorker = await this.filemanager.loadServiceWorker('serviceworker.js', window);
	}

	/**
	 * Notifies filemanager and the serviceworker about existing packed mods.
	 * @param {string[]} packedMods
	 */
	async _loadPackedMods(packedMods) {
		const names = packedMods.map((m) => {
			const pieces = m.split(/\\|\//g);
			return pieces.pop();
		});
		// Reset the cache for this session
		const caches = window.caches;
		const keys = await caches.keys();
		await Promise.all(keys.map(name => caches.delete(name)));


		this.filemanager.setPackedMods(names);
	}

	async _buildCrosscodeVersion() {
		try {
			const { changelog } = JSON.parse(await this.filemanager.getResourceAsync('assets/data/changelog.json'));
			this.ccVersion = changelog[0].version;
		} catch (e) {
			let ccVersion = localStorage.getItem('cc.version');
			if (ccVersion) {
				const json = JSON.parse(ccVersion);
				this.ccVersion = json.major + '.' + json.minor + '.' + json.patch;
			} else {
				console.error('Could not find crosscode version. Assuming "0.0.0".', e);
				this.ccVersion = '0.0.0';
			}
		}
	}


	/**
	 * Adds manifestPath to the proper array based upon its extension.
	 * Ignored if no ending matches found.
	 * @param {string} manifestPath
	 * @param {string[]} modFiles grouped by /package.json ending
	 * @param {string[]} ccmodFiles grouped by /ccmod.json ending
	 * @param {string[]} packedMods grouped by .ccmod ending
	 */
	_sortModByExtension(manifestPath, modFiles, ccmodFiles, packedMods) {
		const endings = this.filemanager.endings;
		const selectedArray = [
			modFiles,
			ccmodFiles,
			packedMods
		];
		for (let i = 0; i < endings.length; i++) {
			const ending = endings[i];
			if (manifestPath.endsWith(ending)) {
				selectedArray[i].push(manifestPath);
				break;
			}
		}
	}

	/**
	 * Loads the package.json of the mods. This makes sure all necessary data needed for loading the mod is available.
	 * @returns {Promise<void>}
	 */
	async _loadModPackages() {
		let requiredMods = [];
		const modsetFiles = this.filemanager.getAllModsetFiles();
		let modFolder = '';	
		let modset = null;
		let modsets = modsetFiles.map((manPath) => new Modset(this, manPath));
		
		let modFiles = [];
		let ccmodFiles = [];
		let packedMods = [];
		if (modsets.length > 0) {	
			await Promise.all(modsets.map(modset => modset.load()));
			// If there are modsets with the same name
			// the first one found will be loaded in;
			this.modsets = modsets;
			const activeModsetName = localStorage.getItem('modset');
			const activeModset = modsets.find(modset => modset.name === activeModsetName);
			if (activeModset && activeModset.loaded) {
				modset = activeModset;
			} else if(activeModsetName) {
				console.log("Could not load", activeModsetName, "loading default");
			}
		} 
	
		// load default folder
		if (modset == null) {
			modset = {name: 'default'};
			modFiles = this.filemanager.getAllModsFiles();
			ccmodFiles = this.filemanager.getAllCCModFiles();
			packedMods = this.filemanager.getAllModPackages();
		} else {
			const modsFolder = modset.baseDirectory;
			console.log("Loading in", modset.name, "located at", modsFolder);
			const loaderMods = [
				'simplify',
				'ccloader-version-display',	
			];
			// Find necessary files
			const loaderModsFiles = this.filemanager.getSelectModsFiles(loaderMods);
			for(let i = 0; i < loaderModsFiles.length; i++) {
				const loaderModFiles = loaderModsFiles[i];
				if (loaderModFiles.length === 0) {
					// Can not proceed
				} else {
					this._sortModByExtension(loaderModFiles[0], modFiles, ccmodFiles, packedMods);
				}
			}
			for (const modName of modset.mods) {
				let foundModFiles = [];
				for (let searchPath of modset.searchPaths) {
					console.log("Searching for", modName,"in", searchPath);
					const selectFiles = this.filemanager.getSelectModsFiles([modName],searchPath);
					foundModFiles = selectFiles.pop() || [];
					if (foundModFiles.length > 0) {
						break;
					}
				}

				if (foundModFiles.length === 0) {
					console.log("Could not find", modName);
				} else {
					this._sortModByExtension(foundModFiles[0], modFiles, ccmodFiles, packedMods);
				}
			}

		}

		if (packedMods.length > 0) {
			if (window.CrossAndroid) {
				console.warn('Mods using .ccmod files are not supported yet. Please rename them to .zip and extract them before using CrossAndroid.');
			} else {
				await this._initializeServiceWorker();
				await this._loadPackedMods(packedMods);
				await Promise.all(packedMods.map(async packed => {
					const path = packed.substring(0, packed.length);
	
					const isCCMod = await this.filemanager.packedFileExists(path + '/ccmod.json');
					if (isCCMod) {
						ccmodFiles.push(path + '/ccmod.json');
						return;
					}
	
					const isPkg = await this.filemanager.packedFileExists(path + '/package.json');
					if (isPkg) {
						modFiles.push(path + '/package.json');
						return;
					}
					
					console.error(`Invalid ccmod file. (Did you package it correctly?): ${path}`);
				}));
			}
		}

		/** @type {Package[]} */
		const packages = [];
		for (const modFile of modFiles) {
			packages.push(new Package(this, modFile, modset.name));
		}
		for (const ccmodFile of ccmodFiles) {
			const pkg = new Package(this, ccmodFile, modset.name, true);

			const existing = packages.findIndex(p => p.baseDirectory === pkg.baseDirectory);
			if (existing > -1) {
				packages.splice(existing, 1);
			}

			packages.push(pkg);
		}

		this.mods = await Promise.all(packages.map(pkg => pkg.load()));
	}

	/**
	 * Orders mods and checks their dependencies. Simplify is always loaded first.
	 */
	_orderCheckMods() {
		const mods = [];

		let lastCount = 0;
		while (this.mods.length != lastCount) {
			lastCount = this.mods.length;
			for (let i = this.mods.length - 1; i >= 0; i--) {
				const mod = this.mods[i];
				if (this._canLoad(mod, mods)) {
					if (mod.name !== 'Simplify') {
						mods.push(mod);
					} else {
						mods.unshift(mod);
					}
					this.mods.splice(i, 1);
				}
			}
		}

		for (const mod of this.mods.filter(m => m.isEnabled)) {
			this._printMissingDependencies(mod, this.mods);
		}

		for (const mod of this.mods) {
			mod.disabled = true;
			mods.push(mod);
		}

		this.mods = mods;
	}

	/**
	 * Complain that dependencies are not satisfied.
	 * @param {Mod} mod
	 * @param {Mod[]} mods
	 */
	_printMissingDependencies(mod, mods) {
		const badDeps = this._unmetModDependencies(mod, mods);
		const prefix = `Could not load mod ${mod.name}: `;
		for (const depName in badDeps) {
			console.warn(prefix + badDeps[depName]);
		}
	}

	/**
	 * Return true if mod can be loaded.
	 * @param {Mod} mod
	 * @param {Mod[]} mods
	 */
	_canLoad(mod, mods) {
		if (!mod.isEnabled) {
			return false;
		}
		return this._unmetModDependencies(mod, mods) === null;
	}

	/**
	 * @param {Mod} mod check dependencies of this mod.
	 * @param {Mod[]} mods list of available mods.
	 * @return {{[name: string]: string}|null} Object whose keys are dependencies that cannot
	 * be used and values are error messages explaining why.
	 */
	_unmetModDependencies(mod, mods) {
		const deps = mod.dependencies;
		if (!deps) {
			return null;
		}

		/** @type {{[name: string]: string}} */
		const result = {};
		for (const depName in deps) {
			if (!Object.prototype.hasOwnProperty.call(deps, depName))
				continue;

			const depRange = semver.validRange(deps[depName]);
			if (!depRange) {
				result[depName] = `Syntax error in version range "${deps[depName]}" for dependency ${depName}`;
				continue;
			}

			let depVersion = null;
			let enabled = true;
			let depDesc = depName;
			let isExtension = false;
			let mod;
			switch (depName) {
			case 'ccloader':
				depVersion = CCLOADER_VERSION;
				break;
			case 'crosscode':
				depVersion = this.ccVersion;
				break;
			default:
				if(KNOWN_EXTENSIONS.includes(depName) || this.extensions.includes(depName)) {
					isExtension = true;
					depDesc = 'extension ' + depDesc;
					depVersion = this.ccVersion;
				} else {
					depDesc = 'mod ' + depDesc;
					mod = mods.find(m => m.name === depName);
					if (mod) {
						depVersion = mod.version;
						enabled = mod.isEnabled;
					}
				}
			}

			if (isExtension && !this.extensions.includes(depName)) {
				result[depName] = `${depDesc} is missing`
			} else if (!enabled) {
				result[depName] = `${depDesc} is disabled`;
			} else if (depVersion === null) {
				result[depName] = `${depDesc} is missing`;
			} else if (semver.valid(depVersion) === null) {
				result[depName] = `${depDesc}'s version "${depVersion}" has a syntax error`;
			} else if (!semver.satisfies(depVersion, depRange)) {
				result[depName] = `requires ${depDesc} version ${depRange} but version ${depVersion} present`;
			}
		}

		if (Object.keys(result).length === 0) {
			return null;
		}
		return result;
	}

	/*
	 * Exposes all detected modsets to the game window's object
	 */
	_registerModsets() {
		window.modsets = this.modsets;
		window.modsets = Object.freeze(window.modsets);
	}

	/**
	 * Pushes mods into the game window's inactiveMods and activeMods arrays and registers their versions.
	 */
	_registerMods() {

		const inactiveMods = window.inactiveMods = [];
		const activeMods = window.activeMods = [];

		for (const mod of this.mods) {
			if (mod.isEnabled) {
				activeMods.push(mod);
				this.versions[mod.name] = mod.version;
			} else {
				inactiveMods.push(mod);
			}
		}

		window.activeMods = Object.freeze(window.activeMods);
		window.inactiveMods = Object.freeze(window.inactiveMods);
	}

	/**
	 * Sets up all global objects from ccloader in the game window.
	 */
	_setupGamewindow() {
		this.ui.applyBindings(window.console);

		const versions = Object.assign(this.versions, {
			ccloader: CCLOADER_VERSION,
			crosscode: this.ccVersion
		});

		Object.assign(window, {
			Plugin,
			versions,
			Greenworks
		});

		window.document.head.appendChild(this.loader.getBase());
		window.document.createEvent('Event').initEvent('modsLoaded', true, true);
	}

	/**
	 * Initializes the plugin constructors.
	 */
	async _loadPlugins() {
		for (const mod of this.mods.filter(m => m.isEnabled && m.plugin)) {
			try {
				await mod.loadPlugin();
			} catch (e) {
				console.error(`Could not load plugin of mod '${mod.name}': `, e);
			}
		}
	}

	async _executePreload() {
		for (const mod of this.mods.filter(m => m.isEnabled)) {
			try {
				await mod.loadPreload();
			} catch (e) {
				console.error(`Could not run preload of mod '${mod.name}': `, e);
			}
		}
	}

	async _executePostload() {
		for (const mod of this.mods.filter(m => m.isEnabled)) {
			try {
				await mod.loadPostload();
			} catch (e) {
				console.error(`Could not run postload of mod '${mod.name}': `, e);
			}
		}
	}

	/**
	 * Waits for the game to be completely loaded
	 * @returns {Promise<void>}
	 */
	_waitForGame() {
		return new Promise(resolve => {
			const intervalid = setInterval(() => {
				if (window.ig && window.ig.ready) {
					clearInterval(intervalid);
					resolve();
				}
			}, 1000);
		});
	}

	async _executeMain() {
		for (const mod of this.mods.filter(m => m.isEnabled)) {
			try {
				await mod.load();
			} catch (e) {
				console.error(`Could not run main of mod '${mod.name}': `, e);
			}
		}
	}

	_fireLoadEvent() {
		window.document.body.dispatchEvent(new Event('modsLoaded'));
	}
}
