/*
 * patch-steps-lib - Library for the Patch Steps spec.
 *
 * Written starting in 2019.
 *
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */

import * as utils from "./patchsteps-utils.js";
import * as patcher from "./patchsteps-patch.js";
import * as differ from "./patchsteps-diff.js";

export const version = "1.1.3";

export const photomerge = utils.photomerge;
export const photocopy = utils.photocopy;

export const diff = differ.diff;
export const diffEnterLevel = differ.diffEnterLevel;
export const diffApplyComment = differ.diffApplyComment;
export const defaultSettings = differ.defaultSettings;

export const patch = patcher.patch;
export const appliers = patcher.appliers;
export const DebugState = patcher.DebugState;

