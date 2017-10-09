function Mod(file){
	var manifest;
	var loaded = false;
	
	this.initialize = function(){
		var data = filemanager.getResource(file);
		if(!data)
			return;
		
		manifest = JSON.parse(data);
		if(!manifest || !manifest.main)
			return;
		
		if(!_isPathAbsolute(manifest.main))
			manifest.main = _getBaseName(file) + "/" + manifest.main;
		
		manifest.main = _normalizePath(manifest.main);
		
		if(!manifest.name)
			manifest.name = _getModNameFromFile();
		
		loaded = true;
	}
	this.load = function(cb){
		if(!loaded)
			return;
		
		filemanager.loadMod(manifest.main, cb);
	}
	this.getName = function(){
		if(!loaded)
			return;
		
		return manifest.name;
	}
	this.getDescription = function(){
		if(!loaded)
			return;
		
		return manifest.description;
	}
	this.isEnabled = function(){
		if(!loaded)
			return false;
		
		var globals = frame.contentWindow.cc.ig.storage[frame.contentWindow.cc.ig.varNames.storageGlobals];
		
		if(!globals || !globals.options)
			return true;
		
		return globals.options['modEnabled-' + manifest.name.toLowerCase()] !== false;
	}
	
	function _getModNameFromFile(){
		var name = file.match(/\/[^\/]*\/package.json/g).pop().replace(/\//g, "");
		name = name.substr(0, name.length - 6);
		return name;
	}
	function _isPathAbsolute(path){
		return /^(?:\/|[a-z]+:\/\/)/.test(path);
	}
	function _getBaseName(path){
		if(path.indexOf("/") >= 0)
			return path.substring(0, path.lastIndexOf("/"));
		else if(path.indexOf("\\") >= 0)
			return path.substring(0, path.lastIndexOf("\\"));
		else
			return path;
	}
	function _normalizePath(path){
		if(path.indexOf("assets/") == 0)
			return path.substr(7);
		else
			return path;
	}
	
	this.initialize();
}