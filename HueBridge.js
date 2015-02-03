/*
 *  HueBridge.js
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

var unirest = require('unirest');

var bunyan = require('bunyan');
var logger = bunyan.createLogger({
    name: 'iotdb',
    module: 'HueBridge',
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
var HueBridge = function(paramd, native) {
    var self = this;

    self.paramd = _.defaults(paramd, {
        number: 0,
        account: null,
    });
    self.native = native;

    if (self.native) {
        self.queue = new iotdb.Queue("HueBridge");
        self.url = "http://" + self.native.host + ":" + self.native.port +
                    "/api/" + self.paramd.account + "/lights/" + self.paramd.number + "/state/";
    }
};

/* --- lifecycle --- */

/**
 *  EXEMPLAR. 
 *  Discover Hue
 *  <ul>
 *  <li>look for Things (using <code>self.bridge</code> data to initialize)
 *  <li>find / create a <code>native</code> that does the talking
 *  <li>create an HueBridge(native)
 *  <li>call <code>self.discovered(bridge)</code> with it
 */
HueBridge.prototype.discover = function() {
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

HueBridge.prototype._discover_native = function(native) {
    var self = this;

    logger.info({
        method: "_discover_native",
        device: native.deviceType
    }, "found Hue");

    // has this hub been set up?
    var account_key = "bridges/HueBridge/" + native.uuid + "/account";
    var account = iotdb.iot().cfg_get(account_key);
    if (!account) {
        logger.error({
            method: "_discover_native",
            device: native.deviceType
        }, "This Hue is not configured");
        return;
    }

    // self.discovered(new HueBridge(self.paramd, native));
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

                self.discovered(new HueBridge(paramd, native));
            }
        });
}

/**
 *  INSTANCE
 *  This is called when the Bridge is no longer needed. When
 */
HueBridge.prototype.connect = function() {
    var self = this;
    if (!self.native) {
        return;
    }
};

HueBridge.prototype._forget = function() {
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
 *  This is called when the Bridge is no longer needed. When
 */
HueBridge.prototype.disconnect = function() {
    var self = this;
    if (!self.native || !self.native) {
        return;
    }

};

/* --- data --- */

/**
 *  INSTANCE.
 *  Send data to whatever you're taking to.
 */
HueBridge.prototype.push = function(pushd) {
    var self = this;
    if (!self.native) {
        return;
    }

    var putd = {};

    if (pushd.on !== undefined) {
        putd.on = pushd.on;
    }

    var qitem = {
        id: self.light + OFFSET_PUSH,
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
                        // console.log("# HueDriver.push", "not ok", "url", url, "result", result.text);
                        logger.error({
                            method: "push",
                            url: url,
                            result: result.text
                        }, "push failed");
                        return;
                    }

                    // console.log("- HueDriver.push", result.body);
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
HueBridge.prototype.pull = function() {
    var self = this;
    if (!self.native) {
        return;
    }
};

/* --- state --- */

/**
 *  INSTANCE.
 *  Return the identify of this thing: basically
 *  a dictionary of what uniquely identifies this,
 *  based <code>self.native</code>.
 *  <p>
 *  There <b>must</b> be something in the dictionary!
 */
HueBridge.prototype.identity = function() {
    var self = this;

    return {
        bridge: "HueBridge",
        uuid: self.native.uuid,
    };
};

/**
 *  INSTANCE.
 *  Return the metadata - compact form can be used.
 *  Does not have to work when not reachable
 *  <p>
 *  Really really useful things are:
 *  <ul>
 *  <li><code>iot:name</code>
 *  <li><code>iot:number</code>
 *  <li><code>schema:manufacturer</code>
 *  <li><code>schema:model</code>
 */
HueBridge.prototype.meta = function() {
    var self = this;
    if (!self.native) {
        return;
    }

    return {
        "iot:name": self.paramd.name || "Hue",
        "iot:number": self.paramd.number,
        "iot:dsid": "urn:iotdb:bridge:HueBridge:" + self.native.uuid,
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
HueBridge.prototype.reachable = function() {
    return this.native !== null;
};

/**
 *  INSTANCE.
 *  Return True if this is configured. Things
 *  that are not configured are always not reachable.
 *  If not defined, "true" is returned
 */
HueBridge.prototype.configured = function() {
    return true;
};

/* --- injected: THIS CODE WILL BE REMOVED AT RUNTIME, DO NOT MODIFY  --- */
HueBridge.prototype.discovered = function(bridge) {
    throw new Error("HueBridge.discovered not implemented");
};

HueBridge.prototype.pulled = function(pulld) {
    throw new Error("HueBridge.pulled not implemented");
};

/*
 *  API
 */
exports.Bridge = HueBridge;
