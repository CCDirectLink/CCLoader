function ModLoader(){
	var _instance = this;
	var CCLOADER_VERSION = '1.0.0';

	this.table = undefined;
	this.mods = [];
	this.frame = undefined;
	this.acorn = undefined;
	this.status = undefined;
	this.crosscodeVersion = undefined;
	this.modsLoaded = 0;
	
	this.initialize = function(cb){
		filemanager.initialize(this);
		
		this.frame = document.getElementById('frame');
		this.overlay = document.getElementById('overlay');
		this.status = document.getElementById('status');
		
		this.acorn = new Acorn();
		this.acorn.initialize(function(){
			_loadSemver(function(){
				_initializeTable(cb);
			});
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
				if(this.mods[i].isEnabled() && _canLoad.bind(this)(this.mods[i])){
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
			if(_canLoad.bind(this)(this.mods[i])){
				this.mods[i].onload(function(){
					count++;
					if(count >= length)
						cb();
				});
			}
		}
	}
	
	//Requires bind
	function _initializeMods(){
		this.frame.contentWindow.inactiveMods = [];
		this.frame.contentWindow.activeMods = [];
		
		for(var i = 0; i < this.mods.length; i++){
			if(this.mods[i].isEnabled() && _canLoad.bind(this)(this.mods[i])){
				this.frame.contentWindow.activeMods.push(this.mods[i]);

				(function(mod){
					mod.execute(_instance, function(){
						_instance.modsLoaded++;
					});
				})(this.mods[i]);
			} else {
				this.frame.contentWindow.inactiveMods.push(this.mods[i]);
				this.modsLoaded++;

				if(this.mods[i].isEnabled()){
					console.warn('Could not load "' + this.mods[i].getName() + '" because it is missing dependencies!')
				}
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

	function _loadSemver(cb) {
		_buildCrosscodeVersion.bind(_instance)();

		if(window.semver)
			return cb();

		if(window.require){
			window.semver = require('./js/semver.browser.js');
			return cb();
		}

		filemanager.loadScript('js/semver.browser.js', cb);
	}

	//Requires bind
	function _buildCrosscodeVersion(){
		var json = JSON.parse(localStorage.getItem('cc.version'));
		this.crosscodeVersion = json.major + '.' + json.minor + '.' + json.patch;
	}

	//Requires bind
	function _canLoad(mod) {
		var deps = mod.getDependencies();
		if(!deps)
			return true;

		for(var depName in deps){
			if(!deps.hasOwnProperty(depName))
				continue;

			var depRange = semver.validRange(deps[depName]);
			if(!depRange){
				console.warn('Invalid dependency version "' + deps[depName] + '" of "' + depName + '" of "' + mod.getName() + '"')
			}

			var satisfied = false;

			if(depName == 'ccloader' && semver.satisfies(CCLOADER_VERSION, depRange)) {
				satisfied = true;
			}
			if(depName == 'crosscode' && semver.satisfies(this.crosscodeVersion, depRange)) {
				satisfied = true;
			}

			for(var i = 0; i < this.mods.length && !satisfied; i++){
				if(this.mods[i].getName() == depName){
					if(semver.satisfies(semver.valid(this.mods[i].getVersion()), depRange)){
						satisfied = true;
					}
				}
			}

			if(!satisfied){
				return false;
			}
		}

		return true;
	}
}

