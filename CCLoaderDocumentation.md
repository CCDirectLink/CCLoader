# CCLoader Documentation

This file will contain handy things to know about CCLoader and the CrossCode DevTools console.

## Difference between Scripts and Console

They are both JavaScript code and have the same effect but scripts are loaded at specific times specified in [https://github.com/CCDirectLink/CLS/blob/master/proposals/1/standardized-mod-format.md](https://github.com/CCDirectLink/CLS/blob/master/proposals/1/standardized-mod-format.md "https://github.com/CCDirectLink/CLS/blob/master/proposals/1/standardized-mod-format.md") . That doc also tells you how the `package.json` file is structured.

## A new technique

There is a new technique used for new mods that replaces the old "stage" entries in the package.json that isn't yet in the spec. If you specify a script as "plugin" in the package.json then you can use a exported class that extends "Plugin" to combine multiple stages in a script:

```JS
/// <reference path="../../../ccloader/js/types/plugin.d.ts" />

/**
 * @extends {ccloader.Plugin}
 */
export default class Test extends Plugin {

    /**
     * 
     * @param {ccloader.Mod[]} mods 
     */
    constructor(mods) {
        super();

        this.mods = mods;
    }

    preload() {
        console.log('Called in preload');
    }

    postload() {
        console.log('Called in postload');
    }

    prestart() {
        console.log('Called in prestart');
    }
    
    main() {
        console.log('Called in main');
    }
}
```
## Variables

About how to find out what variables to use: You first have to understand how CrossCode's code is structured. For that you probably want to beautify the code (game.compiled.js) first: [https://beautifier.io/](https://beautifier.io/ "https://beautifier.io/") .

## Structure

It starts with some utility code and then with modules. Every module starts with module - recognized by `ig.module("name").requires(...).defines(function() { ... })` - has a name requirements and a body. These modules are just groups of related code. You could make a tool that puts it into different files but then you'd end up with 100 files to look through.

## Important Variables


All important variables are either in the `sc` or the `ig` object. As far as I can tell they are "prototype" and "runtime" objects respectively but I am not so sure about that.

## Constant Values

Constant values (and enums) are usually in written in CAPS_WITH_UNDERSCORES, are found at the root of a module and look like this:
```JS
ig.module("name").requires("others").defines(function() {
    //...

    sc.GAME_MOBILITY_BLOCK = {
        NONE: {},
        TELEPORT: {
            teleportBlock: true
        },
        SAVE: {
            teleportBlock: true,
            saveBlock: true
        },
        CHECKPOINT: {
            teleportBlock: true,
            saveBlock: true,
            checkpointBlock: true
        },
        NO_MAP_LEAVE: {
            teleportBlock: true,
            saveBlock: true,
            checkpointBlock: true,
            mapLeaveBlock: true
        }
    };

    //...
})
```
## Checking Variable Arguments

If you enter `sc.GAME_MOBILITY_BLOCK` you will get a list of 'NONE', 'TELEPORT', 'SAVE', 'CHECKPOINT' and 'NO_MAP_LEAVE'.

Classes are also always found at the root of a module and always look like this:

```JS
ig.module("name").requires("others").defines(function() {
    //...

    ig.Name = ig.Class.extends({
        variableA: 1,
        variableB: "asdf",
        init: function(a, b, c) {
            //This is the constructor with the args a, b, c
        },
        funcA: function() {
            this.funcB(); //The other func can be called using "this"
        },
        funcB: function() {
            console.log(this.variableB); //Variables can be used using "this"
        }
    })

    //...
})
```
## Referencing Variables


You could now reference `ig.Name` in the console but it won't get you much since it is only the class - a template that doesn't actually have runtime values.

The instances of classes are created like usual with "new". However, where the instance is stored can be different every time. It can be in a global variable, inside a class, or not at all. Usually it looks like this:

```JS
ig.module("name").requires("others").defines(function() {
    //...

    ig.addGameAddon(function() {
        return sc.combat = new sc.Combat
    });

    //...
})
```
This means that `sc.combat` is an instance of `sc.Combat` and has all of it's variables and functions.
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTM3ODk5MjUwOSwxODcyNzgxNjg1LC0yMD
UyNjc3MDcxLC0xOTk2OTg1MjI5LC0zMzI0NTUzNjNdfQ==
-->