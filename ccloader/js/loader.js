export class Loader {
	/**
	 * 
	 * @param {import('./filemanager.js').Filemanager} filemanager 
	 */
	constructor(filemanager) {
		this.filemanager = filemanager;
		this.doc = null; /** @type {Document} */
		this.postloadPoint = null; /** @type {HTMLElement} */
	}

	async initialize() {
		const code = await this._loadEntrypoint();
		this.doc = this._parseEntrypoint(code);
		this._insertBase();
		this.postloadPoint = this._findGame();
	}

	getBase() {
		const base = this.doc.createElement('base');
		base.href = this._getEntrypointPath();
		return base;
	}

	/**
	 * Returns a promise that resolves when the postload point is reached.
	 * @param {HTMLIFrameElement} frame 
	 * @returns {Promise<void>}
	 */
	startGame(frame) {
		return new Promise((resolve) => {
			Object.assign(window, {
				postload: () => resolve(),
			});
	
			const hook = this._createScript('window.parent.postload()');
			this._insertAfter(hook, this.postloadPoint);
			this._startGame(frame);
		});
	}

	/**
	 * 
	 * @param {HTMLIFrameElement} frame 
	 */
	_startGame(frame) {
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

	_insertBase() {
		this.doc.head.insertBefore(this.getBase(), this.doc.head.firstChild);
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
	 */
	_createScript(src) {
		const result = this.doc.createElement('script');
		result.src = 'data:text/javascript,' + src;
		result.type = 'text/javascript';
		return result;
	}

	/**
	 * 
	 * @param {HTMLElement} newNode 
	 * @param {HTMLElement} referenceNode 
	 */
	_insertAfter(newNode, referenceNode) {
		referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
	}
}