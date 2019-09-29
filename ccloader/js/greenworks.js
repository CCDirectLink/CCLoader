export class Greenworks {
	constructor() {
		this._greenworks = null;

		const version = process.versions["node-webkit"];
		if (semver.lt(version, "0.14.0")) {
			if (this.startedFromSteam()) {
				this._greenworks = require('../assets/modules/greenworks-0.4.0/greenworks');
			}
		} else if (semver.lt(version, "0.30.0")) {
			this._greenworks = require('../assets/modules/greenworks-0.5.3/greenworks');
		} else {
			this._greenworks = require('../assets/modules/greenworks-0.13.0/greenworks');	
		}
	}

	startedFromSteam() {
		return nw.App.argv.indexOf("--startedFromSteam") > -1;
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
