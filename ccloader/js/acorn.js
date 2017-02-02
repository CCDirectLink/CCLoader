function Acorn(){
	var acorn, walker,
	    acornLoaded = false, 
	    walkerLoaded = false;
	if(require){
		var acorn = require("acorn");
		var walker = require("acorn/dist/walk");
		acornLoaded = true;
		walkerLoaded = true;
	}else{
		this.loadScript("node_modules/acorn/dist/acorn.js", function(){
			acorn = window.acorn;
			acornLoaded = true;
		})
		this.loadScript("node_modules/acorn/dist/walk.js", function(){
			walker = window.acorn.walk;
			walkerLoaded = true;
		})
	}
	
	
	this.tree = undefined;
	
	this.parse = function(jscode){
		var i = 0;
		while(!acornLoaded) {}
		this.tree = acorn.parse(jscode, {onToken: function(){}});
		/*var result = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
				function search(n, layers){
					if(layers <= 0)
						return (n === "Achievements" && i === 1) || i++ === -1;
					
					for(var key in n){
						if(search(n[key], layers - 1))
							return true;
					}
					
					return false;
				}
				
				return search(node, 6);
			});
		console.log(result);*/
			
	}
	
	this.analyse = function(dbDefinition){
		while(!walkerLoaded) {}
		var db = new Db(dbDefinition.name);
		return this._buildDb(db, dbDefinition);
	}
	
	this.loadScript = function(url, callback){
		var script = document.createElement("script");
		document.body.appendChild(script);
		script.onload = callback;
		script.type = "text/javascript";
		script.src = url;
	}
	
	this._buildDb = function(db, definition){
		for(var i = 0; i < definition.members.length; i++){
			var member = definition.members[i];
			if(member.type === "object"){
				this._buildDb(db.addObject(member.name), member);
			}else{
				this._buildMember(db, member);
			}
		}
		
		return db;
	}
	
	this._buildMember = function(db, member){
		var value = this._getVar(member.compiled);
		
		switch(member.refType){
			case "raw":
				db.addRawMember(member.name, value);
				break;
			case "ref":
				db.addMemberReference(member.name, member.parent, value);
				break;
			case "var":
			default:
				db.addMember(member.name, member.parent, value);
				break;
		}
	}
	
	this._getVar = function(compiled){
		switch(compiled.type){
			case "fixed":
				return this._getFixedVar(compiled);
			case "select":
				return this._getSelectVar(compiled);
		}
	}
	
	this._getFixedVar = function(compiled){
		return compiled.pattern;
	}
	
	this._getSelectVar = function(compiled){
		var instance = this;
		var node = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
			if(nodeType !== compiled.from.type){
				return false;
			}
			
			for(var valuePairIndex in compiled.from.values){
				var valuePair = compiled.from.values[valuePairIndex];
				var realValue = instance._getNodeMember(node, valuePair.name);
				if(realValue === undefined || realValue !== valuePair.value)
					return false;
			}
			
			return true;
		}).node;
		return this._getNodeMember(node, compiled.pattern);
	}
	
	this._getNodeMember = function(node, path){
		var split = path.split(".");
		var result = node;
		
		for(var step in split){
			result = result[split[step]];
			if(result === undefined || result === null)
				return undefined;
		}
		
		return result;
	}
}