# HW8: Altara — Scaled Experiments
**Lisa Caruso — MAS.664 — April 2026**

## What Changed Since HW7
In HW7, we tested 6 vendor agents across 3 experiments (RFP vs. auction, sequential vs. parallel, failure recovery). In HW8, we scaled to 30 agents and introduced multi-category budget-aware negotiation across 7 vendor categories simultaneously.

Key additions since HW7:
- Expanded vendor pool from 6 to 30 agents (5 venues, 5 caterers, 5 photographers, 3 bakeries, 5 florists, 5 DJs, 2 transport)
- Added PlannerState with budget tracking and redistribution across categories
- Added pre-screening filters (location radius, ratings, availability, genre matching, LGBTQ+ flag)
- Added venue-anchored matching (all vendors filtered by distance from selected venue)
- Added 3-package assembly (Budget, Recommended, Premium)

## Scaled Setup
- **30 vendor agents** across 7 categories, each with unique pricing, constraints, and negotiation styles
- **Budget-aware Planner** that tracks spend across categories and redistributes surplus/deficit
- **Sequential vs. Parallel** execution at 3, 6, 10, and 30 vendor scales
- **Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

## Experiment: Scale & Latency at 30 Agents

| Vendors | Sequential | Parallel | Speedup | Seq Cost | Par Cost |
|---:|---:|---:|---:|---:|---:|
| 3 | 50.7s | 23.2s | 2.2x | $0.068 | $0.077 |
| 6 | 102.4s | 46.3s | 2.2x | $0.142 | $0.168 |
| 10 | 198.0s | 45.1s | 4.4x | $0.295 | $0.235 |
| 30 | 553.0s | 129.7s | 4.3x | $0.807 | $0.578 |

## Results, Failures & Bottlenecks

**What scaled well:**
- Parallel speedup increased from 2.2x (6 vendors) to 4.3x (30 vendors) — near theoretical max of 5x given concurrency=5
- 30 vendors negotiated in ~2 minutes (parallel) — viable for production UX
- Parallel was 30% more token-efficient and 28% cheaper than sequential at 30 vendors

**What degraded:**
- Sequential time grew linearly (~18.4s/vendor) — 9+ minutes for 30 vendors is unusable
- At 30 vendors, API rate limiting became a bottleneck — occasional 429 errors required retry logic
- Context window pressure: with 30 concurrent negotiations, the Planner's context grew large, occasionally causing less precise budget tracking

**What broke:**
- Without pre-screening, ~40% of vendors were poor matches (wrong location, insufficient capacity, incompatible style). Pre-screening reduced wasted negotiations from 40% to <5%
- Budget redistribution edge case: if venue negotiation exceeded allocation by >20%, downstream categories were over-constrained, leading to rejected offers in bakery/transport

**What we added to fix it:**
- Pre-screening pipeline filtering on 8 criteria before negotiation begins
- Budget buffer (15% unallocated) to absorb overages
- Retry logic with exponential backoff for API rate limits
- Venue-anchored radius filtering to eliminate geographically incompatible vendors

## Key Takeaways
1. **Parallel execution is essential at scale** — 4.3x faster AND 28% cheaper
2. **Pre-screening is the highest-ROI improvement** — eliminates 40% of wasted negotiations
3. **Budget management across categories is the hardest problem** — sequential category dependencies create cascading constraints
4. **The system is production-viable at 30 agents** — 2-minute negotiation, <$1 API cost

**Live demo:** https://altara-landing.up.railway.app/simulate.html

---
*Infrastructure note: The simulation frontend and Express server are deployed on Railway (cloud). All 30 vendor agents and the planner agent run as separate sessions on Anthropic's cloud-hosted Claude API — each agent is an independent cloud instance, not a local process. At 30-vendor scale, up to 5 concurrent cloud API sessions negotiate simultaneously.*
