import {
  __esm,
  __export
} from "./chunk-OWFZW76L.js";

// ../../node_modules/.pnpm/oblivious-set@1.1.1/node_modules/oblivious-set/dist/es/index.js
var es_exports = {};
__export(es_exports, {
  ObliviousSet: () => ObliviousSet,
  now: () => now,
  removeTooOldValues: () => removeTooOldValues
});
function removeTooOldValues(obliviousSet) {
  var olderThen = now() - obliviousSet.ttl;
  var iterator = obliviousSet.map[Symbol.iterator]();
  while (true) {
    var next = iterator.next().value;
    if (!next) {
      return;
    }
    var value = next[0];
    var time = next[1];
    if (time < olderThen) {
      obliviousSet.map.delete(value);
    } else {
      return;
    }
  }
}
function now() {
  return (/* @__PURE__ */ new Date()).getTime();
}
var ObliviousSet;
var init_es = __esm({
  "../../node_modules/.pnpm/oblivious-set@1.1.1/node_modules/oblivious-set/dist/es/index.js"() {
    ObliviousSet = /** @class */
    function() {
      function ObliviousSet2(ttl) {
        this.ttl = ttl;
        this.map = /* @__PURE__ */ new Map();
        this._to = false;
      }
      ObliviousSet2.prototype.has = function(value) {
        return this.map.has(value);
      };
      ObliviousSet2.prototype.add = function(value) {
        var _this = this;
        this.map.set(value, now());
        if (!this._to) {
          this._to = true;
          setTimeout(function() {
            _this._to = false;
            removeTooOldValues(_this);
          }, 0);
        }
      };
      ObliviousSet2.prototype.clear = function() {
        this.map.clear();
      };
      return ObliviousSet2;
    }();
  }
});

// ../../node_modules/.pnpm/unload@2.4.1/node_modules/unload/dist/es/browser.js
function addBrowser(fn) {
  if (typeof WorkerGlobalScope === "function" && self instanceof WorkerGlobalScope) {
    var oldClose = self.close.bind(self);
    self.close = function() {
      fn();
      return oldClose();
    };
  } else {
    if (typeof window.addEventListener !== "function") {
      return;
    }
    window.addEventListener("beforeunload", function() {
      fn();
    }, true);
    window.addEventListener("unload", function() {
      fn();
    }, true);
  }
}
var init_browser = __esm({
  "../../node_modules/.pnpm/unload@2.4.1/node_modules/unload/dist/es/browser.js"() {
  }
});

// ../../node_modules/.pnpm/unload@2.4.1/node_modules/unload/dist/es/node.js
function addNode(fn) {
  process.on("exit", function() {
    return fn();
  });
  process.on("beforeExit", function() {
    return fn().then(function() {
      return process.exit();
    });
  });
  process.on("SIGINT", function() {
    return fn().then(function() {
      return process.exit();
    });
  });
  process.on("uncaughtException", function(err) {
    return fn().then(function() {
      console.trace(err);
      process.exit(101);
    });
  });
}
var init_node = __esm({
  "../../node_modules/.pnpm/unload@2.4.1/node_modules/unload/dist/es/node.js"() {
  }
});

// ../../node_modules/.pnpm/unload@2.4.1/node_modules/unload/dist/es/index.js
var es_exports2 = {};
__export(es_exports2, {
  add: () => add,
  getSize: () => getSize,
  removeAll: () => removeAll,
  runAll: () => runAll
});
function startListening() {
  if (startedListening) {
    return;
  }
  startedListening = true;
  USE_METHOD(runAll);
}
function add(fn) {
  startListening();
  if (typeof fn !== "function") {
    throw new Error("Listener is no function");
  }
  LISTENERS.add(fn);
  var addReturn = {
    remove: function remove() {
      return LISTENERS["delete"](fn);
    },
    run: function run() {
      LISTENERS["delete"](fn);
      return fn();
    }
  };
  return addReturn;
}
function runAll() {
  var promises = [];
  LISTENERS.forEach(function(fn) {
    promises.push(fn());
    LISTENERS["delete"](fn);
  });
  return Promise.all(promises);
}
function removeAll() {
  LISTENERS.clear();
}
function getSize() {
  return LISTENERS.size;
}
var isNode, USE_METHOD, LISTENERS, startedListening;
var init_es2 = __esm({
  "../../node_modules/.pnpm/unload@2.4.1/node_modules/unload/dist/es/index.js"() {
    init_browser();
    init_node();
    isNode = Object.prototype.toString.call(typeof process !== "undefined" ? process : 0) === "[object process]";
    USE_METHOD = isNode ? addNode : addBrowser;
    LISTENERS = /* @__PURE__ */ new Set();
    startedListening = false;
  }
});

export {
  ObliviousSet,
  es_exports,
  init_es,
  add,
  es_exports2,
  init_es2
};
//# sourceMappingURL=chunk-5EDNRFQB.js.map
