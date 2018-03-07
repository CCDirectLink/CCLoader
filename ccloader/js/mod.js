if(!fs && window.require)
	var fs = require('fs');
if(!path && window.require)
	var path = require('path');
if(!process && window.require)
	var process = require('process');

function Mod(file){
	var manifest;
	var loaded = false;
	var onload;
	var table;
	
	this.initialize = function(){
		var data = filemanager.getResource(file);
		if(!data)
			return;
		
		manifest = JSON.parse(data);
		if(!manifest)
			return;
		
		if(manifest.main){
			if(!_isPathAbsolute(manifest.main))
				manifest.main = _getBaseName(file) + "/" + manifest.main;
			manifest.main = _normalizePath(manifest.main);
		}
		
		if(manifest.table){
			if(!_isPathAbsolute(manifest.table))
				manifest.table = _getBaseName(file) + "/" + manifest.table;
			manifest.table = _normalizePath(manifest.table);
		}
		
		if(!manifest.name)
			manifest.name = _getModNameFromFile();
		
		_findAssets(_getBaseName(file) + "/assets/", function(data){
			manifest.assets = data;
			loaded = true;
			if(onload)
				onload();
		});
	}
	this.load = function(cb){
		if(!loaded)
			return;

		if(!manifest.main)
			return cb();

		filemanager.loadMod(manifest.main, cb);
	}
	this.onload = function(cb){
		if(loaded)
			cb();
		else
			onload = cb;
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
	this.getAssets = function(){
		if(!loaded)
			return;
		return manifest.assets;
	}
	this.getAsset = function(path){
		if(!loaded || !manifest.assets)
			return;

		path = path.replace(/\\/g, "/");

		for(var i = 0; i < manifest.assets.length; i++)
			if(manifest.assets[i].endsWith(path))
				return manifest.assets[i];
	}
	this.getBaseDirectory = function(){
		return _getBaseName(file).replace(/\\/g, "/").replace(/\/\//g, "/") + "/";
	}
	this.initializeTable = function(ccloader, cb){
		if(!loaded || !manifest.table)
			return cb();
		
		filemanager.getModDefintionHash(manifest.table, function(hash){
			var tablePath = _getBaseName(file) + "/" + hash;
			
			table = filemanager.loadTable(tablePath, hash);
			if(!table){
				console.log('[' + manifest.name + '] Creating mod definition database..');
				if(ccloader.acorn.needsParsing()){
					console.log('[' + manifest.name + '] Parsing...');
					var jscode = filemanager.getResource('assets/js/game.compiled.js');
					ccloader.acorn.parse(jscode);
				}
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
	this.executeTable = function(ccloader){
		if(!loaded || !table)
			return;

		table.executeDb(ccloader.frame.contentWindow, ccloader.frame.contentWindow);
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
	function _findAssets(dir, cb){
		if(fs && path){
			var result = [];
			
			fs.readdir(dir, function(err, files) {
				if(err)
					return cb(result);
	
				var count = files.length;
	
				if(count == 0)
					return cb(result);
	
				for(var i in files){
					var file = path.resolve(dir, files[i]);
	
					(function(file){
						fs.stat(file, function(err, stat){
							if(stat && stat.isDirectory()){
								_findAssets(file, function(res){
									result = result.concat(res);
									count--;
									if(count == 0)
										return cb(result);
								});
							} else {
								if(file.endsWith(".json") || file.endsWith(".json.patch") || file.endsWith(".png"))
									result.push(path.relative(process.cwd() + "/assets/", file).replace(/\\/g, "/"));
								count--;
								if(count == 0)
									return cb(result);
							}
						})
					})(file);
				}
			});
		} else {
			if(!manifest.assets)
				return cb([]);

			var dir = _getBaseName(file) + "/";

			var result = [];
			for(var i = 0; i < manifest.assets.length; i++){
				result.push(dir + manifest.assets[i]);
			}

			return cb(result);
		}
	}
	
	this.initialize();
}
