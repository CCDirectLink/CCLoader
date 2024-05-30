import { Mod } from './mod.js';

export class Package {
	/**
	 * 
	 * @param {import('./ccloader').ModLoader} modloader
	 * @param {string} file 
	 */
	constructor(modloader, file, ccmod = false) {
		this.file = file;
		this.modloader = modloader;
		this.ccmod = ccmod;

		this.baseDirectory = this._getBaseName(file).replace(/\\/g, '/').replace(/\/\//g, '/') + '/';
	}

	load() {
		if (this.ccmod) {
			return this._loadCCMod();
		} else {
			return this._loadPackage();
		}
	}

	/**
	 * 
	 * @returns {Mod}
	 */
	async _loadPackage() {
		const result = new Mod(this.modloader);
		const file = this.file;

		/** @type {{name: string, displayName?: string, ccmodHumanName?: string, version?: string, description?: string, icons?: {[size: string]: string}, module?: boolean, hidden?: boolean, main?: string, preload?: string, postload?: string, prestart?: string, assets: string[], ccmodDependencies: {[key: string]: string}}} */
		let manifest;
		try {
			manifest = await this._parse(file);
			if(!manifest) {
				result.disabled = true;
				return result;
			}
		} catch (e) {
			console.error('Could not load mod: ' + file, e);
			result.disabled = true;
			return result;
		}

		result.name = manifest.name || this._getModNameFromFile(file);
		result.displayName = manifest.displayName || manifest.ccmodHumanName;
		result.description = manifest.description;
		result.icons = manifest.icons;
		result.version = manifest.version;
		result.module = !!manifest.module;
		result.hidden = !!manifest.hidden;

		result.main = this._normalizeScript(file, manifest.main);
		result.preload = this._normalizeScript(file, manifest.preload);
		result.postload = this._normalizeScript(file, manifest.postload);
		result.prestart = this._normalizeScript(file, manifest.prestart);
		result.plugin = this._normalizeScript(file, manifest.plugin);

		result.baseDirectory = this.baseDirectory;
		result.assets = await this._findAssets(this._getBaseName(file) + '/assets/', manifest.assets);
		result.dependencies = manifest.ccmodDependencies || manifest.dependencies || {};

		return result;
	}

	/**
	 * 
	 * @returns {Mod}
	 */
	async _loadCCMod() {
		const result = new Mod(this.modloader);
		const file = this.file;

		let manifest;
		try {
			manifest = await this._parse(file);
			if(!manifest) {
				result.disabled = true;
				return result;
			}
		} catch (e) {
			console.error('Could not load mod: ' + file, e);
			result.disabled = true;
			return result;
		}


		result.name = manifest.id || this._getModNameFromFile(file);
		result.displayName = manifest.title && manifest.title['en_US'] || manifest.title;
		result.description = manifest.description && manifest.description['en_US'] || manifest.description;
		result.icons = manifest.icons;
		result.version = manifest.version || '0.0.0';
		result.module = manifest.module === undefined || !!manifest.module;
		result.hidden = manifest.id === 'Simplify';

		result.main = this._normalizeScript(file, manifest.poststart);
		result.preload = this._normalizeScript(file, manifest.preload);
		result.postload = this._normalizeScript(file, manifest.postload);
		result.prestart = this._normalizeScript(file, manifest.prestart);
		result.plugin = this._normalizeScript(file, manifest.plugin);

		result.baseDirectory = this.baseDirectory;
		result.assets = await this._findAssets(this._getBaseName(file) + '/assets/', manifest.assets);
		result.dependencies = manifest.ccmodDependencies || manifest.dependencies || {};

		result.repository = manifest.repository;
		result.homepage = manifest.homepage;

		return result;
	}
	
	/**
	 * 
	 * @param {string} file 
	 */
	async _parse(file) {
		return JSON.parse(await this.modloader.filemanager.getResourceAsync(file));
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

	/**
	 * 
	 * @param {string} manifestFile 
	 */
	_getModNameFromFile(manifestFile){
		if (!manifestFile.includes('package.json')) {
			return 'Unknown mod';
		}

		let name = manifestFile.match(/\/[^/]*\/package.json/g).pop().replace(/\//g, '');
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
	 * @param {string[] | undefined} list
	 */
	async _findAssets(dir, list){
		if(window.isLocal || this.modloader.filemanager.isPacked(dir)){
			return await this.modloader.filemanager.findFiles(dir, ['.json', '.json.patch', '.png', '.ogg']);
		} else if (list) {
			return list.map(asset => this.modloader.filemanager.filePathToAssetPath(dir + asset));
		} else {
			return [];
		}
	}
}
