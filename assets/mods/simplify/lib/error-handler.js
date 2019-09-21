export default class ErrorHandler {
	
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
	
	addLine(line, name = "") {
		this.currentFile.stack.push({
			type: "Line",
			line,
			name
		});
	}
	removeLastLine() {
		return this.currentFile.stack.pop();
	}
	
	getLastLine() {
		const stack = this.currentFile.stack;
		return stack[stack.length - 1];
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
			const line = stack[i];
			switch (line.type) {
				case 'Error':
					message += `${line.errorType}: ${line.errorMessage}\n`;
				break;
				case 'Line': {
					if (line.name) {
						message += `\t\t\tat ${line.name} (step: ${line.line})\n`;
					} else {
						message += `\t\t\tat (step: ${line.line})\n`;
					}
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

