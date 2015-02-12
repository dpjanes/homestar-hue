/*
 *  HueLightModel.js
 *
 *  David Janes
 *  IOTDB
 *  2014-01-26
 */

var homestar = require("homestar")

exports.Model = homestar.make_model('HueLight')
    .facet(":lighting")
    .name("Hue Light")
    .description("Philips Hue colored light")
    .o("on", homestar.boolean.on)
    .o("color", homestar.string.color)
    .make()
    ;

exports.binding = {
    bridge: require('./HueLightBridge').Bridge,
    model: exports.Model,
};
