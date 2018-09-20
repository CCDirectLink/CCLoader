if (!String.prototype.endsWith) {
	String.prototype.endsWith = end => {
		return this.substr(this.length - end.length, end.length) === end;
	};
}

if (!window.require) {
	window.isBrowser = true;
	window.require = name => {
		if (name === 'path') {
			return {
				sep: '/'
			};
		}
		return undefined;
	};
} else {
	window.isLocal = true;
}