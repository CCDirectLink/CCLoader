function Acorn(){
	var ac, walker,
	    acornLoaded = false, 
	    walkerLoaded = false;
	
	var tree = undefined;
	var db;
	var definitions = [];
	
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
		/*setTimeout(function(){
			console.log("searching..")
			var i = 0, steps = 6, depth = 20;
			var pattern = "\"Load Game: %O\"";
			var searched = "fD";
			var result = walker.findNodeAt(tree, null, null, function(nodeType, node){
					function search(n, layers){
						if(layers <= 0)
							if(n === pattern){
								i++;
								return i > 0;
							}else
								return false;
						
						for(var key in n){
							if(search(n[key], layers - 1))
								return true;
						}
						
						return false;
					}
					
					return search(node, steps);
				});
			console.log(result);
			
			if(result){
				var selec, pat;
				
				function search(node, i, path){
					if(!node)
						return;
					for(var key in node){
						if(node[key] === searched){
							selec = path + key;
						} else if(node[key] === pattern){
							pat = path + key;
						} else if(i <= depth){
							search(node[key], i + 1, path + key + ".");
						}
					}
				}
				
				search(result, 0, "");
				
				console.log("pattern: " + selec);
				console.log("value: " + pat);
			}
		}, 1000);*/
			
	}	
	this.analyse = function(dbDefinition){
		db = new Db(dbDefinition.name);
		db = _buildDb(db, dbDefinition);
		_finalizeDb();
		return db;
	}
	
	function _finalizeDb() {
		while(definitions.length > 0) {
			var start = definitions.length;
			
			walker.findNodeAt(tree, undefined, undefined, function(nodeType, node){
				for(var i = 0; i < definitions.length; i++){
					var value = _getSelectVar(definitions[i].member.compiled, nodeType, node);
					if(value !== undefined) {
						_buildMember(definitions[i].db, definitions[i].member, value);
						definitions.splice(i, 1);
						i--;
					}
				}
			});
			
			if(start <= definitions.length) {
				console.warn(definitions.length + " definitions did not match", definitions);
				return
			}
		}
	}
	function _buildDb(db, definition){
		for(var i = 0; i < definition.members.length; i++){
			var member = definition.members[i];
			if(member.type === "object"){
				_buildDb(db.addObject(member.name), member);
			}else{
				_buildMemberLater(db, member);
			}
		}
		
		return db;
	}
	function _buildMemberLater(db, member){
		if(member.compiled.type === "fixed") {
			_buildMember(db, member, _getFixedVar(member.compiled));
		} else {
			definitions.push({db:db, member:member});
		}
	}
	
	function _buildMember(db, member, value){
		//var value = _getVar(member.compiled);
		
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
	function _getFixedVar(compiled){
		return compiled.pattern;
	}
	function _getSelectVar(compiled, nodeType, node){
		if(nodeType !== compiled.from.type){
			return undefined;
		}
		
		for(var valuePairIndex in compiled.from.values){
			var valuePair = compiled.from.values[valuePairIndex];
			var realValue = _getNodeMember(node, valuePair.name);
			if(realValue === undefined || realValue !== _resolveValue(valuePair))
				return undefined;
		}
		
		return _getNodeMember(node, compiled.pattern);
	}
	function _resolveValue(pair){
		if(pair.type === "dynamic"){
			var split = pair.value.split(".");
			var result = db.data;
			
			for(var step in split){
				var name = split[step];
				for(var i in result.members){
					if(name === result.members[i].name){
						if(result.members[i].type === "object"){
							result = result.members[i];
							break;
						}else{
							return result.members[i].compiledName;
						}
					}
				}
			}
		}else{
			return pair.value;
		}
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