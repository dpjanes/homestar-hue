/*
 *  HueLightModel.js
 *
 *  David Janes
 *  IOTDB
 *  2014-01-26
 */

var iotdb = require("iotdb");

exports.Model = iotdb.make_model('HueLight')
    .facet(":lighting")
    .name("Hue Light")
    .description("Philips Hue colored light")
    .io("on", iotdb.boolean.on)
    .io("color", iotdb.string.color)
    .make();

exports.binding = {
    bridge: require('../HueLightBridge').Bridge,
    model: exports.Model,
};
