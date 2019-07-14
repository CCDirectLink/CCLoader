for (const mod of window.activeMods) {
	if (mod.isPlugin) {
		mod.loadPostload();
	}
}	

function _hookStart() {
	let original = undefined;
	Object.defineProperty(window, 'startCrossCode', {
		get() {
			if (original) {
				return async(...args) => {
					for (const mod of window.activeMods) {
						await mod.loadPrestart();
					}
                    
					const event = document.createEvent('Event');
					event.initEvent('prestart', true, false);
					document.dispatchEvent(event);

					return original(...args);
				};
			}
			return undefined;
		},
		set(val) {
			original = val;
			return true;
		}
	});
}

_hookStart();