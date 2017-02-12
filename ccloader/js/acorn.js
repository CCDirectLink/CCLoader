function Acorn(){
	var ac, walker,
	    acornLoaded = false, 
	    walkerLoaded = false;
	
	var tree = undefined;
	
	this.initialize = function(cb){
		if(window.require){
		ac = require("acorn");
		walker = require("acorn/dist/walk");
		acornLoaded = true;
		walkerLoaded = true;
		cb();
	}else{
		_loadScript("/node_modules/acorn/dist/acorn.js", function(){
			ac = window.acorn;
			acornLoaded = true;
			if(walkerLoaded)
				cb();
		})
		_loadScript("/node_modules/acorn/dist/walk.js", function(){
			walker = window.acorn.walk;
			walkerLoaded = true;
			if(acornLoaded)
				cb();
		})
	}
	
	}
	this.parse = function(jscode){
		tree = ac.parse(jscode, {onToken: function(){}});
		/*var result = walker.findNodeAt(tree, null, null, function(nodeType, node){
				function search(n, layers){
					if(layers <= 0)
						if(n === "jumpTrail")
							return true;
						else
							return false;
					
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
		var db = new Db(dbDefinition.name);
		return _buildDb(db, dbDefinition);
	}
	
	
	function _buildDb(db, definition){
		for(var i = 0; i < definition.members.length; i++){
			var member = definition.members[i];
			if(member.type === "object"){
				_buildDb(db.addObject(member.name), member);
			}else{
				_buildMember(db, member);
			}
		}
		
		return db;
	}
	function _buildMember(db, member){
		var value = _getVar(member.compiled);
		
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
	function _getVar(compiled){
		switch(compiled.type){
			case "fixed":
				return _getFixedVar(compiled);
			case "select":
				return _getSelectVar(compiled);
		}
	}
	function _getFixedVar(compiled){
		return compiled.pattern;
	}
	function _getSelectVar(compiled){
		var node = walker.findNodeAt(tree, null, null, function(nodeType, node){
			if(nodeType !== compiled.from.type){
				return false;
			}
			
			for(var valuePairIndex in compiled.from.values){
				var valuePair = compiled.from.values[valuePairIndex];
				var realValue = _getNodeMember(node, valuePair.name);
				if(realValue === undefined || realValue !== valuePair.value)
					return false;
			}
			
			return true;
		}).node;
		return _getNodeMember(node, compiled.pattern);
	}
	function _getNodeMember(node, path){
		var split = path.split(".");
		var result = node;
		
		for(var step in split){
			result = result[split[step]];
			if(result === undefined || result === null)
				return undefined;
		}
		
		return result;
	}
	function _loadScript(url, callback){
		var script = document.createElement("script");
		document.body.appendChild(script);
		script.onload = callback;
		script.type = "text/javascript";
		script.src = url;
	}
}