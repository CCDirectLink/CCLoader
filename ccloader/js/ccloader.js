import { Filemanager } from './filemanager.js';
import { Mod } from './mod.js';
import { UI } from './ui.js';
import { Loader } from './loader.js';
import { Plugin } from './plugin.js';
import { Greenworks } from './greenworks.js';

const CCLOADER_VERSION = '2.19.0';

export class ModLoader {
	constructor() {
		this.filemanager = new Filemanager(this);
		this.ui = new UI(this);
		this.loader = new Loader(this.filemanager);

		this.frame = document.getElementById('frame');
		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');

		this.modsLoaded = 0;
		/** @type {Mod[]} */
		this.mods = [];
		/** @type {{[name: string]: string}} */
		this.versions = {};

	}

	/**
	 * Loads and starts the game. It then loads the definitions and mods
	 */
	async startGame() {
		await this._buildCrosscodeVersion();

		await this.loader.initialize();

		await this._loadModPackages();
		this._orderCheckMods();
		this._registerMods();

		this._setupGamewindow();

		await this._loadPlugins();
		await this._executePreload();

		this._setStatus('Loading Game');
		await this.loader.startGame(this.frame); //Executes until postload

		await this._executePostload();
		this.loader.continue(this.frame);
		await this._waitForGame();

		// At this point the game UI has become interactive, though the legacy
		// "main" entrypoint is loaded a couple hundred milliseconds later, so
		// CCLoader status overlay is still visible. I think it will result in
		// better UX if we give the user an "illusion" of interactivity before
		// "main" is removed for good.
		this._getGameWindow().focus();

		await this._executeMain();


		this._fireLoadEvent();
		this._removeOverlay();
		// Re-focus the game iframe a second time because at this point CCLoader has
		// **really** finished loading the game along with the active mods.
		this._getGameWindow().focus();
	}

	async _initializeServiceWorker() {
		this._serviceWorker = await this.filemanager.loadServiceWorker('serviceworker.js', this._getGameWindow());
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
		const caches = this._getGameWindow().caches;
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
		const packedMods = this.filemanager.getAllModPackages();

		if (packedMods.length > 0) {
			await this._initializeServiceWorker();
			await this._loadPackedMods(packedMods);
			for (const packed of packedMods) {
				modFiles.push(packed.substring(0, packed.length) + '/package.json');
			}
		}

		this.mods = [];
		for (const modFile of modFiles) {
			this.mods.push(new Mod(this, modFile, false));
		}

		return Promise.all(this.mods.map((mod) => mod.onload(this.mods)));
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
			let mod;
			switch (depName) {
			case 'ccloader':
				depVersion = CCLOADER_VERSION;
				break;
			case 'crosscode':
				depVersion = this.ccVersion;
				break;
			default:
				depDesc = 'mod ' + depDesc;
				mod = mods.find(m => m.name === depName);
				if (mod) {
					depVersion = mod.version;
					enabled = mod.isEnabled;
				}
			}

			if (!enabled) {
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

	/**
	 * Pushes mods into the game window's inactiveMods and activeMods arrays and registers their versions.
	 */
	_registerMods() {
		const inactiveMods = this._getGameWindow().inactiveMods = [];
		const activeMods = this._getGameWindow().activeMods = [];

		for (const mod of this.mods) {
			if (mod.isEnabled) {
				activeMods.push(mod);
				this.versions[mod.name] = mod.version;
			} else {
				inactiveMods.push(mod);
			}
		}

		this._getGameWindow().activeMods = Object.freeze(this._getGameWindow().activeMods);
		this._getGameWindow().inactiveMods = Object.freeze(this._getGameWindow().inactiveMods);
	}

	/**
	 *
	 * @returns {window}
	 */
	_getGameWindow() {
		return this.frame.contentWindow;
	}

	/**
	 * Sets up all global objects from ccloader in the game window.
	 */
	_setupGamewindow() {
		this.ui.applyBindings(this._getGameWindow().console);

		const versions = Object.assign(this.versions, {
			ccloader: CCLOADER_VERSION,
			crosscode: this.ccVersion
		});

		Object.assign(this._getGameWindow(), {
			Plugin,
			versions,
			Greenworks
		});

		this._getGameWindow().document.head.appendChild(this.loader.getBase());
		this._getGameWindow().document.createEvent('Event').initEvent('modsLoaded', true, true);
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

	/**
	 *
	 * @param {string} text
	 */
	_setStatus(text) {
		if (this.status && this.status.isConnected) {
			this.status.innerHTML = text;
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
				if (this._getGameWindow().ig && this._getGameWindow().ig.ready) {
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
		this._getGameWindow().document.body.dispatchEvent(new Event('modsLoaded'));
	}

	_removeOverlay() {
		if (this.status && this.overlay && this.status.isConnected && this.overlay.isConnected) {
			this.status.outerHTML = '';
			this.overlay.outerHTML = '';
		}
	}
}
