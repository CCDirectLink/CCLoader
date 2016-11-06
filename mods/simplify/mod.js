if(!cc)
	throw "No Modloader Found!";

var simplify = new function(){
	var registeredFuncs = [];
	var loadEvent, unloadEvent, lastMap;
	
	var initialize = function(){
		cc.ig.gameMain.spawnEntity = cc.ig.gameMain.spawnEntity();
		cc.ig.gameMain.getEntityPosition = function(entity){
			if(!entity || !entity.b)
				return {x: -1, y: -1, z: -1};
			return entity.b.i;
		}
		cc.ig.gameMain.setEntityPosition = function(entity, pos){
			if(entity && entity.b)
				entity.b.i = pos;
		}
		_initializeEvents();
		_hookUpdate();
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
		return cc.ig.gameMain[cc.ig.mapNameVarName]
	}
	
	initialize();
}();