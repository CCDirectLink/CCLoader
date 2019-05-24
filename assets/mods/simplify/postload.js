(() => {
	const event = document.createEvent('Event');
	event.initEvent('postload', true, false);
	document.dispatchEvent(event);
})();