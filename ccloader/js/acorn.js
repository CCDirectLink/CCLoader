import * as acorn from '../../node_modules/acorn/dist/acorn.es.js';
import * as walker from '../../node_modules/acorn/dist/walk.es.js';

import { Db, DbTree } from './db.js';

export class Acorn {
	get needsParsing(){
		return !this.tree;
	}

	/**
	 * 
	 * @param {string} jscode 
	 */
	parse(jscode){
		this.tree = acorn.parse(jscode, {onToken: () => {}});
		
		//Fancy new and fast searching algorithm
		/*setTimeout(function(){
			console.log("searching..")
			var perNode = 3, steps = 5, depth = 20;
			var pattern = "\"hp\"";
			var searched = "Rc";
			var results = [];
			var single = false;	


			walker.fullAncestor(tree, function(node, state, ancestor, type){
				if(single && results.length)
					return;
				
				function search(n, layers){
					if(layers < 0)
						return -1;
					
					if(n === pattern)
						return layers;
					
					if(typeof(n) === "function")
						return -1;
					
					for(var key in n){
						var s = search(n[key], layers - 1);
						if(s > -1)
							return s;
					}
					
					return -1;
				}
					
				var res = search(node, perNode);
				if(res >= 0){
					
					for(var i = 0; (ancestor.length - steps + (perNode - res) - i) >= 0; i++)
						if(ancestor[ancestor.length - steps + (perNode - res) - i].type){
							results.push(ancestor[ancestor.length - steps + (perNode - res) - i]);
							return;
						}
						
					console.warn("Could not find fitting node");
					if(ancestor.length - steps < 0)
						results.push(ancestor[0]);
					else
						results.push(ancestor[ancestor.length - steps]);
				}
			});

			console.log(results.length);

			for(var i = 0; i < results.length; i++){
				var result = results[i];
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
				
				if(selec){
					console.log(result);
					console.log("pattern: " + selec);
					console.log("value: " + pat);
				} else {
					console.log("value not matched: " + pat);
				}
			}
		}, 1000);*/
		/*
		//Old but reliable algorithm
		setTimeout(function(){
			console.log("searching..")
			var i = 0, steps = 14, depth = 20;
			var pattern = "CURRENT_STATE";
			var searched = "de";
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

	/**
	 * 
	 * @param {{entries: {[key: string]: {type: 'select', name: string, pattern: string, from: {type: string, values: {name: string, value: string, type?: 'dynamic'}[]}}}, tree: any[]}} dbDefinition 
	 */
	analyse(dbDefinition){
		const defs = [];
		for (const key in dbDefinition.entries) {
			dbDefinition.entries[key].name = dbDefinition.entries[key].name || key;
			defs.push(dbDefinition.entries[key]);
		}

		/** @type {{[name: string]: string}} */
		const entries = {};
		
		while (defs.length > 0) {
			const start = defs.length;
			
			walker.findNodeAt(this.tree, undefined, undefined, (nodeType, node) => {
				for (const i in defs) {
					if (!Object.prototype.hasOwnProperty.call(defs, i)) {
						continue;
					}

					const def = defs[i];
					const value = this._getSelectNode(def.from, nodeType, node, def.pattern, entries);
					if(value !== undefined) {
						entries[def.name] = value;
						defs.splice(i, 1);
					}
				}
			}, walker.base);
			
			if(start <= defs.length) {
				console.warn(defs.length + ' definitions did not match', defs);
				break;
			}
		}

		const root = new DbTree(dbDefinition.tree.name, []);
		for (const child of dbDefinition.tree.children) {
			this._buildTree(child, root, entries);
		}

		return new Db(entries, null, root);
	}

	/**
	 * 
	 * @param {{type: 'object'|'static'|'dynamic'|'raw', name: string, parent: string, children: any[]}} node
	 * @param {DbTree} parent
	 * @param {{[name: string]: string}} entries
	 * @returns {DbTree|DbNode} 
	 */
	_buildTree(node, parent, entries) {
		switch (node.type) {
		case 'object': {
			const result = new DbTree(node.name, []);
			for (const child of node.children) {
				this._buildTree(child, result, entries);
			}
			parent.addNode(result);
			break;
		}
		case 'static': 
			parent.addStatic(node.name, entries[node.name], node.parent);
			break;
		case 'dynamic':
			parent.addDynamic(node.name, entries[node.name], node.parent);
			break;
		case 'raw':
			parent.addRaw(node.name, entries[node.name]);
			break;
		}
	}

	
	/**
	 * 
	 * @param {{type: string, values: {name: string, value: string, type?: 'dynamic'}[]}} compiled 
	 * @param {string} nodeType 
	 * @param {string} node 
	 * @param {string} pattern 
	 * @param {{[name: string]: string}} entries
	 */
	_getSelectNode(compiled, nodeType, node, pattern, entries) {
		if(nodeType !== compiled.type) {
			return undefined;
		}
		
		for(const condition of compiled.values){
			const realValue = this._resolve(node, condition.name);
			if(realValue === undefined || realValue !== this._resolveValue(condition, entries))
				return undefined;
		}
		
		return this._resolve(node, pattern);
	}

	/**
	 * 
	 * @param {{name: string, value: string, type?: 'dynamic'}} pair 
	 * @param {{[name: string]: string}} entries
	 * @returns {string}
	 */
	_resolveValue(pair, entries){
		if(pair.type === 'dynamic'){
			return entries[pair.value];
		} else {
			return pair.value;
		}
	}

	/**
	 * @param {string} path
	 */
	_resolve(node, path) {
		const split = path.split('.');
		let result = node;
		
		for(const step of split){
			result = result[step];
			if(result === undefined || result === null)
				return undefined;
		}
		
		return result;
	}
}