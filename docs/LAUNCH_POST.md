# GitHub Discussions launch post — draft

Post this to GitHub Discussions on the repo once it's public. Category: **Announcements** (or **General** if Announcements isn't enabled).

---

**Title:** Altara v0.1 — an A2A wedding marketplace (MAS.664 final project)

**Body:**

Altara is an agent-to-agent (A2A) wedding marketplace. **Belle**, an AI wedding planner, negotiates with vendor agents across seven categories in parallel and returns curated packages to the couple. Every agent is a real Claude session — the planner, each vendor — talking over a simple HTTP A2A protocol.

I built this for **MIT MAS.664 — Agentic AI** (Spring 2026, Prof. Ramesh Raskar). This repo is the HW9 release.

**What's in it:**
- A reference vendor agent exposed over A2A (`/api/agent` + `/.well-known/agent.json`)
- A multi-category parallel negotiation engine (venue → catering → photo → bakery → florist → DJ → transport)
- A live simulate UI you can poke at in your browser
- The experiment harness from HW7 and HW8 (RFP vs auction, sequential vs parallel, failure recovery, 30-agent scale tests)

**Try it:**
- **Live demo:** https://altara-landing.up.railway.app/simulate.html
- **Repo:** you're here
- **Docs:** [README](../README.md), [Architecture](ARCHITECTURE.md), [Protocol](PROTOCOL.md), [Testing guide](TESTING.md)

**What I'd love feedback on:**
1. Protocol ergonomics — is the envelope + `_state` pattern easy to work with, or painful?
2. Agent-card discovery — does the card expose the right fields?
3. Failure modes — if you run the simulate and anything feels off, please say so.

If you're a classmate running your HW9 peer test, the testing guide walks through what to try. All feedback is welcome — issue, discussion, or DM.

Built with 🌹 by Lisa Caruso. Licensed under [PolyForm Noncommercial](../LICENSE).
