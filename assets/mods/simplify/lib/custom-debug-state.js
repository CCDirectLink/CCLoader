import {DebugState} from './patch-steps-es6.js';

export default class CustomDebugState extends DebugState {
	/**
	 * Sets current patch for context url resolving
	 * @param {{mod: Mod, path: string}} currentPatch 
	 */
	setPatch(currentPatch) {
		this.currentPatch = currentPatch;
	}

	/**
	 * Prints current context file stack.
	 * @param {{path: string, stack: string[]}} file
	 *  
	 */
	printFileInfo(file) {
		// resolve the urls
		let [protocol, path] = file.path.split(":");
		const newFile = Object.assign({},file);
		debugger;
		if (protocol === "mod") {
			newFile.path = this.currentPatch.mod.baseDirectory + path;
		} else if (protocol === "game") {
			newFile.path = 'assets/' + path;
		}
		super.printFileInfo(newFile);
	}
}