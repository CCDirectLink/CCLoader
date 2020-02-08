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

					let isAbsolute = false;
					if (path.startsWith(this.sep)) {
						isAbsolute = true;
						path = path.substring(this.sep.length);
					}

					// split by the path separator 
					let pieces = path.split(this.sep);

					// resolve all .. and .

					let parentDirRef = 0;

					for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex++) {
						const currPiece = pieces[pieceIndex];
						

						if (currPiece === '.' ) {
							// remove the current entry
							pieces.splice(pieceIndex, 1);
							pieceIndex--;
						} else if (currPiece === '') {
							pieces.splice(pieceIndex, 1);
							pieceIndex--;
						} else if (currPiece === '..') {
							if (isAbsolute) {
								if (pieceIndex === 0) {
									pieces.splice(pieceIndex, 1);
									pieceIndex--;
								} else {
									pieces.splice(pieceIndex - 1, 2);
									pieceIndex -= 2;
								}
							} else {
								if (pieceIndex === parentDirRef) {
									parentDirRef++;
								} else {
									pieces.splice(pieceIndex - 1, 2);
									pieceIndex--;									
								}
							}
						}
					}
					
					if (isAbsolute) {
						pieces.unshift('');
					}

					return pieces.join(this.sep);

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
