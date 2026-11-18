/*
 * Regufinder walkthrough: screens, guided mode and simulated actions.
 * Plain JavaScript, no framework, no network.
 */
(function () {
  "use strict";

  var D = window.RF_DATA;
  var L = window.RF_LEDGER;
  var C = window.RFCanon;
  var SCREENS = D.screens;
  var N = SCREENS.length;

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
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function invRow(id) { for (var i = 0; i < D.inventory.length; i++) if (D.inventory[i].id === id) return D.inventory[i]; return null; }
  function slugIndex(slug) { for (var i = 0; i < N; i++) if (SCREENS[i].slug === slug) return i; return -1; }

  var GLOSS = {};
  D.glossary.forEach(function (g) { GLOSS[g[0].toLowerCase()] = g[1]; });
  function term(key, text) {
    var def = GLOSS[key.toLowerCase()] || "";
    return '<span class="term" tabindex="0" data-def="' + esc(def) + '">' + esc(text || key) + "</span>";
  }

  function panelFoot() { return '<div class="panel-foot">Illustrative sample data</div>'; }

  /* ------------------------------------------------------------ ledger lookup */

  var REFS = {};       // ref -> {ref, value, id, kind: "object"|"record"|"entry"}
  L.objects.forEach(function (o) { REFS[o.ref] = { ref: o.ref, value: o.value, id: o.id, kind: "object" }; });
  L.records.forEach(function (r) { REFS[r.ref] = { ref: r.ref, value: r.value, id: r.id, kind: r.ref === "D-CS04" ? "object" : "record" }; });
  L.entries.forEach(function (e) { REFS["E" + e.entry.seq] = { ref: "E" + e.entry.seq, value: e.entry, id: e.id, kind: "entry" }; });
  var ID_TO_REF = {};
  Object.keys(REFS).forEach(function (k) { ID_TO_REF[REFS[k].id] = k; });
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

  // opts: {cls: {lineIndex: className}, notes: {lineIndex: text}, id, extra, from, to}
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

  /* Escape, then offer a line break after each slash and underscore so long
     identifiers and paths wrap at a sensible point on narrow screens. */
  function brk(s) { return esc(s).replace(/([\/_])/g, "$1<wbr>"); }
  function td(label, html, cls) { return "<td" + (cls ? ' class="' + cls + '"' : "") + ' data-label="' + label + '">' + html + "</td>"; }

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

  var S = {
    idx: 0, inner: 0, maxIdx: 0, done: {}, st: {}, busy: null, lastHash: "",
    ledgerSel: null
  };
  function st() { return S.st[SCREENS[S.idx].slug]; }

  /* ------------------------------------------------------------ simulation */

  function simulate(key, label, ms, done) {
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

  /* 1. Overview */
  V.overview = {
    steps: [function () {}],
    reset: function () { return {}; },
    render: function () {
      return '<section class="hero">' +
        '<div><h1>Regufinder: a walkthrough on sample data</h1>' +
        '<p class="hero-quote">Developers write code at build time with proprietary LLMs. Regufinder makes that code run without them, owned by the company whose developers wrote it.</p>' +
        '<p class="lede">This walkthrough follows one function at a fictional insurer from a runtime model call to tested, signed code, and shows how the calls that still need a model are governed.</p>' +
        '<div class="btn-row"><button type="button" class="btn btn-primary" data-act="start">Start the walkthrough</button>' +
        '<span class="muted small">Use Next and Back below, or the left and right arrow keys.</span></div></div>' +
        '<div class="panel"><h2>The sample</h2>' +
        '<p>Acme Mutual (fictional), a motor insurer. Repository <code>acme-claims</code>.</p>' +
        '<div class="sample-figs">' +
        '<div class="fig"><b>6</b><span>runtime LLM ' + term("call site", "call sites") + '</span></div>' +
        '<div class="fig"><b>48,000</b><span>model calls in the sample week</span></div>' +
        '<div class="fig"><b>$1,800.00</b><span>model spend in the sample week</span></div>' +
        "</div>" + panelFoot() + "</div></section>" +
        '<div class="grid-2">' +
        '<div class="panel"><h2>Two things on one substrate</h2><ul class="lines">' +
        "<li>The Compiler turns the parts of a codebase that call an LLM at runtime into deterministic code the company owns.</li>" +
        "<li>The Runtime governs what cannot be compiled.</li>" +
        "<li>Both write to one policy source, one customer-owned ledger and one review-and-sign-off surface.</li></ul><div style=\"height:14px\"></div></div>" +
        '<div class="panel"><h2>What is real here</h2>' +
        '<p>The content ids on the Ledger screen are computed in your browser with the same rule as the code in the Regufinder repository today. Everything else is a simulation of the planned product.</p>' +
        '<p class="muted small">The one function we follow is <code>route_claim()</code>. It reads a motor claim and sends it to one of four teams. Its answers are settled for most claims and open for some, so it shows compiled branches, an escalation and a Decision Record in one example.</p></div>' +
        "</div>";
    }
  };

  /* 2. Scan */
  V.scan = {
    reset: function () { return { scanned: false, traffic: false, sel: null }; },
    steps: [
      function () {},
      function (s, mode) {
        if (mode === "anim") simulate("scan", "Scanning 42 Python files", 1300, function () { s.scanned = true; });
        else s.scanned = true;
        if (mode !== "silent") s.focus = "#inventory";
      },
      function (s, mode) { s.scanned = true; s.traffic = true; if (mode !== "silent") s.focus = "#inventory"; }
    ],
    render: function (s) {
      var tree = '<ul class="tree">' + D.tree.map(function (t) {
        var pad = '<span aria-hidden="true">' + new Array(t.depth + 1).join("&nbsp;&nbsp;&nbsp;") + "</span>";
        if (t.dir) return "<li>" + pad + '<span class="dirname">' + esc(t.path) + "</span></li>";
        if (t.cs) {
          return "<li>" + pad + '<button type="button" class="' + (s.sel === t.cs ? "sel" : "") + '" data-act="scan-sel" data-arg="' + t.cs + '">' + esc(t.path) + '</button><span class="cs-tag">' + t.cs + "</span></li>";
        }
        return "<li>" + pad + "<span>" + esc(t.path) + "</span>" + (t.note ? '<span class="note-inline">' + esc(t.note) + "</span>" : "") + "</li>";
      }).join("") + "</ul>";

      var right, inventory = "";
      if (!s.scanned) {
        right = isBusy("scan") ? busyBar("scan") :
          '<p>Scan reads the repository and finds every place the code calls a model at runtime. The output is structural: file, line, function, model, prompt and coupling.</p>' +
          '<div class="btn-row"><button type="button" class="btn btn-sim" data-act="scan-run">Run scan (simulated)</button></div>';
      } else {
        var rows = D.inventory.map(function (r) {
          var cells = "<td><b>" + r.id + "</b></td><td><code>" + esc(r.file).replace(/\//g, "/<wbr>") + ":" + r.line + "</code></td><td><code>" + esc(r.fn) + '</code><br><span class="small muted">' + esc(r.what) + '</span></td><td class="nowrap"><code>' + r.model + "</code></td><td>" + r.coupling + "</td>";
          if (s.traffic) cells += '<td class="r reveal-col">' + fmtInt(r.calls) + '</td><td class="r reveal-col">' + usd(r.costMicro, 3) + '</td><td class="r reveal-col">' + usd(r.calls * r.costMicro, 2) + "</td>";
          return '<tr class="clickable' + (s.sel === r.id ? " selected" : "") + '" data-act="scan-sel" data-arg="' + r.id + '" tabindex="0">' + cells + "</tr>";
        }).join("");
        var head = "<th>Id</th><th>File and line</th><th>Function and what it does</th><th>Model</th><th>Coupling</th>" +
          (s.traffic ? '<th class="r">Calls in sample week</th><th class="r">Cost per call</th><th class="r">Spend per week</th>' : "");
        var total = s.traffic ? '<tr class="total"><td>Total</td><td></td><td></td><td></td><td></td><td class="r">' + fmtInt(sum(D.inventory, function (r) { return r.calls; })) + '</td><td></td><td class="r">' + usd(sum(D.inventory, function (r) { return r.calls * r.costMicro; }), 2) + "</td></tr>" : "";
        right = '<p class="status-line ok">42 Python files scanned. 6 runtime LLM call sites found.</p>' +
          '<p>Click a row or a marked file to open its call-site record.</p>' +
          '<label class="toggle"><input type="checkbox" data-act="scan-traffic"' + (s.traffic ? " checked" : "") + "> Add traffic from the gateway sample week</label>" +
          '<p class="note">Coupling is how tightly the call is tied to the origin model. Call volume comes from the gateway logs for Monday 1 March 2027 to Sunday 7 March 2027. Language: Python (the spec also expects TypeScript; not in this sample).</p>';
        inventory = '<div class="panel section-gap" id="inventory"><h2>Call-site inventory</h2><div class="tbl-wrap"><table class="tbl inv-tbl"><thead><tr>' + head + "</tr></thead><tbody>" + rows + total + "</tbody></table></div>" + panelFoot() + "</div>";
      }

      var side = "";
      if (s.scanned && s.sel) {
        var r = invRow(s.sel);
        var code = s.sel === "CS-02" ? REFS.A0.value.text : D.stubs[s.sel];
        side = '<div class="panel sidepanel section-gap" id="cs-panel"><div class="code-head"><h2>' + r.id + ": <code>" + esc(r.fn) + "</code></h2>" +
          '<button type="button" class="btn btn-quiet" data-act="scan-sel" data-arg="">Close</button></div>' +
          '<dl class="kv"><dt>Id</dt><dd>' + r.id + "</dd><dt>File and line</dt><dd><code>" + esc(r.file) + ":" + r.line + "</code></dd><dt>Function</dt><dd><code>" + esc(r.fn) + "</code></dd><dt>Model</dt><dd><code>" + r.model + "</code></dd><dt>Coupling</dt><dd>" + r.coupling + ": " + esc(r.reason) + "</dd></dl>" +
          '<div class="code-head section-gap"><span>' + (s.sel === "CS-02" ? "Before: the call site as found (excerpt; the call is at line 58 in the full file)" : "Before: a stub of the same shape") + '</span><span class="path">' + esc(r.file) + "</span></div>" +
          codeBlock(code) + panelFoot() + "</div>";
      }

      return '<div class="scan-top"><div class="panel"><h2>Repository</h2>' + tree + panelFoot() + "</div>" +
        '<div class="panel"><h2>Scan</h2>' + right + panelFoot() + "</div></div>" + inventory + side;
    },
    act: {
      "scan-run": function (s) { simulate("scan", "Scanning 42 Python files", 1300, function () { s.scanned = true; }); if (reducedMotion) s.scanned = true; },
      "scan-traffic": function (s, arg, el) { s.traffic = el.checked; },
      "scan-sel": function (s, arg) { s.sel = arg || null; if (arg && s.scanned) s.focus = "#cs-panel"; }
    }
  };

  /* 3. Entropy scoring */
  var BUCKET_X = function (bits) { return 60 + (bits / 4) * 760; };
  V.entropy = {
    reset: function () { return { sel: "CS-02" }; },
    steps: [function () {}],
    render: function (s) {
      var markers = [
        { id: "CS-01", b: 0.02, lane: 0 }, { id: "CS-03", b: 0.0811, lane: 1 }, { id: "CS-02", b: 0.6125, lane: 0 },
        { id: "CS-05", b: 2.75, lane: 0 }, { id: "CS-04", b: 3.5, lane: 0 }
      ];
      var svg = '<svg viewBox="0 0 1000 176" role="group" aria-label="Entropy scale from 0 to 4 bits">' +
        '<rect class="zone-low" x="' + BUCKET_X(0) + '" y="66" width="' + (BUCKET_X(0.5) - BUCKET_X(0)) + '" height="48"/>' +
        '<rect class="zone-mixed" x="' + BUCKET_X(0.5) + '" y="66" width="' + (BUCKET_X(2) - BUCKET_X(0.5)) + '" height="48"/>' +
        '<rect class="zone-open" x="' + BUCKET_X(2) + '" y="66" width="' + (BUCKET_X(4) - BUCKET_X(2)) + '" height="48"/>' +
        '<text class="zone-label" x="' + (BUCKET_X(0.25)) + '" y="136" text-anchor="middle">low</text>' +
        '<text class="zone-label" x="' + (BUCKET_X(1.25)) + '" y="136" text-anchor="middle">mixed</text>' +
        '<text class="zone-label" x="' + (BUCKET_X(3)) + '" y="136" text-anchor="middle">open</text>' +
        '<line class="axis" x1="' + BUCKET_X(0) + '" x2="' + BUCKET_X(4) + '" y1="114" y2="114"/>';
      [0, 1, 2, 3, 4].forEach(function (t) {
        svg += '<line class="axis" x1="' + BUCKET_X(t) + '" x2="' + BUCKET_X(t) + '" y1="114" y2="120"/><text x="' + BUCKET_X(t) + '" y="166" text-anchor="middle">' + t + (t === 4 ? " bits" : "") + "</text>";
      });
      svg += '<line class="thr" x1="' + BUCKET_X(0.5) + '" x2="' + BUCKET_X(0.5) + '" y1="24" y2="122"/><text x="' + BUCKET_X(0.5) + '" y="16" text-anchor="middle">threshold 0.5</text>';
      svg += '<line class="thr" x1="' + BUCKET_X(2) + '" x2="' + BUCKET_X(2) + '" y1="24" y2="122"/><text x="' + BUCKET_X(2) + '" y="16" text-anchor="middle">threshold 2</text>';
      markers.forEach(function (m) {
        var x = BUCKET_X(m.b), y = m.lane ? 102 : 84;
        svg += '<g class="marker' + (s.sel === m.id ? " sel" : "") + '" tabindex="0" role="button" aria-label="' + m.id + ", " + m.b + ' bits" data-act="ent-sel" data-arg="' + m.id + '">' +
          '<circle cx="' + x + '" cy="' + y + '" r="7"/><text x="' + (x + (m.lane ? 12 : 0)) + '" y="' + (m.lane ? y + 5 : y - 30) + '" text-anchor="' + (m.lane ? "start" : "middle") + '">' + m.id + "</text></g>";
      });
      svg += '<g class="marker' + (s.sel === "CS-06" ? " sel" : "") + '" tabindex="0" role="button" aria-label="CS-06, not scored" data-act="ent-sel" data-arg="CS-06">' +
        '<circle cx="900" cy="84" r="7" style="stroke-dasharray:3 2"/><text x="900" y="54" text-anchor="middle">CS-06</text></g>' +
        '<text x="900" y="136" text-anchor="middle">not scored,</text><text x="900" y="154" text-anchor="middle">no traffic</text></svg>';

      var rows = D.entropySummary.map(function (r) {
        return '<tr class="clickable' + (s.sel === r.id ? " selected" : "") + '" data-act="ent-sel" data-arg="' + r.id + '" tabindex="0">' +
          td("Id", "<b>" + r.id + "</b>") + td("Classes", esc(r.classes)) + td("Score (bits)", r.score === null ? "not scored" : String(r.score), "r") +
          td("Bucket", '<span class="bucket-' + r.bucket + '">' + r.bucket + "</span>") + td("Plan", esc(r.plan)) + "</tr>";
      }).join("");

      return '<p class="quote">"Determinism is a property of the task, not the model."</p>' +
        '<div class="panel"><h2>' + term("entropy score", "Entropy score") + " of each call site</h2>" +
        '<div class="scale">' + svg + "</div>" +
        '<p class="small muted scale-hint">Swipe the scale sideways to see 2 to 4 bits.</p>' +
        '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Id</th><th>Classes used for the sample</th><th class="r">Score (bits)</th><th>Bucket</th><th>Plan</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        panelFoot() + "</div>" +
        '<div class="panel" id="ent-classes">' + this.classes(s.sel) + panelFoot() + "</div>" +
        '<p class="note">Method: group inputs into equivalence classes, canonicalise and cluster the outputs, compute the entropy of the output within each class, average by traffic. Entropy of a distribution p is H = minus the sum of p x log2(p). Unit: bits. Below 0.5 a call site is low and compiles whole. Between 0.5 and 2 it is mixed and its determined branches compile. Above 2 it is open and stays agentic.</p>' +
        '<p class="note">The two thresholds are planning values from the project plan. The bucket names are how this demo reads them.</p>';
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
          return "<tr>" + td("Class", "<b>" + c.cls + "</b>") + td("Definition", esc(c.def)) + td("Traces", fmtInt(c.traces), "r") + td("Share", per100(c.sharePer100), "r") +
            td("Historical outputs", "<div>" + bar + '<div class="small" style="margin-top:4px">' + outs + "</div></div>") + td("H (bits)", String(c.h), "r") + td("Share x H", String(c.shareH), "r") + "</tr>";
        }).join("");
        return "<h2>CS-02 <code>route_claim</code>: classes from 12,000 traces</h2>" +
          '<div class="legend">' + routes.map(function (k) { return '<span><i class="r-' + k + '"></i>' + k + "</span>"; }).join("") + "</div>" +
          '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Class</th><th>Definition (typed features)</th><th class="r">Traces</th><th class="r">Share</th><th>Historical outputs</th><th class="r">H (bits)</th><th class="r">Share x H</th></tr></thead><tbody>' + rows +
          '<tr class="total">' + td("Class", "Total") + "<td></td>" + td("Traces", "12,000", "r") + td("Share", "1.00", "r") + "<td></td><td></td>" + td("Share x H", "0.6125", "r") + "</tr></tbody></table></div>" +
          '<p><span class="formula">0.35 x 1.75 = 0.6125 bits</span> <span class="bucket-mixed">mixed</span></p>' +
          '<p class="small muted">Class E: shares 0.5, 0.25, 0.125, 0.125. H = 0.5 x 1 + 0.25 x 2 + 0.125 x 3 + 0.125 x 3 = 1.75 bits. Determined share of traffic: 0.65 (7,800 traces). Undetermined: 0.35 (4,200 traces).</p>';
      }
      if (id === "CS-06") {
        return "<h2>CS-06 <code>answer_faq</code></h2><p>No traffic in the sample week. Not scored. Plan: retire.</p>";
      }
      var oc = D.otherClasses[id], r = invRow(id);
      var trs = oc.rows.map(function (c) {
        var total = sum(c.outputs, function (x) { return x; });
        var bar = '<div class="sbar">' + c.outputs.map(function (w) { return '<span class="r-cluster" style="width:' + (w * 100 / total) + '%"></span>'; }).join("") + "</div>";
        return "<tr>" + td("Class", esc(c.name)) + td("Share of traffic", per100(c.share), "r") + td("Output clusters", bar) + td("H (bits)", String(c.h), "r") + "</tr>";
      }).join("");
      return "<h2>" + id + " <code>" + esc(r.fn) + "</code></h2>" +
        '<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Class</th><th class="r">Share of traffic</th><th>Output clusters</th><th class="r">H (bits)</th></tr></thead><tbody>' + trs + "</tbody></table></div>" +
        '<p><span class="formula">' + esc(oc.arithmetic) + '</span> <span class="bucket-' + row.bucket + '">' + row.bucket + "</span></p>" +
        (row.bucket === "low" ? '<p class="small muted">In the low bucket the small leftover variation is treated as model noise: the developers\' skeleton fixes one answer for those inputs.</p>' : "");
    },
    act: { "ent-sel": function (s, arg) { s.sel = arg; } }
  };

  /* 4. Audit report */
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
    var sec1 = '<div class="big-figs">' +
      '<div class="big-fig"><b>' + pct(a.qualCalls, a.calls, 2) + '</b><div class="sub">of calls qualify (' + fmtInt(a.qualCalls) + " of " + fmtInt(a.calls) + ')</div><div class="sbar"><span class="b-code" style="width:' + (a.qualCalls * 100 / a.calls) + '%"></span></div></div>' +
      '<div class="big-fig"><b>' + pct(a.qualSpend, a.spend, 2) + '</b><div class="sub">of spend qualifies (' + usd(a.qualSpend) + " of " + usd(a.spend) + ' a week)</div><div class="sbar"><span class="b-code" style="width:' + (a.qualSpend * 100 / a.spend) + '%"></span></div></div></div>' +
      '<p class="small muted section-gap">$1,800.00 a week is $7,800.00 a month.</p>';
    var sec2 = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rank</th><th>Call site</th><th class="r">One-off model cost (generation + one regeneration)</th><th class="r">Net saving per transaction</th><th class="r">Break-even transactions</th><th class="r">Estimated weekly saving</th></tr></thead><tbody>' +
      a.cands.map(function (x) {
        return "<tr><td>" + x.c.rank + "</td><td><b>" + x.c.id + "</b> <code>" + x.c.fn + '</code></td><td class="r">' + usd(x.c.genMicro) + " + " + usd(x.c.regenMicro) + " = " + usd(x.oneOff) + '</td><td class="r">' + usd(x.net, 2) + '</td><td class="r">' + x.breakEven + '</td><td class="r">' + usd(x.weekly) + "</td></tr>";
      }).join("") + '<tr class="total"><td></td><td>Total</td><td></td><td></td><td></td><td class="r">' + usd(a.totalWeekly) + "</td></tr></tbody></table></div>" +
      '<p class="note">Model costs only. Developer time, the build fee and the maintenance subscription are not included. Prices are not set yet.</p>';
    var sec3 = '<div class="tiles">' + a.cands.map(function (x, i) {
      if (compact) {
        return '<div class="tile"><span class="small muted">' + x.c.id + " <code>" + x.c.fn + "</code></span><b>" + x.breakEven + '</b><span class="small">transactions to break even</span><span class="formula" style="display:block">' + esc(x.c.breakLine) + "</span></div>";
      }
      var open = s.tiles && s.tiles[i];
      return '<button type="button" class="tile" data-act="audit-tile" data-arg="' + i + '" aria-expanded="' + !!open + '"><span class="small muted">' + x.c.id + " <code>" + x.c.fn + "</code></span><b>" + x.breakEven + '</b><span class="small">transactions to break even</span>' +
        (open ? '<span class="formula" style="display:block">' + esc(x.c.breakLine) + "</span>" : '<span class="small muted" style="display:block;margin-top:8px">Show the formula</span>') + "</button>";
    }).join("") + "</div>";
    var sec4 = '<div class="statebar" aria-label="6 origin-locked"><span class="s-0" style="width:100%">6 origin-locked</span></div>' +
      '<div class="legend"><span><i class="s-0"></i>origin-locked 6</span><span><i class="s-1"></i>portable 0</span><span><i class="s-2"></i>compiled 0</span><span><i class="s-3"></i>retired 0</span></div>';
    if (compact) return { sec1: sec1, sec2: sec2, sec3: sec3, sec4: sec4 };

    function arith(lines) { return '<details class="arith"><summary>Show the arithmetic</summary><div class="arith-lines">' + lines.map(esc).join("<br>") + "</div></details>"; }
    sec1 += arith([
      "Calls that qualify: 12,000 (CS-01) + 12,000 (CS-03) + 7,800 (CS-02) = 31,800 of 48,000 = 66.25%.",
      "Spend that qualifies: 48.00 + 360.00 + (0.65 x 600.00 = 390.00) = $798.00 of $1,800.00 = 44.33%.",
      "Monthly equivalent: 1,800 x 52 / 12 = $7,800.",
      "Rule: a low call site qualifies whole, a mixed one for its determined share, an open one not at all."
    ]);
    sec2 += arith(a.cands.map(function (x) { return x.c.id + ": net " + x.c.saveLine + ". Weekly " + x.c.weekLine + "."; }).concat([
      "Total estimated weekly saving: 382.20 + 352.80 + 47.04 = $782.04.",
      "Shadow sampling: after compiling, 2% of compiled-path transactions still go to the model so the decay monitor can compare. That costs 2% of the per-call cost on those transactions."
    ]));
    sec3 += arith(a.cands.map(function (x) { return x.c.id + ": " + x.c.breakLine; }).concat(["Break-even transactions are rounded up to the next whole transaction."]));
    return { sec1: sec1, sec2: sec2, sec3: sec3, sec4: sec4 };
  }
  V.audit = {
    reset: function () { return { tiles: {} }; },
    steps: [function () {}],
    render: function (s) {
      var x = auditSections(s, false);
      return '<article class="report">' +
        '<p class="muted small">Audit report for <code>acme-claims</code>, sample week 1 to 7 March 2027.</p>' +
        '<section class="report-sec"><h2><span class="secno">1</span>Share that qualifies</h2>' + x.sec1 + "</section>" +
        '<section class="report-sec"><h2><span class="secno">2</span>Top three candidates</h2>' + x.sec2 + "</section>" +
        '<section class="report-sec"><h2><span class="secno">3</span>Break-even each</h2>' + x.sec3 + "</section>" +
        '<section class="report-sec"><h2><span class="secno">4</span>Burn-down starting position</h2>' + x.sec4 + "</section>" +
        panelFoot() + "</article>" +
        '<div class="btn-row section-gap"><button type="button" class="btn btn-primary" data-act="audit-pilot">Take CS-02 into the pilot</button></div>';
    },
    act: {
      "audit-tile": function (s, arg) { s.tiles[arg] = !s.tiles[arg]; },
      "audit-pilot": function () { goGuided(slugIndex("skeleton"), 0, "anim"); return "nav"; }
    }
  };

  /* 5. Skeleton */
  V.skeleton = {
    reset: function () { return { tab: "files", inv: null }; },
    steps: [function () {}],
    render: function (s) {
      var text = REFS.A1.value.text;
      var hl = {};
      if (s.inv) {
        var i = lineIndex(text, "      " + s.inv + "  ");
        if (i >= 0) { hl[i] = "hl"; if (s.inv === "INV-2") hl[i + 1] = "hl"; }
      }
      var body;
      if (s.tab === "files") {
        body = '<div class="split split-8-4">' +
          '<div><div class="code-head"><span class="path">claims/intake/triage_skeleton.py</span><span>Human-authored. Signed on adoption.</span></div>' + codeBlock(text, { cls: hl, id: "skeleton-code" }) + "</div>" +
          '<div><h3 style="margin-bottom:8px">' + term("invariant", "Invariants") + '</h3><ul class="inv-list">' + D.invariants.map(function (v) {
            return '<li tabindex="0" data-inv="' + v.id + '"><b>' + v.id + "</b>" + esc(v.text) + "</li>";
          }).join("") + "</ul></div></div>" +
          '<h3 class="section-gap" style="margin-bottom:6px">Skeleton tests <span class="muted small" style="font-weight:400;overflow-wrap:anywhere">' + brk("tests/intake/test_triage_skeleton.py") + '</span></h3><ul class="test-list">' +
          D.skeletonTests.map(function (t) { return "<li><code>" + brk(t.name) + "</code><br><span class=\"small muted\">" + esc(t.meaning) + "</span></li>"; }).join("") + "</ul>";
      } else if (s.tab === "edit") {
        body = "<p>The drafted skeleton did not have INV-3. The developers added it, with a typed field for it.</p>" + diffBlock(D.developerDiff) +
          '<div class="comment"><div class="who">Comment from dev-1@acme.example and dev-2@acme.example</div>Windscreens with driver-assist cameras need recalibration. Claims has always wanted an adjuster to see these.</div>';
      } else {
        body = '<ul class="lines"><li>The skeleton is human-authored.</li><li>Copyright attaches to the human-authored skeleton only, since purely generated output may carry none.</li><li>The contract assigns the rest to the customer. Counsel confirms before any customer-facing claim.</li></ul>';
      }
      return '<div class="panel"><div class="pr-head"><div class="pr-title"><span class="pr-state">Open</span><h2>PR #214: ' + term("skeleton", "Skeleton") + " for route_claim (CS-02)</h2></div>" +
        '<p class="small muted" style="margin:6px 0 0">Drafted by the regufinder CLI from the scan and the traces. Edited by dev-1 and dev-2. Record ' + idTok("R3") + "</p></div>" +
        '<div class="tabs" role="tablist">' +
        [["files", "Files"], ["edit", "Developer edit"], ["why", "Why a person writes this"]].map(function (t) {
          return '<button type="button" role="tab" aria-selected="' + (s.tab === t[0]) + '" data-act="sk-tab" data-arg="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>" + body + panelFoot() + "</div>" +
        '<p class="note">No approve button here. Signing happens on the Review by diff screen, after the tests and gates.</p>';
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

  /* 6. Compile */
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
      return { compiled: false, view: "before", hover: null, tryc: { amount: "3200.00", injury_reported: false, third_party_involved: true, needs_recalibration: false, policy_age_days: 412, claims_last_12_months: 0 } };
    },
    steps: [function () {}],
    nextAction: function (s) { if (!s.compiled) { this.act["compile-run"](s); return true; } return false; },
    complete: function (s) { s.compiled = true; s.view = "compiled"; },
    render: function (s) {
      var before = REFS.A0.value.text;
      var skel = REFS.A1.value.text;
      var skStart = lineIndex(skel, "def route_claim");
      var compiled;
      if (!s.compiled && !isBusy("compile")) {
        compiled = '<div class="callout warn"><p>The compiled module is not generated yet. Press Compile (simulated).</p></div>';
      } else {
        var cls = {}, style = {};
        BRANCHES.forEach(function (b, i) {
          var k = D.compiledPaths[i].kind === "escalate" ? "hl-esc" : "hl";
          if (b.cond >= 0) style[b.cond] = "animation-delay:" + i * 200 + "ms";
          style[b.ret] = "animation-delay:" + (i * 200 + 80) + "ms";
          if (s.hover === i) { if (b.cond >= 0) cls[b.cond] = k; cls[b.ret] = k; }
          else { if (b.cond >= 0) cls[b.cond] = (cls[b.cond] || "") + " branch"; cls[b.ret] = (cls[b.ret] || "") + " branch"; }
        });
        if (isBusy("compile")) {
          // Stagger the branch lines one at a time.
          compiled = '<div class="code-head"><span class="path">claims/intake/triage_generated.py</span><span>run: 2</span></div>' + codeBlock(A3, { cls: cls, style: style, extra: "filling", id: "compiled-code" }) + busyBar("compile");
        } else {
          compiled = '<div class="code-head"><span class="path">claims/intake/triage_generated.py</span><span>run: 2. <button type="button" class="linkish" data-act="goto" data-arg="gates">Why run 2?</button> Record ' + idTok("R7") + '</span></div>' + codeBlock(A3, { cls: cls, id: "compiled-code" });
        }
      }
      var view = isBusy("compile") ? "compiled" : s.view;
      var shown;
      if (view === "before") shown = '<div class="code-head"><span class="path">claims/intake/triage.py</span><span>The call site as found</span></div>' + codeBlock(before);
      else if (view === "skeleton") shown = '<div class="code-head"><span class="path">claims/intake/triage_skeleton.py</span><span>Signature and invariants, human-authored</span></div>' + codeBlock(skel, { from: skStart });
      else shown = compiled;
      var showPaths = s.compiled || isBusy("compile");
      var paths = "";
      if (showPaths) {
        var rows = D.compiledPaths.map(function (p, i) {
          return '<tr data-branch="' + i + '"' + (s.hover === i ? ' class="hov"' : "") + '><td class="mono">' + esc(p.line || "otherwise") + "</td><td>" + (p.inv || "none") + "</td><td>" + p.classes.join(", ") + '</td><td class="r">' + fmtInt(p.traces) + "</td><td>" + (p.kind === "code" ? '<span class="badge pass">decided by code</span>' : '<span class="badge esc">escalates</span>') + "</td></tr>";
        }).join("");
        paths = '<div class="panel section-gap"><h2>Paths on the 12,000 ' + term("corpus", "corpus") + " traces</h2>" +
          '<div class="tbl-wrap"><table class="tbl path-tbl"><thead><tr><th>Branch</th><th>Invariant</th><th>From class</th><th class="r">Traces</th><th>Outcome</th></tr></thead><tbody>' + rows +
          '<tr class="total"><td>Decided by code</td><td></td><td></td><td class="r">7,800</td><td></td></tr><tr class="total2"><td>Escalates</td><td></td><td></td><td class="r">4,200</td><td></td></tr></tbody></table></div>' +
          '<div class="meter"><div class="sbar tall"><span class="b-code" style="width:65%"></span><span class="b-esc" style="width:35%"></span></div><div class="meter-labels"><span>65% decided by code</span><span>35% escalates</span></div></div>' +
          '<p class="small muted">The 12 recalibration traces are inside class A, where history routed them to FAST_TRACK. Hover a row to see its lines.</p>' + panelFoot() + "</div>";
      }
      var t = s.tryc;
      var tryForm = '<div class="panel section-gap"><h2>Try a claim</h2><p class="small muted">Runs the six-line function in your browser. An escalating input does not invent a model answer.</p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="try-preset" data-arg="escalate">Preset: CLM-2027-104417</button><button type="button" class="btn" data-act="try-preset" data-arg="code">Preset: CLM-2027-104418</button></div>' +
        '<form class="try-form" id="try-form" onsubmit="return false">' +
        '<label>Amount<input type="number" step="0.01" min="0" name="amount" value="' + esc(t.amount) + '"></label>' +
        '<label>Policy age in days<input type="number" step="1" min="0" name="policy_age_days" value="' + t.policy_age_days + '"></label>' +
        '<label>Claims in the last 12 months<input type="number" step="1" min="0" name="claims_last_12_months" value="' + t.claims_last_12_months + '"></label>' +
        '<label class="chk"><input type="checkbox" name="injury_reported"' + (t.injury_reported ? " checked" : "") + "> Injury reported</label>" +
        '<label class="chk"><input type="checkbox" name="third_party_involved"' + (t.third_party_involved ? " checked" : "") + "> Third party involved</label>" +
        '<label class="chk"><input type="checkbox" name="needs_recalibration"' + (t.needs_recalibration ? " checked" : "") + "> Needs recalibration</label>" +
        '</form><div id="try-result" aria-live="polite">' + tryResult(t, s.compiled) + "</div>" + panelFoot() + "</div>";

      var seg = '<div class="btn-row"><div class="seg" role="group" aria-label="Code view">' +
        [["before", "Before"], ["skeleton", "Skeleton"], ["compiled", "Compiled"]].map(function (t) {
          return '<button type="button" aria-pressed="' + (view === t[0]) + '" data-act="compile-view" data-arg="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>" +
        (!s.compiled && !isBusy("compile") ? '<button type="button" class="btn btn-sim" data-act="compile-run">Compile (simulated)</button>' : "") + "</div>";
      return seg + '<div class="panel code-panel">' + shown + "</div>" +
        paths +
        '<div class="facts section-gap"><div class="fact">Quarantine: 12,000 traces typed, 0 raw free-text fields reached the generator.</div><div class="fact">Generated modules are marked and regenerated, never hand-edited. A CI check enforces it.</div></div>' +
        tryForm;
    },
    act: {
      "compile-view": function (s, arg) { s.view = arg; },
      "compile-run": function (s) {
        s.view = "compiled";
        if (reducedMotion) { s.compiled = true; return; }
        simulate("compile", "Filling six branches from the traces", 1400, function () { s.compiled = true; });
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
  function tryResult(t, compiled) {
    var amount = Math.round(parseFloat(t.amount || "0") * 100);
    var claim = { amount_cents: isNaN(amount) ? 0 : amount, injury_reported: !!t.injury_reported, third_party_involved: !!t.third_party_involved,
      needs_recalibration: !!t.needs_recalibration, policy_age_days: parseInt(t.policy_age_days, 10) || 0, claims_last_12_months: parseInt(t.claims_last_12_months, 10) || 0 };
    var r = D.routeClaim(claim);
    var p = D.compiledPaths[r.branch];
    var branch = "Branch " + (r.branch + 1) + ": <code>" + esc(p.line || "otherwise") + "</code>" + (p.inv ? " (" + p.inv + ")" : "");
    if (r.escalate) return '<div class="result-line esc">Escalates to the Runtime. ' + branch + "</div>";
    return '<div class="result-line code">Decided by code: <span class="route">' + r.route + "</span>. " + branch + ". No model call.</div>";
  }

  /* 7. Test twice */
  V.tests = {
    reset: function () { return { ran: false, diffs: false, part: null, focusPanel: null }; },
    steps: [
      function (s, mode) {
        if (mode === "anim" && !s.ran) simulate("tests", "Running both tests on 12,000 traces and 230 cases", 1400, function () { s.ran = true; });
        else s.ran = true;
        if (mode !== "silent") { s.focus = "#test1"; s.focusPanel = "test1"; }
      },
      function (s, mode) { s.ran = true; s.diffs = true; if (mode !== "silent") { s.focus = "#diffs"; s.focusPanel = "test1"; } },
      function (s, mode) { s.ran = true; s.diffs = true; if (mode !== "silent") { s.focus = "#test2"; s.focusPanel = "test2"; } }
    ],
    render: function (s) {
      var head = "", casesHtml = "";
      if (!s.ran) {
        head = isBusy("tests") ? busyBar("tests") : '<div class="btn-row"><button type="button" class="btn btn-sim" data-act="tests-run">Run both tests (simulated)</button><span class="muted small">Both run against the run 2 module.</span></div>';
      }
      var t1 = '<div class="panel' + (s.focusPanel === "test1" ? " focus-ring" : "") + '" id="test1"><h2>Test 1: ' + term("equivalence test", "equivalence") + " to history</h2>";
      var t2 = '<div class="panel' + (s.focusPanel === "test2" ? " focus-ring" : "") + '" id="test2"><h2>Test 2: ' + term("accuracy test", "accuracy") + " against the " + term("Verification Set", "Verification Set") + "</h2>";
      if (!s.ran) {
        t1 += '<p class="pending">Not run yet.</p>';
        t2 += '<p class="pending">Not run yet.</p>';
      } else {
        t1 += '<div class="big-result">99.85%</div><p class="small muted">equivalence on decided traces</p>' +
          '<div class="tbl-wrap"><table class="tbl"><tbody>' +
          '<tr><td>Traces in corpus</td><td class="r">12,000</td></tr><tr><td>Decided by compiled code</td><td class="r">7,800</td></tr>' +
          '<tr><td>Escalated (not compared, handled by the Runtime)</td><td class="r">4,200</td></tr><tr><td>Decided and equal to history</td><td class="r">7,788</td></tr>' +
          '<tr><td>Decided and different from history</td><td class="r">12</td></tr><tr class="total"><td>Equivalence on decided traces</td><td class="r">7,788 / 7,800 = ' + pct(7788, 7800, 2) + "</td></tr></tbody></table></div>" +
          '<div class="meter"><div class="sbar tall"><span class="b-code" style="width:' + (7788 * 100 / 7800) + '%" title="7,788 equal to history"></span>' +
          '<button type="button" class="slice-btn b-diff" style="width:max(6px,' + (12 * 100 / 7800) + '%)" data-act="tests-diffs" aria-label="Open the 12 differences" title="12 different from history"></button></div>' +
          '<div class="meter-labels"><span>7,788 equal</span><button type="button" class="linkish" data-act="tests-diffs">12 different</button></div></div>' +
          '<div class="legend"><span><i class="b-code"></i>Equal to history</span><span><i class="b-diff"></i>Different from history</span></div>';
        if (s.diffs) {
          t1 += '<div class="diff-list" id="diffs"><div class="diff-row"><b>CLM-2027-031877</b>: amount 620.00, no injury, no third party, needs recalibration. History <span class="route">FAST_TRACK</span>. Compiled <span class="route">ADJUSTER</span>. Rule INV-3.</div>' +
            '<div class="diff-row">11 more with the same cause.</div>' +
            '<div class="diff-row">All 12 are windscreen claims with <code>needs_recalibration = true</code>. Cause: INV-3, written by the developers. Status: Explained by an invariant. Confirmed by the accuracy test.</div></div>';
        }
        t1 += '<p class="small" style="margin-top:12px">Record ' + idTok("R8") + "</p>";

        var rows = D.vsParts.map(function (p) {
          return '<tr class="clickable' + (s.part === p.key ? " selected" : "") + '" data-act="tests-part" data-arg="' + p.key + '" tabindex="0"><td>' + esc(p.part) + '</td><td class="r">' + p.cases + '</td><td class="r">' + p.decided + '</td><td class="r">' + p.escalated + "</td></tr>";
        }).join("");
        var cases = D.vsCases.filter(function (c) { return !s.part || c.part === s.part; });
        t2 += '<div class="big-result">120 of 120</div><p class="small muted">cases decided by code match the owner\'s label. Mismatches: 0.</p>' +
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Part</th><th class="r">Cases</th><th class="r">Decided by code</th><th class="r">Escalated</th></tr></thead><tbody>' + rows +
          '<tr class="total"><td>Total</td><td class="r">230</td><td class="r">120</td><td class="r">110</td></tr></tbody></table></div>' +
          '<p class="small muted">Labelled by the workflow owner: Head of Claims Operations, claims-owner@acme.example. About 30 cases to discover failure modes, then about 100 per mode to validate. The 110 escalated cases are not errors; they go to the Runtime and are recorded. Pass rule: zero mismatches on decided cases.</p>' +
          '<p class="small muted">Click a part to filter the sample cases below.</p>' +
          '<p class="small" style="margin-top:12px">Record ' + idTok("R9") + "</p>";
        casesHtml = '<div class="panel section-gap" id="cases"><h2>Verification Set: sample cases' + (s.part ? ' <button type="button" class="linkish small" data-act="tests-part" data-arg="">Show all</button>' : "") + "</h2>" +
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Case</th><th>Part</th><th>Features in brief</th><th>Owner label</th><th>Code result</th><th>Status</th></tr></thead><tbody>' +
          cases.map(function (c) {
            var part = c.part === "D" ? "Discovery" : c.part === "M1" ? "Mode 1" : "Mode 2";
            return "<tr><td><code>" + c.id + "</code></td><td>" + part + "</td><td>" + esc(c.brief) + '</td><td class="route">' + c.owner + '</td><td class="route">' + c.code + "</td><td>" + (c.status === "Match" ? '<span class="badge pass">Match</span>' : '<span class="badge esc">Escalated</span>') + "</td></tr>";
          }).join("") + "</tbody></table></div>" + panelFoot() + "</div>";
      }
      t1 += panelFoot() + "</div>";
      t2 += panelFoot() + "</div>";
      return head + '<div class="grid-2">' + t1 + t2 + "</div>" + casesHtml +
        '<p class="callout section-gap">Test 1 asks: does the code do what the model did? Test 2 asks: is that right? Here history was wrong on one pattern, and the second test is what shows the code is right to differ.</p>';
    },
    act: {
      "tests-run": function (s) { if (reducedMotion) { s.ran = true; return; } simulate("tests", "Running both tests on 12,000 traces and 230 cases", 1400, function () { s.ran = true; }); },
      "tests-diffs": function (s) { s.diffs = !s.diffs; if (s.diffs) s.focus = "#diffs"; },
      "tests-part": function (s, arg) { s.part = arg || null; if (arg) s.focus = "#cases"; }
    }
  };

  /* 8. Security gates */
  V.gates = {
    reset: function () { return { run: 1 }; },
    steps: [
      function (s) { s.run = 1; },
      function (s, mode) { s.run = 2; if (mode !== "silent") s.focus = "#gate-view"; }
    ],
    render: function (s) {
      var run = D.gateRuns[s.run];
      var rows = run.gates.map(function (g) {
        var b = g.result === "pass" ? '<span class="badge pass">Pass</span>' : g.result === "fail" ? '<span class="badge fail">Fail</span>' : '<span class="badge notrun">Not run</span>';
        return "<tr><td><b>" + g.gate + "</b></td><td>" + b + "</td><td>" + esc(g.detail) + "</td></tr>";
      }).join("");
      var body = '<div class="gate-head ' + (s.run === 1 ? "bad" : "good") + '">' + (s.run === 1 ? "PR blocked" : "All gates passed") + "</div>" +
        '<p class="small">Module run ' + s.run + ". Record " + idTok(run.record) + "</p>" +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Gate</th><th>Result</th><th>Detail</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
      var a2 = REFS.A2.value.text;
      var bad = lineIndex(a2, "from pydantic");
      var action = '<div class="action-card"><b>Regenerated with the allow-list as a constraint. Not edited by hand.</b><p class="small" style="margin:6px 0 0">Generated modules are never edited by hand. The module was regenerated with the allow-list as a constraint. Regenerate-not-edit CI check: <span class="badge pass">Pass</span></p></div>';
      if (s.run === 1) {
        var cls = {}; cls[bad] = "hl-bad";
        body += '<h3 class="section-gap" style="margin-bottom:6px">The offending import</h3>' + '<div class="code-head"><span class="path">claims/intake/triage_generated.py</span><span>run: 1</span></div>' + codeBlock(a2, { cls: cls, from: 0, to: bad + 2 }) + action +
          '<div class="btn-row"><button type="button" class="btn" data-act="gate-run" data-arg="2">See run 2</button></div>';
      } else {
        body = action + body;
      }
      return '<div class="btn-row"><div class="seg" role="group" aria-label="Gate run"><button type="button" aria-pressed="' + (s.run === 1) + '" data-act="gate-run" data-arg="1">Run 1</button><button type="button" aria-pressed="' + (s.run === 2) + '" data-act="gate-run" data-arg="2">Run 2</button></div>' +
        '<span class="muted small">Four ' + term("security gates", "security gates") + ". Gates block the PR. Findings are written to the ledger.</span></div>" +
        '<div class="panel" id="gate-view">' + body + panelFoot() + "</div>";
    },
    act: { "gate-run": function (s, arg) { s.run = +arg; } }
  };

  /* 9. Review by diff. Sign. */
  V.sign = {
    reset: function () { return { signed: false, changed: false }; },
    steps: [function () {}],
    nextAction: function (s) { if (!s.signed) { this.act["sign-do"](s); return true; } return false; },
    complete: function (s) { s.signed = true; },
    render: function (s) {
      var files = '<ul class="files">' + D.diffFiles.map(function (f) {
        return '<li><span class="mk ' + f.mark + '">' + f.mark + "</span><span><code>" + brk(f.path) + '</code><br><span class="small muted">' + esc(f.note) + "</span></span></li>";
      }).join("") + "</ul>";
      var evidence = '<ul class="evidence">' +
        "<li><span>Equivalence</span><span>" + idTok("R8") + ' <span class="badge pass">Pass</span></span></li>' +
        "<li><span>Accuracy</span><span>" + idTok("R9") + ' <span class="badge pass">Pass</span></span></li>' +
        "<li><span>Gates</span><span>" + idTok("R10") + ' <span class="badge pass">Passed</span></span></li></ul>';
      var card;
      if (!s.signed) {
        card = '<div class="sigcard unsigned" id="sigcard"><div class="sig-state">Awaiting signature</div>' +
          '<p>Adopter: claims-owner@acme.example (Head of Claims Operations).</p>' +
          '<div class="btn-row">' + (isBusy("sign") ? busyBar("sign") : '<button type="button" class="btn btn-sim" data-act="sign-do">Sign as Head of Claims Operations (simulated)</button>') + "</div></div>";
      } else {
        card = '<div class="sigcard ' + (s.changed ? "expired" : "valid") + '" id="sigcard"><div class="sig-state">' + (s.changed ? "Expired: the signed object changed" : "Valid") + "</div>" +
          '<p class="small muted" style="margin:4px 0 12px">' + term("rule-adoption signature", "Rule-adoption signature") + "</p>" +
          '<dl class="kv"><dt>Authors</dt><dd>dev-1@acme.example, dev-2@acme.example</dd><dt>Adopter</dt><dd>claims-owner@acme.example (Head of Claims Operations)</dd>' +
          "<dt>Signed</dt><dd>Skeleton " + idTok("R3") + "<br>Module " + idTok("R7") + "</dd><dt>Record</dt><dd>" + idTok("R11") + "</dd></dl>" +
          '<p class="small" style="margin-top:12px">Author identities are recorded separately from the adopter. Expires when the skeleton or the generated module changes.</p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="sign-change">' + (s.changed ? "Restore the generated module" : "Change the generated module") + "</button></div></div>";
      }
      return '<div class="grid-2"><div class="panel"><h2>PR #214: the diff</h2>' + files +
        '<h3 class="section-gap" style="margin-bottom:4px">Evidence</h3>' + evidence + panelFoot() + "</div>" +
        "<div>" + card + "</div></div>" +
        '<p class="callout section-gap">Compiled code is not claimed exempt from the EU AI Act or Colorado\'s law. The rule-adoption signature and the change-control record are what compliance requires.</p>';
    },
    act: {
      "sign-do": function (s) { if (reducedMotion) { s.signed = true; return; } simulate("sign", "Recording the signature", 900, function () { s.signed = true; s.changed = false; }); },
      "sign-change": function (s) { s.changed = !s.changed; }
    }
  };

  /* 10. Run and escalation */
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
    reset: function () { return { claim: "code", sent: false, step: -1, budget: false, focusEl: null }; },
    steps: [
      function (s, mode) { s.claim = "code"; s.sent = true; if (mode === "anim") V.run.play(s); },
      function (s, mode) { s.claim = "escalate"; s.sent = true; if (mode === "anim") V.run.play(s); },
      function (s, mode) { s.claim = "escalate"; s.sent = true; if (mode !== "silent") { s.focus = "#dr"; s.focusEl = "dr"; } },
      function (s, mode) { s.claim = "escalate"; s.sent = true; if (mode !== "silent") { s.focus = "#loop"; s.focusEl = "loop"; } }
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
      var card = '<div class="panel claim-card"><h2>Claim <code>' + c.claim_id + "</code></h2><dl class=\"kv\">" +
        "<dt>amount</dt><dd>" + fmtMicro(c.amount_cents * 10000, 2) + " (amount_cents " + c.amount_cents + ")</dd>" +
        "<dt>injury_reported</dt><dd>" + c.injury_reported + "</dd><dt>third_party_involved</dt><dd>" + c.third_party_involved + "</dd>" +
        "<dt>policy_age_days</dt><dd>" + c.policy_age_days + "</dd><dt>claims_last_12_months</dt><dd>" + c.claims_last_12_months + "</dd>" +
        "<dt>needs_recalibration</dt><dd>" + c.needs_recalibration + "</dd>" +
        (c.statement ? "<dt>statement (free text)</dt><dd>\"" + esc(c.statement) + "\"</dd>" : "") + "</dl>" +
        '<div class="btn-row"><button type="button" class="btn btn-sim" data-act="run-send"' + (playing ? " disabled" : "") + ">Send claim (simulated)</button>" +
        (playing ? '<button type="button" class="linkish" data-act="skip">Skip</button>' : "") + "</div>" + panelFoot() + "</div>";

      var code = '<div class="panel"><div class="code-head"><span class="path">claims/intake/triage_generated.py</span><span>run: 2</span></div>' +
        codeBlock(A3, { from: RUN_FN_START, id: "run-code", extra: "gutter" }) + "</div>";

      var outcome = "";
      if (finished) {
        if (s.claim === "code") {
          outcome = '<div class="result-line code section-gap">Decided by code. No model call. No Decision Record. Route: <span class="route">FAST_TRACK</span>.</div>';
        } else {
          outcome = '<div class="stages">' +
            '<div class="stage on ok"><b>Compiled code</b>Branch 3: third party involved. Not determined, so <code>escalate(claim)</code>.</div>' +
            '<div class="stage on"><b>' + term("shim", "Shim") + "</b>Typed, budgeted, recorded call through the customer's gateway.</div>" +
            '<div class="stage on' + (s.budget ? "" : " ok") + '"><b>Runtime: verify by risk class</b>' + (s.budget ? "<code>BudgetExhausted</code>. The claim goes to the manual queue." : 'Risk class high. Output <span class="route">ADJUSTER</span>. Checks pass.') + "</div></div>" +
            '<div class="grid-2"><div><div class="code-head"><span class="path">claims/escalation.py</span><span>The shim, signature only</span></div>' + codeBlock(D.escalateSignature) + '</div>' +
            '<div class="small"><p><b>The ' + term("Escalation Contract", "Escalation Contract") + '</b> is how compiled code calls the Runtime on paths it cannot determine.</p><p>The shim makes a typed, budgeted, recorded call through the customer\'s gateway. It writes a Decision Record. It returns a Route, or raises <code>BudgetExhausted</code>, a typed outcome, so the caller sends the claim to the manual queue.</p></div></div>' +
            '<label class="toggle small"><input type="checkbox" data-act="run-budget"' + (s.budget ? " checked" : "") + "> Show budget exhausted (simulated)</label>" +
            this.dr(s);
        }
      } else if (!s.sent) {
        outcome = '<p class="muted section-gap">Send the claim to watch the path through the compiled code.</p>';
      }

      var loop = '<h2 class="section-gap" id="loop" style="margin-bottom:12px">The run loop</h2><div class="loop-cards' + (s.focusEl === "loop" ? " focus-ring" : "") + '">' +
        '<div class="panel"><div class="chips"><span class="chip planned">Planned</span></div><h3 style="margin:10px 0 6px">Escalations feed the corpus</h3><p>4,200 escalations in the sample week were added to the corpus.</p>' + panelFoot() + "</div>" +
        '<div class="panel"><div class="chips"><span class="chip planned">Planned</span></div><h3 style="margin:10px 0 6px">The Compiler proposes the next compilation</h3><p class="small">Among the escalations, 1,050 claims share a pattern: third party involved, the other party admitted liability in writing, amount 1,500 or less. All 1,050 were routed FAST_TRACK.</p><p class="small">Proposal: add a typed field <code>liability_admitted</code> to the skeleton and compile this branch. Effect if adopted: code decides 7,800 + 1,050 = 8,850 of 12,000 = ' + pct(8850, 12000, 2) + '.</p><p class="small muted">Status: Proposal. Needs a skeleton change by the developers and a new signature.</p>' + panelFoot() + "</div>" +
        '<div class="panel"><div class="chips"><span class="chip planned">Planned</span></div><h3 style="margin:10px 0 6px">' + term("decay monitor", "Decay monitor") + '</h3><ul class="lines small"><li>Shadow-sample fraction: 2%</li><li>Shadow samples in the sample week: 156</li><li>Divergent: 0</li><li>Threshold in the sample policy: de-compile flag if more than 10 per 1,000 diverge</li><li>Status: <span class="badge pass">Within threshold</span></li></ul><p class="small muted" style="margin-top:8px">Design only this quarter.</p>' + panelFoot() + "</div></div>";

      return '<div class="btn-row"><div class="seg" role="group" aria-label="Sample claim"><button type="button" aria-pressed="' + (s.claim === "code") + '" data-act="run-claim" data-arg="code">Claim decided by code</button><button type="button" aria-pressed="' + (s.claim === "escalate") + '" data-act="run-claim" data-arg="escalate">Claim that escalates</button></div></div>' +
        '<div class="run-grid">' + card + code + "</div>" + outcome + loop;
    },
    dr: function (s) {
      var r = REFS.R12.value;
      var bx = s.budget;
      function f(label, val, proposed) { return '<div class="dr-field"><div class="lbl">' + label + (proposed ? '<span class="proposed">proposed field</span>' : "") + '</div><div class="val">' + val + "</div></div>"; }
      return '<div class="dr section-gap' + (s.focusEl === "dr" ? " focus-ring" : "") + '" id="dr"><div class="code-head"><h2>' + term("Decision Record", "Decision Record") + (bx ? "" : " R12") + "</h2>" + (bx ? '<span class="badge esc">Display only. This variant is not in the ledger.</span>' : "<span>" + idTok("R12") + "</span>") + "</div>" +
        '<div class="dr-grid">' +
        f("Policy hash", idTok("P1", "view-obj")) +
        f("policy_id", "<code>" + r.policy_id + "</code>", true) +
        f("risk_class", "<code>" + r.risk_class + "</code>", true) +
        f("Model and version", "<code>" + r.model + "</code> " + r.model_version) +
        f("Context manifest", "claim_features " + idTok("F1", "view-obj") + "<br>statement " + idTok("S1", "view-obj") + "<br>module " + idTok("R7", "view-obj")) +
        f("Tool calls", "none") +
        f("Output hash", bx ? "none" : idTok("O1", "view-obj") + ' <span class="route">ADJUSTER</span>') +
        f("Verification outcome", bx ? "<code>budget_exhausted</code>" : "<code>verified</code><br><span class=\"small\">output_is_a_route: pass. invariants_INV-1_to_INV-4: pass.</span>") +
        f("Budget", "tokens " + fmtInt(r.budget.used_tokens) + " of " + fmtInt(r.budget.max_tokens) + "<br>cost " + usd(r.budget.used_micro_usd, 3) + " of " + usd(r.budget.max_micro_usd, 3) +
          (bx ? "<br>time " + fmtInt(r.budget.timeout_ms) + " ms of " + fmtInt(r.budget.timeout_ms) + ' ms<br><span class="dr-limit">Limit reached: timeout. The call was stopped before it returned a route.</span>'
              : "<br>time " + fmtInt(r.budget.elapsed_ms) + " ms of " + fmtInt(r.budget.timeout_ms) + " ms")) +
        f("certificate", "<code>null</code>", true) +
        '</div><p class="small muted" style="margin-top:12px">Policy hash, context manifest, model and version, tool calls, output hash, verification outcome and budget are the fields in the plan. Fields marked proposed are additions recommended in the project\'s own review.</p>' + panelFoot() + "</div>";
    },
    mount: function (s) { if (s.sent) V.run.paintPath(s); },
    act: {
      "run-claim": function (s, arg) { s.claim = arg; s.sent = false; s.step = -1; },
      "run-send": function (s) { s.sent = true; V.run.play(s); },
      "run-budget": function (s, arg, el) { s.budget = el.checked; }
    }
  };

  /* 11. Ledger */
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
      return { records: L.records.slice(0, 14).map(function (r) { return clone(r.value); }), verify: null, sel: sel, tab: "record", tampered: null, edit: false, error: null };
    },
    steps: [
      function () {},
      function (s, mode) { V.ledger.doVerify(s, mode); },
      function (s, mode) { V.ledger.tamper(s, "R9"); V.ledger.doVerify(s, mode); },
      function (s, mode) { V.ledger.restore(s); V.ledger.doVerify(s, mode); }
    ],
    doVerify: function (s, mode) {
      if (mode === "anim" && !reducedMotion) {
        simulate("verify", "Recomputing 14 record ids, 14 entry ids and 14 object ids with SHA-256", 1000, function () { s.verify = verifyLedger(s.records); });
      } else {
        s.verify = verifyLedger(s.records);
      }
      if (mode !== "silent") s.focus = "#ledger-status";
    },
    tamper: function (s, which) {
      s.records = L.records.slice(0, 14).map(function (r) { return clone(r.value); });
      if (which === "R9") { s.records[8].mismatches = 1; s.sel = "R9"; }
      else { s.records[7].different = 0; s.sel = "R8"; }
      s.tampered = which; s.verify = null; s.tab = "record";
    },
    restore: function (s) {
      s.records = L.records.slice(0, 14).map(function (r) { return clone(r.value); });
      s.tampered = null; s.verify = null; s.edit = false; s.error = null;
    },
    render: function (s) {
      var v = s.verify;
      var status;
      if (isBusy("verify")) status = busyBar("verify");
      else if (!v) status = '<div class="status-line" id="ledger-status">' + (s.tampered ? "A record was changed. Verify the chain again." : "Not verified yet in this browser.") + "</div>";
      else if (v.okCount === 14 && v.rootOk) status = '<div class="status-line ok" id="ledger-status">Chain verified: 14 of 14 entries. ' + fmtInt(v.bytes) + " bytes hashed in your browser. Objects: " + v.objOk + " of " + v.objTotal + " ids match. Test vector: " + (v.tvOk ? "pass" : "fail") + ".</div>";
      else status = '<div class="status-line bad" id="ledger-status">Chain broken at entry ' + (v.firstBad + 1) + ": " + v.okCount + " of 14 entries verify. " + fmtInt(v.bytes) + " bytes hashed in your browser.</div>";

      var chain = '<ol class="chain">' + L.entries.map(function (e, i) {
        var ref = RECORD_REFS[i];
        var r = v ? v.results[i] : null;
        var ok = r ? r.recordOk && r.prevOk && r.entryOk : null;
        var err = "";
        if (r && !r.recordOk) err = "Record id no longer matches";
        else if (r && !r.prevOk) err = "Previous entry id no longer matches";
        return '<li class="' + (ok === null ? "" : ok ? "ok" : "bad") + '"><span class="node" aria-hidden="true">' + (ok === null ? "" : ok ? "&#10003;" : "!") + "</span>" +
          '<button type="button" class="entry' + (s.sel === ref ? " sel" : "") + '" data-act="led-sel" data-arg="' + ref + '">' +
          '<span class="entry-top"><span class="entry-seq">' + e.entry.seq + '</span><span class="entry-kind">' + e.entry.kind + '</span><span class="entry-at">' + e.entry.at + "</span></span>" +
          '<span class="entry-desc" style="display:block">' + esc(LEDGER_DESC[ref]) + "</span>" +
          '<span class="entry-ids"><span>record</span><code>' + esc(shortId(e.entry.record)) + "</code><span>entry</span><code>" + esc(shortId(e.id)) + "</code><span>prev</span><code>" + (e.entry.prev ? esc(shortId(e.entry.prev)) : "null") + "</code></span>" +
          (err ? '<span class="entry-err" style="display:block">' + err + "</span>" : "") +
          "</button></li>";
      }).join("") + "</ol>";

      var objects = '<div class="panel section-gap"><h2>Objects the records point to</h2><p class="small muted">Artefacts, the policy and the small objects referenced by records. Each id is a content id too.</p><ul class="obj-list">' +
        L.objects.concat(L.records.filter(function (r) { return r.ref === "D-CS04"; })).map(function (o) {
          return '<li class="' + (s.sel === o.ref ? "sel" : "") + '"><button type="button" class="linkish" data-act="led-sel" data-arg="' + o.ref + '">' + o.ref + "</button> <span class=\"small\" style=\"flex:1\">" + esc(D.objectLabels[o.ref]) + "</span>" + idTok(o.ref) + "</li>";
        }).join("") + "</ul>" + panelFoot() + "</div>";

      return '<div class="ledger-top"><div>' +
        "<p>Every step left a record in the " + term("Tenant Ledger", "Tenant Ledger") + ". Each " + term("content id", "content id") + " below was computed at build time by the repository's own Python <code>content_id</code>. Verify recomputes them here, in JavaScript, and compares. This part is real.</p>" +
        '<p><b>Root</b> ' + idTok("E14") + "</p>" + status +
        '<div class="btn-row"><button type="button" class="btn btn-primary" data-act="led-verify">Verify chain</button>' +
        '<button type="button" class="btn" data-act="led-tamper" data-arg="R9">Tamper: R9 mismatches 0 to 1</button>' +
        '<button type="button" class="btn" data-act="led-tamper" data-arg="R8">Tamper: R8 different 12 to 0</button>' +
        '<button type="button" class="btn btn-quiet" data-act="led-reset">Reset</button></div>' +
        '<p class="small muted">You can check any record yourself with the project\'s command line tool: save the JSON to a file and run <code>regufinder hash file.json</code>.</p></div>' +
        '<div class="anchor"><b>Anchor (sample)</b><br>Root anchored externally. Sample anchor reference: <code>' + L.anchor + '</code>.<p class="small muted" style="margin:6px 0 0">The plan describes the Tenant Ledger as a thin Postgres hash chain with externally anchored roots that verifies offline. Here the chain lives in the page and verifies in your browser.</p></div></div>' +
        '<div class="ledger-cols section-gap"><div>' + chain + "</div>" +
        '<div class="detail panel" id="ledger-detail">' + this.detail(s) + panelFoot() + "</div></div>" + objects;
    },
    detail: function (s) {
      var ref = s.sel;
      var isRecord = RECORD_REFS.indexOf(ref) !== -1;
      var value = isRecord ? s.records[RECORD_REFS.indexOf(ref)] : REFS[ref].value;
      var label = isRecord ? "Entry " + (RECORD_REFS.indexOf(ref) + 1) + ": " + ref + " " + value.type : ref + ": " + D.objectLabels[ref];
      var tabs = isRecord ? [["record", "Record"], ["canon", "Canonical JSON"], ["entry", "Entry"]] : [["record", "Object"], ["canon", "Canonical JSON"]];
      var tab = s.tab === "entry" && !isRecord ? "record" : s.tab;
      var body;
      if (tab === "record") {
        if (s.edit && isRecord) {
          body = '<p class="small">Edit one value, then apply and verify. Values must be integers, strings, booleans or null. No floats.</p>' +
            '<textarea class="tamper-area" id="tamper-text" spellcheck="false">' + esc(JSON.stringify(value, null, 2)) + "</textarea>" +
            (s.error ? '<p class="cross small">' + esc(s.error) + "</p>" : "") +
            '<div class="btn-row"><button type="button" class="btn btn-primary" data-act="led-apply">Apply and verify</button><button type="button" class="btn btn-quiet" data-act="led-edit">Cancel</button></div>';
        } else {
          body = '<pre class="json">' + jsonHtml(value) + "</pre>" + (isRecord ? '<div class="btn-row"><button type="button" class="btn" data-act="led-edit">Tamper with this record</button></div>' : "");
          if (!isRecord && value && typeof value.text === "string" && /\.py$/.test(value.path)) body += '<h3 class="section-gap" style="margin-bottom:6px">Text as a file</h3>' + codeBlock(value.text);
        }
      } else if (tab === "canon") {
        var text = C.canonicalText(value);
        body = '<p class="small muted">The exact bytes that are hashed: ' + fmtInt(C.utf8(text).length) + " bytes of UTF-8.</p>" + '<pre class="json wrap">' + esc(text) + "</pre>" +
          '<p class="small">sha256 of these bytes: <code style="overflow-wrap:anywhere">' + C.contentId(value) + "</code></p>";
      } else {
        var i = RECORD_REFS.indexOf(ref), e = L.entries[i];
        body = '<pre class="json">' + jsonHtml(e.entry) + '</pre><p class="small">Entry id ' + idTok("E" + e.entry.seq) + "</p>" +
          '<p class="small muted">The entry carries the id of the previous entry, so changing any record changes every entry after it.</p>';
      }
      var idLine = isRecord ? '<p class="small">Record id in the ledger ' + idTok(ref) + "</p>" : '<p class="small">Id ' + idTok(ref) + "</p>";
      if (isRecord && C.canonicalText(value) !== C.canonicalText(REFS[ref].value)) {
        idLine += '<p class="callout bad small">This record was changed in your browser. Its content now hashes to <code style="overflow-wrap:anywhere">' + esc(C.contentId(value)) + "</code>, which is not the id the ledger holds.</p>";
      }
      return "<h2>" + esc(label) + "</h2>" + idLine +
        '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" data-act="led-tab" data-arg="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" + body;
    },
    act: {
      "led-sel": function (s, arg) { s.sel = arg; s.edit = false; s.error = null; if (window.innerWidth < 1000) s.focus = "#ledger-detail"; },
      "led-tab": function (s, arg) { s.tab = arg; },
      "led-verify": function (s) { V.ledger.doVerify(s, "anim"); },
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

  /* 12. Runtime */
  V.runtime = {
    reset: function () { return { b: false, c: false }; },
    complete: function (s) { s.b = true; s.c = true; },
    steps: [function () {}],
    nextAction: function (s) {
      if (!s.b) { this.act["rt-replay"](s, "b"); return true; }
      if (!s.c) { this.act["rt-replay"](s, "c"); return true; }
      return false;
    },
    render: function (s) {
      var state = s.b ? '<span class="badge state-portable">portable</span>' : '<span class="badge state-locked">origin-locked</span>';
      var dr = REFS["D-CS04"].value;
      var head = '<div class="panel"><div class="rt-head"><h2>CS-04 <code>draft_customer_letter</code></h2><span>Score 3.5 bits, <span class="bucket-open">open</span></span><span>State ' + state + "</span></div>" +
        '<p class="small muted" style="margin-top:8px">This call site is open, so the model stays. The Runtime records it, verifies it by risk class, and certifies a replacement model.</p>' +
        codeBlock(D.stubs["CS-04"]) + panelFoot() + "</div>";

      var record = '<div class="panel"><h2>Record</h2><p><b>9,000</b> calls in the sample week. <b>9,000</b> Decision Records.</p>' +
        '<dl class="kv"><dt>Example</dt><dd>' + idTok("D-CS04") + "</dd><dt>Claim</dt><dd><code>" + dr.claim_id + "</code></dd><dt>Risk class</dt><dd>" + dr.risk_class + "</dd><dt>Tool calls</dt><dd><code>lookup_payment_schedule</code></dd><dt>Verification</dt><dd>" + dr.verification.outcome + "</dd></dl>" +
        '<div class="btn-row"><button type="button" class="btn" data-act="rt-open-dr">Open the Decision Record</button></div>' + panelFoot() + "</div>";

      var rc = D.riskClasses;
      var verify = '<div class="panel"><h2>Verify by risk class</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Risk class</th><th>Meaning in this sample</th><th>Checks</th><th class="r">Calls</th><th class="r">Passed</th><th class="r">Held</th></tr></thead><tbody>' +
        rc.map(function (r) { return "<tr><td><b>" + r.cls + "</b></td><td>" + esc(r.meaning) + "</td><td>" + esc(r.checks) + '</td><td class="r">' + fmtInt(r.calls) + '</td><td class="r">' + fmtInt(r.passed) + '</td><td class="r">' + r.held + "</td></tr>"; }).join("") +
        '<tr class="total"><td>Total</td><td></td><td></td><td class="r">' + fmtInt(sum(rc, function (r) { return r.calls; })) + '</td><td class="r">' + fmtInt(sum(rc, function (r) { return r.passed; })) + '</td><td class="r">' + sum(rc, function (r) { return r.held; }) + "</td></tr></tbody></table></div>" +
        '<p class="small">Held share: 90 / 9,000 = ' + pct(90, 9000, 0) + ". Checks on the example record: " +
        dr.verification.checks.map(function (c) { return '<span class="check-name term" tabindex="0" data-def="' + esc(D.checkMeanings[c.check]) + '">' + c.check + "</span>"; }).join(", ") + ".</p>" +
        '<p class="note">The spec says outputs are verified by risk class. It does not define the classes yet. These are illustrative.</p>' + panelFoot() + "</div>";

      var rows = D.certRows.map(function (r, i) {
        var key = i === 1 ? "b" : i === 2 ? "c" : null;
        var shown = key === null || s[key];
        if (key && isBusy("replay-" + key)) return "<tr><td><code>" + r.model + '</code></td><td colspan="4">' + busyBar("replay-" + key) + "</td></tr>";
        if (!shown) return "<tr><td><code>" + r.model + '</code></td><td colspan="4"><button type="button" class="btn btn-sim" data-act="rt-replay" data-arg="' + key + '">Replay 500 recorded calls on ' + r.model + " (simulated)</button></td></tr>";
        var res = r.result === "Certified" ? '<span class="badge pass">Certified</span>' : r.result === "Not certified" ? '<span class="badge fail">Not certified</span>' : '<span class="badge notrun">Baseline</span>';
        return "<tr><td><code>" + r.model + "</code>" + (r.role ? ' <span class="small muted">(' + r.role + ")</span>" : "") + '</td><td class="r">' + r.replayed + '</td><td class="r">' + r.passed + '</td><td class="r">' + (r.newHigh === null ? "not applicable" : r.newHigh) + "</td><td>" + res + "</td></tr>";
      }).join("");
      var certify = '<div class="panel"><h2>Certify a replacement model</h2><p>500 recorded calls (350 medium, 150 high) are replayed on each candidate and the same checks are applied. Rule in the sample policy: certify when the candidate passes at least as many replayed calls as the origin model and has zero new failures in the high class.</p>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Model</th><th class="r">Replayed</th><th class="r">Passed checks</th><th class="r">New failures in high class</th><th>Result</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        (s.b ? '<p class="callout">CS-04 moves from origin-locked to portable. Certificate record ' + idTok("R14") + "</p>" : "") +
        '<p class="note">The certificate format is not defined in the spec yet. This record is a sketch.</p>' + panelFoot() + "</div>";

      return head + '<div class="section-gap">' + record + "</div>" + '<div class="section-gap">' + verify + "</div>" + '<div class="section-gap">' + certify + "</div>";
    },
    act: {
      "rt-replay": function (s, arg) {
        if (reducedMotion) { s[arg] = true; return; }
        simulate("replay-" + arg, "Replaying 500 calls", 1200, function () { s[arg] = true; });
      },
      "rt-open-dr": function () { openDecisionRecordModal(); }
    }
  };

  /* 13. Reports */
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
    for (var d = 0; d <= 7; d++) svg += '<line class="grid" x1="' + x0 + '" x2="' + x1 + '" y1="' + Y(d) + '" y2="' + Y(d) + '"/><text x="' + (x0 - 8) + '" y="' + (Y(d) + 4) + '" text-anchor="end">$' + d + "</text>";
    for (var t = 0; t <= 200; t += 50) svg += '<line class="axis" x1="' + X(t) + '" x2="' + X(t) + '" y1="' + y0 + '" y2="' + (y0 + 5) + '"/><text x="' + X(t) + '" y="' + (y0 + 20) + '" text-anchor="middle">' + t + "</text>";
    svg += '<text x="' + ((x0 + x1) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Transactions</text>';
    svg += '<line class="l-cost" x1="' + X(0) + '" x2="' + X(200) + '" y1="' + Y(2.8) + '" y2="' + Y(2.8) + '"/>';
    svg += '<line class="l-save" x1="' + X(0) + '" x2="' + X(200) + '" y1="' + Y(0) + '" y2="' + Y(200 * 0.03185) + '"/>';
    var cx = X(2.8 / 0.03185), cy = Y(2.8);
    svg += '<line class="grid" x1="' + cx + '" x2="' + cx + '" y1="' + cy + '" y2="' + y0 + '" stroke-dasharray="4 3"/>';
    svg += '<circle class="cross-dot" cx="' + cx + '" cy="' + cy + '" r="5"/><text x="' + (cx + 10) + '" y="' + (cy + 26) + '" style="font-weight:700">88 transactions</text>';
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
      svg += '<g style="opacity:' + (i === sel ? 1 : 0.45) + '" data-act="burn-snap" data-arg="' + i + '" class="marker">';
      b.counts.forEach(function (c, k) {
        if (!c) return;
        svg += '<rect class="s-' + k + '" style="fill:var(' + ["--locked", "--portable", "--compiled", "--retired"][k] + ')" x="' + x + '" y="' + Y(acc + c) + '" width="' + bw + '" height="' + (Y(acc) - Y(acc + c)) + '"/>';
        acc += c;
      });
      svg += '<text x="' + (x + bw / 2) + '" y="' + (y0 + 18) + '" text-anchor="middle"' + (i === sel ? ' style="font-weight:700"' : "") + ">" + i + "</text></g>";
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
      function (s) { s.tab = "burndown"; }
    ],
    render: function (s) {
      var tabs = '<div class="tabs" role="tablist">' + [["audit", "Audit"], ["breakeven", "Break-even (CS-02)"], ["burndown", "Burn-down"]].map(function (t) {
        return '<button type="button" role="tab" aria-selected="' + (s.tab === t[0]) + '" data-act="rep-tab" data-arg="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>";
      var body;
      if (s.tab === "audit") {
        var x = auditSections({ tiles: {} }, true);
        body = '<div class="grid-2"><div class="panel"><h3 style="margin-bottom:10px">Share that qualifies</h3>' + x.sec1 + panelFoot() + "</div>" +
          '<div class="panel"><h3 style="margin-bottom:10px">Burn-down starting position</h3>' + x.sec4 + panelFoot() + "</div></div>" +
          '<div class="panel section-gap"><h3 style="margin-bottom:10px">Top three candidates and break-even</h3>' + x.sec2 + x.sec3 + panelFoot() + "</div>" +
          '<div class="btn-row"><button type="button" class="linkish" data-act="goto" data-arg="audit">Open the full audit report</button></div>';
      } else if (s.tab === "breakeven") {
        var rows = breakEvenRows().map(function (r) {
          var val;
          if (r[3] === null) val = r[2];
          else val = s.micro ? fmtInt(r[2]) : usd(r[2], r[3]);
          return "<tr><td>" + r[0] + '</td><td class="small">' + esc(r[1]) + '</td><td class="r">' + val + "</td></tr>";
        }).join("");
        var pf = D.portfolio;
        var callsAfter = sum(pf, function (p) { return p.callsAfter; }), spendAfter = sum(pf, function (p) { return p.spendAfterMicro; });
        var stateCls = { compiled: "state-compiled", portable: "state-portable", "origin-locked": "state-locked", retired: "state-retired" };
        body = '<div class="btn-row"><div class="seg" role="group" aria-label="Units"><button type="button" aria-pressed="' + !s.micro + '" data-act="rep-units" data-arg="usd">Dollars</button><button type="button" aria-pressed="' + s.micro + '" data-act="rep-units" data-arg="micro">Stored micro-dollars</button></div><span class="small muted">Records store integer micro-dollars (1 dollar = 1,000,000). No floats.</span></div>' +
          '<div class="panel chart wide"><h2>Break-even at 88 transactions</h2>' + breakEvenChart() + '<div class="legend"><span><i style="background:var(--escalate)"></i>One-off model cost</span><span><i style="background:var(--compiled)"></i>Cumulative net saving ($0.03185 per transaction)</span></div>' + panelFoot() + "</div>" +
          '<div class="panel section-gap"><h2>' + term("break-even report", "Break-even report") + ' for CS-02</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Line</th><th>Arithmetic</th><th class="r">' + (s.micro ? "Micro-dollars" : "Value") + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>" + panelFoot() + "</div>" +
          '<div class="panel section-gap"><h2>Portfolio after the walkthrough</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Call site</th><th>State</th><th class="r">Model calls per week after</th><th class="r">Weekly spend after</th><th>Arithmetic</th></tr></thead><tbody>' +
          pf.map(function (p) { return "<tr><td><b>" + p.id + '</b></td><td><span class="badge ' + stateCls[p.state] + '">' + p.label + '</span></td><td class="r">' + fmtInt(p.callsAfter) + '</td><td class="r">' + (s.micro ? fmtInt(p.spendAfterMicro) : usd(p.spendAfterMicro)) + '</td><td class="small">' + esc(p.arithmetic) + "</td></tr>"; }).join("") +
          '<tr class="total"><td>Total</td><td></td><td class="r">' + fmtInt(callsAfter) + '</td><td class="r">' + (s.micro ? fmtInt(spendAfter) : usd(spendAfter)) + "</td><td></td></tr></tbody></table></div>" +
          '<div class="totals"><div class="fig"><b>' + usd(1800000000 - spendAfter) + "</b><span>weekly saving: 1,800.00 - 1,017.96 (" + pct(1800000000 - spendAfter, 1800000000, 1) + ' of spend). Equals the audit estimate.</span></div>' +
          '<div class="fig"><b>' + pct(48000 - callsAfter, 48000, 1) + "</b><span>LLM-free share of runtime paths: (48,000 - 16,836) / 48,000 = 31,164 / 48,000</span></div></div>" + panelFoot() + "</div>";
      } else {
        var b = D.burndown[s.snap];
        var cols = D.burnStates.map(function (name, k) {
          var cards = D.inventory.filter(function (r) { return b.states[r.id] === k; }).map(function (r) {
            var moved = s.snap !== s.prevSnap && D.burndown[s.prevSnap].states[r.id] !== k;
            return '<button type="button" class="cs-card s-col-' + k + (moved ? " moved" : "") + '" data-act="burn-card" data-arg="' + r.id + '"><b>' + r.id + "</b>" + esc(r.fn) + "</button>";
          }).join("");
          return '<div class="board-col"><h3><span>' + name + "</span><span>" + b.counts[k] + "</span></h3>" + cards + "</div>";
        }).join("");
        body = '<div class="split split-5-6"><div class="panel chart"><h2>' + term("burn-down", "Burn-down") + "</h2>" + burnChart(s.snap) +
          '<div class="legend">' + D.burnStates.map(function (n, k) { return '<span><i class="s-' + k + '"></i>' + n + "</span>"; }).join("") + "</div>" +
          '<p class="small muted">Sample steps, not a delivery schedule.</p>' + panelFoot() + "</div>" +
          '<div class="panel"><div class="slider-row"><button type="button" class="btn" data-act="burn-play">' + (s.playing ? "Pause" : "Play") + '</button><input type="range" min="0" max="5" step="1" value="' + s.snap + '" data-act="burn-range" aria-label="Snapshot"><span class="num"><b>Snapshot ' + s.snap + "</b></span></div>" +
          '<p><b>' + esc(b.changed) + "</b></p>" + '<div class="board">' + cols + "</div>" + panelFoot() + "</div></div>" +
          '<p class="quote section-gap">"Every runtime LLM call site is origin-locked, portable, compiled or retired. Progress is movement to the right, per codebase, per team, per company."</p>';
      }
      return tabs + body;
    },
    act: {
      "rep-tab": function (s, arg) { s.tab = arg; },
      "rep-units": function (s, arg) { s.micro = arg === "micro"; },
      "burn-snap": function (s, arg) { V.reports.setSnap(s, +arg); },
      "burn-range": function (s, arg, el) { V.reports.setSnap(s, +el.value); },
      "burn-card": function (s, arg) { openInventoryModal(arg); },
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

  /* 14. What is built today */
  V.built = {
    reset: function () { return {}; },
    steps: [function () {}],
    render: function () {
      return '<div class="two-col"><div><h2>Built and tested today</h2><ul>' + D.builtToday.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
        '<div><h2>Planned, not built yet</h2><ul>' + D.plannedList.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></div>" +
        '<p class="section-gap">All data in this walkthrough is illustrative. No customer, pilot or measured result is shown or implied.</p>' +
        "<p>Plan: 2 Nov 2026 to 31 Jan 2027, 76 tasks and 15 milestones. First paid pilot targeted at month 3 to 5.</p>";
    }
  };

  /* ---------------------------------------------------------------- modals */

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
    var html = '<p class="small">' + esc(D.objectLabels[ref] || (ref + " " + (o.value.type || ""))) + "</p>" +
      '<p class="small">Content id <code style="overflow-wrap:anywhere">' + esc(o.id) + "</code></p>" +
      '<h3 style="margin:10px 0 6px">Canonical JSON</h3><pre class="json wrap">' + esc(C.canonicalText(o.value)) + "</pre>" +
      '<p class="small muted">Recomputed in your browser: ' + (C.contentId(o.value) === o.id ? '<span class="tick">matches</span>' : '<span class="cross">does not match</span>') + "</p>" +
      '<div class="btn-row"><button type="button" class="btn" data-act="open-id" data-arg="' + esc(ref) + '">Open on the Ledger screen</button></div>';
    openModal(ref, html);
  }
  function openDecisionRecordModal() {
    var dr = REFS["D-CS04"].value, letter = REFS.L1.value.text;
    var html = '<p class="small">Runtime Decision Record for CS-04. Displayed here, not in the 14-entry chain.</p>' +
      '<p class="small">Id ' + idTok("D-CS04") + '</p><h3 style="margin:10px 0 6px">Letter (output ' + idTok("L1", "view-obj") + ')</h3><div class="letter">' + esc(letter) + "</div>" +
      '<h3 style="margin:14px 0 6px">Record</h3><pre class="json">' + jsonHtml(dr) + "</pre>";
    openModal("Decision Record D-CS04", html);
  }
  function openInventoryModal(id) {
    var r = invRow(id);
    var html = '<dl class="kv"><dt>Id</dt><dd>' + r.id + "</dd><dt>File and line</dt><dd><code>" + esc(r.file) + ":" + r.line + "</code></dd><dt>Function</dt><dd><code>" + r.fn + "</code></dd><dt>What it does</dt><dd>" + esc(r.what) + "</dd><dt>Model</dt><dd><code>" + r.model + "</code></dd><dt>Coupling</dt><dd>" + r.coupling + ": " + esc(r.reason) + "</dd>" +
      '<dt>Calls in sample week</dt><dd>' + fmtInt(r.calls) + "</dd><dt>Cost per call</dt><dd>" + usd(r.costMicro, 3) + "</dd><dt>Spend per week</dt><dd>" + usd(r.calls * r.costMicro) + "</dd></dl>" +
      '<p class="small muted" style="margin-top:12px">Illustrative sample data</p>';
    openModal(id + " in the inventory", html);
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

  function renderChrome() {
    byId("steps").innerHTML = SCREENS.map(function (sc, i) {
      var cls = i <= S.maxIdx ? "visited" : "";
      return '<li><a href="#/' + sc.slug + '" class="' + cls + '"' + (i === S.idx ? ' aria-current="step"' : "") + '><span class="step-n">' + (i + 1) + "</span><span>" + esc(sc.title) + "</span></a></li>";
    }).join("");
    var cur = SCREENS[S.idx].stage;
    byId("pipeline").innerHTML = D.pipeline.map(function (p, i) {
      return '<button type="button" class="pipe' + (cur === i ? " current" : "") + '" data-act="goto" data-arg="' + p.screen + '"' + (cur === i ? ' aria-current="step"' : "") + ">" + esc(p.name) + "</button>";
    }).join("");
    var steps = lastInner(S.idx) + 1;
    byId("guide-count").textContent = "Step " + (S.idx + 1) + " of " + N + (steps > 1 ? ", part " + (S.inner + 1) + " of " + steps : "");
    byId("guide-caption").textContent = SCREENS[S.idx].caption;
    byId("guide-back").disabled = S.idx === 0 && S.inner === 0;
    byId("guide-next").textContent = S.idx === N - 1 && S.inner === lastInner(S.idx) ? "Restart" : "Next";
    var cur2 = document.querySelector('.steps a[aria-current="step"]');
    if (cur2 && window.innerWidth <= 860) {
      var list = byId("steps");
      list.scrollLeft = cur2.parentNode.offsetLeft - 16;
    }
  }

  function chipHtml(chip) {
    if (!chip) return "";
    if (chip.kind === "split") return '<div class="chips"><span class="chip built">' + esc(chip.built) + '</span><span class="chip planned">' + esc(chip.planned) + "</span></div>";
    return '<div class="chips"><span class="chip ' + chip.kind + '">' + esc(chip.text) + "</span></div>";
  }

  function render(screenChanged) {
    var sc = SCREENS[S.idx], v = V[sc.slug], s = st();
    var active = document.activeElement, focusKey = null;
    if (active && active.getAttribute && active.getAttribute("data-act") && byId("screen").contains(active)) {
      focusKey = '[data-act="' + active.getAttribute("data-act") + '"]' + (active.hasAttribute("data-arg") ? '[data-arg="' + active.getAttribute("data-arg") + '"]' : "");
    }
    var head = sc.slug === "overview" ? "" : '<div class="screen-head"><h1>' + esc(sc.title) + "</h1>" + chipHtml(sc.chip) + "</div>";
    var main = byId("screen");
    main.innerHTML = head + v.render(s);
    if (v.mount) v.mount(s, main);
    renderChrome();
    document.title = sc.title + ". Regufinder walkthrough";
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
        if (r.top < 90 || r.bottom > window.innerHeight - 90) {
          target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
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
        var target = arg.charAt(0) === "E" ? RECORD_REFS[parseInt(arg.slice(1), 10) - 1] : arg;
        if (SCREENS[S.idx].slug === "ledger") { s.sel = target; s.edit = false; s.focus = "#ledger-detail"; render(); }
        else { goFree(slugIndex("ledger")); var ls = st(); ls.sel = target; ls.tab = "record"; ls.edit = false; ls.focus = "#ledger-detail"; render(); }
        if (arg.charAt(0) === "E") { st().tab = "entry"; render(); }
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
    if (el.closest("#modal") && el.getAttribute("data-act") !== "open-id" && el.getAttribute("data-act") !== "copy-id" && el.getAttribute("data-act") !== "view-obj") return;
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
      byId("try-result").innerHTML = tryResult(s.tryc, s.compiled);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!byId("modal").hidden) { closeModal(); return; }
      if (!byId("glossary").hidden) { byId("glossary").hidden = true; return; }
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
    S.done = {}; S.maxIdx = 0;
    goGuided(0, 0, "silent");
  });
  byId("modal-close").addEventListener("click", closeModal);
  byId("modal").addEventListener("click", function (e) { if (e.target === byId("modal")) closeModal(); });

  // Glossary
  byId("glossary-list").innerHTML = D.glossary.map(function (g) { return "<dt>" + esc(g[0]) + "</dt><dd>" + esc(g[1]) + "</dd>"; }).join("");
  byId("open-glossary").addEventListener("click", function () { byId("glossary").hidden = false; byId("close-glossary").focus(); });
  byId("close-glossary").addEventListener("click", function () { byId("glossary").hidden = true; byId("open-glossary").focus(); });

  // Theme
  function effectiveTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function themeLabel() { byId("theme-toggle").textContent = effectiveTheme() === "dark" ? "Light theme" : "Dark theme"; }
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
