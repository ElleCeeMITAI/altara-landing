# HW7: Altara --- Initial Agent Experiments
**Lisa Caruso --- MAS.664 --- April 2026**

## System Overview
Altara is an A2A wedding marketplace where a Planner agent negotiates with Vendor agents (Claude Sonnet 4) to assemble complete wedding packages. We tested with 6 vendor agents across 6 categories (venue, catering, florist, photographer, DJ, bakery) using a baseline scenario: 120-guest Boston wedding, June 2027, $50K budget.

## Experiment 1: RFP vs. Auction Negotiation (6 agents)
- **What we tested:** Whether framing negotiations as competitive auctions vs. direct proposals changes price outcomes.
- **What we changed:** Same 6 vendors negotiated under both RFP (direct proposal) and Auction (competitive bidding) protocols.
- **Expected:** Auction would uniformly lower prices through competitive pressure.
- **Results:** Auction saved 17.8% on the venue ($23,600 to $19,400) but *increased* photographer prices by 21.8% and bakery by 25.0%. Net savings only 4.4% ($60,940 to $58,230).
- **Takeaway:** Auction works for high-ticket commoditized items but backfires on boutique vendors who anchor defensively. A hybrid strategy (auction for venues, RFP for artisans) would save ~9.2%.

## Experiment 2: Sequential vs. Parallel Negotiation (6 agents)
- **What we tested:** Whether running vendor negotiations in parallel vs. sequentially affects speed, cost, and token usage.
- **What we changed:** Same 6 vendors negotiated sequentially (one at a time) vs. in parallel (concurrency=5). Also tested at 10 and 30 vendors.
- **Expected:** Parallel would be ~5x faster with similar costs.
- **Results:** At 6 vendors: parallel completed in 46.3s vs. 102.4s sequential (2.2x speedup). At 30 vendors: 129.7s vs. 553.0s (4.3x speedup, approaching the 5x theoretical max). Parallel was also 30% more token-efficient and 28% cheaper at 30 vendors.
- **Takeaway:** Parallel execution is faster *and* cheaper at scale --- concurrent negotiations avoid accumulating long sequential context histories.

## Experiment 3: Failure Recovery (6 agents + 2 backups)
- **What we tested:** Whether the system can recover when a vendor agent fails mid-negotiation.
- **What we changed:** Injected failures into (a) venue agent and (b) caterer agent, forcing the system to activate pre-identified backup vendors.
- **Expected:** Recovery would succeed but with time and cost penalties.
- **Results:** 100% recovery rate. Venue backup was 14.8% more expensive ($51,150 to $58,720 total). Caterer backup was $435 *cheaper* than baseline. Recovery was *faster* (102.4s vs. 120.9s baseline) because failed negotiations terminate early.
- **Takeaway:** Fault tolerance works. Pre-screening backup vendor quality matters more for cost control than recovery speed.

## Summary

| Experiment | Agents | Key Finding |
|---|---|---|
| RFP vs. Auction | 6 | Auction saves 17.8% on venues, backfires on boutique vendors (+25%) |
| Seq. vs. Parallel | 6--30 | 4.3x speedup at scale; parallel is also 28% cheaper |
| Failure Recovery | 6+2 | 100% recovery rate, faster than baseline, cost depends on backup pool |

**Live demo:** [altara-landing.up.railway.app/simulate.html](https://altara-landing.up.railway.app/simulate.html)

---
*Infrastructure note: The simulation frontend and Express server are deployed on Railway (cloud). All vendor and planner agents run on Anthropic's cloud-hosted Claude API instances — each agent is a separate API session, not a local process. Negotiations are conducted via parallel cloud API calls, meeting the requirement for agents running on cloud instances.*
