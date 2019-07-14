export class Loader {
	/**
	 * 
	 * @param {import('./filemanager.js').Filemanager} filemanager 
	 */
	constructor(filemanager) {
		this.filemanager = filemanager;
		this.doc = null; /** @type {Document} */
		this.preloadPoint = null; /** @type {HTMLElement} */
		this.postloadPoint = null; /** @type {HTMLElement} */
	}

	async initialize() {
		const code = await this._loadEntrypoint();
		this.doc = this._parseEntrypoint(code);
		const base = this._insertBase(this._getEntrypointPath());
		this.preloadPoint = base;
		this.postloadPoint = this._findGame();
	}

	/**
	 * Adds a mod script that runs before game scripts are loaded
	 * @param {string} script 
	 * @param {boolean} module
	 */
	addPreload(script, module) {
		const next = this._createScript(script, module);
		this._insertAfter(next, this.preloadPoint);
		this.preloadPoint = next;
	}

	/**
	 * Adds a mod script that runs after game scripts are loaded
	 * @param {string} script
	 * @param {boolean} module
	 */
	addPostload(script, module) {
		const next = this._createScript(script, module);
		this._insertAfter(next, this.postloadPoint);
		this.postloadPoint = next;
	}

	/**
	 * 
	 * @param {HTMLIFrameElement} frame 
	 */
	startGame(frame) {
		frame.contentDocument.open();
		frame.contentDocument.write(this.doc.documentElement.outerHTML);
		frame.contentDocument.close();
	}


	_getEntrypointPath() {
		return window.isLocal ? (location.origin + '/assets/') : '/assets/';
	}

	async _loadEntrypoint() {
		try {
			return await this.filemanager.getResourceAsync('assets/node-webkit.html');
		} catch (_) {
			throw new Error('Could not find CrossCode entrypoint. Make sure you installed CCLoader correctly.');
		}
	}

	/**
	 * 
	 * @param {string} code
	 */
	_parseEntrypoint(code) {
		return new DOMParser().parseFromString(code, 'text/html');
	}

	/**
	 * 
	 * @param {string} href
	 */
	_insertBase(href) {
		const base = this.doc.createElement('base');
		base.href = href;
		this.doc.head.insertBefore(base, this.doc.head.firstChild);
		return base;
	}

	/**
	 * 
	 * @returns {HTMLDivElement}
	 */
	_findGame() {
		return this.doc.getElementById('game');
	}

	/**
	 * 
	 * @param {string} src 
	 * @param {boolean} module
	 */
	_createScript(src, module) {
		const result = this.doc.createElement('script');
		result.src = src;
		result.type = module ? 'module' : 'text/javascript';
		return result;
	}

	_insertAfter(newNode, referenceNode) {
		referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
	}
}