/*
 * Sample data for the Regufinder walkthrough. Every number is illustrative.
 * Money is stored as integer micro-dollars (1 dollar = 1,000,000). Shares are
 * integers per 100 or per 1,000. Entropy is a decimal string. No floats are
 * stored; display formatting happens in app.js.
 */
(function (root) {
  "use strict";

  var screens = [
    { slug: "overview", title: "Overview", chip: null, stage: null,
      caption: "One sample codebase, one call site, the whole flow." },
    { slug: "scan", title: "Scan", stage: 0,
      chip: { kind: "planned", text: "Planned. Spec step 1. Tasks B1 B2 B6 B10." },
      caption: "Find every place the code calls a model at runtime." },
    { slug: "entropy", title: "Entropy scoring", stage: 1,
      chip: { kind: "planned", text: "Planned. Spec step 1b. Task B3." },
      caption: "Measure how settled each call site's answers are, from real traffic." },
    { slug: "audit", title: "Audit report", stage: null,
      chip: { kind: "planned", text: "Planned. Tasks B4 B10. This is what is sold first: the 'Compile your agents' audit." },
      caption: "The audit says what qualifies, the top three candidates, their break-even, and where you start." },
    { slug: "skeleton", title: "Skeleton", stage: 2,
      chip: { kind: "planned", text: "Planned. Spec step 2. Task C1." },
      caption: "Developers write the frame: boundaries, signatures, invariants, tests. This layer carries the IP and the sign-off." },
    { slug: "compile", title: "Compile", stage: 3,
      chip: { kind: "planned", text: "Planned. Spec step 3. Tasks C8 C11." },
      caption: "The Compiler fills the skeleton with code for every path the traces determine, and an escalation call for every path they do not." },
    { slug: "tests", title: "Test twice", stage: 4,
      chip: { kind: "planned", text: "Planned. Spec step 4. Tasks A3 C5 C6." },
      caption: "Two tests: does it match history, and is it right?" },
    { slug: "gates", title: "Security gates", stage: 5,
      chip: { kind: "planned", text: "Planned. Spec step 4b. Task C7." },
      caption: "Gates block the PR. Findings go to the ledger. Generated code is regenerated, never patched." },
    { slug: "sign", title: "Review by diff. Sign.", stage: 6,
      chip: { kind: "planned", text: "Planned. Spec step 4. Task C9." },
      caption: "A person reviews the diff and signs. The signature expires if the signed code changes." },
    { slug: "run", title: "Run and escalation", stage: 7,
      chip: { kind: "planned", text: "Planned. Spec step 5. Tasks C2 C3 C12." },
      caption: "In production, code decides what it can. The rest goes through the Escalation Contract and leaves a Decision Record." },
    { slug: "ledger", title: "Ledger", stage: null,
      chip: { kind: "split",
        built: "Built today: canonical JSON and sha256 content ids (regufinder.core, and the CLI commands canon and hash).",
        planned: "Planned: the Tenant Ledger itself. Task C4." },
      caption: "Every step left a record. Each entry includes the fingerprint of the one before, so any change shows." },
    { slug: "runtime", title: "Runtime", stage: null,
      chip: { kind: "planned", text: "Planned. Runtime v1 is targeted at month 10 to 14 in the plan." },
      caption: "What cannot be compiled is recorded, verified by risk class, and certified on a replacement model." },
    { slug: "reports", title: "Reports", stage: null,
      chip: { kind: "planned", text: "Planned. Tasks C10 A9." },
      caption: "Three reports: the audit, the break-even, and the one chart that measures progress." },
    { slug: "built", title: "What is built today", chip: null, stage: null,
      caption: "What exists now, and what is planned." }
  ];

  var pipeline = [
    { name: "Scan", screen: "scan" },
    { name: "Entropy scoring", screen: "entropy" },
    { name: "Skeleton", screen: "skeleton" },
    { name: "Compile", screen: "compile" },
    { name: "Test twice", screen: "tests" },
    { name: "Security gates", screen: "gates" },
    { name: "Sign", screen: "sign" },
    { name: "Run", screen: "run" }
  ];

  var tree = [
    { path: "acme-claims/", depth: 0, dir: true },
    { path: "pyproject.toml", depth: 1 },
    { path: "claims/", depth: 1, dir: true },
    { path: "llm_client.py", depth: 2, note: "wrapper around the vendor SDK, not a call site" },
    { path: "models.py", depth: 2 },
    { path: "intake/", depth: 2, dir: true },
    { path: "normalise.py", depth: 3, cs: "CS-01" },
    { path: "triage.py", depth: 3, cs: "CS-02" },
    { path: "coverage.py", depth: 3, cs: "CS-03" },
    { path: "comms/", depth: 2, dir: true },
    { path: "reply.py", depth: 3, cs: "CS-04" },
    { path: "fraud/", depth: 2, dir: true },
    { path: "notes.py", depth: 3, cs: "CS-05" },
    { path: "legacy/", depth: 2, dir: true },
    { path: "faq_bot.py", depth: 3, cs: "CS-06" },
    { path: "tests/", depth: 1, dir: true }
  ];

  var inventory = [
    { id: "CS-01", file: "claims/intake/normalise.py", line: 31, fn: "normalise_loss_date",
      what: "Turns a free-text date into an ISO date", model: "model-a-large",
      coupling: "Low", reason: "Plain text in, plain text out",
      calls: 12000, costMicro: 4000 },
    { id: "CS-02", file: "claims/intake/triage.py", line: 58, fn: "route_claim",
      what: "Routes a claim to one of four teams", model: "model-a-large",
      coupling: "High", reason: "Vendor JSON mode, prompt tuned to this model",
      calls: 12000, costMicro: 50000 },
    { id: "CS-03", file: "claims/intake/coverage.py", line: 77, fn: "check_coverage_clause",
      what: "Picks the policy clause that applies", model: "model-a-large",
      coupling: "Medium", reason: "Vendor SDK types in the signature",
      calls: 12000, costMicro: 30000 },
    { id: "CS-04", file: "claims/comms/reply.py", line: 24, fn: "draft_customer_letter",
      what: "Drafts the letter to the customer", model: "model-a-large",
      coupling: "High", reason: "Long tuned prompt, vendor tool calling",
      calls: 9000, costMicro: 60000 },
    { id: "CS-05", file: "claims/fraud/notes.py", line: 40, fn: "summarise_adjuster_notes",
      what: "Summarises adjuster notes", model: "model-a-large",
      coupling: "Medium", reason: "Vendor response type returned to the caller",
      calls: 3000, costMicro: 84000 },
    { id: "CS-06", file: "claims/legacy/faq_bot.py", line: 12, fn: "answer_faq",
      what: "Old FAQ bot", model: "model-a-large",
      coupling: "Low", reason: "Plain text in, plain text out",
      calls: 0, costMicro: 20000 }
  ];

  // Three-line stubs of the same shape as the CS-02 call. All valid Python.
  var stubs = {
    "CS-01":
      "def normalise_loss_date(text: str) -> str:\n" +
      "    response = chat(model=\"model-a-large\", temperature=0, system=DATE_PROMPT, user=text)\n" +
      "    return response.text.strip()\n",
    "CS-03":
      "def check_coverage_clause(claim: dict) -> ChatResponse:\n" +
      "    response: ChatResponse = chat(model=\"model-a-large\", system=COVERAGE_PROMPT, user=str(claim))\n" +
      "    return response\n",
    "CS-04":
      "def draft_customer_letter(claim: dict, decision: str) -> str:\n" +
      "    response = chat(model=\"model-a-large\", system=LETTER_PROMPT, user=str((claim, decision)))\n" +
      "    return response.text\n",
    "CS-05":
      "def summarise_adjuster_notes(notes: list[str]) -> ChatResponse:\n" +
      "    response: ChatResponse = chat(model=\"model-a-large\", system=NOTES_PROMPT, user=str(notes))\n" +
      "    return response\n",
    "CS-06":
      "def answer_faq(question: str) -> str:\n" +
      "    response = chat(model=\"model-a-large\", system=FAQ_PROMPT, user=question)\n" +
      "    return response.text\n"
  };

  var escalateSignature =
    "def escalate(claim: ClaimFeatures) -> Route:\n" +
    "    \"\"\"Typed, budgeted, recorded call through the customer's gateway.\n" +
    "    Writes a Decision Record. Returns a Route, or raises BudgetExhausted\n" +
    "    (a typed outcome) so the caller sends the claim to the manual queue.\"\"\"\n";

  var entropySummary = [
    { id: "CS-01", classes: "0.98 of traffic with one output (H 0), 0.02 with two equally likely outputs (H 1)",
      score: "0.02", bucket: "low", plan: "Compile whole" },
    { id: "CS-02", classes: "Five classes, shown below",
      score: "0.6125", bucket: "mixed", plan: "Compile determined branches, escalate the rest" },
    { id: "CS-03", classes: "0.90 with one output (H 0), 0.10 split 75/25 (H 0.8113)",
      score: "0.0811", bucket: "low", plan: "Compile whole" },
    { id: "CS-04", classes: "0.50 with 8 equally likely output clusters (H 3), 0.50 with 16 (H 4)",
      score: "3.5", bucket: "open", plan: "Stays agentic. Runtime governs it and makes it portable" },
    { id: "CS-05", classes: "0.25 with 4 clusters (H 2), 0.75 with 8 clusters (H 3)",
      score: "2.75", bucket: "open", plan: "Stays agentic. Next for the Runtime" },
    { id: "CS-06", classes: "No traffic in the sample week",
      score: null, bucket: "none", plan: "Retire" }
  ];

  // Classes for the other call sites, for the class panel when one is selected.
  // share is per 100, entropy a decimal string, outputs a list of integer weights of the output clusters.
  var otherClasses = {
    "CS-01": { arithmetic: "0.02 x 1 = 0.02 bits", rows: [
      { name: "One output", share: 98, h: "0", outputs: [1] },
      { name: "Two equally likely outputs", share: 2, h: "1", outputs: [1, 1] } ] },
    "CS-03": { arithmetic: "H(0.75, 0.25) = 0.8113. 0.10 x 0.8113 = 0.0811 bits", rows: [
      { name: "One output", share: 90, h: "0", outputs: [1] },
      { name: "Split 75/25", share: 10, h: "0.8113", outputs: [3, 1] } ] },
    "CS-04": { arithmetic: "0.5 x 3 + 0.5 x 4 = 3.5 bits", rows: [
      { name: "8 equally likely output clusters", share: 50, h: "3", outputs: [1, 1, 1, 1, 1, 1, 1, 1] },
      { name: "16 equally likely output clusters", share: 50, h: "4", outputs: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] } ] },
    "CS-05": { arithmetic: "0.25 x 2 + 0.75 x 3 = 2.75 bits", rows: [
      { name: "4 output clusters", share: 25, h: "2", outputs: [1, 1, 1, 1] },
      { name: "8 output clusters", share: 75, h: "3", outputs: [1, 1, 1, 1, 1, 1, 1, 1] } ] }
  };

  var cs02Classes = [
    { cls: "A", def: "No injury, no fraud indicator, no third party, amount 1,500 or less",
      traces: 4200, sharePer100: 35, outputs: { FAST_TRACK: 4200 }, h: "0", shareH: "0" },
    { cls: "B", def: "Injury reported",
      traces: 1440, sharePer100: 12, outputs: { INJURY_TEAM: 1440 }, h: "0", shareH: "0" },
    { cls: "C", def: "No injury. Policy younger than 30 days, or 3 or more claims in 12 months",
      traces: 960, sharePer100: 8, outputs: { FRAUD_REVIEW: 960 }, h: "0", shareH: "0" },
    { cls: "D", def: "No injury, no fraud indicator, no third party, amount above 1,500",
      traces: 1200, sharePer100: 10, outputs: { ADJUSTER: 1200 }, h: "0", shareH: "0" },
    { cls: "E", def: "No injury, no fraud indicator, third party involved",
      traces: 4200, sharePer100: 35, outputs: { ADJUSTER: 2100, FAST_TRACK: 1050, FRAUD_REVIEW: 525, INJURY_TEAM: 525 },
      h: "1.75", shareH: "0.6125" }
  ];

  // Audit candidates. Shadow fraction is 2 per 100 of the per-call cost.
  var candidates = [
    { rank: 1, id: "CS-02", fn: "route_claim", genMicro: 2100000, regenMicro: 700000,
      compiledPer100: 65,
      saveLine: "0.65 x (0.050 - 0.001) = $0.03185",
      breakLine: "2.80 / 0.03185 = 87.9, so 88",
      weekLine: "12,000 x 0.03185 = $382.20" },
    { rank: 2, id: "CS-03", fn: "check_coverage_clause", genMicro: 1500000, regenMicro: 500000,
      compiledPer100: 100,
      saveLine: "0.030 - 0.0006 = $0.0294",
      breakLine: "2.00 / 0.0294 = 68.03, so 69",
      weekLine: "12,000 x 0.0294 = $352.80" },
    { rank: 3, id: "CS-01", fn: "normalise_loss_date", genMicro: 600000, regenMicro: 200000,
      compiledPer100: 100,
      saveLine: "0.004 - 0.00008 = $0.00392",
      breakLine: "0.80 / 0.00392 = 204.08, so 205",
      weekLine: "12,000 x 0.00392 = $47.04" }
  ];

  var compiledPaths = [
    { line: "if claim.injury_reported:", ret: "return Route.INJURY_TEAM", inv: "INV-1", traces: 1440, kind: "code", classes: ["B"] },
    { line: "if claim.policy_age_days < 30 or claim.claims_last_12_months >= 3:", ret: "return Route.FRAUD_REVIEW", inv: "INV-2", traces: 960, kind: "code", classes: ["C"] },
    { line: "if claim.third_party_involved:", ret: "return escalate(claim)", inv: "INV-5", traces: 4200, kind: "escalate", classes: ["E"] },
    { line: "if claim.needs_recalibration:", ret: "return Route.ADJUSTER", inv: "INV-3", traces: 12, kind: "code", classes: ["A"] },
    { line: "if claim.amount_cents <= 150_000:", ret: "return Route.FAST_TRACK", inv: "INV-4", traces: 4188, kind: "code", classes: ["A"] },
    { line: "", ret: "return Route.ADJUSTER", inv: "", traces: 1200, kind: "code", classes: ["D"] }
  ];

  // The six-line compiled function, run in the browser. Mirrors triage_generated.py run 2.
  function routeClaim(c) {
    if (c.injury_reported) return { branch: 0, route: "INJURY_TEAM" };
    if (c.policy_age_days < 30 || c.claims_last_12_months >= 3) return { branch: 1, route: "FRAUD_REVIEW" };
    if (c.third_party_involved) return { branch: 2, route: null, escalate: true };
    if (c.needs_recalibration) return { branch: 3, route: "ADJUSTER" };
    if (c.amount_cents <= 150000) return { branch: 4, route: "FAST_TRACK" };
    return { branch: 5, route: "ADJUSTER" };
  }

  var claims = {
    escalate: { claim_id: "CLM-2027-104417", amount_cents: 320000, injury_reported: false,
      third_party_involved: true, policy_age_days: 412, claims_last_12_months: 0,
      needs_recalibration: false,
      statement: "Other driver says I reversed into them. I say they hit my car while it was parked. No police report yet." },
    code: { claim_id: "CLM-2027-104418", amount_cents: 48000, injury_reported: false,
      third_party_involved: false, policy_age_days: 900, claims_last_12_months: 1,
      needs_recalibration: false, statement: null }
  };

  var skeletonTests = [
    { name: "test_inv1_injury_always_goes_to_injury_team", meaning: "Any claim with an injury goes to the injury team." },
    { name: "test_inv2_fraud_indicators_go_to_fraud_review", meaning: "New policies and frequent claimants go to fraud review." },
    { name: "test_inv3_recalibration_is_never_fast_tracked", meaning: "A claim that needs camera recalibration never takes the fast track." },
    { name: "test_inv4_fast_track_has_an_amount_limit", meaning: "Fast track only at 1,500.00 or less." },
    { name: "test_inv5_undetermined_paths_escalate", meaning: "Paths the traces do not settle call escalate, never guess." },
    { name: "test_equivalence_to_corpus", meaning: "Runs the equivalence test against history." },
    { name: "test_accuracy_on_verification_set", meaning: "Runs the accuracy test against the owner's labels." }
  ];

  var invariants = [
    { id: "INV-1", text: "injury_reported is true: INJURY_TEAM, always." },
    { id: "INV-2", text: "Policy under 30 days old or 3 or more claims in 12 months: FRAUD_REVIEW, unless INV-1 applies." },
    { id: "INV-3", text: "needs_recalibration is true: never FAST_TRACK." },
    { id: "INV-4", text: "FAST_TRACK only when amount_cents is 150,000 or less." },
    { id: "INV-5", text: "A path the traces do not determine escalates. Never guess." }
  ];

  // The developers' edit to the drafted skeleton (unified diff of the docstring and fields).
  var developerDiff = [
    { t: " ", s: "    claims_last_12_months: int" },
    { t: "+", s: "    needs_recalibration: bool" },
    { t: " ", s: "    statement_ref: str | None  # content id of the customer's free-text statement, if any" },
    { t: "@", s: "@@ def route_claim(claim: ClaimFeatures) -> Route: @@" },
    { t: " ", s: "      INV-2  policy_age_days < 30 or claims_last_12_months >= 3" },
    { t: " ", s: "                                                -> FRAUD_REVIEW, unless INV-1 applies." },
    { t: "-", s: "      INV-3  FAST_TRACK only when amount_cents <= 150_000." },
    { t: "-", s: "      INV-4  a path the traces do not determine -> escalate. Never guess." },
    { t: "+", s: "      INV-3  needs_recalibration is true        -> never FAST_TRACK." },
    { t: "+", s: "      INV-4  FAST_TRACK only when amount_cents <= 150_000." },
    { t: "+", s: "      INV-5  a path the traces do not determine -> escalate. Never guess." }
  ];

  var vsParts = [
    { key: "D", part: "Discovery sample, stratified by class (A 10, B 4, C 3, D 3, E 10)", cases: 30, decided: 20, escalated: 10 },
    { key: "M1", part: "Mode 1: recalibration claims fast-tracked in history", cases: 100, decided: 100, escalated: 0 },
    { key: "M2", part: "Mode 2: third party involved, routing inconsistent in history", cases: 100, decided: 0, escalated: 100 }
  ];

  var vsCases = [
    { id: "VS-D-004", part: "D", brief: "Injury reported, amount 2,400.00", owner: "INJURY_TEAM", code: "INJURY_TEAM", status: "Match" },
    { id: "VS-D-011", part: "D", brief: "Policy 12 days old, amount 900.00", owner: "FRAUD_REVIEW", code: "FRAUD_REVIEW", status: "Match" },
    { id: "VS-D-019", part: "D", brief: "No flags, amount 310.00", owner: "FAST_TRACK", code: "FAST_TRACK", status: "Match" },
    { id: "VS-D-023", part: "D", brief: "No flags, amount 4,150.00", owner: "ADJUSTER", code: "ADJUSTER", status: "Match" },
    { id: "VS-D-027", part: "D", brief: "Third party involved, amount 1,900.00", owner: "ADJUSTER", code: "Escalated", status: "Escalated" },
    { id: "VS-M1-001", part: "M1", brief: "Windscreen, needs recalibration, amount 540.00", owner: "ADJUSTER", code: "ADJUSTER", status: "Match" },
    { id: "VS-M1-002", part: "M1", brief: "Windscreen, needs recalibration, amount 780.00", owner: "ADJUSTER", code: "ADJUSTER", status: "Match" },
    { id: "VS-M2-001", part: "M2", brief: "Third party involved, amount 2,750.00", owner: "ADJUSTER", code: "Escalated", status: "Escalated" },
    { id: "VS-M2-002", part: "M2", brief: "Third party involved, amount 600.00", owner: "FAST_TRACK", code: "Escalated", status: "Escalated" }
  ];

  var gateRuns = {
    1: { record: "R6", outcome: "blocked", gates: [
      { gate: "Static analysis", result: "pass", detail: "0 findings" },
      { gate: "Dependency allow-list", result: "fail", detail: "pydantic imported in triage_generated.py. Allow-list for generated modules: Python standard library, claims.escalation, claims.intake.triage_skeleton" },
      { gate: "Pinned lockfile", result: "pass", detail: "Lockfile unchanged" },
      { gate: "Signed build provenance", result: "not_run", detail: "Skipped because an earlier gate failed" } ] },
    2: { record: "R10", outcome: "passed", gates: [
      { gate: "Static analysis", result: "pass", detail: "0 findings" },
      { gate: "Dependency allow-list", result: "pass", detail: "2 imports, both allowed" },
      { gate: "Pinned lockfile", result: "pass", detail: "Lockfile unchanged" },
      { gate: "Signed build provenance", result: "pass", detail: "Attestation recorded (sample reference attestation/acme-claims/214-2)" } ] }
  };

  var diffFiles = [
    { mark: "added", path: "claims/intake/triage_skeleton.py", note: "Human-authored" },
    { mark: "added", path: "claims/intake/triage_generated.py", note: "Generated, marked" },
    { mark: "changed", path: "claims/intake/triage.py", note: "The body of route_claim now delegates to the generated module" },
    { mark: "added", path: "tests/intake/test_triage_skeleton.py", note: "Skeleton tests" }
  ];

  var riskClasses = [
    { cls: "medium", meaning: "Letter with no payment amount and no refusal",
      checks: "Required clauses present. No promise of payment. Claim number matches",
      calls: 6300, passed: 6237, held: 63 },
    { cls: "high", meaning: "Letter that states a payment amount or a refusal",
      checks: "All medium checks. Amount equals the claim record. Human approval before sending",
      calls: 2700, passed: 2673, held: 27 }
  ];

  var checkMeanings = {
    required_clauses_present: "The letter contains every clause the policy requires.",
    no_promise_of_payment_beyond_decision: "The letter promises nothing the claim decision did not grant.",
    claim_number_matches: "The claim number in the letter is the claim being answered.",
    amount_equals_claim_record: "Any amount in the letter equals the amount on the claim record.",
    human_approval: "A person approved the letter before it was sent.",
    output_is_a_route: "The model answered with one of the four routes.",
    "invariants_INV-1_to_INV-4": "The answer breaks none of the skeleton's invariants INV-1 to INV-4."
  };

  var certRows = [
    { model: "model-a-large", role: "origin, baseline", replayed: 500, passed: 495, newHigh: null, result: "Baseline" },
    { model: "model-b-medium", role: "", replayed: 500, passed: 495, newHigh: 0, result: "Certified" },
    { model: "model-c-small", role: "", replayed: 500, passed: 471, newHigh: 9, result: "Not certified" }
  ];

  var portfolio = [
    { id: "CS-01", state: "compiled", label: "compiled", callsAfter: 240, spendAfterMicro: 960000, arithmetic: "2% of 12,000 = 240 shadow calls x 0.004" },
    { id: "CS-02", state: "compiled", label: "compiled (with escalation)", callsAfter: 4356, spendAfterMicro: 217800000, arithmetic: "4,200 escalations + 156 shadow" },
    { id: "CS-03", state: "compiled", label: "compiled", callsAfter: 240, spendAfterMicro: 7200000, arithmetic: "240 shadow calls x 0.030" },
    { id: "CS-04", state: "portable", label: "portable", callsAfter: 9000, spendAfterMicro: 540000000, arithmetic: "unchanged" },
    { id: "CS-05", state: "origin-locked", label: "origin-locked", callsAfter: 3000, spendAfterMicro: 252000000, arithmetic: "unchanged" },
    { id: "CS-06", state: "retired", label: "retired", callsAfter: 0, spendAfterMicro: 0, arithmetic: "code removed" }
  ];

  var burndown = [
    { snap: 0, changed: "Scan complete", counts: [6, 0, 0, 0], states: { "CS-01": 0, "CS-02": 0, "CS-03": 0, "CS-04": 0, "CS-05": 0, "CS-06": 0 } },
    { snap: 1, changed: "CS-06 removed", counts: [5, 0, 0, 1], states: { "CS-01": 0, "CS-02": 0, "CS-03": 0, "CS-04": 0, "CS-05": 0, "CS-06": 3 } },
    { snap: 2, changed: "CS-01 compiled", counts: [4, 0, 1, 1], states: { "CS-01": 2, "CS-02": 0, "CS-03": 0, "CS-04": 0, "CS-05": 0, "CS-06": 3 } },
    { snap: 3, changed: "CS-02 compiled", counts: [3, 0, 2, 1], states: { "CS-01": 2, "CS-02": 2, "CS-03": 0, "CS-04": 0, "CS-05": 0, "CS-06": 3 } },
    { snap: 4, changed: "CS-03 compiled", counts: [2, 0, 3, 1], states: { "CS-01": 2, "CS-02": 2, "CS-03": 2, "CS-04": 0, "CS-05": 0, "CS-06": 3 } },
    { snap: 5, changed: "CS-04 certified on a second model", counts: [1, 1, 3, 1], states: { "CS-01": 2, "CS-02": 2, "CS-03": 2, "CS-04": 1, "CS-05": 0, "CS-06": 3 } }
  ];
  var burnStates = ["Origin-locked", "Portable", "Compiled", "Retired"];

  var builtToday = [
    "Canonical JSON (a strict subset of RFC 8785, no floats)",
    "sha256 content ids",
    "Injected clock, content-seeded randomness, environment checks",
    "Command line tool: version, doctor, canon, hash",
    "Reproducible toolchain: pinned Python and dependencies, strict type checks, pinned CI, reproducible build check",
    "Three written architecture decisions"
  ];
  var plannedList = [
    "Scanner (step 1)",
    "Entropy scoring (step 1b)",
    "Skeleton drafting and PR (step 2)",
    "Compiler (step 3)",
    "Equivalence and accuracy tests (step 4)",
    "Security gates (step 4b)",
    "Escalation shim, Decision Record, Tenant Ledger, reports (step 5)",
    "Runtime: verification by risk class, certification, decay monitor (Runtime v1 at month 10 to 14)"
  ];

  var ledgerDescriptions = {
    R1: "Scan found 6 call sites.",
    R2: "CS-02 scored 0.6125 bits, mixed.",
    R3: "Skeleton authored by two developers.",
    R4: "Corpus of 12,000 typed traces.",
    R5: "Module generated, run 1.",
    R6: "Gates blocked run 1.",
    R7: "Module regenerated, run 2.",
    R8: "Equivalence test: 7,788 of 7,800, 12 explained.",
    R9: "Accuracy test: 120 of 120.",
    R10: "Gates passed run 2.",
    R11: "Adopted and signed.",
    R12: "One escalation, with its Decision Record.",
    R13: "Regenerated on a second model, same test results.",
    R14: "Replacement model certified for CS-04."
  };

  var objectLabels = {
    A0: "Artefact: triage.py before (the call site as found)",
    A1: "Artefact: triage_skeleton.py (human-authored)",
    A2: "Artefact: triage_generated.py, run 1 (blocked)",
    A3: "Artefact: triage_generated.py, run 2 (ships)",
    A4: "Artefact: triage_generated.py, run 3 (second model)",
    S1: "Statement for CLM-2027-104417",
    P1: "Policy document (the policy hash)",
    F1: "Claim features for CLM-2027-104417",
    O1: "Output for CLM-2027-104417",
    F2: "Claim features for CLM-2027-104418",
    O2: "Decision for CLM-2027-104418",
    T1: "Tool call arguments for lookup_payment_schedule",
    L1: "Letter for CLM-2027-104418",
    "D-CS04": "Runtime Decision Record for CS-04 (not in the 14-entry chain)"
  };

  var glossary = [
    ["Call site", "A place in code where an LLM is called at runtime."],
    ["Origin model", "The model a call site was written and tuned for."],
    ["Entropy score", "How much the model's answers vary for the same kind of input, in bits. Low means settled."],
    ["Skeleton", "The human-authored module boundaries, signatures, invariants and tests. It carries the IP and the sign-off."],
    ["Invariant", "A rule the developers state must hold on every path."],
    ["Corpus", "The history of past calls, typed and passed through quarantine."],
    ["Verification Set", "A sample of cases labelled by the workflow's owner."],
    ["Equivalence test", "Compiled code compared with history on the corpus."],
    ["Accuracy test", "Compiled code compared with the owner's labels on the Verification Set."],
    ["Security gates", "Static analysis, dependency allow-list, pinned lockfiles, signed build provenance."],
    ["Escalation Contract", "The way compiled code calls the Runtime on the paths it cannot determine."],
    ["Shim", "The typed, budgeted, recorded call through the customer's gateway."],
    ["Decision Record", "The record written for each escalated or governed model call."],
    ["Tenant Ledger", "The customer-owned chain of records. Each entry includes the fingerprint of the one before."],
    ["Content id", "sha256: plus the fingerprint of a record's canonical JSON."],
    ["Rule-adoption signature", "The ledger entry that records who authored a rule and who adopted it. It expires when the signed object changes."],
    ["Decay monitor", "Compares a small shadow sample with the model and flags a module for de-compiling if the world moves."],
    ["Break-even report", "Generation, regeneration and shadow-sample costs against per-transaction savings."],
    ["Burn-down", "The chart of call sites that are origin-locked, portable, compiled or retired."]
  ];

  root.RF_DATA = {
    screens: screens, pipeline: pipeline, tree: tree, inventory: inventory, stubs: stubs,
    escalateSignature: escalateSignature, entropySummary: entropySummary, otherClasses: otherClasses,
    cs02Classes: cs02Classes, candidates: candidates, compiledPaths: compiledPaths,
    routeClaim: routeClaim, claims: claims, skeletonTests: skeletonTests, invariants: invariants,
    developerDiff: developerDiff, vsParts: vsParts, vsCases: vsCases, gateRuns: gateRuns,
    diffFiles: diffFiles, riskClasses: riskClasses, checkMeanings: checkMeanings, certRows: certRows,
    portfolio: portfolio, burndown: burndown, burnStates: burnStates, builtToday: builtToday,
    plannedList: plannedList, ledgerDescriptions: ledgerDescriptions, objectLabels: objectLabels,
    glossary: glossary,
    shadowPer100: 2
  };
})(typeof window !== "undefined" ? window : globalThis);
