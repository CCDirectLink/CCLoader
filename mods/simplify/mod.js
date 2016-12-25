if(!cc)
	throw "No Modloader Found!";

var simplify = new function(){
	var registeredFuncs = [];
	var loadEvent, unloadEvent, lastMap;
	var nextActionVarName = undefined;
	
	var initialize = function(){
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
		_initializeEvents();
		_hookUpdate();
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
	
	var _initializeEvents = function(){
		document.createEvent('Event').initEvent('returnToMenu', true, true);
		document.createEvent('Event').initEvent('mapUnloaded', true, true);
	}
	
	var _hookUpdate = function(){
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
	
	initialize();
}();