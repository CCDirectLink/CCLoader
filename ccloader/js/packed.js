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

const STATUS_TO_TEXT = {
	200: 'ok',
	404: 'not found',
	500: 'internal server error',
};

/**
 *  @type {Map<string, JSZip>}
 */
const jszipCache = new Map();


function newResponse(respStatus, body, header) {
	let options = {
		'status': respStatus,
		'statusText': STATUS_TO_TEXT[respStatus],
		'headers': {}
	};
	if (typeof header === "object") {
		const headerOpt = options['headers'];
		for(const key of Object.keys(header)) {
			headerOpt[key] = header[key];
		}
	}
	return new Response(body, options);
}

class PackedApi {

	constructor(packedManager) {
		this.packedManager = packedManager;
	}

	handleCmd(fetchEvent, cmd) {
		const {request} = fetchEvent;
		const cmdFunc = this.packedManager[cmd];
		if (typeof cmdFunc !== 'function') {
			// Respond with not implemented
			return;
		}
		// path in format: /path/to/resource
		const path = new URL(request.url).pathname;
		fetchEvent.respondWith((async() => {
			const payload = await cmdFunc.call(this.packedManager, path);
			const body = JSON.stringify(payload);
			return newResponse(200, body);
		})());
	}
	
	async getZipFile(fetchEvent) {
		const {request} = fetchEvent;
		// path in format: /path/to/resource
		const path = new URL(request.url).pathname;
		const canFullfill = await this.packedManager.canFullfill(path);
		if (canFullfill) {
			return this.packedManager.get(path);
		}
		return fetch(request);
	}

	handleGet(fetchEvent) {
		const {request} = fetchEvent;
		// path in format: /path/to/resource
		const path = new URL(request.url).pathname;
		if (!path.includes('.ccmod')) {
			return;
		}
		fetchEvent.respondWith(this.getZipFile(fetchEvent));
	}

	handleRequest(fetchEvent) {
		const {request, respondWith} = fetchEvent;
		if (request.headers.has('X-Cmd')) {
			const cmd = request.headers.get('X-Cmd');
			return this.handleCmd(fetchEvent, cmd);
		}
		return this.handleGet(fetchEvent);
	}
}

//Not exported because serviceworkers can't use es6 modules
// eslint-disable-next-line no-unused-vars
class PackedManager {
	

	async canFullfill(url) {
		const [rootFolder, resourcePath] = this._splitPath(url);
		let ret = true;
		try {
			// If this throws an error then we know
			// we can't fullfil it
			await this._openZip(rootFolder);
		} catch (e) {
			ret = false;
		}
		return ret;
	}

	/**
     *
     * @param {string} url - format /mod-name.ccmod/path/to/resource
     */
	async get(url) { 
		let respStatus;
		let body = new Blob();
		let header = null;
		try {
			const [rootFolder, resourcePath] = this._splitPath(url);
			const zip = await this._openZip(rootFolder);
			const file = zip.file(resourcePath);
			if (file === null) {
				respStatus = 404;
			} else {
				respStatus = 200;
				body = await file.async('blob');
				header = {
					'Content-Type': this._contentType(resourcePath)
				};
			}
		} catch(e) {
			console.error('An error occured while reading a packed mod', e);
			respStatus = 500;
		}
		let response = newResponse(respStatus, body, header);
		return response;
	}
	


	async _openZip(zipfilePath) {
		const cached = jszipCache.get(zipfilePath);
		if (cached) {
			return cached;
		}

		const origin = `http://${location.hostname}.cc`;
		const pathname = zipfilePath;
		const href = origin + pathname;
		const request = new Request(href);
		const cache = await caches.open('zips');
		let response = await cache.match(request);
		if (!response) {
			response = await fetch(zipfilePath);
			cache.put(request, response.clone());
		}

		const result = await JSZip.loadAsync(response.blob());
		jszipCache.set(zipfilePath, result);
		return result;
	}

	/**
	 *
	 * @param {string} url - format /*.ccmod/path/to/resource
	 * @returns {Promise<string[]>}
	 */
	async getFiles(url) {
		const [rootFolder, resourcePath] = this._splitPath(url);
		const zip = await this._openZip(rootFolder);
		const folder = this._openFolder(zip, resourcePath);
		const result = [];
		folder.forEach((relativePath, file) => {
			if (!file.dir) {
				result.push(relativePath);
			}
		});
		return result;
	}

	async isDirectory(url) {
		const file = await this._getFile(url);
		return file && file.dir;
	}

	async isFile(url) {
		const file = await this._getFile(url);
		return !!file;
	}

	async _getFile(url) {
		const [rootFolder, resourcePath] = this._splitPath(url);
		const zip = await this._openZip(rootFolder);
		const file = zip.file(resourcePath);
		return file;
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

	_splitPath(url) {
		let normUrl = this._normalize(url);
		// Find the first index of .ccmod
		const extensionIdx = normUrl.indexOf('.ccmod');
		if (extensionIdx === -1) {
			return [normUrl, ""];
		}
		const sepIdx = normUrl.indexOf('/', extensionIdx);
		if (sepIdx === -1) {
			return [normUrl, ""];
		}
		let rootFolder = normUrl.substr(0, sepIdx);
		let subpath = normUrl.substr(sepIdx + 1);
		return [rootFolder, subpath];
	}

	/**
	 *
	 * @param {string} url
	 */
	_normalize(url) {
		url = url.replace(/\\/g, '/').replace(/\/\//g, '/');
		//TODO: resolve absolute paths
		if (!url.startsWith('/')) {
			url = '/' + url;
		}
		if (url.startsWith('/ccloader')) {
			url = url.substr(9); // '/ccloader'.length
		}
		return url;
	}
	/**
     *
     * @param {string} url
     */
	packedName(url) {
		const [rootFolder,_] = this._splitPath(url);
		return rootFolder.split('/').pop();
	}

	/**
     * @param {string} url
     * @returns {string}
     */
	_contentType(pathname) {
		return CONTENT_TYPES[pathname.substr(pathname.lastIndexOf('.') + 1)] || 'text/plain';
	}

}
