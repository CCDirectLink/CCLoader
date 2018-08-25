// Reobfuscator
// NOTE! Doesn't support GCall transform, so needs minor expansion to deobfuscate game

var kireobf = function(code, remapId) {
	var propKey = function (tkns, i) {
		if (i > 1) {
			if (tkns[i - 2] == ".") {
				return true;
			} else if (i < tkns.length - 2) {
				if (tkns[i + 2] == ":") {
					if (tkns[i - 2] == ",")
						return true;
					if (tkns[i - 2] == "{")
						return true;
				}
			}
		}
		return false;
	};

	// We don't need to parse it (inefficient, especially to reverse the process), just tokenize it.
	var parser = acorn.tokenizer(code);
	var lastIndex = 0;
	var components = [];
	while (true) {
		parser.nextToken();
		if (parser.type == acorn.tokTypes.eof)
			break;
		// Whitespace is interleaved precisely
		components.push(code.substring(lastIndex, parser.start));
		components.push(code.substring(parser.start, parser.end));
		lastIndex = parser.end;
	}
	components.push(code.substring(lastIndex));
	// Just iterates over actual tokens
	for (var i = 1; i < components.length; i += 2) {
		if (propKey(components, i)) {
			var remapped = remapId(components[i]);
			if (remapped != null)
				components[i] = " " + remapped + " /* " + components[i] + " */ ";
		}
	}
	code = "";
	for (var i = 0; i < components.length; i++)
		code += components[i];
	return code;
};
