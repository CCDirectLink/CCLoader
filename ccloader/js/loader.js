export class Loader {
	/**
	 * 
	 * @param {import('./filemanager.js').Filemanager} filemanager 
	 */
	constructor(filemanager) {
		this.filemanager = filemanager;
		this.doc = null; /** @type {Document} */
		this.base = null; /** @type {HTMLBaseElement} */
		this.game = null; /** @type {HTMLDivElement} */
	}

	async initialize() {
		const code = await this._loadEntrypoint();
		this.doc = this._parseEntrypoint(code);
		this.base = this._insertBase(this._getEntrypointPath());
		this.game = this._findGame();
	}

	/**
	 * Adds a mod script that runs before game scripts are loaded
	 * @param {string} script 
	 */
	addPreload(script) {
		this._insertAfter(this.base, this._createScript(script));
	}

	/**
	 * Adds a mod script that runs after game scripts are loaded
	 * @param {string} script
	 */
	addPostload(script) {
		this.game.insertBefore(this._createScript(script));
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