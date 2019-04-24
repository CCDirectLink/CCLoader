(function() {
    function createCCLoaderVersionText() {
        const LOADER_NAME = "CCLoader";

        let text = new cc.sc.Text(LOADER_NAME + " V" + versions.ccloader, {
            font: cc.sc.fontsystem.tiny
        });
        text[entries.setPosition](2, 10);
        text[entries.setAlignment](6, 3);

        text[entries.GuiConfig][entries.transition] = {
            DEFAULT: {
                state: {},
                time: 0.2,
                [entries.keySpline]: KEY_SPLINES.EASE
            },
            HIDDEN: {
                state: {
                    alpha: 0
                },
                time: 0.2,
                [entries.keySpline]: KEY_SPLINES.LINEAR
            }
        };
        return text;
    }

    function callbackOverride(object, callbackFunctionName, newCallback) {
        let oldCallBackFunction = object[callbackFunctionName];
        object[callbackFunctionName] = function() {
            newCallback.apply(this, arguments);
            return oldCallBackFunction.apply(this, arguments);
        }
    }
	
	function onGameStateChange(object, eventCode) {
        // eventCode === CHANGED_STATE
        if (object == cc.sc.playerModelInstance && eventCode === 0) {
            let currentTransition = cc.sc.playerModelInstance[entries.isMainMenu]() ? "DEFAULT" : "HIDDEN";
            if (this[entries.GuiConfig][entries.currentTransition] != currentTransition) {
                versionText[entries.setGuiStateTransition]("HIDDEN");
            }
        }
    }
	function onGameStateAdd(transitionState, transitionType) {
        // transitionState === ADD (my guess)
        if (transitionState === 1 && transitionType === "IDLE") {
            versionText[entries.setGuiStateTransition]("DEFAULT");
        }
    }
	
    document.body.addEventListener("modsLoaded", () => {
        let titleScreenBackgroundGui = cc.ig.GUI.menues.filter((e) => e[entries.GUI] instanceof cc.sc.TitleScreenBG).pop();

        let versionText = createCCLoaderVersionText();
        versionText[entries.setGuiStateTransition]("HIDDEN", h);

        titleScreenBackgroundGui[entries.GUI][entries.addGui](versionText);

        callbackOverride(titleScreenBackgroundGui[entries.GUI], 
						 entries.observerCallback, 
						 onGameStateChange);

        callbackOverride(titleScreenBackgroundGui[entries.GUI][entries.titleParallax], 
						 entries.callback, 
						 onGameStateAdd);

	});
})()