var filemanager = new function(){
	var isBrowser = !window.require;
	var isLocal = !isBrowser;
	
	var fs, path, md5file, modloader, modList;
	var md5Loaded = false;
	
	this.initialize = function(mloader){
		modloader = mloader;
		
		if(isLocal){
			fs = require('fs');
			md5file = require('md5-file');
			path = require('path');
			
			_createDirectories();
		} else {
			_loadScript('js/2.5.3-crypto-md5.js', function(){ //ccloader/js/2.5.3-crypto-md5.js
				md5Loaded = true;
			});
			modList = JSON.parse(this.getResource('mods.json'));
		}
	}
	this.loadMod = function(file, onModLoaded){
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = file;
		script.onload = onModLoaded;
		modloader.frame.contentDocument.body.appendChild(script);
	}
	this.getTableName = function(callback){
		if(isLocal)
			return md5file('assets/js/game.compiled.js', function(err, hash){
				callback(hash + '.table');
			});
		else {
			if(!md5Loaded){
				setTimeout(this.getTableName, 100, callback);
			} else {
				callback(Crypto.MD5(filemanager.getResource('assets/js/game.compiled.js')) + '.table');
			}
		}
	}
	this.getDefintionHash = function(callback){
		if(isLocal)
			return md5file('modloaderdata/definitions.db', function(err, hash){
				callback(hash + '.table');
			});
		else {
			if(!md5Loaded){
				setTimeout(this.getDefintionHash, 100, callback);
			} else {
				callback(Crypto.MD5(filemanager.getResource('modloaderdata/definitions.db')) + '.table');
			}
		}
	}
	this.getModDefintionHash = function(def, callback){
		if(isLocal)
			return md5file('assets/' + def, function(err, hash){
				callback(hash + '.table');
			});
		else {
			if(!md5Loaded){
				setTimeout(this.getDefintionHash, 100, callback);
			} else {
				callback(Crypto.MD5(filemanager.getResource('assets/' + def)) + '.table');
			}
		}
	}
	this.getAllDbFiles = function(folder){
		if(!folder)
			folder = 'assets/mods/';
		
		if(isLocal)
			return _getAllDbFilesFromFolder(folder);
		else {
			var results = [];
			for(var i in modList){
				if(_resourceExists('assets/mods/' + modList[i] + '/definitions.db')){
					results.push('mods/' + modList[i] + '/definitions.db');
				}
			}
			return results;
		}
	};
	this.getAllModsFiles = function(folder){
		if(!folder)
			folder = 'assets/mods/';
		
		if(isLocal)
			return _getAllModsFilesFromFolder(folder);
		else {
			var results = [];
			for(var i in modList){
				if(_resourceExists('assets/mods/' + modList[i] + '/package.json')){
					results.push('assets/mods/' + modList[i] + '/package.json');
				}
			}
			return results;
		}
	};
	this.tableExists = function(table){
		if(!table)
			return false;
		
		return _resourceExists('modloaderdata/' + table);
	}
	this.modTableExists = function(table){
		if(!table)
			return false;
		
		return _resourceExists('assets/' + table);
	}
	this.getResource = function(resource){
		try{
			if(isLocal)
				return fs.readFileSync(resource, 'utf-8');
			else {
					var req = new XMLHttpRequest();
					req.open('GET', '/' + resource, false);
					req.send(null);

					if(req.status === 200) {
						return req.responseText;
					} else {
						return undefined;
					}
			}
		}catch(e){
			return undefined;
		}
	}
	this.saveTable = function(tableName, table, hash){
		if(!hash){
			this.getDefintionHash(function(hash){
				filemanager.saveTable(tableName, table, hash)
			});
			return;
		}
		
		
		if(isLocal) {
			try {
				fs.mkdirSync(path.dirname('modloaderdata/' + tableName), function(err){});
			} catch(e) {}
			fs.writeFileSync('modloaderdata/' + tableName, JSON.stringify({hash: hash, db: table}), 'utf-8');
		}
	}
	
	this.loadTable = function(tableName, hash){
		var text = filemanager.getResource('modloaderdata/' + tableName);
		if(!text)
			return undefined;
		
		var json = JSON.parse(text);
		var table = new Db("");
		
		if(!json || !json.hash)
			return undefined;
		
		if(hash && hash != json.hash)
			return undefined;
		
		table.data = json.db.data;
		return table;
	}
	
	function _resourceExists(resource){
		if(isLocal){
			try{
				fs.statSync(resource);
				return true;
			} catch(e) {
				return false;
			}
		} else {
			try{
				var req = new XMLHttpRequest();
				req.open('HEAD', '/' + resource, false);
				req.send();
				return req.status != 404;
			}catch(e){
				return false;
			}
		}
	}
	function _loadScript(url, callback){
		var script = document.createElement("script");
		document.body.appendChild(script);
		script.onload = callback;
		script.type = "text/javascript";
		script.src = url;
	}
	function _getAllModsFilesFromFolder(dir){
		var results = [];
		
		if(isLocal) {
			try{
				fs.readdirSync(dir).forEach(function(file) {
					try{
						file = dir + '/' + file;
						
						if (_isDirectory(file)) {
							var innerResults = _getAllModsFilesFromFolder(file);
							results = results.concat(innerResults);
						} else if(file.endsWith('/package.json')){
							results.push(file);
						}
					} catch(e) { }
				});
			} catch(e) { }
		}
		
		return results;
	}
	function _getAllDbFilesFromFolder(dir){
		var results = [];

		if(isLocal) {
			try{
				fs.readdirSync(dir).forEach(function(file) {
					try {
						file = dir + '/' + file;
						
						if (_isDirectory(file)) {
							var innerResults = _getAllDbFilesFromFolder(file);
							results = results.concat(innerResults);
						} else if(file.endsWith('/definitions.db') || file.endsWith('.table')){
							results.push(file);
						}
					} catch(e) { }
				});
			} catch(e) { }
		}

		return results;
	}
	function _getAllItemDbFilesFromFolder(dir){
		var results = [];

		if(isLocal) {
			try{
				fs.readdirSync(dir).forEach(function(file) {
					try {
						file = dir + '/' + file;
						
						if (_isDirectory(file)) {
							var innerResults = _getAllItemDbFilesFromFolder(file);
							results = results.concat(innerResults);
						} else if(file.endsWith('/item-database.json')){
							results.push(file.substring(7));
						}
					} catch(e) { }
				});
			} catch(e) { }
		}

		return results;
	}
	function _isDirectory(file){
		var stat = fs.statSync(file);
		return stat && stat.isDirectory();
	}
	function _createDirectories(){
		if(isLocal){
			fs.mkdir('modloaderdata', function(err){
				fs.mkdir('modloaderdata/assets', function(err){
					fs.mkdir('modloaderdata/assets/mods', function(err){});
				});
			});
			fs.mkdir('assets/mods', function(err){});
		}
	}
};