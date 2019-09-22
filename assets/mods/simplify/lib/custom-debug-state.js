import {DebugState} from './patch-steps-es6.js';

export default class CustomDebugState extends DebugState {
	setPatch(currentPatch) {
		this.currentPatch = currentPatch;
	}

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