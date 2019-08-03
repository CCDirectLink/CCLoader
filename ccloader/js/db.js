/**
 * @deprecated
 */
export class Db {
	/**
	 * 
	 * @param {{[name: string]: string}} entries 
	 * @param {string?} hash 
	 * @param {DbTree?} tree 
	 */
	constructor(entries, hash, tree) {
		/** @type {{[name: string]: string}} */
		this.entries = entries || {};
		this.hash = hash || '';
		this.tree = tree || null;
	}

	/**
	 * 
	 * @param {{entries: {[name: string]: string}, hash: string, tree: DbTree, db?: any}} data 
	 */
	load(data) {
		if (data.db) {
			return this._loadLegacy(data);
		}

		this.entries = data.entries;
		this.hash = data.hash;
		this.tree = new DbTree(data.tree.name, []);
		for (const child of data.tree.children) {
			this.tree.addChild(child);
		}
	}

	/**
	 * 
	 * @param {string} entry 
	 * @returns {string | undefined}
	 */
	lookup(entry) {
		return this.entries[entry];
	}

	/**
	 * 
	 * @param {*} root The root of CrossCode
	 * @param {any?} parent The root of the database
	 */
	execute(root, parent) {
		if (!parent) {
			parent = root;
		}

		if (this.tree) {
			this.tree.execute(root, parent);
		}
	}

	/**
	 * 
	 * @param {{hash: string, db: {data: {type: 'object', name: string, members: any[]}}}} data 
	 */
	_loadLegacy(data) {
		this.isLegacy = true;
		this.hash = data.hash;
		this.tree = new DbTree(data.db.data.name, []);
		for (const child of data.db.data.members) {
			this._loadLegacyNode(data.db.data, child);
		}
	}

	/**
	 * 
	 * @param {{type: 'object'|'member', name: string, members?: any[], parent?: string, compiledName?: string}} data 
	 * @param {DbTree} parent
	 * @
	 */
	_loadLegacyNode(data, parent) {
		switch (data.type) {
		case 'object': {
			const node = parent.addTree(data.name);
			for (const child of data.members) {
				this._loadLegacyNode(child, node);
			}}
			break;
		case 'member':
			this.entries[data.name] = data.compiledName;
			parent.addStatic(data.name, data.compiledName, data.parent);
			break;
		case 'memberReference':
			parent.addDynamic(data.name, data.compiledName, data.parent);
			break;
		case 'rawmember':
			this.entries[data.name] = data.compiledName;
			parent.addRaw(data.name, data.compiledName);
			break;
		}
	}
}

/**
 * @deprecated
 */
export class DbTree {
	/**
	 * 
	 * @param {string} name 
	 * @param {(DbTree | DbNode)[]} children 
	 */
	constructor(name, children) {
		/** @type {'object'} */
		this.type = 'object';
		this.name = name;
		this.children = children;
	}

	/**
	 * 
	 * @param {*} root The root of CrossCode
	 * @param {any?} parent The parent of the database
	 */
	execute(root, parent) {
		if (!parent[this.name]) {
			parent[this.name] = {};
		}

		for (const child of this.children) {
			child.execute(root, parent[this.name]);
		}
	}

	/**
	 * Add unparsed data
	 * @param {{type: 'object'|'static'|'dynamic'|'raw', name: string, children?: (DbTree | DbNode)[], parent?: string, compiled?: string}} data 
	 */
	addChild(data) {
		if (data.type === 'object') {
			const child = new DbTree(data.name, []);
			for (const childEntry of data.children) {
				child.addChild(childEntry);
			}
			this.children.push(child);
		} else {
			this.children.push(new DbNode(data.type, data.name, data.compiled, data.parent));
		}
	}

	/**
	 * Add an already parsed child
	 * @param {DbNode | DbTree} node 
	 */
	addNode(node) {
		this.children.push(node);
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {string} compiled 
	 * @param {string} parent 
	 * @returns {DbTree}
	 */
	addStatic(name, compiled, parent) {
		const child = new DbNode('static', name, compiled, parent);
		this.addNode(child);
		return child;
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {string} compiled 
	 * @param {string} parent 
	 * @returns {DbTree}
	 */
	addDynamic(name, compiled, parent) {
		const child = new DbNode('dynamic', name, compiled, parent);
		this.addNode(child);
		return child;
	}

	/**
	 * 
	 * @param {string} name 
	 * @param {string} compiled 
	 * @returns {DbTree}
	 */
	addRaw(name, compiled) {
		const child = new DbNode('raw', name, compiled);
		this.addNode(child);
		return child;
	}
}

/**
 * @deprecated
 */
class DbNode {
	/**
	 * 
	 * @param {'static'|'dynamic'|'raw'} type 
	 * @param {string} name 
	 * @param {string} compiled 
	 * @param {string?} parent 
	 */
	constructor(type, name, compiled, parent) {
		this.type = type;
		this.name = name;
		this.compiled = compiled;
		this.parent = parent;
	}

	execute(root, parent) {
		switch(this.type) {
		case 'static':
			parent[this.name] = this._getParent(this.parent, root)[this.compiled];
			break;
		case 'dynamic':
			parent[this.name] = new Function('return this.' + this.parent + '.' + this.compiled).bind(root); //This is deprecated so I don't care about edge cases
			break;
		case 'raw':
			parent[this.name] = this.compiled;
			break;
		}
	}
	
	/**
	 * 
	 * @param {string} parentString 
	 * @param {*} root 
	 */
	_getParent(parentString, root){
		if(parentString === undefined || parentString === ''){
			return root;
		}
		
		let parent = root;
		for (const key of parentString.split('.')) {
			parent = parent[key];
		}
		return parent;
	}
}