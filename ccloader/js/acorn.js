import * as acorn from '../node_modules/acorn/dist/acorn.es.js';
import * as walker from '../node_modules/acorn/dist/walk.es.js';

import { Db, DbTree } from './db.js';

/**
 * @deprecated Do not use definitions
 */
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