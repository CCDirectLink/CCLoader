const TYPES = {
	string: 'string',
	array: 'array',
	object: 'object',
	null: 'null',
	unknown: 'unknown',
};

export function validateManifest(data, legacyRelaxedChecks) {
	let errors = [];

	assertType(errors, 'id', data.id, [TYPES.string]);
	if (!legacyRelaxedChecks && /[a-zA-Z0-9_\-]+/.test(data.id)) {
		errors.push(
			'id must consist only of one or more alphanumberic characters, hyphens or underscores',
		);
	}

	assertType(errors, 'version', data.version, [TYPES.string]);
	assertType(errors, 'license', data.license, [TYPES.string], true);

	assertLocalizedString(errors, 'title', data.title, true);
	assertLocalizedString(errors, 'description', data.description, true);
	assertLocalizedString(errors, 'homepage', data.homepage, true);
	if (data.keywords !== undefined) {
		if (assertType(errors, 'keywords', data.keywords, [TYPES.array])) {
			data.keywords.reduce(
				(valid, value, index) =>
					assertLocalizedString(errors, `keywords[${index}]`, value) && valid,
				true,
			);
		}
	}

	assertPeople(errors, 'authors', data.authors, true);
	assertPeople(errors, 'contributors', data.contributors, true);
	assertPeople(errors, 'maintainers', data.maintainers, true);

	if (data.dependencies !== undefined) {
		if (assertType(errors, 'dependencies', data.dependencies, [TYPES.object])) {
			Object.keys(data.dependencies).reduce((valid, key) => {
				let value = data.dependencies[key];
				let valueName = `dependencies[${JSON.stringify(key)}]`;
				return assertType(errors, valueName, value, [TYPES.string]) && valid;
			}, true);
		}
	}

	if (data.assets !== undefined) {
		if (assertType(errors, 'assets', data.assets, [TYPES.array])) {
			data.assets.reduce(
				(valid, value, index) =>
					assertType(errors, `assets[${index}]`, value, [TYPES.string]) &&
					valid,
				true,
			);
		}
	}
	assertType(errors, 'assetsDir', data.assetsDir, [TYPES.string], true);

	assertType(errors, 'assetsDir', data.assetsDir, [TYPES.string], true);
	assertType(errors, 'plugin', data.plugin, [TYPES.string], true);
	assertType(errors, 'preload', data.preload, [TYPES.string], true);
	assertType(errors, 'prestart', data.prestart, [TYPES.string], true);

	return errors;
}

/**
 * @param {string[]} errors
 * @param {string} valueName
 * @param {unknown} value
 * @param {string[]} expectedType
 * @param {boolean} [optional]
 * @returns {boolean}
 */
function assertType(errors, valueName, value, expectedTypes, optional = false) {
	if (optional && value === undefined) return true;
	if (!expectedTypes.includes(getType(value))) {
		errors.push(
			`expected type of '${valueName}' to be '${expectedTypes.join(' | ')}'`,
		);
		return false;
	}
	return true;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function getType(value) {
	if (value === null) return TYPES.null;
	if (typeof value === 'string') return TYPES.string;
	if (Array.isArray(value)) return TYPES.array;
	if (typeof value === 'object') return TYPES.object;
	return TYPES.unknown;
}

/**
 * @param {string[]} errors
 * @param {string} valueName
 * @param {unknown} value
 * @param {boolean} [optional]
 * @returns {boolean}
 */
function assertLocalizedString(errors, valueName, value, optional = false) {
	if (optional && value === undefined) return true;
	if (!assertType(errors, valueName, value, [TYPES.object, TYPES.string])) {
		return false;
	}

	// couldn't figure out how to avoid an extra getType here... maybe return the
	// type from assertType on success or something like that
	if (getType(value) === TYPES.string) return true;

	return Object.keys(value).reduce(
		(valid, key) =>
			// this will display the key incorrectly if it is not identifier-like,
			// but whatever. all locales can be written in an identifier-like form
			assertType(errors, `${valueName}.${key}`, value[key], [TYPES.string]) &&
			valid,
		true,
	);
}

function assertPeople(errors, valueName, value, optional = false) {
	if (optional && value === undefined) return true;
	if (!assertType(errors, valueName, value, [TYPES.array])) {
		return false;
	}

	return value.reduce(
		(valid, value, index) =>
			assertPerson(errors, `${valueName}[${index}]`, value) && valid,
		true,
	);
}

/**
 * @param {string[]} errors
 * @param {string} valueName
 * @param {unknown} value
 * @returns {boolean}
 */
function assertPerson(errors, valueName, value) {
	if (!assertType(errors, valueName, value, [TYPES.object, TYPES.string])) {
		return false;
	}

	// same story as with getType in assertLocalizedString
	if (getType(value) === TYPES.string) return true;

	return ['name', 'email', 'url', 'comment'].reduce(
		(valid, key) =>
			assertLocalizedString(
				errors,
				`${valueName}.${key}`,
				value[key],
				key !== 'name',
			) && valid,
		true,
	);
}

export function convertLegacyManifest(data) {
	return {
		id: data.name,
		version: data.version,
		license: data.license,
		title: { en_US: data.name },
		description:
			data.description !== undefined ? { en_US: data.description } : undefined,
		homepage:
			data.homepage !== undefined ? { en_US: data.homepage } : undefined,
		dependencies:
			data.ccmodDependencies !== undefined
				? data.ccmodDependencies
				: data.dependencies,
		assets: data.assets,
		plugin: data.plugin,
		preload: data.preload,
		postload: data.postload,
		prestart: data.prestart,
	};
}
