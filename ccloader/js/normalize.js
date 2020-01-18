String.prototype.endsWith = String.prototype.endsWith || function(end){
	return this.substr(this.length - end.length, end.length) === end;
};
if (!window.require) {
	window.isBrowser = true;
	window.require = name => {
		if (name === 'path') {
			return {
				sep: '/',
				normalize: function (path) {

					// convert all \ to / and remove all duplicate //

					path = path.replace(/\\/g, this.sep).replace(/\/\//g, this.sep);
					
					// split by the path separator 
					let pieces = path.split(this.sep);

					// resolve all .. and .

					for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex++) {
						const currPiece = pieces[pieceIndex];
						
						if (currPiece === '.' || (currPiece === '..' && pieceIndex === 0)) {
							// remove the current entry
							pieces.splice(pieceIndex, 1);
							pieceIndex--;
						} else if (currPiece === '..') {
							// remove the current entry and previous entry
							pieces.splice(pieceIndex - 1, 2);
							pieceIndex -= 1;
						}
					}
					return pieces.join(this.sep);

				},
				join: function(...args) {
					return this.normalize(args.join(this.sep));
				}
			};
		}
		return undefined;
	};
} else {
	window.isLocal = true;
}
