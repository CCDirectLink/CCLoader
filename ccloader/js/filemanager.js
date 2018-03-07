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
			}, document);
			modList = JSON.parse(this.getResource('mods.json'));
		}
	}
	this.loadMod = function(file, onModLoaded){
        _loadScript(file, onModLoaded, modloader.frame.contentDocument);
	}
	this.getTableName = function(callback){
		_getHash('assets/js/game.compiled.js', callback);
	}
	this.getDefintionHash = function(callback){
		_getHash('ccloader/data/definitions.db', callback);
	}
	this.getModDefintionHash = function(def, callback){
		_getHash('assets/' + def, callback);
	}
	this.getAllModsFiles = function(folder){
        return _getResources(folder, '/package.json');
	};
	this.tableExists = function(table){
		if(!table)
			return false;
		
		return _resourceExists('ccloader/data/' + table);
	}
	this.modTableExists = function(table){
		if(!table)
			return false;
		
		return _resourceExists('ccloader/data/assets/' + table);
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
			_getHash('ccloader/data/' + tableName, function(hash){
				filemanager.saveTable(tableName, table, hash)
			});
			return;
		}
		
		
		if(isLocal) {
			try {
				_createDirectory(path.dirname('ccloader/data/' + tableName));
			} catch(e) {}
			fs.writeFileSync('ccloader/data/' + tableName, JSON.stringify({hash: hash, db: table}), 'utf-8');
		}
	}
	this.loadTable = function(tableName, hash){
		var text = filemanager.getResource('ccloader/data/' + tableName);
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
    
    function _getResources(folder, ending){
		if(!folder)
			folder = 'assets/mods/';
		
		if(isLocal)
			return _getResourcesLocal(folder, ending);
		else {
			var results = [];
			for(var i in modList){
				if(_resourceExists('assets/mods/' + modList[i] + ending)){
					results.push('assets/mods/' + modList[i] + ending);
				}
			}
			return results;
		}
    }
    function _getHash(file, callback) {
		if(isLocal) {
            return md5file(file, function(err, hash){
                callback(hash + '.table');
            });
        } else {
            if(!md5Loaded){
                setTimeout(this.getTableName, 100, callback);
            } else {
                callback(Crypto.MD5(filemanager.getResource(file)) + '.table');
            }
        }
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
	function _loadScript(url, callback, doc){
		var script = document.createElement("script");
		script.onload = callback;
		script.type = "text/javascript";
		script.src = url;
		doc.body.appendChild(script);
	}
	function _getResourcesLocal(folder, ending){
		var results = [];
		
		if(isLocal) {
			try{
				fs.readdirSync(folder).forEach(function(file) {
					try{
						file = folder + '/' + file;
						
						if (_isDirectory(file)) {
							var innerResults = _getResourcesLocal(file, ending);
							results = results.concat(innerResults);
						} else if(file.endsWith(ending)){
							results.push(file);
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
			_createDirectory('ccloader/data/assets/mods');
		}
	}
	function _createDirectory(dir){
		if(fs.existsSync(dir) && fs.statSync(dir).isDirectory())
			return;
		
		var parent = path.join(dir, '..');
		_createDirectory(parent);

		fs.mkdirSync(dir);
	}
};