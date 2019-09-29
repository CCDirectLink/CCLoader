export class Greenworks {
	constructor(version) {
		this._greenworks = require(`../assets/modules/greenworks-${version}/greenworks`);
	}

	init() {
		return this._greenworks.init();
	}

	initAPI() {
		return this._greenworks.initAPI();
	}
	
	clearAchievement(steamId, callback) {
		this._greenworks.clearAchievement(steamId, function() {
			return callback.apply(this, arguments);
		});
	}

	activateAchievement(steamId, callback) {
		this._greenworks.activateAchievement(steamId, function() {
			return callback.apply(this, arguments);
		});
	}
}
