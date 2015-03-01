# homestar-hue

Connect and control Philips Hue with HomeStar and IOTDB.

See <a href="samples/">the samples</a> for details how to add to your project,
particularly <code>model.js</code> for standalone
and <code>iotdb.js</code> for HomeStar/IOTDB.

# Quick Start

Set all lights to red

	$ npm install -g homestar ## with 'sudo' if error
	$ homestar setup
	$ homestar install homestar-hue
    $ homestar configure homestar-hue 
	$ node
	>>> iotdb = require('iotdb')
	>>> iot = iotdb.iot()
	>>> things = iot.connect("HueLight")
	>>> things.set(":color", "red")

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

