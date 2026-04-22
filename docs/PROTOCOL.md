# A2A Protocol — Reference Spec

Altara's A2A protocol is an HTTP-based message envelope for agent-to-agent negotiation. It follows the general shape of the [A2A project](https://a2aproject.io) agent-card discovery pattern, with a small, negotiation-oriented intent vocabulary.

The canonical per-skill spec (params, responses, examples) is [`skills.md`](../skills.md), served live at [`/skills.md`](https://altara-landing.up.railway.app/skills.md). This document covers the envelope and discovery pattern.

---

## Discovery — Agent Card

Every Altara vendor agent exposes a public card at `/.well-known/agent.json`:

```bash
curl https://altara-landing.up.railway.app/.well-known/agent.json
```

Returns name, version, supported skills, constraints (guest-count range, regions, service styles), trust metrics (rating, total events, on-time delivery), and endpoint URLs.

The card is the only introspection surface a couple agent needs before it starts sending messages.

---

## Message envelope

All A2A messages are JSON posted to `/api/agent`:

```json
{
  "intent": "<required-intent-name>",
  "params": { /* skill-specific */ },
  "context": { /* optional, for multi-turn state */ }
}
```

Response shape:

```json
{
  "vendor": "Grand Meridian Ballroom Catering",
  "vendor_id": "grand-meridian-ballroom-catering",
  "intent": "<echoed>",
  "status": "success | error",
  "data": { /* skill-specific */ },
  "_state": { /* pass back as `context` on the next call */ }
}
```

### State continuity

Agents are stateless per request. If a call produces state the caller will need on a follow-up turn (e.g. a `quote_id` and snapshot from `rfp` → `negotiate`), the agent returns it in `_state`. The caller passes that object back as `context` on the next request.

This keeps the agents pure functions of the message + context, which is why parallel execution, replay, and failure-recovery all work without special infrastructure.

---

## Intent vocabulary

| Intent | Purpose |
|---|---|
| `discover` | Get the agent's public capabilities. |
| `check_availability` | Is this vendor free on a given date at a given guest count and region? |
| `get_menus` | Browse menu catalog (for food vendors). |
| `accommodate_dietary` | Feasibility check for dietary accommodations. |
| `rfp` | Submit a Request for Proposal. Returns an itemized quote and budget-fit analysis. |
| `negotiate` | Counter-offer on a prior quote. Up to 4 rounds. Decision: `accept`, `counter`, or `reject`. |
| `hold_date` | Soft-hold a date after verbal agreement (vendor-defined hold period). |
| `confirm_booking` | Final booking confirmation (returns a mock confirmation number — no real payment). |

Detailed params, response fields, and example exchanges for each intent: [`../skills.md`](../skills.md).

---

## Error responses

Errors return `status: "error"` with a human-readable `message`. Missing or invalid `intent` returns a 400 with the full list of supported intents so malformed callers self-correct quickly.

```json
{
  "error": "Missing 'intent' field",
  "supported_intents": ["discover", "check_availability", "get_menus", ...],
  "example": { "intent": "discover", "params": {} }
}
```

---

## Open questions

The current protocol is the minimum viable surface for this research. Known gaps:

- **Authentication.** No auth today. Production needs API keys at minimum, ideally mTLS or OAuth for vendor-couple trust.
- **Idempotency.** `confirm_booking` should accept an idempotency key.
- **Cancellation.** No explicit cancel intent — if a hold expires, the caller has to re-RFP.
- **Concurrency safety.** Two couple agents can currently both hold the same date. Real deployment needs optimistic locking or a reservation ledger.
- **Private-constraint probing.** A malicious couple agent could send many boundary-testing RFPs to reverse-engineer a vendor's price floor. Countermeasure: rate limits + noisy rejections. Not yet implemented.

---

## Peer-testing notes

If you want your own couple/planner agent to negotiate with Altara, the shortest path is:

1. `GET /.well-known/agent.json` → read skills.
2. `POST /api/agent` with `{ "intent": "discover" }` → confirm round-trip works.
3. Send an `rfp`. Save `_state`.
4. Send a `negotiate` with that `_state` as `context`. Iterate up to 4 rounds.

See [`TESTING.md`](TESTING.md) for a step-by-step peer-test walkthrough.
