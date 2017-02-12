function ModLoader(){
	var _instance = this;
	this.tableLoaded = false;
	this.table = undefined;
	this.modTables = {};
	this.frame = undefined;
	this.acorn = undefined;
	this.status = undefined;
	this.modsLoaded = 0;
	
	this.initialize = function(cb){
		filemanager.initialize(this);
		
		this.frame = document.getElementById('frame');
		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');
		
		this.acorn = new Acorn();
		this.acorn.initialize(function(){
			_initializeTable(cb);
		});
	}
	this.startGame = function(){
		this.frame.style.display = 'block';
		this.overlay.style.display = 'block';
		this.frame.onload = _onGameInitialized;
		this.frame.src = window.require ? '../node-webkit.html' : '/node-webkit.html';
	}
	this.reloadTables = function(){
		_instance.modTables = {};
		_createTable();
		_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		for(var i in _instance.modTables){
			_instance.modTables[i].executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		}
	}
	
	function _initializeTable(cb){
		filemanager.getTableName(function (tableName){
			if(filemanager.tableExists(tableName)){
				_loadTable(tableName);
			} else {
				_createTable(tableName);
			}
			cb();
		});
	}
	function _createTable(tableName){
		console.log('Reading files...');
		var jscode = filemanager.getResource('js/game.compiled.js');
		var dbtext = filemanager.getResource('modloaderdata/definitions.db');
		var dbdef = JSON.parse(dbtext);
		_createModTables();
		console.log('Parsing...');
		_instance.acorn.parse(jscode);
		console.log('Analysing...');
		_instance.table = _instance.acorn.analyse(dbdef);
		console.log('Writing...');
		filemanager.saveTables(tableName, _instance.table, _instance.modTables);
		console.log('Finished!');
	}
	function _createModTables(){
		var files = filemanager.getAllDbFiles();
		for(var file in files){
			var dbtext = filemanager.getResource(files[file]);
			var dbdef = JSON.parse(dbtext);
			_instance.modTables[files[file]] = _instance.acorn.analyse(dbdef);
		}
	}
	function _loadTable(){
		var text = filemanager.getResource('modloaderdata/' + _instance.tableName);
		_instance.table = new Db("");
		_instance.table.data = JSON.parse(text);
		
		var files = filemanager.getAllDbFiles('modloaderdata/mods');
		for(var i in files){
			text = filemanager.getResource(files[i]);
			var table = new Db("");
			table.data = JSON.parse(text);
			_instance.modTables[i] = table;
		}
	}
	function _executeDb(){
		_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		for(var i in _instance.modTables){
			_instance.modTables[i].executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		}
		_initializeMods();
		_instance.status.innerHTML = "Initializing Mods..";
	}	
	function _onGameInitialized(){
		_instance.status.innerHTML = "Loading..";
		_instance.frame.contentWindow.reloadTables = _instance.reloadTables;
		var modsLoadedEvent = _instance.frame.contentDocument.createEvent('Event');
		modsLoadedEvent.initEvent('modsLoaded', true, true);
		var intervalid = setInterval(function(){
			if(frame.contentWindow.ig && frame.contentWindow.ig.ready) {
				_executeDb();
				clearInterval(intervalid);
			}}, 1000);//Make sure Game is loaded
	}
	function _initializeMods(){
		var modFiles = filemanager.getAllModsFiles();
		
		for(var i = 0; i < modFiles.length; i++){
			filemanager.loadMod(modFiles[i], function(){
				_instance.modsLoaded++;
			});
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
}

