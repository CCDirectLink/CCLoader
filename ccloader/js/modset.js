
function assert(bool, message = '') {
	if (!bool) {
		throw message;
	}
}
export class Modset {
	constructor(modloader, manifestPath) {
		this.loaded = false;
		this.modloader = modloader;
		this.name = "";
		this.mods = [];
		this.manifestPath = manifestPath;
		this.baseDirectory = this._getBaseName(manifestPath).replace(/\\/g, '/').replace(/\/\//g, '/') + '/';
	}

	async load() {
		try {
			const {name, mods} = await this._parse(this.manifestPath);
			assert(typeof name === "string", "modset name must be a string.");
			assert(Array.isArray(mods), "modset mods must be an array.");
			for(const mod of mods) {
				assert(typeof mod === "string", "modset mods must be a strings array.");
			}
			assert(name !== "default", "modset name default is reserved.");
			assert(name.length > 0, "modset name can not be empty.");
			this.name = name;
			this.mods = mods;
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
