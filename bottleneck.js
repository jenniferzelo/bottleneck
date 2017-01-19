(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Generated by CoffeeScript 1.11.0
(function() {
  var Bottleneck, MIDDLE_PRIORITY, NB_PRIORITIES,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    slice = [].slice;

  NB_PRIORITIES = 10;

  MIDDLE_PRIORITY = 5;

  Bottleneck = (function() {
    var e;

    Bottleneck.strategy = Bottleneck.prototype.strategy = {
      LEAK: 1,
      OVERFLOW: 2,
      OVERFLOW_PRIORITY: 4,
      BLOCK: 3
    };

    Bottleneck.Cluster = Bottleneck.prototype.Cluster = require("./Cluster");

    Bottleneck.DLList = Bottleneck.prototype.DLList = require("./DLList");

    Bottleneck.Promise = Bottleneck.prototype.Promise = (function() {
      try {
        return require("bluebird");
      } catch (error) {
        e = error;
        return typeof Promise !== "undefined" && Promise !== null ? Promise : function() {
          throw new Error("Bottleneck: install 'bluebird' or use Node 0.12 or higher for Promise support");
        };
      }
    })();

    function Bottleneck(maxNb, minTime, highWater, strategy, rejectOnDrop) {
      this.maxNb = maxNb != null ? maxNb : 0;
      this.minTime = minTime != null ? minTime : 0;
      this.highWater = highWater != null ? highWater : -1;
      this.strategy = strategy != null ? strategy : Bottleneck.prototype.strategy.LEAK;
      this.rejectOnDrop = rejectOnDrop != null ? rejectOnDrop : false;
      this.schedulePriority = bind(this.schedulePriority, this);
      this.submitPriority = bind(this.submitPriority, this);
      this.submit = bind(this.submit, this);
      this._nextRequest = Date.now();
      this._nbRunning = 0;
      this._queues = this._makeQueues();
      this._running = {};
      this._nextIndex = 0;
      this._unblockTime = 0;
      this.penalty = (15 * this.minTime) || 5000;
      this.interrupt = false;
      this.reservoir = null;
      this.limiter = null;
      this.events = {};
    }

    Bottleneck.prototype._trigger = function(name, args) {
      if (this.rejectOnDrop && name === "dropped") {
        args[0].cb.apply({}, [new Error("This job has been dropped by Bottleneck")]);
      }
      return setTimeout(((function(_this) {
        return function() {
          var ref;
          return (ref = _this.events[name]) != null ? ref.forEach(function(e) {
            return e.apply({}, args);
          }) : void 0;
        };
      })(this)), 0);
    };

    Bottleneck.prototype._makeQueues = function() {
      var i, j, ref, results;
      results = [];
      for (i = j = 1, ref = NB_PRIORITIES; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        results.push(new Bottleneck.prototype.DLList());
      }
      return results;
    };

    Bottleneck.prototype.chain = function(limiter) {
      this.limiter = limiter;
      return this;
    };

    Bottleneck.prototype.isBlocked = function() {
      return this._unblockTime >= Date.now();
    };

    Bottleneck.prototype._sanitizePriority = function(priority) {
      var sProperty;
      sProperty = ~~priority !== priority ? MIDDLE_PRIORITY : priority;
      if (sProperty < 0) {
        return 0;
      } else if (sProperty > NB_PRIORITIES - 1) {
        return NB_PRIORITIES - 1;
      } else {
        return sProperty;
      }
    };

    Bottleneck.prototype._find = function(arr, fn) {
      var i, j, len, x;
      for (i = j = 0, len = arr.length; j < len; i = ++j) {
        x = arr[i];
        if (fn(x)) {
          return x;
        }
      }
      return [];
    };

    Bottleneck.prototype.nbQueued = function(priority) {
      if (priority != null) {
        return this._queues[this._sanitizePriority(priority)].length;
      } else {
        return this._queues.reduce((function(a, b) {
          return a + b.length;
        }), 0);
      }
    };

    Bottleneck.prototype.nbRunning = function() {
      return this._nbRunning;
    };

    Bottleneck.prototype._getFirst = function(arr) {
      return this._find(arr, function(x) {
        return x.length > 0;
      });
    };

    Bottleneck.prototype._conditionsCheck = function() {
      return (this.nbRunning() < this.maxNb || this.maxNb <= 0) && ((this.reservoir == null) || this.reservoir > 0);
    };

    Bottleneck.prototype.check = function() {
      return this._conditionsCheck() && (this._nextRequest - Date.now()) <= 0;
    };

    Bottleneck.prototype._tryToRun = function() {
      var done, index, next, queued, wait;
      if (this._conditionsCheck() && (queued = this.nbQueued()) > 0) {
        this._nbRunning++;
        if (this.reservoir != null) {
          this.reservoir--;
        }
        wait = Math.max(this._nextRequest - Date.now(), 0);
        this._nextRequest = Date.now() + wait + this.minTime;
        next = (this._getFirst(this._queues)).shift();
        if (queued === 1) {
          this._trigger("empty", []);
        }
        done = false;
        index = this._nextIndex++;
        this._running[index] = {
          timeout: setTimeout((function(_this) {
            return function() {
              var completed;
              completed = function() {
                var ref;
                if (!done) {
                  done = true;
                  delete _this._running[index];
                  _this._nbRunning--;
                  _this._tryToRun();
                  if (_this.nbRunning() === 0 && _this.nbQueued() === 0) {
                    _this._trigger("idle", []);
                  }
                  if (!_this.interrupt) {
                    return (ref = next.cb) != null ? ref.apply({}, Array.prototype.slice.call(arguments, 0)) : void 0;
                  }
                }
              };
              if (_this.limiter != null) {
                return _this.limiter.submit.apply(_this.limiter, Array.prototype.concat(next.task, next.args, completed));
              } else {
                return next.task.apply({}, next.args.concat(completed));
              }
            };
          })(this), wait),
          job: next
        };
        return true;
      } else {
        return false;
      }
    };

    Bottleneck.prototype.submit = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.submitPriority.apply({}, Array.prototype.concat(MIDDLE_PRIORITY, args));
    };

    Bottleneck.prototype.submitPriority = function() {
      var args, cb, j, job, priority, reachedHighWaterMark, shifted, task;
      priority = arguments[0], task = arguments[1], args = 4 <= arguments.length ? slice.call(arguments, 2, j = arguments.length - 1) : (j = 2, []), cb = arguments[j++];
      job = {
        task: task,
        args: args,
        cb: cb
      };
      priority = this._sanitizePriority(priority);
      reachedHighWaterMark = this.highWater >= 0 && this.nbQueued() === this.highWater && !this.check();
      if (this.strategy === Bottleneck.prototype.strategy.BLOCK && (reachedHighWaterMark || this.isBlocked())) {
        this._unblockTime = Date.now() + this.penalty;
        this._nextRequest = this._unblockTime + this.minTime;
        this._queues = this._makeQueues();
        this._trigger("dropped", [job]);
        return true;
      } else if (reachedHighWaterMark) {
        shifted = this.strategy === Bottleneck.prototype.strategy.LEAK ? (this._getFirst(this._queues.slice(priority).reverse())).shift() : this.strategy === Bottleneck.prototype.strategy.OVERFLOW_PRIORITY ? (this._getFirst(this._queues.slice(priority + 1).reverse())).shift() : this.strategy === Bottleneck.prototype.strategy.OVERFLOW ? job : void 0;
        if (shifted != null) {
          this._trigger("dropped", [shifted]);
        }
        if ((shifted == null) || this.strategy === Bottleneck.prototype.strategy.OVERFLOW) {
          return reachedHighWaterMark;
        }
      }
      this._queues[priority].push(job);
      this._tryToRun();
      return reachedHighWaterMark;
    };

    Bottleneck.prototype.schedule = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this.schedulePriority.apply({}, Array.prototype.concat(MIDDLE_PRIORITY, args));
    };

    Bottleneck.prototype.schedulePriority = function() {
      var args, priority, task, wrapped;
      priority = arguments[0], task = arguments[1], args = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      wrapped = function() {
        var args, cb, j;
        args = 2 <= arguments.length ? slice.call(arguments, 0, j = arguments.length - 1) : (j = 0, []), cb = arguments[j++];
        return (task.apply({}, args)).then(function() {
          var args;
          args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          return cb.apply({}, Array.prototype.concat(null, args));
        })["catch"](function() {
          var args;
          args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          return cb.apply({}, args);
        });
      };
      return new Bottleneck.prototype.Promise((function(_this) {
        return function(resolve, reject) {
          return _this.submitPriority.apply({}, Array.prototype.concat(priority, wrapped, args, function() {
            var args;
            args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
            return (args[0] != null ? reject : (args.shift(), resolve)).apply({}, args);
          }));
        };
      })(this));
    };

    Bottleneck.prototype.changeSettings = function(maxNb, minTime, highWater, strategy, rejectOnDrop) {
      this.maxNb = maxNb != null ? maxNb : this.maxNb;
      this.minTime = minTime != null ? minTime : this.minTime;
      this.highWater = highWater != null ? highWater : this.highWater;
      this.strategy = strategy != null ? strategy : this.strategy;
      this.rejectOnDrop = rejectOnDrop != null ? rejectOnDrop : this.rejectOnDrop;
      while (this._tryToRun()) {}
      return this;
    };

    Bottleneck.prototype.changePenalty = function(penalty) {
      this.penalty = penalty != null ? penalty : this.penalty;
      return this;
    };

    Bottleneck.prototype.changeReservoir = function(reservoir) {
      this.reservoir = reservoir;
      while (this._tryToRun()) {}
      return this;
    };

    Bottleneck.prototype.incrementReservoir = function(incr) {
      if (incr == null) {
        incr = 0;
      }
      this.changeReservoir(this.reservoir + incr);
      return this;
    };

    Bottleneck.prototype.on = function(name, cb) {
      if (this.events[name] != null) {
        this.events[name].push(cb);
      } else {
        this.events[name] = [cb];
      }
      return this;
    };

    Bottleneck.prototype.removeAllListeners = function(name) {
      if (name == null) {
        name = null;
      }
      if (name != null) {
        delete this.events[name];
      } else {
        this.events = {};
      }
      return this;
    };

    Bottleneck.prototype.stopAll = function(interrupt) {
      var j, job, k, keys, l, len, len1;
      this.interrupt = interrupt != null ? interrupt : this.interrupt;
      keys = Object.keys(this._running);
      for (j = 0, len = keys.length; j < len; j++) {
        k = keys[j];
        clearTimeout(this._running[k].timeout);
      }
      this._tryToRun = function() {};
      this.check = function() {
        return false;
      };
      this.submit = this.submitPriority = function() {
        var args, cb, l;
        args = 2 <= arguments.length ? slice.call(arguments, 0, l = arguments.length - 1) : (l = 0, []), cb = arguments[l++];
        return cb(new Error("This limiter is stopped"));
      };
      this.schedule = this.schedulePriority = function() {
        return Promise.reject(new Error("This limiter is stopped"));
      };
      if (this.interrupt) {
        for (l = 0, len1 = keys.length; l < len1; l++) {
          k = keys[l];
          this._trigger("dropped", [this._running[k].job]);
        }
      }
      while (job = (this._getFirst(this._queues)).shift()) {
        this._trigger("dropped", [job]);
      }
      this._trigger("empty", []);
      if (this.nbRunning() === 0) {
        this._trigger("idle", []);
      }
      return this;
    };

    return Bottleneck;

  })();

  module.exports = Bottleneck;

}).call(this);

},{"./Cluster":2,"./DLList":3,"bluebird":undefined}],2:[function(require,module,exports){
// Generated by CoffeeScript 1.11.0
(function() {
  var Cluster,
    hasProp = {}.hasOwnProperty;

  Cluster = (function() {
    function Cluster(maxNb, minTime, highWater, strategy, rejectOnDrop) {
      this.maxNb = maxNb;
      this.minTime = minTime;
      this.highWater = highWater;
      this.strategy = strategy;
      this.rejectOnDrop = rejectOnDrop;
      this.limiters = {};
      this.Bottleneck = require("./Bottleneck");
      this.startAutoCleanup();
    }

    Cluster.prototype.key = function(key) {
      var ref;
      if (key == null) {
        key = "";
      }
      return (ref = this.limiters[key]) != null ? ref : (this.limiters[key] = new this.Bottleneck(this.maxNb, this.minTime, this.highWater, this.strategy, this.rejectOnDrop));
    };

    Cluster.prototype.deleteKey = function(key) {
      if (key == null) {
        key = "";
      }
      return delete this.limiters[key];
    };

    Cluster.prototype.all = function(cb) {
      var k, ref, results, v;
      ref = this.limiters;
      results = [];
      for (k in ref) {
        if (!hasProp.call(ref, k)) continue;
        v = ref[k];
        results.push(cb(v));
      }
      return results;
    };

    Cluster.prototype.keys = function() {
      return Object.keys(this.limiters);
    };

    Cluster.prototype.startAutoCleanup = function() {
      var base;
      this.stopAutoCleanup();
      return typeof (base = (this.interval = setInterval((function(_this) {
        return function() {
          var k, ref, results, time, v;
          time = Date.now();
          ref = _this.limiters;
          results = [];
          for (k in ref) {
            v = ref[k];
            if ((v._nextRequest + (1000 * 60 * 5)) < time) {
              results.push(_this.deleteKey(k));
            } else {
              results.push(void 0);
            }
          }
          return results;
        };
      })(this), 1000 * 30))).unref === "function" ? base.unref() : void 0;
    };

    Cluster.prototype.stopAutoCleanup = function() {
      return clearInterval(this.interval);
    };

    return Cluster;

  })();

  module.exports = Cluster;

}).call(this);

},{"./Bottleneck":1}],3:[function(require,module,exports){
// Generated by CoffeeScript 1.11.0
(function() {
  var DLList;

  DLList = (function() {
    function DLList() {
      this._first = null;
      this._last = null;
      this.length = 0;
    }

    DLList.prototype.push = function(value) {
      var node;
      this.length++;
      node = {
        value: value,
        next: null
      };
      if (this._last != null) {
        this._last.next = node;
        this._last = node;
      } else {
        this._first = this._last = node;
      }
      return void 0;
    };

    DLList.prototype.shift = function() {
      var ref1, value;
      if (this._first == null) {
        return void 0;
      } else {
        this.length--;
      }
      value = this._first.value;
      this._first = (ref1 = this._first.next) != null ? ref1 : (this._last = null);
      return value;
    };

    DLList.prototype.getArray = function() {
      var node, ref, results;
      node = this._first;
      results = [];
      while (node != null) {
        results.push((ref = node, node = node.next, ref.value));
      }
      return results;
    };

    return DLList;

  })();

  module.exports = DLList;

}).call(this);

},{}],4:[function(require,module,exports){
(function (global){
// Generated by CoffeeScript 1.11.0
(function() {
  module.exports = require("./Bottleneck");

  if (global.window != null) {
    global.window.Bottleneck = module.exports;
  }

}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Bottleneck":1}]},{},[4]);
