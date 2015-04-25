/*
 *  How to use this module stand-alone
 */

"use strict";

try {
    var model = require('homestar-hue');
} catch (x) {
    var model = require('../index');
}

var _ = model.iotdb._;

var wrapper = model.wrap("HueLight");
wrapper.on('thing', function (model) {
    model.on("state", function (model) {
        console.log("+ state\n ", model.state("istate"));
    });
    model.on("meta", function (model) {
        console.log("+ meta\n ", model.state("meta"));
    });

    var count = 0;
    var colors = ["#FF0000", "#00FF00", "#0000FF", "#00FFFF", "#FF00FF", "#FFFF00", "#FFFFFF", ];
    var timer = setInterval(function () {
        if (!model.reachable()) {
            console.log("+ forgetting unreachable model");
            clearInterval(timer);
            return;
        }

        model.set(":color", colors[count++ % colors.length]);
    }, 2500);

    console.log("+ discovered\n ", model.state("meta"));
});
