import { Filemanager } from './filemanager.js';
import { UI } from './ui.js';
import { Loader } from './loader.js';
import { Plugin } from './plugin.js';
import { Greenworks } from './greenworks.js';
import { Package } from './package.js';

const CCLOADER_VERSION = '2.25.2';
const KNOWN_EXTENSIONS = ["post-game", "manlea", "ninja-skin", "fish-gear", "flying-hedgehag", "scorpion-robo", "snowman-tank"]

export class ModLoader {
	constructor() {
		this.filemanager = new Filemanager(this);
		this.ui = new UI(this);
		this.loader = new Loader(this.filemanager);

		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');

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
		this._removeDuplicateMods();
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
		const names = packedMods.map((m) => m.substring(12, m.length));
		await this._sendPackedModNames(packedMods);
		this.filemanager.setPackedMods(names);
	}

	/**
	 *
	 * Notifies the serviceworker about existing packed mods.
	 * @param {string[]} packedMods
	 */
	async _sendPackedModNames(packedMods) {
		const caches = window.caches;
		const keys = await caches.keys();
		await Promise.all(keys.map(name => caches.delete(name)));

		const packedCache = await caches.open('packedMods');
		const dummyResponse = () => new Response('', { status: 200 });
		// CacheStorage does not like the chrome-extension:// schema
		const dummyPrefix = 'http://localhost/';
		await Promise.all(packedMods.map(path => packedCache.put(dummyPrefix + path, dummyResponse())));
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
	 * Loads the package.json of the mods. This makes sure all necessary data needed for loading the mod is available.
	 * @returns {Promise<void>}
	 */
	async _loadModPackages() {
		const modFiles = this.filemanager.getAllModsFiles();
		const ccmodFiles = this.filemanager.getAllCCModFiles();
		const packedMods = this.filemanager.getAllModPackages();

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
			packages.push(new Package(this, modFile));
		}
		for (const ccmodFile of ccmodFiles) {
			const pkg = new Package(this, ccmodFile, true);

			const existing = packages.findIndex(p => p.baseDirectory === pkg.baseDirectory);
			if (existing > -1) {
				packages.splice(existing, 1);
			}

			packages.push(pkg);
		}

		this.mods = await Promise.all(packages.map(pkg => pkg.load()));
	}

	_removeDuplicateMods() {
		/** @type {Map<string, Mod>} The key is the name/id of the mod */
		const mods = new Map();
		for (const mod of this.mods) {
			if (mods.has(mod.name)) {
				const existing = mods.get(mod.name);
				if (semver.lt(mod.version, existing.version)) {
					console.warn(`Duplicate mod found: ${existing.displayName} preferred version ${existing.version} over ${mod.version}`);
					mod.disabled = true;
					continue;
				} else if (semver.eq(mod.version, existing.version)) {
					console.warn(`Duplicate mod found: ${mod.displayName} version ${mod.version}. Picking the first one.`);
					existing.disabled = true;
				} else {
					console.warn(`Duplicate mod found: ${mod.displayName} preferred version ${mod.version} over ${existing.version}`);
					existing.disabled = true;
				}
			}
			
			mods.set(mod.name, mod);
		}
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
			this._printMissingDependencies(mod, [...mods, ...this.mods]);
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
				result[depName] = `${depDesc} is disabled or could not be loaded`;
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

		console.logToFile('Active mods: ', activeMods.map(m => m.name + ' ' +  m.version).join(', '));
		console.logToFile('Inactive mods: ', inactiveMods.map(m => m.name + ' ' +  m.version).join(', '));
	}

	/**
	 * Sets up all global objects from ccloader in the game window.
	 */
	_setupGamewindow() {
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
