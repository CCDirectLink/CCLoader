const TYPES = {
	string: 'string',
	array: 'array',
	object: 'object',
	null: 'null',
	unknown: 'unknown',
};

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

export class ManifestUtil {
	/**
	 * @param {any} data
	 * @param {boolean} legacyRelaxedChecks
	 * @returns {string[]}
	 */
	validateManifest(data, legacyRelaxedChecks) {
		this._errors = [];

		this._assertType('<document>', data, [TYPES.object]);

		this._assertType('id', data.id, [TYPES.string]);
		if (!legacyRelaxedChecks && /[a-zA-Z0-9_\-]+/.test(data.id)) {
			this._errors.push(
				'id must consist only of one or more alphanumberic characters, hyphens or underscores',
			);
		}

		this._assertType('version', data.version, [TYPES.string]);
		this._assertType('license', data.license, [TYPES.string], true);

		this._assertLocalizedString('title', data.title, true);
		this._assertLocalizedString('description', data.description, true);
		this._assertLocalizedString('homepage', data.homepage, true);
		if (data.keywords !== undefined) {
			if (this._assertType('keywords', data.keywords, [TYPES.array])) {
				data.keywords.reduce(
					(valid, value, index) =>
						this._assertLocalizedString(`keywords[${index}]`, value) && valid,
					true,
				);
			}
		}

		this._assertPeople('authors', data.authors, true);
		this._assertPeople('contributors', data.contributors, true);
		this._assertPeople('maintainers', data.maintainers, true);

		if (data.dependencies !== undefined) {
			if (this._assertType('dependencies', data.dependencies, [TYPES.object])) {
				Object.keys(data.dependencies).reduce((valid, key) => {
					let value = data.dependencies[key];
					let valueName = `dependencies[${JSON.stringify(key)}]`;
					return this._assertType(valueName, value, [TYPES.string]) && valid;
				}, true);
			}
		}

		if (data.assets !== undefined) {
			if (this._assertType('assets', data.assets, [TYPES.array])) {
				data.assets.reduce(
					(valid, value, index) =>
						this._assertType(`assets[${index}]`, value, [TYPES.string]) &&
						valid,
					true,
				);
			}
		}
		this._assertType('assetsDir', data.assetsDir, [TYPES.string], true);

		this._assertType('assetsDir', data.assetsDir, [TYPES.string], true);
		this._assertType('plugin', data.plugin, [TYPES.string], true);
		this._assertType('preload', data.preload, [TYPES.string], true);
		this._assertType('prestart', data.prestart, [TYPES.string], true);

		return this._errors;
	}

	/**
	 * @param {string} valueName
	 * @param {unknown} value
	 * @param {string[]} expectedType
	 * @param {boolean} [optional]
	 * @returns {boolean}
	 */
	_assertType(valueName, value, expectedTypes, optional = false) {
		if (optional && value === undefined) return true;
		if (!expectedTypes.includes(getType(value))) {
			this._errors.push(
				`expected type of '${valueName}' to be '${expectedTypes.join(' | ')}'`,
			);
			return false;
		}
		return true;
	}

	/**
	 * @param {string} valueName
	 * @param {unknown} value
	 * @param {boolean} [optional]
	 * @returns {boolean}
	 */
	_assertLocalizedString(valueName, value, optional = false) {
		if (optional && value === undefined) return true;
		if (!this._assertType(valueName, value, [TYPES.object, TYPES.string])) {
			return false;
		}

		// couldn't figure out how to avoid an extra getType here... maybe return
		// the type from this._assertType on success or something like that
		if (getType(value) === TYPES.string) return true;

		return Object.keys(value).reduce(
			(valid, key) =>
				// this will display the key incorrectly if it is not identifier-like,
				// but whatever. all locales can be written in an identifier-like form
				this._assertType(`${valueName}.${key}`, value[key], [TYPES.string]) &&
				valid,
			true,
		);
	}

	/**
	 * @param {string} valueName
	 * @param {unknown} value
	 * @param {boolean} [optional]
	 * @returns {boolean}
	 */
	_assertPeople(valueName, value, optional = false) {
		if (optional && value === undefined) return true;
		if (!this._assertType(valueName, value, [TYPES.array])) {
			return false;
		}

		return value.reduce(
			(valid, value, index) =>
				this._assertPerson(`${valueName}[${index}]`, value) && valid,
			true,
		);
	}

	/**
	 * @param {string} valueName
	 * @param {unknown} value
	 * @returns {boolean}
	 */
	_assertPerson(valueName, value) {
		if (!this._assertType(valueName, value, [TYPES.object, TYPES.string])) {
			return false;
		}

		// same story as with getType in this.assertLocalizedString
		if (getType(value) === TYPES.string) return true;

		return ['name', 'email', 'url', 'comment'].reduce(
			(valid, key) =>
				this._assertLocalizedString(
					`${valueName}.${key}`,
					value[key],
					key !== 'name',
				) && valid,
			true,
		);
	}

	/**
	 * @param {any} data
	 * @return {ccloader.Manifest}
	 */
	convertLegacyManifest(data) {
		return {
			id: data.name,
			version: data.version,
			license: data.license,
			title: { en_US: data.name },
			description:
				data.description !== undefined
					? { en_US: data.description }
					: undefined,
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
}
