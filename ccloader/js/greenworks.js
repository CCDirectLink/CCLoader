export class Greenworks {

	/**
	 * 
	 * @param {string} version Version number of greenworks to load
	 */
	constructor(version) {
		this._greenworks = require(`../assets/modules/greenworks-${version}/greenworks`);
	}


	init() {
		return this._greenworks.init();
	}

	initAPI() {
		return this._greenworks.initAPI();
	}
	
	/**
	 * 
	 * @param {string} steamId 
	 * @param {function} [callback = () => {}] 
	 */
	clearAchievement(steamId, callback = () => {}) {
		this._greenworks.clearAchievement(steamId, function() {
			return callback.apply(this, arguments);
		});
	}

	/**
	 * 
	 * @param {string} steamId 
	 * @param {function} [callback = () => {}] 
	 */
	activateAchievement(steamId, callback = () => {}) {
		this._greenworks.activateAchievement(steamId, function() {
			return callback.apply(this, arguments);
		});
	}
}
