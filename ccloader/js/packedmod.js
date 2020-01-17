import { Mod } from './mod.js';

const path = require('path');
export class PackedMod extends Mod {

    /**
	 * 
	 * @param {import('./ccloader').ModLoader} modloader
     * @param {string} name of mod
	 * @param {string} file path to manifest
	 */

    constructor(modloader, file) {
		if (path.sep !== '/') {
			file = file.split(path.sep).join('/');
		}
        super(modloader, file);
    }


	get packed() {
		return true;
	}

	async loadManifest() {
		const relativeModPath = this._resolvePath("");

		await frame.contentWindow.fetch(`mods/api/preload?path=assets/${relativeModPath}`);

		return await super.loadManifest(true);
	}

	async _findAssets() {
		const response = await frame.contentWindow.fetch(`mods/api/get-assets?path=assets/${this._resolvePath("")}`);
		return await response.json();
	}

    _resolvePath(relativePath) {
		const basePath = this._getBaseName(this.file);
        if (!relativePath) {
            return this._normalizePath(basePath);
        }
		// get name 
        return this._normalizePath(basePath + '/' + relativePath);
	}
	

}
