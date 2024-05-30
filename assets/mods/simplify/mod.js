(() => {
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
			this._initializeEvents();

			this.font = new SimplifyFont();
			this.options = new SimplifyOptions();

			this.resources = window.simplifyResources;
			window.simplifyResources = undefined;

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
		 * @returns {string|string[]}
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
					if (typeof asset === 'string') {
						result.push(asset);
					} else {
						result.push(...asset);
					}
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
		_initializeEvents(){
			document.createEvent('Event').initEvent('returnToMenu', true, true);
			document.createEvent('Event').initEvent('mapUnloaded', true, true);
		}
		async _postInitialize(){
			this._initializeFont();
			this._initializeOptions();
			
			document.body.dispatchEvent(new Event('simplifyInitialized', { bubbles: true }));
		}
		_initializeFont() {
			const icons = new cc.ig.Font('mods/simplify/media/icons.png', 16, 2000);
			const page = window.simplify.font.pushIconSet(icons);
			
			this.font.prepareMapping(ICON_MAPPING, page);
			this.font.setMapping(ICON_MAPPING);
		}
		_initializeOptions(){
			const mods = window.inactiveMods
				.concat(window.activeMods)
				.sort((a, b) => ('' + a.name).localeCompare(b.name));
			
			const tab = this.options.addTab('mods', 'Mods');

			const infoBoxSupported = !!sc.OptionInfoBox;
			if (infoBoxSupported) {
				ig.lang.labels.sc.gui.options['mods-description'] = {description: 'In this menu you can \\c[3]enable or disable installed mods\\c[0]. Mod descriptions are shown below. \\c[1]The game needs to be restarted\\c[0] if you change any options here!'};
				const descriptionEntry = this.options.addEntry('mods-description', 'INFO', undefined, tab, 'options.mods-description.description');
				// marginBottom is a custom field, see _hookInfoBox
				descriptionEntry.marginBottom = 6;
			}

			for (const mod of mods){
				if (mod.hidden) {
					continue;
				}

				const optionName = 'modEnabled-' + mod.name.toLowerCase();
				const modOption = this.options.addEntry(optionName, 'CHECKBOX', true, tab, undefined, true);
				// checkboxRightAlign is a custom field, see _hookRow
				modOption.checkboxRightAlign = true;

				const name = mod.displayName || mod.name;
				const description = infoBoxSupported
					? mod.description || ' '
					: (mod.description || 'If checked this mod is enabled.') + ' \\c[1]Needs a restart!';
				
				const lang = ig.lang.labels.sc.gui.options;
				lang[optionName] = {name, description};

				// default icon
				modOption.icon = {
					path: 'media/gui/menu.png',
					offsetX: 536,
					offsetY: 160,
					sizeX: 23,
					sizeY: 23,
				};

				if (mod.icons && typeof mod.icons['24'] === 'string') {
					modOption.icon = {
						path: `/${mod.baseDirectory}/${mod.icons['24']}`,
						offsetX: 0,
						offsetY: 0,
						sizeX: 24,
						sizeY: 24,
					};
				}
				
				modOption.version = mod.version;

				if (modOption.version && !modOption.version.toLowerCase().startsWith("v")) {
					modOption.version = "v" + modOption.version;
				}

				Object.defineProperty(sc.options[this.options.valuesName], optionName, {
					get: () => localStorage.getItem(optionName) !== 'false',
					set: value => {
						value 
							? localStorage.setItem(optionName, 'true')
							: localStorage.setItem(optionName, 'false');
					}
				});
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
					this._addModOption();
					this._hookTabBox();
					this._hookRow();
					this._hookInfoBox();
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
		 * @returns {any}
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

			return obj;
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
					get: () => (((localStorage.getItem('logFlags') || 3) & 4) == 4),
					set: value => {
						value 
							? localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) | 4)
							: localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) & 3);
					}
				},
				'logLevel-warn': {
					get: () => (((localStorage.getItem('logFlags') || 3) & 2) == 2),
					set: value => {
						value 
							? localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) | 2)
							: localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) & 5);
					}
				},
				'logLevel-error': {
					get: () => (((localStorage.getItem('logFlags') || 3) & 1) == 1),
					set: value => {
						value 
							? localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) | 1)
							: localStorage.setItem('logFlags', (localStorage.getItem('logFlags') || 3) & 6);
					}
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
			for (let key in obj) {
				if (typeof(obj[key]) === 'object' && obj[key][child] !== undefined) {
					return key;
				}
			}
			return undefined;
		}

		_hookTabBox() {
			if (!sc.OptionsTabBox) return;
			sc.OptionsTabBox.inject({
				init(...args) {
					this.parent(...args);
					window.simplify.options._loadTabs(this);
				},
				_createOptionList: function () {
					this.parent(...arguments);
					this.rows
						.filter(e => e.option && e.option.type === 'MOD')
						.forEach(mod => mod.setPos(11, mod.hook.pos.y));
				}
			});
		}

		_addModOption() {
			if (!sc.OPTION_GUIS || !sc.OPTION_TYPES) return;

			sc.OPTION_TYPES.MOD = Object.keys(sc.OPTION_TYPES).length;
			sc.OPTION_GUIS[sc.OPTION_TYPES.MOD] = sc.OPTION_GUIS[sc.OPTION_TYPES.CHECKBOX];
		}
		
		_hookRow() {
			if (!sc.OptionRow) return;
			
			sc.OptionRow.inject({
				iconGui: null,
				iconSettings: null,
				versionText: null,
		
				init(...args) {
					this.parent(...args);
			
					let lineHook = this.hook.children[1];

					if (this.option.icon != null) {
						let { icon } = this.option;
						this.iconSettings = icon;
						this.iconGui = new ig.ImageGui(
							new ig.Image(icon.path),
							icon.offsetX,
							icon.offsetY,
							icon.sizeX,
							icon.sizeY,
						);
						this.iconGui.setAlign(ig.GUI_ALIGN.X_LEFT, ig.GUI_ALIGN.Y_BOTTOM);
						this.iconGui.setPos(this.nameGui.hook.pos.x, lineHook.pos.y + 2);
						this.addChildGui(this.iconGui);
						this.nameGui.hook.pos.x += this.iconGui.hook.pos.x + this.iconGui.hook.size.x;
					}

					if(this.option.version != null) {
						this.versionText = new sc.TextGui(this.option.version, {
							font: sc.fontsystem.tinyFont
						});
						this.versionText.setAlign(ig.GUI_ALIGN.X_RIGHT, ig.GUI_ALIGN.Y_BOTTOM);
						this.versionText.setPos(this.typeGui.button.hook.size.x + 8, lineHook.pos.y);
						this.addChildGui(this.versionText)
					}

					if (this.option.type === 'CHECKBOX' && this.option.checkboxRightAlign) {
						let checkbox = this.typeGui;
						checkbox.button.hook.align.x = ig.GUI_ALIGN.X_RIGHT;
						let additionalWidth = checkbox.hook.size.x - checkbox.button.hook.size.x;
						const lineHook = this.hook.children[1];
						const slopeHook = this.hook.children[2];
						lineHook.size.x += additionalWidth;
						slopeHook.pos.x += additionalWidth;
					}
				},
			});
		}

			
		_hookInfoBox() {
			if (!sc.OptionInfoBox) return;

			// add marginBottom field to options in sc.OPTIONS_DEFINITION
			const original = sc.OptionInfoBox.prototype.init;
			sc.OptionInfoBox.prototype.init = function(option) {
				original.apply(this, arguments);
				if (option.marginBottom) {
					this.hook.size.y += option.marginBottom; 
				}
			};
		}

		_loadTabs(tabBox) {
			for(const tabData of this.tabs){
				tabBox[entries.optionsTabBoxTab][tabData.name] = tabBox[entries.optionsTabBoxCreateTabButton].call(tabBox, tabData.name, tabBox[entries.optionsTabBoxTabArray].length, tabData.cat);
			}
			tabBox[entries.optionsTabBoxRearrangeTabs].call(tabBox);
		}
	}

	new Simplify();
})();
