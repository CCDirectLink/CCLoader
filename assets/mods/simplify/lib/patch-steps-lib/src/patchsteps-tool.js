#!/usr/bin/env node
/*
 * Patch Steps Tool
 * Written starting in 2019 by 20kdc
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */

import fs from "fs";
import process from "process";
import * as patchStepsLib from "./patchsteps.js";
import {Console} from "console";
import tests from "../src/tests.json";

let console = new Console(process.stdout, process.stderr, false);

class Command {
	constructor(jsonInputs, flags, helpLines) {
		this.jsonInputs = jsonInputs;
		this.flags = flags;
		this.helpLines = helpLines;
	}
	async run(jsonObjects, flags) {
		
	}
}

// Tests
async function test(name, fn, expected) {
	console.log("Test " + name);
	let result = await fn();
	if ((result === void 0) || (result === null)) {
		console.log(" FAILURE: Function returned " + result + ".");
		process.exit(1);
	}
	let diff = patchStepsLib.diff(expected, result);
	if (diff.length > 0) {
		console.log(" FAILURE:");
		console.log(" EXPECTED:");
		console.log(JSON.stringify(expected, null, "\t"));
		console.log(" RESULT:");
		console.log(JSON.stringify(result, null, "\t"));
		console.log(" DIFF:");
		console.log(JSON.stringify(diff, null, "\t"));
		process.exit(1);
	}
	if (JSON.stringify(result).length != JSON.stringify(expected).length) {
		console.log(" COMPLEX FAILURE (DIFF FAILURE?):");
		console.log(JSON.stringify(result, null, "\t"));
		console.log(" ----");
		console.log(JSON.stringify(expected, null, "\t"));
		console.log("Testing system fried, battered and waiting to be served with chips; halting immediately");
		process.exit(1);
	}
	console.log(" PASSED");
	console.log("");
}

// Test runners are executed with this === the test object.
const testRunners = {
	// A "simple" test confirms that diffing a given value to another value and executing the patch provides:
	// 1. The expected result
	// 2. The expected instructions
	"simple": async function () {
		// Useful to have this one first so it outputs the instructions when things go wrong
		if (this["instructions"] === "generate") {
			// Used to human-check when writing the tests.
			const diff = patchStepsLib.diff(patchStepsLib.photocopy(this["a"]), patchStepsLib.photocopy(this["b"]));
			console.log(JSON.stringify(diff, null, "\t"));
		} else if (this["instructions"]) {
			await test(this["name"] + " instructions", async () => {
				return patchStepsLib.diff(patchStepsLib.photocopy(this["a"]), patchStepsLib.photocopy(this["b"]));
			}, this["instructions"]);
		}

		await test(this["name"] + " body", async () => {
			const diff = patchStepsLib.diff(patchStepsLib.photocopy(this["a"]), patchStepsLib.photocopy(this["b"]));
			const patchedVal = patchStepsLib.photocopy(this["a"]);
			await patchStepsLib.patch(patchedVal, diff);
			return patchedVal;
		}, this["b"]);
	},
	// An "execute" test tests the patch function. It checks that "a" patched with "patch" results in "b".
	"execute": async function () {
		let loader = async (fromGame, path) => {
			// This uses a nonsense-world version of the interface to try and make sure compatibility is OK.
			return this[fromGame + ":" + path];
		};
		if (this["b"] === "generate") {
			const patchedVal = patchStepsLib.photocopy(this["a"]);
			await patchStepsLib.patch(patchedVal, this["patch"], loader);
			console.log(JSON.stringify(patchedVal, null, "\t"));
		} else {
			await test(this["name"], async () => {
				const patchedVal = patchStepsLib.photocopy(this["a"]);
				await patchStepsLib.patch(patchedVal, this["patch"], loader);
				return patchedVal;
			}, this["b"]);
		}
	}
};

function formatted(result, flags) {
	if (flags.indexOf("-f") != -1) {
		console.log(JSON.stringify(result, null, "\t"));
	} else {
		console.log(JSON.stringify(result));
	}
}

// Commands
const commands = {
	"diff": new (class DiffCommand extends Command {
		constructor() {
			super(["from", "to"], ["-c", "-f"], [
				"Writes a diff.",
				"-c adds comments labelling the path at which the step was written. (ENTER/EXIT steps do not include their own index.)",
				"-f formats the JSON with tabs.",
				"-o redirects the output to a file."
			]);
		}
		async run(jsonObjects, flags) {
			const settings = {};
			if (flags.indexOf("-c") != -1)
				settings.comment = "";
			const result = patchStepsLib.diff(jsonObjects[0], jsonObjects[1], settings);
			formatted(result, flags);
		}
	})(),
	"patch": new (class PatchCommand extends Command {
		constructor() {
			super(["from", "patch"], ["-d", "-s"], [
				"Applies a patch.",
				"-d enables debugging. This is reserved; it MAY be interactive at any point in future but presently isn't.",
				"-s enables 'secure mode'; IMPORT and INCLUDE directives fail.",
				"Do be aware that even in secure mode, a JSON file or JSON patch can still exhaust system memory.",
				"(This cannot be detected via file size comparisons, either.)",
				"-f formats the JSON with tabs."
			]);
		}
		async run(jsonObjects, flags) {
			let debugState;
			if (flags.indexOf("-d") != -1) {
				debugState = new (class ToolDebugger extends patchStepsLib.DebugState {
					// Might be interactive one day.
					async beforeStep() {
						console.log("-- BEFORE STEP --");
						this.print();
					}
					async afterStep() {
						console.log("-- AFTER STEP --");
					}
				})();
				debugState.addFile(null);
			}
			await patchStepsLib.patch(jsonObjects[0], jsonObjects[1], async (fromGame, path) => {
				// ignore protocol, we're emulating
				if (flags.indexOf("-s") != -1)
					throw new Error("secure mode active");
				return JSON.parse(fs.readFileSync(path, "utf8"));
			}, debugState);
			formatted(jsonObjects[0], flags);
		}
	})(),
	"post": new (class POSTCommand extends Command {
		constructor() {
			super([], [], [
				"Performs the power-on-self-test (used for npm run test before publish)"
			]);
		}
		async run(jsonObjects, flags) {
			console.log("patch-steps-lib " + patchStepsLib.version + " powering on...");
			console.log("");
			for (let testVal of tests)
				await testRunners[testVal["type"]].call(testVal);
			console.log("Tests complete.");
		}
	})(),
	"help": new (class HelpCommand extends Command {
		constructor() {
			super([], [], [
				"Shows a manual for the command."
			]);
		}
		async run(jsonObjects, flags) {
			console.log("patch-steps-lib " + patchStepsLib.version);
			console.log("");
			console.log("NAME");
			console.log("\tpatchsteps-tool - tool for working with C2DL PatchSteps files");
			console.log("");
			console.log("SYNOPSIS");
			console.log("\tpatchsteps-tool _command_ [ args... ] [ -o _OUTFILE_ ]");
			console.log("");
			console.log("DESCRIPTION");
			console.log("\tPatch Steps is a patch format developed by CCDirectLink (unofficial modding community around CrossCode) for JSON files.");
			console.log("\tpatch-steps-lib is the library written to handle these files.");
			console.log("\t(For compatibility reasons, it can apply, but not generate, the older JSON patch files used by CCLoader.)");
			console.log("");
			console.log("SUBCOMMANDS");
			for (let command in commands) {
				let postfix = "";
				for (let input of commands[command].jsonInputs)
					postfix += " _" + input + "_"
				for (let input of commands[command].flags)
					postfix += " [ " + input + " ]"
				console.log("\tpatchsteps-tool " + command + postfix + " [ -o _OUTFILE_ ]");
				for (let line of commands[command].helpLines)
					console.log("\t\t" + line);
				console.log("");
			}
			console.log("AUTHORS");
			console.log("\tpatchsteps-tool is part of patch-steps-lib.");
			console.log("\tFor details, please see the AUTHORS file included with your copy of the program.");
		}
	})()
};

// The command parser begins!

const cmd = commands[process.argv[2]] || commands["help"];

let jsonObjects = [];
let flags = [];
let inputFlagActive = false;
let outputFlagActive = false;
for (let i = 3; i < process.argv.length; i++) {
	if (!inputFlagActive) {
		if (outputFlagActive) {
			console = new Console(fs.createWriteStream(process.argv[i]), process.stderr, false);
			outputFlagActive = false;
			continue;
		} else if (process.argv[i] == "-i") {
			inputFlagActive = true;
			continue;
		} else if (process.argv[i] == "-o") {
			outputFlagActive = true;
			continue;
		} else if (cmd.flags.indexOf(process.argv[i]) != -1) {
			flags.push(process.argv[i]);
			continue;
		}
	}
	inputFlagActive = false;
	jsonObjects.push(JSON.parse(fs.readFileSync(process.argv[i], "utf8")));
}
if (inputFlagActive || outputFlagActive)
	throw new Error("Unterminated IO flag");

if (jsonObjects.length != cmd.jsonInputs.length)
	throw new Error("Command expected " + cmd.jsonInputs.length + " inputs, got " + jsonObjects.length);

// Run it.
(async () => {
	try {
		await cmd.run(jsonObjects, flags);
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
})();
