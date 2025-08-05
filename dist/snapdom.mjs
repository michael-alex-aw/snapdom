
/*
* snapdom
* v.1.9.7
* Author Juan Martin Muda
* License MIT
**/


// src/core/cache.js
var cache = {
  image: /* @__PURE__ */ new Map(),
  background: /* @__PURE__ */ new Map(),
  resource: /* @__PURE__ */ new Map(),
  defaultStyle: /* @__PURE__ */ new Map(),
  baseStyle: /* @__PURE__ */ new Map(),
  computedStyle: /* @__PURE__ */ new WeakMap(),
  font: /* @__PURE__ */ new Set(),
  snapshot: /* @__PURE__ */ new WeakMap(),
  snapshotKey: /* @__PURE__ */ new Map(),
  preStyleMap: /* @__PURE__ */ new Map(),
  preStyle: /* @__PURE__ */ new WeakMap(),
  preNodeMap: /* @__PURE__ */ new Map(),
  reset: resetCache
};
function resetCache() {
  cache.computedStyle = /* @__PURE__ */ new WeakMap();
  cache.snapshot = /* @__PURE__ */ new WeakMap();
  cache.snapshotKey.clear();
  cache.preStyleMap.clear();
  cache.preStyle = /* @__PURE__ */ new WeakMap();
  cache.preNodeMap.clear();
}

// src/utils/cssTools.js
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
  "svg",
  "path",
  "circle",
  "rect",
  "line",
  "g",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th"
];
function precacheCommonTags() {
  for (let tag of commonTags) {
    getDefaultStyleForTag(tag);
  }
}
function getDefaultStyleForTag(tagName) {
  if (cache.defaultStyle.has(tagName)) {
    return cache.defaultStyle.get(tagName);
  }
  const skipTags = /* @__PURE__ */ new Set(["script", "style", "meta", "link", "noscript", "template"]);
  if (skipTags.has(tagName)) {
    const empty = {};
    cache.defaultStyle.set(tagName, empty);
    return empty;
  }
  let sandbox = document.getElementById("snapdom-sandbox");
  if (!sandbox) {
    sandbox = document.createElement("div");
    sandbox.id = "snapdom-sandbox";
    sandbox.style.position = "absolute";
    sandbox.style.left = "-9999px";
    sandbox.style.top = "-9999px";
    sandbox.style.width = "0";
    sandbox.style.height = "0";
    sandbox.style.overflow = "hidden";
    document.body.appendChild(sandbox);
  }
  const el = document.createElement(tagName);
  el.style.all = "initial";
  sandbox.appendChild(el);
  const styles = getComputedStyle(el);
  const defaults = {};
  for (let prop of styles) {
    defaults[prop] = styles.getPropertyValue(prop);
  }
  sandbox.removeChild(el);
  cache.defaultStyle.set(tagName, defaults);
  return defaults;
}
function getStyleKey(snapshot, tagName, compress = false) {
  const entries = [];
  const defaultStyles = getDefaultStyleForTag(tagName);
  for (let [prop, value] of Object.entries(snapshot)) {
    if (!compress) {
      if (value) {
        entries.push(`${prop}:${value}`);
      }
    } else {
      const defaultValue = defaultStyles[prop];
      if (value && value !== defaultValue) {
        entries.push(`${prop}:${value}`);
      }
    }
  }
  return entries.sort().join(";");
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
function generateCSSClasses() {
  const keySet = new Set(cache.preStyleMap.values());
  const classMap = /* @__PURE__ */ new Map();
  let counter = 1;
  for (const key of keySet) {
    classMap.set(key, `c${counter++}`);
  }
  return classMap;
}

// src/utils/helpers.js
async function inlineSingleBackgroundEntry(entry, options = {}) {
  const rawUrl = extractURL(entry);
  const isGradient = /^((repeating-)?(linear|radial|conic)-gradient)\(/i.test(entry);
  if (rawUrl) {
    const encodedUrl = safeEncodeURI(rawUrl);
    if (cache.background.has(encodedUrl)) {
      return options.skipInline ? void 0 : `url(${cache.background.get(encodedUrl)})`;
    } else {
      const dataUrl = await fetchImage(encodedUrl, { useProxy: options.useProxy });
      cache.background.set(encodedUrl, dataUrl);
      return options.skipInline ? void 0 : `url("${dataUrl}")`;
    }
  }
  if (isGradient || entry === "none") {
    return entry;
  }
  return entry;
}
function idle(fn, { fast = false } = {}) {
  if (fast) return fn();
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn, { timeout: 50 });
  } else {
    setTimeout(fn, 1);
  }
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
    } catch {
      return clean;
    }
  }
  return clean;
}
function extractURL(value) {
  const match = value.match(/url\((['"]?)(.*?)(\1)\)/);
  if (!match) return null;
  const url = match[2].trim();
  if (url.startsWith("#")) return null;
  return url;
}
function fetchImage(src, { timeout = 3e3, useProxy = "" } = {}) {
  function getCrossOriginMode(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin ? "use-credentials" : "anonymous";
    } catch {
      return "anonymous";
    }
  }
  async function fetchWithFallback(url) {
    const fetchBlobAsDataURL = (fetchUrl) => fetch(fetchUrl, {
      mode: "cors",
      credentials: getCrossOriginMode(fetchUrl) === "use-credentials" ? "include" : "omit"
    }).then((r) => r.blob()).then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        if (typeof base64 !== "string" || !base64.startsWith("data:image/")) {
          reject(new Error("Invalid image data URL"));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(blob);
    }));
    try {
      return await fetchBlobAsDataURL(url);
    } catch (e) {
      if (useProxy && typeof useProxy === "string") {
        const proxied = useProxy.replace(/\/$/, "") + "/" + safeEncodeURI(url);
        try {
          return await fetchBlobAsDataURL(proxied);
        } catch {
          throw new Error("[SnapDOM - fetchImage] CORS restrictions prevented image capture (even via proxy)");
        }
      } else {
        throw new Error("[SnapDOM - fetchImage] Fetch fallback failed and no proxy provided");
      }
    }
  }
  const crossOriginValue = getCrossOriginMode(src);
  if (cache.image.has(src)) {
    return Promise.resolve(cache.image.get(src));
  }
  const isDataURI = src.startsWith("data:image/");
  if (isDataURI) {
    cache.image.set(src, src);
    return Promise.resolve(src);
  }
  const cacheBustedSrc = src + (src.includes("?") ? "&" : "?") + `v=${Date.now()}`;
  const isSVG = /\.svg(\?.*)?$/i.test(src);
  if (isSVG) {
    return (async () => {
      try {
        const response = await fetch(cacheBustedSrc, {
          // [MODIFIED] Use cache-busted URL
          mode: "cors",
          credentials: crossOriginValue === "use-credentials" ? "include" : "omit"
        });
        const svgText = await response.text();
        const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
        cache.image.set(src, encoded);
        return encoded;
      } catch {
        return fetchWithFallback(cacheBustedSrc);
      }
    })();
  }
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("[SnapDOM - fetchImage] Image load timed out"));
    }, timeout);
    const image = new Image();
    image.crossOrigin = crossOriginValue;
    image.onload = async () => {
      clearTimeout(timeoutId);
      try {
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL("image/png");
        cache.image.set(src, dataURL);
        resolve(dataURL);
      } catch {
        try {
          const fallbackDataURL = await fetchWithFallback(cacheBustedSrc);
          cache.image.set(src, fallbackDataURL);
          resolve(fallbackDataURL);
        } catch (e) {
          reject(e);
        }
      }
    };
    image.onerror = async () => {
      clearTimeout(timeoutId);
      console.error(`[SnapDOM - fetchImage] Image failed to load: ${src}`);
      try {
        const fallbackDataURL = await fetchWithFallback(cacheBustedSrc);
        cache.image.set(src, fallbackDataURL);
        resolve(fallbackDataURL);
      } catch (e) {
        reject(e);
      }
    };
    image.src = cacheBustedSrc;
  });
}
function snapshotComputedStyle(style) {
  const snap = {};
  for (let prop of style) {
    snap[prop] = style.getPropertyValue(prop);
  }
  return snap;
}
function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
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
  } catch {
    return uri;
  }
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

// src/modules/styles.js
function snapshotComputedStyleFull(style) {
  const result = {};
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    let val = style.getPropertyValue(prop);
    if ((prop === "background-image" || prop === "content") && val.includes("url(") && !val.includes("data:")) {
      val = "none";
    }
    result[prop] = val;
  }
  return result;
}
function inlineAllStyles(source, clone, compress) {
  if (source.tagName === "STYLE") return;
  if (!cache.preStyle.has(source)) {
    cache.preStyle.set(source, getStyle(source));
  }
  const style = cache.preStyle.get(source);
  if (!cache.snapshot.has(source)) {
    const snapshot2 = snapshotComputedStyleFull(style);
    cache.snapshot.set(source, snapshot2);
  }
  const snapshot = cache.snapshot.get(source);
  const hash = Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b)).map(([prop, val]) => `${prop}:${val}`).join(";");
  if (cache.snapshotKey.has(hash)) {
    cache.preStyleMap.set(clone, cache.snapshotKey.get(hash));
    return;
  }
  const tagName = source.tagName?.toLowerCase() || "div";
  const key = getStyleKey(snapshot, tagName, compress);
  cache.snapshotKey.set(hash, key);
  cache.preStyleMap.set(clone, key);
}

// src/core/clone.js
function deepClone(node, compress, options = {}, originalRoot) {
  if (!node) throw new Error("Invalid node");
  const clonedAssignedNodes = /* @__PURE__ */ new Set();
  let pendingSelectValue = null;
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
        if (node.matches?.(selector)) {
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
      if (!options.filter(node, originalRoot || node)) {
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
    const fallback = document.createElement("div");
    fallback.style.cssText = `width:${node.offsetWidth}px;height:${node.offsetHeight}px;background-image:repeating-linear-gradient(45deg,#ddd,#ddd 5px,#f9f9f9 5px,#f9f9f9 10px);display:flex;align-items:center;justify-content:center;font-size:12px;color:#555;border:1px solid #aaa;`;
    return fallback;
  }
  if (node.getAttribute("data-capture") === "placeholder") {
    const clone2 = node.cloneNode(false);
    cache.preNodeMap.set(clone2, node);
    inlineAllStyles(node, clone2, compress);
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
    cache.preNodeMap.set(img, node);
    inlineAllStyles(node, img, compress);
    return img;
  }
  let clone;
  try {
    clone = node.cloneNode(false);
    cache.preNodeMap.set(clone, node);
  } catch (err) {
    console.error("[Snapdom] Failed to clone node:", node, err);
    throw err;
  }
  if (node instanceof HTMLTextAreaElement) {
    clone.textContent = node.value;
    clone.value = node.value;
    const rect = node.getBoundingClientRect();
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    return clone;
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
  inlineAllStyles(node, clone, compress);
  if (node.shadowRoot) {
    const hasSlot = Array.from(node.shadowRoot.querySelectorAll("slot")).length > 0;
    if (hasSlot) {
      for (const child of node.shadowRoot.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "STYLE") {
          const cssText = child.textContent || "";
          if (cssText.trim() && compress) {
            if (!cache.preStyle) cache.preStyle = /* @__PURE__ */ new WeakMap();
            cache.preStyle.set(child, cssText);
          }
        }
      }
    } else {
      const shadowFrag = document.createDocumentFragment();
      for (const child of node.shadowRoot.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE && child.tagName === "STYLE") {
          const cssText = child.textContent || "";
          if (cssText.trim() && compress) {
            if (!cache.preStyle) cache.preStyle = /* @__PURE__ */ new WeakMap();
            cache.preStyle.set(child, cssText);
          }
          continue;
        }
        const clonedChild = deepClone(child, compress, options, originalRoot || node);
        if (clonedChild) shadowFrag.appendChild(clonedChild);
      }
      clone.appendChild(shadowFrag);
    }
  }
  if (node.tagName === "SLOT") {
    const assigned = node.assignedNodes?.({ flatten: true }) || [];
    const nodesToClone = assigned.length > 0 ? assigned : Array.from(node.childNodes);
    const fragment = document.createDocumentFragment();
    for (const child of nodesToClone) {
      const clonedChild = deepClone(child, compress, options, originalRoot || node);
      if (clonedChild) fragment.appendChild(clonedChild);
    }
    return fragment;
  }
  for (const child of node.childNodes) {
    if (clonedAssignedNodes.has(child)) continue;
    const clonedChild = deepClone(child, compress, options, originalRoot || node);
    if (clonedChild) clone.appendChild(clonedChild);
  }
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
  return clone;
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
function isIconFont(input) {
  const text = typeof input === "string" ? input : "";
  const candidates = [...defaultIconFonts, ...userIconFonts];
  for (const rx of candidates) {
    if (rx instanceof RegExp && rx.test(text)) return true;
  }
  if (/icon/i.test(text) || /glyph/i.test(text) || /symbols/i.test(text) || /feather/i.test(text) || /fontawesome/i.test(text)) return true;
  return false;
}

// src/modules/fonts.js
async function iconToImage(unicodeChar, fontFamily, fontWeight, fontSize = 32, color = "#000") {
  fontFamily = fontFamily.replace(/^['"]+|['"]+$/g, "");
  const dpr = window.devicePixelRatio || 1;
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = fontWeight ? `${fontWeight} ${fontSize}px "${fontFamily}"` : `${fontSize}px "${fontFamily}"`;
  const metrics = tempCtx.measureText(unicodeChar);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const height = ascent + descent;
  const width = metrics.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.font = tempCtx.font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(unicodeChar, 0, ascent);
  return canvas.toDataURL();
}
function isStylesheetLoaded(href) {
  return Array.from(document.styleSheets).some((sheet) => sheet.href === href);
}
function injectLinkIfMissing(href) {
  return new Promise((resolve) => {
    if (isStylesheetLoaded(href)) return resolve(null);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-snapdom", "injected-import");
    link.onload = () => resolve(link);
    link.onerror = () => resolve(null);
    document.head.appendChild(link);
  });
}
async function embedCustomFonts({ preCached = false } = {}) {
  if (cache.resource.has("fonts-embed-css")) {
    if (preCached) {
      const style = document.createElement("style");
      style.setAttribute("data-snapdom", "embedFonts");
      style.textContent = cache.resource.get("fonts-embed-css");
      document.head.appendChild(style);
    }
    return cache.resource.get("fonts-embed-css");
  }
  const importRegex = /@import\s+url\(["']?([^"')]+)["']?\)/g;
  const styleImports = [];
  for (const styleTag of document.querySelectorAll("style")) {
    const cssText = styleTag.textContent || "";
    const matches = Array.from(cssText.matchAll(importRegex));
    for (const match of matches) {
      const importUrl = match[1];
      if (isIconFont(importUrl)) continue;
      if (!isStylesheetLoaded(importUrl)) {
        styleImports.push(importUrl);
      }
    }
  }
  await Promise.all(styleImports.map(injectLinkIfMissing));
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((link) => link.href);
  let finalCSS = "";
  for (const link of links) {
    try {
      const res = await fetch(link.href);
      const cssText = await res.text();
      if (isIconFont(link.href) || isIconFont(cssText)) continue;
      const urlRegex = /url\((["']?)([^"')]+)\1\)/g;
      const inlinedCSS = await Promise.all(
        Array.from(cssText.matchAll(urlRegex)).map(async (match) => {
          let rawUrl = extractURL(match[0]);
          if (!rawUrl) return null;
          let url = rawUrl;
          if (!url.startsWith("http") && !url.startsWith("data:")) {
            url = new URL(url, link.href).href;
          }
          if (isIconFont(url)) return null;
          if (cache.resource.has(url)) {
            cache.font.add(url);
            return { original: match[0], inlined: `url(${cache.resource.get(url)})` };
          }
          if (cache.font.has(url)) return null;
          try {
            const fontRes = await fetch(url);
            const blob = await fontRes.blob();
            const b64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            cache.resource.set(url, b64);
            cache.font.add(url);
            return { original: match[0], inlined: `url(${b64})` };
          } catch (e) {
            console.warn("[snapdom] Failed to fetch font resource:", url);
            return null;
          }
        })
      );
      let cssFinal = cssText;
      for (const r of inlinedCSS) {
        if (r) cssFinal = cssFinal.replace(r.original, r.inlined);
      }
      finalCSS += cssFinal + "\n";
    } catch (e) {
      console.warn("[snapdom] Failed to fetch CSS:", link.href);
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      if (!sheet.href || links.every((link) => link.href !== sheet.href)) {
        for (const rule of sheet.cssRules) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            const src = rule.style.getPropertyValue("src");
            const family = rule.style.getPropertyValue("font-family");
            if (!src || isIconFont(family)) continue;
            const urlRegex = /url\((["']?)([^"')]+)\1\)/g;
            const localRegex = /local\((["']?)[^)]+?\1\)/g;
            const hasURL = !!src.match(urlRegex);
            const hasLocal = !!src.match(localRegex);
            if (!hasURL && hasLocal) {
              finalCSS += `@font-face{font-family:${family};src:${src};font-style:${rule.style.getPropertyValue("font-style") || "normal"};font-weight:${rule.style.getPropertyValue("font-weight") || "normal"};}`;
              continue;
            }
            let inlinedSrc = src;
            const matches = Array.from(src.matchAll(urlRegex));
            for (const match of matches) {
              let rawUrl = match[2].trim();
              if (!rawUrl) continue;
              let url = rawUrl;
              if (!url.startsWith("http") && !url.startsWith("data:")) {
                url = new URL(url, sheet.href || location.href).href;
              }
              if (isIconFont(url)) continue;
              if (cache.resource.has(url)) {
                cache.font.add(url);
                inlinedSrc = inlinedSrc.replace(match[0], `url(${cache.resource.get(url)})`);
                continue;
              }
              if (cache.font.has(url)) continue;
              try {
                const res = await fetch(url);
                const blob = await res.blob();
                const b64 = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                cache.resource.set(url, b64);
                cache.font.add(url);
                inlinedSrc = inlinedSrc.replace(match[0], `url(${b64})`);
              } catch (e) {
                console.warn("[snapdom] Failed to fetch font URL:", url);
              }
            }
            finalCSS += `@font-face{font-family:${family};src:${inlinedSrc};font-style:${rule.style.getPropertyValue("font-style") || "normal"};font-weight:${rule.style.getPropertyValue("font-weight") || "normal"};}`;
          }
        }
      }
    } catch (e) {
      console.warn("[snapdom] Cannot access stylesheet", sheet.href, e);
    }
  }
  for (const font of document.fonts) {
    if (font.family && font.status === "loaded" && font._snapdomSrc) {
      if (isIconFont(font.family)) continue;
      let b64 = font._snapdomSrc;
      if (!b64.startsWith("data:")) {
        if (cache.resource.has(font._snapdomSrc)) {
          b64 = cache.resource.get(font._snapdomSrc);
          cache.font.add(font._snapdomSrc);
        } else if (!cache.font.has(font._snapdomSrc)) {
          try {
            const res = await fetch(font._snapdomSrc);
            const blob = await res.blob();
            b64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            cache.resource.set(font._snapdomSrc, b64);
            cache.font.add(font._snapdomSrc);
          } catch (e) {
            console.warn("[snapdom] Failed to fetch dynamic font src:", font._snapdomSrc);
            continue;
          }
        }
      }
      finalCSS += `@font-face{font-family:'${font.family}';src:url(${b64});font-style:${font.style || "normal"};font-weight:${font.weight || "normal"};}`;
    }
  }
  if (finalCSS) {
    cache.resource.set("fonts-embed-css", finalCSS);
    if (preCached) {
      const style = document.createElement("style");
      style.setAttribute("data-snapdom", "embedFonts");
      style.textContent = finalCSS;
      document.head.appendChild(style);
    }
  }
  return finalCSS;
}

// src/modules/pseudo.js
async function inlinePseudoElements(source, clone, compress, embedFonts = false, useProxy) {
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
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim().length > 0
        );
        if (!textNode) continue;
        const text = textNode.textContent;
        const match = text.match(/^([^\p{L}\p{N}\s]*[\p{L}\p{N}](?:['’])?)/u);
        const first = match?.[0];
        const rest = text.slice(first?.length || 0);
        if (!first || /[\uD800-\uDFFF]/.test(first)) continue;
        const span = document.createElement("span");
        span.textContent = first;
        span.dataset.snapdomPseudo = "::first-letter";
        const snapshot2 = snapshotComputedStyle(style);
        const key2 = getStyleKey(snapshot2, "span", compress);
        cache.preStyleMap.set(span, key2);
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
      const isIconFont2 = isIconFont(fontFamily);
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
      const snapshot = snapshotComputedStyle(style);
      const key = getStyleKey(snapshot, "span", compress);
      cache.preStyleMap.set(pseudoEl, key);
      if (isIconFont2 && cleanContent.length === 1) {
        const imgEl = document.createElement("img");
        imgEl.src = await iconToImage(cleanContent, fontFamily, fontWeight, fontSize, color);
        imgEl.style = `width:${fontSize}px;height:auto;object-fit:contain;`;
        pseudoEl.appendChild(imgEl);
      } else if (cleanContent.startsWith("url(")) {
        const rawUrl = extractURL(cleanContent);
        if (rawUrl?.trim()) {
          try {
            const imgEl = document.createElement("img");
            const dataUrl = await fetchImage(safeEncodeURI(rawUrl, { useProxy }));
            imgEl.src = dataUrl;
            imgEl.style = `width:${fontSize}px;height:auto;object-fit:contain;`;
            pseudoEl.appendChild(imgEl);
          } catch (e) {
            console.error(`[snapdom] Error in pseudo ${pseudo} for`, source, e);
          }
        }
      } else if (!isIconFont2 && hasExplicitContent) {
        pseudoEl.textContent = cleanContent;
      }
      if (hasBg) {
        try {
          const bgSplits = splitBackgroundImage(bg);
          const newBgParts = await Promise.all(bgSplits.map(inlineSingleBackgroundEntry));
          pseudoEl.style.backgroundImage = newBgParts.join(", ");
        } catch (e) {
          console.warn(`[snapdom] Failed to inline background-image for ${pseudo}`, e);
        }
      }
      if (hasBgColor) pseudoEl.style.backgroundColor = bgColor;
      const hasContent2 = pseudoEl.childNodes.length > 0 || pseudoEl.textContent?.trim() !== "";
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
    await inlinePseudoElements(sChildren[i], cChildren[i], compress, embedFonts, useProxy);
  }
}

// src/modules/svgDefs.js
function inlineExternalDef(root) {
  if (!root) return;
  const defsSources = document.querySelectorAll("svg > defs");
  if (!defsSources.length) return;
  root.querySelectorAll("svg").forEach((svg) => {
    const uses = svg.querySelectorAll("use");
    if (!uses.length) return;
    const usedIds = /* @__PURE__ */ new Set();
    uses.forEach((use) => {
      const href = use.getAttribute("xlink:href") || use.getAttribute("href");
      if (href && href.startsWith("#")) usedIds.add(href.slice(1));
    });
    if (!usedIds.size) return;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    for (const id of usedIds) {
      for (const source of defsSources) {
        const def = source.querySelector(`#${CSS.escape(id)}`);
        if (def) {
          defs.appendChild(def.cloneNode(true));
          break;
        }
      }
    }
    if (defs.childNodes.length) {
      svg.insertBefore(defs, svg.firstChild);
    }
  });
}

// src/core/prepare.js
async function prepareClone(element, compress = false, embedFonts = false, options = {}) {
  let clone;
  let classCSS = "";
  try {
    clone = deepClone(element, compress, options, element);
  } catch (e) {
    console.warn("deepClone failed:", e);
    throw e;
  }
  try {
    await inlinePseudoElements(element, clone, compress, embedFonts, options.useProxy);
  } catch (e) {
    console.warn("inlinePseudoElements failed:", e);
  }
  try {
    inlineExternalDef(clone);
  } catch (e) {
    console.warn("inlineExternalDef failed:", e);
  }
  if (compress) {
    const keyToClass = generateCSSClasses();
    classCSS = Array.from(keyToClass.entries()).map(([key, className]) => `.${className}{${key}}`).join("");
    for (const [node, key] of cache.preStyleMap.entries()) {
      if (node.tagName === "STYLE") continue;
      const className = keyToClass.get(key);
      if (className) node.classList.add(className);
      const bgImage = node.style?.backgroundImage;
      node.removeAttribute("style");
      if (bgImage && bgImage !== "none") node.style.backgroundImage = bgImage;
    }
  } else {
    for (const [node, key] of cache.preStyleMap.entries()) {
      if (node.tagName === "STYLE") continue;
      node.setAttribute("style", key.replace(/;/g, "; "));
    }
  }
  for (const [cloneNode, originalNode] of cache.preNodeMap.entries()) {
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
  if (element === cache.preNodeMap.get(clone)) {
    const computed = cache.preStyle.get(element) || window.getComputedStyle(element);
    cache.preStyle.set(element, computed);
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
  for (const [cloneNode, originalNode] of cache.preNodeMap.entries()) {
    if (originalNode.tagName === "PRE") {
      cloneNode.style.marginTop = "0";
      cloneNode.style.marginBlockStart = "0";
    }
  }
  return { clone, classCSS };
}

// src/modules/images.js
async function inlineImages(clone, options = {}) {
  const imgs = Array.from(clone.querySelectorAll("img"));
  const processImg = async (img) => {
    const src = img.src;
    try {
      const dataUrl = await fetchImage(src, { useProxy: options.useProxy });
      img.src = dataUrl;
      if (!img.width) img.width = img.naturalWidth || 100;
      if (!img.height) img.height = img.naturalHeight || 100;
    } catch {
      const fallback = document.createElement("div");
      fallback.style = `width: ${img.width || 100}px; height: ${img.height || 100}px; background: #ccc; display: inline-block; text-align: center; line-height: ${img.height || 100}px; color: #666; font-size: 12px;`;
      fallback.innerText = "img";
      img.replaceWith(fallback);
    }
  };
  for (let i = 0; i < imgs.length; i += 4) {
    const group = imgs.slice(i, i + 4).map(processImg);
    await Promise.allSettled(group);
  }
}

// src/modules/background.js
async function inlineBackgroundImages(source, clone, options = {}) {
  const queue = [[source, clone]];
  const imageProps = [
    "background-image",
    "mask",
    "mask-image",
    "-webkit-mask-image",
    "mask-source",
    "mask-box-image-source",
    "mask-border-source",
    "-webkit-mask-box-image-source",
    "border-image",
    "border-image-source",
    "border-image-slice",
    "border-image-width",
    "border-image-outset",
    "border-image-repeat"
  ];
  while (queue.length) {
    const [srcNode, cloneNode] = queue.shift();
    const style = cache.preStyle.get(srcNode) || getStyle(srcNode);
    if (!cache.preStyle.has(srcNode)) cache.preStyle.set(srcNode, style);
    for (const prop of imageProps) {
      const val = style.getPropertyValue(prop);
      if (!val || val === "none") continue;
      const splits = splitBackgroundImage(val);
      const inlined = await Promise.all(
        splits.map((entry) => inlineSingleBackgroundEntry(entry, options))
      );
      if (inlined.some((p) => p && p !== "none" && !/^url\(undefined/.test(p))) {
        cloneNode.style.setProperty(prop, inlined.join(", "));
      }
    }
    const bgColor = style.getPropertyValue("background-color");
    if (bgColor && bgColor !== "transparent" && bgColor !== "rgba(0, 0, 0, 0)") {
      cloneNode.style.backgroundColor = bgColor;
    }
    const sChildren = Array.from(srcNode.children);
    const cChildren = Array.from(cloneNode.children);
    for (let i = 0; i < Math.min(sChildren.length, cChildren.length); i++) {
      queue.push([sChildren[i], cChildren[i]]);
    }
  }
}

// src/core/capture.js
async function captureDOM(element, options = {}) {
  if (!element) throw new Error("Element cannot be null or undefined");
  cache.reset();
  const { compress = true, embedFonts = false, fast = true, scale = 1, useProxy = "" } = options;
  let clone, classCSS;
  let fontsCSS = "";
  let baseCSS = "";
  let dataURL;
  let svgString;
  ({ clone, classCSS } = await prepareClone(element, compress, embedFonts, options));
  await new Promise((resolve) => {
    idle(async () => {
      await inlineImages(clone, options);
      resolve();
    }, { fast });
  });
  await new Promise((resolve) => {
    idle(async () => {
      await inlineBackgroundImages(element, clone, options);
      resolve();
    }, { fast });
  });
  if (embedFonts) {
    await new Promise((resolve) => {
      idle(async () => {
        fontsCSS = await embedCustomFonts();
        resolve();
      }, { fast });
    });
  }
  if (compress) {
    const usedTags = collectUsedTagNames(clone).sort();
    const tagKey = usedTags.join(",");
    if (cache.baseStyle.has(tagKey)) {
      baseCSS = cache.baseStyle.get(tagKey);
    } else {
      await new Promise((resolve) => {
        idle(() => {
          baseCSS = generateDedupedBaseCSS(usedTags);
          cache.baseStyle.set(tagKey, baseCSS);
          resolve();
        }, { fast });
      });
    }
  }
  await new Promise((resolve) => {
    idle(() => {
      const rect = element.getBoundingClientRect();
      let w = rect.width;
      let h = rect.height;
      const hasW = Number.isFinite(options.width);
      const hasH = Number.isFinite(options.height);
      const hasScale = typeof scale === "number" && scale !== 1;
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
      w = Math.ceil(w);
      h = Math.ceil(h);
      clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      clone.style.transformOrigin = "top left";
      if (!hasScale && (hasW || hasH)) {
        const originalW = rect.width;
        const originalH = rect.height;
        const scaleX = w / originalW;
        const scaleY = h / originalH;
        const existingTransform = clone.style.transform || "";
        const scaleTransform = `scale(${scaleX}, ${scaleY})`;
        clone.style.transform = `${scaleTransform} ${existingTransform}`.trim();
      }
      const svgNS = "http://www.w3.org/2000/svg";
      const fo = document.createElementNS(svgNS, "foreignObject");
      fo.setAttribute("width", "100%");
      fo.setAttribute("height", "100%");
      const styleTag = document.createElement("style");
      styleTag.textContent = baseCSS + fontsCSS + "svg{overflow:visible;}" + classCSS;
      fo.appendChild(styleTag);
      fo.appendChild(clone);
      const serializer = new XMLSerializer();
      const foString = serializer.serializeToString(fo);
      const svgHeader = `<svg xmlns="${svgNS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
      const svgFooter = "</svg>";
      svgString = svgHeader + foString + svgFooter;
      dataURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      resolve();
    }, { fast });
  });
  const sandbox = document.getElementById("snapdom-sandbox");
  if (sandbox && sandbox.style.position === "absolute") sandbox.remove();
  return dataURL;
}

// src/api/snapdom.js
async function toImg(url, { scale = 1 } = {}) {
  const img = new Image();
  img.src = url;
  await img.decode();
  if (scale !== 1) {
    img.style.width = `${img.naturalWidth * scale}px`;
    img.style.height = `${img.naturalHeight * scale}px`;
  }
  return img;
}
async function toCanvas(url, { dpr = 1, scale = 1 } = {}) {
  const img = new Image();
  img.src = url;
  img.crossOrigin = "anonymous";
  img.loading = "eager";
  img.decoding = "sync";
  const isSafariBrowser = isSafari();
  let appended = false;
  if (isSafariBrowser) {
    document.body.appendChild(img);
    appended = true;
  }
  await img.decode();
  if (isSafariBrowser) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (img.width === 0 || img.height === 0) {
    if (appended) img.remove();
    throw new Error("Image failed to load or has no dimensions");
  }
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.drawImage(img, 0, 0, width, height);
  if (appended) img.remove();
  return canvas;
}
async function toBlob(url, {
  type = "svg",
  scale = 1,
  backgroundColor = "#fff",
  quality
} = {}) {
  const mime = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  }[type] || "image/png";
  if (type === "svg") {
    const svgText = decodeURIComponent(url.split(",")[1]);
    return new Blob([svgText], { type: "image/svg+xml" });
  }
  const canvas = await createBackground(url, { dpr: 1, scale }, backgroundColor);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), `${mime}`, quality);
  });
}
async function createBackground(url, { dpr = 1, scale = 1 }, backgroundColor) {
  const baseCanvas = await toCanvas(url, { dpr, scale });
  if (!backgroundColor) return baseCanvas;
  const temp = document.createElement("canvas");
  temp.width = baseCanvas.width;
  temp.height = baseCanvas.height;
  const ctx = temp.getContext("2d");
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, temp.width, temp.height);
  ctx.drawImage(baseCanvas, 0, 0);
  return temp;
}
async function toRasterImg(url, { dpr = 1, scale = 1, backgroundColor, quality }, format = "png") {
  const defaultBg = ["jpg", "jpeg", "webp"].includes(format) ? "#fff" : void 0;
  const finalBg = backgroundColor ?? defaultBg;
  const canvas = await createBackground(url, { dpr, scale }, finalBg);
  const img = new Image();
  img.src = canvas.toDataURL(`image/${format}`, quality);
  await img.decode();
  img.style.width = `${canvas.width / dpr}px`;
  img.style.height = `${canvas.height / dpr}px`;
  return img;
}
async function download(url, { dpr = 1, scale = 1, backgroundColor, format = "png", filename = "snapDOM" } = {}) {
  if (format === "svg") {
    const blob = await toBlob(url);
    const objectURL = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = objectURL;
    a2.download = `${filename}.svg`;
    a2.click();
    URL.revokeObjectURL(objectURL);
    return;
  }
  const defaultBg = ["jpg", "jpeg", "webp"].includes(format) ? "#fff" : void 0;
  const finalBg = backgroundColor ?? defaultBg;
  const canvas = await createBackground(url, { dpr, scale }, finalBg);
  const mime = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  }[format] || "image/png";
  const dataURL = canvas.toDataURL(mime);
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = `${filename}.${format}`;
  a.click();
}
async function snapdom(element, options = {}) {
  options = { scale: 1, ...options };
  if (!element) throw new Error("Element cannot be null or undefined");
  if (options.iconFonts) {
    extendIconFonts(options.iconFonts);
  }
  return await snapdom.capture(element, options);
}
snapdom.capture = async (el, options = {}) => {
  const url = await captureDOM(el, options);
  const dpr = options.dpr ?? (window.devicePixelRatio || 1);
  const scale = options.scale || 1;
  return {
    url,
    options,
    toRaw: () => url,
    toImg: (opts = {}) => toImg(url, { dpr, scale, ...opts }),
    toCanvas: (opts = {}) => toCanvas(url, { dpr, scale, ...opts }),
    toBlob: (opts = {}) => toBlob(url, { dpr, scale, ...opts }),
    toPng: (opts = {}) => toRasterImg(url, { dpr, scale, ...opts }, "png"),
    toJpg: (opts = {}) => toRasterImg(url, { dpr, scale, ...opts }, "jpeg"),
    toWebp: (opts = {}) => toRasterImg(url, { dpr, scale, ...opts }, "webp"),
    download: ({ format = "png", filename = "snapDOM", backgroundColor, ...opts } = {}) => download(url, { dpr, scale, format, filename, backgroundColor, ...opts })
  };
};
snapdom.toRaw = async (el, options) => (await snapdom.capture(el, options)).toRaw();
snapdom.toImg = async (el, options) => (await snapdom.capture(el, options)).toImg();
snapdom.toCanvas = async (el, options) => (await snapdom.capture(el, options)).toCanvas();
snapdom.toBlob = async (el, options) => (await snapdom.capture(el, options)).toBlob(options);
snapdom.toPng = async (el, options) => (await snapdom.capture(el, options)).toPng(options);
snapdom.toJpg = async (el, options) => (await snapdom.capture(el, options)).toJpg(options);
snapdom.toWebp = async (el, options) => (await snapdom.capture(el, options)).toWebp(options);
snapdom.download = async (el, options = {}) => {
  const {
    format = "png",
    filename = "capture",
    backgroundColor,
    ...rest
  } = options;
  const capture = await snapdom.capture(el, rest);
  return await capture.download({ format, filename, backgroundColor });
};

// src/api/preCache.js
async function preCache(root = document, options = {}) {
  const { embedFonts = true, reset = false } = options;
  if (reset) {
    cache.reset();
    return;
  }
  await document.fonts.ready;
  precacheCommonTags();
  let imgEls = [], allEls = [];
  if (root?.querySelectorAll) {
    imgEls = Array.from(root.querySelectorAll("img[src]"));
    allEls = Array.from(root.querySelectorAll("*"));
  }
  const promises = [];
  for (const img of imgEls) {
    const src = img.src;
    if (!cache.image.has(src)) {
      promises.push(
        fetchImage(src, { useProxy: options.useProxy }).then((dataURL) => cache.image.set(src, dataURL)).catch(() => {
        })
      );
    }
  }
  for (const el of allEls) {
    const bg = getStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      const bgSplits = splitBackgroundImage(bg);
      for (const entry of bgSplits) {
        const isUrl = entry.startsWith("url(");
        if (isUrl) {
          promises.push(
            inlineSingleBackgroundEntry(entry, options).catch(() => {
            })
          );
        }
      }
    }
  }
  if (embedFonts) {
    await embedCustomFonts({ preCached: true });
  }
  await Promise.all(promises);
}
export {
  preCache,
  snapdom
};
