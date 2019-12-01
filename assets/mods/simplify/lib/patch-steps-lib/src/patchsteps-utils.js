/*
 * patch-steps-lib - Library for the Patch Steps spec.
 *
 * Written starting in 2019.
 *
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */

/**
 * A generic merge function.
 * NOTE: This should match Patch Steps specification, specifically how IMPORT merging works.
 * @param {any} a The value to merge into.
 * @param {any} b The value to merge from.
 * @returns {any} a
 */
export function photomerge(a, b) {
	if (b.constructor === Object) {
		for (let k in b)
			a[photocopy(k)] = photocopy(b[k]);
	} else if (b.constructor == Array) {
		for (let i = 0; i < b.length; i++)
			a.push(photocopy(b[i]));
	} else {
		throw new Error("We can't do that! ...Who'd clean up the mess?");
	}
	return a;
}

/**
 * A generic copy function.
 * @param {any} a The value to copy.
 * @returns {any} copied value
 */
export function photocopy(o) {
	if (o) {
		if (o.constructor === Array)
			return photomerge([], o);
		if (o.constructor === Object)
			return photomerge({}, o);
	}
	return o;
}

