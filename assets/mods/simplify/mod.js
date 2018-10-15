if(!window.cc) {
	throw 'No Modloader Found!';
}

/** @type {typeof import("fs")} */
const fs = (!window.fs && window.require) ? require('fs') : window.fs;

const ICON_MAPPING = {
	'mods': [0,0]
};

class Simplify {
	constructor() {
		window.simplify = this;

		this._normalize();

		/** @type {(() => void)[]} */
		this.updateHandlers = [];

		this._initializeGameMain();
		this._initializeCombat();
		this._initializeGUI();
		this._initializeEvents();

		this.font = new SimplifyFont();
		this.options = new SimplifyOptions();
		this.resources = new SimplifyResources();

		this._hookUpdate();
		
		document.body.addEventListener('modsLoaded', () => this._postInitialize());
	}
	
	
	registerUpdate(handler) {
		if (handler && typeof handler === 'function') {
			this.updateHandlers.push(handler);
		}
	}
	fireUpdate() {
		for (const handler of this.updateHandlers) {
			handler();
		}
	}
	
	/**
	 * 
	 * @param {string} url 
	 * @param {() => void} [callback] deprecated, use returned promise instead
	 * @param {() => void} [errorCb] deprecated, use returned promise instead
	 * @returns {Promise<void>}
	 */
	loadScript(url, callback, errorCb){
		const result = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			document.body.appendChild(script);
			script.onload = () => resolve();
			script.onerror = err => reject(err);
			script.type = 'text/javascript';
			script.src = url;
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
	 * @param {string|Mod} mod
	 * @returns {string} 
	 */
	getModName(mod) {
		if (mod.constructor === String) {
			return mod;
		}
		return mod.name;
	}
	/**
	 * 
	 * @returns {string[]}
	 */
	getActiveMods() {
		const mods = [];
		for(const mod of window.activeMods){
			mods.push(mod.name);
		}
		return mods;
	}
	/**
	 * 
	 * @returns {string[]}
	 */
	getInactiveMods(){
		const mods = [];
		for (const mod of window.inactiveMods){
			mods.push(mod.name);
		}
		return mods;
	}
	/**
	 * 
	 * @returns {string[]}
	 */
	getAllMods() {
		const active = this.getActiveMods();
		const inactive = this.getInactiveMods();
		return active.concat(inactive).sort();
	}
	/**
	 * 
	 * @param {string} name 
	 * @returns {Mod}
	 */
	getMod(name) {
		for (const mod of window.activeMods) {
			if(mod.name == name) {
				return mod;
			}
		}
	}
	/**
	 * 
	 * @param {string|Mod} mod 
	 * @returns {string[]}
	 */
	getAssets(mod) {
		if(!mod) {
			return;
		}

		if(mod.constructor === String){
			return this.getAssets(this.getMod(mod));
		}

		return mod.assets;
	}
	/**
	 * 
	 * @param {string|Mod} mod 
	 * @param {string} name 
	 * @returns {string}
	 */
	getAsset(mod, name) {
		if(!mod) {
			return;
		}

		if(mod.constructor === String){
			return this.getAsset(this.getMod(mod), name);
		}

		return mod.getAsset(name);
	}
	/**
	 * 
	 * @param {string} name
	 * @returns {string[]} 
	 */
	getAllAssets(name){
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
	 * 
	 * @param {Entity} entity
	 * @returns {string} 
	 */
	getAnimation(entity) {
		return entity[entries.currentAnimation];
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {string} value 
	 */
	setAnimation(entity, value) {
		entity[entries.currentAnimation] = value;
	}
	runAction(cAction) {
		return cAction[entries.run].apply(cAction, Array.prototype.slice.call(arguments, 1));
	}
	getEntityProxies(entity) {
		return entity[entries.proxies];
	}
	killEntity(entity, arg){
		return entity[entries.entityKill](arg);
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {Entity} target 
	 * @param {boolean=} fixed 
	 */
	setEntityTarget(entity, target, fixed) {
		entity[entries.setTarget](target, fixed);
	}
	getProxyAction(action){
		return action[entries.proxyActions];
	}
	getNextProxyAction(action){
		if(this.nextActionVarName === undefined) {
			this._findNextAction(action);
		}
		
		if(this.nextActionVarName !== undefined) {
			return action[this.nextActionVarName];
		}
		return undefined;
	}

	/**
	 * @returns {string}
	 */
	getActiveMapName() {
		return cc.ig.gameMain[entries.mapName];
	}
	
	getInnerGui(gui) {
		return gui[entries.innerGUI];
	}
	
	jumpHigh(){
		cc.ig.playerInstance()[entries.jump](185, 16, 100);
	}
	
	getParams(entity) {
		return entity[entries.param];
	}
	getParamsStat(entity, stat) {
		const params = this.getParams(entity);
		if(!params) {
			return;
		}
		return params[entries.paramGetStat](stat);
	}
	getBaseParams(entity) {
		const params = this.getParams(entity);
		if(!params) {
			return;
		}
		return params[entries.baseParams];
	}
	/**
	 * @returns {number}
	 */
	getBaseParam(entity, param) {
		return this.getBaseParams(entity)[param];
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {number} baseParams 
	 */
	setBaseParams(entity, baseParams) {
		const params = this.getParams(entity);
		if (!params) {
			return;
		}
		const thisBaseParams = this.getBaseParams(entity);
		const hpDiff = this.getParamsStat(entity, 'hp') - this.getCurrentHp(entity);

		for (const i in thisBaseParams) {
			thisBaseParams[i] = baseParams[i] || thisBaseParams[i];
		}
			
		this.setCurrentHp(entity, this.getParamsStat(entity, 'hp') - hpDiff);
			
		cc.sc.Model.notifyObserver(params, 3); // sc.COMBAT_PARAM_MSG.STATS_CHANGED
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {string} key 
	 * @param {string|number} value 
	 */
	setBaseParam(entity, key, value) {
		const params = this.getParams(entity);
		if(!params) {
			return;
		}
		const thisBaseParams = this.getBaseParams(entity);

		if(key === 'hp') {
			this.setCurrentHp(entity, this.getCurrentHp(entity) - thisBaseParams[key] + value);
		}

		thisBaseParams[key] = value || thisBaseParams[key];
			
		cc.sc.Model.notifyObserver(params, 3); // sc.COMBAT_PARAM_MSG.STATS_CHANGED
	}
	/**
	 * @returns {number}
	 */
	getCurrentHp(entity) {
		const params = this.getParams(entity);
		if(!params) {
			return;
		}
		return params[entries.paramCurrentHp];
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {number} hp 
	 */
	setCurrentHp(entity, hp) {
		const params = this.getParams(entity);
		if(!params) {
			return;
		}
		params[entries.paramCurrentHp] = hp;
		cc.sc.Model.notifyObserver(params, 1); //sc.COMBAT_PARAM_MSG.HP_CHANGED
	}

	/**
	 * @returns {number}
	 */
	getAnimationTimer(entity) {
		return entity[entries.animation][entries.timer];
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {number} value 
	 */
	setAnimationTimer(entity, value) {
		entity[entries.animation][entries.timer] = value;
	}
	/**
	 * 
	 * @param {Enity} entity
	 * @returns {string} 
	 */
	getCurrentState(entity) {
		return entity[entries.currentState];
	}
	/**
	 * 
	 * @param {Entity} entity 
	 * @param {string} state 
	 */
	setCurrentState(entity, state) {
		new cc.ig.events.SET_ENEMY_STATE({enemy: entity, enemyState: state}).start();
	}
	/**
	 * @returns {boolean}
	 */
	isPlayerInCombat(){
		if (!cc.sc.playerModelInstance || !cc.sc.playerModelInstance[entries.isInCombat]) {
			return false;
		}

		return cc.sc.playerModelInstance[entries.isInCombat]();
	}
	/**
	 * 
	 * @param {boolean} active 
	 */
	setForceCombat(active) {
		new cc.ig.events.SET_FORCE_COMBAT({value: active}).start();
	}

	_initializeGameMain() {
		cc.ig.gameMain.spawnEntity = cc.ig.gameMain[entries.gameMainSpawnEntity];
		cc.ig.gameMain.getEntityPosition = entity => {
			if(!entity || !entity[entries.entityData])
				return {x: -1, y: -1, z: -1};
			return entity[entries.entityData][entries.entityPosition];
		};
		cc.ig.gameMain.setEntityPosition = function(entity, pos){
			if(entity && entity[entries.entityData])
				entity[entries.entityData][entries.entityPosition] = pos;
		};
		cc.ig.gameMain.teleport = cc.ig.gameMain[entries.gameMainTeleport];
		cc.ig.gameMain.loadMap = function(data){ cc.ig.gameMain[entries.gameMainLoadMap].call(data.context, data); };
		
		cc.ig.TeleportPosition = ig[entries.TeleportPosition];
		cc.ig.TeleportPosition.createFromJson = cc.ig.TeleportPosition[entries.TeleportPositionFromJson];
	}
	_initializeCombat() {
		for (const key in sc) {
			if(sc[key] instanceof cc.sc.Combat) {
				cc.sc.combat = sc[key];
				break;
			}
		}
	}
	_initializeGUI() {
		for (const obj in cc.ig.GUI) {
			if (cc.ig.GUI[obj] && cc.ig.GUI[obj].length === 21) {
				cc.ig.GUI.menues = cc.ig.GUI[obj];
				return;
			}
		}
	}
	_initializeEvents(){
		document.createEvent('Event').initEvent('returnToMenu', true, true);
		document.createEvent('Event').initEvent('mapUnloaded', true, true);
	}
	_postInitialize(){
		this._initializeFont();
		this._initializeOptions();
		
		document.body.dispatchEvent(new Event('simplifyInitialized'));
	}
	_initializeFont() {
		const icons = new cc.ig.Font('mods/simplify/media/icons.png', 16, 2000);
		const page = window.simplify.font.pushIconSet(icons);
		
		this.font.prepareMapping(ICON_MAPPING, page);
		this.font.setMapping(ICON_MAPPING);
	}
	_initializeOptions(){
		const mods = window.inactiveMods.concat(window.activeMods);
		
		const tab = this.options.addTab('mods', 'Mods');
		for (const mod of mods){
			this.options.addEntry('modEnabled-' + mod.name.toLowerCase(), 'CHECKBOX', true, tab, undefined, true);

			const name = mod.name;
			const description = mod.description || 'If checked this mod is enabled. \\c[1]Needs a restart!';

			ig.lang.labels.sc.gui.options['modEnabled-' + mod.name.toLowerCase()] = {name, description};
		}

		this.options.reload();
	}

	/**
	 * Extends native prototypes with standard functions
	 */
	_normalize() {
		if(!String.prototype.endsWith){
			String.prototype.endsWith = function(end){
				return this.substr(this.length - end.length, end.length) === end;
			};
		}
	}

	_hookUpdate(){
		const originalUpdate = cc.ig.gameMain.update;
		cc.ig.gameMain.update = function() {
			originalUpdate.apply(this, arguments);
			window.simplify.fireUpdate();
		};
	}
	
	_findNextAction(action) {
		for (const i in action) {
			if (typeof action[i] === 'object') {
				for (const j in action[i]) {
					if (i === j){
						this.nextActionVarName = i;
						return;
					}
				}
			}
		}
	}
}


class SimplifyFont {
	constructor() {
		this.iconSet = this._findIconSet();
		this.mapping = this._findMapping();
		this.indexMapping = this._findIndexMapping();
	}
	
	pushIconSet(set) {
		return this.iconSet.push(set) - 1;
	}
	
	prepareMapping(mapping, page){
		for (const name in mapping) {
			mapping[name][0] = page;
		}
	}
	
	setMapping(map){
		for (const index in map) {
			this.mapping[index] = map[index];
			if (this.indexMapping.indexOf(index) == -1) {
				this.indexMapping.push(index);
			}
		}
	}

	_findIconSet() {
		const font = cc.sc.fontsystem.font;
		
		for (const key in font) {
			if (typeof font[key] === 'object' && font[key].constructor.name === 'Array' && font[key].length > 0) {
				if (font[key][0].constructor === cc.ig.Font) {
					return font[key];
				}
			}
		}
		
		return null;
	}

	_findMapping(){
		const font = cc.sc.fontsystem.font;
		
		for (const key in font) {
			if (typeof font[key] === 'object' && font[key]['8'] === 4) {
				return font[key];
			}
		}
		
		return null;
	}

	_findIndexMapping(){
		const font = cc.sc.fontsystem.font;
		
		for (const key in font) {
			if(typeof font[key] === 'object' && font[key][0] === 'o') {
				return font[key];
			}
		}
		
		return null;
	}
}

class SimplifyOptions {
	constructor() {
		/** @type {{name: string, cat: number}[]} */
		this.tabs = [];

		this._getVarNames()
			.then(() => {
				this._hookTabBox();
				this.loaded = true;
				this._initializeLogLevel(0);
			})
			.catch(err => {
				console.error('Could not load simplify.options', err);
				this.loaded = false;
			});
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {string=} displayName 
	 */
	addTab(name, displayName){
		if (!this.loaded) {
			return;
		}
		
		cc.sc.OPTION_CATEGORY[name] = Object.keys(cc.sc.OPTION_CATEGORY).length;
		cc.sc.OptionsTabBox.prototype[entries.optionsTabBoxTab][name] = null;

		if (displayName !== undefined) {	
			ig.lang.labels.sc.gui.menu.option[name] = displayName;	
		}
		
		this.tabs.push({name:name, cat:cc.sc.OPTION_CATEGORY[name]});
		
		return cc.sc.OPTION_CATEGORY[name];
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {string} type 
	 * @param {*} init 
	 * @param {number} cat 
	 * @param {*=} data 
	 * @param {boolean=} restart 
	 * @param {string=} header
	 */
	addEntry(name, type, init, cat, data, restart, header) {
		if(!this.loaded)
			return;
		
		const obj = {type:type};
		obj[this.initName] = init;
		obj[this.catName] = cat;
		
		if(data !== undefined)
			obj.data = data;
		
		if(restart !== undefined)
			obj[this.restartName] = restart;

		if(header !== undefined) {
			obj[this.dividerName] = true;
			obj[entries.header] = header;
		}
		
		cc.sc.OPTIONS_DEFINITION[name] = obj;
		sc.options[this.valuesName][name] = init;
	}

	reload() {
		const globals = cc.ig.storage[entries.storageGlobals];
		
		if(globals && sc.options) {
			sc.options[entries.optionsLoadGlobals](globals);
		}
	}

	/**
	 * 
	 * @param {number} cat
	 */
	_initializeLogLevel(cat) {
		const lang = ig.lang.labels.sc.gui.options;
		lang['logLevel-log'] = {name: 'Log level: Default', description: 'Enables default message popups. \\c[1]Needs a restart!'};
		lang['logLevel-warn'] = {name: 'Log level: Warnings', description: 'Enables warning popups. \\c[1]Needs a restart!'};
		lang['logLevel-error'] = {name: 'Log level: Errors', description: 'Enables error popups. \\c[1]Needs a restart!'};
		lang.headers['logLevel'] = 'Log levels';

		this.addEntry('logLevel-log', 'CHECKBOX', false, cat, undefined, true, 'logLevel');
		this.addEntry('logLevel-warn', 'CHECKBOX', true, cat, undefined, true);
		this.addEntry('logLevel-error', 'CHECKBOX', true, cat, undefined, true);

		Object.defineProperties(sc.options[this.valuesName], {
			'logLevel-log': {
				get: () => ((localStorage.getItem('logFlags') & 4) == 4) || false,
				set: value => value 
					? localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) | 4)
					: localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) & 3)
			},
			'logLevel-warn': {
				get: () => ((localStorage.getItem('logFlags') & 2) == 2) || true,
				set: value => value 
					? localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) | 2)
					: localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) & 5)
			},
			'logLevel-error': {
				get: () => ((localStorage.getItem('logFlags') & 1) == 1) || true,
				set: value => value 
					? localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) | 1)
					: localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) & 6)
			}
		});
	}

	_getVarNames() {
		return new Promise((resolve, reject) => {
			this.restartName = this._getVarNameByType(cc.sc.OPTIONS_DEFINITION.language, 'boolean');
			if(!this.restartName) {
				reject();
			}
			
			this.initName = this._getVarNameByType(cc.sc.OPTIONS_DEFINITION['skip-confirm'], 'boolean');
			if(!this.initName){
				reject();
			}
			
			this.catName = this._getVarNameByType(cc.sc.OPTIONS_DEFINITION['show-money'], 'number');
			if(!this.catName){
				reject();
			}
			
			this.valuesName = this._getVarNameByChildren(sc.options, 'language');
			if(!this.valuesName){
				reject();
			}

			this.dividerName = this._getVarNameByType(cc.sc.OPTIONS_DEFINITION['circuit-text-size'], 'boolean');
			if(!this.dividerName){
				reject();
			}

			resolve();
		});
	}

	_getVarNameByType(obj, type){
		for (const key in obj) {
			if (typeof(obj[key]) === type) {
				return key;
			}
		}
		return undefined;
	}
	
	_getVarNameByChildren(obj, child) {
		for (var key in obj) {
			if (typeof(obj[key]) === 'object' && obj[key][child] !== undefined) {
				return key;
			}
		}
		return undefined;
	}

	_hookTabBox() {
		const original = cc.sc.OptionsTabBox.prototype[entries.init];
		cc.sc.OptionsTabBox.prototype[entries.init] = function(){
			original.apply(this, arguments);
			window.simplify.options._loadTabs(this);
		};
	}

	_loadTabs(tabBox) {
		for(const tabData of this.tabs){
			tabBox[entries.optionsTabBoxTab][tabData.name] = tabBox[entries.optionsTabBoxCreateTabButton].call(tabBox, tabData.name, tabBox[entries.optionsTabBoxTabArray].length, tabData.cat);
		}
		tabBox[entries.optionsTabBoxRearrangeTabs].call(tabBox);
	}
}

class SimplifyResources {
	constructor() {
		/** @type {{handler: (xhr: any, url: string) => void), filter?: string, beforeCall?: boolean}[]} */
		this.handlers = [];
		
		this._hookAjax();
		this._patchCache();
		this._hookImage();
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
		const fullreplace = window.simplify.getAllAssets(settings.url.substr(ig.root.length));

		if(fullreplace && fullreplace.length > 0){
			if(fullreplace.length > 1)
				console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');

			//console.log("Replacing '" + settings.url + "' with '" + fullreplace[0]  + "'");

			if (window.require) {
				settings.url = ig.root + fullreplace[0];
			} else {
				settings.url = ig.root + fullreplace[0].substr(7);
			}
		}

		const patches = window.simplify.getAllAssets(settings.url.substr(ig.root.length) + '.patch');
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

	_patchCache(){
		let images = this._searchForImages(cc.ig.cacheList, 5);
		images = images.concat(this._searchForImages(cc.sc.fontsystem, 4));

		for (const image of images){
			this._handleImage(image);
		}
	}

	_searchForImages(obj, layer){
		if (layer <= 0) {
			return [];
		}

		let result = [];
		for (const key in obj) {
			if(obj[key]) {
				if(obj[key] instanceof cc.ig.Image) {
					result.push(obj[key]);
				} else if (typeof obj[key] === 'object') {
					result = result.concat(this._searchForImages(obj[key], layer - 1));
				}
			}
		}

		return result;
	}

	_hookImage(){
		const original = cc.ig.Image.prototype.load;

		cc.ig.Image.prototype.load = function() {
			const fullreplace = window.simplify.getAllAssets(this.path);
			if(fullreplace && fullreplace.length > 0){
				if(fullreplace.length > 1)
					console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');

				//console.log("Replacing '" + this.path + "' with '" + fullreplace[0]  + "'");
				const oldPath = this.path;
				this.path = fullreplace[0];
				if (arguments[0]) {
					const originalCb = arguments[0];
					arguments[0] = function(type, _, loaded) {
						originalCb(type, oldPath, loaded);
					};
				}
			}

			return original.apply(this, arguments);
		};
	}
	
	_handleImage(image){
		const fullreplace = window.simplify.getAllAssets(image.path);

		if(fullreplace && fullreplace.length > 0){
			if(fullreplace.length > 1)
				console.warn('Conflict between \'' + fullreplace.join('\', \'') + '\' found. Taking \'' + fullreplace[0] + '\'');

			//console.log("Replacing '" + image.path + "' with '" + fullreplace[0]  + "'");
			image.path = fullreplace[0];
			image.reload();
			image.load();
		}
	}

	/**
	 * 
	 * @param {string} path 
	 */
	_stripAssets(path){
		return path.indexOf('assets/') == 0 ? path.substr(7) : path;
	}
}

new Simplify();