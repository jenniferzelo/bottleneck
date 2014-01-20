(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Generated by CoffeeScript 1.6.3
(function() {
  var Bottleneck;

  Bottleneck = (function() {
    function Bottleneck(maxNb, minTime) {
      this.maxNb = maxNb != null ? maxNb : 0;
      this.minTime = minTime != null ? minTime : 0;
      this.nextRequest = Date.now();
      this.nbRunning = 0;
      this.queue = [];
      this.timeouts = [];
    }

    Bottleneck.prototype._tryToRun = function() {
      var done, next, wait,
        _this = this;
      if ((this.nbRunning < this.maxNb || this.maxNb <= 0) && this.queue.length > 0) {
        this.nbRunning++;
        wait = Math.max(this.nextRequest - Date.now(), 0);
        this.nextRequest = Date.now() + wait + this.minTime;
        next = this.queue.shift();
        done = false;
        return this.timeouts.push(setTimeout(function() {
          return next.task(function() {
            if (!done) {
              done = true;
              _this.nbRunning--;
              _this._tryToRun();
              return next.cb.apply({}, Array.prototype.slice.call(arguments, 0));
            }
          });
        }, wait));
      }
    };

    Bottleneck.prototype.submit = function(task, cb) {
      this.queue.push({
        task: task,
        cb: cb
      });
      return this._tryToRun();
    };

    Bottleneck.prototype.stopAll = function() {
      var a, _i, _len, _ref;
      _ref = this.timeouts;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        a = _ref[_i];
        clearTimeout(a);
      }
      return this._tryToRun = function() {};
    };

    return Bottleneck;

  })();

  module.exports = Bottleneck;

}).call(this);

},{}],2:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};// Generated by CoffeeScript 1.6.3
(function() {
  module.exports = require("./Bottleneck");

  if (global.window != null) {
    global.window.Bottleneck = module.exports;
  }

}).call(this);

},{"./Bottleneck":1}]},{},[2])