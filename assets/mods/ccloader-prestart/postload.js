ig.module("prestart").requires("game.main").defines(function () {
	

	/**
	 * 
	 * Normalizes to browser url format.
	 * @param {string} path
	 * @returns {string} 
	 */
	function normalize(path) {
		return path.split('/').join('\\').split('\\').join('/');
	}

	/**
	 * 
	 * @param {string} path
	 * @returns {string}
	 */

	function removeAssetFromPath(path) {
		path = normalize(path);
		return path.split('/').slice(1).join('/');
	}

	/**
	 * 
	 * @param {Mod} mod
	 * @returns {string} 
	 */
	
	function getPackageFilePath(mod) {
		return removeAssetFromPath(mod.file);
	}

	/**
	 * 
	 * @param {Mod} mod
	 * @returns {string} 
	 */
	function getBaseDirectory(mod) {
		return removeAssetFromPath(mod.baseDirectory);
	}

	async function loadPrestartMods() {
		for (const activeMod of activeMods) {
			
			try {
				const filemanager = activeMod.filemanager;
				const packagePath = getPackageFilePath(activeMod);
				const packageData = await fetch(packagePath).then((e) => e.json());
				
				const isModule = !!activeMod.manifest.module;

				if (packageData.prestart) {
					const baseDir = getBaseDirectory(activeMod);
					// merge folder
					const prestartPath = normalize(baseDir + packageData.prestart);
					
					// CCLoader will now load it
					await filemanager.loadMod(prestartPath, isModule);

				}

			} catch (e) {
				console.log(e);
			}
		}
	}

	const _main = ig.main;
	ig.main = function () {
		const args = arguments;
		loadPrestartMods().then(() => {
			_main.apply(this, arguments);
		});
	};
});
