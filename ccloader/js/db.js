function Db(name){
	this.data = {type: "object", name: name, members: []};
	
	this.addObject = function(name){
		var newDb = new Db(name);
		this.data.members.push(newDb.data);
		return newDb;
	}
	this.addMember = function(name, reobfName, parent, compiledName){
		this.data.members.unshift({type: "member", name: name, reobfName: reobfName, parent: parent, compiledName: compiledName});
	}
	this.addMemberReference = function(name, reobfName, parent, compiledName){
		this.data.members.unshift({type: "memberReference", name: name, reobfName: reobfName, parent: parent, compiledName: compiledName});
	}
	this.addRawMember = function(name, reobfName, value){
		this.data.members.unshift({type: "rawmember", name: name, reobfName: reobfName, compiledName: value});
	}

	// 'parent' is where this DB is being injected. parent[name] is created.
	// 'root' is the target window.
	this.executeDb = function(parent, root){
		if(!parent[this.data.name])
			parent[this.data.name] = {};
		var child = parent[this.data.name];
		var result = true;
		
		root.modloaderdb = {instance: this, root: root};
		// varNames but for any symbol at all.
		root.modloadermap = root.modloadermap || new Map();
		
		for(var i = 0; i < this.data.members.length; i++){
			var member = this.data.members[i];
			switch(member.type){
				case "object":
					var ndb = new Db(member.name);
					ndb.data = member;
					var res = ndb.executeDb(child, root);
					if(!res)
						result = false;
					break;
				case "rawmember":
					child[member.name] = member.compiledName;
					break;
				case "memberReference":
					_resolve(member.name, child)[_last(member.name)] = new Function('window', 'return function(){ return window.modloaderdb.instance._getParent(\'' + member.parent + '\', window.modloaderdb.root)[\'' + member.compiledName + '\']}')(root);
					break;
				default:
					_resolve(member.name, child)[_last(member.name)] = this._getParent(member.parent, root)[member.compiledName];
					if(_resolve(member.name, child)[_last(member.name)] === undefined)
						result = false;
					break;
			}
		}
		
		return result;
	}
	
	// 'modloadermap' is a Map that maps deobf IDs to obf IDs.
	this.createMapping = function(modloadermap){
		for(var i = 0; i < this.data.members.length; i++){
			// Anything with a compiledName is fine for root.modloadermap,
			//  unless it's a memberReference which are function-styled ("playerInstance" is actually a way to access the property "playerEntity")
			// The plan for incorrect definitions right now is I hope to get them aliased,
			//  and as for memberReference... something similar
			var member = this.data.members[i];
			if (member.compiledName) {
				var effectiveName = member.name;
				if (member.reobfName)
					effectiveName = member.reobfName;
				modloadermap.set(effectiveName, member.compiledName);
			}
			// While this walks the tree
			if (member.type == "object") {
				var ndb = new Db(member.name);
				ndb.data = member;
				ndb.createMapping(modloadermap);
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
	
	function _resolve(path, root){
		if(path === undefined || path === ""){
			return root;
		}
		
		var res = root;
		var pathArr = path.split(".");
		
		for(var i = 0; i < pathArr.length - 1; i++){
			res = res[pathArr[i]];
		}
		
		return res;
	}
	function _last(path){
		var res = path.split(".");
		return res[res.length - 1];
	}
}
