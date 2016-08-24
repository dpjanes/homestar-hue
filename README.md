# homestar-hue
[IOTDB](https://github.com/dpjanes/node-iotdb) Bridge to connect and control Philips Hue Lights.

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

# About

See <a href="samples/">the samples</a> for details how to add to your project,
particularly <code>model.js</code> for standalone
and <code>iotdb.js</code> for HomeStar/IOTDB.

* [Read about Bridges](https://github.com/dpjanes/node-iotdb/blob/master/docs/bridges.md)

# Installation and Configuration

* [Read this first](https://github.com/dpjanes/node-iotdb/blob/master/docs/install.md)
* [Read about installing Home☆Star](https://github.com/dpjanes/node-iotdb/blob/master/docs/homestar.md) 

    $ npm install -g homestar    ## may require sudo
    $ homestar setup
    $ npm install homestar-hue
    $ homestar configure homestar-hue

# Use

Code to set all lights to red:

    const iotdb = require("iotdb")
    iotdb.use("homestar-hue");

    iotdb.connect("HueLight").set(":color", "red");

# Models
## HueLight

Control Philips Hue lights:

Functionality:

* discover Hue hubs and individual lights
* turn lights on and off
* set light color
* get same
* configure Hue lights (coming soon)

## HueLightModel

* <code>on</code>: true or false.  <code>iot-attribute:on</code>
* <code>color</code>: a hex color ("#FF0000").  <code>iot-attribute:color</code>

e.g.

    {
        "on": true,
        "color": "#FF0000"
    }

