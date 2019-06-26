/*
 * patch-steps-lib - Library for the Patch Steps spec.
 * Written starting in 2019 by 20kdc
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */

export const defaultSettings = {
	arrayTrulyDifferentThreshold: 0.5,
	trulyDifferentThreshold: 0.5,
	arrayLookahead: 8,
	diffAddNewKey: 0,
	diffAddDelKey: 1,
	diffMulSameKey: 0.75
};

export function photomerge(a, b) {
	if (b.constructor === Object) {
		for (var k in b)
			a[photocopy(k)] = photocopy(b[k]);
	} else if (b.constructor == Array) {
		for (var i = 0; i < b.length; i++)
			a.push(photocopy(b[i]));
	} else {
		throw new Error("We can't do that! ...Who'd clean up the mess?");
	}
	return a;
}

export function photocopy(o) {
	if (o === void 0)
		return o;
	if (o.constructor === Array)
		return photomerge([], o);
	if (o.constructor === Object)
		return photomerge({}, o);
	return o;
}

// 0: The same. 1: Different.
export function diffHeuristic(a, b, settings) {
	if ((a === null) && (b === null))
		return 0;
	if ((a === null) || (b === null))
		return null;
	if (a.constructor !== b.constructor)
		return 1;

	if (a.constructor === Array) {
		var array = diffArrayHeuristic(a, b, settings);
		if (array.length == 0)
			return 0;
		var changes = 0;
		var ai = 0;
		var bi = 0;
		for (var i = 0; i < array.length; i++) {
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
		var total = [];
		for (var k in a)
			total.push(k);
		for (var k in b)
			if (!(k in a))
				total.push(k);
		var change = 0;
		for (var i = 0; i < total.length; i++) {
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
export function diffArrayHeuristic(a, b, settings) {
	const lookahead = settings.arrayLookahead;
	var sublog = [];
	var ia = 0;
	for (var i = 0; i < b.length; i++) {
		var validDif = 2;
		var validSrc = null;
		for (var j = ia; j < Math.min(ia + lookahead, a.length); j++) {
			var dif = diffHeuristic(a[j], b[i], settings);
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

/*
 * Diffs two objects
 * 
 * @param {*} a The original value
 * @param {*} b The target value
 * @param {*} [settings] Optional bunch of settings. May include "comment".
 * @return {*} Null if unpatchable (this'll never occur for an Object or Array), Array of JSON-ready Patch Steps otherwise
 */
export function diff(a, b, settings) {
	var trueSettings = photocopy(defaultSettings);
	if (settings !== void 0)
		photomerge(trueSettings, settings);
	return diffInterior(a, b, trueSettings);
}

export function diffCommentExpansion(a, b, element, settings) {
	var bkcomment = settings.comment;
	if (settings.comment !== void 0)
		settings.comment = settings.comment + "." + element;
	var log = diffInterior(a, b, settings);
	settings.comment = bkcomment;
	return log;
}

export function diffInterior(a, b, settings) {
	if ((a === null) && (b === null))
		return [];
	if ((a === null) || (b === null))
		return null;
	if (a.constructor !== b.constructor)
		return null;
	var log = [];

	if (a.constructor === Array) {
		var array = diffArrayHeuristic(a, b, settings);
		var ai = 0;
		var bi = 0;
		// Advancing ai/bi pops from the respective stack.
		// Since outputting an element always involves popping from B,
		//  and vice versa, the 'b' stack position is also the live array position.
		// At patch time, a[ai + x] for arbitrary 'x' is in the live array at [bi + x]
		for (var i = 0; i < array.length; i++) {
			if (array[i] == "POPA") {
				log.push({"type": "REMOVE_ARRAY_ELEMENT", "index": bi, "comment": settings.comment});
				ai++;
			} else if (array[i] == "INSERT") {
				var insertion = {"type": "ADD_ARRAY_ELEMENT", "index": bi, "content": photocopy(b[bi]), "comment": settings.comment};
				// Is this a set of elements being inserted at the end?
				var j;
				for (j = i + 1; j < array.length; j++)
					if (array[i] != "INSERT")
						break;
				// If it is a set of elements being inserted at the end, they are appended
				if (j == array.length)
					delete insertion["index"];
				log.push(insertion);
				bi++;
			} else if (array[i] == "PATCH") {
				var xd = diffCommentExpansion(a[ai], b[bi], bi, settings);
				if (xd != null) {
					if (xd.length != 0) {
						log.push({"type": "ENTER", "index": bi});
						log = log.concat(xd);
						log.push({"type": "EXIT"});
					}
				} else {
					log.push({"type": "SET_KEY", "index": bi, "content": photocopy(b[bi]), "comment": settings.comment});
				}
				ai++;
				bi++;
			}
		}
	} else if (a.constructor === Object) {
		for (var k in a) {
			if (k in b) {
				if (diffHeuristic(a[k], b[k], settings) >= settings.trulyDifferentThreshold) {
					log.push({"type": "SET_KEY", "index": k, "content": photocopy(b[k]), "comment": settings.comment});
				} else {
					var xd = diffCommentExpansion(a[k], b[k], k, settings);
					if (xd != null) {
						if (xd.length != 0) {
							log.push({"type": "ENTER", "index": k});
							log = log.concat(xd);
							log.push({"type": "EXIT"});
						}
					} else {
						// should it happen? probably not. will it happen? maybe
						log.push({"type": "SET_KEY", "index": k, "content": photocopy(b[k]), "comment": settings.comment});
					}
				}
			} else {
				log.push({"type": "SET_KEY", "index": k, "comment": settings.comment});
			}
		}
		for (var k in b)
			if (!(k in a))
				log.push({"type": "SET_KEY", "index": k, "content": photocopy(b[k]), "comment": settings.comment});
	} else if (a != b) {
		return null;
	}
	return log;
}

// Custom extensions are registered here.
// They are passed the state, and call state.advance() or state.failure() depending on how well it goes.
export const appliers = {};

/*
 * a: The object to modify
 * steps: The array of steps, fresh from the JSON
 * 'loader' has the signature:
 * loader(imp, impurl, success(obj), failure(...)) -> void
 * Note: "imp", if true, retrieves the file from the game. Otherwise it's retrieved from a mod.
 * This function is designed in an asynchronous fashion.
 */
export function patch(a, steps, loader, success, failure) {
	if (steps.constructor === Object) {
		// Standardized Mods specification
		for (var k in steps) {
			if ((steps[k].constructor === Object) && (a[k] !== void 0)) {
				// Not actually async
				patch(a[k], steps[k], loader, function () {}, function () {});
			} else {
				a[k] = steps[k];
			}
		}
		success();
		return;
	}
	var init = {
		currentValue: a,
		stack: [],
		loader: loader,
		index: 0,
		steps: steps,
		success: success,
		failure: failure,
		currentlyAdvancing: 0,
		advance: function () {
			// This trick prevents potential recursion, which could be dangerous on long patches.
			this.currentlyAdvancing++;
			if (this.currentlyAdvancing == 1) {
				while (this.currentlyAdvancing > 0) {
					if (this.index >= this.steps.length) {
						this.success();
						return;
					} else {
						var step = this.steps[this.index++];
						appliers[step["type"]].call(step, this);
					}
					this.currentlyAdvancing--;
				}
			}
		}
	};
	init.advance();
}

// -- Step Execution --

appliers["ENTER"] = function (state) {
	state.stack.push(state.currentValue);
	state.currentValue = state.currentValue[this["index"]];
	state.advance();
};

appliers["EXIT"] = function (state) {
	state.currentValue = state.stack.pop();
	state.advance();
};

appliers["SET_KEY"] = function (state) {
	if ("content" in this) {
		state.currentValue[this["index"]] = photocopy(this["content"]);
	} else {
		delete state.currentValue[this["index"]];
	}
	state.advance();
};

appliers["REMOVE_ARRAY_ELEMENT"] = function (state) {
	state.currentValue.splice(this["index"], 1);
	state.advance();
};

appliers["ADD_ARRAY_ELEMENT"] = function (state) {
	if ("index" in this) {
		state.currentValue.splice(this["index"], 0, photocopy(this["content"]));
	} else {
		state.currentValue.push(photocopy(this["content"]));
	}
	state.advance();
};

appliers["IMPORT"] = function (state) {
	state.loader(true, this["src"], (function (obj) {
		if ("path" in this)
			for (var i = 0; i < this["path"].length; i++)
				obj = obj[this["path"][i]];
		if ("index" in this) {
			state.currentValue[this["index"]] = photocopy(obj);
		} else {
			photomerge(state.currentValue, obj);
		}
		state.advance();
	}).bind(this), state.failure);
};

appliers["INCLUDE"] = function (state) {
	state.loader(false, this["src"], (function (obj) {
		patch(state.currentValue, obj, state.loader, state.advance.bind(state), state.failure);
	}).bind(this), state.failure);
};

