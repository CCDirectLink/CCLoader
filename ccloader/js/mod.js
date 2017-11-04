function Mod(file){
	var manifest;
	var loaded = false;
	var table;
	
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
		
		if(manifest.table){
			if(!_isPathAbsolute(manifest.table))
				manifest.table = _getBaseName(file) + "/" + manifest.table;
			manifest.table = _normalizePath(manifest.table);
		}
		
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
	this.initializeTable = function(ccloader, cb){
		if(!loaded || !manifest.table)
			return cb();
		
		filemanager.getModDefintionHash(manifest.table, function(hash){
			var tablePath = _getBaseName(file) + "/" + hash;
			
			table = filemanager.loadTable(tablePath, hash);
			if(!table){
				console.log('[' + manifest.name + '] Creating mod definition database..');
				var dbtext = filemanager.getResource('assets/' + manifest.table);
				var dbdef = JSON.parse(dbtext);
				console.log('[' + manifest.name + '] Analysing...');
				table = ccloader.acorn.analyse(dbdef);
				console.log('[' + manifest.name + '] Writing...');
				filemanager.saveTable(tablePath, table, hash);
				console.log('[' + manifest.name + '] Finished!');
			}
			
			cb();
		});
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