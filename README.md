# homestar-hue

Connect and control Philips Hue with HomeStar and IOTDB.

See <a href="samples/">the samples</a> for details how to add to your project.

IMPORTANT: configuration is not working yet. Let me know if you
need this put in!

# HueLight

Control Philips Hue lights:

Functionality:

* discover Hue hubs and individual lights
* turn lights on and off
* set light color
* get same
* configure Hue lights (coming soon)

## HueLightModel

Semantic.

### Attributes

* <code>iot-attribute:on</code>: true or false
* <code>iot-attribute:color</code>: a hex color ("#FF0000")

## HueLightBridge

Low-level.

#### Push / controls

* <code>on</code>: true or false
* <code>color</code>: a hex color ("#FF0000")

#### Pull / readings

* <code>on-value</code>: true or false
* <code>color-value</code>: a hex color ("#FF0000")
