/// <reference path="../../../ccloader/js/types/plugin.d.ts" />

import * as compat from './compat.js';

/**
 * @extends {ccloader.Plugin}
 */
export default class Simplify extends Plugin {
	constructor(mod) {
		super();

		/** @type {string} */
		this.baseDir = mod.baseDirectory;
	}

	preload() {
		this._applyArgs();
		this._hookStart();
	}
	
	postload() {
		this._applyArgs();
		return import('./postloadModule.js');
	}

	async main() {
		await compat.apply(this.baseDir);
	}

	_hookStart() {
		let original = window.startCrossCode;
		Object.defineProperty(window, 'startCrossCode', {
			get() {
				if (original) {
					return async(...args) => {
						for (const mod of window.activeMods) {
							try {
								await mod.loadPrestart();
							} catch (e) {
								console.error(`Could not run prestart of mod '${mod.name}': `, e);
							}
						}
						
						const event = document.createEvent('Event');
						event.initEvent('prestart', true, false);
						document.dispatchEvent(event);
	
						return original(...args);
					};
				}
				return undefined;
			},
			set(val) {
				original = val;
				return true;
			}
		});
	}

	_applyArgs() {
		const args = this._parseArgs();
		for (const [name, value] of args) {
			window[name] = value;
		}
	}
	
	/**
	 * 
	 * @returns {[string, string][]}
	 */
	_parseArgs() {
		if (window.require) {
			return require('nw.gui').App.argv.map(e => e.split('='));
		} else {
			return Array.from(new URL(window.parent.location.href).searchParams.entries())
		}
	}
}