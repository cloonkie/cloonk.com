// TypeScript source. Builds to dist/upc-concat/upc-concat.js.
// DOM, profile, formula, and workbook contracts are typed incrementally below.
"use strict";
/* ============================================================
   UPC Concat — generic schema-mapping & concatenation engine
   ============================================================ */
const App: any = {};

/* ── State ───────────────────────────────────────────────── */
App.State = {
  profile: null,            // active (editable) profile
  savedSnapshot: "",        // JSON of last-saved profile (dirty detection)
  savedName: "",            // name of profile the snapshot belongs to
  files: {},                // fileId -> parsed file object
  clusters: [],             // [{id, rows:{fileId:[idx]}, values:Set}]
  aliasMap: new Map(),      // normVariant -> clusterId
  identityValueSets: {},    // fieldName -> Set(normVariant)
  resolveOrder: [],         // topo-ordered derived field objects
  results: [],
  warnings: [],
  columnOrder: null         // result-table column order (null = natural)
};

/* ── Utilities ───────────────────────────────────────────── */
const U = {
  esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },
  isBlank(v) { return v == null || (typeof v === "string" && v.trim() === ""); },
  toStr(v) {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return String(v);
  },
  toNum(v) {
    if (typeof v === "number") return v;
    if (U.isBlank(v)) return NaN;
    const n = Number(String(v).replace(/,/g, "").trim());
    return n;
  },
  normStr(v) { return U.toStr(v).trim(); },
  idxToLetter(i) {
    let s = "", n = i + 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  },
  letterToIdx(L) {
    let n = 0;
    for (const ch of L.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  },
  uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 9); },
  today() { return new Date().toISOString().slice(0, 10); },
  /* identity-value variant set — handles leading-zero UPCs */
  variants(v) {
    const base = U.normStr(v);
    const out = new Set();
    if (!base) return out;
    out.add(base);
    if (/^\d+$/.test(base)) {
      const stripped = base.replace(/^0+/, "") || "0";
      out.add(stripped);
      for (const L of [11, 12, 13, 14]) {
        if (stripped.length <= L) out.add(stripped.padStart(L, "0"));
      }
    }
    return out;
  }
};

/* ============================================================
   FormulaEngine — tokenize / parse / evaluate / topo-sort
   ============================================================ */
App.FormulaEngine = (function () {
  /* tokenizer */
  function tokenize(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
      if (c === "{") {
        const end = src.indexOf("}", i);
        if (end < 0) throw new Error("Unclosed { in formula");
        toks.push({ t: "field", v: src.slice(i + 1, end).trim() });
        i = end + 1; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, str = "";
        while (j < n && src[j] !== c) { str += src[j]; j++; }
        if (j >= n) throw new Error("Unclosed string literal");
        toks.push({ t: "str", v: str });
        i = j + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
        let j = i, num = "";
        while (j < n && /[0-9.]/.test(src[j])) { num += src[j]; j++; }
        toks.push({ t: "num", v: parseFloat(num) });
        i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i, id = "";
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) { id += src[j]; j++; }
        toks.push({ t: "ident", v: id });
        i = j; continue;
      }
      const two = src.slice(i, i + 2);
      if (two === "<>" || two === "<=" || two === ">=") { toks.push({ t: "op", v: two }); i += 2; continue; }
      if ("&+-*/=<>(),".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
      throw new Error("Unexpected character: " + c);
    }
    return toks;
  }

  /* recursive-descent parser → AST */
  function parse(toks) {
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const expect = (v) => {
      const t = toks[p];
      if (!t || t.v !== v) throw new Error("Expected '" + v + "'");
      p++;
    };
    function parseExpr() { return parseCompare(); }
    function parseCompare() {
      let left = parseConcat();
      while (peek() && peek().t === "op" && ["=", "<>", "<", "<=", ">", ">="].includes(peek().v)) {
        const op = next().v;
        left = { k: "binop", op, l: left, r: parseConcat() };
      }
      return left;
    }
    function parseConcat() {
      let left = parseAdd();
      while (peek() && peek().t === "op" && peek().v === "&") {
        next();
        left = { k: "binop", op: "&", l: left, r: parseAdd() };
      }
      return left;
    }
    function parseAdd() {
      let left = parseMul();
      while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
        const op = next().v;
        left = { k: "binop", op, l: left, r: parseMul() };
      }
      return left;
    }
    function parseMul() {
      let left = parseUnary();
      while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
        const op = next().v;
        left = { k: "binop", op, l: left, r: parseUnary() };
      }
      return left;
    }
    function parseUnary() {
      if (peek() && peek().t === "op" && peek().v === "-") {
        next();
        return { k: "neg", e: parseUnary() };
      }
      return parsePrimary();
    }
    function parsePrimary() {
      const t = next();
      if (!t) throw new Error("Unexpected end of formula");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "str") return { k: "str", v: t.v };
      if (t.t === "field") return { k: "field", v: t.v };
      if (t.t === "ident") {
        const up = t.v.toUpperCase();
        if (up === "TRUE") return { k: "bool", v: true };
        if (up === "FALSE") return { k: "bool", v: false };
        if (up === "BLANK") return { k: "blank" };
        /* function call */
        if (peek() && peek().t === "op" && peek().v === "(") {
          next();
          const args = [];
          if (!(peek() && peek().t === "op" && peek().v === ")")) {
            args.push(parseExpr());
            while (peek() && peek().t === "op" && peek().v === ",") { next(); args.push(parseExpr()); }
          }
          expect(")");
          return { k: "call", fn: up, args };
        }
        throw new Error("Unknown identifier '" + t.v + "' (functions need parentheses)");
      }
      if (t.t === "op" && t.v === "(") {
        const e = parseExpr();
        expect(")");
        return e;
      }
      throw new Error("Unexpected token '" + t.v + "'");
    }
    const ast = parseExpr();
    if (p < toks.length) throw new Error("Unexpected trailing token '" + toks[p].v + "'");
    return ast;
  }

  function compile(src) {
    try {
      return { ast: parse(tokenize(src || "")), err: null };
    } catch (e) {
      return { ast: null, err: e.message };
    }
  }

  /* field references in a formula (for topo sort) */
  function fieldRefs(src) {
    const refs = new Set();
    try {
      tokenize(src || "").forEach(t => { if (t.t === "field") refs.add(t.v); });
    } catch (e) { /* ignore */ }
    return [...refs];
  }

  /* function library */
  const FN = {
    CONCAT: a => a.filter(v => !U.isBlank(v)).map(U.toStr).join(""),
    JOIN: a => a.slice(1).filter(v => !U.isBlank(v)).map(U.toStr).join(U.toStr(a[0])),
    IF: a => truthy(a[0]) ? a[1] : a[2],
    IFBLANK: a => U.isBlank(a[0]) ? a[1] : a[0],
    COALESCE: a => { for (const v of a) if (!U.isBlank(v)) return v; return null; },
    UPPER: a => U.toStr(a[0]).toUpperCase(),
    LOWER: a => U.toStr(a[0]).toLowerCase(),
    TRIM: a => U.toStr(a[0]).trim(),
    LEFT: a => { const n = U.toNum(a[1]); return isNaN(n) ? null : U.toStr(a[0]).slice(0, Math.max(0, n)); },
    RIGHT: a => { const n = U.toNum(a[1]); return isNaN(n) ? null : (n <= 0 ? "" : U.toStr(a[0]).slice(-n)); },
    MID: a => {
      const s = U.toNum(a[1]), l = U.toNum(a[2]);
      if (isNaN(s) || isNaN(l)) return null;
      return U.toStr(a[0]).slice(s - 1, s - 1 + l);
    },
    LEN: a => U.toStr(a[0]).length,
    PAD: a => {
      const len = U.toNum(a[1]);
      const ch = a[2] != null && U.toStr(a[2]) !== "" ? U.toStr(a[2]) : "0";
      if (isNaN(len)) return null;
      return U.toStr(a[0]).padStart(len, ch);
    },
    REPLACE: a => U.toStr(a[0]).split(U.toStr(a[1])).join(U.toStr(a[2])),
    SUBSTR: a => U.toStr(a[0]).split(U.toStr(a[1])).join(U.toStr(a[2])),
    CONTAINS: a => U.toStr(a[0]).includes(U.toStr(a[1])),
    STARTSWITH: a => U.toStr(a[0]).startsWith(U.toStr(a[1])),
    ENDSWITH: a => U.toStr(a[0]).endsWith(U.toStr(a[1])),
    NUMBER: a => { const n = U.toNum(a[0]); return isNaN(n) ? null : n; },
    TEXT: a => U.toStr(a[0])
  };

  function truthy(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    if (typeof v === "number") return v !== 0;
    const s = U.toStr(v).trim().toLowerCase();
    return s !== "" && s !== "false" && s !== "0";
  }

  function evaluate(ast, ctx, warnings) {
    if (!ast) return null;
    switch (ast.k) {
      case "num": return ast.v;
      case "str": return ast.v;
      case "bool": return ast.v;
      case "blank": return null;
      case "field": {
        if (!(ast.v in ctx)) {
          if (warnings) warnings.push("formula references undefined field {" + ast.v + "}");
          return null;
        }
        return ctx[ast.v];
      }
      case "neg": {
        const n = U.toNum(evaluate(ast.e, ctx, warnings));
        return isNaN(n) ? null : -n;
      }
      case "call": {
        const fn = FN[ast.fn];
        if (!fn) { if (warnings) warnings.push("unknown function " + ast.fn); return null; }
        const args = ast.args.map(a => evaluate(a, ctx, warnings));
        return fn(args);
      }
      case "binop": {
        const l = evaluate(ast.l, ctx, warnings);
        const r = evaluate(ast.r, ctx, warnings);
        if (ast.op === "&") return U.toStr(l) + U.toStr(r);
        if (["+", "-", "*", "/"].includes(ast.op)) {
          const ln = U.toNum(l), rn = U.toNum(r);
          if (isNaN(ln) || isNaN(rn)) return null;
          if (ast.op === "+") return ln + rn;
          if (ast.op === "-") return ln - rn;
          if (ast.op === "*") return ln * rn;
          if (ast.op === "/") return rn === 0 ? null : ln / rn;
        }
        /* comparison */
        const ln = U.toNum(l), rn = U.toNum(r);
        const bothNum = !isNaN(ln) && !isNaN(rn) && !U.isBlank(l) && !U.isBlank(r);
        const a = bothNum ? ln : U.toStr(l);
        const b = bothNum ? rn : U.toStr(r);
        switch (ast.op) {
          case "=": return a === b;
          case "<>": return a !== b;
          case "<": return a < b;
          case "<=": return a <= b;
          case ">": return a > b;
          case ">=": return a >= b;
        }
        return null;
      }
    }
    return null;
  }

  /* topo sort over derived fields; returns {order, cycles} */
  function topoSort(schema) {
    const derived = schema.filter(f => f.type === "derived");
    const derivedNames = new Set(derived.map(f => f.name));
    const deps = {};
    derived.forEach(f => {
      deps[f.name] = fieldRefs(f.formula).filter(r => derivedNames.has(r));
    });
    const order = [];
    const cycles = [];
    const state = {}; /* 0=unvisited 1=visiting 2=done */
    function visit(name, path) {
      if (state[name] === 2) return;
      if (state[name] === 1) {
        cycles.push(path.slice(path.indexOf(name)).concat(name));
        return;
      }
      state[name] = 1;
      (deps[name] || []).forEach(d => visit(d, path.concat(name)));
      state[name] = 2;
      order.push(name);
    }
    derived.forEach(f => visit(f.name, []));
    const byName = {};
    derived.forEach(f => byName[f.name] = f);
    return { order: order.map(n => byName[n]).filter(Boolean), cycles };
  }

  return { tokenize, parse, compile, evaluate, fieldRefs, topoSort, FN };
})();

/* ============================================================
   FileRegistry — parse spreadsheets, build indices
   ============================================================ */
App.FileRegistry = (function () {

  function parseWorkbook(arrayBuffer, filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".csv")) {
      const text = new TextDecoder().decode(arrayBuffer);
      const wb = XLSX.read(text, { type: "string" });
      return wb;
    }
    return XLSX.read(arrayBuffer, { type: "array", cellDates: false, raw: false });
  }

  /* build a parsed-file object from a workbook + sheet + headerRow */
  function buildFile(fileId, filename, wb, sheetName, headerRow) {
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error("Sheet '" + sheetName + "' not found");
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    const hIdx = Math.max(0, headerRow - 1);
    const headerRowArr = aoa[hIdx] || [];
    const dataRows = aoa.slice(hIdx + 1);
    const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
    const headers = [];
    const colByName = {};
    const colByLetter = {};
    for (let i = 0; i < width; i++) {
      const name = U.normStr(headerRowArr[i]);
      const letter = U.idxToLetter(i);
      headers.push({ name, letter, idx: i });
      if (name && !(name in colByName)) colByName[name] = i;
      colByLetter[letter] = i;
    }
    /* normalize row width */
    const rows = dataRows.map(r => {
      const out = new Array(width);
      for (let i = 0; i < width; i++) out[i] = r[i] == null ? "" : r[i];
      return out;
    });
    return {
      id: fileId, filename, sheetNames: wb.SheetNames,
      sheet: sheetName, headerRow,
      headers, colByName, colByLetter, rows,
      indices: {}, wb
    };
  }

  /* resolve a column reference (header name OR letter) to index, or null */
  function resolveColumn(file, ref) {
    if (!file || ref == null) return null;
    const r = U.normStr(ref);
    if (r in file.colByName) return file.colByName[r];
    if (/^[A-Za-z]+$/.test(r)) {
      const idx = U.letterToIdx(r);
      if (idx >= 0 && idx < file.headers.length) return idx;
    }
    return null;
  }

  /* build hash indices on a set of column indices */
  function buildIndices(file, colIndices) {
    file.indices = {};
    colIndices.forEach(ci => {
      if (ci == null) return;
      const map = new Map();
      for (let r = 0; r < file.rows.length; r++) {
        const val = file.rows[r][ci];
        if (U.isBlank(val)) continue;
        U.variants(val).forEach(k => {
          if (!map.has(k)) map.set(k, []);
          map.get(k).push(r);
        });
      }
      file.indices[ci] = map;
    });
  }

  async function sha256(buf) {
    try {
      const hash = await crypto.subtle.digest("SHA-256", buf);
      return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return null; }
  }

  return { parseWorkbook, buildFile, resolveColumn, buildIndices, sha256 };
})();

/* ============================================================
   IndexedDB cache — parsed AOA keyed by file hash
   ============================================================ */
App.Cache = (function () {
  const DB = "upc_concat_cache", STORE = "files";
  function open(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((res, rej) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function get(hash) {
    try {
      const db = await open();
      return await new Promise((res) => {
        const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(hash);
        tx.onsuccess = () => res(tx.result || null);
        tx.onerror = () => res(null);
      });
    } catch (e) { return null; }
  }
  async function set(hash, value) {
    try {
      const db = await open();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, hash);
    } catch (e) { /* non-fatal */ }
  }
  return { get, set };
})();

/* ============================================================
   ClusterEngine — cross-file identity clustering
   ============================================================ */
App.ClusterEngine = {
  /* resolve identity values for one row of one file (single-file context) */
  localIdentityValues(fileId, rowIdx) {
    const file = App.State.files[fileId];
    if (!file) return [];
    const schema = App.State.profile.canonical_schema;
    const ctx = {};
    /* direct fields with a source in this file */
    schema.filter(f => f.type === "direct").forEach(f => {
      const src = (f.sources || []).find(s => s.file_id === fileId);
      if (src) {
        const ci = App.FileRegistry.resolveColumn(file, src.column);
        if (ci != null) ctx[f.name] = file.rows[rowIdx][ci];
      }
      if (!(f.name in ctx)) ctx[f.name] = null;
    });
    /* derived in topo order */
    App.State.resolveOrder.forEach(f => {
      if (f._ast) ctx[f.name] = App.FormulaEngine.evaluate(f._ast, ctx, null);
      else ctx[f.name] = null;
    });
    const out = [];
    schema.filter(f => f.is_identity).forEach(f => {
      const v = ctx[f.name];
      if (!U.isBlank(v)) out.push({ field: f.name, value: U.normStr(v) });
    });
    return out;
  },

  async build(progressCb) {
    const S = App.State;
    S.clusters = [];
    S.aliasMap = new Map();
    S.identityValueSets = {};
    S.profile.canonical_schema.filter(f => f.is_identity)
      .forEach(f => S.identityValueSets[f.name] = new Set());

    /* compile derived formulas + topo order first */
    App.Schema.recompile();

    const fileIds = Object.keys(S.files);
    let totalRows = 0;
    fileIds.forEach(id => totalRows += S.files[id].rows.length);
    let done = 0;

    for (const fileId of fileIds) {
      const file = S.files[fileId];
      const n = file.rows.length;
      for (let start = 0; start < n; start += 4000) {
        const end = Math.min(n, start + 4000);
        for (let r = start; r < end; r++) {
          this.addRow(fileId, r);
        }
        done += (end - start);
        if (progressCb) progressCb(done / Math.max(1, totalRows), "Clustering " + done.toLocaleString() + " / " + totalRows.toLocaleString());
        await new Promise(res => setTimeout(res, 0));
      }
    }
    this.detectCollisions();
  },

  addRow(fileId, rowIdx) {
    const S = App.State;
    const ivals = this.localIdentityValues(fileId, rowIdx);
    if (!ivals.length) return;
    /* register into identityValueSets */
    ivals.forEach(iv => {
      U.variants(iv.value).forEach(v => S.identityValueSets[iv.field] &&
        S.identityValueSets[iv.field].add(v));
    });
    /* collect all variant keys for this row */
    const allVariants = new Set<string>();
    ivals.forEach(iv => U.variants(iv.value).forEach(v => allVariants.add(String(v))));
    /* find existing clusters */
    const hitIds = new Set<number>();
    allVariants.forEach(v => { if (S.aliasMap.has(v)) hitIds.add(S.aliasMap.get(v)); });
    let cluster;
    if (hitIds.size === 0) {
      cluster = { id: S.clusters.length, rows: {}, values: new Set() };
      S.clusters.push(cluster);
    } else {
      const ids = [...hitIds];
      cluster = S.clusters[ids[0]];
      /* merge any other clusters into cluster */
      for (let k = 1; k < ids.length; k++) {
        const other = S.clusters[ids[k]];
        if (!other || other === cluster) continue;
        Object.keys(other.rows).forEach(fid => {
          cluster.rows[fid] = (cluster.rows[fid] || []).concat(other.rows[fid]);
        });
        other.values.forEach(v => { cluster.values.add(v); S.aliasMap.set(v, cluster.id); });
        other.rows = {}; other.values = new Set(); other.merged = true;
      }
    }
    cluster.rows[fileId] = cluster.rows[fileId] || [];
    cluster.rows[fileId].push(rowIdx);
    allVariants.forEach(v => { cluster.values.add(v); S.aliasMap.set(v, cluster.id); });
  },

  detectCollisions() {
    const S = App.State;
    const idFields = S.profile.canonical_schema.filter(f => f.is_identity);
    if (idFields.length < 2) return;
    /* for each identity field, map value -> set of cluster ids */
    idFields.forEach(f => {
      const valToClusters = new Map();
      S.clusters.forEach(c => {
        if (c.merged) return;
        const fileIds = Object.keys(c.rows);
        fileIds.forEach(fid => {
          c.rows[fid].forEach(ri => {
            const ivals = this.localIdentityValues(fid, ri);
            const iv = ivals.find(x => x.field === f.name);
            if (!iv) return;
            U.variants(iv.value).forEach(v => {
              if (!valToClusters.has(v)) valToClusters.set(v, new Set());
              valToClusters.get(v).add(c.id);
            });
          });
        });
      });
      let collisions = 0;
      valToClusters.forEach(set => { if (set.size > 1) collisions++; });
      if (collisions > 0) {
        S.warnings.push({
          type: "warn",
          msg: "Identity field '" + f.name + "' had " + collisions +
            " value(s) spanning multiple clusters — clusters may be incorrectly split or merged. " +
            "Consider its mapping or remove it from the identity set."
        });
      }
    });
  },

  /* find cluster + detected identity for an input key */
  lookup(rawKey) {
    const S = App.State;
    const vs = [...U.variants(rawKey)];
    let clusterId = null;
    for (const v of vs) {
      if (S.aliasMap.has(v)) { clusterId = S.aliasMap.get(v); break; }
    }
    /* detect which identity field type this key belongs to */
    let detected = null;
    const idFields = S.profile.canonical_schema.filter(f => f.is_identity);
    for (const f of idFields) {
      const set = S.identityValueSets[f.name];
      if (set && vs.some(v => set.has(v))) { detected = f.name; break; }
    }
    return {
      cluster: clusterId != null ? S.clusters[clusterId] : null,
      clusterId, detected
    };
  }
};

/* ============================================================
   Resolver — walk priority, evaluate derived fields
   ============================================================ */
App.Resolver = {
  /* ordered sources for a direct field, applying file priority */
  orderedSources(field) {
    const sources = (field.sources || []).slice();
    if (field.priority_override) return sources;
    const prio = App.State.profile.file_priority || [];
    return sources.slice().sort((a, b) => {
      const ia = prio.indexOf(a.file_id), ib = prio.indexOf(b.file_id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  },

  resolveCluster(cluster) {
    const schema = App.State.profile.canonical_schema;
    const ctx = {};
    const trail = {};
    /* direct fields */
    schema.filter(f => f.type === "direct").forEach(f => {
      const sources = this.orderedSources(f);
      let resolved = false;
      let triedBlank = 0, triedMissing = 0;
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        const file = App.State.files[src.file_id];
        if (!file) { triedMissing++; continue; }
        const ci = App.FileRegistry.resolveColumn(file, src.column);
        if (ci == null) { triedMissing++; continue; }
        const rows = cluster ? cluster.rows[src.file_id] : null;
        if (!rows || !rows.length) { triedBlank++; continue; }
        const val = file.rows[rows[0]][ci];
        if (!U.isBlank(val)) {
          ctx[f.name] = val;
          trail[f.name] = {
            value: val, kind: "direct",
            src: (file.label || file.filename) + " → " + file.sheet + " → \"" + src.column + "\"",
            note: "priority " + (i + 1) + (triedBlank + triedMissing ? "; " + (triedBlank + triedMissing) + " earlier source(s) blank/broken" : "")
          };
          resolved = true;
          break;
        }
        triedBlank++;
      }
      if (!resolved) {
        ctx[f.name] = null;
        trail[f.name] = {
          value: null, kind: "blank",
          src: "no source returned a value",
          note: "tried " + sources.length + " source(s)"
        };
      }
    });
    /* derived fields in topo order */
    App.State.resolveOrder.forEach(f => {
      if (!f._ast) {
        ctx[f.name] = null;
        trail[f.name] = { value: null, kind: "blank", src: "formula error", note: f._err || "invalid formula" };
        return;
      }
      const w = [];
      const v = App.FormulaEngine.evaluate(f._ast, ctx, w);
      ctx[f.name] = v;
      trail[f.name] = {
        value: v, kind: "derived",
        src: "derived: " + f.formula,
        note: w.length ? w.join("; ") : ""
      };
    });
    return { ctx, trail };
  },

  resolveBatch(inputKeys) {
    const results = [];
    inputKeys.forEach(rawKey => {
      const key = U.normStr(rawKey);
      if (!key) return;
      const hit = App.ClusterEngine.lookup(key);
      const r = this.resolveCluster(hit.cluster);
      const templates = {};
      (App.State.profile.output_templates || []).forEach(t => {
        const c = App.FormulaEngine.compile(t.formula);
        templates[t.name] = c.ast ? App.FormulaEngine.evaluate(c.ast, r.ctx, null) : null;
      });
      results.push({
        input_key: key,
        detected_identity: hit.detected || "—",
        cluster_id: hit.clusterId != null ? hit.clusterId : null,
        matched: !!hit.cluster,
        ctx: r.ctx, trail: r.trail, templates
      });
    });
    return results;
  }
};

/* ============================================================
   Profile — load / save / export / import
   ============================================================ */
App.Profile = {
  /* replacer strips transient (_-prefixed) props from any serialization */
  _rep(k, v) { return k.charAt(0) === "_" ? undefined : v; },
  serialize(p) { return JSON.stringify(p, this._rep); },
  defaultProfile() {
    return JSON.parse(document.getElementById("default-profile").textContent);
  },
  load(profileObj, markSaved) {
    /* deep clone, ensure shape */
    const p = JSON.parse(JSON.stringify(profileObj));
    p.files = p.files || [];
    p.file_priority = p.file_priority || p.files.map(f => f.id);
    p.canonical_schema = p.canonical_schema || [];
    p.output_templates = p.output_templates || [];
    p.canonical_schema.forEach(f => {
      if (f.type === "direct") { f.sources = f.sources || []; if (f.priority_override == null) f.priority_override = false; }
      f.is_identity = !!f.is_identity;
    });
    App.State.profile = p;
    if (markSaved) {
      App.State.savedSnapshot = this.serialize(p);
      App.State.savedName = p.name;
    }
    App.Schema.recompile();
  },
  isDirty() {
    return App.State.savedSnapshot !== this.serialize(App.State.profile);
  },
  storedProfiles() {
    try { return JSON.parse(localStorage.getItem("upc_concat_profiles") || "{}"); }
    catch (e) { return {}; }
  },
  save(name) {
    const store = this.storedProfiles();
    App.State.profile.name = name;
    store[name] = JSON.parse(this.serialize(App.State.profile));
    localStorage.setItem("upc_concat_profiles", JSON.stringify(store));
    App.State.savedSnapshot = this.serialize(App.State.profile);
    App.State.savedName = name;
  },
  exportJSON() {
    const blob = JSON.stringify(JSON.parse(this.serialize(App.State.profile)), null, 2);
    App.Exporter.download((App.State.profile.name || "profile").replace(/\s+/g, "_") +
      "_" + U.today() + ".json", "application/json", blob);
  }
};

/* ============================================================
   Exporter
   ============================================================ */
App.Exporter = {
  download(name, type, body) {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
  resultColumns() {
    const fields = App.State.profile.canonical_schema.map(f => f.name);
    const templates = App.State.profile.output_templates.map(t => t.name);
    return { fields, templates };
  },
  flatRows() {
    const { fields, templates } = this.resultColumns();
    return App.State.results.map(r => {
      const o = { input_key: r.input_key, detected_identity: r.detected_identity, cluster_id: r.cluster_id };
      fields.forEach(f => o[f] = U.toStr(r.ctx[f]));
      templates.forEach(t => o["tpl:" + t] = U.toStr(r.templates[t]));
      return o;
    });
  },
  toTSV() {
    const rows = this.flatRows();
    if (!rows.length) return "";
    const cols = Object.keys(rows[0]);
    return [cols.join("\t"), ...rows.map(r => cols.map(c => U.toStr(r[c]).replace(/[\t\n\r]/g, " ")).join("\t"))].join("\n");
  },
  toCSV() {
    const rows = this.flatRows();
    if (!rows.length) return "";
    const cols = Object.keys(rows[0]);
    const q = v => '"' + U.toStr(v).replace(/"/g, '""') + '"';
    return [cols.map(q).join(","), ...rows.map(r => cols.map(c => q(r[c])).join(","))].join("\n");
  },
  toXLSX() {
    if (!window.XLSX) { App.UI.toast("XLSX library unavailable — using CSV."); return this.csvFallback(); }
    const rows = this.flatRows();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Resolved");
    /* source-trail sheet */
    const trailRows = [];
    App.State.results.forEach(r => {
      Object.keys(r.trail).forEach(f => {
        const t = r.trail[f];
        trailRows.push({
          input_key: r.input_key, field: f,
          value: U.toStr(t.value), source: t.src, note: t.note || ""
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trailRows), "_source_trail");
    XLSX.writeFile(wb, "UPC_Concat_" + U.today() + ".xlsx");
  },
  csvFallback() {
    this.download("UPC_Concat_" + U.today() + ".csv", "text/csv", this.toCSV());
  }
};

/* ============================================================
   Schema helpers
   ============================================================ */
App.Schema = {
  recompile() {
    const schema = App.State.profile.canonical_schema;
    schema.filter(f => f.type === "derived").forEach(f => {
      const c = App.FormulaEngine.compile(f.formula);
      f._ast = c.ast; f._err = c.err;
    });
    const topo = App.FormulaEngine.topoSort(schema);
    App.State.resolveOrder = topo.order;
    App.State._cycles = topo.cycles;
  },
  fieldNames() { return App.State.profile.canonical_schema.map(f => f.name); }
};

/* ============================================================
   UI
   ============================================================ */
App.UI = {
  /* ── shared ── */
  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), 3400);
  },
  refreshDirty() {
    document.getElementById("dirtyDot").classList.toggle("show", App.Profile.isDirty());
  },
  renderAll() {
    this.Sources.render();
    this.Schema.render();
    this.Templates.render();
    this.Input.render();
    this.renderProfileSelect();
    this.renderWarnings();
    this.refreshDirty();
  },
  renderProfileSelect() {
    const sel = document.getElementById("profileSelect");
    const store = App.Profile.storedProfiles();
    const names = Object.keys(store);
    const cur = App.State.profile.name;
    sel.innerHTML = '<option value="__default">Default Eyewear Profile</option>' +
      names.filter(n => n !== "Default Eyewear Profile")
        .map(n => '<option value="' + U.esc(n) + '">' + U.esc(n) + '</option>').join("");
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    else sel.value = "__default";
  },
  renderWarnings() {
    const el = document.getElementById("warnList");
    const items = App.State.warnings.slice();
    if (App.State._cycles && App.State._cycles.length) {
      App.State._cycles.forEach(c =>
        items.unshift({ type: "err", msg: "Circular formula reference: " + c.join(" → ") }));
    }
    el.innerHTML = items.map(w =>
      '<div class="warn-item ' + (w.type === "err" ? "err" : "") + '">' + U.esc(w.msg) + '</div>'
    ).join("");
  },

  /* ── 1. Sources ── */
  Sources: {
    render() {
      const p = App.State.profile;
      const attachedCount = Object.keys(App.State.files).length;
      document.getElementById("sourcesSub").textContent =
        p.files.length + " file" + (p.files.length === 1 ? "" : "s") + " · " +
        attachedCount + " attached";
      /* keep file_priority in sync with files */
      const fileIds = new Set(p.files.map(f => f.id));
      p.file_priority = (p.file_priority || []).filter(id => fileIds.has(id));
      p.files.forEach(f => { if (!p.file_priority.includes(f.id)) p.file_priority.push(f.id); });
      const ordered = p.file_priority.map(id => p.files.find(f => f.id === id)).filter(Boolean);
      const grid = document.getElementById("slotGrid");
      grid.innerHTML = ordered.map((fd, i) => this.slotHTML(fd, i + 1)).join("") ||
        '<div class="empty-state"><span>No source files yet — drop a workbook above or use “+ Register file”.</span></div>';
    },
    slotHTML(fd, rank) {
      const loaded = App.State.files[fd.id];
      let badge, broken = false;
      if (loaded) {
        const missing = (fd.key_columns || []).filter(c =>
          App.FileRegistry.resolveColumn(loaded, c) == null);
        broken = missing.length > 0;
        const sheetTxt = loaded.sheet ? " · " + loaded.sheet : "";
        badge = broken
          ? '<span class="badge err">' + missing.length + ' key col missing</span>'
          : '<span class="badge ok">' + loaded.rows.length.toLocaleString() + ' rows' + U.esc(sheetTxt) + '</span>';
      } else {
        badge = '<span class="badge">empty slot</span>';
      }
      const expanded = fd._uiExpanded ? ' expanded' : '';
      const filenameOrPattern = loaded ? loaded.filename : (fd.expected_filename_pattern || '');

      let detailHTML;
      if (loaded) {
        detailHTML =
          '<div class="slot-meta">' +
            '<div class="field"><label>Sheet</label><select data-slot-sheet="' + U.esc(fd.id) + '">' +
              loaded.sheetNames.map(s => '<option ' + (s === fd.sheet ? "selected" : "") + '>' + U.esc(s) + '</option>').join("") +
            '</select></div>' +
            '<div class="field"><label>Header row</label><input type="number" min="1" value="' + fd.header_row + '" data-slot-header="' + U.esc(fd.id) + '"></div>' +
            '<button class="btn btn-sm" data-slot-reload="' + U.esc(fd.id) + '">Reload</button>' +
          '</div>' +
          '<div class="keycols">' +
            (fd.key_columns || []).map(c => {
              const ok = App.FileRegistry.resolveColumn(loaded, c) != null;
              return '<span class="keycol-chip" style="' + (ok ? "" : "border-color:var(--danger)") + '">' +
                U.esc(c) + '<button data-slot-delkey="' + U.esc(fd.id) + '" data-key="' + U.esc(c) + '">×</button></span>';
            }).join("") +
            '<span class="keycol-chip"><input type="text" placeholder="+ key col" data-slot-addkey="' + U.esc(fd.id) + '" style="border:0;background:none;min-height:auto;padding:0;width:90px"></span>' +
          '</div>';
      } else {
        detailHTML =
          '<div class="hint">Drop a file' +
            (fd.expected_filename_pattern ? ' matching <code>' + U.esc(fd.expected_filename_pattern) + '</code>' : '') +
            ' above, or use the Sheet selector after attaching one.</div>' +
          '<div class="keycols">' + (fd.key_columns || []).map(c =>
            '<span class="keycol-chip">' + U.esc(c) + '</span>').join("") + '</div>';
      }

      return '<div class="slot ' + (loaded ? "attached " : "") + (broken ? "broken " : "") + expanded + '" data-id="' + U.esc(fd.id) + '">' +
        '<div class="slot-summary" draggable="true">' +
          '<span class="grip" aria-hidden="true">⋮⋮</span>' +
          '<span class="rank">' + rank + '</span>' +
          '<span class="slot-name">' + U.esc(fd.label || fd.id) +
            (filenameOrPattern ? '<span class="slot-pattern-inline">' + U.esc(filenameOrPattern) + '</span>' : '') +
          '</span>' +
          badge +
          '<button class="slot-toggle" data-slot-toggle="' + U.esc(fd.id) + '" title="Expand details">▾</button>' +
          '<button class="slot-remove" data-slot-remove="' + U.esc(fd.id) + '" title="Remove">✕</button>' +
        '</div>' +
        '<div class="slot-detail">' + detailHTML + '</div>' +
      '</div>';
    }
  },

  /* ── 2. Schema ── */
  Schema: {
    render() {
      const schema = App.State.profile.canonical_schema;
      document.getElementById("schemaSub").textContent =
        schema.length + " fields · " + schema.filter(f => f.is_identity).length + " identity";
      const el = document.getElementById("schemaTable");
      el.innerHTML = schema.map((f, i) => this.rowHTML(f, i)).join("") ||
        '<div class="empty-state"><span>No canonical fields.</span></div>';
    },
    rowHTML(f, i) {
      let srcDesc;
      if (f.type === "derived") {
        srcDesc = f._err ? '⚠ ' + U.esc(f._err) : U.esc(f.formula || "");
      } else {
        const sources = App.Resolver.orderedSources(f);
        srcDesc = sources.map((s, k) => {
          const fd = App.State.profile.files.find(x => x.id === s.file_id);
          const sheet = fd && fd.sheet ? " → " + fd.sheet : "";
          return (k + 1) + ". " + (fd?.label || s.file_id) + sheet + " → " + s.column;
        }).join("   ");
        if (!sources.length) srcDesc = "no sources";
      }
      const open = f._uiOpen ? " open" : "";
      return '<div class="schema-row' + open + '" data-fname="' + U.esc(f.name) + '">' +
        '<div class="schema-head" data-fhead="' + U.esc(f.name) + '">' +
          '<span class="panel-chevron"><svg viewBox="0 0 24 24" style="stroke:var(--text-muted);fill:none;stroke-width:2"><polyline points="6 9 12 15 18 9"/></svg></span>' +
          '<span class="schema-fname">' + (f.is_identity ? "★ " : "") + U.esc(f.name) + '</span>' +
          '<span class="schema-ftype">' + f.type + '</span>' +
          '<span class="schema-fsrc">' + srcDesc + '</span>' +
          '<span class="schema-ftype" style="text-align:right">' +
            (f._err ? '<span class="badge err">error</span>' : '') + '</span>' +
        '</div>' +
        '<div class="schema-detail">' + (f._uiOpen ? this.detailHTML(f) : "") + '</div>' +
      '</div>';
    },
    detailHTML(f) {
      const idChk = '<label class="check-inline"><input type="checkbox" data-fid-identity="' + U.esc(f.name) + '"' +
        (f.is_identity ? " checked" : "") + '> identity field (used to join across files)</label>';
      let body;
      if (f.type === "direct") {
        const sources = App.Resolver.orderedSources(f);
        const files = App.State.profile.files;
        const srcRows = sources.map((s, i) => {
          const loaded = App.State.files[s.file_id];
          const broken = loaded && App.FileRegistry.resolveColumn(loaded, s.column) == null;
          const colOptions = loaded
            ? loaded.headers.map(h => {
                const label = h.name || "(blank — col " + h.letter + ")";
                return '<option value="' + U.esc(h.name || h.letter) + '"' +
                  ((h.name || h.letter) === s.column ? " selected" : "") + '>' + U.esc(label) + '</option>';
              }).join("")
            : '<option selected>' + U.esc(s.column) + '</option>';
          return '<div class="src-row' + (broken ? " broken" : "") + '">' +
            '<span class="src-rank">' + (i + 1) + '</span>' +
            '<select data-src-file="' + U.esc(f.name) + '" data-i="' + i + '" title="file → sheet">' +
              files.map(fd => {
                const sheetTxt = fd.sheet ? " (" + fd.sheet + ")" : "";
                return '<option value="' + fd.id + '"' + (fd.id === s.file_id ? " selected" : "") + '>' +
                  U.esc((fd.label || fd.id) + sheetTxt) + '</option>';
              }).join("") +
            '</select>' +
            '<select data-src-col="' + U.esc(f.name) + '" data-i="' + i + '">' + colOptions + '</select>' +
            '<span class="inherit-tag ' + (f.priority_override ? "override" : "inherited") + '">' +
              (f.priority_override ? "manual" : "inherited") + '</span>' +
            '<span class="row-actions">' +
              (f.priority_override ? '<button class="btn btn-xs" data-src-up="' + U.esc(f.name) + '" data-i="' + i + '">↑</button>' : '') +
              '<button class="btn btn-xs btn-danger" data-src-del="' + U.esc(f.name) + '" data-i="' + i + '">×</button>' +
            '</span>' +
          '</div>';
        }).join("");
        body =
          '<div class="src-table">' + (srcRows || '<span class="hint">No sources mapped.</span>') + '</div>' +
          '<div class="detail-line">' +
            '<button class="btn btn-sm" data-src-add="' + U.esc(f.name) + '">+ Add source</button>' +
            '<label class="check-inline"><input type="checkbox" data-src-override="' + U.esc(f.name) + '"' +
              (f.priority_override ? " checked" : "") + '> override file priority</label>' +
            (f.priority_override ? '<button class="btn btn-sm" data-src-reset="' + U.esc(f.name) + '">Reset to file priority</button>' : '') +
          '</div>';
      } else {
        const hl = this.highlight(f.formula || "");
        body =
          '<div class="formula-box">' +
            '<span class="lbl">Formula</span>' +
            '<textarea data-formula="' + U.esc(f.name) + '" rows="2">' + U.esc(f.formula || "") + '</textarea>' +
            '<div class="formula-preview">' + hl + '</div>' +
            (f._err ? '<div class="formula-err">⚠ ' + U.esc(f._err) + '</div>'
                    : '<div class="formula-ok">✓ parses</div>') +
            '<div class="autocomplete-hint">Fields: ' +
              App.Schema.fieldNames().map(n => "{" + n + "}").join("  ") +
            '<br>Functions: ' + Object.keys(App.FormulaEngine.FN).join("  ") + '</div>' +
          '</div>';
      }
      /* live test */
      body += '<div class="detail-grid" style="margin-top:12px">' +
        '<div class="live-test">' +
          '<span class="lbl">Live test</span>' +
          '<input type="text" data-test-key="' + U.esc(f.name) + '" placeholder="paste a key">' +
          '<button class="btn btn-sm" data-test-run="' + U.esc(f.name) + '">Resolve</button>' +
          '<span class="live-result" data-test-out="' + U.esc(f.name) + '">—</span>' +
        '</div></div>';
      return '<div class="detail-grid">' +
        '<div class="detail-line">' +
          '<div class="field" style="max-width:260px"><label>Field name</label>' +
            '<input type="text" data-frename="' + U.esc(f.name) + '" value="' + U.esc(f.name) + '"></div>' +
          idChk +
          '<button class="btn btn-sm btn-danger" data-fdelete="' + U.esc(f.name) + '">Delete field</button>' +
        '</div>' + body + '</div>';
    },
    highlight(src) {
      /* token-based syntax highlight for the preview box */
      let out = "";
      try {
        let i = 0;
        const toks = App.FormulaEngine.tokenize(src);
        /* re-scan original for spacing fidelity: simple approach — rebuild */
        toks.forEach((t, k) => {
          if (k > 0) out += " ";
          if (t.t === "field") out += '<span class="tok-field">{' + U.esc(t.v) + '}</span>';
          else if (t.t === "str") out += '<span class="tok-str">"' + U.esc(t.v) + '"</span>';
          else if (t.t === "num") out += '<span class="tok-num">' + t.v + '</span>';
          else if (t.t === "ident") {
            const fn = App.FormulaEngine.FN[t.v.toUpperCase()];
            out += fn || ["TRUE", "FALSE", "BLANK"].includes(t.v.toUpperCase())
              ? '<span class="tok-fn">' + U.esc(t.v) + '</span>' : U.esc(t.v);
          } else out += U.esc(t.v);
        });
      } catch (e) { out = U.esc(src); }
      return out || '<span class="dim">(empty)</span>';
    }
  },

  /* ── 3. Templates ── */
  Templates: {
    render() {
      const tpls = App.State.profile.output_templates;
      document.getElementById("templatesSub").textContent =
        tpls.length + " template" + (tpls.length === 1 ? "" : "s");
      const el = document.getElementById("templateList");
      el.innerHTML = tpls.map((t, i) => this.cardHTML(t, i)).join("") ||
        '<div class="empty-state"><span>No output templates.</span></div>';
    },
    cardHTML(t, i) {
      const c = App.FormulaEngine.compile(t.formula);
      let preview = "—";
      if (c.ast && App.State.results.length) {
        preview = U.toStr(App.FormulaEngine.evaluate(c.ast, App.State.results[0].ctx, null)) || "(blank)";
      }
      return '<div class="tpl-card">' +
        '<div class="detail-line">' +
          '<div class="field" style="max-width:280px"><label>Template name</label>' +
            '<input type="text" data-tpl-name="' + i + '" value="' + U.esc(t.name) + '"></div>' +
          '<button class="btn btn-sm btn-danger" data-tpl-del="' + i + '">Delete</button>' +
        '</div>' +
        '<div class="detail-grid">' +
          '<div class="formula-box">' +
            '<span class="lbl">Formula</span>' +
            '<textarea data-tpl-formula="' + i + '" rows="2">' + U.esc(t.formula || "") + '</textarea>' +
            '<div class="formula-preview">' + App.UI.Schema.highlight(t.formula || "") + '</div>' +
            (c.err ? '<div class="formula-err">⚠ ' + U.esc(c.err) + '</div>' : '<div class="formula-ok">✓ parses</div>') +
            '<div class="hint">Preview (first result): <code>' + U.esc(preview) + '</code></div>' +
          '</div>' +
        '</div></div>';
    }
  },

  /* ── 4. Input ── */
  Input: {
    render() { this.updateDetect(); },
    updateDetect() {
      const lines = document.getElementById("inputKeys").value
        .split("\n").map(s => s.trim()).filter(Boolean);
      const el = document.getElementById("detectLine");
      if (!lines.length) {
        el.innerHTML = '<span class="badge">Paste keys to detect identity types</span>';
        return;
      }
      if (!App.State.clusters.length) {
        el.innerHTML = '<span class="badge warn">' + lines.length + ' keys — run resolution to build clusters</span>';
        return;
      }
      const counts = {};
      lines.forEach(k => {
        const d = App.ClusterEngine.lookup(k).detected || "unmatched";
        counts[d] = (counts[d] || 0) + 1;
      });
      el.innerHTML = Object.keys(counts).map(d =>
        '<span class="badge ' + (d === "unmatched" ? "warn" : "idn") + '">' +
        counts[d] + "× " + U.esc(d) + '</span>').join("");
    }
  },

  /* ── 5. Results ── */
  Results: {
    render() {
      const results = App.State.results;
      const matched = results.filter(r => r.matched).length;
      document.getElementById("resultsSub").textContent = results.length
        ? matched + " resolved · " + (results.length - matched) + " unmatched"
        : "No run yet";
      ["copyTsvBtn", "dlCsvBtn", "dlXlsxBtn"].forEach(id =>
        document.getElementById(id).disabled = !results.length);
      const el = document.getElementById("resultsTable");
      if (!results.length) {
        el.innerHTML = '<div class="empty-state"><div><strong>No results yet.</strong>' +
          '<span>Attach files, paste keys, and run resolution.</span></div></div>';
        return;
      }
      const filter = document.getElementById("resultFilter").value.toLowerCase();
      const blanksOnly = document.getElementById("filterBlanks").checked;
      const resolvedOnly = document.getElementById("filterResolved").checked;
      const showCluster = document.getElementById("showClusterId").checked;
      const fields = App.State.profile.canonical_schema.map(f => f.name);
      const templates = App.State.profile.output_templates.map(t => t.name);

      /* natural column order, then apply saved column order (if any) on top */
      const naturalOrder = ["input_key", "detected_identity"]
        .concat(showCluster ? ["cluster_id"] : [])
        .concat(fields).concat(templates.map(t => "tpl:" + t)).concat(["trail"]);
      const naturalSet = new Set(naturalOrder);
      const saved = (App.State.columnOrder || []).filter(c => naturalSet.has(c));
      const missing = naturalOrder.filter(c => !saved.includes(c));
      const ordered = saved.concat(missing);

      let rows = results.map((r, i) => ({ r, i }));
      rows = rows.filter(({ r }) => {
        const hasBlank = fields.some(f => U.isBlank(r.ctx[f]));
        if (blanksOnly && !hasBlank) return false;
        if (resolvedOnly && hasBlank) return false;
        if (filter) {
          const hay = (r.input_key + " " + r.detected_identity + " " +
            fields.map(f => U.toStr(r.ctx[f])).join(" ") + " " +
            templates.map(t => U.toStr(r.templates[t])).join(" ")).toLowerCase();
          if (!hay.includes(filter)) return false;
        }
        return true;
      });

      function cellHTML(col, r, i) {
        if (col === "input_key") return '<td title="' + U.esc(r.input_key) + '">' + U.esc(r.input_key) + '</td>';
        if (col === "detected_identity") return '<td>' + (r.matched ? U.esc(r.detected_identity) : '<span class="dim">unmatched</span>') + '</td>';
        if (col === "cluster_id") return '<td>' + (r.cluster_id != null ? r.cluster_id : "—") + '</td>';
        if (col === "trail") return '<td><button class="trail-btn" data-trail="' + i + '">trail ▾</button></td>';
        if (col.indexOf("tpl:") === 0) {
          const v = r.templates[col.slice(4)];
          return '<td class="tpl-cell" title="' + U.esc(v) + '">' + U.esc(U.toStr(v) || "—") + '</td>';
        }
        const v = r.ctx[col];
        return U.isBlank(v)
          ? '<td class="blank-cell">BLANK</td>'
          : '<td title="' + U.esc(v) + '">' + U.esc(v) + '</td>';
      }

      let html = "<table><thead><tr>" +
        ordered.map(c => '<th draggable="true" data-col="' + U.esc(c) + '" title="Drag to reorder · click to sort">' + U.esc(c) + '</th>').join("") +
        "</tr></thead><tbody>";
      rows.forEach(({ r, i }) => {
        html += '<tr class="data-row">' + ordered.map(c => cellHTML(c, r, i)).join("") + '</tr>';
      });
      html += "</tbody></table>";
      el.innerHTML = html;
      el._colspan = ordered.length;
    },
    toggleTrail(i, btn) {
      const tr = btn.closest("tr");
      if (tr.nextElementSibling && tr.nextElementSibling.classList.contains("trail-row")) {
        tr.nextElementSibling.remove();
        btn.textContent = "trail ▾";
        return;
      }
      const r = App.State.results[i];
      const fields = App.State.profile.canonical_schema.map(f => f.name);
      const lines = fields.map(f => {
        const t = r.trail[f] || { value: null, kind: "blank", src: "—", note: "" };
        const cls = t.kind === "derived" ? "derived" : (t.kind === "blank" ? "blank" : "");
        const valTxt = U.isBlank(t.value) ? "BLANK" : U.toStr(t.value);
        return '<div class="trail-line ' + cls + '">' +
          '<span class="tf">' + U.esc(f) + '</span> = <span class="tv">' + U.esc(valTxt) + '</span> ' +
          '<span class="ts">← ' + U.esc(t.src) + (t.note ? "  (" + U.esc(t.note) + ")" : "") + '</span></div>';
      }).join("");
      const span = document.getElementById("resultsTable")._colspan || 6;
      const trailTr = document.createElement("tr");
      trailTr.className = "trail-row";
      trailTr.innerHTML = '<td colspan="' + span + '"><div class="trail-box">' + lines + '</div></td>';
      tr.after(trailTr);
      btn.textContent = "trail ▴";
    }
  }
};

/* ============================================================
   Controller — file loading, events, wiring
   ============================================================ */
App.Ctrl = {
  /* attach a parsed workbook to a profile slot (or create ad-hoc) */
  async loadIntoSlot(fileId, filename, wb) {
    const fd = App.State.profile.files.find(f => f.id === fileId);
    if (!fd) return;
    const sheet = wb.SheetNames.includes(fd.sheet) ? fd.sheet : wb.SheetNames[0];
    fd.sheet = sheet;
    try {
      const file = App.FileRegistry.buildFile(fileId, filename, wb, sheet, fd.header_row || 1);
      file.label = fd.label;
      App.State.files[fileId] = file;
      this.rebuildSlotIndices(fileId);
      App.UI.toast("Loaded " + filename + " → " + (fd.label || fileId));
    } catch (e) {
      App.UI.toast("Could not load " + filename + ": " + e.message);
    }
  },

  rebuildSlotIndices(fileId) {
    const file = App.State.files[fileId];
    const fd = App.State.profile.files.find(f => f.id === fileId);
    if (!file || !fd) return;
    /* index declared key columns + any identity-field source columns */
    const cols = new Set();
    (fd.key_columns || []).forEach(c => {
      const ci = App.FileRegistry.resolveColumn(file, c);
      if (ci != null) cols.add(ci);
    });
    App.State.profile.canonical_schema.filter(f => f.is_identity && f.type === "direct")
      .forEach(f => (f.sources || []).filter(s => s.file_id === fileId).forEach(s => {
        const ci = App.FileRegistry.resolveColumn(file, s.column);
        if (ci != null) cols.add(ci);
      }));
    App.FileRegistry.buildIndices(file, [...cols]);
  },

  /* handle dropped/selected files — auto-match to slots by filename pattern */
  async handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;
    if (!window.XLSX) { App.UI.toast("Spreadsheet library not loaded."); return; }
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        const hash = await App.FileRegistry.sha256(buf.slice(0));
        const wb = App.FileRegistry.parseWorkbook(buf, file.name);
        const slot = this.matchSlot(file.name);
        if (slot) {
          await this.loadIntoSlot(slot.id, file.name, wb);
        } else {
          /* ad-hoc: create a new profile slot */
          const id = U.uid("file");
          App.State.profile.files.push({
            id, label: file.name.replace(/\.[^.]+$/, ""),
            expected_filename_pattern: file.name,
            sheet: wb.SheetNames[0], header_row: 1, key_columns: []
          });
          App.State.profile.file_priority.push(id);
          await this.loadIntoSlot(id, file.name, wb);
        }
      } catch (e) {
        App.UI.toast("Could not read " + file.name + ": " + e.message);
      }
    }
    App.UI.renderAll();
  },

  matchSlot(filename) {
    return App.State.profile.files.find(fd => {
      if (App.State.files[fd.id]) return false; /* already filled */
      const pat = fd.expected_filename_pattern;
      if (!pat) return false;
      const re = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") + "$", "i");
      return re.test(filename);
    });
  },

  /* full run: build clusters + resolve */
  async run() {
    const keys = document.getElementById("inputKeys").value
      .split("\n").map(s => s.trim()).filter(Boolean);
    if (!keys.length) { App.UI.toast("Paste at least one key."); return; }
    if (!Object.keys(App.State.files).length) { App.UI.toast("Attach at least one source file."); return; }
    App.State.warnings = [];
    await this.rebuildClusters();
    App.State.results = App.Resolver.resolveBatch(keys);
    App.UI.Results.render();
    App.UI.Templates.render();
    App.UI.Input.updateDetect();
    App.UI.renderWarnings();
    const matched = App.State.results.filter(r => r.matched).length;
    App.UI.toast("Resolved " + matched + " / " + App.State.results.length + " keys.");
  },

  async rebuildClusters() {
    /* warn on file-size limits */
    let big = false;
    (Object.values(App.State.files) as any[]).forEach(f => {
      if (f.rows.length > 1000000) {
        App.State.warnings.push({ type: "err", msg: f.filename + " exceeds 1M rows." });
      } else if (f.rows.length > 100000) {
        big = true;
      }
    });
    if (big) App.State.warnings.push({ type: "warn", msg: "A source exceeds 100K rows — clustering may take a few seconds." });
    /* re-index identity columns (schema may have changed) */
    Object.keys(App.State.files).forEach(id => this.rebuildSlotIndices(id));
    const wrap = document.getElementById("progressWrap");
    const fill = document.getElementById("progressFill");
    const label = document.getElementById("progressLabel");
    wrap.classList.add("show");
    await App.ClusterEngine.build((frac, msg) => {
      fill.style.width = Math.round(frac * 100) + "%";
      label.textContent = msg;
    });
    label.textContent = App.State.clusters.filter(c => !c.merged).length.toLocaleString() + " clusters built";
    setTimeout(() => wrap.classList.remove("show"), 1400);
  }
};

/* ============================================================
   Event wiring
   ============================================================ */
function markDirtyAndRefresh(rerender) {
  App.UI.refreshDirty();
  if (rerender) App.UI.renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  /* load default profile */
  App.Profile.load(App.Profile.defaultProfile(), true);
  App.UI.renderAll();
  App.UI.Results.render();

  /* ── panel collapse ── */
  document.querySelectorAll(".panel-header[data-toggle]").forEach(h => {
    h.addEventListener("click", e => {
      /* don't collapse when clicking interactive controls in the header */
      if (e.target.closest("button, input, select")) return;
      h.closest(".panel").classList.toggle("collapsed");
    });
  });

  /* ── step visualizations (rendered inline in each section + inside the info modal) ── */
  const VIZ = {
    register: () =>
      '<div class="step-viz">' +
        '<div class="viz-line"><strong>Register</strong> a workbook — pick its sheet, header row, &amp; declare which columns can act as join keys.</div>' +
        '<div class="viz-row">' +
          '<div class="viz-pill">workbook.xlsx</div>' +
          '<div class="viz-arrow">→</div>' +
          '<div class="viz-stack">' +
            '<div class="viz-pill viz-tag">sheet: Sheet1</div>' +
            '<div class="viz-pill viz-tag">header row: 1</div>' +
          '</div>' +
          '<div class="viz-arrow">→</div>' +
          '<div class="viz-stack">' +
            '<div class="viz-pill">key column: UPC</div>' +
            '<div class="viz-pill">key column: SKU</div>' +
            '<div class="viz-pill">key column: G  (by letter)</div>' +
          '</div>' +
        '</div>' +
      '</div>',
    map: () =>
      '<div class="step-viz">' +
        '<div class="viz-line">Each canonical field maps to one or more <strong>file → sheet → column</strong> sources:</div>' +
        '<div class="viz-line">canonical field <span class="viz-field">brand</span></div>' +
        '<div class="viz-mapping">' +
          '<span class="viz-rank">1.</span>' +
          '<span class="viz-pill">file: File-A</span><span class="viz-arrow">→</span>' +
          '<span class="viz-pill">sheet: Sheet1</span><span class="viz-arrow">→</span>' +
          '<span class="viz-pill">column: brand_desc</span>' +
        '</div>' +
        '<div class="viz-mapping">' +
          '<span class="viz-rank">2.</span>' +
          '<span class="viz-pill">file: File-B</span><span class="viz-arrow">→</span>' +
          '<span class="viz-pill">sheet: Report</span><span class="viz-arrow">→</span>' +
          '<span class="viz-pill">column: BRAND</span>' +
        '</div>' +
      '</div>',
    priority: () =>
      '<div class="step-viz">' +
        '<div class="viz-line">Resolution walks each field\'s source list. <strong>First non-blank value wins.</strong></div>' +
        '<div class="viz-row viz-row-tight">' +
          '<span class="viz-rank">1</span>' +
          '<span class="viz-pill viz-blank">File-A → "brand_desc"</span>' +
          '<span class="viz-note">— blank, skip</span>' +
        '</div>' +
        '<div class="viz-row viz-row-tight">' +
          '<span class="viz-rank">2</span>' +
          '<span class="viz-pill viz-hit">File-B → "BRAND" = "COSTA"</span>' +
          '<span class="viz-note">✓ wins</span>' +
        '</div>' +
      '</div>',
    templates: () =>
      '<div class="step-viz">' +
        '<div class="viz-line">Output templates concatenate canonical fields:</div>' +
        '<div class="viz-formula"><span class="fn">JOIN</span>(<span class="str">" "</span>, <span class="field">{brand}</span>, <span class="field">{material}</span>, <span class="field">{eye_size}</span>)</div>' +
        '<div class="viz-row">' +
          '<div class="viz-pill">{brand} = "COSTA"</div>' +
          '<div class="viz-pill">{material} = "06S9129"</div>' +
          '<div class="viz-pill">{eye_size} = "64"</div>' +
        '</div>' +
        '<div class="viz-arrow viz-down">↓</div>' +
        '<div class="viz-result-large">"COSTA 06S9129 64"</div>' +
      '</div>',
    input: () =>
      '<div class="step-viz">' +
        '<div class="viz-line">Each pasted key is detected by identity type, then routed to its cluster:</div>' +
        '<div class="viz-row">' +
          '<div class="viz-stack">' +
            '<div class="viz-pill">97963819817</div>' +
            '<div class="viz-pill">CPID0048213</div>' +
            '<div class="viz-pill">91290164</div>' +
          '</div>' +
          '<div class="viz-arrow">→</div>' +
          '<div class="viz-stack">' +
            '<div class="viz-pill viz-tag">primary_upc</div>' +
            '<div class="viz-pill viz-tag">cpid</div>' +
            '<div class="viz-pill viz-tag">grid</div>' +
          '</div>' +
          '<div class="viz-arrow">→</div>' +
          '<div class="viz-cluster">' +
            '<div class="viz-cluster-id">cluster #0</div>' +
            '<div class="viz-pill">File-A row 47</div>' +
            '<div class="viz-pill">File-B row 12</div>' +
          '</div>' +
        '</div>' +
      '</div>',
    results: () =>
      '<div class="step-viz">' +
        '<div class="viz-line">Resolved values + per-cell <strong>trail</strong> showing where each came from:</div>' +
        '<div class="viz-row">' +
          '<div class="viz-pill viz-field">97963819817</div>' +
          '<div class="viz-arrow">→</div>' +
          '<div class="viz-stack">' +
            '<div class="viz-pill viz-hit">brand = "COSTA"</div>' +
            '<div class="viz-pill viz-hit">material = "06S9129"</div>' +
            '<div class="viz-pill viz-hit">desc_full = "COSTA 06S9129 64 …"</div>' +
          '</div>' +
        '</div>' +
        '<div class="viz-trail">' +
          'brand ← File-A → "brand_desc" (priority 1)<br>' +
          'material ← File-A → "Material" (priority 1)<br>' +
          'desc_full ← derived: JOIN(" ", {brand}, {material}, {eye_size}, …)' +
        '</div>' +
      '</div>',
    /* combined per-section */
    sources: () => VIZ.register() + VIZ.priority(),
    schema: () => VIZ.map(),
    run: () => VIZ.input() + VIZ.results()
  };
  document.querySelectorAll("[data-viz-fill]").forEach(el => {
    const key = el.dataset.vizFill;
    if (VIZ[key]) el.innerHTML = VIZ[key]();
  });

  /* ── section-viz collapse toggles ── */
  document.querySelectorAll("[data-viz-toggle]").forEach(h => {
    h.addEventListener("click", () => h.closest(".section-viz").classList.toggle("collapsed"));
  });

  /* ── panel-info-btn: open info modal at relevant step in About tab ── */
  const PANEL_STEP_INDEX = { sources: 0, schema: 1, templates: 3, input: 4, results: 5 };
  document.querySelectorAll("[data-panel-info]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      document.getElementById("infoModal").classList.add("open");
      document.querySelectorAll(".info-modal-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "about"));
      document.querySelectorAll(".info-modal-pane").forEach(p => p.classList.toggle("active", p.id === "modal-tab-about"));
      const idx = PANEL_STEP_INDEX[btn.dataset.panelInfo];
      if (idx != null) {
        setTimeout(() => {
          const items = document.querySelectorAll("#modal-tab-about .step-list li");
          if (items[idx]) items[idx].scrollIntoView({ block: "start", behavior: "smooth" });
        }, 50);
      }
    });
  });

  /* ── theme — one unified viewport-level cross-fade via View Transitions ── */
  let _themePending = 0;
  function _applyTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("cloonk-theme", next); } catch (e) {}
  }
  function _swapTheme(next) {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("theme-switching");
    _themePending++;
    const settle = () => {
      if (--_themePending <= 0) { _themePending = 0; root.classList.remove("theme-switching"); }
    };
    if (typeof document.startViewTransition === "function" && !reduce) {
      document.startViewTransition(() => _applyTheme(next)).finished.finally(settle);
    } else {
      _applyTheme(next);
      requestAnimationFrame(() => requestAnimationFrame(settle));
    }
  }
  document.getElementById("themeToggle").addEventListener("click", () => {
    _swapTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });
  window.addEventListener("storage", e => {
    if (e.key !== "cloonk-theme") return;
    _swapTheme(e.newValue === "light" ? "light" : "dark");
  });

  /* ── modals ── */
  function closeModals() { document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("open")); }
  document.querySelectorAll("[data-close-modal]").forEach(b => b.addEventListener("click", closeModals));
  document.querySelectorAll(".modal-overlay").forEach(m =>
    m.addEventListener("click", e => { if (e.target === m) closeModals(); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });
  document.getElementById("infoBtn").addEventListener("click", () =>
    document.getElementById("infoModal").classList.add("open"));
  document.querySelectorAll(".info-modal-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".info-modal-tab").forEach(t => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".info-modal-pane").forEach(p => p.classList.toggle("active", p.id === "modal-tab-" + tab.dataset.tab));
    });
  });

  /* ── dropzone + file input ── */
  const dz = document.getElementById("dropzone");
  document.getElementById("fileInput").addEventListener("change", e => App.Ctrl.handleFiles(e.target.files));
  dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragging"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragging"));
  dz.addEventListener("drop", e => {
    e.preventDefault(); dz.classList.remove("dragging");
    App.Ctrl.handleFiles(e.dataTransfer.files);
  });

  /* ── register-file modal ── */
  let modalWB = null;
  document.getElementById("addFileBtn").addEventListener("click", () => {
    modalWB = null;
    document.getElementById("modalSheet").innerHTML = "";
    document.getElementById("modalColPreview").textContent = "";
    document.getElementById("modalFileId").value = "file_" + Math.random().toString(36).slice(2, 7);
    document.getElementById("modalKeyCols").value = "";
    document.getElementById("addFileModal").classList.add("open");
  });
  document.getElementById("modalFileInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    modalWB = App.FileRegistry.parseWorkbook(buf, file.name);
    modalWB._filename = file.name;
    document.getElementById("modalSheet").innerHTML =
      modalWB.SheetNames.map(s => "<option>" + U.esc(s) + "</option>").join("");
    updateModalPreview();
  });
  function updateModalPreview() {
    if (!modalWB) return;
    const sheet = document.getElementById("modalSheet").value;
    const hr = Number(document.getElementById("modalHeaderRow").value) || 1;
    try {
      const f = App.FileRegistry.buildFile("preview", modalWB._filename, modalWB, sheet, hr);
      document.getElementById("modalColPreview").textContent =
        "Columns: " + f.headers.map(h => h.name ? h.name : "[" + h.letter + "]").join(", ");
    } catch (e) {
      document.getElementById("modalColPreview").textContent = e.message;
    }
  }
  document.getElementById("modalSheet").addEventListener("change", updateModalPreview);
  document.getElementById("modalHeaderRow").addEventListener("input", updateModalPreview);
  document.getElementById("modalRegisterBtn").addEventListener("click", async () => {
    if (!modalWB) { App.UI.toast("Choose a workbook first."); return; }
    const id = document.getElementById("modalFileId").value.trim() || U.uid("file");
    if (App.State.profile.files.some(f => f.id === id)) { App.UI.toast("File id already exists."); return; }
    const sheet = document.getElementById("modalSheet").value;
    const hr = Number(document.getElementById("modalHeaderRow").value) || 1;
    const keys = document.getElementById("modalKeyCols").value.split(",").map(s => s.trim()).filter(Boolean);
    App.State.profile.files.push({
      id, label: modalWB._filename.replace(/\.[^.]+$/, ""),
      expected_filename_pattern: modalWB._filename,
      sheet, header_row: hr, key_columns: keys
    });
    App.State.profile.file_priority.push(id);
    await App.Ctrl.loadIntoSlot(id, modalWB._filename, modalWB);
    closeModals();
    App.UI.renderAll();
    markDirtyAndRefresh(false);
  });

  /* ── slot grid events ── */
  const slotGrid = document.getElementById("slotGrid");
  slotGrid.addEventListener("change", async e => {
    const t = e.target;
    if (t.dataset.slotSheet) {
      const fd = App.State.profile.files.find(f => f.id === t.dataset.slotSheet);
      fd.sheet = t.value;
      const file = App.State.files[fd.id];
      if (file) await App.Ctrl.loadIntoSlot(fd.id, file.filename, file.wb);
      App.UI.Sources.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.slotHeader) {
      const fd = App.State.profile.files.find(f => f.id === t.dataset.slotHeader);
      fd.header_row = Number(t.value) || 1;
      const file = App.State.files[fd.id];
      if (file) await App.Ctrl.loadIntoSlot(fd.id, file.filename, file.wb);
      App.UI.Sources.render(); markDirtyAndRefresh(false);
    }
  });
  slotGrid.addEventListener("keydown", e => {
    const t = e.target;
    if (t.dataset.slotAddkey && e.key === "Enter") {
      const fd = App.State.profile.files.find(f => f.id === t.dataset.slotAddkey);
      const val = t.value.trim();
      if (val) { fd.key_columns = fd.key_columns || []; fd.key_columns.push(val); }
      App.Ctrl.rebuildSlotIndices(fd.id);
      App.UI.Sources.render(); markDirtyAndRefresh(false);
    }
  });
  slotGrid.addEventListener("click", async e => {
    const t = e.target;
    if (t.dataset.slotRemove) {
      const id = t.dataset.slotRemove;
      App.State.profile.files = App.State.profile.files.filter(f => f.id !== id);
      App.State.profile.file_priority = App.State.profile.file_priority.filter(x => x !== id);
      delete App.State.files[id];
      App.UI.renderAll(); markDirtyAndRefresh(false);
      return;
    }
    if (t.dataset.slotReload) {
      const file = App.State.files[t.dataset.slotReload];
      if (file) { await App.Ctrl.loadIntoSlot(t.dataset.slotReload, file.filename, file.wb); App.UI.Sources.render(); }
      return;
    }
    if (t.dataset.slotDelkey) {
      const fd = App.State.profile.files.find(f => f.id === t.dataset.slotDelkey);
      fd.key_columns = (fd.key_columns || []).filter(c => c !== t.dataset.key);
      App.Ctrl.rebuildSlotIndices(fd.id);
      App.UI.Sources.render(); markDirtyAndRefresh(false);
      return;
    }
    if (t.dataset.slotToggle) {
      const fd = App.State.profile.files.find(f => f.id === t.dataset.slotToggle);
      if (fd) { fd._uiExpanded = !fd._uiExpanded; App.UI.Sources.render(); }
    }
  });

  /* ── slot drag-reorder (slots ARE the file priority list) ── */
  let slotDragEl = null;
  slotGrid.addEventListener("dragstart", e => {
    const summary = e.target.closest(".slot-summary");
    if (!summary) return;
    slotDragEl = summary.closest(".slot");
    if (slotDragEl) slotDragEl.classList.add("dragging");
  });
  slotGrid.addEventListener("dragend", () => {
    if (slotDragEl) slotDragEl.classList.remove("dragging");
    slotDragEl = null;
  });
  slotGrid.addEventListener("dragover", e => {
    if (!slotDragEl) return;
    e.preventDefault();
    const after = [...slotGrid.querySelectorAll(".slot:not(.dragging)")]
      .find(el => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
    if (after) slotGrid.insertBefore(slotDragEl, after);
    else slotGrid.appendChild(slotDragEl);
  });
  slotGrid.addEventListener("drop", () => {
    App.State.profile.file_priority =
      [...slotGrid.querySelectorAll(".slot")].map(el => el.dataset.id);
    App.UI.Sources.render();
    App.UI.Schema.render();
    markDirtyAndRefresh(false);
  });

  /* ── schema events ── */
  const schemaTable = document.getElementById("schemaTable");
  schemaTable.addEventListener("click", e => {
    const head = e.target.closest("[data-fhead]");
    if (head && !e.target.closest("input,select,textarea,button")) {
      const f = App.State.profile.canonical_schema.find(x => x.name === head.dataset.fhead);
      if (f) { f._uiOpen = !f._uiOpen; App.UI.Schema.render(); }
      return;
    }
    const t = e.target;
    const schema = App.State.profile.canonical_schema;
    const find = n => schema.find(x => x.name === n);
    if (t.dataset.fdelete) {
      App.State.profile.canonical_schema = schema.filter(x => x.name !== t.dataset.fdelete);
      App.Schema.recompile(); App.UI.renderAll(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcAdd) {
      const f = find(t.dataset.srcAdd);
      f.sources.push({ file_id: App.State.profile.files[0]?.id || "", column: "" });
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcDel) {
      const f = find(t.dataset.srcDel);
      f.sources.splice(Number(t.dataset.i), 1);
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcUp) {
      const f = find(t.dataset.srcUp);
      const i = Number(t.dataset.i);
      if (i > 0) { const s = f.sources.splice(i, 1)[0]; f.sources.splice(i - 1, 0, s); }
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcReset) {
      const f = find(t.dataset.srcReset);
      f.priority_override = false;
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.testRun) {
      const f = find(t.dataset.testRun);
      const key = schemaTable.querySelector('[data-test-key="' + CSS.escape(f.name) + '"]').value.trim();
      const out = schemaTable.querySelector('[data-test-out="' + CSS.escape(f.name) + '"]');
      if (!App.State.clusters.length) { out.textContent = "run resolution first"; return; }
      const hit = App.ClusterEngine.lookup(key);
      const r = App.Resolver.resolveCluster(hit.cluster);
      const tr = r.trail[f.name];
      out.textContent = tr ? (U.isBlank(tr.value) ? "BLANK" : U.toStr(tr.value)) + "  ← " + tr.src : "no value";
    }
  });
  schemaTable.addEventListener("change", e => {
    const t = e.target;
    const schema = App.State.profile.canonical_schema;
    const find = n => schema.find(x => x.name === n);
    if (t.dataset.fidIdentity) {
      find(t.dataset.fidIdentity).is_identity = t.checked;
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcOverride) {
      const f = find(t.dataset.srcOverride);
      f.priority_override = t.checked;
      if (t.checked) f.sources = App.Resolver.orderedSources(f); /* freeze current order */
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcFile) {
      find(t.dataset.srcFile).sources[Number(t.dataset.i)].file_id = t.value;
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
    if (t.dataset.srcCol) {
      find(t.dataset.srcCol).sources[Number(t.dataset.i)].column = t.value;
      App.UI.Schema.render(); markDirtyAndRefresh(false);
    }
  });
  schemaTable.addEventListener("input", e => {
    const t = e.target;
    const schema = App.State.profile.canonical_schema;
    const find = n => schema.find(x => x.name === n);
    if (t.dataset.formula) {
      const f = find(t.dataset.formula);
      f.formula = t.value;
      App.Schema.recompile();
      /* update preview/error in place without losing focus */
      const detail = t.closest(".formula-box");
      detail.querySelector(".formula-preview").innerHTML = App.UI.Schema.highlight(f.formula);
      let msg = detail.querySelector(".formula-err, .formula-ok");
      if (msg) {
        msg.className = f._err ? "formula-err" : "formula-ok";
        msg.textContent = f._err ? "⚠ " + f._err : "✓ parses";
      }
      App.UI.renderWarnings();
      markDirtyAndRefresh(false);
    }
    if (t.dataset.frename) {
      /* rename on blur instead to avoid mid-typing churn */
    }
  });
  schemaTable.addEventListener("blur", e => {
    const t = e.target;
    if (t.dataset.frename) {
      const oldName = t.dataset.frename;
      const newName = t.value.trim();
      if (newName && newName !== oldName) {
        const f = App.State.profile.canonical_schema.find(x => x.name === oldName);
        if (App.State.profile.canonical_schema.some(x => x.name === newName)) {
          App.UI.toast("Field name already exists."); t.value = oldName; return;
        }
        f.name = newName;
        App.Schema.recompile();
        App.UI.renderAll(); markDirtyAndRefresh(false);
      }
    }
  }, true);

  document.getElementById("addDirectBtn").addEventListener("click", () => {
    const name = "field_" + (App.State.profile.canonical_schema.length + 1);
    App.State.profile.canonical_schema.push({
      name, type: "direct", is_identity: false, priority_override: false,
      sources: [], _uiOpen: true
    });
    App.UI.Schema.render(); markDirtyAndRefresh(false);
  });
  document.getElementById("addDerivedBtn").addEventListener("click", () => {
    const name = "derived_" + (App.State.profile.canonical_schema.length + 1);
    App.State.profile.canonical_schema.push({
      name, type: "derived", is_identity: false, formula: '""', _uiOpen: true
    });
    App.Schema.recompile();
    App.UI.Schema.render(); markDirtyAndRefresh(false);
  });

  /* ── template events ── */
  const tplList = document.getElementById("templateList");
  document.getElementById("addTemplateBtn").addEventListener("click", () => {
    App.State.profile.output_templates.push({
      name: "Template " + (App.State.profile.output_templates.length + 1), formula: '""'
    });
    App.UI.Templates.render(); markDirtyAndRefresh(false);
  });
  tplList.addEventListener("click", e => {
    if (e.target.dataset.tplDel) {
      App.State.profile.output_templates.splice(Number(e.target.dataset.tplDel), 1);
      App.UI.Templates.render(); markDirtyAndRefresh(false);
    }
  });
  tplList.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.tplName != null) {
      App.State.profile.output_templates[Number(t.dataset.tplName)].name = t.value;
      markDirtyAndRefresh(false);
    }
    if (t.dataset.tplFormula != null) {
      const tpl = App.State.profile.output_templates[Number(t.dataset.tplFormula)];
      tpl.formula = t.value;
      const box = t.closest(".formula-box");
      box.querySelector(".formula-preview").innerHTML = App.UI.Schema.highlight(tpl.formula);
      const c = App.FormulaEngine.compile(tpl.formula);
      let msg = box.querySelector(".formula-err, .formula-ok");
      if (msg) {
        msg.className = c.err ? "formula-err" : "formula-ok";
        msg.textContent = c.err ? "⚠ " + c.err : "✓ parses";
      }
      markDirtyAndRefresh(false);
    }
  });

  /* ── input ── */
  document.getElementById("inputKeys").addEventListener("input", () => App.UI.Input.updateDetect());
  document.getElementById("runBtn").addEventListener("click", () => App.Ctrl.run());
  document.getElementById("rebuildBtn").addEventListener("click", async () => {
    if (!Object.keys(App.State.files).length) { App.UI.toast("Attach a file first."); return; }
    App.State.warnings = [];
    await App.Ctrl.rebuildClusters();
    App.UI.Input.updateDetect();
    App.UI.renderWarnings();
    App.UI.toast("Clusters rebuilt.");
  });

  /* ── results filters + trail ── */
  ["resultFilter", "filterBlanks", "filterResolved", "showClusterId"].forEach(id =>
    document.getElementById(id).addEventListener("input", () => App.UI.Results.render()));
  document.getElementById("resultsTable").addEventListener("click", e => {
    const b = e.target.closest("[data-trail]");
    if (b) { App.UI.Results.toggleTrail(Number(b.dataset.trail), b); return; }
    /* drag may have just happened — skip sort if a column was reordered */
    if (App.State._justDragged) { App.State._justDragged = false; return; }
    const th = e.target.closest("th");
    if (th && App.State.results.length && th.dataset.col && th.dataset.col !== "trail") {
      const key = th.dataset.col;
      const getv = r => key === "input_key" ? r.input_key
        : key === "detected_identity" ? r.detected_identity
        : key === "cluster_id" ? r.cluster_id
        : key.indexOf("tpl:") === 0 ? U.toStr(r.templates[key.slice(4)])
        : U.toStr(r.ctx[key]);
      const dir = App.State._sortKey === key ? -(App.State._sortDir || 1) : 1;
      App.State._sortKey = key; App.State._sortDir = dir;
      App.State.results.sort((a, b2) => {
        const va = getv(a), vb = getv(b2);
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
      });
      App.UI.Results.render();
    }
  });

  /* ── draggable column reorder on results table ── */
  const resultsTableEl = document.getElementById("resultsTable");
  let thDragEl = null;
  resultsTableEl.addEventListener("dragstart", e => {
    const th = e.target.closest("th");
    if (!th) return;
    thDragEl = th;
    th.classList.add("col-dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", th.dataset.col); } catch (_) {}
  });
  resultsTableEl.addEventListener("dragover", e => {
    if (!thDragEl) return;
    const th = e.target.closest("th");
    if (!th || th === thDragEl) return;
    e.preventDefault();
    resultsTableEl.querySelectorAll("th.col-drop-target").forEach(x => x.classList.remove("col-drop-target"));
    th.classList.add("col-drop-target");
  });
  resultsTableEl.addEventListener("dragleave", e => {
    const th = e.target.closest("th");
    if (th) th.classList.remove("col-drop-target");
  });
  resultsTableEl.addEventListener("drop", e => {
    if (!thDragEl) return;
    const th = e.target.closest("th");
    if (!th || th === thDragEl) return;
    e.preventDefault();
    const headers = [...th.parentElement.children];
    const cols = headers.map(h => h.dataset.col);
    const fromIdx = headers.indexOf(thDragEl);
    const toIdx = headers.indexOf(th);
    const [moved] = cols.splice(fromIdx, 1);
    cols.splice(toIdx, 0, moved);
    App.State.columnOrder = cols;
    App.State._justDragged = true;
    setTimeout(() => { App.State._justDragged = false; }, 0);
    App.UI.Results.render();
  });
  resultsTableEl.addEventListener("dragend", () => {
    if (thDragEl) thDragEl.classList.remove("col-dragging");
    resultsTableEl.querySelectorAll("th.col-drop-target").forEach(x => x.classList.remove("col-drop-target"));
    thDragEl = null;
  });
  document.getElementById("resetColsBtn").addEventListener("click", () => {
    App.State.columnOrder = null;
    App.UI.Results.render();
    App.UI.toast("Column order reset.");
  });

  /* ── export results ── */
  document.getElementById("copyTsvBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(App.Exporter.toTSV())
      .then(() => App.UI.toast("Copied TSV to clipboard."))
      .catch(() => App.UI.toast("Clipboard blocked — use .csv export."));
  });
  document.getElementById("dlCsvBtn").addEventListener("click", () =>
    App.Exporter.download("UPC_Concat_" + U.today() + ".csv", "text/csv", App.Exporter.toCSV()));
  document.getElementById("dlXlsxBtn").addEventListener("click", () => App.Exporter.toXLSX());

  /* ── profile actions ── */
  document.getElementById("profileSelect").addEventListener("change", async e => {
    const canSwitch = !App.Profile.isDirty() || (window.fashionConfirm
      ? await window.fashionConfirm("Discard unsaved changes and switch profile?", {
          title: "Switch Profile",
          confirmLabel: "Switch",
        })
      : confirm("Discard unsaved changes and switch profile?"));
    if (!canSwitch) {
      App.UI.renderProfileSelect(); return;
    }
    const v = e.target.value;
    if (v === "__default") App.Profile.load(App.Profile.defaultProfile(), true);
    else {
      const store = App.Profile.storedProfiles();
      if (store[v]) App.Profile.load(store[v], true);
    }
    App.State.files = {}; App.State.clusters = []; App.State.results = []; App.State.warnings = [];
    App.UI.renderAll(); App.UI.Results.render();
  });
  document.getElementById("saveBtn").addEventListener("click", async () => {
    const name = window.fashionPrompt
      ? await window.fashionPrompt("Save profile as:", {
          title: "Profile Name",
          defaultValue: App.State.profile.name || "My Profile",
          confirmLabel: "Save",
        })
      : prompt("Save profile as:", App.State.profile.name || "My Profile");
    if (!name) return;
    App.Profile.save(name);
    App.UI.renderAll();
    App.UI.toast("Profile saved to browser storage.");
  });
  document.getElementById("exportProfileBtn").addEventListener("click", () => App.Profile.exportJSON());
  document.getElementById("importProfileBtn").addEventListener("click", () =>
    document.getElementById("profileFileInput").click());
  document.getElementById("profileFileInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      App.Profile.load(obj, true);
      App.State.files = {}; App.State.clusters = []; App.State.results = []; App.State.warnings = [];
      App.UI.renderAll(); App.UI.Results.render();
      App.UI.toast("Profile imported. Re-attach source files.");
    } catch (err) {
      App.UI.toast("Could not import profile: " + err.message);
    }
    e.target.value = "";
  });
  document.getElementById("resetBtn").addEventListener("click", async () => {
    const canReset = !App.Profile.isDirty() || (window.fashionConfirm
      ? await window.fashionConfirm("Discard changes and reset to the bundled profile?", {
          title: "Reset Profile",
          confirmLabel: "Reset",
        })
      : confirm("Discard changes and reset to the bundled profile?"));
    if (!canReset) return;
    App.Profile.load(App.Profile.defaultProfile(), true);
    App.State.files = {}; App.State.clusters = []; App.State.results = []; App.State.warnings = [];
    App.UI.renderAll(); App.UI.Results.render();
    App.UI.toast("Reset to default profile.");
  });
  document.getElementById("discardBtn").addEventListener("click", () => {
    if (!App.Profile.isDirty()) { App.UI.toast("No unsaved changes."); return; }
    if (App.State.savedName === "Default Eyewear Profile" || !App.State.savedName) {
      App.Profile.load(JSON.parse(App.State.savedSnapshot), true);
    } else {
      App.Profile.load(JSON.parse(App.State.savedSnapshot), true);
    }
    App.UI.renderAll(); App.UI.Results.render();
    App.UI.toast("Reverted to last saved state.");
  });
});
