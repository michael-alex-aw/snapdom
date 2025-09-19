
/*
* snapdom
* v.1.9.11
* Author Juan Martin Muda
* License MIT
**/

(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/core/cache.js
  var cache = {
    image: /* @__PURE__ */ new Map(),
    background: /* @__PURE__ */ new Map(),
    resource: /* @__PURE__ */ new Map(),
    defaultStyle: /* @__PURE__ */ new Map(),
    baseStyle: /* @__PURE__ */ new Map(),
    computedStyle: /* @__PURE__ */ new WeakMap(),
    font: /* @__PURE__ */ new Set(),
    session: {
      styleMap: /* @__PURE__ */ new Map(),
      styleCache: /* @__PURE__ */ new WeakMap(),
      nodeMap: /* @__PURE__ */ new Map()
    }
  };
  function applyCachePolicy(policy = "soft") {
    switch (policy) {
      case "auto": {
        cache.session.styleMap = /* @__PURE__ */ new Map();
        cache.session.nodeMap = /* @__PURE__ */ new Map();
        return;
      }
      case "soft": {
        cache.session.styleMap = /* @__PURE__ */ new Map();
        cache.session.nodeMap = /* @__PURE__ */ new Map();
        cache.session.styleCache = /* @__PURE__ */ new WeakMap();
        return;
      }
      case "full": {
        return;
      }
      case "disabled": {
        cache.session.styleMap = /* @__PURE__ */ new Map();
        cache.session.nodeMap = /* @__PURE__ */ new Map();
        cache.session.styleCache = /* @__PURE__ */ new WeakMap();
        cache.computedStyle = /* @__PURE__ */ new WeakMap();
        cache.baseStyle = /* @__PURE__ */ new Map();
        cache.defaultStyle = /* @__PURE__ */ new Map();
        cache.image = /* @__PURE__ */ new Map();
        cache.background = /* @__PURE__ */ new Map();
        cache.resource = /* @__PURE__ */ new Map();
        cache.font = /* @__PURE__ */ new Set();
        return;
      }
      default: {
        cache.session.styleMap = /* @__PURE__ */ new Map();
        cache.session.nodeMap = /* @__PURE__ */ new Map();
        cache.session.styleCache = /* @__PURE__ */ new WeakMap();
        return;
      }
    }
  }

  // src/utils/helpers.js
  function extractURL(value) {
    const match = value.match(/url\((['"]?)(.*?)(\1)\)/);
    if (!match) return null;
    const url = match[2].trim();
    if (url.startsWith("#")) return null;
    return url;
  }
  function stripTranslate(transform) {
    if (!transform || transform === "none") return "";
    let cleaned = transform.replace(/translate[XY]?\([^)]*\)/g, "");
    cleaned = cleaned.replace(/matrix\(([^)]+)\)/g, (_, values) => {
      const parts = values.split(",").map((s) => s.trim());
      if (parts.length !== 6) return `matrix(${values})`;
      parts[4] = "0";
      parts[5] = "0";
      return `matrix(${parts.join(", ")})`;
    });
    cleaned = cleaned.replace(/matrix3d\(([^)]+)\)/g, (_, values) => {
      const parts = values.split(",").map((s) => s.trim());
      if (parts.length !== 16) return `matrix3d(${values})`;
      parts[12] = "0";
      parts[13] = "0";
      return `matrix3d(${parts.join(", ")})`;
    });
    return cleaned.trim().replace(/\s{2,}/g, " ");
  }
  function safeEncodeURI(uri) {
    if (/%[0-9A-Fa-f]{2}/.test(uri)) return uri;
    try {
      return encodeURI(uri);
    } catch (e) {
      return uri;
    }
  }

  // src/modules/snapFetch.js
  function createSnapLogger(prefix = "[snapDOM]", { ttlMs = 5 * 6e4, maxEntries = 12 } = {}) {
    const seen = /* @__PURE__ */ new Map();
    let emitted = 0;
    function log(level, key, msg) {
      if (emitted >= maxEntries) return;
      const now = Date.now();
      const until = seen.get(key) || 0;
      if (until > now) return;
      seen.set(key, now + ttlMs);
      emitted++;
      if (level === "warn" && console && console.warn) console.warn(`${prefix} ${msg}`);
      else if (console && console.error) console.error(`${prefix} ${msg}`);
    }
    return {
      warnOnce(key, msg) {
        log("warn", key, msg);
      },
      errorOnce(key, msg) {
        log("error", key, msg);
      },
      reset() {
        seen.clear();
        emitted = 0;
      }
    };
  }
  var snapLogger = createSnapLogger("[snapDOM]", { ttlMs: 3 * 6e4, maxEntries: 10 });
  var _inflight = /* @__PURE__ */ new Map();
  var _errorCache = /* @__PURE__ */ new Map();
  function isSpecialURL(url) {
    return /^data:|^blob:|^about:blank$/.test(url);
  }
  function shouldProxy(url, useProxy) {
    if (!useProxy || isSpecialURL(url)) return false;
    try {
      const base = typeof location !== "undefined" && location.href ? location.href : "http://localhost/";
      const u = new URL(url, base);
      return typeof location !== "undefined" ? u.origin !== location.origin : true;
    } catch (e) {
      return !!useProxy;
    }
  }
  function applyProxy(url, useProxy) {
    if (!useProxy) return url;
    if (useProxy.includes("{url}")) return useProxy.replace("{url}", encodeURIComponent(url));
    const sep = useProxy.endsWith("?") ? "" : useProxy.includes("?") ? "&" : "?";
    return `${useProxy}${sep}url=${encodeURIComponent(url)}`;
  }
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result || ""));
      fr.onerror = () => rej(new Error("read_failed"));
      fr.readAsDataURL(blob);
    });
  }
  function makeKey(url, o) {
    var _a, _b;
    return [
      o.as || "blob",
      (_a = o.timeout) != null ? _a : 3e3,
      o.useProxy || "",
      (_b = o.errorTTL) != null ? _b : 8e3,
      url
    ].join("|");
  }
  function snapFetch(_0) {
    return __async(this, arguments, function* (url, options = {}) {
      var _a, _b, _c;
      const as = (_a = options.as) != null ? _a : "blob";
      const timeout = (_b = options.timeout) != null ? _b : 3e3;
      const useProxy = options.useProxy || "";
      const errorTTL = (_c = options.errorTTL) != null ? _c : 8e3;
      const headers = options.headers || {};
      const silent = !!options.silent;
      const key = makeKey(url, { as, timeout, useProxy, errorTTL });
      const e = _errorCache.get(key);
      if (e && e.until > Date.now()) {
        return __spreadProps(__spreadValues({}, e.result), { fromCache: true });
      } else if (e) {
        _errorCache.delete(key);
      }
      const inflight = _inflight.get(key);
      if (inflight) return inflight;
      let finalURL = shouldProxy(url, useProxy) ? applyProxy(url, useProxy) : url;
      const separator = finalURL.includes("?") ? "&" : "?";
      finalURL += `${separator}t=${Date.now()}`;
      let cred = options.credentials;
      if (!cred) {
        try {
          const base = typeof location !== "undefined" && location.href ? location.href : "http://localhost/";
          const u = new URL(url, base);
          const sameOrigin = typeof location !== "undefined" && u.origin === location.origin;
          cred = sameOrigin ? "include" : "omit";
        } catch (e2) {
          cred = "omit";
        }
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort("timeout"), timeout);
      const p = (() => __async(null, null, function* () {
        var _a2, _b2;
        try {
          const resp = yield fetch(finalURL, { signal: ctrl.signal, credentials: cred, headers });
          if (!resp.ok) {
            const result = { ok: false, data: null, status: resp.status, url: finalURL, fromCache: false, reason: "http_error" };
            _errorCache.set(key, { until: Date.now() + errorTTL, result });
            if (!silent) {
              const short = `${resp.status} ${resp.statusText || ""}`.trim();
              snapLogger.warnOnce(
                `http:${resp.status}:${as}:${new URL(url, (_a2 = location == null ? void 0 : location.href) != null ? _a2 : "http://localhost/").origin}`,
                `HTTP error ${short} while fetching ${as} ${url}`
              );
            }
            options.onError && options.onError(result);
            return result;
          }
          if (as === "text") {
            const text = yield resp.text();
            return { ok: true, data: text, status: resp.status, url: finalURL, fromCache: false };
          }
          const blob = yield resp.blob();
          const mime = blob.type || resp.headers.get("content-type") || "";
          if (as === "dataURL") {
            const dataURL = yield blobToDataURL(blob);
            return { ok: true, data: dataURL, status: resp.status, url: finalURL, fromCache: false, mime };
          }
          return { ok: true, data: blob, status: resp.status, url: finalURL, fromCache: false, mime };
        } catch (err) {
          const reason = err && typeof err === "object" && "name" in err && err.name === "AbortError" ? String(err.message || "").includes("timeout") ? "timeout" : "abort" : "network";
          const result = { ok: false, data: null, status: 0, url: finalURL, fromCache: false, reason };
          _errorCache.set(key, { until: Date.now() + errorTTL, result });
          if (!silent) {
            const k = `${reason}:${as}:${new URL(url, (_b2 = location == null ? void 0 : location.href) != null ? _b2 : "http://localhost/").origin}`;
            const tips = reason === "timeout" ? `Timeout after ${timeout}ms. Consider increasing timeout or using a proxy for ${url}` : reason === "abort" ? `Request aborted while fetching ${as} ${url}` : `Network/CORS issue while fetching ${as} ${url}. A proxy may be required`;
            snapLogger.errorOnce(k, tips);
          }
          options.onError && options.onError(result);
          return result;
        } finally {
          clearTimeout(timer);
          _inflight.delete(key);
        }
      }))();
      _inflight.set(key, p);
      return p;
    });
  }

  // src/utils/image.js
  function createBackground(baseCanvas, backgroundColor) {
    if (!backgroundColor || !baseCanvas.width || !baseCanvas.height) {
      return baseCanvas;
    }
    const temp = document.createElement("canvas");
    temp.width = baseCanvas.width;
    temp.height = baseCanvas.height;
    const ctx = temp.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, temp.width, temp.height);
    ctx.drawImage(baseCanvas, 0, 0);
    return temp;
  }
  function inlineSingleBackgroundEntry(_0) {
    return __async(this, arguments, function* (entry, options = {}) {
      const isGradient = /^((repeating-)?(linear|radial|conic)-gradient)\(/i.test(entry);
      if (isGradient || entry.trim() === "none") {
        return entry;
      }
      const rawUrl = extractURL(entry);
      if (!rawUrl) {
        return entry;
      }
      const encodedUrl = safeEncodeURI(rawUrl);
      if (cache.background.has(encodedUrl)) {
        const dataUrl = cache.background.get(encodedUrl);
        return dataUrl ? `url("${dataUrl}")` : "none";
      }
      try {
        const dataUrl = yield snapFetch(encodedUrl, { as: "dataURL", useProxy: options.useProxy });
        if (dataUrl.ok) {
          cache.background.set(encodedUrl, dataUrl.data);
          return `url("${dataUrl.data}")`;
        }
        cache.background.set(encodedUrl, null);
        return "none";
      } catch (e) {
        cache.background.set(encodedUrl, null);
        return "none";
      }
    });
  }

  // src/utils/css.js
  var NO_CAPTURE_TAGS = /* @__PURE__ */ new Set([
    "meta",
    "script",
    "noscript",
    "title",
    "link",
    "template"
  ]);
  var NO_DEFAULTS_TAGS = /* @__PURE__ */ new Set([
    // non-painting / head stuff
    "meta",
    "link",
    "style",
    "title",
    "noscript",
    "script",
    "template",
    // SVG whole namespace (safe for LeaderLine/presentation attrs)
    "g",
    "defs",
    "use",
    "marker",
    "mask",
    "clipPath",
    "pattern",
    "path",
    "polygon",
    "polyline",
    "line",
    "circle",
    "ellipse",
    "rect",
    "filter",
    "lineargradient",
    "radialgradient",
    "stop"
  ]);
  var commonTags = [
    "div",
    "span",
    "p",
    "a",
    "img",
    "ul",
    "li",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "section",
    "article",
    "header",
    "footer",
    "nav",
    "main",
    "aside",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th"
  ];
  function precacheCommonTags() {
    for (let tag of commonTags) {
      const t = String(tag).toLowerCase();
      if (NO_CAPTURE_TAGS.has(t)) continue;
      if (NO_DEFAULTS_TAGS.has(t)) continue;
      getDefaultStyleForTag(t);
    }
  }
  function getDefaultStyleForTag(tagName) {
    tagName = String(tagName).toLowerCase();
    if (NO_DEFAULTS_TAGS.has(tagName)) {
      const empty = {};
      cache.defaultStyle.set(tagName, empty);
      return empty;
    }
    if (cache.defaultStyle.has(tagName)) {
      return cache.defaultStyle.get(tagName);
    }
    let sandbox = document.getElementById("snapdom-sandbox");
    if (!sandbox) {
      sandbox = document.createElement("div");
      sandbox.id = "snapdom-sandbox";
      sandbox.setAttribute("data-snapdom-sandbox", "true");
      sandbox.setAttribute("aria-hidden", "true");
      sandbox.style.position = "absolute";
      sandbox.style.left = "-9999px";
      sandbox.style.top = "-9999px";
      sandbox.style.width = "0px";
      sandbox.style.height = "0px";
      sandbox.style.overflow = "hidden";
      document.body.appendChild(sandbox);
    }
    const el = document.createElement(tagName);
    el.style.all = "initial";
    sandbox.appendChild(el);
    const styles = getComputedStyle(el);
    const defaults = {};
    for (let prop of styles) {
      if (shouldIgnoreProp(prop)) continue;
      const value = styles.getPropertyValue(prop);
      defaults[prop] = value;
    }
    sandbox.removeChild(el);
    cache.defaultStyle.set(tagName, defaults);
    return defaults;
  }
  var NO_PAINT_TOKEN = /(?:^|-)(animation|transition)(?:-|$)/i;
  var NO_PAINT_PREFIX = /^(--|view-timeline|scroll-timeline|animation-trigger|offset-|position-try|app-region|interactivity|overlay|view-transition|-webkit-locale|-webkit-user-(?:drag|modify)|-webkit-tap-highlight-color|-webkit-text-security)$/i;
  var NO_PAINT_EXACT = /* @__PURE__ */ new Set([
    // Interaction hints
    "cursor",
    "pointer-events",
    "touch-action",
    "user-select",
    // Printing/speech/reading-mode hints
    "print-color-adjust",
    "speak",
    "reading-flow",
    "reading-order",
    // Anchoring/container/timeline scopes (metadata for layout queries)
    "anchor-name",
    "anchor-scope",
    "container-name",
    "container-type",
    "timeline-scope"
  ]);
  function shouldIgnoreProp(prop) {
    const p = String(prop).toLowerCase();
    if (NO_PAINT_EXACT.has(p)) return true;
    if (NO_PAINT_PREFIX.test(p)) return true;
    if (NO_PAINT_TOKEN.test(p)) return true;
    return false;
  }
  function getStyleKey(snapshot, tagName) {
    tagName = String(tagName || "").toLowerCase();
    if (NO_DEFAULTS_TAGS.has(tagName)) {
      return "";
    }
    const entries = [];
    const defaults = getDefaultStyleForTag(tagName);
    for (let [prop, value] of Object.entries(snapshot)) {
      if (shouldIgnoreProp(prop)) continue;
      const def = defaults[prop];
      if (value && value !== def) entries.push(`${prop}:${value}`);
    }
    entries.sort();
    return entries.join(";");
  }
  function collectUsedTagNames(root) {
    const tagSet = /* @__PURE__ */ new Set();
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return [];
    }
    if (root.tagName) {
      tagSet.add(root.tagName.toLowerCase());
    }
    if (typeof root.querySelectorAll === "function") {
      root.querySelectorAll("*").forEach((el) => tagSet.add(el.tagName.toLowerCase()));
    }
    return Array.from(tagSet);
  }
  function generateDedupedBaseCSS(usedTagNames) {
    const groups = /* @__PURE__ */ new Map();
    for (let tagName of usedTagNames) {
      const styles = cache.defaultStyle.get(tagName);
      if (!styles) continue;
      const key = Object.entries(styles).map(([k, v]) => `${k}:${v};`).sort().join("");
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(tagName);
    }
    let css = "";
    for (let [styleBlock, tagList] of groups.entries()) {
      css += `${tagList.join(",")} { ${styleBlock} }
`;
    }
    return css;
  }
  function generateCSSClasses(styleMap) {
    const keys = Array.from(new Set(styleMap.values())).filter(Boolean).sort();
    const classMap = /* @__PURE__ */ new Map();
    let i = 1;
    for (const k of keys) classMap.set(k, `c${i++}`);
    return classMap;
  }
  function getStyle(el, pseudo = null) {
    if (!(el instanceof Element)) {
      return window.getComputedStyle(el, pseudo);
    }
    let map = cache.computedStyle.get(el);
    if (!map) {
      map = /* @__PURE__ */ new Map();
      cache.computedStyle.set(el, map);
    }
    if (!map.has(pseudo)) {
      const st = window.getComputedStyle(el, pseudo);
      map.set(pseudo, st);
    }
    return map.get(pseudo);
  }
  function parseContent(content) {
    let clean = content.replace(/^['"]|['"]$/g, "");
    if (clean.startsWith("\\")) {
      try {
        return String.fromCharCode(parseInt(clean.replace("\\", ""), 16));
      } catch (e) {
        return clean;
      }
    }
    return clean;
  }
  function snapshotComputedStyle(style) {
    const snap = {};
    for (let prop of style) {
      snap[prop] = style.getPropertyValue(prop);
    }
    return snap;
  }
  function splitBackgroundImage(bg) {
    const parts = [];
    let depth = 0;
    let lastIndex = 0;
    for (let i = 0; i < bg.length; i++) {
      const char = bg[i];
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) {
        parts.push(bg.slice(lastIndex, i).trim());
        lastIndex = i + 1;
      }
    }
    parts.push(bg.slice(lastIndex).trim());
    return parts;
  }

  // src/utils/browser.js
  function idle(fn, { fast = false } = {}) {
    if (fast) return fn();
    if ("requestIdleCallback" in window) {
      requestIdleCallback(fn, { timeout: 50 });
    } else {
      setTimeout(fn, 1);
    }
  }
  function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  // src/modules/styles.js
  var snapshotCache = /* @__PURE__ */ new WeakMap();
  var snapshotKeyCache = /* @__PURE__ */ new Map();
  var __epoch = 0;
  function bumpEpoch() {
    __epoch++;
  }
  var __wired = false;
  function setupInvalidationOnce(root = document.documentElement) {
    var _a, _b;
    if (__wired) return;
    __wired = true;
    try {
      const domObs = new MutationObserver(() => bumpEpoch());
      domObs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    } catch (e) {
    }
    try {
      const headObs = new MutationObserver(() => bumpEpoch());
      headObs.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true });
    } catch (e) {
    }
    try {
      const f = document.fonts;
      if (f) {
        (_a = f.addEventListener) == null ? void 0 : _a.call(f, "loadingdone", bumpEpoch);
        (_b = f.ready) == null ? void 0 : _b.then(() => bumpEpoch()).catch(() => {
        });
      }
    } catch (e) {
    }
  }
  function snapshotComputedStyleFull(style) {
    const out = {};
    const vis = style.getPropertyValue("visibility");
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      let val = style.getPropertyValue(prop);
      if ((prop === "background-image" || prop === "content") && val.includes("url(") && !val.includes("data:")) {
        val = "none";
      }
      out[prop] = val;
    }
    if (vis === "hidden") out.opacity = "0";
    return out;
  }
  var __snapshotSig = /* @__PURE__ */ new WeakMap();
  function styleSignature(snap) {
    let sig = __snapshotSig.get(snap);
    if (sig) return sig;
    const entries = Object.entries(snap).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    sig = entries.map(([k, v]) => `${k}:${v}`).join(";");
    __snapshotSig.set(snap, sig);
    return sig;
  }
  function getSnapshot(el, preStyle = null) {
    const rec = snapshotCache.get(el);
    if (rec && rec.epoch === __epoch) return rec.snapshot;
    const style = preStyle || getComputedStyle(el);
    const snap = snapshotComputedStyleFull(style);
    snapshotCache.set(el, { epoch: __epoch, snapshot: snap });
    return snap;
  }
  function _resolveCtx(sessionOrCtx, opts) {
    if (sessionOrCtx && sessionOrCtx.session && sessionOrCtx.persist) return sessionOrCtx;
    if (sessionOrCtx && (sessionOrCtx.styleMap || sessionOrCtx.styleCache || sessionOrCtx.nodeMap)) {
      return {
        session: sessionOrCtx,
        persist: {
          snapshotKeyCache,
          defaultStyle: cache.defaultStyle,
          baseStyle: cache.baseStyle,
          image: cache.image,
          resource: cache.resource,
          background: cache.background,
          font: cache.font
        },
        options: opts || {}
      };
    }
    return {
      session: cache.session,
      persist: {
        snapshotKeyCache,
        defaultStyle: cache.defaultStyle,
        baseStyle: cache.baseStyle,
        image: cache.image,
        resource: cache.resource,
        background: cache.background,
        font: cache.font
      },
      options: sessionOrCtx || opts || {}
    };
  }
  function inlineAllStyles(source, clone, sessionOrCtx, opts) {
    return __async(this, null, function* () {
      var _a, _b, _c;
      if (source.tagName === "STYLE") return;
      const ctx = _resolveCtx(sessionOrCtx, opts);
      const resetMode = ctx.options && ctx.options.cache || "auto";
      if (resetMode !== "disabled") setupInvalidationOnce(document.documentElement);
      if (resetMode === "disabled" && !ctx.session.__bumpedForDisabled) {
        bumpEpoch();
        snapshotKeyCache.clear();
        ctx.session.__bumpedForDisabled = true;
      }
      if (NO_DEFAULTS_TAGS.has((_a = source.tagName) == null ? void 0 : _a.toLowerCase())) {
        const author = (_b = source.getAttribute) == null ? void 0 : _b.call(source, "style");
        if (author) clone.setAttribute("style", author);
      }
      const { session, persist } = ctx;
      if (!session.styleCache.has(source)) {
        session.styleCache.set(source, getComputedStyle(source));
      }
      const pre = session.styleCache.get(source);
      const snap = getSnapshot(source, pre);
      const sig = styleSignature(snap);
      let key = persist.snapshotKeyCache.get(sig);
      if (!key) {
        const tag = ((_c = source.tagName) == null ? void 0 : _c.toLowerCase()) || "div";
        key = getStyleKey(snap, tag);
        persist.snapshotKeyCache.set(sig, key);
      }
      session.styleMap.set(clone, key);
    });
  }

  // src/core/clone.js
  function idleCallback(childList, callback, fast) {
    return Promise.all(childList.map((child) => {
      return new Promise((resolve) => {
        function deal() {
          idle((deadline) => {
            const hasIdleBudget = deadline && typeof deadline.timeRemaining === "function" ? deadline.timeRemaining() > 0 : true;
            if (hasIdleBudget) {
              callback(child, resolve);
            } else {
              deal();
            }
          }, { fast });
        }
        deal();
      });
    }));
  }
  function addNotSlottedRightmost(sel) {
    sel = sel.trim();
    if (!sel) return sel;
    if (/\:not\(\s*\[data-sd-slotted\]\s*\)\s*$/.test(sel)) return sel;
    return `${sel}:not([data-sd-slotted])`;
  }
  function wrapWithScope(selectorList, scopeSelector, excludeSlotted = true) {
    return selectorList.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
      if (s.startsWith(":where(")) return s;
      if (s.startsWith("@")) return s;
      const body = excludeSlotted ? addNotSlottedRightmost(s) : s;
      return `:where(${scopeSelector} ${body})`;
    }).join(", ");
  }
  function rewriteShadowCSS(cssText, scopeSelector) {
    if (!cssText) return "";
    cssText = cssText.replace(/:host\(([^)]+)\)/g, (_, sel) => {
      return `:where(${scopeSelector}:is(${sel.trim()}))`;
    });
    cssText = cssText.replace(/:host\b/g, `:where(${scopeSelector})`);
    cssText = cssText.replace(/:host-context\(([^)]+)\)/g, (_, sel) => {
      return `:where(:where(${sel.trim()}) ${scopeSelector})`;
    });
    cssText = cssText.replace(/::slotted\(([^)]+)\)/g, (_, sel) => {
      return `:where(${scopeSelector} ${sel.trim()})`;
    });
    cssText = cssText.replace(/(^|})(\s*)([^@}{]+){/g, (_, brace, ws, selectorList) => {
      const wrapped = wrapWithScope(
        selectorList,
        scopeSelector,
        /*excludeSlotted*/
        true
      );
      return `${brace}${ws}${wrapped}{`;
    });
    return cssText;
  }
  function nextShadowScopeId(sessionCache) {
    sessionCache.shadowScopeSeq = (sessionCache.shadowScopeSeq || 0) + 1;
    return `s${sessionCache.shadowScopeSeq}`;
  }
  function extractShadowCSS(sr) {
    let css = "";
    try {
      sr.querySelectorAll("style").forEach((s) => {
        css += (s.textContent || "") + "\n";
      });
      const sheets = sr.adoptedStyleSheets || [];
      for (const sh of sheets) {
        try {
          if (sh && sh.cssRules) {
            for (const rule of sh.cssRules) css += rule.cssText + "\n";
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
    return css;
  }
  function injectScopedStyle(hostClone, cssText, scopeId) {
    if (!cssText) return;
    const style = document.createElement("style");
    style.setAttribute("data-sd", scopeId);
    style.textContent = cssText;
    hostClone.insertBefore(style, hostClone.firstChild || null);
  }
  function freezeImgSrcset(original, cloned) {
    try {
      const chosen = original.currentSrc || original.src || "";
      if (!chosen) return;
      cloned.setAttribute("src", chosen);
      cloned.removeAttribute("srcset");
      cloned.removeAttribute("sizes");
      cloned.loading = "eager";
      cloned.decoding = "sync";
    } catch (e) {
    }
  }
  function collectCustomPropsFromCSS(cssText) {
    const out = /* @__PURE__ */ new Set();
    if (!cssText) return out;
    const re = /var\(\s*(--[A-Za-z0-9_-]+)\b/g;
    let m;
    while (m = re.exec(cssText)) out.add(m[1]);
    return out;
  }
  function resolveCustomProp(el, name) {
    try {
      const cs = getComputedStyle(el);
      let v = cs.getPropertyValue(name).trim();
      if (v) return v;
    } catch (e) {
    }
    try {
      const rootCS = getComputedStyle(document.documentElement);
      let v = rootCS.getPropertyValue(name).trim();
      if (v) return v;
    } catch (e) {
    }
    return "";
  }
  function buildSeedCustomPropsRule(hostEl, names, scopeSelector) {
    const decls = [];
    for (const name of names) {
      const val = resolveCustomProp(hostEl, name);
      if (val) decls.push(`${name}: ${val};`);
    }
    if (!decls.length) return "";
    return `${scopeSelector}{${decls.join("")}}
`;
  }
  function markSlottedSubtree(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      root.setAttribute("data-sd-slotted", "");
    }
    if (root.querySelectorAll) {
      root.querySelectorAll("*").forEach((el) => el.setAttribute("data-sd-slotted", ""));
    }
  }
  function getAccessibleIframeDocument(iframe, attempts = 3) {
    return __async(this, null, function* () {
      const probe = () => {
        var _a;
        try {
          return iframe.contentDocument || ((_a = iframe.contentWindow) == null ? void 0 : _a.document) || null;
        } catch (e) {
          return null;
        }
      };
      let doc = probe();
      let i = 0;
      while (i < attempts && (!doc || !doc.body && !doc.documentElement)) {
        yield new Promise((r) => setTimeout(r, 0));
        doc = probe();
        i++;
      }
      return doc && (doc.body || doc.documentElement) ? doc : null;
    });
  }
  function measureContentBox(el) {
    const rect = el.getBoundingClientRect();
    let bl = 0, br = 0, bt = 0, bb = 0;
    try {
      const cs = getComputedStyle(el);
      bl = parseFloat(cs.borderLeftWidth) || 0;
      br = parseFloat(cs.borderRightWidth) || 0;
      bt = parseFloat(cs.borderTopWidth) || 0;
      bb = parseFloat(cs.borderBottomWidth) || 0;
    } catch (e) {
    }
    const contentWidth = Math.max(0, Math.round(rect.width - (bl + br)));
    const contentHeight = Math.max(0, Math.round(rect.height - (bt + bb)));
    return { contentWidth, contentHeight, rect };
  }
  function pinIframeViewport(doc, w, h) {
    const style = doc.createElement("style");
    style.setAttribute("data-sd-iframe-pin", "");
    style.textContent = `html, body {margin: 0 !important;padding: 0 !important;width: ${w}px !important;height: ${h}px !important;min-width: ${w}px !important;min-height: ${h}px !important;box-sizing: border-box !important;overflow: hidden !important;background-clip: border-box !important;}`;
    (doc.head || doc.documentElement).appendChild(style);
    return () => {
      try {
        style.remove();
      } catch (e) {
      }
    };
  }
  function rasterizeIframe(iframe, sessionCache, options) {
    return __async(this, null, function* () {
      const doc = yield getAccessibleIframeDocument(iframe, 3);
      if (!doc) throw new Error("iframe document not accessible/ready");
      const { contentWidth, contentHeight, rect } = measureContentBox(iframe);
      const snap = options == null ? void 0 : options.snap;
      if (!snap || typeof snap.toPng !== "function") {
        throw new Error("snapdom.toPng not available in iframe or window");
      }
      const nested = __spreadProps(__spreadValues({}, options), { scale: 1 });
      const unpin = pinIframeViewport(doc, contentWidth, contentHeight);
      let imgEl;
      try {
        imgEl = yield snap.toPng(doc.documentElement, nested);
      } finally {
        unpin();
      }
      imgEl.style.display = "block";
      imgEl.style.width = `${contentWidth}px`;
      imgEl.style.height = `${contentHeight}px`;
      const wrapper = document.createElement("div");
      sessionCache.nodeMap.set(wrapper, iframe);
      inlineAllStyles(iframe, wrapper, sessionCache, options);
      wrapper.style.overflow = "hidden";
      wrapper.style.display = "block";
      if (!wrapper.style.width) wrapper.style.width = `${Math.round(rect.width)}px`;
      if (!wrapper.style.height) wrapper.style.height = `${Math.round(rect.height)}px`;
      wrapper.appendChild(imgEl);
      return wrapper;
    });
  }
  function deepClone(node, sessionCache, options) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d, _e, _f;
      if (!node) throw new Error("Invalid node");
      const clonedAssignedNodes = /* @__PURE__ */ new Set();
      let pendingSelectValue = null;
      let pendingTextAreaValue = null;
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node.localName || node.tagName || "").toLowerCase();
        if (node.id === "snapdom-sandbox" || node.hasAttribute("data-snapdom-sandbox")) {
          return null;
        }
        if (NO_CAPTURE_TAGS.has(tag)) {
          return null;
        }
      }
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return node.cloneNode(true);
      }
      if (node.getAttribute("data-capture") === "exclude") {
        const spacer = document.createElement("div");
        const rect = node.getBoundingClientRect();
        spacer.style.cssText = `display:inline-block;width:${rect.width}px;height:${rect.height}px;visibility:hidden;`;
        return spacer;
      }
      if (options.exclude && Array.isArray(options.exclude)) {
        for (const selector of options.exclude) {
          try {
            if ((_a = node.matches) == null ? void 0 : _a.call(node, selector)) {
              const spacer = document.createElement("div");
              const rect = node.getBoundingClientRect();
              spacer.style.cssText = `display:inline-block;width:${rect.width}px;height:${rect.height}px;visibility:hidden;`;
              return spacer;
            }
          } catch (err) {
            console.warn(`Invalid selector in exclude option: ${selector}`, err);
          }
        }
      }
      if (typeof options.filter === "function") {
        try {
          if (!options.filter(node)) {
            const spacer = document.createElement("div");
            const rect = node.getBoundingClientRect();
            spacer.style.cssText = `display:inline-block;width:${rect.width}px;height:${rect.height}px;visibility:hidden;`;
            return spacer;
          }
        } catch (err) {
          console.warn("Error in filter function:", err);
        }
      }
      if (node.tagName === "IFRAME") {
        let sameOrigin = false;
        try {
          sameOrigin = !!(node.contentDocument || ((_b = node.contentWindow) == null ? void 0 : _b.document));
        } catch (e) {
          sameOrigin = false;
        }
        if (sameOrigin) {
          try {
            const wrapper = yield rasterizeIframe(node, sessionCache, options);
            return wrapper;
          } catch (err) {
            console.warn("[SnapDOM] iframe rasterization failed, fallback:", err);
          }
        }
        if (options.placeholders) {
          const fallback = document.createElement("div");
          fallback.style.cssText = `width:${node.offsetWidth}px;height:${node.offsetHeight}px;background-image:repeating-linear-gradient(45deg,#ddd,#ddd 5px,#f9f9f9 5px,#f9f9f9 10px);display:flex;align-items:center;justify-content:center;font-size:12px;color:#555;border:1px solid #aaa;`;
          inlineAllStyles(node, fallback, sessionCache, options);
          return fallback;
        } else {
          const rect = node.getBoundingClientRect();
          const spacer = document.createElement("div");
          spacer.style.cssText = `display:inline-block;width:${rect.width}px;height:${rect.height}px;visibility:hidden;`;
          inlineAllStyles(node, spacer, sessionCache, options);
          return spacer;
        }
      }
      if (node.getAttribute("data-capture") === "placeholder") {
        const clone2 = node.cloneNode(false);
        sessionCache.nodeMap.set(clone2, node);
        inlineAllStyles(node, clone2, sessionCache, options);
        const placeholder = document.createElement("div");
        placeholder.textContent = node.getAttribute("data-placeholder-text") || "";
        placeholder.style.cssText = `color:#666;font-size:12px;text-align:center;line-height:1.4;padding:0.5em;box-sizing:border-box;`;
        clone2.appendChild(placeholder);
        return clone2;
      }
      if (node.tagName === "CANVAS") {
        const dataURL = node.toDataURL();
        const img = document.createElement("img");
        img.src = dataURL;
        img.width = node.width;
        img.height = node.height;
        sessionCache.nodeMap.set(img, node);
        inlineAllStyles(node, img, sessionCache, options);
        return img;
      }
      let clone;
      try {
        clone = node.cloneNode(false);
        sessionCache.nodeMap.set(clone, node);
        if (node.tagName === "IMG") {
          freezeImgSrcset(node, clone);
          try {
            const rect = node.getBoundingClientRect();
            let w = Math.round(rect.width || 0);
            let h = Math.round(rect.height || 0);
            if (!w || !h) {
              const computed = window.getComputedStyle(node);
              const cssW = parseFloat(computed.width) || 0;
              const cssH = parseFloat(computed.height) || 0;
              const attrW = parseInt(node.getAttribute("width") || "", 10) || 0;
              const attrH = parseInt(node.getAttribute("height") || "", 10) || 0;
              const propW = node.width || node.naturalWidth || 0;
              const propH = node.height || node.naturalHeight || 0;
              w = Math.round(w || cssW || attrW || propW || 0);
              h = Math.round(h || cssH || attrH || propH || 0);
            }
            if (w) clone.dataset.snapdomWidth = String(w);
            if (h) clone.dataset.snapdomHeight = String(h);
          } catch (e) {
          }
        }
      } catch (err) {
        console.error("[Snapdom] Failed to clone node:", node, err);
        throw err;
      }
      if (node instanceof HTMLTextAreaElement) {
        const rect = node.getBoundingClientRect();
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
      }
      if (node instanceof HTMLInputElement) {
        clone.value = node.value;
        clone.setAttribute("value", node.value);
        if (node.checked !== void 0) {
          clone.checked = node.checked;
          if (node.checked) clone.setAttribute("checked", "");
          if (node.indeterminate) clone.indeterminate = node.indeterminate;
        }
      }
      if (node instanceof HTMLSelectElement) {
        pendingSelectValue = node.value;
      }
      if (node instanceof HTMLTextAreaElement) {
        pendingTextAreaValue = node.value;
      }
      inlineAllStyles(node, clone, sessionCache, options);
      if (node.shadowRoot) {
        let callback2 = function(child, resolve) {
          if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "STYLE") {
            return resolve(null);
          } else {
            deepClone(child, sessionCache, options).then((clonedChild) => {
              resolve(clonedChild || null);
            }).catch((e) => {
              resolve(null);
            });
          }
        };
        try {
          const slots = node.shadowRoot.querySelectorAll("slot");
          for (const s of slots) {
            let assigned = [];
            try {
              assigned = ((_c = s.assignedNodes) == null ? void 0 : _c.call(s, { flatten: true })) || ((_d = s.assignedNodes) == null ? void 0 : _d.call(s)) || [];
            } catch (e) {
              assigned = ((_e = s.assignedNodes) == null ? void 0 : _e.call(s)) || [];
            }
            for (const an of assigned) clonedAssignedNodes.add(an);
          }
        } catch (e) {
        }
        const scopeId = nextShadowScopeId(sessionCache);
        const scopeSelector = `[data-sd="${scopeId}"]`;
        try {
          clone.setAttribute("data-sd", scopeId);
        } catch (e) {
        }
        const rawCSS = extractShadowCSS(node.shadowRoot);
        const rewritten = rewriteShadowCSS(rawCSS, scopeSelector);
        const neededVars = collectCustomPropsFromCSS(rawCSS);
        const seed = buildSeedCustomPropsRule(node, neededVars, scopeSelector);
        injectScopedStyle(clone, seed + rewritten, scopeId);
        const shadowFrag = document.createDocumentFragment();
        const cloneList2 = yield idleCallback(Array.from(node.shadowRoot.childNodes), callback2, options.fast);
        shadowFrag.append(...cloneList2.filter((clonedChild) => !!clonedChild));
        clone.appendChild(shadowFrag);
      }
      if (node.tagName === "SLOT") {
        let callback2 = function(child, resolve) {
          deepClone(child, sessionCache, options).then((clonedChild) => {
            if (clonedChild) {
              markSlottedSubtree(clonedChild);
            }
            resolve(clonedChild || null);
          }).catch((e) => {
            resolve(null);
          });
        };
        const assigned = ((_f = node.assignedNodes) == null ? void 0 : _f.call(node, { flatten: true })) || [];
        const nodesToClone = assigned.length > 0 ? assigned : Array.from(node.childNodes);
        const fragment = document.createDocumentFragment();
        const cloneList2 = yield idleCallback(Array.from(nodesToClone), callback2, options.fast);
        fragment.append(...cloneList2.filter((clonedChild) => !!clonedChild));
        return fragment;
      }
      function callback(child, resolve) {
        if (clonedAssignedNodes.has(child)) return resolve(null);
        deepClone(child, sessionCache, options).then((clonedChild) => {
          resolve(clonedChild || null);
        }).catch((e) => {
          resolve(null);
        });
      }
      const cloneList = yield idleCallback(Array.from(node.childNodes), callback, options.fast);
      clone.append(...cloneList.filter((clonedChild) => !!clonedChild));
      if (pendingSelectValue !== null && clone instanceof HTMLSelectElement) {
        clone.value = pendingSelectValue;
        for (const opt of clone.options) {
          if (opt.value === pendingSelectValue) {
            opt.setAttribute("selected", "");
          } else {
            opt.removeAttribute("selected");
          }
        }
      }
      if (pendingTextAreaValue !== null && clone instanceof HTMLTextAreaElement) {
        clone.textContent = pendingTextAreaValue;
      }
      return clone;
    });
  }

  // src/modules/iconFonts.js
  var defaultIconFonts = [
    // /uicons/i,
    /font\s*awesome/i,
    /material\s*icons/i,
    /ionicons/i,
    /glyphicons/i,
    /feather/i,
    /bootstrap\s*icons/i,
    /remix\s*icons/i,
    /heroicons/i,
    /layui/i,
    /lucide/i
  ];
  var userIconFonts = [];
  function extendIconFonts(fonts) {
    const list = Array.isArray(fonts) ? fonts : [fonts];
    for (const f of list) {
      if (f instanceof RegExp) {
        userIconFonts.push(f);
      } else if (typeof f === "string") {
        userIconFonts.push(new RegExp(f, "i"));
      } else {
        console.warn("[snapdom] Ignored invalid iconFont value:", f);
      }
    }
  }
  function isIconFont2(input) {
    const text = typeof input === "string" ? input : "";
    const candidates = [...defaultIconFonts, ...userIconFonts];
    for (const rx of candidates) {
      if (rx instanceof RegExp && rx.test(text)) return true;
    }
    if (/icon/i.test(text) || /glyph/i.test(text) || /symbols/i.test(text) || /feather/i.test(text) || /fontawesome/i.test(text)) return true;
    return false;
  }

  // src/modules/fonts.js
  function iconToImage(unicodeChar, fontFamily, fontWeight, fontSize = 32, color = "#000") {
    return __async(this, null, function* () {
      fontFamily = fontFamily.replace(/^['"]+|['"]+$/g, "");
      const dpr = window.devicePixelRatio || 1;
      yield document.fonts.ready;
      const span = document.createElement("span");
      span.textContent = unicodeChar;
      span.style.position = "absolute";
      span.style.visibility = "hidden";
      span.style.fontFamily = `"${fontFamily}"`;
      span.style.fontWeight = fontWeight || "normal";
      span.style.fontSize = `${fontSize}px`;
      span.style.lineHeight = "1";
      span.style.whiteSpace = "nowrap";
      span.style.padding = "0";
      span.style.margin = "0";
      document.body.appendChild(span);
      const rect = span.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      document.body.removeChild(span);
      const canvas = document.createElement("canvas");
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.font = fontWeight ? `${fontWeight} ${fontSize}px "${fontFamily}"` : `${fontSize}px "${fontFamily}"`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      ctx.fillText(unicodeChar, 0, 0);
      return {
        dataUrl: canvas.toDataURL(),
        width,
        height
      };
    });
  }
  var GENERIC_FAMILIES = /* @__PURE__ */ new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "emoji",
    "math",
    "fangsong",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded"
  ]);
  function pickPrimaryFamily(familyList) {
    if (!familyList) return "";
    for (let raw of familyList.split(",")) {
      let f = raw.trim().replace(/^['"]+|['"]+$/g, "");
      if (!f) continue;
      if (!GENERIC_FAMILIES.has(f.toLowerCase())) return f;
    }
    return "";
  }
  function normWeight(w) {
    const t = String(w != null ? w : "400").trim().toLowerCase();
    if (t === "normal") return 400;
    if (t === "bold") return 700;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? Math.min(900, Math.max(100, n)) : 400;
  }
  function normStyle(s) {
    const t = String(s != null ? s : "normal").trim().toLowerCase();
    if (t.startsWith("italic")) return "italic";
    if (t.startsWith("oblique")) return "oblique";
    return "normal";
  }
  function normStretchPct(st) {
    const m = String(st != null ? st : "100%").match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Math.max(50, Math.min(200, parseFloat(m[1]))) : 100;
  }
  function parseWeightSpec(spec) {
    const s = String(spec || "400").trim();
    const m = s.match(/^(\d{2,3})\s+(\d{2,3})$/);
    if (m) {
      const a = normWeight(m[1]), b = normWeight(m[2]);
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const v = normWeight(s);
    return { min: v, max: v };
  }
  function parseStyleSpec(spec) {
    const t = String(spec || "normal").trim().toLowerCase();
    if (t === "italic") return { kind: "italic" };
    if (t.startsWith("oblique")) return { kind: "oblique" };
    return { kind: "normal" };
  }
  function parseStretchSpec(spec) {
    const s = String(spec || "100%").trim();
    const mm = s.match(/(\d+(?:\.\d+)?)\s*%\s+(\d+(?:\.\d+)?)\s*%/);
    if (mm) {
      const a = parseFloat(mm[1]), b = parseFloat(mm[2]);
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const m = s.match(/(\d+(?:\.\d+)?)\s*%/);
    const v = m ? parseFloat(m[1]) : 100;
    return { min: v, max: v };
  }
  function isLikelyFontStylesheet(href, requiredFamilies) {
    if (!href) return false;
    try {
      const u = new URL(href, location.href);
      const sameOrigin = u.origin === location.origin;
      if (sameOrigin) return true;
      const host = u.host.toLowerCase();
      const FONT_HOSTS = [
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        "use.typekit.net",
        "p.typekit.net",
        "kit.fontawesome.com",
        "use.fontawesome.com"
      ];
      if (FONT_HOSTS.some((h) => host.endsWith(h))) return true;
      const path = (u.pathname + u.search).toLowerCase();
      if (/\bfont(s)?\b/.test(path) || /\.woff2?(\b|$)/.test(path)) return true;
      for (const fam of requiredFamilies) {
        const tokenA = fam.toLowerCase().replace(/\s+/g, "+");
        const tokenB = fam.toLowerCase().replace(/\s+/g, "-");
        if (path.includes(tokenA) || path.includes(tokenB)) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  function familiesFromRequired(required) {
    var _a;
    const out = /* @__PURE__ */ new Set();
    for (const k of required || []) {
      const fam = (_a = String(k).split("__")[0]) == null ? void 0 : _a.trim();
      if (fam) out.add(fam);
    }
    return out;
  }
  function embedCustomFonts() {
    return __async(this, arguments, function* ({
      required,
      usedCodepoints,
      exclude = void 0,
      localFonts = [],
      useProxy = ""
    } = {}) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
      if (!(required instanceof Set)) required = /* @__PURE__ */ new Set();
      if (!(usedCodepoints instanceof Set)) usedCodepoints = /* @__PURE__ */ new Set();
      const requiredIndex = /* @__PURE__ */ new Map();
      for (const key of required) {
        const [fam, w, s, st] = String(key).split("__");
        if (!fam) continue;
        const arr = requiredIndex.get(fam) || [];
        arr.push({ w: parseInt(w, 10), s, st: parseInt(st, 10) });
        requiredIndex.set(fam, arr);
      }
      const IMPORT_RE = /@import\s+url\(["']?([^"')]+)["']?\)/g;
      const URL_RE = /url\((["']?)([^"')]+)\1\)/g;
      const FACE_RE = /@font-face[^{}]*\{[^}]*\}/g;
      function faceMatchesRequired(fam, styleSpec, weightSpec, stretchSpec) {
        if (!requiredIndex.has(fam)) return false;
        const need = requiredIndex.get(fam);
        const ws = parseWeightSpec(weightSpec);
        const ss = parseStyleSpec(styleSpec);
        const ts = parseStretchSpec(stretchSpec);
        const faceIsRange = ws.min !== ws.max;
        const faceSingleW = ws.min;
        const styleOK = (reqKind) => ss.kind === "normal" && reqKind === "normal" || ss.kind !== "normal" && (reqKind === "italic" || reqKind === "oblique");
        let exactMatched = false;
        for (const r of need) {
          const wOk = faceIsRange ? r.w >= ws.min && r.w <= ws.max : r.w === faceSingleW;
          const sOk = styleOK(normStyle(r.s));
          const tOk = r.st >= ts.min && r.st <= ts.max;
          if (wOk && sOk && tOk) {
            exactMatched = true;
            break;
          }
        }
        if (exactMatched) return true;
        if (!faceIsRange) {
          for (const r of need) {
            const sOk = styleOK(normStyle(r.s));
            const tOk = r.st >= ts.min && r.st <= ts.max;
            const nearWeight = Math.abs(faceSingleW - r.w) <= 300;
            if (nearWeight && sOk && tOk) {
              return true;
            }
          }
        }
        return false;
      }
      function parseUnicodeRange(ur) {
        if (!ur) return [];
        const ranges = [];
        const parts = ur.split(",").map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          const m = p.match(/^U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f?]+))?$/);
          if (!m) continue;
          const a = m[1], b = m[2];
          const expand = (hex) => {
            if (!hex.includes("?")) return parseInt(hex, 16);
            const min = parseInt(hex.replace(/\?/g, "0"), 16);
            const max = parseInt(hex.replace(/\?/g, "F"), 16);
            return [min, max];
          };
          if (b) {
            const A = expand(a), B = expand(b);
            const min = Array.isArray(A) ? A[0] : A;
            const max = Array.isArray(B) ? B[1] : B;
            ranges.push([Math.min(min, max), Math.max(min, max)]);
          } else {
            const X = expand(a);
            if (Array.isArray(X)) ranges.push([X[0], X[1]]);
            else ranges.push([X, X]);
          }
        }
        return ranges;
      }
      function unicodeIntersects(used, ranges) {
        if (!ranges.length) return true;
        if (!used || used.size === 0) return true;
        for (const cp of used) {
          for (const [a, b] of ranges) if (cp >= a && cp <= b) return true;
        }
        return false;
      }
      function extractSrcUrls(srcValue, baseHref) {
        const urls = [];
        if (!srcValue) return urls;
        for (const m of srcValue.matchAll(URL_RE)) {
          let u = (m[2] || "").trim();
          if (!u || u.startsWith("data:")) continue;
          if (!/^https?:/i.test(u)) {
            try {
              u = new URL(u, baseHref || location.href).href;
            } catch (e) {
            }
          }
          urls.push(u);
        }
        return urls;
      }
      function inlineUrlsInCssBlock(cssBlock, baseHref) {
        return __async(this, null, function* () {
          var _a2, _b2, _c2, _d2, _e2;
          let out = cssBlock;
          for (const m of cssBlock.matchAll(URL_RE)) {
            const raw = extractURL(m[0]);
            if (!raw) continue;
            let abs = raw;
            if (!abs.startsWith("http") && !abs.startsWith("data:")) {
              try {
                abs = new URL(abs, baseHref || location.href).href;
              } catch (e) {
              }
            }
            if (isIconFont2(abs)) continue;
            if ((_a2 = cache.resource) == null ? void 0 : _a2.has(abs)) {
              (_b2 = cache.font) == null ? void 0 : _b2.add(abs);
              out = out.replace(m[0], `url(${cache.resource.get(abs)})`);
              continue;
            }
            if ((_c2 = cache.font) == null ? void 0 : _c2.has(abs)) continue;
            try {
              const r = yield snapFetch(abs, { as: "dataURL", useProxy, silent: true });
              if (r.ok && typeof r.data === "string") {
                const b64 = r.data;
                (_d2 = cache.resource) == null ? void 0 : _d2.set(abs, b64);
                (_e2 = cache.font) == null ? void 0 : _e2.add(abs);
                out = out.replace(m[0], `url(${b64})`);
              }
            } catch (e) {
              console.warn("[snapDOM] Failed to fetch font resource:", abs);
            }
          }
          return out;
        });
      }
      function subsetFromRanges(ranges) {
        if (!ranges.length) return null;
        const hit = (a, b) => ranges.some(([x, y]) => !(y < a || x > b));
        const latin = hit(0, 255) || hit(305, 305);
        const latinExt = hit(256, 591) || hit(7680, 7935);
        const greek = hit(880, 1023);
        const cyr = hit(1024, 1279);
        const viet = hit(7840, 7929) || hit(258, 259) || hit(416, 417) || hit(431, 432);
        if (viet) return "vietnamese";
        if (cyr) return "cyrillic";
        if (greek) return "greek";
        if (latinExt) return "latin-ext";
        if (latin) return "latin";
        return null;
      }
      function buildSimpleExcluder(ex = {}) {
        const famSet = new Set((ex.families || []).map((s) => String(s).toLowerCase()));
        const domSet = new Set((ex.domains || []).map((s) => String(s).toLowerCase()));
        const subSet = new Set((ex.subsets || []).map((s) => String(s).toLowerCase()));
        return (meta, parsedRanges) => {
          if (famSet.size && famSet.has(meta.family.toLowerCase())) return true;
          if (domSet.size) {
            for (const u of meta.srcUrls) {
              try {
                if (domSet.has(new URL(u).host.toLowerCase())) return true;
              } catch (e) {
              }
            }
          }
          if (subSet.size) {
            const label = subsetFromRanges(parsedRanges);
            if (label && subSet.has(label)) return true;
          }
          return false;
        };
      }
      const simpleExcluder = buildSimpleExcluder(exclude);
      function dedupeFontFaces(cssText) {
        var _a2, _b2, _c2, _d2, _e2, _f2;
        if (!cssText) return cssText;
        const FACE_RE2 = /@font-face[^{}]*\{[^}]*\}/gi;
        const seen = /* @__PURE__ */ new Set();
        const out = [];
        for (const block of cssText.match(FACE_RE2) || []) {
          const familyRaw = ((_a2 = block.match(/font-family:\s*([^;]+);/i)) == null ? void 0 : _a2[1]) || "";
          const family = pickPrimaryFamily(familyRaw);
          const weightSpec = (((_b2 = block.match(/font-weight:\s*([^;]+);/i)) == null ? void 0 : _b2[1]) || "400").trim();
          const styleSpec = (((_c2 = block.match(/font-style:\s*([^;]+);/i)) == null ? void 0 : _c2[1]) || "normal").trim();
          const stretchSpec = (((_d2 = block.match(/font-stretch:\s*([^;]+);/i)) == null ? void 0 : _d2[1]) || "100%").trim();
          const urange = (((_e2 = block.match(/unicode-range:\s*([^;]+);/i)) == null ? void 0 : _e2[1]) || "").trim();
          const srcRaw = (((_f2 = block.match(/src\s*:\s*([^;]+);/i)) == null ? void 0 : _f2[1]) || "").trim();
          const urls = extractSrcUrls(srcRaw, location.href);
          const srcPart = urls.length ? urls.map((u) => String(u).toLowerCase()).sort().join("|") : srcRaw.toLowerCase();
          const key = [
            String(family || "").toLowerCase(),
            weightSpec,
            styleSpec,
            stretchSpec,
            urange.toLowerCase(),
            srcPart
          ].join("|");
          if (!seen.has(key)) {
            seen.add(key);
            out.push(block);
          }
        }
        if (out.length === 0) return cssText;
        let i = 0;
        return cssText.replace(FACE_RE2, () => out[i++] || "");
      }
      function buildFontsCacheKey() {
        const req = Array.from(required || []).sort().join("|");
        const ex = exclude ? JSON.stringify({
          families: (exclude.families || []).map((s) => String(s).toLowerCase()).sort(),
          domains: (exclude.domains || []).map((s) => String(s).toLowerCase()).sort(),
          subsets: (exclude.subsets || []).map((s) => String(s).toLowerCase()).sort()
        }) : "";
        const lf = (localFonts || []).map((f) => `${(f.family || "").toLowerCase()}::${f.weight || "normal"}::${f.style || "normal"}::${f.src || ""}`).sort().join("|");
        const px = useProxy || "";
        return `fonts-embed-css::req=${req}::ex=${ex}::lf=${lf}::px=${px}`;
      }
      const cacheKey = buildFontsCacheKey();
      if ((_a = cache.resource) == null ? void 0 : _a.has(cacheKey)) {
        const css = cache.resource.get(cacheKey);
        return css;
      }
      const requiredFamilies = familiesFromRequired(required);
      const importUrls = [];
      for (const styleTag of document.querySelectorAll("style")) {
        const cssText = styleTag.textContent || "";
        for (const m of cssText.matchAll(IMPORT_RE)) {
          const u = m[1];
          if (!u || isIconFont2(u)) continue;
          const hasLink = !!document.querySelector(`link[rel="stylesheet"][href="${u}"]`);
          if (!hasLink) importUrls.push(u);
        }
      }
      if (importUrls.length) {
        yield Promise.all(importUrls.map((u) => new Promise((resolve) => {
          if (document.querySelector(`link[rel="stylesheet"][href="${u}"]`)) return resolve(null);
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = u;
          link.setAttribute("data-snapdom", "injected-import");
          link.onload = () => resolve(link);
          link.onerror = () => resolve(null);
          document.head.appendChild(link);
        })));
      }
      let finalCSS = "";
      const linkNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((l) => !!l.href);
      for (const link of linkNodes) {
        try {
          if (isIconFont2(link.href)) continue;
          let cssText = "";
          let sameOrigin = false;
          try {
            sameOrigin = new URL(link.href, location.href).origin === location.origin;
          } catch (e) {
          }
          if (!sameOrigin) {
            if (!isLikelyFontStylesheet(link.href, requiredFamilies)) continue;
          }
          if (sameOrigin) {
            const sheet = Array.from(document.styleSheets).find((s) => s.href === link.href);
            if (sheet) {
              try {
                const rules = sheet.cssRules || [];
                cssText = Array.from(rules).map((r) => r.cssText).join("");
              } catch (e) {
              }
            }
          }
          if (!cssText) {
            const res = yield snapFetch(link.href, { as: "text", useProxy });
            cssText = res.data;
            if (isIconFont2(link.href)) continue;
          }
          let facesOut = "";
          for (const face of cssText.match(FACE_RE) || []) {
            const famRaw = (((_b = face.match(/font-family:\s*([^;]+);/i)) == null ? void 0 : _b[1]) || "").trim();
            const family = pickPrimaryFamily(famRaw);
            if (!family || isIconFont2(family)) {
              continue;
            }
            const weightSpec = (((_c = face.match(/font-weight:\s*([^;]+);/i)) == null ? void 0 : _c[1]) || "400").trim();
            const styleSpec = (((_d = face.match(/font-style:\s*([^;]+);/i)) == null ? void 0 : _d[1]) || "normal").trim();
            const stretchSpec = (((_e = face.match(/font-stretch:\s*([^;]+);/i)) == null ? void 0 : _e[1]) || "100%").trim();
            const urange = (((_f = face.match(/unicode-range:\s*([^;]+);/i)) == null ? void 0 : _f[1]) || "").trim();
            const srcRaw = (((_g = face.match(/src\s*:\s*([^;]+);/i)) == null ? void 0 : _g[1]) || "").trim();
            const srcUrls = extractSrcUrls(srcRaw, link.href);
            if (!faceMatchesRequired(family, styleSpec, weightSpec, stretchSpec)) {
              continue;
            }
            const ranges = parseUnicodeRange(urange);
            if (!unicodeIntersects(usedCodepoints, ranges)) {
              continue;
            }
            const meta = { family, weightSpec, styleSpec, stretchSpec, unicodeRange: urange, srcRaw, srcUrls, href: link.href };
            if (exclude && simpleExcluder(meta, ranges)) {
              continue;
            }
            const newFace = /url\(/i.test(srcRaw) ? yield inlineUrlsInCssBlock(face, link.href) : face;
            facesOut += newFace + "";
          }
          if (facesOut.trim()) finalCSS += facesOut + "";
        } catch (e) {
          console.warn("[snapdom] Failed to process stylesheet:", link.href);
        }
      }
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.href && linkNodes.some((l) => l.href === sheet.href)) continue;
          const rules = sheet.cssRules || [];
          for (const rule of rules) {
            if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
            const famRaw = (rule.style.getPropertyValue("font-family") || "").trim();
            const family = pickPrimaryFamily(famRaw);
            if (!family || isIconFont2(family)) continue;
            const weightSpec = (rule.style.getPropertyValue("font-weight") || "400").trim();
            const styleSpec = (rule.style.getPropertyValue("font-style") || "normal").trim();
            const stretchSpec = (rule.style.getPropertyValue("font-stretch") || "100%").trim();
            const srcRaw = (rule.style.getPropertyValue("src") || "").trim();
            const urange = (rule.style.getPropertyValue("unicode-range") || "").trim();
            const srcUrls = extractSrcUrls(srcRaw, sheet.href || location.href);
            if (!faceMatchesRequired(family, styleSpec, weightSpec, stretchSpec)) continue;
            const ranges = parseUnicodeRange(urange);
            if (!unicodeIntersects(usedCodepoints, ranges)) continue;
            const meta = { family, weightSpec, styleSpec, stretchSpec, unicodeRange: urange, srcRaw, srcUrls, href: sheet.href || location.href };
            if (exclude && simpleExcluder(meta, ranges)) continue;
            if (/url\(/i.test(srcRaw)) {
              const inlinedSrc = yield inlineUrlsInCssBlock(srcRaw, sheet.href || location.href);
              finalCSS += `@font-face{font-family:${family};src:${inlinedSrc};font-style:${styleSpec};font-weight:${weightSpec};font-stretch:${stretchSpec};${urange ? `unicode-range:${urange};` : ""}}`;
            } else {
              finalCSS += `@font-face{font-family:${family};src:${srcRaw};font-style:${styleSpec};font-weight:${weightSpec};font-stretch:${stretchSpec};${urange ? `unicode-range:${urange};` : ""}}`;
            }
          }
        } catch (e) {
        }
      }
      try {
        for (const f of document.fonts || []) {
          if (!f || !f.family || f.status !== "loaded" || !f._snapdomSrc) continue;
          const fam = String(f.family).replace(/^['"]+|['"]+$/g, "");
          if (isIconFont2(fam)) continue;
          if (!requiredIndex.has(fam)) continue;
          if ((exclude == null ? void 0 : exclude.families) && exclude.families.some((n) => String(n).toLowerCase() === fam.toLowerCase())) {
            continue;
          }
          let b64 = f._snapdomSrc;
          if (!String(b64).startsWith("data:")) {
            if ((_h = cache.resource) == null ? void 0 : _h.has(f._snapdomSrc)) {
              b64 = cache.resource.get(f._snapdomSrc);
              (_i = cache.font) == null ? void 0 : _i.add(f._snapdomSrc);
            } else if (!((_j = cache.font) == null ? void 0 : _j.has(f._snapdomSrc))) {
              try {
                const r = yield snapFetch(f._snapdomSrc, { as: "dataURL", useProxy, silent: true });
                if (r.ok && typeof r.data === "string") {
                  b64 = r.data;
                  (_k = cache.resource) == null ? void 0 : _k.set(f._snapdomSrc, b64);
                  (_l = cache.font) == null ? void 0 : _l.add(f._snapdomSrc);
                } else {
                  continue;
                }
              } catch (e) {
                console.warn("[snapdom] Failed to fetch dynamic font src:", f._snapdomSrc);
                continue;
              }
            }
          }
          finalCSS += `@font-face{font-family:'${fam}';src:url(${b64});font-style:${f.style || "normal"};font-weight:${f.weight || "normal"};}`;
        }
      } catch (e) {
      }
      for (const font of localFonts) {
        if (!font || typeof font !== "object") continue;
        const family = String(font.family || "").replace(/^['"]+|['"]+$/g, "");
        if (!family || isIconFont2(family)) continue;
        if (!requiredIndex.has(family)) continue;
        if ((exclude == null ? void 0 : exclude.families) && exclude.families.some((n) => String(n).toLowerCase() === family.toLowerCase())) continue;
        const weight = font.weight != null ? String(font.weight) : "normal";
        const style = font.style != null ? String(font.style) : "normal";
        const stretch = font.stretchPct != null ? `${font.stretchPct}%` : "100%";
        const src = String(font.src || "");
        let b64 = src;
        if (!b64.startsWith("data:")) {
          if ((_m = cache.resource) == null ? void 0 : _m.has(src)) {
            b64 = cache.resource.get(src);
            (_n = cache.font) == null ? void 0 : _n.add(src);
          } else if (!((_o = cache.font) == null ? void 0 : _o.has(src))) {
            try {
              const r = yield snapFetch(src, { as: "dataURL", useProxy, silent: true });
              if (r.ok && typeof r.data === "string") {
                b64 = r.data;
                (_p = cache.resource) == null ? void 0 : _p.set(src, b64);
                (_q = cache.font) == null ? void 0 : _q.add(src);
              } else {
                continue;
              }
            } catch (e) {
              console.warn("[snapdom] Failed to fetch localFonts src:", src);
              continue;
            }
          }
        }
        finalCSS += `@font-face{font-family:'${family}';src:url(${b64});font-style:${style};font-weight:${weight};font-stretch:${stretch};}`;
      }
      if (finalCSS) {
        finalCSS = dedupeFontFaces(finalCSS);
        (_r = cache.resource) == null ? void 0 : _r.set(cacheKey, finalCSS);
      }
      return finalCSS;
    });
  }
  function collectUsedFontVariants(root) {
    const req = /* @__PURE__ */ new Set();
    if (!root) return req;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const addFromStyle = (cs) => {
      const family = pickPrimaryFamily(cs.fontFamily);
      if (!family) return;
      const key = (w, s, st) => `${family}__${normWeight(w)}__${normStyle(s)}__${normStretchPct(st)}`;
      req.add(key(cs.fontWeight, cs.fontStyle, cs.fontStretch));
    };
    addFromStyle(getComputedStyle(root));
    const csBeforeRoot = getComputedStyle(root, "::before");
    if (csBeforeRoot && csBeforeRoot.content && csBeforeRoot.content !== "none") addFromStyle(csBeforeRoot);
    const csAfterRoot = getComputedStyle(root, "::after");
    if (csAfterRoot && csAfterRoot.content && csAfterRoot.content !== "none") addFromStyle(csAfterRoot);
    while (tw.nextNode()) {
      const el = (
        /** @type {Element} */
        tw.currentNode
      );
      const cs = getComputedStyle(el);
      addFromStyle(cs);
      const b = getComputedStyle(el, "::before");
      if (b && b.content && b.content !== "none") addFromStyle(b);
      const a = getComputedStyle(el, "::after");
      if (a && a.content && a.content !== "none") addFromStyle(a);
    }
    return req;
  }
  function collectUsedCodepoints(root) {
    const used = /* @__PURE__ */ new Set();
    const pushText = (txt) => {
      if (!txt) return;
      for (const ch of txt) used.add(ch.codePointAt(0));
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.nodeType === Node.TEXT_NODE) {
        pushText(n.nodeValue || "");
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = (
          /** @type {Element} */
          n
        );
        for (const pseudo of ["::before", "::after"]) {
          const cs = getComputedStyle(el, pseudo);
          const c = cs == null ? void 0 : cs.getPropertyValue("content");
          if (!c || c === "none") continue;
          if (/^"/.test(c) || /^'/.test(c)) {
            pushText(c.slice(1, -1));
          } else {
            const matches = c.match(/\\[0-9A-Fa-f]{1,6}/g);
            if (matches) {
              for (const m of matches) {
                try {
                  used.add(parseInt(m.slice(1), 16));
                } catch (e) {
                }
              }
            }
          }
        }
      }
    }
    return used;
  }
  function ensureFontsReady(families, warmupRepetitions = 2) {
    return __async(this, null, function* () {
      try {
        yield document.fonts.ready;
      } catch (e) {
      }
      const fams = Array.from(families || []).filter(Boolean);
      if (fams.length === 0) return;
      const warmupOnce = () => {
        const container = document.createElement("div");
        container.style.cssText = `position: absolute !important;left: -9999px !important;top: 0 !important;opacity: 0 !important;pointer-events: none !important;contain: layout size style;`;
        for (const fam of fams) {
          const span = document.createElement("span");
          span.textContent = "AaBbGg1234\xC1\xC9\xCD\xD3\xDA\xE7\xF1\u2014\u221E";
          span.style.fontFamily = `"${fam}"`;
          span.style.fontWeight = "700";
          span.style.fontStyle = "italic";
          span.style.fontSize = "32px";
          span.style.lineHeight = "1";
          span.style.whiteSpace = "nowrap";
          span.style.margin = "0";
          span.style.padding = "0";
          container.appendChild(span);
        }
        document.body.appendChild(container);
        container.offsetWidth;
        document.body.removeChild(container);
      };
      for (let i = 0; i < Math.max(1, warmupRepetitions); i++) {
        warmupOnce();
        yield new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
    });
  }

  // src/modules/pseudo.js
  function inlinePseudoElements(source, clone, sessionCache, options) {
    return __async(this, null, function* () {
      var _a;
      if (!(source instanceof Element) || !(clone instanceof Element)) return;
      for (const pseudo of ["::before", "::after", "::first-letter"]) {
        try {
          const style = getStyle(source, pseudo);
          if (!style || typeof style[Symbol.iterator] !== "function") continue;
          const isEmptyPseudo = style.content === "none" && style.backgroundImage === "none" && style.backgroundColor === "transparent" && (style.borderStyle === "none" || parseFloat(style.borderWidth) === 0) && (!style.transform || style.transform === "none") && style.display === "inline";
          if (isEmptyPseudo) continue;
          if (pseudo === "::first-letter") {
            const normal = getComputedStyle(source);
            const isMeaningful = style.color !== normal.color || style.fontSize !== normal.fontSize || style.fontWeight !== normal.fontWeight;
            if (!isMeaningful) continue;
            const textNode = Array.from(clone.childNodes).find(
              (n) => {
                var _a2;
                return n.nodeType === Node.TEXT_NODE && ((_a2 = n.textContent) == null ? void 0 : _a2.trim().length) > 0;
              }
            );
            if (!textNode) continue;
            const text = textNode.textContent;
            const match = text.match(/^([^\p{L}\p{N}\s]*[\p{L}\p{N}](?:['’])?)/u);
            const first = match == null ? void 0 : match[0];
            const rest = text.slice((first == null ? void 0 : first.length) || 0);
            if (!first || /[\uD800-\uDFFF]/.test(first)) continue;
            const span = document.createElement("span");
            span.textContent = first;
            span.dataset.snapdomPseudo = "::first-letter";
            const snapshot2 = snapshotComputedStyle(style);
            const key2 = getStyleKey(snapshot2, "span");
            sessionCache.styleMap.set(span, key2);
            const restNode = document.createTextNode(rest);
            clone.replaceChild(restNode, textNode);
            clone.insertBefore(span, restNode);
            continue;
          }
          const content = style.content;
          const cleanContent = /counter\s*\(|counters\s*\(/.test(content) ? "- " : parseContent(content);
          const bg = style.backgroundImage;
          const bgColor = style.backgroundColor;
          const fontFamily = style.fontFamily;
          const fontSize = parseInt(style.fontSize) || 32;
          const fontWeight = parseInt(style.fontWeight) || false;
          const color = style.color || "#000";
          const display = style.display;
          const width = parseFloat(style.width);
          const height = parseFloat(style.height);
          const borderStyle = style.borderStyle;
          const borderWidth = parseFloat(style.borderWidth);
          const transform = style.transform;
          const isIconFont22 = isIconFont2(fontFamily);
          const hasExplicitContent = content !== "none" && cleanContent !== "";
          const hasBg = bg && bg !== "none";
          const hasBgColor = bgColor && bgColor !== "transparent" && bgColor !== "rgba(0, 0, 0, 0)";
          const hasBox = display !== "inline" && (width > 0 || height > 0);
          const hasBorder = borderStyle && borderStyle !== "none" && borderWidth > 0;
          const hasTransform = transform && transform !== "none";
          const shouldRender = hasExplicitContent || hasBg || hasBgColor || hasBox || hasBorder || hasTransform;
          if (!shouldRender) continue;
          const pseudoEl = document.createElement("span");
          pseudoEl.dataset.snapdomPseudo = pseudo;
          pseudoEl.style.verticalAlign = "middle";
          const snapshot = snapshotComputedStyle(style);
          const key = getStyleKey(snapshot, "span");
          sessionCache.styleMap.set(pseudoEl, key);
          if (isIconFont22 && cleanContent.length === 1) {
            const { dataUrl, width: width2, height: height2 } = yield iconToImage(cleanContent, fontFamily, fontWeight, fontSize, color);
            const imgEl = document.createElement("img");
            imgEl.src = dataUrl;
            imgEl.style = `height:${fontSize}px;width:${width2 / height2 * fontSize}px;object-fit:contain;`;
            pseudoEl.appendChild(imgEl);
            clone.dataset.snapdomHasIcon = "true";
          } else if (cleanContent.startsWith("url(")) {
            const rawUrl = extractURL(cleanContent);
            if (rawUrl == null ? void 0 : rawUrl.trim()) {
              try {
                const imgEl = document.createElement("img");
                const dataUrl = yield snapFetch(safeEncodeURI(rawUrl), { as: "dataURL", useProxy: options.useProxy });
                imgEl.src = dataUrl.data;
                imgEl.style = `width:${fontSize}px;height:auto;object-fit:contain;`;
                pseudoEl.appendChild(imgEl);
              } catch (e) {
                console.error(`[snapdom] Error in pseudo ${pseudo} for`, source, e);
              }
            }
          } else if (!isIconFont22 && hasExplicitContent) {
            pseudoEl.textContent = cleanContent;
          }
          if (hasBg) {
            try {
              const bgSplits = splitBackgroundImage(bg);
              const newBgParts = yield Promise.all(bgSplits.map(inlineSingleBackgroundEntry));
              pseudoEl.style.backgroundImage = newBgParts.join(", ");
            } catch (e) {
              console.warn(`[snapdom] Failed to inline background-image for ${pseudo}`, e);
            }
          }
          if (hasBgColor) pseudoEl.style.backgroundColor = bgColor;
          const hasContent2 = pseudoEl.childNodes.length > 0 || ((_a = pseudoEl.textContent) == null ? void 0 : _a.trim()) !== "";
          const hasVisibleBox = hasContent2 || hasBg || hasBgColor || hasBox || hasBorder || hasTransform;
          if (!hasVisibleBox) continue;
          if (pseudo === "::before") {
            clone.insertBefore(pseudoEl, clone.firstChild);
          } else {
            clone.appendChild(pseudoEl);
          }
        } catch (e) {
          console.warn(`[snapdom] Failed to capture ${pseudo} for`, source, e);
        }
      }
      const sChildren = Array.from(source.children);
      const cChildren = Array.from(clone.children).filter((child) => !child.dataset.snapdomPseudo);
      for (let i = 0; i < Math.min(sChildren.length, cChildren.length); i++) {
        yield inlinePseudoElements(sChildren[i], cChildren[i], sessionCache, options);
      }
    });
  }

  // src/modules/svgDefs.js
  function inlineExternalDefsAndSymbols(rootElement) {
    if (!rootElement) return;
    const usedIds = /* @__PURE__ */ new Set();
    rootElement.querySelectorAll("use").forEach((use) => {
      const href = use.getAttribute("xlink:href") || use.getAttribute("href");
      if (href && href.startsWith("#")) {
        usedIds.add(href.slice(1));
      }
    });
    if (!usedIds.size) return;
    const allGlobal = Array.from(document.querySelectorAll("svg > symbol, svg > defs"));
    const globalSymbols = allGlobal.filter((el) => el.tagName.toLowerCase() === "symbol");
    const globalDefs = allGlobal.filter((el) => el.tagName.toLowerCase() === "defs");
    let container = rootElement.querySelector("svg.inline-defs-container");
    if (!container) {
      container = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      container.setAttribute("aria-hidden", "true");
      container.setAttribute("style", "position: absolute; width: 0; height: 0; overflow: hidden;");
      container.classList.add("inline-defs-container");
      rootElement.insertBefore(container, rootElement.firstChild);
    }
    const existingIds = /* @__PURE__ */ new Set();
    rootElement.querySelectorAll("symbol[id], defs > *[id]").forEach((el) => {
      existingIds.add(el.id);
    });
    usedIds.forEach((id) => {
      if (existingIds.has(id)) return;
      const symbol = globalSymbols.find((sym) => sym.id === id);
      if (symbol) {
        container.appendChild(symbol.cloneNode(true));
        existingIds.add(id);
        return;
      }
      for (const defs of globalDefs) {
        const defEl = defs.querySelector(`#${CSS.escape(id)}`);
        if (defEl) {
          let defsContainer = container.querySelector("defs");
          if (!defsContainer) {
            defsContainer = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            container.appendChild(defsContainer);
          }
          defsContainer.appendChild(defEl.cloneNode(true));
          existingIds.add(id);
          break;
        }
      }
    });
  }

  // src/core/prepare.js
  function prepareClone(_0) {
    return __async(this, arguments, function* (element, options = {}) {
      var _a, _b;
      const sessionCache = {
        styleMap: cache.session.styleMap,
        styleCache: cache.session.styleCache,
        nodeMap: cache.session.nodeMap
      };
      let clone;
      let classCSS = "";
      let shadowScopedCSS = "";
      stabilizeLayout(element);
      try {
        inlineExternalDefsAndSymbols(element);
      } catch (e) {
        console.warn("inlineExternal defs or symbol failed:", e);
      }
      try {
        clone = yield deepClone(element, sessionCache, options, element);
      } catch (e) {
        console.warn("deepClone failed:", e);
        throw e;
      }
      try {
        yield inlinePseudoElements(element, clone, sessionCache, options);
      } catch (e) {
        console.warn("inlinePseudoElements failed:", e);
      }
      yield resolveBlobUrlsInTree(clone);
      try {
        const styleNodes = clone.querySelectorAll("style[data-sd]");
        for (const s of styleNodes) {
          shadowScopedCSS += s.textContent || "";
          s.remove();
        }
      } catch (e) {
      }
      const keyToClass = generateCSSClasses(sessionCache.styleMap);
      classCSS = Array.from(keyToClass.entries()).map(([key, className]) => `.${className}{${key}}`).join("");
      classCSS = shadowScopedCSS + classCSS;
      for (const [node, key] of sessionCache.styleMap.entries()) {
        if (node.tagName === "STYLE") continue;
        if (node.getRootNode && node.getRootNode() instanceof ShadowRoot) {
          node.setAttribute("style", key.replace(/;/g, "; "));
          continue;
        }
        const className = keyToClass.get(key);
        if (className) node.classList.add(className);
        const bgImage = (_a = node.style) == null ? void 0 : _a.backgroundImage;
        const hasIcon = (_b = node.dataset) == null ? void 0 : _b.snapdomHasIcon;
        if (bgImage && bgImage !== "none") node.style.backgroundImage = bgImage;
        if (hasIcon) {
          node.style.verticalAlign = "middle";
          node.style.display = "inline";
        }
      }
      for (const [cloneNode, originalNode] of sessionCache.nodeMap.entries()) {
        const scrollX = originalNode.scrollLeft;
        const scrollY = originalNode.scrollTop;
        const hasScroll = scrollX || scrollY;
        if (hasScroll && cloneNode instanceof HTMLElement) {
          cloneNode.style.overflow = "hidden";
          cloneNode.style.scrollbarWidth = "none";
          cloneNode.style.msOverflowStyle = "none";
          const inner = document.createElement("div");
          inner.style.transform = `translate(${-scrollX}px, ${-scrollY}px)`;
          inner.style.willChange = "transform";
          inner.style.display = "inline-block";
          inner.style.width = "100%";
          while (cloneNode.firstChild) {
            inner.appendChild(cloneNode.firstChild);
          }
          cloneNode.appendChild(inner);
        }
      }
      if (element === sessionCache.nodeMap.get(clone)) {
        const computed = sessionCache.styleCache.get(element) || window.getComputedStyle(element);
        sessionCache.styleCache.set(element, computed);
        const transform = stripTranslate(computed.transform);
        clone.style.margin = "0";
        clone.style.position = "static";
        clone.style.top = "auto";
        clone.style.left = "auto";
        clone.style.right = "auto";
        clone.style.bottom = "auto";
        clone.style.zIndex = "auto";
        clone.style.float = "none";
        clone.style.clear = "none";
        clone.style.transform = transform || "";
      }
      for (const [cloneNode, originalNode] of sessionCache.nodeMap.entries()) {
        if (originalNode.tagName === "PRE") {
          cloneNode.style.marginTop = "0";
          cloneNode.style.marginBlockStart = "0";
        }
      }
      return { clone, classCSS, styleCache: sessionCache.styleCache };
    });
  }
  function stabilizeLayout(element) {
    const style = getComputedStyle(element);
    const outlineStyle = style.outlineStyle;
    const outlineWidth = style.outlineWidth;
    const borderStyle = style.borderStyle;
    const borderWidth = style.borderWidth;
    const outlineVisible = outlineStyle !== "none" && parseFloat(outlineWidth) > 0;
    const borderAbsent = borderStyle === "none" || parseFloat(borderWidth) === 0;
    if (outlineVisible && borderAbsent) {
      element.style.border = `${outlineWidth} solid transparent`;
    }
  }
  var _blobToDataUrlCache = /* @__PURE__ */ new Map();
  function blobUrlToDataUrl(blobUrl) {
    return __async(this, null, function* () {
      var _a;
      if ((_a = cache.resource) == null ? void 0 : _a.has(blobUrl)) return cache.resource.get(blobUrl);
      if (_blobToDataUrlCache.has(blobUrl)) return _blobToDataUrlCache.get(blobUrl);
      const p = (() => __async(null, null, function* () {
        var _a2;
        const r = yield snapFetch(blobUrl, { as: "dataURL", silent: true });
        if (!r.ok || typeof r.data !== "string") {
          throw new Error(`[snapDOM] Failed to read blob URL: ${blobUrl}`);
        }
        (_a2 = cache.resource) == null ? void 0 : _a2.set(blobUrl, r.data);
        return r.data;
      }))();
      _blobToDataUrlCache.set(blobUrl, p);
      try {
        const data = yield p;
        _blobToDataUrlCache.set(blobUrl, data);
        return data;
      } catch (e) {
        _blobToDataUrlCache.delete(blobUrl);
        throw e;
      }
    });
  }
  var BLOB_URL_RE = /\bblob:[^)"'\s]+/g;
  function replaceBlobUrlsInCssText(cssText) {
    return __async(this, null, function* () {
      if (!cssText || cssText.indexOf("blob:") === -1) return cssText;
      const uniques = Array.from(new Set(cssText.match(BLOB_URL_RE) || []));
      if (uniques.length === 0) return cssText;
      let out = cssText;
      for (const u of uniques) {
        try {
          const d = yield blobUrlToDataUrl(u);
          out = out.split(u).join(d);
        } catch (e) {
        }
      }
      return out;
    });
  }
  function isBlobUrl(u) {
    return typeof u === "string" && u.startsWith("blob:");
  }
  function parseSrcset(srcset) {
    return (srcset || "").split(",").map((s) => s.trim()).filter(Boolean).map((item) => {
      const m = item.match(/^(\S+)(\s+.+)?$/);
      return m ? { url: m[1], desc: m[2] || "" } : null;
    }).filter(Boolean);
  }
  function stringifySrcset(parts) {
    return parts.map((p) => p.desc ? `${p.url} ${p.desc.trim()}` : p.url).join(", ");
  }
  function resolveBlobUrlsInTree(root) {
    return __async(this, null, function* () {
      var _a, _b;
      if (!root) return;
      const imgs = root.querySelectorAll ? root.querySelectorAll("img") : [];
      for (const img of imgs) {
        try {
          const srcAttr = img.getAttribute("src");
          const effective = srcAttr || img.currentSrc || "";
          if (isBlobUrl(effective)) {
            const data = yield blobUrlToDataUrl(effective);
            img.setAttribute("src", data);
          }
          const srcset = img.getAttribute("srcset");
          if (srcset && srcset.includes("blob:")) {
            const parts = parseSrcset(srcset);
            let changed = false;
            for (const p of parts) {
              if (isBlobUrl(p.url)) {
                try {
                  p.url = yield blobUrlToDataUrl(p.url);
                  changed = true;
                } catch (e) {
                }
              }
            }
            if (changed) img.setAttribute("srcset", stringifySrcset(parts));
          }
        } catch (e) {
        }
      }
      const svgImages = root.querySelectorAll ? root.querySelectorAll("image") : [];
      for (const node of svgImages) {
        try {
          const XLINK_NS = "http://www.w3.org/1999/xlink";
          const href = node.getAttribute("href") || ((_a = node.getAttributeNS) == null ? void 0 : _a.call(node, XLINK_NS, "href"));
          if (isBlobUrl(href)) {
            const d = yield blobUrlToDataUrl(href);
            node.setAttribute("href", d);
            (_b = node.removeAttributeNS) == null ? void 0 : _b.call(node, XLINK_NS, "href");
          }
        } catch (e) {
        }
      }
      const styled = root.querySelectorAll ? root.querySelectorAll("[style*='blob:']") : [];
      for (const el of styled) {
        try {
          const styleText = el.getAttribute("style");
          if (styleText && styleText.includes("blob:")) {
            const replaced = yield replaceBlobUrlsInCssText(styleText);
            el.setAttribute("style", replaced);
          }
        } catch (e) {
        }
      }
      const styleTags = root.querySelectorAll ? root.querySelectorAll("style") : [];
      for (const s of styleTags) {
        try {
          const css = s.textContent || "";
          if (css.includes("blob:")) {
            s.textContent = yield replaceBlobUrlsInCssText(css);
          }
        } catch (e) {
        }
      }
      const urlAttrs = ["poster"];
      for (const attr of urlAttrs) {
        const nodes = root.querySelectorAll ? root.querySelectorAll(`[${attr}^='blob:']`) : [];
        for (const n of nodes) {
          try {
            const u = n.getAttribute(attr);
            if (isBlobUrl(u)) {
              n.setAttribute(attr, yield blobUrlToDataUrl(u));
            }
          } catch (e) {
          }
        }
      }
    });
  }

  // src/modules/images.js
  function inlineImages(_0) {
    return __async(this, arguments, function* (clone, options = {}) {
      const imgs = Array.from(clone.querySelectorAll("img"));
      const processImg = (img) => __async(null, null, function* () {
        var _a, _b, _c, _d;
        if (!img.getAttribute("src")) {
          const eff = img.currentSrc || img.src || "";
          if (eff) img.setAttribute("src", eff);
        }
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        const src = img.src || "";
        if (!src) return;
        const r = yield snapFetch(src, { as: "dataURL", useProxy: options.useProxy });
        if (r.ok && typeof r.data === "string" && r.data.startsWith("data:")) {
          img.src = r.data;
          if (!img.width) img.width = img.naturalWidth || 100;
          if (!img.height) img.height = img.naturalHeight || 100;
          return;
        }
        const { defaultImageUrl } = options || {};
        if (defaultImageUrl) {
          try {
            const dsW = parseInt(((_a = img.dataset) == null ? void 0 : _a.snapdomWidth) || "", 10) || 0;
            const dsH = parseInt(((_b = img.dataset) == null ? void 0 : _b.snapdomHeight) || "", 10) || 0;
            const attrW = parseInt(img.getAttribute("width") || "", 10) || 0;
            const attrH = parseInt(img.getAttribute("height") || "", 10) || 0;
            const styleW = parseFloat(((_c = img.style) == null ? void 0 : _c.width) || "") || 0;
            const styleH = parseFloat(((_d = img.style) == null ? void 0 : _d.height) || "") || 0;
            const width = dsW || styleW || attrW || img.width || void 0;
            const height = dsH || styleH || attrH || img.height || void 0;
            const fallbackUrl = typeof defaultImageUrl === "function" ? yield defaultImageUrl({ width, height, src, element: img }) : defaultImageUrl;
            if (fallbackUrl) {
              const fallbackData = yield snapFetch(fallbackUrl, { as: "dataURL", useProxy: options.useProxy });
              img.src = fallbackData.data;
              if (!img.width && width) img.width = width;
              if (!img.height && height) img.height = height;
              if (!img.width) img.width = img.naturalWidth || 100;
              if (!img.height) img.height = img.naturalHeight || 100;
              return;
            }
          } catch (e) {
          }
        }
        const w = img.width || img.naturalWidth || 100;
        const h = img.height || img.naturalHeight || 100;
        if (options.placeholders !== false) {
          const fallback = document.createElement("div");
          fallback.style.cssText = [
            `width:${w}px`,
            `height:${h}px`,
            "background:#ccc",
            "display:inline-block",
            "text-align:center",
            `line-height:${h}px`,
            "color:#666",
            "font-size:12px",
            "overflow:hidden"
          ].join(";");
          fallback.textContent = "img";
          img.replaceWith(fallback);
        } else {
          const spacer = document.createElement("div");
          spacer.style.cssText = `display:inline-block;width:${w}px;height:${h}px;visibility:hidden;`;
          img.replaceWith(spacer);
        }
      });
      for (let i = 0; i < imgs.length; i += 4) {
        const group = imgs.slice(i, i + 4).map(processImg);
        yield Promise.allSettled(group);
      }
    });
  }

  // src/modules/background.js
  function inlineBackgroundImages(_0, _1, _2) {
    return __async(this, arguments, function* (source, clone, styleCache, options = {}) {
      const queue = [[source, clone]];
      const URL_PROPS = [
        "background-image",
        // Mask shorthands & images (both standard and WebKit)
        "mask",
        "mask-image",
        "-webkit-mask",
        "-webkit-mask-image",
        // Mask sources (rare, but keep)
        "mask-source",
        "mask-box-image-source",
        "mask-border-source",
        "-webkit-mask-box-image-source",
        // Border image
        "border-image",
        "border-image-source"
      ];
      const MASK_LAYOUT_PROPS = [
        "mask-position",
        "mask-size",
        "mask-repeat",
        // WebKit variants
        "-webkit-mask-position",
        "-webkit-mask-size",
        "-webkit-mask-repeat",
        // Extra (optional but helpful across engines)
        "mask-origin",
        "mask-clip",
        "-webkit-mask-origin",
        "-webkit-mask-clip",
        // Some engines expose X/Y position separately:
        "-webkit-mask-position-x",
        "-webkit-mask-position-y"
      ];
      const BORDER_AUX_PROPS = [
        "border-image-slice",
        "border-image-width",
        "border-image-outset",
        "border-image-repeat"
      ];
      while (queue.length) {
        const [srcNode, cloneNode] = queue.shift();
        const style = styleCache.get(srcNode) || getStyle(srcNode);
        if (!styleCache.has(srcNode)) styleCache.set(srcNode, style);
        const hasBorderImage = (() => {
          const bi = style.getPropertyValue("border-image");
          const bis = style.getPropertyValue("border-image-source");
          return bi && bi !== "none" || bis && bis !== "none";
        })();
        for (const prop of URL_PROPS) {
          const val = style.getPropertyValue(prop);
          if (!val || val === "none") continue;
          const splits = splitBackgroundImage(val);
          const inlined = yield Promise.all(
            splits.map((entry) => inlineSingleBackgroundEntry(entry, options))
          );
          if (inlined.some((p) => p && p !== "none" && !/^url\(undefined/.test(p))) {
            cloneNode.style.setProperty(prop, inlined.join(", "));
          }
        }
        for (const prop of MASK_LAYOUT_PROPS) {
          const val = style.getPropertyValue(prop);
          if (!val || val === "initial") continue;
          cloneNode.style.setProperty(prop, val);
        }
        if (hasBorderImage) {
          for (const prop of BORDER_AUX_PROPS) {
            const val = style.getPropertyValue(prop);
            if (!val || val === "initial") continue;
            cloneNode.style.setProperty(prop, val);
          }
        }
        const sChildren = Array.from(srcNode.children);
        const cChildren = Array.from(cloneNode.children);
        for (let i = 0; i < Math.min(sChildren.length, cChildren.length); i++) {
          queue.push([sChildren[i], cChildren[i]]);
        }
      }
    });
  }

  // src/core/capture.js
  function captureDOM(element, options) {
    return __async(this, null, function* () {
      if (!element) throw new Error("Element cannot be null or undefined");
      applyCachePolicy(options.cache);
      const fast = options.fast;
      let clone, classCSS, styleCache;
      let fontsCSS = "";
      let baseCSS = "";
      let dataURL;
      let svgString;
      ({ clone, classCSS, styleCache } = yield prepareClone(element, options));
      yield new Promise((resolve) => {
        idle(() => __async(null, null, function* () {
          yield inlineImages(clone, options);
          resolve();
        }), { fast });
      });
      yield new Promise((resolve) => {
        idle(() => __async(null, null, function* () {
          yield inlineBackgroundImages(element, clone, styleCache, options);
          resolve();
        }), { fast });
      });
      if (options.embedFonts) {
        yield new Promise((resolve) => {
          idle(() => __async(null, null, function* () {
            const required = collectUsedFontVariants(element);
            const usedCodepoints = collectUsedCodepoints(element);
            if (isSafari) {
              const families = new Set(
                Array.from(required).map((k) => String(k).split("__")[0]).filter(Boolean)
              );
              yield ensureFontsReady(families, 5);
            }
            fontsCSS = yield embedCustomFonts({
              required,
              usedCodepoints,
              preCached: false,
              exclude: options.excludeFonts,
              useProxy: options.useProxy
            });
            resolve();
          }), { fast });
        });
      }
      const usedTags = collectUsedTagNames(clone).sort();
      const tagKey = usedTags.join(",");
      if (cache.baseStyle.has(tagKey)) {
        baseCSS = cache.baseStyle.get(tagKey);
      } else {
        yield new Promise((resolve) => {
          idle(() => {
            baseCSS = generateDedupedBaseCSS(usedTags);
            cache.baseStyle.set(tagKey, baseCSS);
            resolve();
          }, { fast });
        });
      }
      yield new Promise((resolve) => {
        idle(() => {
          var _a, _b, _c, _d, _e;
          const rect = getNaturalBorderBoxSize(element);
          let w = rect.width;
          let h = rect.height;
          const hasW = Number.isFinite(options.width);
          const hasH = Number.isFinite(options.height);
          const scaleOpt = (_a = options.scale) != null ? _a : 1;
          const hasScale = typeof scaleOpt === "number" && scaleOpt !== 1;
          if (!hasScale) {
            const aspect = rect.width / rect.height;
            if (hasW && hasH) {
              w = options.width;
              h = options.height;
            } else if (hasW) {
              w = options.width;
              h = w / aspect;
            } else if (hasH) {
              h = options.height;
              w = h * aspect;
            }
          }
          w = Math.max(1, Math.ceil(w));
          h = Math.max(1, Math.ceil(h));
          const csEl = getComputedStyle(element);
          const baseTransform = csEl.transform && csEl.transform !== "none" ? csEl.transform : "";
          const ind = readIndividualTransforms(element);
          let outW, outH, tx, ty, cancelTranslateX = 0, cancelTranslateY = 0;
          if (!hasBBoxAffectingTransform(element)) {
            const r = element.getBoundingClientRect();
            const vp = inflateRect(r, { top: 0, right: 0, bottom: 0, left: 0 });
            outW = Math.max(1, vp.width);
            outH = Math.max(1, vp.height);
            tx = -(vp.x - Math.floor(r.left));
            ty = -(vp.y - Math.floor(r.top));
          } else {
            const TOTAL = readTotalTransformMatrix({
              baseTransform,
              rotate: ind.rotate || "0deg",
              scale: ind.scale,
              translate: ind.translate
            });
            const e = (_c = (_b = TOTAL.e) != null ? _b : TOTAL.m41) != null ? _c : 0;
            const f = (_e = (_d = TOTAL.f) != null ? _d : TOTAL.m42) != null ? _e : 0;
            cancelTranslateX = -e;
            cancelTranslateY = -f;
            const M2D = TOTAL.is2D ? matrix2DNoTranslate(TOTAL) : matrix2DNoTranslate(new DOMMatrix(TOTAL.toString()));
            const bb = bboxFromMatrix(w, h, M2D);
            outW = Math.max(1, Math.ceil(bb.width));
            outH = Math.max(1, Math.ceil(bb.height));
            tx = -bb.minX;
            ty = -bb.minY;
          }
          const svgNS = "http://www.w3.org/2000/svg";
          const fo = document.createElementNS(svgNS, "foreignObject");
          fo.setAttribute("width", "100%");
          fo.setAttribute("height", "100%");
          fo.setAttribute("x", String(tx));
          fo.setAttribute("y", String(ty));
          fo.style.overflow = "visible";
          const styleTag = document.createElement("style");
          styleTag.textContent = baseCSS + fontsCSS + "svg{overflow:visible;} foreignObject{overflow:visible;}" + classCSS;
          fo.appendChild(styleTag);
          const container = document.createElement("div");
          container.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
          container.style.width = `${w}px`;
          container.style.height = `${h}px`;
          container.style.overflow = "visible";
          container.style.transformOrigin = "0 0";
          const cancels = [];
          if (cancelTranslateX || cancelTranslateY) {
            cancels.push(`translate(${cancelTranslateX}px, ${cancelTranslateY}px)`);
          }
          if (!hasScale && (hasW || hasH)) {
            const sxWH = rect.width ? w / rect.width : 1;
            const syWH = rect.height ? h / rect.height : 1;
            cancels.push(`scale(${sxWH}, ${syWH})`);
          } else if (hasScale) {
            cancels.push(`scale(${scaleOpt})`);
          }
          if (cancels.length) container.style.transform = cancels.join(" ");
          clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
          clone.style.transformOrigin = "0 0";
          clone.style.position = "static";
          clone.style.left = "0";
          clone.style.top = "0";
          if (baseTransform) clone.style.transform = baseTransform;
          clone.style.rotate = ind.rotate || "0deg";
          clone.style.scale = ind.scale || "1";
          clone.style.translate = ind.translate || "0 0";
          container.appendChild(clone);
          fo.appendChild(container);
          const serializer = new XMLSerializer();
          const foString = serializer.serializeToString(fo);
          const svgHeader = `<svg xmlns="${svgNS}" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">`;
          const svgFooter = "</svg>";
          svgString = svgHeader + foString + svgFooter;
          dataURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
          resolve();
        }, { fast });
      });
      const sandbox = document.getElementById("snapdom-sandbox");
      if (sandbox && sandbox.style.position === "absolute") sandbox.remove();
      return dataURL;
    });
  }
  function getNaturalBorderBoxSize(el) {
    const cs = getComputedStyle(el);
    const px = (v) => parseFloat(v) || 0;
    let w = px(cs.width);
    let h = px(cs.height);
    if (cs.boxSizing === "content-box") {
      w += px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
      h += px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    }
    return { width: w, height: h };
  }
  function matrixFromComputed(el) {
    const tr = getComputedStyle(el).transform;
    if (!tr || tr === "none") return new DOMMatrix();
    try {
      return new DOMMatrix(tr);
    } catch (e) {
      return new WebKitCSSMatrix(tr);
    }
  }
  function matrix2DNoTranslate(M) {
    return new DOMMatrix([M.a, M.b, M.c, M.d, 0, 0]);
  }
  function bboxFromMatrix(w, h, M2D) {
    const pts = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: h },
      { x: w, y: h }
    ];
    const t = pts.map((p) => ({
      x: M2D.a * p.x + M2D.c * p.y,
      y: M2D.b * p.x + M2D.d * p.y
    }));
    const minX = Math.min(...t.map((p) => p.x));
    const maxX = Math.max(...t.map((p) => p.x));
    const minY = Math.min(...t.map((p) => p.y));
    const maxY = Math.max(...t.map((p) => p.y));
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }
  function readIndividualTransforms(el) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
    const out = { rotate: "0deg", scale: null, translate: null };
    const map = (_a = el.computedStyleMap) == null ? void 0 : _a.call(el);
    if (map) {
      const rot = map.get("rotate");
      if (rot) {
        const ang = (_b = rot.angle) != null ? _b : rot;
        if (ang && "unit" in ang) {
          out.rotate = ang.unit === "rad" ? ang.value * 180 / Math.PI + "deg" : ang.value + ang.unit;
        } else {
          out.rotate = String(rot);
        }
      }
      const sc = map.get("scale");
      if (sc && sc.length) {
        const sx = (_d = (_c = sc[0]) == null ? void 0 : _c.value) != null ? _d : 1;
        const sy = (_f = (_e = sc[1]) == null ? void 0 : _e.value) != null ? _f : sx;
        out.scale = `${sx} ${sy}`;
      }
      const tr = map.get("translate");
      if (tr && tr.length) {
        const tx = (_h = (_g = tr[0]) == null ? void 0 : _g.value) != null ? _h : 0;
        const ty = (_j = (_i = tr[1]) == null ? void 0 : _i.value) != null ? _j : 0;
        const ux = (_l = (_k = tr[0]) == null ? void 0 : _k.unit) != null ? _l : "px";
        const uy = (_n = (_m = tr[1]) == null ? void 0 : _m.unit) != null ? _n : "px";
        out.translate = `${tx}${ux} ${ty}${uy}`;
      }
      return out;
    }
    const cs = getComputedStyle(el);
    out.rotate = cs.rotate && cs.rotate !== "none" ? cs.rotate : "0deg";
    out.scale = cs.scale && cs.scale !== "none" ? cs.scale : null;
    out.translate = cs.translate && cs.translate !== "none" ? cs.translate : null;
    return out;
  }
  function hasBBoxAffectingTransform(el) {
    const t = getComputedStyle(el).transform || "none";
    if (t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)") return false;
    if (/^matrix\(\s*1\s*,\s*0\s*,\s*0\s*,\s*1\s*,/i.test(t)) return false;
    return true;
  }
  function inflateRect(r, p) {
    const x = Math.floor(r.left - p.left);
    const y = Math.floor(r.top - p.top);
    const w = Math.ceil(r.width + p.left + p.right);
    const h = Math.ceil(r.height + p.top + p.bottom);
    return { x, y, width: w, height: h };
  }
  var __measureHost = null;
  function getMeasureHost() {
    if (__measureHost) return __measureHost;
    const n = document.createElement("div");
    n.id = "snapdom-measure-slot";
    n.setAttribute("aria-hidden", "true");
    Object.assign(n.style, {
      position: "absolute",
      left: "-99999px",
      top: "0px",
      width: "0px",
      height: "0px",
      overflow: "hidden",
      opacity: "0",
      pointerEvents: "none",
      contain: "size layout style"
    });
    document.documentElement.appendChild(n);
    __measureHost = n;
    return n;
  }
  function readTotalTransformMatrix(t) {
    const host = getMeasureHost();
    const tmp = document.createElement("div");
    tmp.style.transformOrigin = "0 0";
    if (t.baseTransform) tmp.style.transform = t.baseTransform;
    if (t.rotate) tmp.style.rotate = t.rotate;
    if (t.scale) tmp.style.scale = t.scale;
    if (t.translate) tmp.style.translate = t.translate;
    host.appendChild(tmp);
    const M = matrixFromComputed(tmp);
    host.removeChild(tmp);
    return M;
  }

  // src/core/context.js
  function normalizeCachePolicy(v) {
    if (typeof v === "string") {
      const s = v.toLowerCase().trim();
      if (s === "disabled" || s === "full" || s === "auto" || s === "soft") return (
        /** @type {CachePolicy} */
        s
      );
    }
    return "soft";
  }
  function createContext(options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    const resolvedFormat = (_a = options.format) != null ? _a : "png";
    const cachePolicy = normalizeCachePolicy(options.cache);
    return {
      // Debug & perf
      debug: (_b = options.debug) != null ? _b : false,
      fast: (_c = options.fast) != null ? _c : true,
      scale: (_d = options.scale) != null ? _d : 1,
      // DOM filters
      exclude: (_e = options.exclude) != null ? _e : [],
      filter: (_f = options.filter) != null ? _f : null,
      placeholders: options.placeholders !== false,
      // default true
      // Fuentes
      embedFonts: (_g = options.embedFonts) != null ? _g : false,
      iconFonts: Array.isArray(options.iconFonts) ? options.iconFonts : options.iconFonts ? [options.iconFonts] : [],
      localFonts: Array.isArray(options.localFonts) ? options.localFonts : [],
      excludeFonts: (_h = options.excludeFonts) != null ? _h : void 0,
      defaultImageUrl: (_i = options.defaultImageUrl) != null ? _i : void 0,
      /** Cache policy (disabled|full|auto|soft). Default: "soft" */
      /** @type {CachePolicy} */
      cache: cachePolicy,
      // Red
      useProxy: typeof options.useProxy === "string" ? options.useProxy : "",
      // Salida
      width: (_j = options.width) != null ? _j : null,
      height: (_k = options.height) != null ? _k : null,
      format: resolvedFormat,
      type: (_l = options.type) != null ? _l : "svg",
      quality: (_m = options.quality) != null ? _m : 0.92,
      dpr: (_n = options.dpr) != null ? _n : window.devicePixelRatio || 1,
      backgroundColor: (_o = options.backgroundColor) != null ? _o : ["jpg", "jpeg", "webp"].includes(resolvedFormat) ? "#ffffff" : null,
      filename: (_p = options.filename) != null ? _p : "snapDOM"
      // Plugins (reservado para futura activación)
      // plugins: normalizePlugins(...),
    };
  }

  // src/exporters/toImg.js
  function toImg(url, options) {
    return __async(this, null, function* () {
      const img = new Image();
      img.src = url;
      yield img.decode();
      if (options.scale !== 1) {
        img.style.width = `${img.naturalWidth * options.scale}px`;
        img.style.height = `${img.naturalHeight * options.scale}px`;
      }
      return img;
    });
  }

  // src/exporters/toCanvas.js
  function toCanvas(url, options) {
    return __async(this, null, function* () {
      const { scale, dpr } = options;
      const safari = isSafari();
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.loading = "eager";
      img.decoding = "sync";
      img.src = url;
      let tempSlot = null;
      if (safari) {
        tempSlot = document.createElement("div");
        tempSlot.setAttribute("aria-hidden", "true");
        tempSlot.style.cssText = "position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;contain:size layout style;";
        document.body.appendChild(tempSlot);
        tempSlot.appendChild(img);
      }
      yield img.decode();
      if (safari) {
        yield new Promise((r) => setTimeout(r, 100));
      }
      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (dpr !== 1) ctx.scale(dpr, dpr);
      ctx.drawImage(img, 0, 0, width, height);
      if (tempSlot && tempSlot.parentNode) {
        try {
          tempSlot.parentNode.removeChild(tempSlot);
        } catch (e) {
        }
      }
      return canvas;
    });
  }

  // src/exporters/toBlob.js
  function toBlob(url, options) {
    return __async(this, null, function* () {
      const type = options.type;
      if (type === "svg") {
        const svgText = decodeURIComponent(url.split(",")[1]);
        return new Blob([svgText], { type: "image/svg+xml" });
      }
      const canvas = yield toCanvas(url, options);
      const finalCanvas = options.backgroundColor ? createBackground(canvas, options.backgroundColor) : canvas;
      return new Promise(
        (resolve) => finalCanvas.toBlob(
          (blob) => resolve(blob),
          `image/${type}`,
          options.quality
        )
      );
    });
  }

  // src/modules/rasterize.js
  function rasterize(url, options) {
    return __async(this, null, function* () {
      const canvas = yield toCanvas(url, options);
      const finalCanvas = options.backgroundColor ? createBackground(canvas, options.backgroundColor) : canvas;
      const img = new Image();
      img.src = finalCanvas.toDataURL(`image/${options.format}`, options.quality);
      yield img.decode();
      img.style.width = `${finalCanvas.width / options.dpr}px`;
      img.style.height = `${finalCanvas.height / options.dpr}px`;
      return img;
    });
  }

  // src/exporters/download.js
  function download(url, options) {
    return __async(this, null, function* () {
      if (options.format === "svg") {
        const blob = yield toBlob(url, __spreadProps(__spreadValues({}, options), { type: "svg" }));
        const objectURL = URL.createObjectURL(blob);
        const a2 = document.createElement("a");
        a2.href = objectURL;
        a2.download = options.filename;
        a2.click();
        URL.revokeObjectURL(objectURL);
        return;
      }
      const canvas = yield toCanvas(url, options);
      const finalCanvas = options.backgroundColor ? createBackground(canvas, options.backgroundColor) : canvas;
      const a = document.createElement("a");
      a.href = finalCanvas.toDataURL(`image/${options.format}`, options.quality);
      a.download = options.filename;
      a.click();
    });
  }

  // src/api/snapdom.js
  var INTERNAL_TOKEN = Symbol("snapdom.internal");
  function snapdom(element, userOptions) {
    return __async(this, null, function* () {
      if (!element) throw new Error("Element cannot be null or undefined");
      const context = createContext(userOptions);
      if (context.iconFonts && context.iconFonts.length > 0) extendIconFonts(context.iconFonts);
      if (!context.snap) {
        context.snap = {
          toPng: (el, opts) => snapdom.toPng(el, opts),
          toImg: (el, opts) => snapdom.toImg(el, opts)
        };
      }
      return snapdom.capture(element, context, INTERNAL_TOKEN);
    });
  }
  snapdom.capture = (el, context, _token) => __async(null, null, function* () {
    if (_token !== INTERNAL_TOKEN) throw new Error("[snapdom.capture] is internal. Use snapdom(...) instead.");
    const url = yield captureDOM(el, context);
    const ensureContext = (opts) => __spreadValues(__spreadValues({}, context), opts || {});
    const withFormat = (format) => (opts) => {
      const next = ensureContext(__spreadProps(__spreadValues({}, opts || {}), { format }));
      const wantsJpeg = format === "jpeg" || format === "jpg";
      const noBg = next.backgroundColor == null || next.backgroundColor === "transparent";
      if (wantsJpeg && noBg) {
        next.backgroundColor = "#ffffff";
      }
      return rasterize(url, next);
    };
    return {
      url,
      toRaw: () => url,
      toImg: (opts) => toImg(url, ensureContext(opts)),
      toCanvas: (opts) => toCanvas(url, ensureContext(opts)),
      toBlob: (opts) => toBlob(url, ensureContext(opts)),
      toPng: withFormat("png"),
      toJpg: withFormat("jpeg"),
      toWebp: withFormat("webp"),
      download: (opts) => download(url, ensureContext(opts))
    };
  });
  snapdom.toRaw = (el, options) => snapdom(el, options).then((result) => result.toRaw());
  snapdom.toImg = (el, options) => snapdom(el, options).then((result) => result.toImg());
  snapdom.toCanvas = (el, options) => snapdom(el, options).then((result) => result.toCanvas());
  snapdom.toBlob = (el, options) => snapdom(el, options).then((result) => result.toBlob());
  snapdom.toPng = (el, options) => snapdom(el, __spreadProps(__spreadValues({}, options), { format: "png" })).then((result) => result.toPng());
  snapdom.toJpg = (el, options) => snapdom(el, __spreadProps(__spreadValues({}, options), { format: "jpeg" })).then((result) => result.toJpg());
  snapdom.toWebp = (el, options) => snapdom(el, __spreadProps(__spreadValues({}, options), { format: "webp" })).then((result) => result.toWebp());
  snapdom.download = (el, options) => snapdom(el, options).then((result) => result.download());

  // src/api/preCache.js
  function preCache() {
    return __async(this, arguments, function* (root = document, options = {}) {
      var _a;
      const {
        embedFonts = true,
        cacheOpt = "full",
        useProxy = ""
      } = options;
      applyCachePolicy(cacheOpt);
      try {
        yield document.fonts.ready;
      } catch (e) {
      }
      precacheCommonTags();
      cache.session = cache.session || {};
      if (!cache.session.styleCache) {
        cache.session.styleCache = /* @__PURE__ */ new WeakMap();
      }
      try {
        yield inlineBackgroundImages(
          root,
          /* mirror */
          void 0,
          cache.session.styleCache,
          { useProxy }
        );
      } catch (e) {
      }
      let imgEls = [], allEls = [];
      try {
        if (root == null ? void 0 : root.querySelectorAll) {
          imgEls = Array.from(root.querySelectorAll("img[src]"));
          allEls = Array.from(root.querySelectorAll("*"));
        }
      } catch (e) {
      }
      const promises = [];
      for (const img of imgEls) {
        const src = img == null ? void 0 : img.src;
        if (!src) continue;
        if (!cache.image.has(src)) {
          const p = Promise.resolve().then(() => snapFetch(src, { as: "dataURL", useProxy })).then((dataURL) => {
            cache.image.set(src, dataURL);
          }).catch(() => {
          });
          promises.push(p);
        }
      }
      for (const el of allEls) {
        let bg = "";
        try {
          bg = getStyle(el).backgroundImage;
        } catch (e) {
        }
        if (bg && bg !== "none") {
          const parts = splitBackgroundImage(bg);
          for (const entry of parts) {
            if (entry.startsWith("url(")) {
              const p = Promise.resolve().then(() => inlineSingleBackgroundEntry(entry, __spreadProps(__spreadValues({}, options), { useProxy }))).catch(() => {
              });
              promises.push(p);
            }
          }
        }
      }
      if (embedFonts) {
        try {
          const required = collectUsedFontVariants(root);
          const usedCodepoints = collectUsedCodepoints(root);
          if (typeof isSafari === "function" ? isSafari() : !!isSafari) {
            const families = new Set(
              Array.from(required).map((k) => String(k).split("__")[0]).filter(Boolean)
            );
            yield ensureFontsReady(families, 2);
          }
          yield embedCustomFonts({
            required,
            usedCodepoints,
            exclude: options.excludeFonts,
            localFonts: options.localFonts,
            useProxy: (_a = options.useProxy) != null ? _a : useProxy
          });
        } catch (e) {
        }
      }
      yield Promise.allSettled(promises);
    });
  }

  // src/index.browser.js
  if (typeof window !== "undefined") {
    window.snapdom = snapdom;
    window.preCache = preCache;
  }
})();
