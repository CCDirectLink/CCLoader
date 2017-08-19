if(!cc)
	throw "No Modloader Found!";

var simplify = new function(){
	var registeredFuncs = [];
	var loadEvent, unloadEvent, lastMap;
	var nextActionVarName = undefined;
	
	function initialize(){
		cc.ig.gameMain.spawnEntity = cc.ig.gameMain.spawnEntity();
		cc.ig.gameMain.getEntityPosition = function(entity){
			if(!entity || !entity[cc.ig.varNames.entityData])
				return {x: -1, y: -1, z: -1};
			return entity[cc.ig.varNames.entityData][cc.ig.varNames.entityPosition];
		}
		cc.ig.gameMain.setEntityPosition = function(entity, pos){
			if(entity && entity[cc.ig.varNames.entityData])
				entity[cc.ig.varNames.entityData][cc.ig.varNames.entityPosition] = pos;
		}
		cc.ig.gameMain.teleport = cc.ig.gameMain[cc.ig.varNames.gameMainTeleport];
		cc.ig.gameMain.loadMap = function(data){ cc.ig.gameMain[cc.ig.varNames.gameMainLoadMap].call(data.context, data) };
		
		if(!String.prototype.endsWith){
			String.prototype.endsWith = function(end){
				return this.substr(this.length - end.length, end.length) === end;
			}
		}
		
		_initializeGUI();
		_initializeEvents();
		_hookUpdate();
		
		document.body.addEventListener('modsLoaded', _initializeOptions);
	}
	
	function findNextAction(action){
		for(var i in action) {
			if(typeof action[i] === "object") {
				for(var j in action[i]) {
					if(i === j){
						nextActionVarName = i;
						return;
					}
				}
			}
		}
	}
	
	function _initializeEvents(){
		document.createEvent('Event').initEvent('returnToMenu', true, true);
		document.createEvent('Event').initEvent('mapUnloaded', true, true);
	}
	
	function _hookUpdate(){
		cc.ig.gameMain.originalUpdate = cc.ig.gameMain.update;
		cc.ig.gameMain.update = function(){
				cc.ig.gameMain.originalUpdate();
				var mapName = cc.ig.getMapName();
				if(mapName !== lastMap){
					document.body.dispatchEvent(new Event("mapLoaded"));
				}
				lastMap = mapName;
				simplify.fireUpdate();
			};
	}
	
	function _initializeGUI() {
		for(var obj in cc.ig.GUI) 
			if(cc.ig.GUI[obj] && cc.ig.GUI[obj].length === 21) {
				cc.ig.GUI.menues = cc.ig.GUI[obj];
				return;
			}
	}
	
	function _initializeOptions(){
		var mods = simplify.getAllMods();
		
		var tab = simplify.options.addTab("mods");
		ig.lang.labels.sc.gui.menu.option.mods = "Mods";
		for(var i = 0; i < mods.length; i++){
			simplify.options.addEntry("modEnabled-" + mods[i], "CHECKBOX", true, tab, undefined, true);
			var display = mods[i];
			display = display.charAt(0).toUpperCase() + display.slice(1);
			ig.lang.labels.sc.gui.options["modEnabled-" + mods[i]] = {name:display, description:"If checked this mods is enabled. \\c[1]Needs a restart!"};
		}
		simplify.options.reload();
	}
	
	this.registerUpdate = function(func){
		if(func && typeof func === "function"){
			registeredFuncs.push(func);
		}
	}
	this.fireUpdate = function(){
		for(var i = 0; i < registeredFuncs.length; i++){
			registeredFuncs[i]();
		}
	}
	
	this.loadScript = function(url, callback){
		var script = document.createElement("script");
		document.body.appendChild(script);
		script.onload = callback;
		script.type = "text/javascript";
		script.src = url;
	}
	
	this.getActiveMapName = function(){
		return cc.ig.gameMain[cc.ig.varNames.mapName]
	}
	
	this.getAnimation = function(entity){
		return entity[cc.ig.varNames.currentAnimation];
	}
	this.setAnimation = function(entity, value){
		entity[cc.ig.varNames.currentAnimation] = value;
	}
	
	this.runCombatAction = function(cAction) {
		return cAction[cc.ig.varNames.runCombatAction].apply(cAction, Array.prototype.slice.call(arguments, 1));
	}
	this.getEntityProxies = function(entity) {
		return entity[cc.ig.varNames.proxies];
	}
	
	this.getProxyAction = function(action){
		return action[cc.ig.varNames.proxyActions];
	}
	this.getNextProxyAction = function(action){
		if(nextActionVarName === undefined)
			findNextAction(action);
		
		if(nextActionVarName !== undefined)
			return action[nextActionVarName];
		else
			return undefined;
	}
	
	this.getInnerGui = function(gui) {
		return gui[cc.ig.varNames.innerGUI];
	}
	
	this.jumpHigh = function(){
		cc.ig.playerInstance()[cc.ig.varNames.jump](185, 16, 100);
	}
	
	this.getAnimationTimer = function(entity){
		return entity[cc.ig.varNames.animation][cc.ig.varNames.timer];
	}
	this.setAnimationTimer = function(entity, value){
		entity[cc.ig.varNames.animation][cc.ig.varNames.timer] = value;
	}
	this.getModName = function(file){
		var name = file.match(/\/[^\/]*\/mod.js/g).pop().replace(/\//g, "");
		name = name.substr(0, name.length - 6);
		return name;
	}
	this.getActiveMods = function(){
		var mods = [];
		for(var key in document.body.children){
			var value = document.body.children[key];
			if(value && value.src && value.src.toString().endsWith("/mod.js")){
				mods.push(this.getModName(value.src));
			}
		}
		return mods;
	}
	this.getInactiveMods = function(){
		var mods = [];
		for(var key in window.inactiveMods){
			mods.push(this.getModName(window.inactiveMods[key]));
		}
		return mods;
	}
	this.getAllMods = function(){
		var active = this.getActiveMods();
		var inactive = this.getInactiveMods();
		return active.concat(inactive).sort();
	}
	initialize();
}();

simplify.options = new function(){
	
	var restartName;
	var initName;
	var catName;
	var valuesName;
	var loaded = false;
	var tabs = [];
	
	function initialize(){
		restartName = _getVarNameByType(cc.sc.OPTIONS_DEFINITION.language, "boolean");
		if(!restartName)
			return;
		
		initName = _getVarNameByType(cc.sc.OPTIONS_DEFINITION["skip-confirm"], "boolean");
		if(!initName)
			return;
		
		catName = _getVarNameByType(cc.sc.OPTIONS_DEFINITION["show-money"], "number");
		if(!catName)
			return;
		
		valuesName = _getVarNameByChildren(sc.options, "language");
		if(!valuesName)
			return;
		
		_hookTabBox();
		
		loaded = true;
	}
	
	function _getVarNameByType(obj, type){
		for(var key in obj){
			if(typeof(obj[key]) === type)
				return key;
		}
		return undefined;
	}
	function _getVarNameByChildren(obj, child){
		for(var key in obj){
			if(typeof(obj[key]) === "object" && obj[key][child] !== undefined)
				return key;
		}
		return undefined;
	}
	
	function _hookTabBox(){
		cc.sc.OptionsTabBox.prototype.orig_init = cc.sc.OptionsTabBox.prototype[cc.sc.varNames.init];
		cc.sc.OptionsTabBox.prototype[cc.sc.varNames.init] = function(){
			this.orig_init.apply(this, arguments);
			_loadTabs(this);
		}
	}
	
	function _loadTabs(tabBox){
		for(var i = 0; i < tabs.length; i++){
			var tabData = tabs[i];
			tabBox[cc.sc.varNames.optionsTabBoxTab][tabData.name] = tabBox[cc.sc.varNames.optionsTabBoxCreateTabButton].call(tabBox, tabData.name, tabBox[cc.sc.varNames.optionsTabBoxTabArray].length, tabData.cat);
		}
		tabBox[cc.sc.varNames.optionsTabBoxRearrangeTabs].call(tabBox);
	}
	
	this.isLoaded = function(){
		return loaded;
	}
	
	this.addTab = function(name){
		if(!loaded)
			return;
		
		cc.sc.OPTION_CATEGORY[name] = Object.keys(cc.sc.OPTION_CATEGORY).length;
		cc.sc.OptionsTabBox.prototype[cc.sc.varNames.optionsTabBoxTab][name] = null;
		
		tabs.push({name:name, cat:cc.sc.OPTION_CATEGORY[name]});
		
		return cc.sc.OPTION_CATEGORY[name];
	}
	
	this.addEntry = function(name, type, init, cat, data, restart){
		if(!loaded)
			return;
		
		var obj = {type:type};
		obj[initName] = init;
		obj[catName] = cat;
		
		if(data !== undefined)
			obj.data = data;
		
		if(restart !== undefined)
			obj[restartName] = restart;
		
		cc.sc.OPTIONS_DEFINITION[name] = obj;
		sc.options[valuesName][name] = init;
	}
	
	this.reload = function(){
		var globals = cc.ig.storage()[cc.ig.varNames.storageGlobals];
		sc.options[cc.sc.varNames.optionsLoadGlobals](globals);
	}
	
	initialize();
}();