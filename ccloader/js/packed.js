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

//Not exported because serviceworkers can't use es6 modules
// eslint-disable-next-line no-unused-vars
class PackedManager {
	/**
     * 
     * @param {string} url 
     */
	async get(url) {
		const resp = await fetch(this._zipPath(url));
		const zip = await JSZip.loadAsync(resp.blob());
		const file = zip.file(this._assetPath(url));
		return new Response(await file.async('blob'), {
			headers: {
				'Content-Type': this._contentType(url)
			},
			status: 200,
			statusText: 'ok'
		});
	}
    
	/**
     * 
     * @param {string} url 
     */
	packedName(url) {
		return decodeURIComponent(url.substr(ASSETS_MODS_LENGTH, url.indexOf('/', ASSETS_MODS_LENGTH) - ASSETS_MODS_LENGTH));
	}
    
	/**
     * @param {string} url
     * @returns {string}
     */
	_contentType(url) {
		return CONTENT_TYPES[url.substr(url.lastIndexOf('.') + 1)] || 'text/plain';
	}

	/**
     * 
     * @param {string} url 
     */
	_zipPath(url) {
		return url.substr(0, url.indexOf('/', ASSETS_MODS_LENGTH)) + '.ccmod';
	}

	/**
     * 
     * @param {string} url 
     */
	_assetPath(url) {
		return url.substr(url.indexOf('/', ASSETS_MODS_LENGTH) + 1);
	}
}