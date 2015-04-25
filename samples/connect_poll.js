/*
 *  SEE "iotdb.js" for the best way to use this
 *  Connect to a Hue and just passively listen for changes
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
};
bridge_exemplar.discover();
