const buttonSizes = {
	left: {
		size: {
			width: 9,
			height: 24
		},
		offset: {
			x: 0,
			y: 0
		}
	},
	center: {
		size: {
			width: 13,
			height: 24
		},
		offset: {
			x: 9,
			y: 0
		}
	},
	right: {
		size: {
			width: 9,
			height: 24
		},
		offset: {
			x: 22,
			y: 0
		}
	}
};
const buttons = {
	blue: {
		x: 0,
		y: 65
	},
	orange: {
		x: 32,
		y: 65
	},
	red: {
		x: 64,
		y: 65
	}
};

const SCALING = 2;
const BORDER_SIZE = 7;
const LOG_TYPE = {
	ERROR :  0b001,
	WARNING : 0b010,
	INFO : 0b100
};
export class UI {
	/**
     *
     * @param {import('./ccloader').ModLoader} modloader
     */
	constructor(modloader) {
		this.loaded = false;
		this.modloader = modloader;
		this.nextID = 1;

		/** @type {import('fs')} */
		this.fs = window.require && window.require('fs');

		this._clearLogFile();
		this._loadImage();
		this.applyBindings(window.console);
	}

	get container() {
		return document.getElementById('ui')
	}

	applyBindings(console) {
		const err = console.error;
		const warn = console.warn;
		const log = console.log;

		const logFlags = localStorage.getItem('logFlags') || 3;

		console.error = (...msg) => {
			this._logMessageToFile('error', ...msg);
			if (logFlags & LOG_TYPE.ERROR) {
				this.error.apply(this, msg);
			}
			err.apply(console, msg);
		};
		console.warn = (...msg) => {
			this._logMessageToFile('warn', ...msg);
			if (logFlags & LOG_TYPE.WARNING) {
				this.warn.apply(this, msg);
			}
			warn.apply(console, msg);
		};
		console.log = (...msg) => {
			this._logMessageToFile('log', ...msg);
			if (logFlags & LOG_TYPE.INFO) {
				this.log.apply(this, msg);
			}
			log.apply(console, msg);
		};
		console.logToFile = (...msg) => {
			this._logMessageToFile('file', ...msg);
		};

		this.attachErrorListeners(window);
	}

	attachErrorListeners(window) {
		window.addEventListener('error',  error => {
			this._logMessageToFile('unhandled exception', error.message, error.error);
		});
		
		window.addEventListener('unhandledrejection',  error => {
			this._logMessageToFile('unhandled rejection', error.reason.message, error.reason);
		});
	}

	/**
	 *
	 * @param  {...any} msg
	 */
	log(...msg) {
		this._drawMessage(msg.join(' '), buttons.blue, 2);
	}

	/**
	 *
	 * @param  {...any} msg
	 */
	warn(...msg) {
		this._drawMessage(msg.join(' '), buttons.orange, 5);
	}

	/**
	 *
	 * @param  {...any} msg
	 */
	error(...msg) {
		if (msg[0] instanceof Error) {
			msg[0] = msg[0].stack || msg[0];
		}

		this._drawMessage(msg.join(' '), buttons.red, 15);
	}

	/**
	 * 
	 * @param {string} level 
	 * @param  {...unknown} msg 
	 */
	_logMessageToFile(level, ...msg) {
		if (this.fs) {
			let result = new Date().toISOString() + ' ' + level + ': ' + msg.join(' ') + '\n';

			for (const part of msg) {
				if (part && part instanceof Error) {
					result += part.stack + '\n';
				}
			}

			this.fs.appendFile('log.txt', result, (err) => {
				//No error handling since that would cause an endless loop
				return;
			});
			this.fs.appendFile('biglog.txt', result, (err) => {
				//No error handling since that would cause an endless loop
				return;
			});
		}
	}

	/**
	 * 
	 */
	_clearLogFile() {
		if (this.fs) {
			//The log shouldn't get that big but just in case we check it and clear it if necessary.
			this.fs.stat('biglog.txt', (err, stats) => {
				if (err) {
					return null;
				}

				if (stats.size > 10490000) { //10 Mib
					this.fs.truncate('biglog.txt', 0, (err) => {
						return;
					})
				}
			});
			this.fs.truncate('log.txt', 0, (err) => {
				return;
			});
		}
	}

	/**
	 *
	 * @param {string} text
	 * @param {{x: number, y: number, left: string, center: string, right: string}} type
	 * @param {number} timeout Timeout in seconds
	 */
	_drawMessage(text, type, timeout) {
		const lines = text.split('\n');
		for (const line of lines) {
			this._drawButton(line, type, timeout);
		}
	}

	/**
	 *
	 * @param {string} text
	 * @param {{x: number, y: number, left: string, center: string, right: string}} type
	 * @param {number} timeout Timeout in seconds
	 */
	_drawButton(text, type, timeout) {
		if (!this.container) {
			return;
		}

		const id = 'uimsg_' + this.nextID++;
		
		const entry = document.createElement('div');
		entry.id = id;
		entry.style.display = 'flex';
		entry.style.height = buttonSizes.center.size.height * SCALING;
		entry.style.marginTop = '5px';

		if (this.loaded) {
			entry.style.fontSize = (buttonSizes.center.size.height - BORDER_SIZE) * SCALING / 2 + 'px';

			const left = document.createElement('div');
			left.style.backgroundImage = `url("${type.left}")`;
			left.style.imageRendering = 'pixelated';
			left.style.width = buttonSizes.left.size.width * SCALING;
			left.style.height = buttonSizes.left.size.height * SCALING;
			left.style.backgroundSize = `${buttonSizes.left.size.width * SCALING}px ${buttonSizes.left.size.height * SCALING}px`;
			entry.appendChild(left);

			const center = document.createElement('div');
			center.style.backgroundImage = `url("${type.center}")`;
			center.style.imageRendering = 'pixelated';
			center.style.height = buttonSizes.center.size.height * SCALING;
			center.style.backgroundSize = `${buttonSizes.center.size.width * SCALING}px ${buttonSizes.center.size.height * SCALING}px`;

			center.style.lineHeight = buttonSizes.center.size.height * SCALING + 'px';
			center.innerText = text;

			entry.appendChild(center);

			const right = document.createElement('div');
			right.style.backgroundImage = `url("${type.right}")`;
			right.style.imageRendering = 'pixelated';
			right.style.width = buttonSizes.right.size.width * SCALING;
			right.style.height = buttonSizes.right.size.height * SCALING;
			right.style.backgroundSize = `${buttonSizes.right.size.width * SCALING}px ${buttonSizes.right.size.height * SCALING}px`;
			entry.appendChild(right);

		} else {
			entry.style.lineHeight = buttonSizes.center.size.height * SCALING + 'px';
			entry.innerText = text;
		}

		this.container.appendChild(entry);

		setTimeout(() => this.container.removeChild(document.getElementById(id)), timeout * 1000);
	}

	_loadImage() {
		this.modloader.filemanager.loadImage('../assets/media/gui/buttons.png')
			.then(image => this._prepareImage(image))
			.catch(err => console.error(err));
	}

	/**
	 *
	 * @param {Image} img
	 */
	_prepareImage(img) {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		for (const buttonName in buttons) {
			const button = buttons[buttonName];
			for (const part in buttonSizes) {
				const data = buttonSizes[part];

				canvas.width = data.size.width;
				canvas.height = data.size.height;

				ctx.clearRect(0, 0, data.size.width, data.size.height);
				ctx.drawImage(img, button.x + data.offset.x, button.y + data.offset.y, data.size.width, data.size.height, 0, 0, data.size.width, data.size.height);

				button[part] = canvas.toDataURL();
			}
		}

		this.loaded = true;
	}
}
