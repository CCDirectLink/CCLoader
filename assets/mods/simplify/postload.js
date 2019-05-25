(() => {
	const event = document.createEvent('Event');
	event.initEvent('postload', true, false);
	document.dispatchEvent(event);
	
	/** @type {typeof import("fs")} */
	const fs = (!window.fs && window.require) ? require('fs') : window.fs;
	
	class SimplifyResources {
		constructor() {
			/** @type {{handler: (xhr: any, url: string) => void), filter?: string, beforeCall?: boolean}[]} */
			this.handlers = [];
			
			this._hookAjax();
			this._hookHttpRequest();
			this._hookImages();
		}
	
		/**
		 * Generates patches for specified mod and prints them into the console
		 * @param {string|Mod} mod 
		 */
		generatePatches(mod){
			if (mod.constructor === String){
				return this.generatePatches(window.simplify.getMod(mod));
			}
	
			const baseDir = mod.baseDirectory.substr(7);
			const assets = window.simplify.getAssets(mod);
			for (const asset of assets) {
				if(asset.endsWith('.patch')) {
					continue;
				}
	
				const original = asset.substr(baseDir.length + 7);
				this.generatePatch(original, asset, 'File: ' + asset + '.patch');
			}
		}
	
		/**
		 * Generates patches for given objects or files and prints them into the console
		 * @param {string|object} original 
		 * @param {string|object} modified 
		 * @param {string=} message 
		 */
		generatePatch(original, modified, message){
			if(original.constructor === String)
				return $.ajax({url: original, success: o => this.generatePatch(o, modified, message), context: this, dataType: 'json', bypassHook: true});
	
			if(modified.constructor === String)
				return $.ajax({url: modified, success: m => this.generatePatch(original, m, message), context: this, dataType: 'json', bypassHook: true});
	
			if(message) {
				console.log(message);
			}
			console.log(JSON.stringify(this._generatePatch(original, modified)));
		}
	
		/**
		 * 
		 * @param {(xhr: any, url: string) => void)} handler 
		 * @param {string=} filter 
		 * @param {boolean=} beforeCall 
		 */
		registerHandler(handler, filter, beforeCall){
			this.handlers.push({handler, filter, beforeCall});
		}
	
		/**
		 * 
		 * @param {string} path 
		 * @param {(string) => void} [callback] deprecated, use returned promise instead
		 * @param {(string) => void} [errorCb] deprecated, use returned promise instead
		 * @returns {Promise<string>}
		 */
		loadFile(path, callback, errorCb) {
			const result = new Promise((resolve, reject) => {
				path = this._stripAssets(path);
		
				if(window.require) {
					fs.readFile('assets/' + path, 'utf8', (err, data) => {
						if (err) {
							return reject(err);
						}
						
						resolve(data);
					});
				} else {
					const req = new XMLHttpRequest();
					req.open('GET', path, true);
					req.onreadystatechange = function(){
						if(req.readyState === 4 && req.status >= 200 && req.status < 300) {
							resolve(req.responseText);
						}
					};
					req.onerror = err => reject(err);
					req.send();
				}
			});
	
			if (callback || errorCb) {
				result
					.then(callback)
					.catch(errorCb);
			}
	
			return result;
		}
	
		/**
		 * 
		 * @param {string} path 
		 * @param {(any) => void} [callback] deprecated, use returned promise instead
		 * @param {(any) => void} [errorCb] deprecated, use returned promise instead
		 * @returns {Promise<any>}
		 */
		loadJSON(path, callback, errorCb) {
			const result = new Promise((resolve, reject) => {
				this.loadFile(path)
					.then(data => resolve(JSON.parse(data)))
					.catch(err => reject(err));
			});
	
			
			if (callback || errorCb) {
				result
					.then(callback)
					.catch(errorCb);
			}
	
			return result;
		}
	
		/**
		 * 
		 * @param {string} path 
		 * @returns {Promise<string>}
		 */
		loadFilePatched(path) {
			return new Promise((resolve, reject) => {
				path = this._stripAssets(path);
				const req = new XMLHttpRequest();
				req.open('GET', path, true);
				req.onreadystatechange = function(){
					if(req.readyState === 4 && req.status >= 200 && req.status < 300) {
						resolve(req.responseText);
					}
				};
				req.onerror = err => reject(err);
				req.send();
			});
		}
	
		/**
		 * 
		 * @param {string} path 
		 * @returns {Promise<any>}
		 */
		async loadJSONPatched(path) {
			return JSON.parse(await this.loadFilePatched(path));
		}
		
		_generatePatch(original, modified) {
			const result = {};
	
			for (const key in modified) {
				if (modified[key] == undefined && original[key] == undefined) {
					continue;
				}
	
				if (modified[key] == undefined && original.hasOwnProperty(key)) {
					result[key] = null;
				} else if (!original.hasOwnProperty(key) || original[key] === undefined || original[key].constructor !== modified[key].constructor) {
					result[key] = modified[key];
				} else if (original[key] !== modified[key]) {
					if (modified[key].constructor === Object || modified[key].constructor === Array) {
						const res = this._generatePatch(original[key], modified[key]);
						if(res !== undefined) {
							result[key] = res;
						}
					} else {
						result[key] = modified[key];
					}
				}
			}
	
			for (const key in original) {
				if(modified[key] === undefined) {
					result[key] = null;
				}
			}
	
			for (const key in result) {
				if(result[key] && result[key].constructor === Function){
					result[key] = undefined;
					delete result[key];
				}
			}
	
			if (Object.keys(result).length == 0) {
				return undefined;
			} else {
				return result;
			}
		}
	
		_hookAjax() {
			$.ajaxSetup({
				beforeSend: (xhr, settings) => {
					if (settings.url.constructor !== String) {
						return console.log(settings);
					}
		
					const result = this._handleAjax(settings);
					if (result) {
						settings = result;
					}
				}
			});
		}
	
		_handleAjax(settings){
			const fullreplace = this._getAllAssets(settings.url.substr(ig.root.length));
	
			if(fullreplace && fullreplace.length > 0){
				if(fullreplace.length > 1)
					console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');
	
				//console.log("Replacing '" + settings.url + "' with '" + fullreplace[0]  + "'");
	
				if (fullreplace[0].indexOf('assets') === 0) {
					settings.url = ig.root + fullreplace[0].substr(7);
				} else {
					settings.url = ig.root + fullreplace[0];
				}
			}
	
			const patches = this._getAllAssets(settings.url.substr(ig.root.length) + '.patch');
			if(patches && patches.length > 0){
				const patchData = [];
				const success = settings.success;
				let successArgs;
				let resourceLoaded = false;
	
				for (const patch of patches) {
					this.loadJSON(patch)
						.then(data => {
							patchData.push(data);
							if(patchData.length === patches.length && resourceLoaded){
								this._applyPatches(successArgs[0], patchData);
								success.apply(settings.context, successArgs);
							}
						})
						.catch(err => {
							console.error(err);
							patchData.push({});
						});
				}
	
				settings.success = () => {
					successArgs = arguments;
					resourceLoaded = true;
					if (patchData.length === patches.length) {
						this._applyPatches(successArgs[0], patchData);
	
						for (const entry of this.handlers) {
							if(!entry.beforeCall && (!entry.filter || settings.url.substr(ig.root.length).match(entry.filter))) {
								entry.handler(successArgs[0], settings.url.substr(ig.root.length));
							}
						}
	
						success.apply(settings.context, successArgs);
					}
				};
			}
	
			for (const entry of this.handlers) {
				if(entry.beforeCall && (!entry.filter || settings.url.substr(ig.root.length).match(entry.filter))) {
					entry.handler(settings, settings.url.substr(ig.root.length));
				}
			}
		}
	
		_hookHttpRequest() {
			const instance = this;
			const original = XMLHttpRequest.prototype.open;
			XMLHttpRequest.prototype.open = function(_, url) {
				arguments[1] = instance._handleHttpRequest(url) || url;
				return original.apply(this, arguments);
			};
		}
	
		/**
		 * 
		 * @param {string} url
		 */
		_handleHttpRequest(url) {
			const fullreplace = this._getAllAssets(url.substr(ig.root.length));
	
			if(fullreplace && fullreplace.length > 0){
				if(fullreplace.length > 1)
					console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');
	
				//console.log("Replacing '" + settings.url + "' with '" + fullreplace[0]  + "'");
	
				if (fullreplace[0].indexOf('assets') === 0) {
					return ig.root + fullreplace[0].substr(7);
				} else {
					return ig.root + fullreplace[0];
				}
			}
		}

		_hookImages() {
			const instance = this;
			const original = window.Image;
			window.Image = class Image extends original {
				set src(url) {
					const fullreplace = instance._getAllAssets(url.substr(ig.root.length));
			
					if(fullreplace && fullreplace.length > 0){
						if(fullreplace.length > 1) {
							console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');
						}
			
						//console.log('Replacing \'' + url + '\' with \'' + fullreplace[0]  + '\'');
			
						if (fullreplace[0].indexOf('assets') === 0) {
							url = ig.root + fullreplace[0].substr(7);
						} else {
							url = ig.root + fullreplace[0];
						}
					}

					super.src = url;
				}
			};
		}
		
		_applyPatches(data, patches){
			for (const patch of patches) {
				this._applyPatch(data, patch);
			}
		}
	
		_applyPatch(obj, patch){
			for (const key in patch){
				if(obj[key] === undefined)
					obj[key] = patch[key];
				else if(patch[key] === undefined)
					obj[key] = undefined;
				else if(patch[key].constructor === Object)
					this._applyPatch(obj[key], patch[key]);
				else
					obj[key] = patch[key];
			}
		}
	
		/**
		 * 
		 * @param {string} path 
		 */
		_stripAssets(path){
			return path.indexOf('assets/') == 0 ? path.substr(7) : path;
		}
		
		/**
		 * 
		 * @param {string} name
		 * @returns {string[]} 
		 */
		_getAllAssets(name){
			const result = [];

			for (const mod of window.activeMods) {
				const asset = mod.getAsset(name);
				if(asset) {
					result.push(asset);
				}
			}

			return result;
		}
	}

	window.simplifyResources = new SimplifyResources();
})();