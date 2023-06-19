export class StepMachine {
	constructor(steps) {
		this.steps = steps;
		this.si = 0;
		this.finished = false;
	}

	* run() {
		while (this.si < this.steps.length) {
			yield [this.si, this.steps[this.si]];
			if (this.finished) {
				break;
			}
			this.si++;
		}
	}
	
	addSteps(newSteps) {
		if (Array.isArray(newSteps)) {
			this.steps = this.steps.concat(newSteps);
		} else {
			this.steps.push(newSteps);
		}
	}

	exit() {
		this.finished = true;
	}

	gotoLabel(labelName) {
		const labelIndex = this.findLabelIndex(labelName);
		if (labelIndex == -1) {
			return false;
		}
		this.setStepIndex(labelIndex);
		return true;	
	}

	setStepIndex(newStepIndex) {
		if(newStepIndex < 0 || this.steps.length <= newStepIndex) {
			return false;
		}
		this.si = newStepIndex;
		return true;
	}
	
	getCurrentStep() {
		return this.steps[this.si];
	}

	getStepIndex() {
		return this.si;
	}
	
	findLabelIndex(labelName) {
		let stepIndex = -1;

		for(const [index, step] of this.steps.entries())  {
			if (step["type"] !== "LABEL") {
				continue;
			}
			if (step["name"] == labelName) {
				stepIndex = index;
				break;
			}
		}

		return stepIndex;
	}
}

