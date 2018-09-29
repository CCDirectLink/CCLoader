<<<<<<< HEAD
String.prototype.endsWith = String.prototype.endsWith || function(end){
	return this.substr(this.length - end.length, end.length) === end;
=======
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
>>>>>>> 8d9317bf89267332b734fa661e4695b7ba610bbb
}