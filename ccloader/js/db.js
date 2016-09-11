function Db(name){
	this.data = {type: "object", name: name, members: []};
	
	this.addObject = function(name){
		var newDb = new Db(name);
		this.data.members.push(newDb.data);
		return newDb;
	}
	
	this.addMember = function(name, parent, compiledName){
		this.data.members.push({type: "member", name: name, parent: parent, compiledName: compiledName});
	}
	
	this.executeDb = function(parent, root){
		parent[this.data.name] = {};
		var child = parent[this.data.name];
		
		for(var i = 0; i < this.data.members.length; i++){
			if(this.data.members[i].type === "object"){
				var ndb = new Db(this.data.members[i].name);
				ndb.data = this.data.members[i];
				ndb.executeDb(child, root);
			}else{
				var member = this.data.members[i];
				child[member.name] = this._getParent(member.parent, root)[member.compiledName];
			}
		}
	}
	
	this._getParent = function(parentString, root){
		if(parentString === undefined || parentString === ""){
			return root;
		}
		
		var parent = root;
		var parentStringArr = parentString.split(".");
		
		for(var i = 0; i < parentStringArr.length; i++){
			parent = parent[parentStringArr[i]];
		}
		
		return parent;
	}
}