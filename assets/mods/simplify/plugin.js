/// <reference path="../../../ccloader/js/types/plugin.d.ts" />

/**
 * @extends {ccloader.Plugin}
 */
export default class Test extends Plugin {
	async preload() {
		await this._loadJQuery();
		return import('./preloadModule.js');
	}
	

	async _loadJQuery() {
		await this._loadScript('impact/page/js/jquery-1.11.1.min.js');
		await this._loadScript('impact/page/js/jquery-ui-1.10.2.custom.min.js');
	}

	/**
	 * 
	 * @param {string} url 
	 * @param {string} type 
	 * @returns {Promise<void>}
	 */
	_loadScript(url, type){
		if (!type) {
			type = 'text/javascript';
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.onload = () => resolve();
			script.onerror = () => reject();
			script.type = type;
			script.src = url;
			document.body.appendChild(script);
		});
	}
	
}