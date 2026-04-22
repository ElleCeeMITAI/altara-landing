# Testing Altara (for classmates & peer reviewers)

Welcome. This is the doc for MAS.664 classmates who want to try Altara for their HW9 peer test — and for anyone else who wants to poke at the system.

You have two options, ranked by effort.

---

## Option 1 — Use the hosted simulate page (recommended, ~10 minutes)

No setup required.

1. Go to **[altara-landing.up.railway.app/simulate.html](https://altara-landing.up.railway.app/simulate.html)**.
2. Fill in the form:
   - **Budget**: $20,000 – $100,000 (demo-bounded)
   - **Guest count**: 20 – 75 (demo-bounded)
   - **Service style**, **cuisine preference**, **dietary needs**: your call.
3. Click **Run simulation**.
4. Watch Belle and each vendor agent exchange messages live. The full trace is visible in the UI.
5. Fill in your peer-test feedback form.

**Note**: the hosted instance rate-limits each visitor to 3 simulations per day.

### What to look at

- Does Belle's pre-screen make sense given your inputs?
- When a vendor counter-offers, does the reasoning sound coherent?
- Are the three final packages (Budget / Recommended / Premium) actually differentiated?
- When Belle fails to close with a vendor, how does it recover?

---

## Option 2 — Send A2A messages directly to a vendor agent (~20 minutes)

If you want to test the protocol itself (e.g. your own couple agent negotiating with an Altara vendor), use the live A2A endpoint:

```bash
# 1. Discover the agent
curl https://altara-landing.up.railway.app/.well-known/agent.json

# 2. Ping it
curl -X POST https://altara-landing.up.railway.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"intent": "discover"}'

# 3. Submit an RFP
curl -X POST https://altara-landing.up.railway.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "rfp",
    "params": {
      "event_date": "2027-06-12",
      "guest_count": 100,
      "region": "Greater Boston",
      "service_style": "plated",
      "cuisine_preference": "Mediterranean",
      "budget_per_head": 100,
      "dietary_needs": ["vegetarian"]
    }
  }'
```

Save the `_state` from the RFP response and pass it back as `context` on your `negotiate` call (see [`PROTOCOL.md`](PROTOCOL.md) and [`../skills.md`](../skills.md) for the exact shapes).

Only the **Grand Meridian Ballroom catering** agent is currently exposed at `/api/agent`. The other six categories negotiate in-process during the simulate flow — they are not yet live as HTTP endpoints.

---

## Option 3 — Run Altara locally

You only need this if you want to modify the code or run experiments. Normal peer testing doesn't require it.

```bash
git clone https://github.com/ElleCeeMITAI/altara-landing.git
cd altara-landing
npm install
cp .env.example .env     # paste your own ANTHROPIC_API_KEY
npm start
```

Then `http://localhost:3000/simulate`.

---

## Reporting back

If you're a classmate running the HW9 peer test, your feedback goes in your own writeup — not here. If you find a bug or have a protocol comment, please open an Issue or Discussion on the repo.

Things I'd especially love feedback on:

- **Protocol ergonomics**: is the envelope + `_state` pattern easy to work with, or annoying?
- **Discovery**: is the agent card enough, or are there fields you wish it exposed?
- **Demo realism**: does the negotiation feel like real vendor behavior, or does it break the illusion somewhere?
- **Failure modes**: did you hit any bug, timeout, or weird output? Paste what you saw.
