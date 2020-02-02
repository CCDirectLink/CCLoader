String.prototype.endsWith = String.prototype.endsWith || function(end){
	return this.substr(this.length - end.length, end.length) === end;
};
if (!window.require) {
	window.isBrowser = true;
	window.require = name => {
		if (name === 'path') {
			const path = {
				sep: '/',
				normalize: function (path) {

					if (path.length === 0) {
						return '.';
					}  else if (!path.includes(this.sep)) {
						return path;
					}

					// split by the path separator 
					let pieces = path.split(this.sep);

					// resolve all .. and .

					for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex++) {
						const currPiece = pieces[pieceIndex];
						
						if (currPiece === '.' || (currPiece === '..' && pieceIndex === 0) 
							|| currPiece.trim() === '') {
							// remove the current entry
							pieces.splice(pieceIndex, 1);
							pieceIndex--;
						} else if (currPiece === '..') {
							// remove the current entry and previous entry
							pieces.splice(pieceIndex - 1, 2);
							pieceIndex -= 1;
						}
					}
					
					return this.sep + pieces.join(this.sep);

				},
				join: function(...args) {
					return this.normalize(args.join(this.sep));
				}
			};
			path.posix = path;
			return path;
		}
		return undefined;
	};
} else {
	window.isLocal = true;
}
