/// <reference path="../../../ccloader/js/types/plugin.d.ts" />

/**
 * @extends {ccloader.Plugin}
 */
export default class Test extends Plugin {
	postload() {
		return import('./postloadModule.js');
	}
}