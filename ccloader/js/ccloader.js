var fs = require('fs');
var md5file = require('md5-file');

function ModLoader(databaseName){
	var _instance = this;
	this.databaseName = databaseName;
	this.tableName = "";
	this.tableLoaded = false;
	this.table = undefined;
	this.modTables = {};
	this.frame = undefined;
	this.acorn = undefined;
	this.status = undefined;
	this.modsLoaded = 0;
	
	this.initialize = function(){
		fs.mkdir('modloaderdata', function(err){});
		fs.mkdir('modloaderdata/mods', function(err){});
		fs.mkdir('mods', function(err){});
		this.frame = document.getElementById('frame');
		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');
		this.acorn = new Acorn();
		
		this._initializeTable();
	}
	
	this.startGame = function(){
		this.frame.style.display = 'block';
		this.overlay.style.display = 'block';
		this.frame.onload = this._onGameInitialized;
		this.frame.src = '../node-webkit.html';
	}
	
	this._initializeTable = function(){
		this._getTableName();
		if(!this._tableExists()){
			this._createTable();
		}else{
			this._loadTable();
		}
	}
	
	this._createTable = function(){
		console.log('Reading files...');
		var jscode = fs.readFileSync('js/game.compiled.js', 'utf-8');
		var dbtext = fs.readFileSync('modloaderdata/definitions.db', 'utf-8');
		var dbdef = JSON.parse(dbtext);
		this._createModTables(dbdef);
		console.log('Parsing...');
		this.acorn.parse(jscode);
		console.log('Analysing...');
		this.table = this.acorn.analyse(dbdef);
		console.log('Writing...');
		fs.writeFileSync('modloaderdata/' + this.tableName, JSON.stringify(this.table.data), 'utf-8');
		fs.writeFileSync('modloaderdata/' + this.tableName, JSON.stringify(this.table.data), 'utf-8');
		for(var i in this.modTables){
			try {
				fs.mkdirSync('modloaderdata/' + i.replace(/\/definitions\.db/g, ""), function(err){});
			} catch(e) {}
			fs.writeFileSync('modloaderdata/' + i.replace(/\/definitions\.db/g, "") + "/" + this.tableName, JSON.stringify(this.modTables[i].data), 'utf-8');
		}
		console.log('Finished!');
	}
	
	this._createModTables = function(originalDb){
		var files = this._getAllDbFiles();
		for(var file in files){
			var dbtext = fs.readFileSync(files[file], 'utf-8');
			var dbdef = JSON.parse(dbtext);
			this.modTables[files[file]] = this.acorn.analyse(dbdef);
		}
	}
	
	this._getTableName = function(){
		this.tableName = md5file.sync('js/game.compiled.js') + '.table';
	}
	
	this.reloadTables = function(){
		_instance.modTables = {};
		_instance._createTable();
		_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		for(var i in _instance.modTables){
			_instance.modTables[i].executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		}
	}
	
	this._tableExists = function(){
		try{
			fs.statSync('modloaderdata/' + this.tableName);
			return true;
		} catch(e) {
			return false;
		}
	}
	
	this._loadTable = function(){
		var text = fs.readFileSync('modloaderdata/' + this.tableName, 'utf-8');
		this.table = new Db("");
		this.table.data = JSON.parse(text);
		
		var files = this._getAllDbFilesFromFolder('modloaderdata/mods');
		for(var i in files){
			text = fs.readFileSync(files[i], 'utf-8');
			var table = new Db("");
			table.data = JSON.parse(text);
			this.modTables[i] = table;
		}
	}
	
	this._onGameInitialized = function(){
		_instance.status.innerHTML = "Loading..";
		_instance.frame.contentWindow.reloadTables = _instance.reloadTables;
		var modsLoadedEvent = _instance.frame.contentDocument.createEvent('Event');
		modsLoadedEvent.initEvent('modsLoaded', true, true);
		var intervalid = setInterval(function(){
			if(frame.contentWindow.ig && frame.contentWindow.ig.ready) {
				_instance._executeDb();
				clearInterval(intervalid);
			}}, 1000);//Make sure Game is loaded
	}
	
	this._executeDb = function(){
		_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		for(var i in _instance.modTables){
			_instance.modTables[i].executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		}
		_instance._initializeMods();
		_instance.status.innerHTML = "Initializing Mods..";
	}
	
	this._getAllModsFilesFromFolder = function(dir){
		var results = [];

		fs.readdirSync(dir).forEach(function(file) {
			file = dir+'/'+file;
			
			var stat = fs.statSync(file);
			if (stat && stat.isDirectory()) {
				results = results.concat(_instance._getAllModsFilesFromFolder(file))
			} else if(file.endsWith('/mod.js')){
				results.push(file);
			}
		});

		return results;
	}
	
	this._getAllModsFiles = function(){
		return _instance._getAllModsFilesFromFolder('mods/');
	};
	
	this._getAllDbFilesFromFolder = function(dir){
		var results = [];

		fs.readdirSync(dir).forEach(function(file) {
			file = dir+'/'+file;
			
			var stat = fs.statSync(file);
			if (stat && stat.isDirectory()) {
				results = results.concat(_instance._getAllDbFilesFromFolder(file))
			} else if(file.endsWith('/definitions.db') || file.endsWith('.table')){
				results.push(file);
			}
		});

		return results;
	}
	
	this._getAllDbFiles = function(){
		return _instance._getAllDbFilesFromFolder('mods/');
	};
		
	this._initializeMods = function(){
		var modFiles = _instance._getAllModsFiles();
		
		for(var i = 0; i < modFiles.length; i++){
			_instance._initializeMod(modFiles[i]);
		}
		
		var intervalid = setInterval(function(){
			if(_instance.modsLoaded >= modFiles.length){
				_instance.frame.contentDocument.body.dispatchEvent(new Event("modsLoaded"));
				clearInterval(intervalid);
				_instance.status.outerHTML = "";
				_instance.overlay.outerHTML = "";
			}
		}, 1000);
	}
	
	this._initializeMod = function(file){
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = file;
		script.onload = function(){
			_instance.modsLoaded++;
		}
		_instance.frame.contentDocument.body.appendChild(script);
	}
}

