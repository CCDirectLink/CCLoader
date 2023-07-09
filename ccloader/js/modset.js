
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

			const {name, mods, repos} = manifest;

			assert(typeof name === "string", "modset name must be a string.");
			assert(name !== "default", "modset name default is reserved.");
			assert(name.length > 0, "modset name can not be empty.");
			this.name = name;

			assert(Array.isArray(mods), "modset mods must be an array.");
			for(const mod of mods) {
				assert(typeof mod === "string", "modset mods must be an array of strings.");
			}
			this.mods = mods;

			if (repos != null) {
				assert(typeof repos === "object", "repos must be an object");
				assert(!Array.isArray(repos), "repos must not be an array.");
				for (const repoName of Object.keys(repos)) {

					assert(typeof repoName === "string", "repo name must be a string.");
					assert(repoName.length, "repo name must not be empty.");
					const repo = repos[repoName];
					assert(Array.isArray(repo), `repo ${repoName} must be an array.`);
					for(const mod of repo) {
						assert(typeof mod === "string", `repo must be an array of strings.`);
					}
				}
				this.repos = repos;
			} else {
				this.repos = {};
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
