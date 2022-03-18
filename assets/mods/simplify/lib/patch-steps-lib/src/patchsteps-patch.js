/*
 * patch-steps-lib - Library for the Patch Steps spec.
 *
 * Written starting in 2019.
 *
 * Credits:
 *  Main code by 20kdc
 *  URL-style file paths, FOR_IN, COPY, PASTE, error tracking, bughunting by ac2pic
 *  Even more bughunting by ac2pic
 *
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */

import {photocopy, photomerge} from "./patchsteps-utils.js";

// The following are definitions used for reference in DebugState.
/*
 * ParsedPath is actually any type that translateParsedPath can understand.
 * And translateParsedPath can be overridden by the user.
 * But the types declared here are those that will be received no matter what.
 * declare type ParsedPath = null | [fromGame: true | false | string, url: string];
 *
 * declare type FileInfo = {
 *  path: string;
 *  stack: StackEntry[];
 * };
 *
 * declare type StackEntry = StackEntryStep | StackEntryError;
 * declare type StackEntryStep = {
 *  type: "Step";
 * };
 * declare type StackEntryError = {
 *  type: "Error";
 *  errorType: string;
 *  errorMessage: string;
 * };
 */

// Error handling for appliers.
// You are expected to subclass this class if you want additional functionality.
export class DebugState {
	// The constructor. The default state of a DebugState is invalid; a file must be added (even if null) to make it valid.
	constructor() {
		// FileInfo[]
		this.fileStack = [];
		// FileInfo
		this.currentFile = null;
	}

	/**
	 * Translates a ParsedPath into a string.
	 * Overridable.
	 */
	translateParsedPath(parsedPath) {
		if (parsedPath === null)
			return "(unknown file)";
		// By default, we know nothing.
		// see: parsePath, loader's definition
		let protocol = parsedPath[0].toString();
		if (parsedPath[0] === true) {
			protocol = "game";
		} else if (parsedPath[0] === false) {
			protocol = "mod";
		}
		return protocol + ":" + parsedPath[1];
	}

	/**
	 * Enters a file by parsedPath. Do not override.
	 * @final
	 */
	addFile(parsedPath) {
		const path = this.translateParsedPath(parsedPath);
		const fileInfo = {
			path,
			stack: []
		};
		this.currentFile = fileInfo;
		this.fileStack.push(fileInfo);
	}

	/**
	 * Removes a pushed file.
	 * @final
	 */
	removeLastFile() {
		const lastFile = this.fileStack.pop();
		this.currentFile = this.fileStack[this.fileStack.length - 1];
		return lastFile;
	}
	
	/**
	 * Enters a step. Note that calls to this *surround* applyStep as the index is not available to it.
	 * @final
	 */
	addStep(index, name = "") {
		this.currentFile.stack.push({
			type: "Step",
			index,
			name
		});
	}

	/**
	 * Leaves a step.
	 * @final
	 */
	removeLastStep() {
		const stack = this.currentFile.stack;
		let currentStep = null;
		for(let index = stack.length - 1; index >= 0; index--) {
			if (stack[index].type === "Step") {
				currentStep = stack[index];
				stack.splice(index,1);
				index = -1;
			}
		}
		return currentStep;
	}
	
	/**
	 * Gets the last (i.e. current) step.
	 * @final
	 */
	getLastStep() {
		const stack = this.currentFile.stack;
		let currentStep = null;
		for(let index = stack.length - 1; index >= 0; index--) {
			if (stack[index].type === "Step") {
				currentStep = stack[index];
				index = -1;
			}
		}
		return currentStep;
	}
	
	/**
	 * Throws this instance as an error.
	 * @final
	 */
	throwError(type, message) {
		this.currentFile.stack.push({
			type: "Error",
			errorType: type,
			errorMessage: message
		});
		throw this;
	}

	/**
	 * Prints information about a specific file on the stack.
	 * Overridable.
	 */
	printFileInfo(file) {
		console.log(`File %c${file.path}`, 'red');
		let message = '';
		const stack = file.stack;
		for(let i = stack.length - 1; i >= 0; i--) {
			const step = stack[i];
			switch (step.type) {
				case 'Error':
					message += `${step.errorType}: ${step.errorMessage}\n`;
					break;
				case 'Step':
					message += '\t\t\tat ';
					if (step.name) {
						message += `${step.name} `;
					}
					message += `(step: ${step.index})\n`;
					break;
				default:
					break;
			}
		}
		console.log(message);
	}
	
	/**
	 * Prints information about the whole stack.
	 * @final
	 */
	print() {
		for(let fileIndex = 0; fileIndex < this.fileStack.length; fileIndex++) {
			this.printFileInfo(this.fileStack[fileIndex]);
		}
	}

	/**
	 * Run at the start of applyStep; after the step has been entered formally, but before executing it.
	 * Overridable.
	 */
	async beforeStep() {
		
	}

	/**
	 * Run at the end of applyStep; after executing the step, but before leaving it formally.
	 * Overridable.
	 */
	async afterStep() {
		
	}
}

// Custom extensions are registered here.
// Their 'this' is the Step, they are passed the state, and they are expected to return a Promise.
// In practice this is done with async old-style functions.
export const appliers = {};

/*
 * @param {any} a The object to modify
 * @param {object|object[]} steps The patch, fresh from the JSON. Can be in legacy or Patch Steps format.
 * @param {(fromGame: boolean | string, path: string) => Promise<any>} loader The loading function.
 *  NOTE! IF CHANGING THIS, KEEP IN MIND DEBUGSTATE translatePath GETS ARGUMENTS ARRAY OF THIS.
 *  ALSO KEEP IN MIND THE parsePath FUNCTION!
 *  For fromGame: false this gets a file straight from the mod, such as "package.json".
 *  For fromGame: true this gets a file from the game, which is patched by the host if relevant.
 *  If the PatchSteps file passes a protocol that is not understood, then, and only then, will a string be passed (without the ":" at the end)
 *  In this case, fromGame is set to that string, instead.
 * @param [debugState] debugState The DebugState stack tracer.
 *  If not given, will be created. You need to pass your own instance of this to have proper filename tracking.
 * @return {Promise<void>} A Promise
 */
export async function patch(a, steps, loader, debugState) {
	if (!debugState) {
		debugState = new DebugState();
		debugState.addFile(null);
	}
	if (steps.constructor === Object) {
		// Standardized Mods specification
		for (let k in steps) {
			// Switched back to a literal translation in 1.0.2 to make it make sense with spec, it's more awkward but simpler.
			// ac2pic thought up the "check for truthy" regarding steps[k].constructor
			if (a[k] === void 0) {
				a[k] = steps[k]; // 1.
			} else if (steps[k] && (steps[k].constructor === Object)) {
				// steps[k] is Object, so this won't escape the Standardized Mods version of patching
				await patch(a[k], steps[k], loader, debugState); // 2.
			} else {
				a[k] = steps[k]; // 3.
			}
		}
		return;
	}
	const state = {
		currentValue: a,
		stack: [],
		cloneMap: new Map(),
		loader: loader,
		debugState: debugState,
		debug: false
	};
	for (let index = 0; index < steps.length; index++) {
		try {
			debugState.addStep(index);
			await applyStep(steps[index], state, debugState);
			debugState.removeLastStep();
		} catch(e) {
			debugState.print();
			if (e !== debugState) {
				console.error(e);
			}
			return;
		}
	}
}

async function applyStep(step, state) {
	await state.debugState.beforeStep();
	state.debugState.getLastStep().name = step["type"];
	if (!appliers[step["type"]]) {
		state.debugState.getLastStep().name = '';
		state.debugState.throwError('TypeError',`${step['type']} is not a valid type.`);
	}
	await appliers[step["type"]].call(step, state);
	await state.debugState.afterStep();
}

function replaceObjectProperty(object, key, keyword, value) {
	let oldValue = object[key];
	// It's more complex than we thought.
	if (!Array.isArray(keyword) && typeof keyword === "object") {
		// go through each and check if it matches anywhere.
		for(const property in keyword) {
			if (keyword[property]) {
				object[key] = oldValue.replace(new RegExp(keyword[property], "g"), value[property] || "");
				oldValue = object[key];
			}
		}
	} else {
		object[key] = oldValue.replace(new RegExp(keyword, "g"), value);
	}
}

/**
 * @param {object} obj The object to search and replace the values of
 * @param {RegExp| {[replacementId: string]: RegExp}} keyword The expression to match against
 * @param {String| {[replacementId]: string | number}} value The value the replace the match
 * @returns {void}
 * */
function valueInsertion(obj, keyword, value) {
	if (Array.isArray(obj)) {
		for (let index = 0; index < obj.length; index++) {
			const child = obj[index];
			if (typeof child  === "string") {
				replaceObjectProperty(obj, index, keyword, value);
			} else if (typeof child === "object") {
				valueInsertion(child, keyword, value);
			}
		}
	} else if (typeof obj === "object") {
		for(let key in obj) {
			if (!obj[key])
				continue;
			if (typeof obj[key] === "string") {
				replaceObjectProperty(obj, key, keyword, value);
			} else {
				valueInsertion(obj[key], keyword, value);
			}
		}
	}
}

// -- Step Execution --

appliers["FOR_IN"] = async function (state) {
	const body = this["body"];
	const values = this["values"];
	const keyword = this["keyword"];

	if (!Array.isArray(body)) {
		state.debugState.throwError('ValueError', 'body must be an array.');
	}

	if (!values) {
		state.debugState.throwError('ValueError', 'values must be set.');
	}

	if (!keyword) {
		state.debugState.throwError('ValueError', 'keyword must be set.');
	}

	for(let i = 0; i < values.length; i++) {
		const cloneBody = photocopy(body);
		const value = values[i];
		valueInsertion(cloneBody, keyword, value);
		state.debugState.addStep(i, 'VALUE_INDEX');
		for (let index = 0; index < cloneBody.length; index++) {
			const statement = cloneBody[index];
			const type = statement["type"];
			state.debugState.addStep(index, type);
			await applyStep(statement, state);
			state.debugState.removeLastStep();
		}
		state.debugState.removeLastStep();
	}
};

// copy the value with name
appliers["COPY"] = async function(state) {
	if (!("alias" in this)) {
		state.debugState.throwError('ValueError', 'alias must be set.');
	}
	const value = photocopy(state.currentValue);
	state.cloneMap.set(this["alias"], value);
};

// paste
appliers["PASTE"] = async function(state) {
	if (!("alias" in this)) {
		state.debugState.throwError('ValueError', 'alias must be set.');
	}
	// Add into spec later?
	//if (!state.cloneMap.has(this["alias"])) {
	//	state.debugState.throwError('ValueError', 'the alias is not available');
	//}
	const value = photocopy(state.cloneMap.get(this["alias"]));
	if (Array.isArray(state.currentValue)) {
		const obj = {
			type: "ADD_ARRAY_ELEMENT",
			content: value
		};
		
		if (!isNaN(this["index"])) {
			obj.index = this["index"];
		}
		await applyStep(obj, state);
	} else if (typeof state.currentValue === "object") {
		await applyStep({
			type: "SET_KEY",
			index: this["index"],
			content: value
		}, state);
	} else {
		state.debugState.throwError('TypeError', `Type ${typeof state.currentValue} is not supported.`);
	}
};


appliers["COMMENT"] = async function(state) {
	if (state.debug) {
		console.log(this["value"]);
	}
};

appliers["ENTER"] = async function (state) {
	if (!("index" in this)) {
		state.debugState.throwError('Error', 'index must be set.');
	}

	let path = [this["index"]];
	if (this["index"].constructor == Array)
		path = this["index"];
	for (let i = 0; i < path.length;i++) {
		const idx = path[i];
		state.stack.push(state.currentValue);
		if (state.currentValue[idx] === undefined) {
			const subArr = path.slice(0, i + 1);
			state.debugState.throwError('Error', `index sequence ${subArr.join(",")} leads to an undefined state.`);
		}
		
		state.currentValue = state.currentValue[idx];
	}
};

appliers["EXIT"] = async function (state) {
	let count = 1;
	if ("count" in this)
		count = this["count"];
	for (let i = 0; i < count; i++) {
		if (state.stack.length === 0) {
			state.debugState.throwError('Error', `EXIT #${count + 1} leads to an undefined state.`);
		}
		state.currentValue = state.stack.pop();
	}
};

appliers["SET_KEY"] = async function (state) {
	if (!("index" in this)) {
		state.debugState.throwError('Error', 'index must be set.');
	}

	if ("content" in this) {
		state.currentValue[this["index"]] = photocopy(this["content"]);
	} else {
		delete state.currentValue[this["index"]];
	}
};

appliers["REMOVE_ARRAY_ELEMENT"] = async function (state) {
	state.currentValue.splice(this["index"], 1);
};

appliers["ADD_ARRAY_ELEMENT"] = async function (state) {
	if ("index" in this) {
		state.currentValue.splice(this["index"], 0, photocopy(this["content"]));
	} else {
		state.currentValue.push(photocopy(this["content"]));
	}
};

// Reintroduced but simplified version of Emileyah's resolveUrl
function parsePath(url, fromGame) {
	try {
		const decomposedUrl = new URL(url);
		const protocol = decomposedUrl.protocol;

		const subUrl = decomposedUrl.pathname;

		let urlFromGame;
		if (protocol === 'mod:') {
			urlFromGame = false;
		} else if (protocol === 'game:') {
			urlFromGame = true;
		} else {
			urlFromGame = protocol.substring(0, protocol.length - 1);
		}
		return [
			urlFromGame,
			subUrl
		];
	} catch (e) {
		return [
			fromGame,
			url
		];
	}
}

appliers["IMPORT"] = async function (state) {
	if (!("src" in this)) {
		state.debugState.throwError('ValueError', 'src must be set.');
	}

	const srcPath = parsePath(this["src"], true);
	let obj = await state.loader.apply(state, srcPath);

	if ("path" in this) {
		if (!Array.isArray(this["path"])) {
			state.debugState.throwError('ValueError', 'path must be an array.');
		}
		for (let i = 0; i < this["path"].length; i++)
			obj = obj[this["path"][i]];
	}

	if ("index" in this) {
		state.currentValue[this["index"]] = photocopy(obj);
	} else {
		photomerge(state.currentValue, obj);
	}
};

appliers["INCLUDE"] = async function (state) {
	if (!("src" in this)) {
		state.debugState.throwError('ValueError', 'src must be set.');
	}

	const srcPath = parsePath(this["src"], false);
	const data = await state.loader.apply(state, srcPath);

	state.debugState.addFile(srcPath);
	await patch(state.currentValue, data, state.loader, state.debugState);
	state.debugState.removeLastFile();
};

appliers["INIT_KEY"] = async function (state) {
	if (!("index" in this)) {
		state.debugState.throwError('ValueError', 'index must be set.');
	}

	if (!(this["index"] in state.currentValue))
		state.currentValue[this["index"]] = photocopy(this["content"]);
};

appliers["DEBUG"] = async function (state) {
	state.debug = !!this["value"];
};

