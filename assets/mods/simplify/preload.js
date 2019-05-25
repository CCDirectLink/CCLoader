(() => {
	const event = document.createEvent('Event');
	event.initEvent('preload', true, false);
	document.dispatchEvent(event);
})();