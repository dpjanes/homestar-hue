/*
 *  Use a Model to manipulate semantically
 */

var iotdb = require("iotdb");

var HueLightBridge = require('../HueLightBridge').Bridge;
var HueLightModel = require('../HueLightModel').Model;

wrapper = iotdb.bridge_wrapper(new HueLightBridge());
wrapper.on('discovered', function(bridge) {
    var model = new HueLightModel();
    model.bind_bridge(bridge);

    model.on_change(function(model) {
        console.log("+ state\n ", model.state());
    });
    model.on_meta(function(model) {
        console.log("+ meta\n ", model.meta().state());
    });

    var count = 0;
    var colors = [ "#FF0000", "#00FF00", "#0000FF", "#00FFFF", "#FF00FF", "#FFFF00", "#FFFFFF", ];
    var timer = setInterval(function() {
        if (!model.reachable()) {
            console.log("+ forgetting unreachable model");
            clearInterval(timer);
            return;
        }

        model.set(":color", colors[count++ % colors.length]);
    }, 2500);
    
    console.log("+ discovered\n ", model.meta().state(), "\n ", model.thing_id());
})
