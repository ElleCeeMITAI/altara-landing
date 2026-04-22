# Experiments — HW7 & HW8 results

All experiments were run on Anthropic's Claude API (Sonnet). Raw results are in `results/`; the homework writeups they came from are [`../hw7_writeup.md`](../hw7_writeup.md) and [`../hw8_writeup.md`](../hw8_writeup.md).

---

## HW7 — Initial agent experiments (6 vendor agents)

Baseline scenario: 120-guest Greater Boston wedding, June 2027, $50K budget. Six vendor agents across venue, catering, florist, photographer, DJ, and bakery.

### Experiment 1 — RFP vs. Auction

- **Question**: does framing negotiations as competitive auctions lower prices vs. direct RFPs?
- **Result**: mixed. Auction saved **17.8%** on the venue ($23,600 → $19,400) but **raised** photographer prices by 21.8% and bakery by 25.0%. Net savings across the package: **4.4%** ($60,940 → $58,230).
- **Takeaway**: auctions work on commoditized high-ticket items; they backfire on boutique vendors who anchor defensively when they sense competition. A hybrid protocol (auction venues, RFP artisans) would save an estimated ~9.2%.
- Raw data: `results/exp1_rfp_vs_auction/`.

### Experiment 2 — Sequential vs. Parallel negotiation

- **Question**: does parallel vendor negotiation actually speed things up — and at what cost in tokens?
- **Result**: yes, substantially. At 6 vendors, parallel was 2.2× faster (46.3s vs 102.4s). At 30 vendors, parallel was **4.3× faster** (129.7s vs 553.0s), approaching the theoretical max of 5× given concurrency=5. Parallel was also **30% more token-efficient** and **28% cheaper** at 30 vendors.
- **Takeaway**: parallel execution is essential at scale — it's faster *and* cheaper, because concurrent negotiations avoid accumulating long sequential context histories.
- Raw data: `results/exp2_scale_latency/`.

### Experiment 3 — Failure recovery

- **Question**: can the system recover when a vendor agent fails mid-negotiation?
- **Result**: 100% recovery. Venue backup was 14.8% more expensive ($51,150 → $58,720 total). Caterer backup was $435 cheaper than baseline. Recovery was *faster* than baseline (failed negotiations terminate early).
- **Takeaway**: fault tolerance works. Backup vendor pool quality matters more for cost outcomes than recovery speed.
- Raw data: `results/exp3_failure_recovery/`.

---

## HW8 — Scaled experiments (30 vendor agents, 7 categories)

Expanded the vendor pool from 6 to 30 and introduced multi-category budget-aware negotiation across 7 categories (venue, catering, photographer, bakery, florist, DJ, transport). Added pre-screening, venue-anchored matching, budget redistribution, and 3-package assembly.

### Scale & latency

| Vendors | Sequential | Parallel | Speedup | Seq cost | Par cost |
|---:|---:|---:|---:|---:|---:|
| 3  | 50.7s  | 23.2s  | 2.2× | $0.068 | $0.077 |
| 6  | 102.4s | 46.3s  | 2.2× | $0.142 | $0.168 |
| 10 | 198.0s | 45.1s  | 4.4× | $0.295 | $0.235 |
| 30 | 553.0s | 129.7s | 4.3× | $0.807 | $0.578 |

### What scaled well

- Parallel speedup grew from 2.2× (6 vendors) to 4.3× (30 vendors).
- 30 vendors completed in ~2 minutes (parallel) — viable for a production UX.
- Parallel was 30% more token-efficient and 28% cheaper than sequential at 30 vendors.

### What degraded

- Sequential time grew linearly (~18.4s/vendor). 9+ minutes at 30 vendors is unusable.
- API rate limits became a bottleneck at 30-vendor parallel — required retry logic with exponential backoff.
- Context pressure on the planner occasionally reduced budget-tracking precision.

### What broke (and how it got fixed)

- **Without pre-screening**, ~40% of vendors were poor matches (wrong location, insufficient capacity, incompatible style). **Fix**: 8-criteria pre-screening pipeline. Wasted negotiations dropped from 40% to <5%.
- **Budget redistribution edge case**: if venue came in >20% over allocation, downstream categories were over-constrained and rejected offers. **Fix**: 15% unallocated buffer + flexibility-budget retry.
- **Geographic mismatch**: pre-screening added venue-anchored radius filtering so Belle doesn't negotiate with vendors 90 minutes from the event.

### Key takeaways

1. Parallel execution is essential at scale — faster *and* cheaper.
2. Pre-screening is the highest-ROI improvement — eliminates ~40% of wasted negotiations.
3. Budget management across categories is the hardest part — sequential dependencies cascade.
4. The system is production-viable at 30 agents: ~2-minute negotiation, under $1 in API cost.

---

## Reproducing

```bash
node run_experiments.js
```

Results are written into `results/exp1_rfp_vs_auction/`, `results/exp2_scale_latency/`, and `results/exp3_failure_recovery/`.
