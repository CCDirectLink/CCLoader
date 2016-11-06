var ac = require("acorn");
var walker = require("acorn/dist/walk");

function Acorn(){
	this.tree = undefined;
	
	this.parse = function(jscode){
		this.tree = ac.parse(jscode, {onToken: function(){}});
		/*var result = walker.findNodeAt(this.tree, null, null, function(nodeType, node){
				function search(n, layers){
					if(layers <= 0)
						return n === "Can't spawn entity of type ";
					
					for(var key in n){
						if(search(n[key], layers - 1))
							return true;
					}
					
					return false;
				}
				
				return search(node, 12);
			});*/
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
				return this._getFixed(compiled);
			case "before":
				return this._getBefore(compiled);
			case "select":
				return this._getSelect(compiled);
		}
	}
	
	this._getFixed = function(compiled){
		return compiled.pattern;
	}
	this._getBefore = function(compiled){
		var node = walker.findNodeAt(this.tree, null, null, this._getTest(compiled.test.type, compiled.test.pattern)).node;
		node = walker.findNodeAround(this.tree, node.start - 1).node;
		
		return this._getNodeName(node);
	}
	this._getSelect = function(compiled){
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