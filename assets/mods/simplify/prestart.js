ig.module('impact.feature.greenworks.greenworks-fix').requires('impact.feature.greenworks.greenworks').defines(function() {
	ig.Greenworks.inject({
		init: function() {
			this.name = 'Greenworks';
			this.greenworks = null;
			try {
				const semver = window.semver;
				
				this.steps.push('loaded');
	
				const version = process.versions['node-webkit'];
				if (this.hasSteamStartArgument()) {
					if (semver.lt(version, '0.14.0')) {
						
						this.greenworks = new Greenworks('0.4.0');
						this.greenworks.initAPI();
						
					} else {
						if (semver.lt(version, '0.30.0')) {
							this.greenworks = new Greenworks('0.5.3');
						} else if (semver.lt(version, '0.35.0')) {
							this.greenworks = new Greenworks('0.13.0');
						} else {
							this.greenworks = new Greenworks('nw-0.35');
						}
						this.greenworks.init();	
					}
				} else {
					throw Error('Did not start from steam.');
				}
			} catch (error) {
				this.steps.push('error');
				this.errorMsg = error.toString();
			}

			if (this.greenworks) {
				this.steps.push('initialized');
			}	
		}
	});
});