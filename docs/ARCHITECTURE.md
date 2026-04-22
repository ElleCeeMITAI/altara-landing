# Architecture

This document goes deeper than the README. Read the [top-level README](../README.md) first.

## Components

| Component | File | Role |
|---|---|---|
| Express server | `server.js` | HTTP + SSE entry point. Hosts static site, A2A endpoints, simulation streams. |
| Reference vendor agent | `agents.js` (`CatererAgent`) | A2A-compliant vendor agent. Handles `discover`, `check_availability`, `get_menus`, `rfp`, `negotiate`, `hold_date`, `confirm_booking`, `accommodate_dietary`. Exposed over HTTP at `/api/agent`. |
| Single-vendor live negotiation | `negotiate.js` | Belle negotiates with one venue agent using real Claude calls. Streams events over SSE. |
| Multi-category negotiation | `negotiate-multi.js` | Belle runs parallel negotiations across up to 7 categories. This powers the main simulate UI. |
| Experiment harness | `run_experiments.js`, `run_experiments.py` | Reproduces HW7 (6-vendor) and HW8 (30-vendor) experiments. Outputs land in `results/`. |
| Vendor prompt templates | `prompts/*.txt` | System prompts for each vendor category. Private business constraints (price floors, blackout dates, sweeteners) are injected at runtime from `vendors/*.json`. |
| Synthetic vendor data | `vendors/**/*.json` | ~30 fake vendors across 7 categories. All Greater Boston, all synthetic. |
| Simulation UI | `public/simulate.html` | Browser interface for running a live multi-category negotiation. |

## Agent model

Every agent is a Claude session. There is no persistent agent process — each HTTP or simulation call instantiates a fresh agent from its prompt template and vendor record. State continuity across turns is passed explicitly in the A2A message envelope (see [PROTOCOL.md](PROTOCOL.md)).

This is intentional:
- **Stateless agents** are cheap to run and easy to scale horizontally.
- **State in the message** makes the protocol portable — any couple agent on any stack can negotiate with an Altara vendor.
- **Backups are trivial**: if a vendor agent fails mid-negotiation, Belle can spin up a pre-screened backup with the same RFP.

## Negotiation flow (multi-category)

1. **Couple submits preferences** via the simulate UI: budget, guest count, service style, dietary needs, cuisine, entertainment type, etc.
2. **Belle pre-screens** all vendors against 8 criteria: location radius, rating threshold, availability window, capacity fit, service-style match, cuisine match, dietary support, category-specific flags (genre match for DJs, style match for photographers, etc.). This step typically filters out ~40% of synthetic candidates.
3. **Belle allocates budget** across categories using default weights (e.g., venue ~45%, catering ~20%, photo ~10%, etc.) with a 15% unallocated buffer for overruns.
4. **Parallel negotiation** launches across categories with a concurrency of up to 5. Each vendor agent receives its system prompt + private business constraints + the couple's RFP, and returns an offer. Belle counter-offers up to 4 rounds per vendor.
5. **Budget redistribution**: if a venue negotiation comes in under allocation, Belle rebalances the surplus into downstream categories. If it overruns, the buffer absorbs it before Belle re-prompts with a lower ceiling.
6. **Venue-anchored matching**: non-venue categories are filtered by geographic distance from the selected venue before negotiation begins, so Belle doesn't waste tokens negotiating with a DJ 90 minutes away.
7. **Package assembly**: Belle produces three packages (Budget, Recommended, Premium) from the accepted offers.
8. **Flexibility retries**: if a venue fully rejects at the couple's hard budget, Belle applies an optional "flexibility budget" and retries once before giving up.

## Runtime

- **Hosting**: the frontend and Express server run on Railway. All agent sessions are cloud-hosted Claude API calls — there are no long-running local agent processes.
- **Model**: live demo runs on Claude Haiku (cost). HW7/HW8 experiments were run on Claude Sonnet (quality).
- **Rate limits**: the hosted simulate page caps each visitor at 3 simulations/day to keep API costs predictable.

## Security / trust model

- Vendor agents expose only their **public agent card** (`/.well-known/agent.json`) and their skills. Private business constraints (price floors, margin rules, deposit minimums) are injected at prompt time and are never surfaced in responses.
- The A2A endpoint (`/api/agent`) is currently **unauthenticated** — intentional, for class and peer-testing purposes. Production vendor agents would need API keys or mTLS.
- The couple agent is trusted. There is no defense against an adversarial couple agent probing for private constraints; that is a protocol-spec open problem (see [PROTOCOL.md § Open questions](PROTOCOL.md#open-questions)).

## What's simulated vs. real

| Layer | Real | Simulated |
|---|---|---|
| Planner agent (Belle) | ✅ Real Claude session | — |
| Vendor agents | ✅ Real Claude sessions w/ real prompts | Business identities are synthetic |
| A2A protocol | ✅ Real HTTP | — |
| Pre-screening | ✅ Real code | — |
| Budget math | ✅ Real code | — |
| Vendor inventory | — | 30 synthetic vendors in `vendors/` |
| Payments | — | Mock confirmation numbers only |
| Calendar / booking persistence | — | Not implemented |

## What's not in this repo

The commercial roadmap, pricing model, go-to-market plan, and consumer app design live outside this repository. This repo is scoped to the A2A negotiation engine and the academic writeups.
