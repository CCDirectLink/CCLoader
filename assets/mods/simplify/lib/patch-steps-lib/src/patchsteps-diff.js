/*
 * patch-steps-lib - Library for the Patch Steps spec.
 *
 * Written starting in 2019.

 * Credits:
 *  Main code by 20kdc
 *  URL-style file paths, FOR_IN, COPY, PASTE, error tracking, bughunting by ac2pic
 *  Even more bughunting by ac2pic
 *
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */

import {photocopy, photomerge} from "./patchsteps-utils.js";

/**
 * A difference heuristic.
 * @param {any} a The first value to check.
 * @param {any} b The second value to check.
 * @param {any} settings The involved control settings.
 * @returns {number} A difference value from 0 (same) to 1 (different).
 */
function diffHeuristic(a, b, settings) {
	if ((a === null) && (b === null))
		return 0;
	if ((a === null) || (b === null))
		return null;
	if (a.constructor !== b.constructor)
		return 1;

	if (a.constructor === Array) {
		let array = diffArrayHeuristic(a, b, settings);
		if (array.length == 0)
			return 0;
		let changes = 0;
		let ai = 0;
		let bi = 0;
		for (let i = 0; i < array.length; i++) {
			if (array[i] == "POPA") {
				changes++;
				ai++;
			} else if (array[i] == "INSERT") {
				// Doesn't count
				bi++;
			} else if (array[i] == "PATCH") {
				changes += diffHeuristic(a[ai], b[bi], settings);
				ai++;
				bi++;
			}
		}
		return changes / array.length;
	} else if (a.constructor === Object) {
		let total = [];
		for (let k in a)
			total.push(k);
		for (let k in b)
			if (!(k in a))
				total.push(k);
		let change = 0;
		for (let i = 0; i < total.length; i++) {
			if ((total[i] in a) && !(total[i] in b)) {
				change += settings.diffAddNewKey;
			} else if ((total[i] in b) && !(total[i] in a)) {
				change += settings.diffAddDelKey;
			} else {
				change += diffHeuristic(a[total[i]], b[total[i]], settings) * settings.diffMulSameKey;
			}
		}
		if (total.length != 0)
			return change / total.length;
		return 0;
	} else {
		return a == b ? 0 : 1;
	}
}

/*
 * This is the array heuristic. It's read by the main heuristic and the diff heuristic.
 * The results are a series of operations on an abstract machine building the new array.
 * These results are guaranteed to produce correct results, but aren't guaranteed to produce optimal results.
 * The abstract machine has two input stacks (for a/b), first element at the top.
 * The operations are:
 * "POPA": Pops an element from A, discarding it.
 * "INSERT": Pops an element from B, copying and inserting it verbatim.
 * "PATCH": Pops an element from both A & B, creating a patch from A to B.
 * Valid output from this must always exhaust the A and B stacks and must not stack underflow.
 * Programs that follow that will always generate valid output, as the only way to exhaust the B stack
 *  is to use INSERT and PATCH, both of which output to the resulting array.
 *
 * The actual implementation is different to this description, but follows the same rules.
 * Stack A and the output are the same.
 */
function diffArrayHeuristic(a, b, settings) {
	const lookahead = settings.arrayLookahead;
	let sublog = [];
	let ia = 0;
	for (let i = 0; i < b.length; i++) {
		let validDif = 2;
		let validSrc = null;
		for (let j = ia; j < Math.min(ia + lookahead, a.length); j++) {
			let dif = diffHeuristic(a[j], b[i], settings);
			if (dif < validDif) {
				validDif = dif;
				validSrc = j;
			}
		}
		if (validDif > settings.arrayTrulyDifferentThreshold)
			validSrc = null;
		if (validSrc != null) {
			while (ia < validSrc) {
				sublog.push("POPA");
				ia++;
			}
			sublog.push("PATCH");
			ia++;
		} else {
			if (ia == a.length) {
				sublog.push("INSERT");
			} else {
				sublog.push("PATCH");
				ia++;
			}
		}
	}
	while (ia < a.length) {
		sublog.push("POPA");
		ia++;
	}
	return sublog;
}

/**
 * Diffs two objects. This is actually an outer wrapper, which provides default settings along with optimization.
 * 
 * @param {any} a The original value
 * @param {any} b The target value
 * @param {object} [settings] Optional bunch of settings. May include "comment".
 * @return {object[]|null} Null if unpatchable (this'll never occur for two Objects or two Arrays), Array of JSON-ready Patch Steps otherwise
 */
export function diff(a, b, settings) {
	let trueSettings = photocopy(defaultSettings);
	if (settings !== void 0)
		photomerge(trueSettings, settings);
	if (trueSettings.comment !== void 0)
		trueSettings.commentValue = trueSettings.comment;

	let result = trueSettings.diffCore(a, b, trueSettings);
	if (trueSettings.optimize) {
		for (let i = 1; i < result.length; i++) {
			let here = result[i];
			let prev = result[i - 1];
			let optimizedOut = false;
			if (here["type"] == "EXIT") {
				if (prev["type"] == "EXIT") {
					// Crush EXITs
					if (!("count" in here))
						here["count"] = 1;
					if (!("count" in prev))
						prev["count"] = 1;
					prev["count"] += here["count"];
					// Copy comments backwards to try and preserve the unoptimized autocommenter semantics
					if ("comment" in here)
						prev["comment"] = here["comment"];
					optimizedOut = true;
				}
			} else if (here["type"] == "ENTER") {
				if (prev["type"] == "ENTER") {
					// Crush ENTERs
					if (prev["index"].constructor !== Array)
						prev["index"] = [prev["index"]];
					if (here["index"].constructor !== Array)
						here["index"] = [here["index"]];
					prev["index"] = prev["index"].concat(here["index"]);
					optimizedOut = true;
				}
			}
			if (optimizedOut) {
				result.splice(i, 1);
				i--;
			}
		}
	}
	return result;
}

/**
 * Adds a comment to the step if there is a comment in settings.commentValue.
 * @param {object} step The step to add to.
 * @param {object} settings The settings.
 */
export function diffApplyComment(step, settings) {
	if (settings.commentValue !== void 0)
		step.comment = settings.commentValue;
	return step;
}

/**
 * Handles the bookkeeping in settings necessary when entering a level of the diff.
 * @param {any} a The original value
 * @param {any} b The target value
 * @param {string | number} index The index.
 * @param {object} settings Settings.
 * @return {object[]|null} See diff for more details
 */
export function diffEnterLevel(a, b, index, settings) {
	settings.path.push(index);
	if (settings.comment !== void 0)
		settings.commentValue = settings.comment + "." + settings.path.join(".");
	let log = settings.diffCore(a, b, settings);
	settings.path.pop();
	return log;
}

// This is the default diffCore.
function diffInterior(a, b, settings) {
	if ((a === null) && (b === null))
		return [];
	if ((a === null) || (b === null))
		return null;
	if (a.constructor !== b.constructor)
		return null;
	let log = [];

	if (a.constructor === Array) {
		let array = diffArrayHeuristic(a, b, settings);
		let ai = 0;
		let bi = 0;
		// Advancing ai/bi pops from the respective stack.
		// Since outputting an element always involves popping from B,
		//  and vice versa, the 'b' stack position is also the live array position.
		// At patch time, a[ai + x] for arbitrary 'x' is in the live array at [bi + x]
		for (let i = 0; i < array.length; i++) {
			if (array[i] == "POPA") {
				log.push(diffApplyComment({"type": "REMOVE_ARRAY_ELEMENT", "index": bi}, settings));
				ai++;
			} else if (array[i] == "INSERT") {
				let insertion = diffApplyComment({"type": "ADD_ARRAY_ELEMENT", "index": bi, "content": photocopy(b[bi])}, settings);
				// Is this a set of elements being inserted at the end?
				let j;
				for (j = i + 1; j < array.length; j++)
					if ((array[j] != "INSERT") && (array[j] != "POPA"))
						break;
				// If it is a set of elements being inserted at the end, they are appended
				if (j == array.length)
					delete insertion["index"];
				log.push(insertion);
				bi++;
			} else if (array[i] == "PATCH") {
				let xd = diffEnterLevel(a[ai], b[bi], bi, settings);
				if (xd != null) {
					if (xd.length != 0) {
						log.push({"type": "ENTER", "index": bi});
						log = log.concat(xd);
						log.push({"type": "EXIT"});
					}
				} else {
					log.push(diffApplyComment({"type": "SET_KEY", "index": bi, "content": photocopy(b[bi])}, settings));
				}
				ai++;
				bi++;
			}
		}
	} else if (a.constructor === Object) {
		for (let k in a) {
			if (k in b) {
				if (diffHeuristic(a[k], b[k], settings) >= settings.trulyDifferentThreshold) {
					log.push(diffApplyComment({"type": "SET_KEY", "index": k, "content": photocopy(b[k])}, settings));
				} else {
					let xd = diffEnterLevel(a[k], b[k], k, settings);
					if (xd != null) {
						if (xd.length != 0) {
							log.push({"type": "ENTER", "index": k});
							log = log.concat(xd);
							log.push({"type": "EXIT"});
						}
					} else {
						// should it happen? probably not. will it happen? maybe
						log.push(diffApplyComment({"type": "SET_KEY", "index": k, "content": photocopy(b[k])}, settings));
					}
				}
			} else {
				log.push(diffApplyComment({"type": "SET_KEY", "index": k}, settings));
			}
		}
		for (let k in b)
			if (!(k in a))
				log.push(diffApplyComment({"type": "SET_KEY", "index": k, "content": photocopy(b[k])}, settings));
	} else if (a != b) {
		return null;
	}
	return log;
}

/**
 * A set of default settings to diff.
 */
export const defaultSettings = {
	// A set of heuristic scoring numbers.
	arrayTrulyDifferentThreshold: 0.5,
	trulyDifferentThreshold: 0.5,
	arrayLookahead: 8,
	diffAddNewKey: 0,
	diffAddDelKey: 1,
	diffMulSameKey: 0.75,

	// The "diff core function". Takes (a, b, settings). Returns null for invalid, or a Patch Steps patch otherwise. Given valid JSON in (no arrays as keys, for example), all step arrays & objects must be unique and they cannot be self-referential.
	// Replacing this, combined with correct usage of the 'path' setting, allows you to add your own heuristics.
	diffCore: diffInterior,
	// If all steps should be commented with the path, a string should be placed here for a prefix.
	comment: undefined,
	// The current value of comment.
	commentValue: undefined,
	// The index path in the original object (A) leading to the object being diffed.
	path: [],
	// If the diff should be optimized to reduce the instruction count.
	optimize: true
};

