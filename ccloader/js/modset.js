
function assert(bool, message = '') {
	if (!bool) {
		throw message;
	}
}
export class Modset {
	constructor(modloader, manifestPath) {
		this.modloader = modloader;
		this.manifestPath = manifestPath;

		this.manifest = null;
		this.name = "";
		this.mods = [];

		this.baseDirectory = this._getBaseName(manifestPath).replace(/\\/g, '/').replace(/\/\//g, '/') + '/';

		this.loaded = false;

	}

	async load() {
		try {
			const manifest = await this._parse(this.manifestPath);
			this.manifest = manifest;

			const {id, name, mods, searchPaths} = manifest;

			assert(typeof id === "string", "modset id must be a string.");
			assert(id.toLowerCase() === id, "modset id can not be capitalized.");
			assert(id.toLowerCase() !== "default", "modset id default is reserved.");
			assert(id.length > 0, "modset id can not be empty.");
			this.id = id;
			this.name = name || id;

			assert(Array.isArray(mods), "modset mods must be an array.");
			for(const mod of mods) {
				assert(typeof mod === "string", "modset mods must be an array of strings.");
			}
			this.mods = mods;
			let hasDot = false;
			if (searchPaths) {
				assert(Array.isArray(searchPaths), "modset searchPaths must be an array.");
				for(const searchPath of searchPaths) {
					assert(typeof searchPath === "string", "modset searchPaths must be an array of strings.");
					if (searchPath === ".") {
						hasDot = true;
					}
				}
				this.searchPaths = searchPaths;
			} else {
				this.searchPaths = [];
			}
			if (hasDot) {
				const dotIndex = this.searchPaths.indexOf(".");
				// Replace with assets/mods/
				this.searchPaths.splice(dotIndex, 1, this.baseDirectory);
			} else {
				this.searchPaths.unshift(this.baseDirectory);
			}
			this.loaded = true;
		} catch(e) {
			console.log("Failed to load", this.manifestPath);
			console.log(e);
		}
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

}
