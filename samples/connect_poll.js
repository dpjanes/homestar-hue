/*
 *  Connect to a Hue and just passively listen for changes
 */

var iotdb = require('iotdb');
var HueBridge = require('../HueBridge').Bridge;

var bridge_exemplar = new HueBridge();
bridge_exemplar.discovered = function(bridge) {
    console.log("+ got one\n ", bridge.meta());
    bridge.pulled = function(state) {
        console.log("+ state-change\n ", state);
    };
    bridge.connect();
};
bridge_exemplar.discover();
