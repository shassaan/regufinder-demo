/*
 * Regufinder product tour: screens, tour navigation and in-page actions.
 * Plain JavaScript, no framework, no network.
 */
(function () {
  "use strict";

  var D = window.RF_DATA;
  var L = window.RF_LEDGER;
  var C = window.RFCanon;
  var SCREENS = D.screens;
  var N = SCREENS.length;
  var WEEK = "1 to 7 March 2027";

  /* ------------------------------------------------------------------ helpers */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtInt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  // Exact decimal formatting of integer micro-dollars.
  function fmtMicro(m, minDp) {
    if (minDp === undefined) minDp = 2;
    var neg = m < 0; if (neg) m = -m;
    var whole = Math.floor(m / 1000000);
    var frac = String(m % 1000000);
    while (frac.length < 6) frac = "0" + frac;
    while (frac.length > minDp && frac.charAt(frac.length - 1) === "0") frac = frac.slice(0, -1);
    return (neg ? "-" : "") + fmtInt(whole) + (frac.length ? "." + frac : "");
  }
  function usd(m, minDp) { return "$" + fmtMicro(m, minDp); }
  function pct(n, d, dp) {
    var f = Math.pow(10, dp);
    return (Math.round((n * 100 * f) / d) / f).toFixed(dp) + "%";
  }
  function per100(n) { return (n / 100).toFixed(2); }
  function sum(arr, fn) { return arr.reduce(function (a, x) { return a + fn(x); }, 0); }
  function byId(id) { return document.getElementById(id); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function stripTags(s) { return String(s).replace(/<[^>]*>/g, ""); }
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function invRow(id) { for (var i = 0; i < D.inventory.length; i++) if (D.inventory[i].id === id) return D.inventory[i]; return null; }
  function slugIndex(slug) { for (var i = 0; i < N; i++) if (SCREENS[i].slug === slug) return i; return -1; }

  var GLOSS = {};
  D.glossary.forEach(function (g) { GLOSS[g[0].toLowerCase()] = g[1]; });
  function term(key, text) {
    var def = GLOSS[key.toLowerCase()] || "";
    return '<span class="term" tabindex="0" data-def="' + esc(def) + '">' + esc(text || key) + "</span>";
  }

  /* Escape, then offer a line break after each slash and underscore so long
     identifiers and paths wrap at a sensible point on narrow screens. */
  function brk(s) { return esc(s).replace(/([\/_])/g, "$1<wbr>"); }

  // cols: [{h, r}], rows: arrays of cell html, or {cells, cls, attrs}.
  function table(cols, rows, opts) {
    opts = opts || {};
    var head = opts.noHead ? "" : "<thead><tr>" + cols.map(function (c) { return "<th" + (c.r ? ' class="r"' : "") + ">" + c.h + "</th>"; }).join("") + "</tr></thead>";
    var body = rows.map(function (row) {
      if (Array.isArray(row)) row = { cells: row };
      return "<tr" + (row.cls ? ' class="' + row.cls + '"' : "") + (row.attrs || "") + ">" + row.cells.map(function (c, i) {
        var col = cols[i] || {};
        return '<td data-label="' + esc(stripTags(col.h || "")) + '"' + (col.r ? ' class="r"' : "") + ">" + (c === null || c === undefined || c === "" ? "" : '<div class="cv">' + c + "</div>") + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="tbl-wrap"><table class="tbl' + (opts.stack === false ? "" : " stack") + (opts.cls ? " " + opts.cls : "") + '">' + head + "<tbody>" + body + "</tbody></table></div>";
  }
  function tabs(items, current, act) {
    return '<div class="tabs" role="tablist">' + items.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (current === t[0]) + '" data-act="' + act + '" data-arg="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
  }
  function seg(items, current, act, label) {
    return '<div class="seg" role="group" aria-label="' + esc(label) + '">' + items.map(function (t) {
      return '<button type="button" aria-pressed="' + (current === t[0]) + '" data-act="' + act + '" data-arg="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
  }
  function more(label, html, open) {
    return '<details class="more"' + (open ? " open" : "") + "><summary>" + esc(label) + '</summary><div class="more-body">' + html + "</div></details>";
  }
  function arith(lines) { return '<div class="arith">' + lines.map(esc).join("<br>") + "</div>"; }

  /* ------------------------------------------------------------ ledger lookup */

  var REFS = {};       // ref -> {ref, value, id, kind: "object"|"record"|"entry"}
  L.objects.forEach(function (o) { REFS[o.ref] = { ref: o.ref, value: o.value, id: o.id, kind: "object" }; });
  L.records.forEach(function (r) { REFS[r.ref] = { ref: r.ref, value: r.value, id: r.id, kind: r.ref === "D-CS04" ? "object" : "record" }; });
  L.entries.forEach(function (e) { REFS["E" + e.entry.seq] = { ref: "E" + e.entry.seq, value: e.entry, id: e.id, kind: "entry" }; });
  function idOf(ref) { return REFS[ref].id; }
  function shortId(id) { return id.slice(0, 7 + 12) + "\u2026"; }

  function idTok(ref, act) {
    var id = idOf(ref);
    return '<span class="idtok" title="' + esc(id) + '">' +
      '<button type="button" class="idtok-open" data-act="' + (act || "open-id") + '" data-arg="' + esc(ref) + '" aria-label="Open ' + esc(ref) + " " + esc(id) + '">' + esc(shortId(id)) + "</button>" +
      '<button type="button" class="idtok-copy" data-act="copy-id" data-arg="' + esc(id) + '" aria-label="Copy full id">Copy</button>' +
      '<span class="idtok-full" aria-hidden="true">' + esc(id) + "</span></span>";
  }

  /* -------------------------------------------------------- syntax highlight */

  var PY_TOKEN = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(#[^\n]*)|(@\w+)|\b(def|class|return|if|or|and|not|from|import|raise|None|True|False|is|in|else|elif|for|with|as|pass)\b|\b(\d[\d_]*)\b|\b([A-Za-z_]\w*)(?=\()/g;

  function pyTokens(text) {
    var out = [], last = 0, m;
    PY_TOKEN.lastIndex = 0;
    while ((m = PY_TOKEN.exec(text))) {
      if (m.index > last) out.push({ c: "", t: text.slice(last, m.index) });
      var cls = m[1] ? "s" : m[2] ? "c" : m[3] ? "d" : m[4] ? "k" : m[5] ? "n" : "f";
      out.push({ c: cls, t: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ c: "", t: text.slice(last) });
    return out;
  }

  // Returns an array of HTML strings, one per line.
  function pyLines(text) {
    var lines = [""];
    pyTokens(text.replace(/\n$/, "")).forEach(function (tok) {
      var parts = tok.t.split("\n");
      parts.forEach(function (p, i) {
        if (i > 0) lines.push("");
        if (p) lines[lines.length - 1] += tok.c ? '<span class="' + tok.c + '">' + esc(p) + "</span>" : esc(p);
      });
    });
    return lines;
  }

  // opts: {cls: {lineIndex: className}, notes: {lineIndex: text}, style, id, extra, from, to}
  function codeBlock(text, opts) {
    opts = opts || {};
    var lines = pyLines(text);
    var from = opts.from || 0, to = opts.to === undefined ? lines.length : opts.to;
    var html = "";
    for (var i = from; i < to; i++) {
      var cls = "ln" + (opts.cls && opts.cls[i] ? " " + opts.cls[i] : "");
      var note = opts.notes && opts.notes[i] ? ' data-note="' + esc(opts.notes[i]) + '"' : "";
      if (opts.style && opts.style[i]) note += ' style="' + opts.style[i] + '"';
      html += '<span class="' + cls + '" data-l="' + i + '"' + note + ">" + (lines[i] || " ") + "</span>";
    }
    return '<pre class="code' + (opts.extra ? " " + opts.extra : "") + '"' + (opts.id ? ' id="' + opts.id + '"' : "") + "><code>" + html + "</code></pre>";
  }
  function codeFile(path, right, text, opts) {
    return '<div class="code-head"><span class="path">' + esc(path) + "</span>" + (right ? "<span>" + right + "</span>" : "") + "</div>" + codeBlock(text, opts);
  }

  function diffBlock(rows) {
    var html = rows.map(function (r) {
      var cls = r.t === "+" ? "add" : r.t === "-" ? "del" : r.t === "@" ? "hunk" : "";
      var prefix = r.t === "@" ? "" : r.t + " ";
      return '<span class="ln ' + cls + '">' + esc(prefix + r.s) + "</span>";
    }).join("");
    return '<pre class="code"><code>' + html + "</code></pre>";
  }

  function jsonHtml(value) {
    var text = JSON.stringify(value, null, 2);
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+)/g;
    var out = "", last = 0, m;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      if (m[1]) out += '<span class="' + (m[2] ? "jk" : "js") + '">' + esc(m[1]) + "</span>" + (m[2] ? esc(m[2]) : "");
      else if (m[3]) out += '<span class="jl">' + m[3] + "</span>";
      else out += '<span class="jn">' + m[4] + "</span>";
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }

  function lineIndex(text, needle, start) {
    var lines = text.split("\n");
    for (var i = start || 0; i < lines.length; i++) if (lines[i].indexOf(needle) !== -1) return i;
    return -1;
  }

  /* ----------------------------------------------------------------- state */

  var S = { idx: 0, inner: 0, maxIdx: 0, done: {}, st: {}, busy: null, lastHash: "", ledgerSel: null };
  function st() { return S.st[SCREENS[S.idx].slug]; }

  /* --------------------------------------------------------- running tasks */

  // Runs a short progress bar, then applies the result. Skipped under reduced motion.
  function runTask(key, label, ms, done) {
    if (reducedMotion) { done(); return; }
    S.busy = { key: key, label: label, ms: ms, done: done };
    S.busy.timer = setTimeout(function () { finishBusy(true); }, ms);
  }
  function finishBusy(doRender) {
    var b = S.busy;
    if (!b) return;
    clearTimeout(b.timer); clearInterval(b.timer);
    S.busy = null;
    b.done();
    if (doRender) render();
  }
  function busyBar(key) {
    if (!S.busy || S.busy.key !== key) return "";
    return '<div class="progress" role="status"><span>' + esc(S.busy.label) + '</span><span class="progress-track"><span class="progress-fill" style="--ms:' + S.busy.ms + 'ms"></span></span>' +
      '<button type="button" class="linkish" data-act="skip">Skip</button></div>';
  }
  function isBusy(key) { return !!(S.busy && S.busy.key === key); }

  /* --------------------------------------------------------------- screens */

  var V = {};

  /* Overview */
  V.overview = {
    steps: [function () {}],
    reset: function () { return {}; },
    render: function () {
      return '<section class="block">' +
        '<h1 class="hero-quote">Developers write code at build time with proprietary LLMs. Regufinder makes that code run without them, owned by the company whose developers wrote it.</h1>' +
        '<p class="hero-sub">This tour follows one function in <code>acme-claims</code>, <code>route_claim()</code>, from a runtime model call to tested, signed code, and shows how the calls that still need a model are governed.</p>' +
        '<div class="row hero-actions"><button type="button" class="btn btn-primary" data-act="start">Start the tour</button>' +
        '<span class="muted small">Next and Back below, or the arrow keys.</span></div>' +
        '<div class="stats overview-stats">' +
        '<div class="stat"><b>6</b><span class="stat-label">runtime LLM ' + term("call site", "call sites") + " in <code>acme-claims</code></span></div>" +
        '<div class="stat"><b>48,000</b><span class="stat-label">model calls, week of ' + WEEK + "</span></div>" +
        '<div class="stat"><b>$1,800.00</b><span class="stat-label">model spend, week of ' + WEEK + "</span></div>" +
        "</div></section>" +
        '<section class="block"><h2>Two things on one substrate</h2>' +
        '<div class="pair"><div><h3>Compiler</h3><p>Turns the parts of a codebase that call an LLM at runtime into deterministic code the company owns.</p></div>' +
        "<div><h3>Runtime</h3><p>Governs what cannot be compiled.</p></div></div>" +
        '<p class="note">Both write to one policy source, one customer-owned ledger and one review-and-sign-off surface.</p></section>';
    }
  };

  /* Scan */
  V.scan = {
    reset: function () { return { scanned: false, traffic: false, view: "sites" }; },
    steps: [
      function () {},
      function (s, mode) {
        if (mode === "anim") runTask("scan", "Scanning 42 Python files", 1300, function () { s.scanned = true; });
        else s.scanned = true;
      },
      function (s) { s.scanned = true; s.traffic = true; }
    ],
    render: function (s) {
      if (!s.scanned) {
        return '<div class="empty"><p>Scan reads the repository and finds every place the code calls a model at runtime. The output is structural: file, line, function, model, prompt and coupling.</p>' +
          '<div class="row">' + (isBusy("scan") ? busyBar("scan") : '<button type="button" class="btn btn-primary" data-act="scan-run">Run scan</button>') + "</div></div>";
      }
      var head = '<div class="block-head"><p class="status-line ok">42 Python files scanned. 6 runtime LLM call sites found.</p>' +
        seg([["sites", "Call sites"], ["repo", "Repository"]], s.view, "scan-view", "View") + "</div>";
      if (s.view === "repo") {
        var tree = '<ul class="tree">' + D.tree.map(function (t) {
          var pad = '<span aria-hidden="true">' + new Array(t.depth + 1).join("&nbsp;&nbsp;&nbsp;&nbsp;") + "</span>";
          if (t.dir) return "<li>" + pad + '<span class="dirname">' + esc(t.path) + "</span></li>";
          if (t.cs) return "<li>" + pad + '<button type="button" data-act="scan-sel" data-arg="' + t.cs + '">' + esc(t.path) + '</button><span class="cs-tag">' + t.cs + "</span></li>";
          return "<li>" + pad + "<span>" + esc(t.path) + "</span>" + (t.note ? '<span class="note-inline">' + esc(t.note) + "</span>" : "") + "</li>";
        }).join("") + "</ul>";
        return head + tree + '<p class="note">Select a marked file to open its call-site record.</p>';
      }
      var cols = [{ h: "Call site" }, { h: "File and line" }, { h: "Model" }, { h: "Coupling" }];
      if (s.traffic) cols = cols.concat([{ h: "Calls per week", r: 1 }, { h: "Cost per call", r: 1 }, { h: "Spend per week", r: 1 }]);
      var rows = D.inventory.map(function (r) {
        var cells = ["<b>" + r.id + "</b> <code>" + esc(r.fn) + '</code><span class="sub">' + esc(r.what) + "</span>",
          '<code class="small">' + brk(r.file) + ":" + r.line + "</code>", '<code class="nowrap">' + r.model + "</code>", r.coupling];
        if (s.traffic) cells = cells.concat(['<span class="reveal-col">' + fmtInt(r.calls) + "</span>", '<span class="reveal-col">' + usd(r.costMicro, 3) + "</span>", '<span class="reveal-col">' + usd(r.calls * r.costMicro, 2) + "</span>"]);
        return { cells: cells, cls: "clickable", attrs: ' data-act="scan-sel" data-arg="' + r.id + '" tabindex="0"' };
      });
      if (s.traffic) rows.push({ cls: "total", cells: ["Total", "", "", "", fmtInt(sum(D.inventory, function (r) { return r.calls; })), "", usd(sum(D.inventory, function (r) { return r.calls * r.costMicro; }), 2)] });
      return head +
        '<div class="row gap-s" style="margin-bottom:var(--s5)"><label class="toggle"><input type="checkbox" data-act="scan-traffic"' + (s.traffic ? " checked" : "") + "> Add traffic from the gateway, week of " + WEEK + "</label></div>" +
        '<div id="inventory">' + table(cols, rows) + "</div>" +
        '<p class="note">Select a call site to open its record. Coupling is how tightly the call is tied to the origin model.</p>';
    },
    act: {
      "scan-run": function (s) { runTask("scan", "Scanning 42 Python files", 1300, function () { s.scanned = true; }); },
      "scan-traffic": function (s, arg, el) { s.traffic = el.checked; },
      "scan-view": function (s, arg) { s.view = arg; },
      "scan-sel": function (s, arg) { if (arg) openCallSiteModal(arg); return "nav"; }
    }
  };

  /* Entropy scoring */
  var BUCKET_X = function (bits) { return 60 + (bits / 4) * 760; };
  V.entropy = {
    reset: function () { return { sel: "CS-02", tab: "detail" }; },
    steps: [function () {}],
    render: function (s) {
      var markers = [
        { id: "CS-01", b: 0.02, lane: 0 }, { id: "CS-03", b: 0.0811, lane: 1 }, { id: "CS-02", b: 0.6125, lane: 0 },
        { id: "CS-05", b: 2.75, lane: 0 }, { id: "CS-04", b: 3.5, lane: 0 }
      ];
      var svg = '<svg viewBox="0 0 1000 180" role="group" aria-label="Entropy scale from 0 to 4 bits">' +
        '<rect class="zone-low" x="' + BUCKET_X(0) + '" y="66" width="' + (BUCKET_X(0.5) - BUCKET_X(0)) + '" height="48" rx="4"/>' +
        '<rect class="zone-mixed" x="' + BUCKET_X(0.5) + '" y="66" width="' + (BUCKET_X(2) - BUCKET_X(0.5)) + '" height="48"/>' +
        '<rect class="zone-open" x="' + BUCKET_X(2) + '" y="66" width="' + (BUCKET_X(4) - BUCKET_X(2)) + '" height="48"/>' +
        '<text class="zone-label" x="' + BUCKET_X(0.25) + '" y="140" text-anchor="middle">low</text>' +
        '<text class="zone-label" x="' + BUCKET_X(1.25) + '" y="140" text-anchor="middle">mixed</text>' +
        '<text class="zone-label" x="' + BUCKET_X(3) + '" y="140" text-anchor="middle">open</text>' +
        '<line class="axis" x1="' + BUCKET_X(0) + '" x2="' + BUCKET_X(4) + '" y1="114" y2="114"/>';
      [0, 1, 2, 3, 4].forEach(function (t) {
        svg += '<line class="axis" x1="' + BUCKET_X(t) + '" x2="' + BUCKET_X(t) + '" y1="114" y2="120"/><text x="' + BUCKET_X(t) + '" y="172" text-anchor="middle">' + t + (t === 4 ? " bits" : "") + "</text>";
      });
      svg += '<line class="thr" x1="' + BUCKET_X(0.5) + '" x2="' + BUCKET_X(0.5) + '" y1="24" y2="122"/><text x="' + BUCKET_X(0.5) + '" y="14" text-anchor="middle">threshold 0.5</text>';
      svg += '<line class="thr" x1="' + BUCKET_X(2) + '" x2="' + BUCKET_X(2) + '" y1="24" y2="122"/><text x="' + BUCKET_X(2) + '" y="14" text-anchor="middle">threshold 2</text>';
      markers.forEach(function (m) {
        var x = BUCKET_X(m.b), y = m.lane ? 102 : 84;
        svg += '<g class="marker' + (s.sel === m.id ? " sel" : "") + '" tabindex="0" role="button" aria-label="' + m.id + ", " + m.b + ' bits" data-act="ent-sel" data-arg="' + m.id + '">' +
          '<circle cx="' + x + '" cy="' + y + '" r="7"/><text x="' + (x + (m.lane ? 12 : 0)) + '" y="' + (m.lane ? y + 5 : y - 30) + '" text-anchor="' + (m.lane ? "start" : "middle") + '">' + m.id + "</text></g>";
      });
      svg += '<g class="marker' + (s.sel === "CS-06" ? " sel" : "") + '" tabindex="0" role="button" aria-label="CS-06, not scored" data-act="ent-sel" data-arg="CS-06">' +
        '<circle cx="910" cy="84" r="7" style="stroke-dasharray:3 2"/><text x="910" y="54" text-anchor="middle">CS-06</text></g>' +
        '<text x="910" y="140" text-anchor="middle">not scored,</text><text x="910" y="158" text-anchor="middle">no traffic</text></svg>';

      var sel = invRow(s.sel);
      var body;
      if (s.tab === "all") {
        body = table([{ h: "Call site" }, { h: "Classes" }, { h: "Score (bits)", r: 1 }, { h: "Bucket" }, { h: "Plan" }],
          D.entropySummary.map(function (r) {
            return { cls: "clickable" + (s.sel === r.id ? " selected" : ""), attrs: ' data-act="ent-sel" data-arg="' + r.id + '" tabindex="0"',
              cells: ["<b>" + r.id + "</b>", esc(r.classes), r.score === null ? "not scored" : String(r.score), '<span class="bucket-' + r.bucket + '">' + r.bucket + "</span>", esc(r.plan)] };
          }));
      } else {
        body = this.classes(s.sel);
      }
      return '<div class="block"><div class="scale">' + svg + '</div><p class="small muted scale-hint">Swipe the scale sideways to see 2 to 4 bits.</p></div>' +
        '<div class="block" id="ent-classes">' + tabs([["detail", s.sel + " <code>" + esc(sel.fn) + "</code>"], ["all", "All call sites"]], s.tab, "ent-tab") + body +
        more("How the score is computed", "<p>Group inputs into equivalence classes, canonicalise and cluster the outputs, compute the entropy of the output within each class, average by traffic. Entropy of a distribution p is H = minus the sum of p x log2(p). Unit: bits.</p>" +
          "<p>Below 0.5 a call site is low and compiles whole. Between 0.5 and 2 it is mixed and its determined branches compile. Above 2 it is open and stays agentic.</p>") +
        "</div>";
    },
    classes: function (id) {
      var row = D.entropySummary.filter(function (r) { return r.id === id; })[0];
      if (id === "CS-02") {
        var routes = ["FAST_TRACK", "ADJUSTER", "INJURY_TEAM", "FRAUD_REVIEW"];
        var rows = D.cs02Classes.map(function (c) {
          var bar = '<div class="sbar">' + routes.filter(function (k) { return c.outputs[k]; }).map(function (k) {
            return '<span class="r-' + k + '" style="width:' + (c.outputs[k] * 100 / c.traces) + '%" title="' + k + " " + fmtInt(c.outputs[k]) + " of " + fmtInt(c.traces) + '"></span>';
          }).join("") + "</div>";
          var outs = Object.keys(c.outputs).map(function (k) { return '<span class="route">' + k + "</span> " + fmtInt(c.outputs[k]); }).join(", ");
          return ["<b>" + c.cls + "</b>", esc(c.def), fmtInt(c.traces), per100(c.sharePer100), "<div>" + bar + '<span class="sub">' + outs + "</span></div>", String(c.h), String(c.shareH)];
        });
        rows.push({ cls: "total", cells: ["Total", "", "12,000", "1.00", "", "", "0.6125"] });
        return '<div class="row spread" style="margin-bottom:var(--s5)"><p class="muted small" style="margin:0">Classes from 12,000 traces.</p>' +
          '<div class="legend" style="margin:0">' + routes.map(function (k) { return '<span><i class="r-' + k + '"></i>' + k + "</span>"; }).join("") + "</div></div>" +
          table([{ h: "Class" }, { h: "Definition (typed features)" }, { h: "Traces", r: 1 }, { h: "Share", r: 1 }, { h: "Historical outputs" }, { h: "H (bits)", r: 1 }, { h: "Share x H", r: 1 }], rows) +
          '<div class="row gap"><span class="formula">0.35 x 1.75 = 0.6125 bits</span> <span class="bucket-mixed">mixed</span></div>' +
          '<p class="note">Class E: shares 0.5, 0.25, 0.125, 0.125. H = 0.5 x 1 + 0.25 x 2 + 0.125 x 3 + 0.125 x 3 = 1.75 bits. Determined share of traffic: 0.65 (7,800 traces). Undetermined: 0.35 (4,200 traces).</p>';
      }
      if (id === "CS-06") {
        return '<p class="prose">No traffic in the week. Not scored. Plan: retire.</p>';
      }
      var oc = D.otherClasses[id];
      var trs = oc.rows.map(function (c) {
        var total = sum(c.outputs, function (x) { return x; });
        var bar = '<div class="sbar">' + c.outputs.map(function (w) { return '<span class="r-cluster" style="width:' + (w * 100 / total) + '%"></span>'; }).join("") + "</div>";
        return [esc(c.name), per100(c.share), bar, String(c.h)];
      });
      return table([{ h: "Class" }, { h: "Share of traffic", r: 1 }, { h: "Output clusters" }, { h: "H (bits)", r: 1 }], trs) +
        '<div class="row gap"><span class="formula">' + esc(oc.arithmetic) + '</span> <span class="bucket-' + row.bucket + '">' + row.bucket + "</span></div>" +
        (row.bucket === "low" ? '<p class="note">In the low bucket the small leftover variation is treated as model noise: the developers\' skeleton fixes one answer for those inputs.</p>' : "");
    },
    act: {
      "ent-sel": function (s, arg) { s.sel = arg; s.tab = "detail"; s.focus = "#ent-classes"; },
      "ent-tab": function (s, arg) { s.tab = arg; }
    }
  };

  /* Audit report */
  function auditNumbers() {
    var calls = sum(D.inventory, function (r) { return r.calls; });
    var spend = sum(D.inventory, function (r) { return r.calls * r.costMicro; });
    var qualCalls = 12000 + 12000 + (12000 * 65) / 100;
    var qualSpend = 48000000 + 360000000 + (600000000 * 65) / 100;
    var cands = D.candidates.map(function (c) {
      var r = invRow(c.id);
      var shadow = (r.costMicro * D.shadowPer100) / 100;
      var net = ((r.costMicro - shadow) * c.compiledPer100) / 100;
      return { c: c, oneOff: c.genMicro + c.regenMicro, net: net, breakEven: Math.ceil((c.genMicro + c.regenMicro) / net), weekly: r.calls * net };
    });
    return { calls: calls, spend: spend, qualCalls: qualCalls, qualSpend: qualSpend, cands: cands,
      totalWeekly: sum(cands, function (x) { return x.weekly; }) };
  }
  function auditSections(s, compact) {
    var a = auditNumbers();
    var sec1 = '<div class="stats">' +
      '<div class="stat"><b>' + pct(a.qualCalls, a.calls, 2) + '</b><span class="stat-label">of calls qualify (' + fmtInt(a.qualCalls) + " of " + fmtInt(a.calls) + ')</span><div class="sbar"><span class="b-code" style="width:' + (a.qualCalls * 100 / a.calls) + '%"></span></div></div>' +
      '<div class="stat"><b>' + pct(a.qualSpend, a.spend, 2) + '</b><span class="stat-label">of spend qualifies (' + usd(a.qualSpend) + " of " + usd(a.spend) + ' a week)</span><div class="sbar"><span class="b-code" style="width:' + (a.qualSpend * 100 / a.spend) + '%"></span></div></div></div>' +
      '<p class="note">$1,800.00 a week is $7,800.00 a month.</p>';
    var rows = a.cands.map(function (x) {
      return [String(x.c.rank), "<b>" + x.c.id + "</b> <code>" + x.c.fn + "</code>", usd(x.c.genMicro) + " + " + usd(x.c.regenMicro) + " = " + usd(x.oneOff), usd(x.net, 2), String(x.breakEven), usd(x.weekly)];
    });
    rows.push({ cls: "total", cells: ["", "Total", "", "", "", usd(a.totalWeekly)] });
    var sec2 = table([{ h: "Rank" }, { h: "Call site" }, { h: "One-off model cost (generation + one regeneration)", r: 1 }, { h: "Net saving per transaction", r: 1 }, { h: "Break-even transactions", r: 1 }, { h: "Estimated weekly saving", r: 1 }], rows) +
      '<p class="note">Model costs only. Developer time, the build fee and the maintenance subscription are not included.</p>';
    var sec3 = '<div class="tiles">' + a.cands.map(function (x, i) {
      var open = compact || (s.tiles && s.tiles[i]);
      var inner = '<span class="small muted">' + x.c.id + " <code>" + x.c.fn + "</code></span><b>" + x.breakEven + '</b><span class="small">transactions to break even</span>' +
        (open ? '<span class="formula">' + esc(x.c.breakLine) + "</span>" : '<span class="small" style="color:var(--brand);margin-top:var(--s2)">Show the formula</span>');
      if (compact) return '<div class="tile" style="cursor:default">' + inner + "</div>";
      return '<button type="button" class="tile" data-act="audit-tile" data-arg="' + i + '" aria-expanded="' + !!open + '">' + inner + "</button>";
    }).join("") + "</div>";
    var sec4 = '<div class="statebar" aria-label="6 origin-locked"><span class="s-0" style="width:100%">6 origin-locked</span></div>' +
      '<div class="legend"><span><i class="s-0"></i>origin-locked 6</span><span><i class="s-1"></i>portable 0</span><span><i class="s-2"></i>compiled 0</span><span><i class="s-3"></i>retired 0</span></div>';
    if (compact) return { sec1: sec1, sec2: sec2, sec3: sec3, sec4: sec4 };

    sec1 += more("Show the arithmetic", arith([
      "Calls that qualify: 12,000 (CS-01) + 12,000 (CS-03) + 7,800 (CS-02) = 31,800 of 48,000 = 66.25%.",
      "Spend that qualifies: 48.00 + 360.00 + (0.65 x 600.00 = 390.00) = $798.00 of $1,800.00 = 44.33%.",
      "Monthly equivalent: 1,800 x 52 / 12 = $7,800.",
      "Rule: a low call site qualifies whole, a mixed one for its determined share, an open one not at all."
    ]));
    sec2 += more("Show the arithmetic", arith(a.cands.map(function (x) { return x.c.id + ": net " + x.c.saveLine + ". Weekly " + x.c.weekLine + "."; }).concat([
      "Total estimated weekly saving: 382.20 + 352.80 + 47.04 = $782.04.",
      "Shadow sampling: after compiling, 2% of compiled-path transactions still go to the model so the decay monitor can compare. That costs 2% of the per-call cost on those transactions."
    ])));
    sec3 += more("Show the arithmetic", arith(a.cands.map(function (x) { return x.c.id + ": " + x.c.breakLine; }).concat(["Break-even transactions are rounded up to the next whole transaction."])));
    return { sec1: sec1, sec2: sec2, sec3: sec3, sec4: sec4 };
  }
  V.audit = {
    reset: function () { return { tiles: {} }; },
    steps: [function () {}],
    render: function (s) {
      var x = auditSections(s, false);
      return '<article class="sheet">' +
        '<p class="report-meta">Audit report for <code>acme-claims</code>, week of ' + WEEK + ".</p>" +
        '<section class="report-sec"><h2>Share that qualifies</h2>' + x.sec1 + "</section>" +
        '<section class="report-sec"><h2>Top three candidates</h2>' + x.sec2 + "</section>" +
        '<section class="report-sec"><h2>Break-even each</h2>' + x.sec3 + "</section>" +
        '<section class="report-sec"><h2>Burn-down starting position</h2>' + x.sec4 + "</section>" +
        "</article>" +
        '<div class="row gap"><button type="button" class="btn btn-primary" data-act="audit-pilot">Start with CS-02</button></div>';
    },
    act: {
      "audit-tile": function (s, arg) { s.tiles[arg] = !s.tiles[arg]; },
      "audit-pilot": function () { goGuided(slugIndex("skeleton"), 0, "anim"); return "nav"; }
    }
  };

  /* Skeleton */
  V.skeleton = {
    reset: function () { return { tab: "files", inv: null }; },
    steps: [function () {}],
    render: function (s) {
      var text = REFS.A1.value.text;
      var body;
      if (s.tab === "files") {
        body = '<div class="code-aside"><div>' + codeFile("claims/intake/triage_skeleton.py", "Human-authored. Signed on adoption.", text, { id: "skeleton-code" }) + "</div>" +
          '<div><h3 style="margin-bottom:var(--s3)">' + term("invariant", "Invariants") + '</h3><ul class="inv-list">' + D.invariants.map(function (v) {
            return '<li tabindex="0" data-inv="' + v.id + '"><b>' + v.id + "</b>" + esc(v.text) + "</li>";
          }).join("") + "</ul></div></div>";
      } else if (s.tab === "tests") {
        body = '<p class="muted small"><code>' + brk("tests/intake/test_triage_skeleton.py") + '</code></p><ul class="test-list prose">' +
          D.skeletonTests.map(function (t) { return "<li><code>" + brk(t.name) + "</code><span>" + esc(t.meaning) + "</span></li>"; }).join("") + "</ul>";
      } else if (s.tab === "edit") {
        body = '<p class="prose">The drafted skeleton did not have INV-3. The developers added it, with a typed field for it.</p>' + diffBlock(D.developerDiff) +
          '<div class="comment"><div class="who">dev-1@acme.example and dev-2@acme.example</div>Windscreens with driver-assist cameras need recalibration. Claims has always wanted an adjuster to see these.</div>';
      } else {
        body = '<ul class="lines"><li>The skeleton is human-authored.</li><li>Copyright attaches to the human-authored skeleton only, since purely generated output may carry none.</li><li>The contract assigns the rest to the customer. Counsel confirms before any customer-facing claim.</li></ul>';
      }
      return '<div class="pr-head"><span class="pr-state">Open</span><h2>PR #214: ' + term("skeleton", "Skeleton") + " for route_claim (CS-02)</h2></div>" +
        '<p class="pr-meta">Drafted by the regufinder CLI from the scan and the traces. Edited by dev-1 and dev-2. Record ' + idTok("R3") + "</p>" +
        tabs([["files", "Skeleton"], ["tests", "Tests"], ["edit", "Developer edit"], ["why", "Why a person writes this"]], s.tab, "sk-tab") + body;
    },
    act: { "sk-tab": function (s, arg) { s.tab = arg; } },
    hover: function (s, el, on) {
      var li = el.closest("[data-inv]");
      if (!li) return;
      var text = REFS.A1.value.text, inv = li.getAttribute("data-inv");
      var i = lineIndex(text, "      " + inv + "  ");
      var code = byId("skeleton-code");
      if (!code) return;
      [i, inv === "INV-2" ? i + 1 : -1].forEach(function (k) {
        var ln = code.querySelector('[data-l="' + k + '"]');
        if (ln) ln.classList.toggle("hl", on);
      });
    }
  };

  /* Compile */
  var A3 = REFS.A3.value.text;
  function branchLines(text) {
    return D.compiledPaths.map(function (p) {
      var start = lineIndex(text, "def route_claim");
      var cond = p.line ? lineIndex(text, p.line, start) : -1;
      var ret = lineIndex(text, p.ret, cond >= 0 ? cond : lineIndex(text, "return Route.FAST_TRACK", start) + 1);
      return { cond: cond, ret: ret };
    });
  }
  var BRANCHES = branchLines(A3);
  V.compile = {
    reset: function () {
      return { compiled: false, view: "before", tab: "paths", hover: null, tryc: { amount: "3200.00", injury_reported: false, third_party_involved: true, needs_recalibration: false, policy_age_days: 412, claims_last_12_months: 0 } };
    },
    steps: [function () {}],
    nextAction: function (s) { if (!s.compiled) { this.act["compile-run"](s); return true; } return false; },
    complete: function (s) { s.compiled = true; s.view = "compiled"; },
    render: function (s) {
      var before = REFS.A0.value.text;
      var skel = REFS.A1.value.text;
      var skStart = lineIndex(skel, "def route_claim");
      var busy = isBusy("compile");
      var view = busy ? "compiled" : s.view;
      var shown;
      if (view === "before") shown = codeFile("claims/intake/triage.py", "The call site as found", before);
      else if (view === "skeleton") shown = codeFile("claims/intake/triage_skeleton.py", "Signature and invariants, human-authored", skel, { from: skStart });
      else if (!s.compiled && !busy) {
        shown = '<div class="empty"><p>The compiled module is generated from the skeleton and the 12,000 corpus traces.</p><div class="row"><button type="button" class="btn btn-primary" data-act="compile-run">Compile</button></div></div>';
      } else {
        var cls = {}, style = {};
        BRANCHES.forEach(function (b, i) {
          if (b.cond >= 0) style[b.cond] = "animation-delay:" + i * 200 + "ms";
          style[b.ret] = "animation-delay:" + (i * 200 + 80) + "ms";
          if (b.cond >= 0) cls[b.cond] = "branch"; cls[b.ret] = "branch";
        });
        shown = busy ? codeFile("claims/intake/triage_generated.py", "run: 2", A3, { cls: cls, style: style, extra: "filling", id: "compiled-code" }) + busyBar("compile")
          : codeFile("claims/intake/triage_generated.py", 'run: 2 <button type="button" class="linkish" data-act="goto" data-arg="gates">Why run 2?</button>', A3, { id: "compiled-code" });
      }
      var top = '<div class="row" style="margin-bottom:var(--s5)">' + seg([["before", "Before"], ["skeleton", "Skeleton"], ["compiled", "Compiled"]], view, "compile-view", "Code view") +
        (!s.compiled && !busy && view !== "compiled" ? '<button type="button" class="btn btn-primary" data-act="compile-run">Compile</button>' : "") + "</div>";
      var lower = "";
      if (s.compiled) {
        var body;
        if (s.tab === "paths") {
          var rows = D.compiledPaths.map(function (p, i) {
            return { attrs: ' data-branch="' + i + '"', cells: ["<code>" + esc(p.line || "otherwise") + "</code>", p.inv || "none", p.classes.join(", "), fmtInt(p.traces),
              p.kind === "code" ? '<span class="badge pass">decided by code</span>' : '<span class="badge esc">escalates</span>'] };
          });
          rows.push({ cls: "total", cells: ["Decided by code", "", "", "7,800", ""] });
          rows.push({ cls: "total", cells: ["Escalates", "", "", "4,200", ""] });
          body = '<div class="meter" style="max-width:36rem;margin:0 0 var(--s6)"><div class="sbar tall"><span class="b-code" style="width:65%"></span><span class="b-esc" style="width:35%"></span></div><div class="meter-labels"><span>65% decided by code</span><span>35% escalates</span></div></div>' +
            table([{ h: "Branch" }, { h: "Invariant" }, { h: "From class" }, { h: "Traces", r: 1 }, { h: "Outcome" }], rows) +
            '<p class="note">Paths on the 12,000 ' + term("corpus", "corpus") + " traces. The 12 recalibration traces are inside class A, where history routed them to FAST_TRACK. Hover a row to see its lines.</p>";
        } else if (s.tab === "try") {
          var t = s.tryc;
          body = '<p class="prose">Runs the six-line function in your browser. An escalating input does not invent a model answer.</p>' +
            '<div class="row"><button type="button" class="btn" data-act="try-preset" data-arg="escalate">CLM-2027-104417</button><button type="button" class="btn" data-act="try-preset" data-arg="code">CLM-2027-104418</button></div>' +
            '<form class="try-form" id="try-form" onsubmit="return false">' +
            '<label>Amount<input type="number" step="0.01" min="0" name="amount" value="' + esc(t.amount) + '"></label>' +
            '<label>Policy age in days<input type="number" step="1" min="0" name="policy_age_days" value="' + t.policy_age_days + '"></label>' +
            '<label>Claims in the last 12 months<input type="number" step="1" min="0" name="claims_last_12_months" value="' + t.claims_last_12_months + '"></label>' +
            '<label class="chk"><input type="checkbox" name="injury_reported"' + (t.injury_reported ? " checked" : "") + "> Injury reported</label>" +
            '<label class="chk"><input type="checkbox" name="third_party_involved"' + (t.third_party_involved ? " checked" : "") + "> Third party involved</label>" +
            '<label class="chk"><input type="checkbox" name="needs_recalibration"' + (t.needs_recalibration ? " checked" : "") + "> Needs recalibration</label>" +
            '</form><div id="try-result" aria-live="polite" style="max-width:46rem">' + tryResult(t) + "</div>";
        } else {
          body = '<div class="facts"><div><h3>Quarantine</h3><p>12,000 traces typed, 0 raw free-text fields reached the generator.</p></div>' +
            "<div><h3>Regenerate, never edit</h3><p>Generated modules are marked and regenerated, never hand-edited. A CI check enforces it.</p></div></div>" +
            '<p class="note">Record for this module ' + idTok("R7") + "</p>";
        }
        lower = '<div class="block">' + tabs([["paths", "Paths"], ["try", "Try a claim"], ["guards", "Guarantees"]], s.tab, "compile-tab") + body + "</div>";
      }
      return top + '<div class="block">' + shown + "</div>" + lower;
    },
    act: {
      "compile-view": function (s, arg) { s.view = arg; },
      "compile-tab": function (s, arg) { s.tab = arg; },
      "compile-run": function (s) {
        s.view = "compiled";
        runTask("compile", "Filling six branches from the traces", 1400, function () { s.compiled = true; });
      },
      "try-preset": function (s, arg) {
        var c = D.claims[arg];
        s.tryc = { amount: fmtMicro(c.amount_cents * 10000, 2).replace(/,/g, ""), injury_reported: c.injury_reported, third_party_involved: c.third_party_involved,
          needs_recalibration: c.needs_recalibration, policy_age_days: c.policy_age_days, claims_last_12_months: c.claims_last_12_months };
      }
    },
    hover: function (s, el, on) {
      var tr = el.closest("[data-branch]");
      if (!tr) return;
      var i = +tr.getAttribute("data-branch");
      tr.classList.toggle("hov", on);
      var code = byId("compiled-code"); if (!code) return;
      var b = BRANCHES[i], k = D.compiledPaths[i].kind === "escalate" ? "hl-esc" : "hl";
      [b.cond, b.ret].forEach(function (l) { var ln = code.querySelector('[data-l="' + l + '"]'); if (ln) ln.classList.toggle(k, on); });
    }
  };
  function tryResult(t) {
    var amount = Math.round(parseFloat(t.amount || "0") * 100);
    var claim = { amount_cents: isNaN(amount) ? 0 : amount, injury_reported: !!t.injury_reported, third_party_involved: !!t.third_party_involved,
      needs_recalibration: !!t.needs_recalibration, policy_age_days: parseInt(t.policy_age_days, 10) || 0, claims_last_12_months: parseInt(t.claims_last_12_months, 10) || 0 };
    var r = D.routeClaim(claim);
    var p = D.compiledPaths[r.branch];
    var branch = "Branch " + (r.branch + 1) + ": <code>" + esc(p.line || "otherwise") + "</code>" + (p.inv ? " (" + p.inv + ")" : "");
    if (r.escalate) return '<div class="result-line esc">Escalates to the Runtime. ' + branch + "</div>";
    return '<div class="result-line by-code">Decided by code: <span class="route">' + r.route + "</span>. " + branch + ". No model call.</div>";
  }

  /* Test twice */
  V.tests = {
    reset: function () { return { ran: false, diffs: false, part: null, tab: "eq" }; },
    steps: [
      function (s, mode) {
        if (mode === "anim" && !s.ran) runTask("tests", "Running both tests on 12,000 traces and 230 cases", 1400, function () { s.ran = true; });
        else s.ran = true;
        s.tab = "eq";
      },
      function (s, mode) { s.ran = true; s.diffs = true; s.tab = "eq"; if (mode !== "silent") s.focus = "#diffs"; },
      function (s, mode) { s.ran = true; s.diffs = true; s.tab = "acc"; if (mode !== "silent") s.focus = "#test-tabs"; }
    ],
    render: function (s) {
      if (!s.ran) {
        return '<div class="empty"><p>Both tests run against the run 2 module: equivalence on the 12,000 corpus traces, and accuracy on the 230 cases of the ' + term("Verification Set", "Verification Set") + ".</p>" +
          '<div class="row">' + (isBusy("tests") ? busyBar("tests") : '<button type="button" class="btn btn-primary" data-act="tests-run">Run both tests</button>') + "</div></div>";
      }
      var stats = '<div class="stats">' +
        '<div class="stat good"><b>99.85%</b><span class="stat-label">Test 1: ' + term("equivalence test", "equivalence") + " to history. 7,788 of 7,800 decided traces match.</span></div>" +
        '<div class="stat good"><b>120 of 120</b><span class="stat-label">Test 2: ' + term("accuracy test", "accuracy") + " against the Verification Set. Mismatches: 0.</span></div></div>" +
        '<p class="lede gap" style="font-size:1.05rem">Test 1 asks: does the code do what the model did? Test 2 asks: is that right? Here history was wrong on one pattern, and the second test is what shows the code is right to differ.</p>';
      var body;
      if (s.tab === "eq") {
        body = '<div class="meter" style="max-width:40rem;margin-top:0"><div class="sbar tall"><span class="b-code" style="width:' + (7788 * 100 / 7800) + '%" title="7,788 equal to history"></span>' +
          '<button type="button" class="slice-btn b-diff" style="width:max(6px,' + (12 * 100 / 7800) + '%)" data-act="tests-diffs" aria-label="Show the 12 differences" title="12 different from history"></button></div>' +
          '<div class="meter-labels"><span>7,788 equal to history</span><span>12 different</span></div></div>' +
          '<div class="gap">' + table([{ h: "Measure" }, { h: "Value", r: 1 }], [
            ["Traces in corpus", "12,000"], ["Decided by compiled code", "7,800"], ["Escalated (not compared, handled by the Runtime)", "4,200"],
            ["Decided and equal to history", "7,788"], ["Decided and different from history", "12"],
            { cls: "total", cells: ["Equivalence on decided traces", "7,788 / 7,800 = " + pct(7788, 7800, 2)] }], { cls: "kvt", stack: false }) + "</div>";
        if (s.diffs) {
          body += '<div class="diff-list" id="diffs"><h3 style="margin-bottom:var(--s3)">The 12 differences</h3>' +
            '<div class="diff-row"><b>CLM-2027-031877</b>: amount 620.00, no injury, no third party, needs recalibration. History <span class="route">FAST_TRACK</span>. Compiled <span class="route">ADJUSTER</span>. Rule INV-3.</div>' +
            '<div class="diff-row">11 more with the same cause.</div>' +
            '<div class="diff-row">All 12 are windscreen claims with <code>needs_recalibration = true</code>. Cause: INV-3, written by the developers. Status: explained by an invariant, confirmed by the accuracy test.</div></div>';
        } else {
          body += '<div class="row gap"><button type="button" class="btn" data-act="tests-diffs">Show the 12 differences</button></div>';
        }
        body += '<p class="note">Record ' + idTok("R8") + "</p>";
      } else if (s.tab === "acc") {
        var rows = D.vsParts.map(function (p) {
          return { cls: "clickable", attrs: ' data-act="tests-part" data-arg="' + p.key + '" tabindex="0"', cells: [esc(p.part), String(p.cases), String(p.decided), String(p.escalated)] };
        });
        rows.push({ cls: "total", cells: ["Total", "230", "120", "110"] });
        body = table([{ h: "Part" }, { h: "Cases", r: 1 }, { h: "Decided by code", r: 1 }, { h: "Escalated", r: 1 }], rows) +
          '<p class="note">Labelled by the workflow owner: Head of Claims Operations, claims-owner@acme.example. About 30 cases to discover failure modes, then about 100 per mode to validate. The 110 escalated cases are not errors; they go to the Runtime and are recorded. Pass rule: zero mismatches on decided cases. Select a part to see its cases.</p>' +
          '<p class="note">Record ' + idTok("R9") + "</p>";
      } else {
        var cases = D.vsCases.filter(function (c) { return !s.part || c.part === s.part; });
        body = (s.part ? '<div class="row" style="margin-bottom:var(--s4)"><span class="muted small">Showing ' + (s.part === "D" ? "Discovery" : s.part === "M1" ? "Mode 1" : "Mode 2") + '</span><button type="button" class="linkish small" data-act="tests-part" data-arg="">Show all</button></div>' : "") +
          table([{ h: "Case" }, { h: "Part" }, { h: "Features in brief" }, { h: "Owner label" }, { h: "Code result" }, { h: "Status" }], cases.map(function (c) {
            var part = c.part === "D" ? "Discovery" : c.part === "M1" ? "Mode 1" : "Mode 2";
            return ["<code>" + c.id + "</code>", part, esc(c.brief), '<span class="route">' + c.owner + "</span>", '<span class="route">' + c.code + "</span>",
              c.status === "Match" ? '<span class="badge pass">Match</span>' : '<span class="badge esc">Escalated</span>'];
          }));
      }
      return stats + '<div class="block" id="test-tabs">' + tabs([["eq", "Equivalence to history"], ["acc", "Accuracy on the Verification Set"], ["cases", "Cases"]], s.tab, "tests-tab") + body + "</div>";
    },
    act: {
      "tests-run": function (s) { runTask("tests", "Running both tests on 12,000 traces and 230 cases", 1400, function () { s.ran = true; }); },
      "tests-diffs": function (s) { s.diffs = !s.diffs; if (s.diffs) s.focus = "#diffs"; },
      "tests-part": function (s, arg) { s.part = arg || null; s.tab = "cases"; },
      "tests-tab": function (s, arg) { s.tab = arg; }
    }
  };

  /* Security gates */
  V.gates = {
    reset: function () { return { run: 1 }; },
    steps: [
      function (s) { s.run = 1; },
      function (s) { s.run = 2; }
    ],
    render: function (s) {
      var run = D.gateRuns[s.run];
      var rows = run.gates.map(function (g) {
        var b = g.result === "pass" ? '<span class="badge pass">Pass</span>' : g.result === "fail" ? '<span class="badge fail">Fail</span>' : '<span class="badge notrun">Not run</span>';
        return ["<b>" + g.gate + "</b>", b, esc(g.detail)];
      });
      var status = '<div class="block-head"><div><p class="gate-status ' + (s.run === 1 ? "bad" : "good") + '">' + (s.run === 1 ? "PR blocked" : "All gates passed") + "</p>" +
        '<p class="muted small" style="margin:0">Module run ' + s.run + ". Record " + idTok(run.record) + "</p></div></div>";
      var body = status + table([{ h: "Gate" }, { h: "Result" }, { h: "Detail" }], rows);
      var action = "<h3>Regenerated with the allow-list as a constraint. Not edited by hand.</h3>" +
        '<p class="prose" style="margin-top:var(--s2);color:var(--ink-2)">Generated modules are never edited by hand. The module was regenerated with the allow-list as a constraint. Regenerate-not-edit CI check: <span class="badge pass">Pass</span></p>';
      if (s.run === 1) {
        var a2 = REFS.A2.value.text, bad = lineIndex(a2, "from pydantic");
        var cls = {}; cls[bad] = "hl-bad";
        body += '<div class="block"><h2>The offending import</h2>' + codeFile("claims/intake/triage_generated.py", "run: 1", a2, { cls: cls, from: 0, to: bad + 2 }) + "</div>" +
          '<div class="block">' + action + '<div class="row gap-s"><button type="button" class="btn" data-act="gate-run" data-arg="2">See run 2</button></div></div>';
      } else {
        body += '<div class="block">' + action + "</div>";
      }
      return '<div class="row" style="margin-bottom:var(--s6)">' + seg([["1", "Run 1"], ["2", "Run 2"]], String(s.run), "gate-run", "Gate run") +
        '<span class="muted small">Four ' + term("security gates", "security gates") + ". Findings are written to the ledger.</span></div>" + body;
    },
    act: { "gate-run": function (s, arg) { s.run = +arg; } }
  };

  /* Review by diff and sign */
  V.sign = {
    reset: function () { return { signed: false, changed: false }; },
    steps: [function () {}],
    nextAction: function (s) { if (!s.signed) { this.act["sign-do"](s); return true; } return false; },
    complete: function (s) { s.signed = true; },
    render: function (s) {
      var files = '<ul class="files">' + D.diffFiles.map(function (f) {
        return '<li><span class="mk ' + f.mark + '">' + f.mark + "</span><span><code>" + brk(f.path) + '</code><span class="note-s">' + esc(f.note) + "</span></span></li>";
      }).join("") + "</ul>";
      var evidence = '<ul class="evidence">' +
        "<li><span>Equivalence</span><span>" + idTok("R8") + ' <span class="badge pass">Pass</span></span></li>' +
        "<li><span>Accuracy</span><span>" + idTok("R9") + ' <span class="badge pass">Pass</span></span></li>' +
        "<li><span>Gates</span><span>" + idTok("R10") + ' <span class="badge pass">Passed</span></span></li></ul>';
      var card;
      if (!s.signed) {
        card = '<div class="sigcard unsigned" id="sigcard"><p class="sig-state">Awaiting signature</p>' +
          '<p class="muted">Adopter: claims-owner@acme.example (Head of Claims Operations).</p>' +
          '<div class="row gap-s">' + (isBusy("sign") ? busyBar("sign") : '<button type="button" class="btn btn-primary" data-act="sign-do">Sign as Head of Claims Operations</button>') + "</div></div>";
      } else {
        card = '<div class="sigcard ' + (s.changed ? "expired" : "valid") + '" id="sigcard"><p class="sig-state">' + (s.changed ? "Expired: the signed object changed" : "Valid") + "</p>" +
          '<p class="muted small" style="margin:0">' + term("rule-adoption signature", "Rule-adoption signature") + ". Expires when the skeleton or the generated module changes.</p>" +
          '<dl class="kv"><dt>Authors</dt><dd>dev-1@acme.example, dev-2@acme.example</dd><dt>Adopter</dt><dd>claims-owner@acme.example (Head of Claims Operations)</dd>' +
          "<dt>Skeleton</dt><dd>" + idTok("R3") + "</dd><dt>Module</dt><dd>" + idTok("R7") + "</dd><dt>Record</dt><dd>" + idTok("R11") + "</dd></dl>" +
          '<p class="note">Author identities are recorded separately from the adopter.</p>' +
          '<div class="row gap-s"><button type="button" class="btn btn-quiet" data-act="sign-change">' + (s.changed ? "Restore the generated module" : "Change the generated module") + "</button></div></div>";
      }
      return '<div class="cols-2"><div><h2 style="margin-bottom:var(--s5)">PR #214 changes</h2>' + files +
        '<h2 style="margin:var(--s7) 0 var(--s4)">Evidence</h2>' + evidence + "</div>" +
        "<div>" + card + "</div></div>" +
        '<p class="note gap">Compiled code is not claimed exempt from the EU AI Act or Colorado\'s law. The rule-adoption signature and the change-control record are what compliance requires.</p>';
    },
    act: {
      "sign-do": function (s) { runTask("sign", "Recording the signature", 900, function () { s.signed = true; s.changed = false; }); },
      "sign-change": function (s) { s.changed = !s.changed; }
    }
  };

  /* Run and escalation */
  var RUN_FN_START = lineIndex(A3, "def route_claim");
  function pathPlan(claimKey) {
    var r = D.routeClaim(D.claims[claimKey]);
    var visits = [];
    for (var i = 0; i < r.branch; i++) visits.push({ line: BRANCHES[i].cond, note: "no" });
    if (BRANCHES[r.branch].cond >= 0) visits.push({ line: BRANCHES[r.branch].cond, note: "yes" });
    visits.push({ line: BRANCHES[r.branch].ret, note: r.escalate ? "escalate" : "decided", final: true, esc: !!r.escalate });
    return visits;
  }
  V.run = {
    reset: function () { return { claim: "code", sent: false, step: -1, budget: false, tab: "dr" }; },
    steps: [
      function (s, mode) { s.claim = "code"; s.sent = true; if (mode === "anim") V.run.play(s); },
      function (s, mode) { s.claim = "escalate"; s.sent = true; s.tab = "dr"; if (mode === "anim") V.run.play(s); },
      function (s, mode) { s.claim = "escalate"; s.sent = true; s.tab = "dr"; if (mode !== "silent") s.focus = "#run-tabs"; },
      function (s, mode) { s.claim = "escalate"; s.sent = true; s.tab = "loop"; if (mode !== "silent") s.focus = "#run-tabs"; }
    ],
    play: function (s) {
      var plan = pathPlan(s.claim);
      s.step = 0;
      if (reducedMotion) { s.step = -1; return; }
      S.busy = { key: "path", label: "", ms: 0, done: function () { s.step = -1; } };
      S.busy.timer = setInterval(function () {
        s.step++;
        if (s.step >= plan.length) { finishBusy(true); return; }
        V.run.paintPath(s);
      }, 380);
    },
    paintPath: function (s) {
      var code = byId("run-code"); if (!code) return;
      var plan = pathPlan(s.claim);
      code.querySelectorAll(".ln").forEach(function (ln) { ln.className = "ln"; ln.removeAttribute("data-note"); });
      var upto = s.step < 0 ? plan.length - 1 : s.step;
      for (var i = 0; i <= upto; i++) {
        var v = plan[i], ln = code.querySelector('[data-l="' + v.line + '"]');
        if (!ln) continue;
        if (i === upto && s.step >= 0 && !v.final) ln.className = "ln hl-cur";
        else if (v.final) ln.className = "ln " + (v.esc ? "hl-esc" : "hl");
        else if (v.note === "yes") ln.className = "ln " + (plan[plan.length - 1].esc ? "hl-esc" : "hl");
        else ln.className = "ln dim";
        ln.setAttribute("data-note", v.note);
      }
    },
    render: function (s) {
      var c = D.claims[s.claim];
      var playing = isBusy("path");
      var finished = s.sent && !playing;
      function f(k, v) { return "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>"; }
      var claim = '<div class="block-head" style="margin-bottom:var(--s4)"><h2>Claim <code>' + c.claim_id + "</code></h2>" +
        '<div class="row"><button type="button" class="btn btn-primary" data-act="run-send"' + (playing ? " disabled" : "") + ">Send claim</button>" +
        (playing ? '<button type="button" class="linkish" data-act="skip">Skip</button>' : "") + "</div></div>" +
        '<dl class="claim-fields">' + f("amount", fmtMicro(c.amount_cents * 10000, 2) + ' <span class="muted small">(' + c.amount_cents + " cents)</span>") +
        f("injury_reported", String(c.injury_reported)) + f("third_party_involved", String(c.third_party_involved)) +
        f("policy_age_days", String(c.policy_age_days)) + f("claims_last_12_months", String(c.claims_last_12_months)) + f("needs_recalibration", String(c.needs_recalibration)) + "</dl>" +
        (c.statement ? '<p class="statement">"' + esc(c.statement) + '"</p>' : "");
      var code = '<div class="block">' + codeFile("claims/intake/triage_generated.py", "run: 2", A3, { from: RUN_FN_START, id: "run-code", extra: "gutter" }) + "</div>";

      var outcome = "";
      if (finished && s.claim === "code") {
        outcome = '<div class="block"><div class="result-line by-code">Decided by code. No model call. No Decision Record. Route: <span class="route">FAST_TRACK</span>.</div></div>';
      } else if (finished) {
        outcome = '<div class="block"><div class="stages">' +
          '<div class="stage ok"><b>Compiled code</b>Branch 3: third party involved. Not determined, so <code>escalate(claim)</code>.</div>' +
          '<div class="stage esc"><b>' + term("shim", "Shim") + "</b>Typed, budgeted, recorded call through the customer's gateway.</div>" +
          '<div class="stage ' + (s.budget ? "esc" : "ok") + '"><b>Runtime: verify by risk class</b>' + (s.budget ? "<code>BudgetExhausted</code>. The claim goes to the manual queue." : 'Risk class high. Output <span class="route">ADJUSTER</span>. Checks pass.') + "</div></div>" +
          '<div id="run-tabs">' + tabs([["dr", "Decision Record"], ["shim", "Escalation shim"], ["loop", "Run loop"]], s.tab, "run-tab") + this.tabBody(s) + "</div></div>";
      } else if (!s.sent) {
        outcome = '<p class="note">Send the claim to follow its path through the compiled code.</p>';
      }
      return '<div class="row" style="margin-bottom:var(--s6)">' + seg([["code", "Claim decided by code"], ["escalate", "Claim that escalates"]], s.claim, "run-claim", "Claim") + "</div>" +
        claim + code + outcome;
    },
    tabBody: function (s) {
      if (s.tab === "shim") {
        return '<div class="code-aside"><div>' + codeFile("claims/escalation.py", "signature", D.escalateSignature) + "</div>" +
          '<div class="small" style="color:var(--ink-2)"><p>The ' + term("Escalation Contract", "Escalation Contract") + " is how compiled code calls the Runtime on paths it cannot determine.</p><p>The shim makes a typed, budgeted, recorded call through the customer's gateway and writes a Decision Record. It returns a Route, or raises <code>BudgetExhausted</code>, a typed outcome, so the caller sends the claim to the manual queue.</p></div></div>";
      }
      if (s.tab === "loop") {
        return '<div class="loop">' +
          "<div><h3>Escalations feed the corpus</h3><p>4,200 escalations in the week were added to the corpus.</p></div>" +
          "<div><h3>The Compiler proposes the next compilation</h3><p>Among the escalations, 1,050 claims share a pattern: third party involved, the other party admitted liability in writing, amount 1,500 or less. All 1,050 were routed FAST_TRACK.</p><p>Proposal: add a typed field <code>liability_admitted</code> to the skeleton and compile this branch. Effect if adopted: code decides 7,800 + 1,050 = 8,850 of 12,000 = " + pct(8850, 12000, 2) + '.</p><p class="muted small">Status: proposal. Needs a skeleton change by the developers and a new signature.</p></div>' +
          "<div><h3>" + term("decay monitor", "Decay monitor") + '</h3><ul class="lines"><li>Shadow-sample fraction: 2%</li><li>Shadow samples in the week: 156</li><li>Divergent: 0</li><li>De-compile flag if more than 10 per 1,000 diverge</li><li><span class="badge pass">Within threshold</span></li></ul></div></div>';
      }
      var r = REFS.R12.value, bx = s.budget;
      function f(label, val) { return '<div class="dr-field"><div class="lbl">' + label + '</div><div class="val">' + val + "</div></div>"; }
      var headline = bx
        ? '<div class="result-line esc dr-headline">Route: none. <code>BudgetExhausted</code>: the time limit was reached, so the claim goes to the manual queue.</div>'
        : '<div class="result-line by-code dr-headline">Route: <span class="route">ADJUSTER</span>. Verified. Within budget.</div>';
      var full = '<div class="dr-grid">' +
        f("Policy hash", idTok("P1", "view-obj")) +
        f("Policy and risk class", "<code>" + r.policy_id + "</code>, <code>" + r.risk_class + "</code>") +
        f("Context manifest", "claim_features " + idTok("F1", "view-obj") + "<br>statement " + idTok("S1", "view-obj") + "<br>module " + idTok("R7", "view-obj")) +
        f("Tool calls", "none") +
        f("Certificate", "<code>null</code>") +
        "</div>";
      return '<div class="block-head"><div class="row"><span class="muted">Record R12</span>' + (bx ? '<span class="badge esc">Variant shown for budget exhausted. Not in the ledger.</span>' : idTok("R12")) + "</div>" +
        '<label class="toggle small"><input type="checkbox" data-act="run-budget"' + (bx ? " checked" : "") + "> Show budget exhausted</label></div>" +
        headline +
        '<div class="dr-grid dr-key">' +
        f("Model and version", "<code>" + r.model + "</code> " + r.model_version) +
        f("Output", bx ? "none" : '<span class="route">ADJUSTER</span> ' + idTok("O1", "view-obj")) +
        f("Verification outcome", bx ? "<code>budget_exhausted</code>" : "<code>verified</code><br><span class=\"small muted\">output_is_a_route: pass. invariants_INV-1_to_INV-4: pass.</span>") +
        f("Budget", "tokens " + fmtInt(r.budget.used_tokens) + " of " + fmtInt(r.budget.max_tokens) + "<br>cost " + usd(r.budget.used_micro_usd, 3) + " of " + usd(r.budget.max_micro_usd, 3) +
          (bx ? "<br>time " + fmtInt(r.budget.timeout_ms) + " ms of " + fmtInt(r.budget.timeout_ms) + ' ms<br><span class="dr-limit">Limit reached: timeout. The call was stopped before it returned a route.</span>'
              : "<br>time " + fmtInt(r.budget.elapsed_ms) + " ms of " + fmtInt(r.budget.timeout_ms) + " ms")) +
        "</div>" +
        more("Show full record", full);
    },
    mount: function (s) { if (s.sent) V.run.paintPath(s); },
    act: {
      "run-claim": function (s, arg) { s.claim = arg; s.sent = false; s.step = -1; },
      "run-send": function (s) { s.sent = true; V.run.play(s); },
      "run-tab": function (s, arg) { s.tab = arg; },
      "run-budget": function (s, arg, el) { s.budget = el.checked; }
    }
  };

  /* Ledger */
  var RECORD_REFS = L.entries.map(function (e, i) { return L.records[i].ref; });
  function verifyLedger(records) {
    var bytes = 0, results = [], prev = null, firstBad = -1;
    L.entries.forEach(function (e, i) {
      var b = C.canonicalBytes(records[i]);
      bytes += b.length;
      var recId = "sha256:" + C.sha256Hex(b);
      var entry = { seq: e.entry.seq, prev: prev, kind: records[i] && records[i].type !== undefined ? records[i].type : null, record: recId, at: e.entry.at };
      var eb = C.canonicalBytes(entry);
      bytes += eb.length;
      var entryId = "sha256:" + C.sha256Hex(eb);
      var recordOk = recId === e.entry.record;
      var prevOk = prev === e.entry.prev;
      var entryOk = entryId === e.id;
      var r = { seq: e.entry.seq, recordOk: recordOk, prevOk: prevOk, entryOk: entryOk, recId: recId, entryId: entryId };
      if (!(recordOk && prevOk && entryOk) && firstBad < 0) firstBad = i;
      results.push(r);
      prev = entryId;
    });
    var objOk = 0, objTotal = 0;
    L.objects.concat(L.records.filter(function (r) { return r.ref === "D-CS04"; })).forEach(function (o) {
      var b = C.canonicalBytes(o.value); bytes += b.length; objTotal++;
      if ("sha256:" + C.sha256Hex(b) === o.id) objOk++;
    });
    var tvOk = C.contentId(L.testVector.input) === L.testVector.id;
    var okCount = results.filter(function (r) { return r.recordOk && r.prevOk && r.entryOk; }).length;
    var rootOk = results[results.length - 1].entryId === L.root;
    return { results: results, bytes: bytes, okCount: okCount, firstBad: firstBad, objOk: objOk, objTotal: objTotal, tvOk: tvOk, rootOk: rootOk };
  }
  var LEDGER_DESC = D.ledgerDescriptions;
  V.ledger = {
    reset: function () {
      var sel = S.ledgerSel || "R1"; S.ledgerSel = null;
      return { records: L.records.slice(0, 14).map(function (r) { return clone(r.value); }), verify: null, sel: sel, tab: "record", tampered: null, edit: false, error: null, view: "chain", tamperOpen: false };
    },
    steps: [
      function () {},
      function (s, mode) { V.ledger.doVerify(s, mode); },
      function (s, mode) { V.ledger.tamper(s, "R9"); s.tamperOpen = true; V.ledger.doVerify(s, mode); },
      function (s, mode) { V.ledger.restore(s); V.ledger.doVerify(s, mode); }
    ],
    doVerify: function (s, mode) {
      if (mode === "anim") runTask("verify", "Recomputing 14 record ids, 14 entry ids and 14 object ids with SHA-256", 1000, function () { s.verify = verifyLedger(s.records); });
      else s.verify = verifyLedger(s.records);
    },
    tamper: function (s, which) {
      s.records = L.records.slice(0, 14).map(function (r) { return clone(r.value); });
      if (which === "R9") { s.records[8].mismatches = 1; s.sel = "R9"; }
      else { s.records[7].different = 0; s.sel = "R8"; }
      s.tampered = which; s.verify = null; s.tab = "record"; s.view = "chain";
    },
    restore: function (s) {
      s.records = L.records.slice(0, 14).map(function (r) { return clone(r.value); });
      s.tampered = null; s.verify = null; s.edit = false; s.error = null;
    },
    render: function (s) {
      var v = s.verify;
      var status;
      if (isBusy("verify")) status = busyBar("verify");
      else if (!v) status = '<p class="status-line" id="ledger-status">' + (s.tampered ? "A record was changed. Verify the chain again." : "Not verified yet in this browser.") + "</p>";
      else if (v.okCount === 14 && v.rootOk) status = '<p class="status-line ok" id="ledger-status">Chain verified: 14 of 14 entries. ' + fmtInt(v.bytes) + " bytes hashed in your browser. Objects: " + v.objOk + " of " + v.objTotal + " ids match. Test vector: " + (v.tvOk ? "pass" : "fail") + ".</p>";
      else status = '<p class="status-line bad" id="ledger-status">Chain broken at entry ' + (v.firstBad + 1) + ": " + v.okCount + " of 14 entries verify. " + fmtInt(v.bytes) + " bytes hashed in your browser.</p>";

      var top = '<div class="ledger-bar"><div class="ledger-root"><span class="muted">Root</span>' + idTok("E14") + "</div>" +
        '<span class="muted small">Anchored externally: <code>' + L.anchor + "</code></span></div>" +
        '<div class="row"><button type="button" class="btn btn-primary" data-act="led-verify">Verify chain</button>' +
        '<button type="button" class="btn" data-act="led-tamper-open" aria-expanded="' + !!s.tamperOpen + '">Tamper with a record</button>' +
        (s.tampered ? '<button type="button" class="btn btn-quiet" data-act="led-reset">Reset</button>' : "") + "</div>" +
        (s.tamperOpen ? '<div class="row gap-s small"><button type="button" class="linkish" data-act="led-tamper" data-arg="R9">Change R9: mismatches 0 to 1</button><button type="button" class="linkish" data-act="led-tamper" data-arg="R8">Change R8: different 12 to 0</button><span class="muted">or select a record and edit it.</span></div>' : "");

      var body;
      if (s.view === "objects") {
        body = '<p class="note" style="margin-top:var(--s6);margin-bottom:var(--s5)">Artefacts, the policy and the small objects the records point to. Each id is a content id too.</p><ul class="obj-list">' +
          L.objects.concat(L.records.filter(function (r) { return r.ref === "D-CS04"; })).map(function (o) {
            return "<li><b>" + o.ref + '</b><button type="button" class="linkish" style="text-align:left;font-weight:500" data-act="view-obj" data-arg="' + o.ref + '">' + esc(D.objectLabels[o.ref]) + "</button>" + idTok(o.ref, "view-obj") + "</li>";
          }).join("") + "</ul>";
      } else {
        var chain = '<ol class="chain">' + L.entries.map(function (e, i) {
          var ref = RECORD_REFS[i];
          var r = v ? v.results[i] : null;
          var ok = r ? r.recordOk && r.prevOk && r.entryOk : null;
          var err = "";
          if (r && !r.recordOk) err = "Record id no longer matches";
          else if (r && !r.prevOk) err = "Previous entry id no longer matches";
          return '<li class="' + (ok === null ? "" : ok ? "ok" : "bad") + '"><span class="node" aria-hidden="true">' + (ok === null ? "" : ok ? "&#10003;" : "!") + "</span>" +
            '<button type="button" class="entry' + (s.sel === ref ? " sel" : "") + '" data-act="led-sel" data-arg="' + ref + '">' +
            '<span class="entry-desc">' + esc(LEDGER_DESC[ref]) + "</span>" +
            '<span class="entry-meta">' + e.entry.seq + ". <code>" + e.entry.kind + "</code>, " + e.entry.at.slice(0, 10) + " " + e.entry.at.slice(11, 16) + " UTC</span>" +
            (err ? '<span class="entry-err">' + err + "</span>" : "") +
            "</button></li>";
        }).join("") + "</ol>";
        body = '<div class="ledger-grid"><div>' + chain + '</div><div class="detail" id="ledger-detail">' + this.detail(s) + "</div></div>";
      }
      return top + '<div class="block"><div class="block-head" style="align-items:center;margin-bottom:0">' + status + seg([["chain", "Chain"], ["objects", "Objects"]], s.view, "led-view", "Ledger view") + "</div>" + body + "</div>" +
        '<p class="note gap">Check any record yourself with the command line tool: save the JSON to a file and run <code>regufinder hash file.json</code>.</p>';
    },
    detail: function (s) {
      var ref = s.sel;
      var isRecord = RECORD_REFS.indexOf(ref) !== -1;
      var value = isRecord ? s.records[RECORD_REFS.indexOf(ref)] : REFS[ref].value;
      var label = isRecord ? "Entry " + (RECORD_REFS.indexOf(ref) + 1) + ": " + ref + " " + value.type : ref + ": " + D.objectLabels[ref];
      var tbs = isRecord ? [["record", "Record"], ["canon", "Canonical JSON"], ["entry", "Entry"]] : [["record", "Object"], ["canon", "Canonical JSON"]];
      var tab = s.tab === "entry" && !isRecord ? "record" : s.tab;
      var body;
      if (tab === "record") {
        if (s.edit && isRecord) {
          body = '<p class="small">Edit one value, then apply and verify. Values must be integers, strings, booleans or null. No floats.</p>' +
            '<textarea class="tamper-area" id="tamper-text" spellcheck="false">' + esc(JSON.stringify(value, null, 2)) + "</textarea>" +
            (s.error ? '<p class="cross small">' + esc(s.error) + "</p>" : "") +
            '<div class="row gap-s"><button type="button" class="btn btn-primary" data-act="led-apply">Apply and verify</button><button type="button" class="btn btn-quiet" data-act="led-edit">Cancel</button></div>';
        } else {
          body = '<pre class="json">' + jsonHtml(value) + "</pre>" + (isRecord ? '<div class="row gap-s"><button type="button" class="btn btn-quiet" data-act="led-edit">Edit this record</button></div>' : "");
        }
      } else if (tab === "canon") {
        var text = C.canonicalText(value);
        body = '<p class="small muted">The exact bytes that are hashed: ' + fmtInt(C.utf8(text).length) + " bytes of UTF-8.</p>" + '<pre class="json wrap">' + esc(text) + "</pre>" +
          '<p class="small gap-s">sha256 of these bytes: <code style="overflow-wrap:anywhere">' + C.contentId(value) + "</code></p>";
      } else {
        var i = RECORD_REFS.indexOf(ref), e = L.entries[i];
        body = '<pre class="json">' + jsonHtml(e.entry) + '</pre><p class="small gap-s">Entry id ' + idTok("E" + e.entry.seq) + "</p>" +
          '<p class="note">The entry carries the id of the previous entry, so changing any record changes every entry after it.</p>';
      }
      var idLine = '<p class="small muted" style="margin-bottom:var(--s4)">' + (isRecord ? "Record id in the ledger " : "Id ") + idTok(ref) + "</p>";
      if (isRecord && C.canonicalText(value) !== C.canonicalText(REFS[ref].value)) {
        idLine += '<p class="callout-bad">This record was changed in your browser. Its content now hashes to <code style="overflow-wrap:anywhere">' + esc(C.contentId(value)) + "</code>, which is not the id the ledger holds.</p>";
      }
      return "<h2>" + esc(label) + "</h2>" + idLine + tabs(tbs, tab, "led-tab") + body;
    },
    act: {
      "led-sel": function (s, arg) { s.sel = arg; s.edit = false; s.error = null; if (window.innerWidth < 1100) s.focus = "#ledger-detail"; },
      "led-tab": function (s, arg) { s.tab = arg; },
      "led-view": function (s, arg) { s.view = arg; },
      "led-verify": function (s) { V.ledger.doVerify(s, "anim"); },
      "led-tamper-open": function (s) { s.tamperOpen = !s.tamperOpen; },
      "led-tamper": function (s, arg) { V.ledger.tamper(s, arg); s.focus = "#ledger-status"; },
      "led-reset": function (s) { V.ledger.restore(s); s.focus = "#ledger-status"; },
      "led-edit": function (s) { s.edit = !s.edit; s.error = null; s.tab = "record"; },
      "led-apply": function (s) {
        var ta = byId("tamper-text");
        var i = RECORD_REFS.indexOf(s.sel);
        try {
          var v = JSON.parse(ta.value);
          C.canonicalText(v);
          s.records[i] = v; s.tampered = s.sel; s.edit = false; s.error = null;
          V.ledger.doVerify(s, "anim");
        } catch (err) {
          s.error = "Not applied: " + (err && err.message ? err.message : "invalid JSON");
        }
      }
    }
  };

  /* Runtime */
  V.runtime = {
    reset: function () { return { b: false, c: false, tab: "record" }; },
    complete: function (s) { s.b = true; s.c = true; },
    steps: [
      function (s) { s.tab = "record"; },
      function (s) { s.tab = "verify"; },
      function (s) { s.tab = "certify"; }
    ],
    nextAction: function (s) {
      if (s.tab !== "certify") return false;
      if (!s.b) { this.act["rt-replay"](s, "b"); return true; }
      if (!s.c) { this.act["rt-replay"](s, "c"); return true; }
      return false;
    },
    render: function (s) {
      var state = s.b ? '<span class="badge state-portable">portable</span>' : '<span class="badge state-locked">origin-locked</span>';
      var dr = REFS["D-CS04"].value;
      var head = '<div class="rt-head"><h2>CS-04 <code>draft_customer_letter</code></h2><span>Score 3.5 bits, <span class="bucket-open">open</span></span>' + state + "</div>" +
        '<p class="prose" style="color:var(--ink-2)">This call site is open, so the model stays. The Runtime records it, verifies it by risk class, and certifies a replacement model.</p>' +
        '<div class="gap-s">' + codeBlock(D.stubs["CS-04"]) + "</div>";
      var body;
      if (s.tab === "record") {
        body = '<div class="stats" style="margin-bottom:var(--s6)"><div class="stat"><b>9,000</b><span class="stat-label">calls, week of ' + WEEK + '</span></div><div class="stat"><b>9,000</b><span class="stat-label">Decision Records</span></div></div>' +
          '<dl class="kv" style="max-width:36rem"><dt>Example</dt><dd>' + idTok("D-CS04") + "</dd><dt>Claim</dt><dd><code>" + dr.claim_id + "</code></dd><dt>Risk class</dt><dd>" + dr.risk_class + "</dd><dt>Tool calls</dt><dd><code>lookup_payment_schedule</code></dd><dt>Verification</dt><dd>" + dr.verification.outcome + "</dd></dl>" +
          '<div class="row gap"><button type="button" class="btn" data-act="rt-open-dr">Open the Decision Record</button></div>';
      } else if (s.tab === "verify") {
        var rc = D.riskClasses;
        var rows = rc.map(function (r) { return ["<b>" + r.cls + "</b>", esc(r.meaning), esc(r.checks), fmtInt(r.calls), fmtInt(r.passed), String(r.held)]; });
        rows.push({ cls: "total", cells: ["Total", "", "", fmtInt(sum(rc, function (r) { return r.calls; })), fmtInt(sum(rc, function (r) { return r.passed; })), String(sum(rc, function (r) { return r.held; }))] });
        body = table([{ h: "Risk class" }, { h: "Meaning" }, { h: "Checks" }, { h: "Calls", r: 1 }, { h: "Passed", r: 1 }, { h: "Held", r: 1 }], rows) +
          '<p class="note">Held share: 90 / 9,000 = ' + pct(90, 9000, 0) + ". Checks on the example record: " +
          dr.verification.checks.map(function (c) { return '<span class="check-name term" tabindex="0" data-def="' + esc(D.checkMeanings[c.check]) + '">' + c.check + "</span>"; }).join(", ") + ".</p>";
      } else {
        var crow = D.certRows.map(function (r, i) {
          var key = i === 1 ? "b" : i === 2 ? "c" : null;
          var shown = key === null || s[key];
          var name = "<code>" + r.model + "</code>" + (r.role ? '<span class="sub">' + r.role + "</span>" : "");
          if (key && isBusy("replay-" + key)) return [name, busyBar("replay-" + key), "", "", ""];
          if (!shown) return [name, '<button type="button" class="btn" data-act="rt-replay" data-arg="' + key + '">Replay 500 recorded calls</button>', "", "", ""];
          var res = r.result === "Certified" ? '<span class="badge pass">Certified</span>' : r.result === "Not certified" ? '<span class="badge fail">Not certified</span>' : '<span class="badge notrun">Baseline</span>';
          return [name, String(r.replayed), String(r.passed), r.newHigh === null ? "not applicable" : String(r.newHigh), res];
        });
        body = '<p class="prose" style="color:var(--ink-2)">500 recorded calls (350 medium, 150 high) are replayed on each candidate and the same checks are applied. Certify when the candidate passes at least as many replayed calls as the origin model and has zero new failures in the high class.</p>' +
          '<div class="gap">' + table([{ h: "Model" }, { h: "Replayed", r: 1 }, { h: "Passed checks", r: 1 }, { h: "New failures in high class", r: 1 }, { h: "Result" }], crow) + "</div>" +
          (s.b ? '<div class="cert-result"><p class="status-line ok">CS-04 moves from origin-locked to portable.</p>' +
            '<p class="cert-id"><span class="muted small">Certificate record</span> ' + idTok("R14") + "</p></div>" : "");
      }
      return head + '<div class="block">' + tabs([["record", "Record"], ["verify", "Verify by risk class"], ["certify", "Certify a replacement model"]], s.tab, "rt-tab") + body + "</div>";
    },
    act: {
      "rt-tab": function (s, arg) { s.tab = arg; },
      "rt-replay": function (s, arg) { runTask("replay-" + arg, "Replaying 500 calls", 1200, function () { s[arg] = true; }); },
      "rt-open-dr": function () { openDecisionRecordModal(); return "nav"; }
    }
  };

  /* Reports */
  function breakEvenRows() {
    var per = 50000, gen = 2100000, regen = 700000, shadow = (per * 2) / 100, saving = per - shadow, net = (saving * 65) / 100;
    var before = 12000 * per, escal = 4200 * per, shadowWeek = 156 * per, after = escal + shadowWeek, netWeek = before - after;
    return [
      ["Cost per model call", "given", per, 3],
      ["Generation cost (one-off)", "given", gen, 2],
      ["Regeneration cost (one regeneration on a second model)", "given", regen, 2],
      ["Shadow-sample fraction", "given", "2 per 100", null],
      ["Shadow cost per compiled-path transaction", "0.02 x 50,000", shadow, 3],
      ["Saving per compiled-path transaction", "50,000 - 1,000", saving, 3],
      ["Compiled-path share", "7,800 / 12,000", "65 per 100", null],
      ["Net saving per transaction", "0.65 x 49,000", net, 2],
      ["Break-even transactions", "2,800,000 / 31,850 = 87.91, rounded up", String(Math.ceil((gen + regen) / net)), null],
      ["Weekly cost before", "12,000 x 50,000", before, 2],
      ["Weekly escalation cost after", "4,200 x 50,000", escal, 2],
      ["Weekly shadow cost after", "156 x 50,000 (156 = 2% of 7,800)", shadowWeek, 2],
      ["Weekly cost after", "210.00 + 7.80", after, 2],
      ["Weekly net saving", "600.00 - 217.80", netWeek, 2],
      ["Reduction", "382.20 / 600.00", pct(netWeek, before, 1), null]
    ];
  }
  function breakEvenChart() {
    var W = 640, H = 300, x0 = 56, y0 = 250, x1 = 620, y1 = 20;
    function X(t) { return x0 + (t / 200) * (x1 - x0); }
    function Y(d) { return y0 - (d / 7) * (y0 - y1); }
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Break-even chart: one-off cost of 2.80 dollars against cumulative net saving of 0.03185 dollars per transaction, crossing at 88 transactions">';
    for (var d = 0; d <= 7; d++) svg += '<line class="grid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(d) + '" y2="' + Y(d) + '"/><text x="' + (x0 - 10) + '" y="' + (Y(d) + 4) + '" text-anchor="end">$' + d + "</text>";
    for (var t = 0; t <= 200; t += 50) svg += '<line class="axis" x1="' + X(t) + '" x2="' + X(t) + '" y1="' + y0 + '" y2="' + (y0 + 5) + '"/><text x="' + X(t) + '" y="' + (y0 + 20) + '" text-anchor="middle">' + t + "</text>";
    svg += '<text x="' + ((x0 + x1) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Transactions</text>';
    svg += '<line class="l-cost" x1="' + X(0) + '" x2="' + X(200) + '" y1="' + Y(2.8) + '" y2="' + Y(2.8) + '"/>';
    svg += '<line class="l-save" x1="' + X(0) + '" x2="' + X(200) + '" y1="' + Y(0) + '" y2="' + Y(200 * 0.03185) + '"/>';
    var cx = X(2.8 / 0.03185), cy = Y(2.8);
    svg += '<line class="grid" x1="' + cx + '" x2="' + cx + '" y1="' + cy + '" y2="' + y0 + '" stroke-dasharray="4 3"/>';
    svg += '<circle class="cross-dot" cx="' + cx + '" cy="' + cy + '" r="5"/><text class="strong" x="' + (cx + 10) + '" y="' + (cy + 26) + '">88 transactions</text>';
    svg += '<text x="' + X(200) + '" y="' + (Y(2.8) + 18) + '" text-anchor="end">One-off cost $2.80</text>';
    svg += '<text x="' + X(200) + '" y="' + (Y(6.37) - 8) + '" text-anchor="end">Cumulative net saving</text></svg>';
    return svg;
  }
  function burnChart(sel) {
    var W = 520, H = 260, x0 = 44, y0 = 220, y1 = 16, bw = 52, gap = 22;
    function Y(n) { return y0 - (n / 6) * (y0 - y1); }
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Burn-down: six snapshots of six call sites by state">';
    for (var n = 0; n <= 6; n++) svg += '<line class="grid" x1="' + x0 + '" x2="' + (W - 8) + '" y1="' + Y(n) + '" y2="' + Y(n) + '"/><text x="' + (x0 - 8) + '" y="' + (Y(n) + 4) + '" text-anchor="end">' + n + "</text>";
    D.burndown.forEach(function (b, i) {
      var x = x0 + 16 + i * (bw + gap), acc = 0;
      svg += '<g style="opacity:' + (i === sel ? 1 : 0.4) + ';cursor:pointer" data-act="burn-snap" data-arg="' + i + '">';
      b.counts.forEach(function (c, k) {
        if (!c) return;
        svg += '<rect style="fill:var(' + ["--locked", "--portable", "--brand", "--retired"][k] + ')" x="' + x + '" y="' + Y(acc + c) + '" width="' + bw + '" height="' + (Y(acc) - Y(acc + c)) + '"/>';
        acc += c;
      });
      svg += '<text x="' + (x + bw / 2) + '" y="' + (y0 + 18) + '" text-anchor="middle"' + (i === sel ? ' class="strong"' : "") + ">" + i + "</text></g>";
    });
    svg += '<text x="' + ((x0 + W) / 2) + '" y="' + (H - 2) + '" text-anchor="middle">Snapshot</text>';
    svg += '<text x="12" y="' + ((y0 + y1) / 2) + '" text-anchor="middle" transform="rotate(-90 12 ' + ((y0 + y1) / 2) + ')">Call sites</text></svg>';
    return svg;
  }
  V.reports = {
    reset: function () { return { tab: "audit", micro: false, snap: 0, prevSnap: 0, playing: false }; },
    steps: [
      function (s) { s.tab = "audit"; },
      function (s) { s.tab = "breakeven"; },
      function (s) { s.tab = "portfolio"; },
      function (s) { s.tab = "burndown"; }
    ],
    render: function (s) {
      var body;
      var units = '<div class="row" style="margin-bottom:var(--s5)">' + seg([["usd", "Dollars"], ["micro", "Stored micro-dollars"]], s.micro ? "micro" : "usd", "rep-units", "Units") +
        '<span class="small muted">Records store integer micro-dollars (1 dollar = 1,000,000). No floats.</span></div>';
      if (s.tab === "audit") {
        var x = auditSections({ tiles: {} }, true);
        body = x.sec1 + '<div class="block"><h2>Top three candidates</h2>' + x.sec2 + "</div>" +
          '<div class="row gap"><button type="button" class="linkish" data-act="goto" data-arg="audit">Open the full audit report</button></div>';
      } else if (s.tab === "breakeven") {
        var rows = breakEvenRows().map(function (r) {
          var val = r[3] === null ? r[2] : s.micro ? fmtInt(r[2]) : usd(r[2], r[3]);
          return [r[0], '<span class="small muted">' + esc(r[1]) + "</span>", val];
        });
        body = '<div class="chart wide">' + breakEvenChart() + '<div class="legend"><span><i style="background:var(--escalate)"></i>One-off model cost</span><span><i style="background:var(--brand)"></i>Cumulative net saving ($0.03185 per transaction)</span></div></div>' +
          '<div class="block"><h2>' + term("break-even report", "Break-even report") + " for CS-02</h2>" + units +
          table([{ h: "Line" }, { h: "Arithmetic" }, { h: s.micro ? "Micro-dollars" : "Value", r: 1 }], rows) + "</div>";
      } else if (s.tab === "portfolio") {
        var pf = D.portfolio;
        var callsAfter = sum(pf, function (p) { return p.callsAfter; }), spendAfter = sum(pf, function (p) { return p.spendAfterMicro; });
        var stateCls = { compiled: "state-compiled", portable: "state-portable", "origin-locked": "state-locked", retired: "state-retired" };
        var prow = pf.map(function (p) { return ["<b>" + p.id + "</b>", '<span class="badge ' + stateCls[p.state] + '">' + p.label + "</span>", fmtInt(p.callsAfter), s.micro ? fmtInt(p.spendAfterMicro) : usd(p.spendAfterMicro), '<span class="small muted">' + esc(p.arithmetic) + "</span>"]; });
        prow.push({ cls: "total", cells: ["Total", "", fmtInt(callsAfter), s.micro ? fmtInt(spendAfter) : usd(spendAfter), ""] });
        body = '<div class="stats" style="margin-bottom:var(--s7)">' +
          '<div class="stat good"><b>' + usd(1800000000 - spendAfter) + '</b><span class="stat-label">weekly saving: 1,800.00 - 1,017.96 (' + pct(1800000000 - spendAfter, 1800000000, 1) + " of spend). Equals the audit estimate.</span></div>" +
          '<div class="stat good"><b>' + pct(48000 - callsAfter, 48000, 1) + '</b><span class="stat-label">LLM-free share of runtime paths: (48,000 - 16,836) / 48,000 = 31,164 / 48,000</span></div></div>' +
          units + table([{ h: "Call site" }, { h: "State" }, { h: "Model calls per week after", r: 1 }, { h: "Weekly spend after", r: 1 }, { h: "Arithmetic" }], prow);
      } else {
        var b = D.burndown[s.snap];
        var cols = D.burnStates.map(function (name, k) {
          var cards = D.inventory.filter(function (r) { return b.states[r.id] === k; }).map(function (r) {
            var moved = s.snap !== s.prevSnap && D.burndown[s.prevSnap].states[r.id] !== k;
            return '<button type="button" class="cs-card s-col-' + k + (moved ? " moved" : "") + '" data-act="burn-card" data-arg="' + r.id + '"><b>' + r.id + "</b>" + brk(r.fn) + "</button>";
          }).join("");
          return '<div class="board-col"><h3><span>' + name + "</span><span>" + b.counts[k] + "</span></h3>" + cards + "</div>";
        }).join("");
        body = '<div class="burn"><div class="chart">' + burnChart(s.snap) +
          '<div class="legend">' + D.burnStates.map(function (n, k) { return '<span><i class="s-' + k + '"></i>' + n + "</span>"; }).join("") + "</div>" +
          '<p class="note" style="margin-top:var(--s2)">Snapshots in order, not a delivery schedule.</p></div>' +
          '<div><div class="slider-row"><button type="button" class="btn" data-act="burn-play">' + (s.playing ? "Pause" : "Play") + '</button><input type="range" min="0" max="5" step="1" value="' + s.snap + '" data-act="burn-range" aria-label="Snapshot"><span class="num"><b>Snapshot ' + s.snap + "</b></span></div>" +
          '<p style="font-weight:600">' + esc(b.changed) + "</p>" + '<div class="board">' + cols + "</div></div></div>" +
          '<p class="pull">Every runtime LLM call site is origin-locked, portable, compiled or retired. Progress is movement to the right, per codebase, per team, per company.</p>';
      }
      return tabs([["audit", "Audit"], ["breakeven", "Break-even (CS-02)"], ["portfolio", "Portfolio"], ["burndown", "Burn-down"]], s.tab, "rep-tab") + body;
    },
    act: {
      "rep-tab": function (s, arg) { s.tab = arg; },
      "rep-units": function (s, arg) { s.micro = arg === "micro"; },
      "burn-snap": function (s, arg) { V.reports.setSnap(s, +arg); },
      "burn-range": function (s, arg, el) { V.reports.setSnap(s, +el.value); },
      "burn-card": function (s, arg) { openInventoryModal(arg); return "nav"; },
      "burn-play": function (s) {
        if (s.playing) { stopPlay(s); return; }
        s.playing = true;
        if (s.snap >= 5) V.reports.setSnap(s, 0);
        S.playTimer = setInterval(function () {
          if (SCREENS[S.idx].slug !== "reports" || s.snap >= 5) { stopPlay(s); render(); return; }
          V.reports.setSnap(s, s.snap + 1); render();
        }, reducedMotion ? 400 : 900);
      }
    },
    setSnap: function (s, n) { s.prevSnap = s.snap; s.snap = Math.max(0, Math.min(5, n)); }
  };
  function stopPlay(s) { clearInterval(S.playTimer); S.playTimer = null; if (s) s.playing = false; }

  /* ---------------------------------------------------------------- drawers */

  var lastFocus = null;
  function openModal(title, html) {
    lastFocus = document.activeElement;
    byId("modal-title").textContent = title;
    byId("modal-body").innerHTML = html;
    byId("modal").hidden = false;
    byId("modal-close").focus();
  }
  function closeModal() {
    byId("modal").hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openObjectModal(ref) {
    var o = REFS[ref];
    var html = '<p class="muted">' + esc(D.objectLabels[ref] || (ref + " " + (o.value.type || ""))) + "</p>" +
      '<p class="small">Content id <code style="overflow-wrap:anywhere">' + esc(o.id) + "</code></p>" +
      "<h3>Canonical JSON</h3>" + '<pre class="json wrap">' + esc(C.canonicalText(o.value)) + "</pre>" +
      '<p class="small muted">Recomputed in your browser: ' + (C.contentId(o.value) === o.id ? '<span class="tick">matches</span>' : '<span class="cross">does not match</span>') + "</p>" +
      (o.value && typeof o.value.text === "string" && /\.py$/.test(o.value.path || "") ? "<h3>Text as a file</h3>" + codeBlock(o.value.text) : "") +
      (o.kind === "record" ? '<div class="row"><button type="button" class="btn" data-act="open-id" data-arg="' + esc(ref) + '">Open on the Ledger</button></div>' : "");
    openModal(ref, html);
  }
  function openDecisionRecordModal() {
    var dr = REFS["D-CS04"].value, letter = REFS.L1.value.text;
    var html = '<p class="muted">Runtime Decision Record for CS-04.</p>' +
      '<p class="small">Id ' + idTok("D-CS04") + "</p><h3>Letter</h3>" + '<p class="small">Output ' + idTok("L1", "view-obj") + '</p><div class="letter">' + esc(letter) + "</div>" +
      "<h3>Record</h3>" + '<pre class="json">' + jsonHtml(dr) + "</pre>";
    openModal("Decision Record D-CS04", html);
  }
  function openInventoryModal(id) {
    var r = invRow(id);
    var html = '<dl class="kv"><dt>Id</dt><dd>' + r.id + "</dd><dt>File and line</dt><dd><code>" + esc(r.file) + ":" + r.line + "</code></dd><dt>Function</dt><dd><code>" + r.fn + "</code></dd><dt>What it does</dt><dd>" + esc(r.what) + "</dd><dt>Model</dt><dd><code>" + r.model + "</code></dd><dt>Coupling</dt><dd>" + r.coupling + ": " + esc(r.reason) + "</dd>" +
      "<dt>Calls per week</dt><dd>" + fmtInt(r.calls) + "</dd><dt>Cost per call</dt><dd>" + usd(r.costMicro, 3) + "</dd><dt>Spend per week</dt><dd>" + usd(r.calls * r.costMicro) + "</dd></dl>";
    openModal(id + " " + r.fn, html);
  }
  function openCallSiteModal(id) {
    var r = invRow(id);
    var code = id === "CS-02" ? REFS.A0.value.text : D.stubs[id];
    var html = '<dl class="kv"><dt>File and line</dt><dd><code>' + esc(r.file) + ":" + r.line + "</code></dd><dt>Function</dt><dd><code>" + esc(r.fn) + "</code></dd><dt>What it does</dt><dd>" + esc(r.what) + "</dd><dt>Model</dt><dd><code>" + r.model + "</code></dd><dt>Coupling</dt><dd>" + r.coupling + ": " + esc(r.reason) + "</dd></dl>" +
      "<h3>The call site as found</h3>" + (id === "CS-02" ? '<p class="small muted">Excerpt. The call is at line 58 in the full file.</p>' : "") + codeBlock(code);
    openModal(id + " " + r.fn, html);
  }

  /* ------------------------------------------------------------- navigation */

  function applySteps(idx, inner, mode) {
    var slug = SCREENS[idx].slug, v = V[slug];
    var s = v.reset();
    S.st[slug] = s;
    for (var k = 0; k <= inner; k++) v.steps[k](s, k === inner ? mode : "silent");
    if (S.done[idx] && v.complete) v.complete(s);
  }
  function lastInner(idx) { return V[SCREENS[idx].slug].steps.length - 1; }
  function markProgress(idx, inner) {
    if (idx > S.maxIdx) S.maxIdx = idx;
    for (var i = 0; i < idx; i++) S.done[i] = true;
    if (inner >= lastInner(idx)) S.done[idx] = true;
  }
  function cancelBusy() { if (S.busy) finishBusy(false); stopPlay(st()); }

  function goGuided(idx, inner, mode) {
    cancelBusy();
    var changed = idx !== S.idx;
    S.idx = idx; S.inner = inner;
    applySteps(idx, inner, mode);
    markProgress(idx, inner);
    setHash();
    render(changed);
  }
  function goFree(idx) {
    cancelBusy();
    var changed = idx !== S.idx;
    S.idx = idx;
    var v = V[SCREENS[idx].slug];
    if (S.done[idx]) {
      S.inner = lastInner(idx);
      applySteps(idx, S.inner, "silent");
    } else {
      S.inner = 0;
      S.st[SCREENS[idx].slug] = v.reset();
    }
    if (idx > S.maxIdx) S.maxIdx = idx;
    setHash();
    render(changed);
  }
  function next() {
    if (S.busy) { finishBusy(true); return; }
    var v = V[SCREENS[S.idx].slug];
    if (v.nextAction && v.nextAction(st())) { render(); return; }
    if (S.inner < lastInner(S.idx)) goGuided(S.idx, S.inner + 1, "anim");
    else if (S.idx < N - 1) goGuided(S.idx + 1, 0, "anim");
    else goGuided(0, 0, "anim");
  }
  function back() {
    if (S.busy) { finishBusy(true); return; }
    if (S.inner > 0) goGuided(S.idx, S.inner - 1, "back");
    else if (S.idx > 0) goGuided(S.idx - 1, lastInner(S.idx - 1), "back");
  }
  function hashFor() {
    var slug = SCREENS[S.idx].slug;
    return "#/" + slug + (lastInner(S.idx) > 0 && S.inner > 0 ? "/" + (S.inner + 1) : "");
  }
  function setHash() {
    var h = hashFor();
    S.lastHash = h;
    if (location.hash !== h) {
      try {
        if (S.fromHashNav) history.replaceState(null, "", h);
        else history.pushState(null, "", h);
      } catch (e) { location.hash = h; }
    }
  }
  function fromHash() {
    var h = location.hash || "#/overview";
    if (h === S.lastHash) return;
    S.fromHashNav = true;
    try { navFromHash(h); } finally { S.fromHashNav = false; }
  }
  function navFromHash(h) {
    var m = /^#\/([a-z]+)(?:\/(\d+))?/.exec(h);
    var idx = m ? slugIndex(m[1]) : 0;
    if (idx < 0) idx = 0;
    if (m && m[2]) {
      var inner = Math.max(0, Math.min(lastInner(idx), parseInt(m[2], 10) - 1));
      goGuided(idx, inner, "silent");
    } else {
      goFree(idx);
    }
  }

  /* ----------------------------------------------------------------- render */

  function setNav(open) {
    var nav = byId("nav");
    nav.classList.toggle("open", open);
    byId("nav-scrim").hidden = !open;
    byId("menu-btn").setAttribute("aria-expanded", String(open));
  }

  function renderChrome() {
    var groups = [], seen = {};
    SCREENS.forEach(function (sc, i) {
      if (!(sc.group in seen)) { seen[sc.group] = groups.length; groups.push({ name: sc.group, items: [] }); }
      groups[seen[sc.group]].items.push(i);
    });
    byId("nav-groups").innerHTML = groups.map(function (g) {
      return '<div class="nav-group">' + (g.name ? "<h2>" + esc(g.name) + "</h2>" : "") + "<ul>" + g.items.map(function (i) {
        var sc = SCREENS[i];
        return '<li><a class="nav-item' + (i <= S.maxIdx ? " visited" : "") + '" href="#/' + sc.slug + '"' + (i === S.idx ? ' aria-current="page"' : "") + '><span class="dot" aria-hidden="true"></span>' + esc(sc.title) + "</a></li>";
      }).join("") + "</ul></div>";
    }).join("");
    var parts = lastInner(S.idx) + 1;
    byId("guide-count").textContent = (S.idx + 1) + " of " + N + (parts > 1 ? ", part " + (S.inner + 1) + " of " + parts : "");
    var dots = "";
    if (parts > 1) for (var k = 0; k < parts; k++) dots += '<i class="' + (k <= S.inner ? "on" : "") + '"></i>';
    byId("guide-dots").innerHTML = dots;
    byId("guide-back").disabled = S.idx === 0 && S.inner === 0;
    var last = S.idx === N - 1 && S.inner === lastInner(S.idx);
    byId("guide-next-label").textContent = S.idx === 0 ? "Start the tour" : last ? "Restart" : "Next";
  }

  function render(screenChanged) {
    var sc = SCREENS[S.idx], v = V[sc.slug], s = st();
    var active = document.activeElement, focusKey = null;
    if (active && active.getAttribute && active.getAttribute("data-act") && byId("screen").contains(active)) {
      focusKey = '[data-act="' + active.getAttribute("data-act") + '"]' + (active.hasAttribute("data-arg") ? '[data-arg="' + active.getAttribute("data-arg") + '"]' : "");
    }
    var head = sc.slug === "overview" ? "" : '<header class="page-head"><h1>' + esc(sc.title) + '</h1><p class="lede">' + esc(sc.caption) + "</p></header>";
    var main = byId("screen");
    main.innerHTML = head + v.render(s);
    if (v.mount) v.mount(s, main);
    renderChrome();
    document.title = sc.title + ". Regufinder";
    if (screenChanged) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    } else if (focusKey) {
      var el = main.querySelector(focusKey);
      if (el) el.focus({ preventScroll: true });
    }
    if (s && s.focus) {
      var target = main.querySelector(s.focus);
      s.focus = null;
      if (target) {
        var r = target.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight - 100) {
          target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        }
      }
    }
  }

  /* ----------------------------------------------------------------- events */

  function toast(msg) {
    var t = byId("toast");
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove("on"); }, 1600);
  }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback);
    else fallback();
    toast("Copied " + text.slice(0, 19) + "\u2026");
  }

  function handleAct(el, evType) {
    var act = el.getAttribute("data-act"), arg = el.getAttribute("data-arg");
    var s = st(), v = V[SCREENS[S.idx].slug];
    switch (act) {
      case "start": goGuided(1, 0, "anim"); return;
      case "goto": if (!byId("modal").hidden) closeModal(); goFree(slugIndex(arg)); return;
      case "skip": finishBusy(true); return;
      case "copy-id": copyText(arg); return;
      case "open-id":
        if (!byId("modal").hidden) byId("modal").hidden = true;
        var isEntry = /^E\d+$/.test(arg);
        var target = isEntry ? RECORD_REFS[parseInt(arg.slice(1), 10) - 1] : arg;
        if (!isEntry && RECORD_REFS.indexOf(target) === -1) { openObjectModal(arg); return; }
        if (SCREENS[S.idx].slug !== "ledger") goFree(slugIndex("ledger"));
        var ls = st();
        ls.sel = target; ls.view = "chain"; ls.edit = false; ls.tab = isEntry ? "entry" : "record"; ls.focus = "#ledger-detail";
        render();
        return;
      case "view-obj": openObjectModal(arg); return;
    }
    if (v.act && v.act[act]) {
      var res = v.act[act](s, arg, el, evType);
      if (res !== "nav") render();
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.tagName === "INPUT") return; // handled by change
    if (el.closest("#modal") && ["open-id", "copy-id", "view-obj"].indexOf(el.getAttribute("data-act")) === -1) return;
    e.preventDefault();
    handleAct(el, "click");
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.matches && el.matches("input[data-act]")) handleAct(el, "change");
  });
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[type="range"][data-act]')) { handleAct(el, "input"); return; }
    var form = el.closest && el.closest("#try-form");
    if (form) {
      var s = st();
      var f = form.elements;
      s.tryc = { amount: f.amount.value, policy_age_days: f.policy_age_days.value, claims_last_12_months: f.claims_last_12_months.value,
        injury_reported: f.injury_reported.checked, third_party_involved: f.third_party_involved.checked, needs_recalibration: f.needs_recalibration.checked };
      byId("try-result").innerHTML = tryResult(s.tryc);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!byId("modal").hidden) { closeModal(); return; }
      if (!byId("glossary").hidden) { byId("glossary").hidden = true; return; }
      if (byId("nav").classList.contains("open")) { setNav(false); return; }
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("tr[data-act], g[data-act], .marker[data-act]")) {
      e.preventDefault(); handleAct(e.target, "click"); return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!byId("modal").hidden) return;
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
  });
  function hoverHandler(on) {
    return function (e) {
      var v = V[SCREENS[S.idx].slug];
      if (v.hover && e.target.closest) v.hover(st(), e.target, on);
    };
  }
  var mainEl = byId("screen");
  mainEl.addEventListener("mouseover", hoverHandler(true));
  mainEl.addEventListener("mouseout", hoverHandler(false));
  mainEl.addEventListener("focusin", hoverHandler(true));
  mainEl.addEventListener("focusout", hoverHandler(false));

  byId("guide-next").addEventListener("click", next);
  byId("guide-back").addEventListener("click", back);
  byId("restart").addEventListener("click", function (e) {
    e.preventDefault();
    setNav(false);
    S.done = {}; S.maxIdx = 0;
    goGuided(0, 0, "silent");
  });
  byId("modal-close").addEventListener("click", closeModal);
  byId("modal").addEventListener("click", function (e) { if (e.target === byId("modal")) closeModal(); });
  byId("menu-btn").addEventListener("click", function () { setNav(!byId("nav").classList.contains("open")); });
  byId("nav-scrim").addEventListener("click", function () { setNav(false); });
  byId("nav").addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); });

  // Glossary
  byId("glossary-list").innerHTML = D.glossary.map(function (g) { return "<dt>" + esc(g[0]) + "</dt><dd>" + esc(g[1]) + "</dd>"; }).join("");
  byId("open-glossary").addEventListener("click", function () { byId("glossary").hidden = false; byId("close-glossary").focus(); });
  byId("open-glossary-nav").addEventListener("click", function () { setNav(false); byId("glossary").hidden = false; byId("close-glossary").focus(); });
  byId("close-glossary").addEventListener("click", function () { byId("glossary").hidden = true; byId("open-glossary").focus(); });

  // Theme
  function effectiveTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function themeLabel() { byId("theme-toggle").textContent = effectiveTheme() === "dark" ? "Light" : "Dark"; }
  byId("theme-toggle").addEventListener("click", function () {
    var t = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("rf-theme", t); } catch (e) { /* storage unavailable */ }
    themeLabel();
  });
  themeLabel();

  window.addEventListener("hashchange", fromHash);
  window.addEventListener("popstate", fromHash);

  // Self-check of the canonical JSON and SHA-256 against the repository's test vector.
  if (C.contentId(L.testVector.input) !== L.testVector.id && window.console) console.error("Content id test vector failed");

  S.lastHash = "";
  fromHash();
})();
