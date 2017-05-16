document.body.addEventListener('modsLoaded', function () {
	simplify.registerUpdate(function(){
		if(ig.input.state("help"))
			new cc.ig.events.CHANGE_PLAYER_HP({amount:10000}).start()
	});
});