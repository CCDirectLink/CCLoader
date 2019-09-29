ig.module("impact.feature.greenworks.greenworks-fix").requires("impact.feature.greenworks.greenworks").defines(function() {
	ig.Greenworks.inject({
		init: function() {
			this.name = "Greenworks";
			try {
				const semver = parent.semver;
				this.greenworks = parent.makeGreenWork();
				this.steps.push("loaded");
	
				const version = process.versions["node-webkit"];
				if (semver.lt(version, "0.14.0")) {
					if (this.startedFromSteam()) {
						this.greenworks.initAPI();
					}
				} else {
					this.greenworks.init();	
				}
			} catch (error) {
				this.steps.push("error");
				this.errorMsg = error.toString();
				this.greenworks = null;
			}

			if (this.greenworks) {
				this.steps.push("initialized");
			}
			
		}
	});
});