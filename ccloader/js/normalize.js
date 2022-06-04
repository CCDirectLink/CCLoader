// For very old versions of nw (the game itself includes a polyfill only for
// startsWith).
String.prototype.endsWith = String.prototype.endsWith || function(end){
	return this.substr(this.length - end.length, end.length) === end;
};

if (!window.require) {
	window.isBrowser = true;
	// Fixes a crash in an inline script in node-webkit.html when running in the
	// browser, which prevents the game from starting.
	window.process = {
		once: () => {}
	};
} else {
	window.isLocal = true;
}
