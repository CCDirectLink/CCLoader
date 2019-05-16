//var c=document.createElement("script");document.body.appendChild(c),c.type="text/javascript",c.src="compare.js"

var ac = require("acorn");
var walker = require("acorn/dist/walk");

var current = ac.parse(filemanager.getResource('assets/js/game.compiled.js'), {onToken: function(){}});
var old = ac.parse(filemanager.getResource('assets/js/game.min.js'), {onToken: function(){}});