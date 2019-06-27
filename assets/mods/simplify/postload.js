import * as patchSteps from './lib/patch-steps-es6.js';

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
		async generatePatches(mod){
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
				const patch = await this.generatePatch(original, asset);
				console.log('File: ' + asset + '.patch');
				console.log(JSON.stringify(patch));
			}
		}
	
		/**
		 * Generates patches for a pair of given objects or files.
		 * @param {object} target
		 * @param {object|array} patch
		 * @param {string} modbase
		 * @return {Promise<any>} result
		 */
		async _applyPatch(target, patch, modbase) {
			await patchSteps.patch(target, patch, async (imp, impurl) => {
				if (imp) {
					// Import (game file)
					return await this.loadJSONPatched(ig.root + impurl);
				} else {
					// Include (mod file)
					return await this.loadJSON(modbase + impurl);
				}
			});
		}
	
		/**
		 * Generates patches for a pair of given objects or files.
		 * @param {string|object} original 
		 * @param {string|object} modified 
		 * @return {Promise<array>} result
		 */
		async generatePatch(original, modified) {
			if(original.constructor === String)
				original = await this.loadJSON(original);

			if(modified.constructor === String)
				modified = await this.loadJSON(modified);

			return patchSteps.diff(original, modified);
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
		 * Given an ig.root-prefixed string, returns the path with asset replacements applied.
		 * This only changes the path, not the contents at it, so it doesn't apply JSON patches.
		 *
		 * @param {string} oldpath
		 * @returns {string} newpath
		 */
		_applyAssetOverrides(path) {
			if (!path.startsWith(ig.root))
				return;
			const fullreplace = this._getAllAssets(path.substr(ig.root.length));
	
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
			return path;
		}

		/**
		 * Given an ig.root-prefixed string, returns an array of the relevant patch files.
		 *
		 * @param {string} oldpath
		 * @returns {object[]} patches
		 */
		_getRelevantPatchDetails(path) {
			return this._getAllAssetDetails(path.substr(ig.root.length) + '.patch');
		}

		/**
		 * Loads a file and patches it as necessary.
		 *
		 * @param {string} path
		 * @returns {Promise<string>}
		 */
		async loadFilePatched(path) {
			const newPath = this._applyAssetOverrides(path);
			// Detect if this would be patched, which implies it's a JSON file.
			const patches = this._getRelevantPatchDetails(newPath);
			if (patches.length > 0) {
				// It would. loadJSONPatched - with original path for equivalent functionality.
				return JSON.stringify(await this.loadJSONPatched(path));
			}
			return await this.loadFile(newPath);
		}
	
		/**
		 * Parses a JSON file, potentially patching it.
		 * 
		 * @param {string} path 
		 * @returns {Promise<any>}
		 */
		loadJSONPatched(path) {
			// To avoid reimplementing the code that was already implemented.
			return new Promise((resolve, reject) => {
				$.ajax({
					dataType: 'json',
					url: path,
					success: (val) => {
						resolve(val);
					},
					error: reject
				});
			});
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
			// Apply asset overrides.
			settings.url = this._applyAssetOverrides(settings.url);

			// To simplify the timeline, assume patching is always going on.
			// If any patches are actually *present*, the file must be JSON.
			const patches = this._getRelevantPatchDetails(settings.url);

			const success = settings.success;
			// It is assumed that a patch's index in here is the patch's normal index + 1.
			// The same applies to the resulting value table later.
			const promises = [];

			promises.push(new Promise((resolve) => { // _reject omitted, see below.
				settings.success = (...sArgs) => resolve(sArgs);
				// Failure is handled by just using the AJAX failure, which will basically cause this whole thing to be forgotten. That's okay.
			}));

			for (const patch of patches)
				promises.push(this.loadJSON(patch.path));

			// Done making the parallel requests (unless patch application requires more requests), turn it into one big promise
			Promise.all(promises).then((values) => {
				const successArgs = values[0];
				(async () => {
					for (let i = 0; i < patches.length; i++)
						await this._applyPatch(successArgs[0], values[i + 1], patches[i].mod.baseDirectory);
				})().catch((err) => {
					console.error(err);
				}).finally(() => {
					// Done, run final handlers
					for (const entry of this.handlers) {
						if(!entry.beforeCall && (!entry.filter || settings.url.substr(ig.root.length).match(entry.filter))) {
							entry.handler(successArgs[0], settings.url.substr(ig.root.length));
						}
					}
					success.apply(settings.context, successArgs);
				});
			});

			// Now everything's setup, run request handlers
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

		/**
		 * 
		 * @param {string} path 
		 */
		_stripAssets(path){
			return path.indexOf('assets/') == 0 ? path.substr(7) : path;
		}
		
		/**
		 * Gets all assets with the given path.
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
		
		/**
		 * Gets all assets with the given path. Extended version.
		 * Notes on the new return value layout:
		 * mod: Mod
		 * path: string
		 * data: Reserved for use by recipients, must not be present (must be undefined)
		 * 
		 * @param {string} name
		 * @returns {object[]} 
		 */
		_getAllAssetDetails(name){
			const result = [];

			for (const mod of window.activeMods) {
				const asset = mod.getAsset(name);
				if(asset) {
					result.push({
						mod: mod,
						path: asset
					});
				}
			}

			return result;
		}
	}

	window.simplifyResources = new SimplifyResources();
})();
