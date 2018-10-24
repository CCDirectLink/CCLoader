export class Preloader {
	/**
	 * @param {import('./filemanager.js').Filemanager} filemanager
	 */
	constructor(filemanager) {
		this.filemanager = filemanager;

		this.dictionary = {};
		this.nameCache = {
			props: {
				props: this.dictionary
			},
			vars: {
				props: this.dictionary
			}
		};
	}

	/**
	 * @param {{[key: string]: string}} entries
	 */
	loadDictionary(entries) {
		for (const key in entries) {
			if (entries.hasOwnProperty(key) && typeof entries[key] === 'string') {
				this.dictionary['$' + key] = entries[key];
			}
		}
	}

	/**
	 * 
	 * @param {import('./mod.js').Mod} mod
	 * @returns {Promise<{code: string, map: string}>}
	 */
	async prepare(mod) {
		await this._loadUglify();

		const files = {};
		files[mod.main] = await this.filemanager.getResourceAsync('assets/' + mod.main);

		return window.uglify.minify(files, {
			nameCache: this.nameCache,
			sourceMap: true,
			mangle: {
				properties: true
			}
		});
	}

	/**
	 * Loads the uglify library if necessary
	 */
	_loadUglify() {
		if (window.uglify) {
			return Promise.resolve();
		}

		return this.filemanager.loadScript('js/lib/uglify-es.browser.js', false);
	}
}