# HW9 — Submission

**Lisa Caruso · MIT MAS.664 Agentic AI · Spring 2026**

## Project: Altara

Altara is an agent-to-agent (A2A) wedding marketplace. Belle, an AI wedding planner, negotiates with vendor agents across seven categories in parallel and returns three curated packages to the couple. Every agent is a live Claude session — planner and vendors — communicating over a simple HTTP A2A protocol. This HW9 release ships the negotiation engine, a reference vendor agent exposed over A2A, the simulation UI, the HW7 and HW8 experiment harness, and the docs needed for a stranger to clone, run, and understand the system.

## Deliverables

| Deliverable | Link |
|---|---|
| **Public GitHub repo** (with README, architecture, protocol spec, testing guide, HW7/HW8 results) | https://github.com/ElleCeeMITAI/altara-landing |
| **Deployed website / docs** (live negotiation simulator + docs served from the repo) | https://altara-landing.up.railway.app · [simulate](https://altara-landing.up.railway.app/simulate.html) |
| **Lightweight launch post** | https://github.com/ElleCeeMITAI/altara-landing/discussions/1 |
| **Peer-test feedback** | Submitted separately per HW9 rubric |
| **Optional white paper** | Not submitted — architecture docs in `/docs` serve this role |

## License note

The repo is published under the **PolyForm Noncommercial License 1.0.0**. This allows classmates, researchers, and the public to read, run, fork, and modify the code for noncommercial purposes, while preserving commercial rights for the ongoing Altara work. Per Maria's clarification on the class mailing list (04/2026), students may choose their own license and a non-permissive license satisfies the spirit of the open-source requirement.

## What's in the repo

- `README.md` — elevator pitch, architecture diagram, quickstart, usage, limitations, roadmap.
- `docs/ARCHITECTURE.md` — deeper component walkthrough, negotiation flow, what's simulated vs. real.
- `docs/PROTOCOL.md` — A2A message envelope, agent-card discovery, open questions.
- `docs/TESTING.md` — three paths to exercise the system (hosted demo, direct A2A calls, local run).
- `docs/EXPERIMENTS.md` — HW7 (RFP vs. auction, sequential vs. parallel, failure recovery) and HW8 (30-agent scaled) results summarized.
- `skills.md` — per-intent spec for the live catering A2A endpoint, served at `/skills.md`.
- `results/` — raw HW7 and HW8 experiment outputs (CSV + JSON).
- `run_experiments.js` — reproduces the experiments.

## What I deliberately kept out of the public repo

Commercial roadmap, pricing, go-to-market plan, and consumer app design remain in private notes. The architecture, protocol, negotiation engine, and reproducible experiments are all public — enough for a reader to understand and extend the system without disclosing the business.
