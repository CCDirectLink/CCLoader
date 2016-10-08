var ac = require("acorn");
var walker = require("acorn/dist/walk");

function Acorn(){
	this.tree = undefined;
	
	this.parse = function(jscode){
		this.tree = ac.parse(jscode, {onToken: function(){}});
		var result = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
				for(var key in node){
					for(var subkey in node[key])
						for(var subkey2 in node[key][subkey])
							for(var subkey3 in node[key][subkey][subkey2])
								for(var subkey4 in node[key][subkey][subkey2][subkey3])
									for(var subkey5 in node[key][subkey][subkey2][subkey3][subkey4])
										if(typeof node[key][subkey][subkey2][subkey3][subkey4][subkey5] === "string" && node[key][subkey][subkey2][subkey3][subkey4][subkey5] === "GAME_ERROR_CALLBACK") 
											return true;
				}
				return false;
			});
	}
	
	this.analyse = function(dbDefinition){
		var db = new Db(dbDefinition.name);
		return this._buildDb(db, dbDefinition);
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
		switch(member.compiled.type){
			case "fixed":
				this._getFixed(db, member.name, member.parent, member.compiled);
				break;
			case "before":
				this._getBefore(db, member.name, member.parent, member.compiled.test);
				break;
			case "select":
				this._getSelect(db, member.name, member.parent, member.compiled.pattern, member.compiled.from);
				break;
			case "selectReference":
				this._getSelectReference(db, member.name, member.parent, member.compiled.pattern, member.compiled.from);
				break;
			case "raw":
				this._getRaw(db, member.name, member.parent, member.compiled.compiled);
				break;
		}
	}
	
	this._getFixed = function(db, name, parent, compiled){
		db.addMember(name, parent, compiled.pattern);
	}
	this._getBefore = function(db, name, parent, test){
		var node = walker.findNodeAt(this.tree, null, null, this._getTest(test.type, test.pattern)).node;
		node = walker.findNodeAround(this.tree, node.start - 1).node;
		
		db.addMember(name, parent, this._getNodeName(node));
	}
	this._getSelect = function(db, name, parent, pattern, selectFrom){
		var instance = this;
		var node = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
			if(nodeType !== selectFrom.type){
				return false;
			}
			
			for(var valuePairIndex in selectFrom.values){
				var valuePair = selectFrom.values[valuePairIndex];
				var realValue = instance._getNodeMember(node, valuePair.name);
				if(realValue === undefined || realValue !== valuePair.value)
					return false;
			}
			
			return true;
		}).node;
		var compiledName = this._getNodeMember(node, pattern);
		db.addMember(name, parent, compiledName);
	}
	this._getSelectReference = function(db, name, parent, pattern, selectFrom){
		var instance = this;
		var node = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
			if(nodeType !== selectFrom.type){
				return false;
			}
			
			for(var valuePairIndex in selectFrom.values){
				var valuePair = selectFrom.values[valuePairIndex];
				var realValue = instance._getNodeMember(node, valuePair.name);
				if(realValue === undefined || realValue !== valuePair.value)
					return false;
			}
			
			return true;
		}).node;
		var compiledName = this._getNodeMember(node, pattern);
		db.addMemberReference(name, parent, compiledName);
	}
	this._getRaw = function(db, name, parent, compiled){
		var instance = this;
		var selectFrom = compiled.from;
		switch(compiled.type)
		{
			case "select":
				var node = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
					if(nodeType !== selectFrom.type){
						return false;
					}
					
					for(var valuePairIndex in selectFrom.values){
						var valuePair = selectFrom.values[valuePairIndex];
						var realValue = instance._getNodeMember(node, valuePair.name);
						if(realValue === undefined || realValue !== valuePair.value)
							return false;
					}
					
					return true;
				}).node;
				var value = this._getNodeMember(node, compiled.pattern);
				db.addRawMember(name, value);
				break;
			case "fixed":
				db.addRawMember(name, compiled.pattern);
				break;
		}
	}
	
	this._getTest = function(type, pattern){
		switch(type){
			case "literal":
				return this._getTestLiteral(pattern);
		}
	}
	
	this._getTestLiteral = function(pattern){
		return function(nodeType, node){
			if(nodeType === "Literal"){
				return node.value === pattern;
			}
			return false;
		}
	}
	
	this._getNodeName = function(node){
		switch(node.type){
			case "MemberExpression":
				return node.property.name;
		}
	}
	this._getNodeMember = function(node, path){
		var split = path.split(".");
		var result = node;
		
		for(var step in split){
			result = result[split[step]];
			if(result === undefined)
				return undefined;
		}
		
		return result;
	}
}