export default class ErrorDisplayHandler {
	
	constructor() {
		this.fileStack = [];
		this.currentFile = null;
	}
	
	
	addFile(path) {
		const fileInfo = {
			path,
			stack: []
		};
		this.currentFile = fileInfo;
		this.fileStack.push(fileInfo);
	}
	removeLastFile() {
		const lastFile = this.fileStack.pop();
		this.currentFile = this.fileStack[this.fileStack.length - 1];
		return lastFile;
	}
	
	addStep(index, name = "") {
		this.currentFile.stack.push({
			type: "Step",
			index,
			name
		});
	}
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
	
	throwError(type, message) {
		this.currentFile.stack.push({
			type: "Error",
			errorType: type,
			errorMessage: message
		});
		throw this;
	}

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
				case 'Step': {
					message += '\t\t\tat ';
					if (step.name) {
						message += `${step.name} `; 
					}
					message += `(step: ${step.index})\n`;
				}
				break;
				default:
				break;
			}
		}	
		console.log(message);	
	}
	
	print() {
		for(let fileIndex = 0; fileIndex < this.fileStack.length; fileIndex++) {
			this.printFileInfo(this.fileStack[fileIndex]);
		}
	}
}

