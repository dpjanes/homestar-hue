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

"use strict";

var iotdb = require('iotdb');
var _ = iotdb._;
var unirest = require('unirest');

var hc = require('./hue-colors');

var path = require('path');
var util = require('util');

var logger = iotdb.logger({
    name: 'homestar-hue',
    module: 'HueLightBridge',
});

var OFFSET_PUSH = 100000;
var OFFSET_PULL = 200000;


/**
 *  See {iotdb.bridge.Bridge#Bridge} for documentation.
 *  <p>
 *  @param {object|undefined} native
 *  only used for instances, should be 
 */
var HueLightBridge = function (initd, native) {
    var self = this;

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/HueLightBridge/initd"), {
            name: null,
            number: 0,
            poll: 30,
            account: null,
        }
    );
    self.native = native;
    self.stated = {};

    if (self.native) {
        self.queue = _.queue("HueLightBridge");
        self.url = "http://" + self.native.host + ":" + self.native.port +
            "/api/" + self.initd.account + "/lights/" + self.initd.number;
    }
};

HueLightBridge.prototype = new iotdb.Bridge();

HueLightBridge.prototype.name = function () {
    return "HueLightBridge";
};

/* --- lifecycle --- */

/**
 *  See {iotdb.bridge.Bridge#discover} for documentation.
 */
HueLightBridge.prototype.discover = function () {
    var self = this;

    var cp = require("iotdb-upnp").control_point();

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

HueLightBridge.prototype._discover_native = function (native) {
    var self = this;

    logger.info({
        method: "_discover_native",
        device: native.deviceType
    }, "found Hue");

    // has this hub been set up?
    var account_key = "/bridges/HueLightBridge/" + native.uuid + "/account";
    var account = iotdb.keystore().get(account_key);
    if (!account) {
        logger.error({
            method: "_discover_native",
            device: native.deviceType
        }, "This Hue is not configured");
        return;
    }

    // self.discovered(new HueLightBridge(self.initd, native));
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
                var name = lightd.name;

                logger.info({
                    method: "_discover_native/end()",
                    light: light,
                    name: name,
                }, "make light");

                var paramd = _.defaults({
                    number: parseInt(light),
                    name: name,
                    account: account,
                }, self.initd);

                self.discovered(new HueLightBridge(paramd, native));
            }
        });
};

/**
 *  See {iotdb.bridge.Bridge#connect} for documentation.
 */
HueLightBridge.prototype.connect = function (connectd) {
    var self = this;
    if (!self.native) {
        return;
    }

    self._validate_connect(connectd);

    self._setup_polling();
    self.pull();
};

HueLightBridge.prototype._setup_polling = function () {
    var self = this;
    if (!self.initd.poll) {
        return;
    }

    var timer = setInterval(function () {
        if (!self.native) {
            clearInterval(timer);
            return;
        }

        self.pull();
    }, self.initd.poll * 1000);
};

HueLightBridge.prototype._forget = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "_forget"
    }, "called");

    self.native = null;
    self.pulled();
};

/**
 *  See {iotdb.bridge.Bridge#disconnect} for documentation.
 */
HueLightBridge.prototype.disconnect = function () {
    var self = this;
    if (!self.native || !self.native) {
        return;
    }

    self._forget();
};

/* --- data --- */

/**
 *  See {iotdb.bridge.Bridge#push} for documentation.
 */
HueLightBridge.prototype.push = function (pushd, done) {
    var self = this;
    if (!self.native) {
        done(new Error("not connected"));
        return;
    }

    self._validate_push(pushd);

    var putd = {};

    if (pushd.on !== undefined) {
        putd.on = pushd.on;
    }

    if (_.is.String(pushd.color)) {
        var color = new _.Color(pushd.color);
        if ((color.r === 0) && (color.g === 0) && (color.b === 0)) {
            putd.on = false;
        } else {
            putd.xy = hc.rgbToCIE1931(color.r, color.g, color.b);
            putd.bri = Math.max(color.r, color.g, color.b) * 255;
            putd.on = true;
        }
    }

    var qitem = {
        id: self.initd.number + OFFSET_PUSH,
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
                        // done(new Error("push failed: " + result.text));
                        return;
                    }

                    logger.info({
                        method: "push",
                        result: result.body,
                        pushd: pushd,
                    }, "pushed");

                    // we just assume it worked and can update the istate 
                    pushd = _.clone(pushd);
                    if (putd.on !== undefined) {
                        pushd.on = putd.on;
                    }
                    self.pulled(pushd);
                });
        },
        coda: function () {
            done();
        },
    };
    self.queue.add(qitem);
};

/**
 *  See {iotdb.bridge.Bridge#pull} for documentation.
 */
HueLightBridge.prototype.pull = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    logger.debug({
        method: "pull",
        unique_id: self.unique_id
    }, "called");

    var qitem = {
        id: self.initd.number + OFFSET_PULL,
        run: function () {
            var url = self.url;
            logger.debug({
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
                            if (value_on !== self.stated['on']) {
                                self.stated['on'] = value_on;
                                changed = true;
                            }
                        }
                        if ((state.xy !== undefined) && (state.bri !== undefined)) {
                            var value_hex = _h2c(state);
                            if (value_hex !== self.stated['color']) {
                                self.stated['color'] = value_hex;
                                changed = true;
                            }
                        }

                        if (changed) {
                            self.pulled(self.stated);

                            logger.debug({
                                method: "pull",
                                light: self.initd.number,
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
 *  See {iotdb.bridge.Bridge#meta} for documentation.
 */
HueLightBridge.prototype.meta = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    return {
        "iot:thing-id": _.id.thing_urn.unique("HueLight", self.native.uuid, self.initd.number),
        "iot:device-id": _.id.thing_urn.unique("HueLight", self.native.uuid),
        "schema:name": self.initd.name || "Hue",
        "iot:thing-number": self.initd.number,
        "schema:manufacturer": "http://philips.com/",
        "schema:model": "http://meethue.com/",
    };
};

/**
 *  See {iotdb.bridge.Bridge#reachable} for documentation.
 */
HueLightBridge.prototype.reachable = function () {
    return this.native !== null;
};

/**
 *  App is actually an express router
 */
HueLightBridge.prototype.configure = function (app) {
    var self = this;

    self.html_root = app.html_root || "/";

    var ds = self._find_devices_to_configure();

    app.use('/$', function (request, response) {
        self._configure_devices(request, response);
    });
    app.use('/uuid/:uuid$', function (request, response) {
        self._configure_device(request, response);
    });

    return "Philips Hue Light";
};

HueLightBridge.prototype._configure_devices = function (request, response) {
    var self = this;

    var template = path.join(__dirname, "templates", "devices.html");
    var templated = {
        html_root: self.html_root,
        devices: self._find_devices_to_configure(),
    };

    response
        .set('Content-Type', 'text/html')
        .render(template, templated);
};

HueLightBridge.prototype._configure_device = function (request, response) {
    var self = this;

    // find the UUID
    var native = null;
    var ds = self._find_devices_to_configure();
    for (var di in ds) {
        var d = ds[di];
        if (d.uuid === request.params.uuid) {
            native = d;
            break;
        }
    }

    if (native && (request.query.action === "pair")) {
        return self._pair_device(request, response, native);
    } else {
        return self._prepair_device(request, response, native);
    }
};

HueLightBridge.prototype._prepair_device = function (request, response, native) {
    var self = this;

    var template;
    var templated = {
        html_root: self.html_root,
        device: native,
    };

    if (native) {
        template = path.join(__dirname, "templates", "pair.html");
    } else {
        template = path.join(__dirname, "templates", "error.html");
        templated.error = "This Hue has not been found yet - try reloading?";
    }

    response
        .set('Content-Type', 'text/html')
        .render(template, templated);
};

HueLightBridge.prototype._pair_device = function (request, response, native) {
    var self = this;

    var account_value = "hue" + _.uid(16);
    var account_key = "/bridges/HueLightBridge/" + native.uuid + "/account";

    var url = "http://" + native.host + ":" + native.port + "/api";
    unirest
        .post(url)
        .headers({
            'Accept': 'application/json'
        })
        .type('json')
        .send({
            devicetype: "test user",
            username: account_value
        })
        .end(function (result) {
            var template;
            var templated = {
                html_root: self.html_root,
                device: native,
            };

            var error = null;
            var success = null;

            if (!result.ok) {
                template = path.join(__dirname, "templates", "error.html");
                templated.error = result.text;
            } else if (result.body && result.body.length && result.body[0].error) {
                error = result.body[0].error;
                if (error && error.description) {
                    templated.error = error.description;
                } else {
                    templated.error = "could not get error description";
                }
                template = path.join(__dirname, "templates", "error.html");
            } else {
                template = path.join(__dirname, "templates", "success.html");

                iotdb.keystore().save(account_key, account_value);
            }

            response
                .set('Content-Type', 'text/html')
                .render(template, templated);
        });
};

var _dd;

HueLightBridge.prototype._find_devices_to_configure = function () {
    var self = this;

    if (_dd === undefined) {
        _dd = {};

        var cp = iotdb.module("iotdb-upnp").control_point();

        cp.on("device", function (native) {
            if (_dd[native.uuid]) {
                return;
            } else if (native.deviceType !== 'urn:schemas-upnp-org:device:Basic:1') {
                return;
            } else if (native.manufacturer !== 'Royal Philips Electronics') {
                return;
            } else if (native.modelNumber !== '929000226503') {
                return;
            }

            var account_key = "/bridges/HueLightBridge/" + native.uuid + "/account";
            var account = iotdb.keystore().get(account_key);

            native.is_configured = account ? true : false;
            _dd[native.uuid] = native;

        });
    }

    var ds = [];
    // 
    for (var di in _dd) {
        var d = _dd[di];
        ds.push(d);
    }

    ds.sort(function compare(a, b) {
        if (a.friendlyName < b.friendlyName) {
            return -1;
        } else if (a.friendlyName > b.friendlyName) {
            return 1;
        } else {
            return 0;
        }
    });

    return ds;
};

// hack! horrible horrible hack!
var _hueds = null;

function _h2c(state) {
    var hued;

    state.bri1 = state.bri / 255.0;

    if (_hueds === null) {
        _hueds = [];
        for (var name in _.color.colord) {
            var hex = _.color.colord[name];
            var color = new _.Color(hex);

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
