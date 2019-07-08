/**
 * 
 * @param {Function} func 
 */
function _simplifyNormalizeScript(func) {
	const src = func.toString();
	return src.substring(src.indexOf('{') + 1, src.lastIndexOf('}'));
}

//_simplifyModVariable ugliness to cause less friction with reeval
for (const _simplifyModVariable of window.parent.modloader.mods) {
	if (_simplifyModVariable.isPlugin && _simplifyModVariable.isEnabled) {
		if (_simplifyModVariable.pluginInst.preload) {
			_simplifyModVariable.pluginInst.preload = new Function(_simplifyNormalizeScript(_simplifyModVariable.pluginInst.preload.toString())).bind(_simplifyModVariable.pluginInst);
		}
		if (_simplifyModVariable.pluginInst.postload) {
			_simplifyModVariable.pluginInst.postload = new Function(_simplifyNormalizeScript(_simplifyModVariable.pluginInst.postload.toString())).bind(_simplifyModVariable.pluginInst);
		}
		if (_simplifyModVariable.pluginInst.prestart) {
			_simplifyModVariable.pluginInst.prestart = new Function(_simplifyNormalizeScript(_simplifyModVariable.pluginInst.prestart.toString())).bind(_simplifyModVariable.pluginInst);
		}
		if (_simplifyModVariable.pluginInst.main) {
			_simplifyModVariable.pluginInst.main = new Function(_simplifyNormalizeScript(_simplifyModVariable.pluginInst.main.toString())).bind(_simplifyModVariable.pluginInst);
		}

		_simplifyModVariable.loadPreload();
	}
}

() => {
	const event = document.createEvent('Event');
	event.initEvent('preload', true, false);
	document.dispatchEvent(event);
};