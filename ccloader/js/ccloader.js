function ModLoader(){
	var _instance = this;
	this.table = undefined;
	this.mods = [];
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
		this.frame.onload = _onGameInitialized.bind(this);
		this.frame.src = window.require ? '../assets/node-webkit.html' : '/assets/node-webkit.html';
	}
	this.reloadTables = function(){
		_instance.modTables = {};
		filemanager.getTableName(function(tableName){
			_createTable.bind(_instance)(tableName);
			_instance.table.executeDb(_instance.frame.contentWindow, _instance.frame.contentWindow);
			for(var i = 0; i < _instance.mods.length; i++){
				_instance.mods[i].executeTable(_instance);
			}
		});
	}
	
	function _initializeTable(cb){
		filemanager.getTableName(function(tableName){
			if(filemanager.tableExists(tableName)){
				_loadTable(tableName, cb)
			} else {
				_createTable.bind(_instance)(tableName);
				cb();
			}
		});
	}
	//Requires bind
	function _createTable(tableName){
        this.status.innerHTML = "Initializing Mapping";
		console.log('Reading files...');
		var jscode = filemanager.getResource('assets/js/game.compiled.js');
		var dbtext = filemanager.getResource('ccloader/data/definitions.db');
		var dbdef = JSON.parse(dbtext);
		console.log('Parsing...');
		this.acorn.parse(jscode);
		console.log('Analysing...');
		this.table = this.acorn.analyse(dbdef);
		console.log('Writing...');
		filemanager.saveTable(tableName, this.table);
		console.log('Finished!');
	}
	function _initializeModTables(cb){
		_findMods.bind(_instance)();
		_loadMods.bind(_instance)((function(){
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
		}).bind(_instance));
	}
	function _loadTable(tableName, cb){
		filemanager.getDefintionHash((function(hash){
			this.table = filemanager.loadTable(tableName, hash);
			if(!this.table)
			{
				_createTable.bind(this)(tableName);
				if(cb)
					cb();
				return;
			}
			if(cb)
				cb();
		}).bind(_instance));
	}
	//Requires bind
	function _executeDb(){
		this.table.executeDb(this.frame.contentWindow, this.frame.contentWindow);

        this.status.innerHTML = "Initializing Mods";
		_initializeModTables(function(){
			_initializeMods.bind(_instance)();
		});
	}	
	
	function _onGameInitialized(){
		this.status.innerHTML = "Loading Game";
		this.frame.contentWindow.reloadTables = this.reloadTables;
		var modsLoadedEvent = this.frame.contentDocument.createEvent('Event');
		modsLoadedEvent.initEvent('modsLoaded', true, true);
		var intervalid = setInterval(function(){
			if(frame.contentWindow.ig && frame.contentWindow.ig.ready) {
				clearInterval(intervalid);
				
				_executeDb.bind(_instance)();
			}}, 1000);//Make sure Game is loaded
	}
	
	//Requires bind
	function _findMods(){
		var modFiles = filemanager.getAllModsFiles();
		this.mods = [];
		for(var i = 0; i < modFiles.length; i++){
			this.mods.push(new Mod(modFiles[i]));
		}
	}

	//Requires bind
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
	
	//Requires bind
	function _initializeMods(){
		this.frame.contentWindow.inactiveMods = [];
		this.frame.contentWindow.activeMods = [];
		
		for(var i = 0; i < this.mods.length; i++){
			if(this.mods[i].isEnabled()){
				this.frame.contentWindow.activeMods.push(this.mods[i]);

				(function(mod){
					mod.load(function(){
						_instance.modsLoaded++;
						mod.executeTable(_instance);
					});
				})(this.mods[i]);
			} else {
				this.frame.contentWindow.inactiveMods.push(this.mods[i]);
				this.modsLoaded++;
			}
		}
		
		var intervalid = setInterval((function(){
			if(this.modsLoaded >= this.frame.contentWindow.activeMods.length){
				clearInterval(intervalid);
				this.frame.contentDocument.body.dispatchEvent(new Event("modsLoaded"));
				this.status.outerHTML = "";
				this.overlay.outerHTML = "";
			}
		}).bind(this), 1000);
	}
	}
}

