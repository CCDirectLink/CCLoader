import {appliers, DebugState} from "./patchsteps-patch.js";

/**
 * @typedef State
 * @property {unknown} currentValue
 * @property {unknown[]} stack
 * @property {(fromGame: boolean| string, path: string) => Promise<any>}
 * @property {DebugState} debugState
 * @property {boolean} debug
 * /

/**
 * A user defined step that is distinguishable from builtin PatchSteps.
 * Errors that occur in callables are not handled by the PatchSteps interpreter.
 *
 * @async 
 * @callback Callable
 * @param {State} state is the internal PatchStep state.
 * @param {unknown} args is the user supplied arguments.
 */

/* @type {Map<string,Callable>} */
const callables = new Map;

/**
 * @param {string} id
 * @param {Callable} callable
 */
export function register(id, callable) {
	if (typeof id !== "string") {
		throw Error('Id must be a string');
	}

	if (id.length === 0) {
		throw Error('Id must not be empty.');
	}

	if (typeof callable !== "function") {
		throw Error('Callable must be a function.');
	}
	if (callables.has(id)) {
		throw Error(`Callable ${id} is already registered.`);
	}
	callables.set(id, callable);
}

appliers["CALL"] = async function(state) {
	const id = this["id"];
	const args = this["args"];

	// Any falsey values are invalid
	if (!id) {
		state.debugState.throwError('ValueError', 'Id must be set.');
	}

	if (!callables.has(id)) {
		state.debugState.throwError('ValueError', `${id} is not a valid callable.`);
	}

	/** @type{Callable} **/
	const callable = callables.get(id);

	try {
		await callable(state, args);
	} catch (e) {
		if (e !== state.debugState) {
			// So they know what happened
			console.error(e);
			state.debugState.throwError('ValueError', `Callable ${i} did not properly throw an error.`);
		}
		// They properly threw the error
		throw e;
	}
}

