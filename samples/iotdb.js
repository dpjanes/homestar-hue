/*
 *  How to use this module in IOTDB / HomeStar
 *  This is the best way to do this
 */

var iotdb = require('iotdb') 
var iot = iotdb.iot();

var things = iot.connect('HueLight');

var count = 0;
var colors = [ "#FF0000", "#00FF00", "#0000FF", "#00FFFF", "#FF00FF", "#FFFF00", "#FFFFFF", "#000000", ];
var timer = setInterval(function() {
    things.set(":color", colors[count++ % colors.length]);
}, 2500);
