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
		this._insertOverlay();
		this.postloadPoint = this._findGame();
	}

	getBase() {
		const base = this.doc.createElement('base');
		base.href = this._getEntrypointPath();
		return base;
	}

	/**
	 * Returns a promise that resolves when the postload point is reached.
	 * @returns {Promise<void>}
	 */
	startGame() {
		return new Promise((resolve) => {
			Object.assign(window, {
				postload: resolve,
			});

			const hook = this._createScript('window.parent.postload()');
			this._insertAfter(hook, this.postloadPoint);
			this._hookDOM();
			this._startGame();
		});
	}

	/**
	 * Returns a promise that resolves when the postload point is reached.
	 */
	continue() {
		this.currentBody = document.lastChild.lastChild; //Actual body; bypasses document.body hook
		if (window['ig']['_DOMReady']) {
			window['ig']['_DOMReady']();
		}
	}

	/**
	 * Turns the status overlay invisible.
	 */
	removeOverlay() {
		const overlay = document.getElementById('overlay');
		const status = document.getElementById('status');

		status.style.visibility = 'hidden';
		overlay.style.visibility = 'hidden';
	}

	/**
	 * Displays the given status in the overlay.
	 * @param {string} text 
	 */
	setStatus(text) {
		const status = document.getElementById('status');
		const virtStatus = this.doc.getElementById('status');

		status.innerText = text;
		virtStatus.innerText = text;
	}

	_startGame() {
		this._copyUI();

		document.open();
		document.write(this.doc.documentElement.outerHTML);
		document.close();
	}

	_copyUI() {
		const target = this.doc.getElementById('ui');
		const source = document.getElementById('ui');
		target.innerHTML = source.innerHTML;
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

	_insertOverlay() {
		/*
		<link rel="stylesheet" href="index.css">

		<div id="overlay"></div>
		<h1 id="status" class="title">Initializing CCLoader</h1>
		<div id="ui" class="ui"></div>
		**/

		const style = this.doc.createElement('link');
		style.rel = 'stylesheet';
		style.href = '../ccloader/index.css';
		this.doc.head.appendChild(style);

		const overlayDiv = this.doc.createElement('div');
		overlayDiv.id = 'overlay';
		this.doc.body.appendChild(overlayDiv);
		this.overlay = overlayDiv;

		const status = this.doc.createElement('h1');
		status.id = 'status';
		status.className = 'title';
		status.innerText = 'Initializing CCLoader';
		this.doc.body.appendChild(status);
		this.status = status;

		const uiDiv = this.doc.createElement('div');
		uiDiv.id = 'ui';
		uiDiv.className = 'ui';
		this.doc.body.appendChild(uiDiv);
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
	 */
	_hookDOM() {
		this.currentBody = undefined;
		Object.defineProperty(document, 'body', {
			get: () => {
				return this.currentBody;
			},
			set: (value) => {
				this.currentBody = value;
			}
		});
	}
}
