# homestar-hue
[IOTDB](https://github.com/dpjanes/node-iotdb) Bridge to connect and control Philips Hue Lights.

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

See <a href="samples/">the samples</a> for details how to add to your project,
particularly <code>model.js</code> for standalone
and <code>iotdb.js</code> for HomeStar/IOTDB.

# Installation

Install Home☆Star first. 
See: https://github.com/dpjanes/iotdb-homestar#installation

Then

    $ homestar install homestar-hue

# Quick Start


Installation:

	$ npm install -g homestar ## with 'sudo' if error
	$ homestar setup
	$ homestar install homestar-hue
    $ homestar configure homestar-hue 

Code to set all lights to red:

    const iotdb = require("iotdb")
    iotdb.use("homestar-hue");

    iotdb.connect("HueLight").set(":color", "red");

# Configuration

Run

    $ homestar configure homestar-hue

# HueLight

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

