/*
 *  HueLightModel.js
 *
 *  David Janes
 *  IOTDB
 *  2014-01-26
 */

var iotdb = require("iotdb");

exports.binding = {
    bridge: require('../HueLightBridge').Bridge,
    model: require('./HueLight.json'),
};
