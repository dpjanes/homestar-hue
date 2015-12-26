/*
 *  SEE "iotdb.js" for the best way to use this
 *  Connect to a Hue and cycle through colors
 */

"use strict";

var HueLightBridge = require('../HueLightBridge').Bridge;

var bridge_exemplar = new HueLightBridge();
bridge_exemplar.discovered = function (bridge) {
    console.log("+ got one\n ", bridge.meta());
    bridge.pulled = function (state) {
        console.log("+ state-change\n ", state);
    };
    bridge.connect({});

    var on = false;
    setInterval(function () {
        bridge.push({
            on: on,
        }, function () {});
        on = !on;
    }, 2500);
};
bridge_exemplar.discover();
