/// <reference path="../../../ccloader/js/types/plugin.d.ts" />

/**
 * @extends {ccloader.Plugin}
 */
export default class Test extends Plugin {
	preload() {
		return import('./preloadModule.js');
	}
}