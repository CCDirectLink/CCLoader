/// <reference path="../../../ccloader/js/types/plugin.d.ts" />

/**
 * @extends {ccloader.Plugin}
 */
export default class Test extends Plugin {
	preload() {
		this._hookStart();
	}
	
	postload() {
		return import('./postloadModule.js');
	}

	_hookStart() {
		let original = window.startCrossCode;
		Object.defineProperty(window, 'startCrossCode', {
			get() {
				if (original) {
					return async(...args) => {
						for (const mod of window.activeMods) {
							await mod.loadPrestart();
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
}