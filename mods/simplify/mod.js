if(!cc)
	throw "No Modloader Found!";

var simplify = new function(){
	var dummyEntity = cc.ig.baseEntity.extend({isDummy: true, f: function(a, b, c, d) { this.parent(a, b, c, d);}, update: function(){
			simplify.fireUpdate();
		}});
	var dummyIndex = 0;
	var registeredFuncs = [];
	var loadEvent, unloadEvent;
	
	var initialize = function(){
		cc.ig.gameMain.spawnEntity = function(name, x, y, z, data, isHidden){
			return cc.ig.gameMain.$e(name, x, y, z, data, isHidden);
		}
		_initializeEvents();
		_hookUpdate();
	}
	
	var _initializeEvents = function(){
		document.createEvent('Event').initEvent('returnToMenu', true, true);
		document.createEvent('Event').initEvent('mapUnloaded', true, true);
	}
	
	var _hookUpdate = function(){
		var intId = setInterval(function(){
			if(!cc.ig.gameMain.$a[0] && dummyIndex !== -1){
				document.body.dispatchEvent(new Event("returnToMenu"));
				dummyIndex = -1;
			}
			if(cc.ig.gameMain.$a[0] && (!cc.ig.gameMain.entities[dummyIndex] || cc.ig.gameMain.entities[dummyIndex].isDummy !== true)){
				dummyIndex = cc.ig.gameMain.entities.length;
				cc.ig.gameMain.spawnEntity(dummyEntity, 0, 0, -128, {});
				document.body.dispatchEvent(new Event("mapLoaded"));
			}
		}, 1000);
		/*cc.ig.gameMain.update = (function(original) {
			return function() {
				simplify.fireUpdate();
				return original.apply(this, arguments);
			};
		})(cc.ig.gameMain.update, this.fireUpdate);*/
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
	
	initialize();
}();