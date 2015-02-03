/*
 *  HueLightBridge.js
 *
 *  David Janes
 *  IOTDB.org
 *  2015-02-02
 *
 *  Copyright [2013-2015] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use struct";

var iotdb = require('iotdb')
var _ = iotdb.helpers;

var hc = require('./hue-colors');

var unirest = require('unirest');

var bunyan = require('bunyan');
var logger = bunyan.createLogger({
    name: 'iotdb',
    module: 'HueLightBridge',
});

var OFFSET_PUSH = 100000;
var OFFSET_PULL = 200000;


/**
 *  EXEMPLAR and INSTANCE
 *  <p>
 *  No subclassing needed! The following functions are 
 *  injected _after_ this is created, and before .discover and .connect
 *  <ul>
 *  <li><code>discovered</code> - tell IOTDB that we're talking to a new Thing
 *  <li><code>pulled</code> - got new data
 *  <li><code>connected</code> - this is connected to a Thing
 *  <li><code>disconnnected</code> - this has been disconnected from a Thing
 *  </ul>
 */
var HueLightBridge = function(paramd, native) {
    var self = this;

    self.paramd = _.defaults(paramd, {
        number: 0,
        poll: 30,
        account: null,
    });
    self.native = native;
    self.stated = {};

    if (self.native) {
        self.queue = new iotdb.Queue("HueLightBridge");
        self.url = "http://" + self.native.host + ":" + self.native.port +
                    "/api/" + self.paramd.account + "/lights/" + self.paramd.number;
    }
};

/* --- lifecycle --- */

/**
 *  EXEMPLAR. 
 *  Discover Hue
 *  <ul>
 *  <li>look for Things (using <code>self.bridge</code> data to initialize)
 *  <li>find / create a <code>native</code> that does the talking
 *  <li>create an HueLightBridge(native)
 *  <li>call <code>self.discovered(bridge)</code> with it
 */
HueLightBridge.prototype.discover = function() {
    var self = this;
    
    var cp = iotdb.upnp.control_point();

    cp.on("device", function (native) {
        if (native.deviceType !== 'urn:schemas-upnp-org:device:Basic:1') {
            return;
        } else if (native.manufacturer !== 'Royal Philips Electronics') {
            return;
        } else if (native.modelNumber !== '929000226503') {
            return;
        }

        self._discover_native(native);
    });

    cp.search();
};

HueLightBridge.prototype._discover_native = function(native) {
    var self = this;

    logger.info({
        method: "_discover_native",
        device: native.deviceType
    }, "found Hue");

    // has this hub been set up?
    var account_key = "bridges/HueLightBridge/" + native.uuid + "/account";
    var account = iotdb.iot().cfg_get(account_key);
    if (!account) {
        logger.error({
            method: "_discover_native",
            device: native.deviceType
        }, "This Hue is not configured");
        return;
    }

    // self.discovered(new HueLightBridge(self.paramd, native));
    var url = "http://" + native.host + ":" + native.port + "/api/" + account + "/lights";
    unirest
        .get(url)
        .set('Accept', 'application/json')
        .end(function (result) {
            if (!result.ok) {
                logger.error({
                    method: "_discover_native/end()",
                    url: url,
                    result: result.text,
                    cause: "network error or badly configured Hue light?",
                }, "something went wrong finding Hue light");
                return;
            }

            for (var light in result.body) {
                var lightd = result.body[light];

                logger.info({
                    method: "_discover_native/end()",
                    light: light,
                    name: lightd.name,
                }, "make light");

                var paramd = _.defaults({
                    number: parseInt(light),
                    name: lightd.name,
                    account: account,
                }, self.paramd);

                self.discovered(new HueLightBridge(paramd, native));
            }
        });
}

/**
 *  INSTANCE
 *  This is called when the Bridge is no longer needed. When
 */
HueLightBridge.prototype.connect = function() {
    var self = this;
    if (!self.native) {
        return;
    }

    self._setup_polling();
    self.pull();
};

HueLightBridge.prototype._setup_polling = function() {
    var self = this;
    if (!self.paramd.poll) {
        return;
    }

    var timer = setInterval(function() {
        if (!self.native) {
            clearInterval(timer);
            return;
        }

        self.pull();
    }, self.paramd.poll * 1000);
};

HueLightBridge.prototype._forget = function() {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "_forget"
    }, "called");

    self.native = null;
    self.pulled();
}

/**
 *  INSTANCE and EXEMPLAR (during shutdown). 
 *  This is called when the Bridge is no longer needed. 
 */
HueLightBridge.prototype.disconnect = function() {
    var self = this;
    if (!self.native || !self.native) {
        return;
    }

    self._forget();
};

/* --- data --- */

/**
 *  INSTANCE.
 *  Send data to whatever you're taking to.
 */
HueLightBridge.prototype.push = function(pushd) {
    var self = this;
    if (!self.native) {
        return;
    }

    var putd = {};

    if (pushd.on !== undefined) {
        putd.on = pushd.on;
    }

    if (_.isString(pushd.color)) {
        var color = new iotdb.libs.Color(pushd.color);
        if ((color.r === 0) && (color.g === 0) && (color.b === 0)) {
            putd.on = false;
        } else {
            putd.xy = hc.rgbToCIE1931(color.r, color.g, color.b);
            putd.bri = Math.max(color.r, color.g, color.b) * 255;
            putd.on = true;
        }

        self.pulled({
            on: putd.on
        });
    }

    var qitem = {
        id: self.paramd.number + OFFSET_PUSH,
        run: function () {
            var url = self.url + "/state";
            logger.info({
                method: "push",
                url: url
            }, "do");

            unirest
                .put(url)
                .headers({
                    'Accept': 'application/json'
                })
                .type('json')
                .send(putd)
                .end(function (result) {
                    self.queue.finished(qitem);
                    if (!result.ok) {
                        logger.error({
                            method: "push",
                            url: url,
                            result: result.text
                        }, "push failed");
                        return;
                    }

                    logger.info({
                        method: "push",
                        result: result.body,
                        pushd: pushd,
                    }, "pushed");
                });
        }
    };
    self.queue.add(qitem);
};

/**
 *  INSTANCE.
 *  Pull data from whatever we're talking to. You don't
 *  have to implement this if it doesn't make sense
 */
HueLightBridge.prototype.pull = function() {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "pull",
        unique_id: self.unique_id
    }, "called");

    var qitem = {
        id: self.paramd.number + OFFSET_PULL,
        run: function () {
            var url = self.url;
            logger.info({
                method: "pull",
                url: url
            }, "do");
            unirest
                .get(url)
                .headers({
                    'Accept': 'application/json'
                })
                .end(function (result) {
                    self.queue.finished(qitem);
                    if (!result.ok) {
                        logger.error({
                            method: "pull",
                            url: url,
                            result: result
                        }, "not ok");
                        return;
                    }

                    if (result.body && result.body.state) {
                        var changed = false;
                        var state = result.body.state;
                        if (state.on !== undefined) {
                            var value_on = state.on ? true : false;
                            if (value_on !== self.stated['on-value']) {
                                self.stated['on-value'] = value_on;
                                changed = true;
                            }
                        }
                        if ((state.xy !== undefined) && (state.bri !== undefined)) {
                            value_hex = _h2c(state);
                            if (value_hex !== self.stated['color-value']) {
                                self.stated['color-value'] = value_hex;
                                changed = true;
                            }
                        }

                        if (changed) {
                            self.pulled(self.stated);

                            logger.info({
                                method: "pull",
                                light: self.paramd.number,
                                pulld: self.stated,
                            }, "pulled");
                        }
                    }
                });
        }
    };
    self.queue.add(qitem);
    return self;
};

/* --- state --- */

/**
 *  INSTANCE.
 *  Return the metadata - compact form can be used.
 *  Does not have to work when not reachable
 *  <p>
 *  Really really useful things are:
 *  <ul>
 *  <li><code>iot:thing</code> required - a unique ID
 *  <li><code>iot:device</code> suggested if linking multiple things together
 *  <li><code>iot:name</code>
 *  <li><code>iot:number</code>
 *  <li><code>schema:manufacturer</code>
 *  <li><code>schema:model</code>
 */
HueLightBridge.prototype.meta = function() {
    var self = this;
    if (!self.native) {
        return;
    }

    return {
        "iot:thing": _.id.thing_urn.unique("HueLight", self.native.uuid) + "/" + self.paramd.number,
        "iot:device": _.id.thing_urn.unique("HueLight", self.native.uuid),
        "iot:name": self.paramd.name || "Hue",
        "iot:number": self.paramd.number,
        "schema:manufacturer": "http://philips.com/",
        "schema:model": "http://meethue.com/",
    };
};

/**
 *  INSTANCE.
 *  Return True if this is reachable. You 
 *  do not need to worry about connect / disconnect /
 *  shutdown states, they will be always checked first.
 */
HueLightBridge.prototype.reachable = function() {
    return this.native !== null;
};

/**
 *  INSTANCE.
 *  Return True if this is configured. Things
 *  that are not configured are always not reachable.
 *  If not defined, "true" is returned
 */
HueLightBridge.prototype.configured = function() {
    return true;
};

/* --- injected: THIS CODE WILL BE REMOVED AT RUNTIME, DO NOT MODIFY  --- */
HueLightBridge.prototype.discovered = function(bridge) {
    throw new Error("HueLightBridge.discovered not implemented");
};

HueLightBridge.prototype.pulled = function(pulld) {
    throw new Error("HueLightBridge.pulled not implemented");
};

// hack! horrible horrible hack!
var _hueds = null;
function _h2c(state) {
    var hued;

    state.bri1 = state.bri / 255.0;

    if (_hueds === null) {
        _hueds = [];
        for (var name in _.colord) {
            var hex = _.colord[name];
            var color = new iotdb.libs.Color(hex);

            hued = {
                xy: hc.rgbToCIE1931(color.r, color.g, color.b),
                bri1: Math.max(color.r, color.g, color.b),
                hex: color.get_hex(),
            };

            _hueds.push(hued);
        }
    }

    var best = null;
    var distance = 0;
    for (var hi in _hueds) {
        hued = _hueds[hi];
        var xd = state.xy[0] - hued.xy[0];
        var yd = state.xy[1] - hued.xy[1];
        var bd = state.bri1 - hued.bri1;
        var d = Math.sqrt(xd * xd + yd * yd + bd * bd);

        if ((best === null) || (d < distance)) {
            best = hued;
            distance = d;
        }
    }

    if (best) {
        return best.hex;
    }
}

/*
 *  API
 */
exports.Bridge = HueLightBridge;

