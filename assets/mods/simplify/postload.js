(() => {
	const event = document.createEvent('Event');
	event.initEvent('postload', true, false);
	document.dispatchEvent(event);
		
	function _hookStart() {
		let original = window.startCrossCode;
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
})();
