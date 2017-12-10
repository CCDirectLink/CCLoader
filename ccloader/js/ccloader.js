function ModLoader(){
	var _instance = this;
	this.tableLoaded = false;
	this.table = undefined;
	this.mods = [];
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
		this.frame.src = window.require ? '../assets/node-webkit.html' : '/assets/node-webkit.html';
	}
	this.reloadTables = function(){
		_instance.modTables = {};
		filemanager.getTableName(function(tableName){
			_createTable(tableName);
			_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
			for(var i in _instance.modTables){
				_instance.modTables[i].executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
			}
		});
	}
	
	function _initializeTable(cb){
		filemanager.getTableName(function (tableName){
			if(filemanager.tableExists(tableName)){
				_loadTable(tableName, cb)
			} else {
				_createTable(tableName);
				cb();
			}
		});
	}
	function _createTable(tableName){
		console.log('Reading files...');
		var jscode = filemanager.getResource('assets/js/game.compiled.js');
		var dbtext = filemanager.getResource('modloaderdata/definitions.db');
		var dbdef = JSON.parse(dbtext);
		console.log('Parsing...');
		_instance.acorn.parse(jscode);
		console.log('Analysing...');
		_instance.table = _instance.acorn.analyse(dbdef);
		console.log('Writing...');
		filemanager.saveTable(tableName, _instance.table);
		console.log('Finished!');
	}
	function _initializeModTables(cb){
		_findMods();
		_loadMods(function(){
			var total = 1;
			var actual = 0;
			
			for(var i = 0; i < this.mods.length; i++){
				if(this.mods[i].isEnabled()){
					total++;
					this.mods[i].initializeTable(_instance, function(){
						actual++;
						if(actual >= total)
							cb();
					});
				}
			}
			
			actual++;
			if(actual >= total)
				cb();
		});
	}
	function _loadTable(tableName, cb){
		filemanager.getDefintionHash(function(hash){
			_instance.table = filemanager.loadTable(tableName, hash);
			if(!_instance.table)
			{
				_createTable(tableName);
				if(cb)
					cb();
				return;
			}
			if(cb)
				cb();
		});
	}
	function _executeDb(){
		_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		for(var i in _instance.modTables){
			_instance.modTables[i].executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
		}
		_initializeModTables(function(){
			_initializeMods();
		});
		_instance.status.innerHTML = "Initializing Mods..";
	}	
	function _onGameInitialized(){
		_instance.status.innerHTML = "Loading..";
		_instance.frame.contentWindow.reloadTables = _instance.reloadTables;
		var modsLoadedEvent = _instance.frame.contentDocument.createEvent('Event');
		modsLoadedEvent.initEvent('modsLoaded', true, true);
		var intervalid = setInterval(function(){
			if(frame.contentWindow.ig && frame.contentWindow.ig.ready) {
				clearInterval(intervalid);
				
				_executeDb();
			}}, 1000);//Make sure Game is loaded
	}
	
	function _findMods(){
		var modFiles = filemanager.getAllModsFiles();
		this.mods = [];
		for(var i = 0; i < modFiles.length; i++){
			this.mods.push(new Mod(modFiles[i]));
		}
	}

	function _loadMods(cb){
		var length = this.mods.length;
		var count = 0;

		for(var i = 0; i < length; i++){
			this.mods[i].onload(function(){
				count++;
				if(count >= length)
					cb();
			})
		}
	}
	
	function _initializeMods(){
		frame.contentWindow.inactiveMods = [];
		frame.contentWindow.activeMods = [];
		
		for(var i = 0; i < this.mods.length; i++){
			if(this.mods[i].isEnabled()){
				frame.contentWindow.activeMods.push(this.mods[i]);
				this.mods[i].load(function(){
					_instance.modsLoaded++;
				});
			} else {
				frame.contentWindow.inactiveMods.push(this.mods[i]);
				_instance.modsLoaded++;
			}
		}
		
		var intervalid = setInterval(function(){
			if(_instance.modsLoaded >= frame.contentWindow.activeMods.length){
				clearInterval(intervalid);
				_instance.frame.contentDocument.body.dispatchEvent(new Event("modsLoaded"));
				_instance.status.outerHTML = "";
				_instance.overlay.outerHTML = "";
			}
		}, 1000);
	}
}

