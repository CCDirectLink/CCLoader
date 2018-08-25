// Load node modules that we're particularly interested in.
var nodemodules;
(function () {
	// Modules are loaded in order if require is available.
	// A module entry is: JS, onNodeLoad, onJSLoad, loadCallbacks
	var modules = new Map();
	var moduleOrder = ["acorn", "acorn/dist/walk"];
	modules.set("acorn", [
		"/node_modules/acorn/dist/acorn.js", function (n) { window.acorn = n; }, function () {}, []
	]);
	modules.set("acorn/dist/walk", [
		"/node_modules/acorn/dist/walk.js", function (n) { window.acorn.walk = n; }, function () {}, []
	]);
	var loadedModules = new Set();
	nodemodules = {
		on: function (name, func) {
			if (loadedModules.has(name)) {
				func();
			} else {
				modules.get(name)[3].push(func);
			}
		}
	};
	function _loadScript(url, callback){
		var script = document.createElement("script");
		document.body.appendChild(script);
		script.onload = callback;
		script.type = "text/javascript";
		script.src = url;
	}
	for (var i = 0; i < moduleOrder.length; i++) {
		const moduleId = moduleOrder[i];
		const module = modules.get(moduleId);
		if (window.require) {
			loadedModules.add(moduleOrder[i]);
			module[1](require(moduleOrder[i]));
		} else {
			_loadScript(module[0], function () {
				loadedModules.add(moduleId);
				module[2]();
				for (var j = 0; j < module[3].length; j++)
					module[3][j]();
			});
		}
	}
})();

