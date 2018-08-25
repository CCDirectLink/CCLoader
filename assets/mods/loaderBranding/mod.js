(function () {
	// Would prefer to extend (better code quality), but that means writing more definitions
	var oldVersionToString = sc.version.toString.bind(sc.version);
	sc.version.toString = function () {
		return oldVersionToString() + " W/MODS";
	};
	// ----

	var BrandingGameAddon = ig.GameAddon.extend({
		init: function () {
			this.parent("AddonThatAddsAKeySoDevsKnowIfASaveComesFromModdedCC");
			ig.storage.register(this);
		},
		onStorageSave: function (a) {
			a["ALERT_TO_CC_DEVS"] = "ALERT TO CROSSCODE DEVELOPERS: This save is from a modded version of the game. It is possible that the bug you are trying to track down may not be in the unmodified code. That said, it is also possible that the bug is in the unmodified code. Proceed with caution.";
		},
		// We don't have any reason to add these, but it's important to note they're there.
		onStoragePreLoad: function (a) {
		},
		onStoragePostLoad: function (a) {
		}
	});

	ig.addGameAddon(function () {
		return new BrandingGameAddon();
	});
})();

