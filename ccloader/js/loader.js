export class Loader {
	/**
	 * 
	 * @param {import('./filemanager.js').Filemanager} filemanager 
	 */
	constructor(filemanager) {
		this.filemanager = filemanager;
		/** @type {Document} */
		this.doc = null;
		/** @type {HTMLElement} */
		this.postloadPoint = null;
		this.readyCalled = false;
		/** @type {HTMLBodyElement} */
		this.currentBody = undefined;
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
				postload: resolve,
			});
	
			const hook = this._createScript('window.parent.postload()');
			this._insertAfter(hook, this.postloadPoint);
			this._hookDOM(frame);
			this._startGame(frame);
		});
	}

	/**
	 * Returns a promise that resolves when the postload point is reached.
	 * @param {HTMLIFrameElement} frame 
	 */
	continue(frame) {
		this.currentBody = frame.contentDocument.lastChild.lastChild; //Actual body; bypasses document.body hook
		if (frame.contentWindow['ig']['_DOMReady']) {
			frame.contentWindow['ig']['_DOMReady']();
		}
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

	/**
	 * 
	 * @param {HTMLIFrameElement} frame 
	 */
	_hookDOM(frame) {
		this.currentBody = undefined;
		Object.defineProperty(frame.contentDocument, 'body', {
			get: () => {
				return this.currentBody;
			},
			set: (value) => {
				this.currentBody = value;
			}
		});
	}
}