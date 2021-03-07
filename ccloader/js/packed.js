const ASSETS_MODS_LENGTH = 13;//'/assets/mods/'.length;
const CONTENT_TYPES = {
	'css': 'text/css',
	'js': 'text/javascript',
	'json': 'application/json',
	'png': 'image/png',
	'jpg': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'html': 'text/html',
	'htm': 'text/html'
};

/**
 *  @type {Map<string, JSZip>}
 */
const jszipCache = new Map();

//Not exported because serviceworkers can't use es6 modules
// eslint-disable-next-line no-unused-vars
class PackedManager {
	/**
     *
     * @param {string} url
     */
	async get(url) {
		try {
			const zip = await this._openZip(url);
			const file = zip.file(this._assetPath(url));
			if (file === null) {
				return new Response(new Blob(), {
					status: 404,
					statusText: 'not found'
				});
			}

			return new Response(await file.async('blob'), {
				headers: {
					'Content-Type': this._contentType(url)
				},
				status: 200,
				statusText: 'ok'
			});
		} catch (e) {
			console.error('An error occured while reading a packed mod', e);
			return e;
		}
	}

	/**
	 *
	 * @param {string} url
	 * @returns {Promise<string[]>}
	 */
	async getFiles(url) {
		const zip = await this._openZip(url);
		const folder = this._openFolder(zip, this._assetPath(url));

		const result = [];
		folder.forEach((relativePath, file) => {
			if (!file.dir) {
				result.push(relativePath);
			}
		});
		return result;
	}

	/**
	 *
	 * @param {string} url
	 * @returns {Promise<boolean>}
	 */
	async isDirectory(url) {
		const zip = await this._openZip(url);
		const file = zip.file(this._assetPath(url));
		return file && file.dir;
	}

	/**
	 *
	 * @param {string} url
	 * @returns {Promise<boolean>}
	 */
	async isFile(url) {
		const zip = await this._openZip(url);
		const file = zip.file(this._assetPath(url));
		return !!file;
	}

	/**
     *
     * @param {string} url
     */
	packedName(url) {
		url = this._normalize(url);
		return decodeURIComponent(url.substring(ASSETS_MODS_LENGTH, url.indexOf('/', ASSETS_MODS_LENGTH)));
	}

	/**
	 *
	 * @param {string} url
	 */
	async _openZip(url) {
		const zip = this._zipPath(url);
		const cached = jszipCache.get(zip);
		if (cached) {
			return cached;
		}

		const request = new Request('http://' + location.hostname + '.cc' + zip);
		const cache = await caches.open('zips');
		let response = await cache.match(request);
		if (!response) {
			response = await fetch(zip);
			cache.put(request, response.clone());
		}

		const result = await JSZip.loadAsync(response.blob());
		jszipCache.set(zip, result);
		return result;
	}

	/**
	 *
	 * @param {JSZip} root
	 * @param {string} path
	 */
	_openFolder(root, path) {
		const folders = path.split(/\//g);
		for (const folder of folders) {
			root = root.folder(folder);
		}
		return root;
	}

	/**
     * @param {string} url
     * @returns {string}
     */
	_contentType(url) {
		url = this._normalize(url);
		return CONTENT_TYPES[url.substr(url.lastIndexOf('.') + 1)] || 'text/plain';
	}

	/**
     *
     * @param {string} url
     */
	_zipPath(url) {
		url = this._normalize(url);
		return url.substr(0, url.indexOf('/', ASSETS_MODS_LENGTH));
	}

	/**
     *
     * @param {string} url
     */
	_assetPath(url) {
		url = this._normalize(url);
		return url.substr(url.indexOf('/', ASSETS_MODS_LENGTH) + 1);
	}

	/**
	 *
	 * @param {string} url
	 */
	_normalize(url) {
		url = url.replace(/\\/g, '/').replace(/\/\//, '/');
		//TODO: resolve absolute paths
		if (!url.startsWith('/')) {
			url = '/' + url;
		}
		if (url.startsWith('/ccloader')) {
			url = url.substr(9); // '/ccloader'.length
		}
		return url;
	}
}
