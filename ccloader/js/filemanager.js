const isBrowser = window.isBrowser;
const isLocal = !isBrowser;

export class Filemanager {
	/**
	 *
	 * @param {import('./ccloader').ModLoader} modloader
	 */
	constructor(modloader) {
		this.modloader = modloader;
		this.packed = [];
		// eslint-disable-next-line no-undef
		this._packedManager = new PackedManager();

		if (isLocal) {
			this.fs = require('fs');
			const path = require('path');
			this.pathSep = path.sep;
			this.pathJoin = path.join;
		} else {
			this.fs = null;
			this.pathSep = '/';
			this.pathJoin = (...args) => args.join('/');
		}

		if (isBrowser) {
			this.getResourceAsync('../mods.json').then((text) => {
				this.modList = JSON.parse(text);
			}).catch((e) => {
				console.error('Could not load mod list. Proceeding to load without any mods. ', e);
				this.modList = [];
			});
		}
	}

	/**
	 *
	 * @param {string[]} names
	 */
	setPackedMods(names) {
		this.packed = names;
	}

	/**
	 *
	 * @param {string} file
	 * @param {boolean} isModule
	 */
	loadMod(file, isModule) {
		return this._loadScript(file, document, isModule ? 'module' : 'text/javascript');
	}

	getAllModsFiles() {
		const subs = this._getModFoldersOnAndroid('/') || this._getFolders();
		return [].concat(...subs.map(sub => this._getResourcesInFolder(sub, this.pathSep + 'package.json')));
	}

	getAllCCModFiles() {
		const subs = this._getModFoldersOnAndroid('/') || this._getFolders();
		return [].concat(...subs.map(sub => this._getResourcesInFolder(sub, this.pathSep + 'ccmod.json')));
	}

	getAllModPackages() {
		return this._getModFoldersOnAndroid('.ccmod') || this._getResourcesInFolder(null, '.ccmod');
	}

	_getModFoldersOnAndroid(ending) {
		const provider = window.CrossAndroidModListProvider;
		if (provider && provider.getModListAsJson) {
			const entries = [];
			for (let entry of JSON.parse(provider.getModListAsJson())) {
				if (entry.endsWith(ending)) {
					if (ending === '/') {
						entry = entry.slice(0, -1);
					}
					entries.push('assets/mods/' + entry);
				}
			}
			return entries;
		}
		return null;
	}

	getExtensions() {
		const provider = window.CrossAndroidExtensionListProvider;
		if (provider && provider.getExtensionListAsJson) {
			return JSON.parse(provider.getExtensionListAsJson());
		}
		return this._getFolders('assets/extension').map(value => value.substr(17));
	}

	/**
	 *
	 * @param {string} resource
	 * @returns {Promise<string>}
	 */
	async getResourceAsync(resource) {
		resource = resource.replace(/\\/g, '/');
		if (resource.startsWith('assets/') || resource.startsWith('ccloader/')) {
			resource = '/' + resource;
		}

		const resp = await fetch(resource);
		return await resp.text();
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
	 * @param {string} file 
	 * @returns {Promise<boolean>}
	 */
	async packedFileExists(file) {
		if (!this.isPacked(file)) {
			return false;
		}
		
		return (await fetch(file, {
			headers: {
				'X-Cmd': 'isFile'
			}
		})).json();
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
	 *
	 * @param {string} path
	 * @param {window} window
	 * @returns {Promise<ServiceWorker>}
	 */
	async loadServiceWorker(path, window) {
		const currentRegistration = await window.navigator.serviceWorker.getRegistration();
		if (currentRegistration) {
			//Do not await update since the worker only performs a simple task. Even if there is a bugfix it should be enough to not crash. 
			currentRegistration.update();
		} else {
			await window.navigator.serviceWorker.register(path, { updateViaCache: 'none' });
		}

		if (!window.navigator.serviceWorker.controller || window.navigator.serviceWorker.controller.state !== 'activated') {
			window.location.reload();
			window.location.href = window.location.toString();
			history.go(0);

			throw new Error('(╯°□°）╯︵ ┻━┻');
		}

		return window.navigator.serviceWorker.controller;
	}

	/**
	 *
	 * @param {string} path
	 */
	isPacked(path) {
		return this.packed.includes(this._packedManager.packedName(path));
	}

	/**
	 * Returns all files with the given ending in the folder
	 * @param {string?} folder
	 */
	_getFolders(folder) {
		if (!folder)
			folder = 'assets/mods/';

		if (isLocal) {
			return this._getLocalFolders(folder);
		} else {
			var results = [];
			for (var i in this.modList) {
				if (this._resourceExists(folder + this.modList[i])) {
					results.push(folder + this.modList[i]);
				}
			}
			return results;
		}
	}

	/**
	 * Returns all files with the given ending in the folder
	 * @param {string?} folder
	 * @param {string?} ending
	 */
	_getResourcesInFolder(folder, ending) {
		if (!folder)
			folder = 'assets/mods/';

		if (isLocal) {
			return this._getResoucesInLocalFolder(folder, ending);
		} else if (folder.endsWith('mods/')) {
			var results = [];
			for (var i in this.modList) {
				if (this._resourceExists(folder + this.modList[i] + ending)) {
					results.push(folder + this.modList[i] + ending);
				}
			}
			return results;
		} else {
			if (this._resourceExists(folder + '/' + ending))
				return [folder + '/' + ending];
			return [];
		}
	}

	/**
	 *
	 * @param {string} dir
	 * @returns {Promise<string[]>}
	 */
	async _getFiles(dir) {
		if (this.isPacked(dir)) {
			return (await fetch(dir, {
				headers: {
					'X-Cmd': 'getFiles'
				}
			})).json();
		}

		return new Promise((resolve, reject) => {
			this.fs.readdir(dir, (err, files) => {
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
			this.fs.stat(file, (err, stats) => {
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
	 * @param {string} file
	 * @returns {Promise<boolean>}
	 */
	async _isDirectoryAsync(file) {
		if (this.isPacked(file)) {
			return (await fetch(file, {
				headers: {
					'X-Cmd': 'isDirectory'
				}
			})).json();
		}

		const stats = await this._getStats(file);
		return stats && stats.isDirectory();
	}

	/**
	 *
	 * @param {string} dir
	 * @param {string} file
	 * @param {string[]} [endings]
	 * @returns {Promise<string[]>}
	 */
	async _checkFileForAsset(dir, file, endings) {
		const filePath = this.pathJoin(dir, file);

		try {
			if (await this._isDirectoryAsync(filePath)) {
				return await this.findFiles(filePath, endings);
			} else if (!endings || endings.some(ending => filePath.endsWith(ending))) {
				return [this.filePathToAssetPath(filePath)];
			}
			return [];
		} catch (e) {
			return [];
		}
	}

	/**
	 *
	 * @param {string} filePath
	 * @returns {string}
	 */
	filePathToAssetPath(filePath) {
		return filePath.substr(7).replace(/\\/g, '/');
	}

	/**
	 *
	 * @param {string} resource
	 */
	_resourceExists(resource) {
		if (isLocal) {
			try {
				this.fs.statSync(resource);
				return true;
			} catch (e) {
				return false;
			}
		} else {
			try {
				const req = new XMLHttpRequest();
				req.open('HEAD', '/' + resource, false);
				req.send();
				return req.status != 404;
			} catch (e) {
				return false;
			}
		}
	}

	/**
	 *
	 * @param {string} file
	 * @returns {Promise<Blob>}
	 */
	async _getBlob(file) {
		const resp = await fetch(file);
		return resp.blob();
	}

	/**
	 *
	 * @param {string} url
	 * @param {document} doc
	 * @param {string} type
	 * @returns {Promise<void>}
	 */
	_loadScript(url, doc, type) {
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
	_getResoucesInLocalFolder(folder, ending) {
		/** @type {string[]} */
		let results = [];

		if (isLocal) {
			try {
				this.fs.readdirSync(folder).forEach(file => {
					try {
						file = this.pathJoin(folder, file);

						if (!this._isDirectory(file) && file.endsWith(ending)) {
							results.push(file);
						}
					} catch (e) { }
				});
			} catch (e) { }
		}

		return results;
	}

	/**
	 * Returns all files with the given ending in the folder
	 * @param {string} folder
	 */
	_getLocalFolders(folder) {
		/** @type {string[]} */
		let results = [];

		if (isLocal) {
			try {
				return this.fs.readdirSync(folder)
					.map(file => this.pathJoin(folder, file))
					.filter(file => this._isDirectory(file));
			} catch (e) { }
		}

		return results;
	}

	/**
	 *
	 * @param {string} file
	 * @returns {boolean}
	 */
	_isDirectory(file) {
		const stat = this.fs.statSync(file);
		return stat && stat.isDirectory();
	}

	_createDirectories() {
		if (isLocal) {
			this._createDirectory('ccloader/data/assets/mods');
		}
	}

	/**
	 *
	 * @param {string} dir
	 */
	_createDirectory(dir) {
		if (isBrowser) {
			return;
		}

		if (this.fs.existsSync(dir) && this.fs.statSync(dir).isDirectory()) {
			return;
		}

		const parent = this.pathJoin(dir, '..');
		this._createDirectory(parent);

		this.fs.mkdirSync(dir);
	}
}
