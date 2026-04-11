/**
 * run_experiments.js — Run all 3 HW7/HW8 experiments
 * Uses claude-3-5-haiku for cost efficiency (~$0.01/negotiation)
 *
 * Experiment 1: RFP vs Reverse Auction (6 vendors)
 * Experiment 2: Constraint Propagation Latency at scale (3, 10, 30 vendors)
 * Experiment 3: Failure Recovery (inject failure, measure recovery)
 *
 * Usage: node run_experiments.js [1|2|3|all]
 */

const fs = require("fs");
const path = require("path");
const { runMultiNegotiation, runMultiNegotiationParallel, loadRegistry, MODEL_EXPERIMENT } = require("./negotiate-multi");

const RESULTS_DIR = path.join(__dirname, "results");

// Default form data for experiments
const DEFAULT_FORM = {
  budget: 25000,
  flexBudget: 3000,
  guestCount: 120,
  serviceStyle: "plated",
  cuisinePreference: "Italian-American",
  dietaryNeeds: ["vegetarian", "gluten-free"],
  dateFlexibility: "month",
  altStyles: ["buffet", "family_style"],
  minGuestCount: 100,
  altVenues: [],
};

// Vendor subsets
const SIX_VENDORS = [
  "venue_01", "catering_01", "florist_01",
  "photographer_01", "dj_01", "bakery_01",
];

const TEN_VENDORS = [
  "venue_01", "venue_02",
  "catering_01", "catering_02",
  "florist_01", "florist_02",
  "photographer_01", "photographer_02",
  "dj_01", "bakery_01",
];

const THIRTY_VENDORS = null; // null = all vendors in registry

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeCSV(filePath, headers, rows) {
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  fs.writeFileSync(filePath, csv);
  console.log(`  📊 Wrote ${filePath}`);
}

// ── Experiment 1: RFP vs Reverse Auction ────────────────────────────────

async function runExperiment1() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  EXPERIMENT 1: RFP vs Reverse Auction");
  console.log("═══════════════════════════════════════════\n");

  const expDir = path.join(RESULTS_DIR, "exp1_rfp_vs_auction");
  ensureDir(expDir);

  // Run RFP mode
  console.log("  🔄 Running RFP mode with 6 vendors...");
  const rfpResult = await runMultiNegotiation(
    { ...DEFAULT_FORM },
    SIX_VENDORS,
    { model: MODEL_EXPERIMENT, mode: "rfp" }
  );
  console.log(`  ✅ RFP complete: ${rfpResult.summary.elapsed_sec}s, $${rfpResult.summary.total_api_cost_usd} API cost`);

  // Run Auction mode
  console.log("  🔄 Running Auction mode with 6 vendors...");
  const auctionResult = await runMultiNegotiation(
    { ...DEFAULT_FORM },
    SIX_VENDORS,
    { model: MODEL_EXPERIMENT, mode: "auction" }
  );
  console.log(`  ✅ Auction complete: ${auctionResult.summary.elapsed_sec}s, $${auctionResult.summary.total_api_cost_usd} API cost`);

  // Generate CSV
  const headers = ["mode", "vendor_id", "vendor_name", "category", "outcome", "total_price", "turns", "api_cost"];
  const rows = [];

  for (const r of rfpResult.results) {
    rows.push(["rfp", r.vendor_id, r.vendor_name, r.category, r.outcome,
      r.final_terms?.total_price || "", r.turns, r.total_cost_usd]);
  }
  for (const r of auctionResult.results) {
    rows.push(["auction", r.vendor_id, r.vendor_name, r.category, r.outcome,
      r.final_terms?.total_price || "", r.turns, r.total_cost_usd]);
  }
  writeCSV(path.join(expDir, "exp1_results.csv"), headers, rows);

  // Summary CSV
  const summHeaders = ["mode", "vendor_count", "accepted", "rejected", "grand_total", "elapsed_sec", "api_cost"];
  const summRows = [
    ["rfp", rfpResult.summary.vendor_count, rfpResult.summary.accepted_count,
      rfpResult.summary.rejected_count, rfpResult.summary.grand_total_wedding_cost,
      rfpResult.summary.elapsed_sec, rfpResult.summary.total_api_cost_usd],
    ["auction", auctionResult.summary.vendor_count, auctionResult.summary.accepted_count,
      auctionResult.summary.rejected_count, auctionResult.summary.grand_total_wedding_cost,
      auctionResult.summary.elapsed_sec, auctionResult.summary.total_api_cost_usd],
  ];
  writeCSV(path.join(expDir, "exp1_summary.csv"), summHeaders, summRows);

  // Save full logs
  fs.writeFileSync(path.join(expDir, "rfp_full.json"), JSON.stringify(rfpResult, null, 2));
  fs.writeFileSync(path.join(expDir, "auction_full.json"), JSON.stringify(auctionResult, null, 2));

  console.log("\n  📋 Experiment 1 Summary:");
  console.log(`     RFP grand total:     $${rfpResult.summary.grand_total_wedding_cost}`);
  console.log(`     Auction grand total:  $${auctionResult.summary.grand_total_wedding_cost}`);
  console.log(`     RFP time:            ${rfpResult.summary.elapsed_sec}s`);
  console.log(`     Auction time:         ${auctionResult.summary.elapsed_sec}s`);
  const savings = rfpResult.summary.grand_total_wedding_cost - auctionResult.summary.grand_total_wedding_cost;
  console.log(`     Auction savings:      $${savings} (${savings > 0 ? "auction cheaper" : "RFP cheaper"})`);

  return { rfp: rfpResult.summary, auction: auctionResult.summary };
}

// ── Experiment 2: Constraint Propagation / Latency at Scale ─────────────

async function runExperiment2() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  EXPERIMENT 2: Scale & Latency");
  console.log("═══════════════════════════════════════════\n");

  const expDir = path.join(RESULTS_DIR, "exp2_scale_latency");
  ensureDir(expDir);

  const scales = [
    { label: "3 vendors", ids: SIX_VENDORS.slice(0, 3) },
    { label: "6 vendors", ids: SIX_VENDORS },
    { label: "10 vendors", ids: TEN_VENDORS },
  ];

  // For HW8, add 30 vendors
  const registry = loadRegistry();
  const allIds = [];
  for (const cat of Object.values(registry.categories)) {
    for (const v of cat.vendors) allIds.push(v.id);
  }
  scales.push({ label: "30 vendors", ids: allIds });

  const scaleResults = [];

  for (const scale of scales) {
    console.log(`  🔄 Running sequential with ${scale.label}...`);
    const seqResult = await runMultiNegotiation(
      { ...DEFAULT_FORM },
      scale.ids,
      { model: MODEL_EXPERIMENT, mode: "rfp" }
    );
    console.log(`  ✅ Sequential ${scale.label}: ${seqResult.summary.elapsed_sec}s`);

    console.log(`  🔄 Running parallel with ${scale.label}...`);
    const parResult = await runMultiNegotiationParallel(
      { ...DEFAULT_FORM },
      scale.ids,
      { model: MODEL_EXPERIMENT, concurrency: 5 }
    );
    console.log(`  ✅ Parallel ${scale.label}: ${parResult.summary.elapsed_sec}s`);

    scaleResults.push({
      vendor_count: scale.ids.length,
      label: scale.label,
      sequential_sec: seqResult.summary.elapsed_sec,
      parallel_sec: parResult.summary.elapsed_sec,
      speedup: Math.round((seqResult.summary.elapsed_sec / parResult.summary.elapsed_sec) * 100) / 100,
      seq_cost: seqResult.summary.total_api_cost_usd,
      par_cost: parResult.summary.total_api_cost_usd,
      seq_tokens: seqResult.summary.total_tokens,
      par_tokens: parResult.summary.total_tokens || 0,
    });

    // Save individual logs
    fs.writeFileSync(
      path.join(expDir, `seq_${scale.ids.length}v.json`),
      JSON.stringify(seqResult, null, 2)
    );
    fs.writeFileSync(
      path.join(expDir, `par_${scale.ids.length}v.json`),
      JSON.stringify(parResult, null, 2)
    );
  }

  // CSV
  const headers = ["vendor_count", "sequential_sec", "parallel_sec", "speedup", "seq_cost", "par_cost", "seq_tokens", "par_tokens"];
  const rows = scaleResults.map(r => [
    r.vendor_count, r.sequential_sec, r.parallel_sec, r.speedup,
    r.seq_cost, r.par_cost, r.seq_tokens, r.par_tokens,
  ]);
  writeCSV(path.join(expDir, "exp2_results.csv"), headers, rows);

  console.log("\n  📋 Experiment 2 Summary:");
  for (const r of scaleResults) {
    console.log(`     ${r.label}: seq=${r.sequential_sec}s, par=${r.parallel_sec}s, speedup=${r.speedup}x`);
  }

  return scaleResults;
}

// ── Experiment 3: Failure Recovery ──────────────────────────────────────

async function runExperiment3() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  EXPERIMENT 3: Failure Recovery");
  console.log("═══════════════════════════════════════════\n");

  const expDir = path.join(RESULTS_DIR, "exp3_failure_recovery");
  ensureDir(expDir);

  // Baseline: no failures
  console.log("  🔄 Running baseline (no failures) with 6 vendors...");
  const baseline = await runMultiNegotiation(
    { ...DEFAULT_FORM },
    SIX_VENDORS,
    { model: MODEL_EXPERIMENT, mode: "rfp" }
  );
  console.log(`  ✅ Baseline: ${baseline.summary.elapsed_sec}s, $${baseline.summary.grand_total_wedding_cost} total`);

  // With failure: venue fails, triggers backup
  console.log("  🔄 Running with venue failure (venue_01 → backup)...");
  const venueFailure = await runMultiNegotiation(
    { ...DEFAULT_FORM },
    SIX_VENDORS,
    { model: MODEL_EXPERIMENT, mode: "rfp", failureVendorId: "venue_01" }
  );
  console.log(`  ✅ Venue failure: ${venueFailure.summary.elapsed_sec}s, $${venueFailure.summary.grand_total_wedding_cost} total`);

  // With failure: caterer fails
  console.log("  🔄 Running with caterer failure (catering_01 → backup)...");
  const cateringFailure = await runMultiNegotiation(
    { ...DEFAULT_FORM },
    SIX_VENDORS,
    { model: MODEL_EXPERIMENT, mode: "rfp", failureVendorId: "catering_01" }
  );
  console.log(`  ✅ Caterer failure: ${cateringFailure.summary.elapsed_sec}s, $${cateringFailure.summary.grand_total_wedding_cost} total`);

  // CSV
  const headers = ["scenario", "vendor_count", "accepted", "failed", "recovered", "grand_total", "elapsed_sec", "api_cost"];
  const rows = [
    ["baseline", baseline.summary.vendor_count, baseline.summary.accepted_count,
      0, 0, baseline.summary.grand_total_wedding_cost,
      baseline.summary.elapsed_sec, baseline.summary.total_api_cost_usd],
    ["venue_failure", venueFailure.summary.vendor_count, venueFailure.summary.accepted_count,
      venueFailure.summary.failed_count,
      venueFailure.results.filter(r => r.is_backup).length,
      venueFailure.summary.grand_total_wedding_cost,
      venueFailure.summary.elapsed_sec, venueFailure.summary.total_api_cost_usd],
    ["catering_failure", cateringFailure.summary.vendor_count, cateringFailure.summary.accepted_count,
      cateringFailure.summary.failed_count,
      cateringFailure.results.filter(r => r.is_backup).length,
      cateringFailure.summary.grand_total_wedding_cost,
      cateringFailure.summary.elapsed_sec, cateringFailure.summary.total_api_cost_usd],
  ];
  writeCSV(path.join(expDir, "exp3_results.csv"), headers, rows);

  // Save full logs
  fs.writeFileSync(path.join(expDir, "baseline.json"), JSON.stringify(baseline, null, 2));
  fs.writeFileSync(path.join(expDir, "venue_failure.json"), JSON.stringify(venueFailure, null, 2));
  fs.writeFileSync(path.join(expDir, "catering_failure.json"), JSON.stringify(cateringFailure, null, 2));

  console.log("\n  📋 Experiment 3 Summary:");
  console.log(`     Baseline total:      $${baseline.summary.grand_total_wedding_cost}`);
  console.log(`     Venue failure total:  $${venueFailure.summary.grand_total_wedding_cost}`);
  console.log(`     Caterer failure total: $${cateringFailure.summary.grand_total_wedding_cost}`);
  const venueOverhead = venueFailure.summary.elapsed_sec - baseline.summary.elapsed_sec;
  console.log(`     Recovery overhead:    ${venueOverhead}s (venue), ${cateringFailure.summary.elapsed_sec - baseline.summary.elapsed_sec}s (caterer)`);

  return { baseline: baseline.summary, venueFailure: venueFailure.summary, cateringFailure: cateringFailure.summary };
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2] || "all";
  ensureDir(RESULTS_DIR);

  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  ALTARA — A2A Negotiation Experiments     ║");
  console.log("║  Model: claude-3-5-haiku (cost-efficient) ║");
  console.log("╚═══════════════════════════════════════════╝");

  const allResults = {};

  if (arg === "1" || arg === "all") {
    allResults.exp1 = await runExperiment1();
  }
  if (arg === "2" || arg === "all") {
    allResults.exp2 = await runExperiment2();
  }
  if (arg === "3" || arg === "all") {
    allResults.exp3 = await runExperiment3();
  }

  // Save combined results
  const combinedPath = path.join(RESULTS_DIR, "all_experiments_summary.json");
  fs.writeFileSync(combinedPath, JSON.stringify(allResults, null, 2));
  console.log(`\n✅ All results saved to ${RESULTS_DIR}/`);
  console.log(`   Combined summary: ${combinedPath}`);
}

main().catch(err => {
  console.error("❌ Experiment failed:", err.message);
  process.exit(1);
});
