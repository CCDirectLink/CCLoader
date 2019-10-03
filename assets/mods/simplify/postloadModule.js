import * as patchSteps from './lib/patch-steps-es6.js';
import CustomDebugState from './lib/custom-debug-state.js';
(() => {
	const igroot = window.IG_ROOT || '';
	
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
		 * @param {object|array} patchData
		 * @param {{mod: Mod, path: string}} patch
		 * @return {Promise<any>} result
		 */
		async _applyPatch(target, patchData, patch) {
			const debugState = new CustomDebugState();
			debugState.setPatch(patch);
			debugState.addFile([true, patch.path]);
			await patchSteps.patch(target, patchData, async (fromGame, url) => {
				if (fromGame) {
					// Import (game file)
					return await this.loadJSONPatched(igroot + url);
				} else {
					// Include (mod file)
					return await this.loadJSON(patch.mod.baseDirectory + url);
				}
			}, debugState);
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
		 * @param {(xhr: any, url: string) => void} handler 
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
		 * Loads a file and patches it as necessary.
		 *
		 * @param {string} path
		 * @returns {Promise<string>}
		 */
		async loadFilePatched(path) {
			// Detect if this would be patched, which implies it's a JSON file.
			const patches = this._getRelevantPatchDetails(path);
			if (patches.length > 0) {
				// It would. loadJSONPatched - with original path for equivalent functionality.
				return JSON.stringify(await this.loadJSONPatched(path));
			}
			return await this.loadFile(this._applyAssetOverrides(path));
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
					error: (xhr) => {
						reject(`Error ${xhr.status}: Could not load "${path}"`);
					}
				});
			});
		}

		/**
		 * Given an igroot-prefixed string, returns the path with asset replacements applied.
		 * This only changes the path, not the contents at it, so it doesn't apply JSON patches.
		 *
		 * @param {string} oldpath
		 * @returns {string} newpath
		 */
		_applyAssetOverrides(path) {
			if (!path.startsWith(igroot))
				return;
			const fullreplace = this._getAllAssets(path.substr(igroot.length));
	
			if(fullreplace && fullreplace.length > 0){
				if(fullreplace.length > 1)
					console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');
	
				//console.log("Replacing '" + settings.url + "' with '" + fullreplace[0]  + "'");
	
				if (fullreplace[0].indexOf('assets') === 0) {
					return igroot + fullreplace[0].substr(7);
				} else {
					return igroot + fullreplace[0];
				}
			}
			return path;
		}

		/**
		 * Given an igroot-prefixed string, returns an array of the relevant patch files.
		 *
		 * @param {string} oldpath
		 * @returns {Array<{mod: Mod, path: string}>} patches
		 */
		_getRelevantPatchDetails(path) {
			return this._getAllAssetDetails(path.substr(igroot.length) + '.patch');
		}
	
		async _hookAjax() {
			$.ajaxSetup({
				beforeSend: async (_, settings) => {
					if (settings.url.constructor !== String) {
						return console.log(settings);
					}

					// Apply asset overrides.
					const originalUrl = settings.url;
					settings.url = this._applyAssetOverrides(settings.url);
					
					// Run request pre handlers
					this._callHandlers(settings, true);

					let successArgs;
					try {
						successArgs = await this._handleAjaxPatching(originalUrl, this._waitForAjax(settings));
					} catch (e) {
						settings.error.apply(settings.context, e);
						return;
					}

					// Done, run final handlers
					this._callHandlers(settings, false);

					settings.success.apply(settings.context, successArgs);
				}
			});
		}

		/**
		 * 
		 * @param {object} settings 
		 * @param {boolean} beforeCall 
		 */
		_callHandlers(settings, beforeCall) {
			/** @type {string} */
			const url = settings.url.substr(igroot.length);
			for (const entry of this.handlers) {
				if(entry.beforeCall == beforeCall && (!entry.filter || url.match(entry.filter))) {
					entry.handler(settings, url);
				}
			}
		}
	
		/**
		 * 
		 * @param {object} settings 
		 * @returns {Promise<any[]>}
		 */
		_waitForAjax(settings) {
			const success = settings.success;
			const error = settings.error;

			return new Promise((resolve, reject) => {
				settings.success = (...sArgs) => {
					this._restoreSettings(settings, success, error);
					resolve(sArgs);
				};
				settings.error = (...err) => {
					this._restoreSettings(settings, success, error);
					reject(err);
				};
			});
		}

		/**
		 * 
		 * @param {object} settings 
		 * @param {Function} success 
		 * @param {Function} error 
		 */
		_restoreSettings(settings, success, error) {
			settings.success = success;
			settings.error = error;
		}

		/*
		 * Given a promise for when an AJAX request finishes, setup patching.
		 * Returns a promise for the value given by the AJAX request.
		 *
		 * @param {object} settings
		 * @returns {Promise<any>}
		 */
		async _handleAjaxPatching(url, promise){

			// To simplify the timeline, assume patching is always going on.
			// If any patches are actually *present*, the file must be JSON.
			const patches = this._getRelevantPatchDetails(url);

			// It is assumed that a patch's index in here is the patch's normal index + 1.
			// The same applies to the resulting value table later.
			const promises = [];

			// Load all resources needed
			promises.push(promise);
			for (const patch of patches)
				promises.push(this.loadJSON(patch.path));

			// Done making the parallel requests
			const values = await this._awaitAll(promises);
			if (values[0].status !== 'resolved') {
				throw values[0].value;
			}

			const successArgs = values[0].value;
			for (let i = 0; i < patches.length; i++) {
				if (values[i + 1].status !== 'resolved') {
					console.error(`Could not load patch '${patches[i].path}' for '${url}': `, values[i + 1].value);
					continue;
				}

				await this._applyPatch(successArgs[0], values[i + 1].value, patches[i]);
			}
			return successArgs;
		}

		/**
		 * Awaits all Promises given but does not fail on rejects.
		 * @param {Promise<any>[]} promises
		 * @returns {Promise<{status: 'resolved' | 'rejected', value: any}[]>}
		 */
		_awaitAll(promises) {
			return Promise.all(promises.map(p => p
				.then(value => ({status: 'resolved', value: value}))
				.catch(err => ({status: 'rejected', value: err}))
			));
		}
	
		_hookHttpRequest() {
			const instance = this;
			const original = XMLHttpRequest.prototype.open;
			XMLHttpRequest.prototype.open = function(_, url) {
				arguments[1] = instance._applyAssetOverrides(url) || url;
				return original.apply(this, arguments);
			};
		}

		_hookImages() {
			const instance = this;
			const original = window.Image;
			window.Image = class Image extends original {
				set src(url) {
					const fullreplace = instance._getAllAssets(url.substr(igroot.length));
			
					if(fullreplace && fullreplace.length > 0){
						if(fullreplace.length > 1) {
							console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');
						}
			
						//console.log('Replacing \'' + url + '\' with \'' + fullreplace[0]  + '\'');
			
						if (fullreplace[0].indexOf('assets') === 0) {
							url = igroot + fullreplace[0].substr(7);
						} else {
							url = igroot + fullreplace[0];
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
		 * @returns {Array<{mod: Mod, path: string}>} 
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
