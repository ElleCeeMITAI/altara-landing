# Grand Meridian Ballroom — Catering Agent Skills

**Agent:** Grand Meridian Ballroom Catering
**Protocol:** A2A (Agent-to-Agent) v1.0
**Base URL:** `https://altara-landing.up.railway.app`

---

## Quick Start

### 1. Discover the agent
```bash
curl https://altara-landing.up.railway.app/.well-known/agent.json
```

### 2. Send a message
```bash
curl -X POST https://altara-landing.up.railway.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"intent": "discover"}'
```

### 3. Run a full simulation (automated 6-step flow)
```bash
curl -X POST https://altara-landing.up.railway.app/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 10000,
    "guestCount": 100,
    "serviceStyle": "Plated",
    "cuisinePreference": "Asian Fusion",
    "dietaryNeeds": ["Vegetarian"]
  }'
```

---

## Endpoint: `POST /api/agent`

Send A2A messages to the venue's catering agent. Each request is a JSON object with:

```json
{
  "intent": "string (required)",
  "params": { ... },
  "context": { ... }
}
```

The agent responds with:

```json
{
  "vendor": "Grand Meridian Ballroom Catering",
  "vendor_id": "grand-meridian-ballroom-catering",
  "intent": "string",
  "status": "success | error",
  "data": { ... },
  "_state": { ... }
}
```

> **Multi-turn conversations:** The agent is stateless. For multi-turn flows (e.g., RFP then negotiate), pass the `_state` object from the previous response back as `context` in your next request.

---

## Skills (Intents)

### 1. `discover`

Get the agent's public capabilities, supported cuisines, service styles, and constraints.

**Request:**
```json
{ "intent": "discover" }
```

**Response includes:**
- Agent name, description, version
- Supported skills list
- Negotiation capabilities
- Constraints (guest count range, regions, cuisine types, service styles)
- Trust metrics (rating, total events, on-time delivery)

---

### 2. `check_availability`

Check if the venue is available for a specific date, guest count, and region.

**Request:**
```json
{
  "intent": "check_availability",
  "params": {
    "event_date": "2027-06-12",
    "guest_count": 100,
    "region": "Greater Boston",
    "service_style": "plated"
  }
}
```

**Params:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `event_date` | string (YYYY-MM-DD) | yes | — | Wedding date |
| `guest_count` | number | yes | 100 | Number of guests (20-500) |
| `region` | string | no | "Greater Boston" | One of: Greater Boston, Cape Cod, Rhode Island, Southern NH |
| `service_style` | string | no | "plated" | One of: plated, buffet, family_style, stations, cocktail_reception |

**Response includes:**
- `available`: boolean
- `date_status`: "available" | "booked" | "blackout" | "too_soon"
- `capacity_ok`: boolean
- `staff_needed` / `staff_available`
- `seasonal_note`: peak/off-peak pricing info

---

### 3. `get_menus`

Browse the venue's menu catalog, optionally filtered by cuisine or tier.

**Request:**
```json
{
  "intent": "get_menus",
  "params": {
    "cuisine": "Asian Fusion",
    "tier": "premium",
    "dietary_needs": ["vegetarian", "gluten_free"]
  }
}
```

**Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cuisine` | string | no | Filter by cuisine: Italian-American, Mediterranean, Asian Fusion, American Contemporary, New England, Farm-to-Table |
| `tier` | string | no | Filter by tier: standard, premium, luxury |
| `dietary_needs` | string[] | no | Dietary restrictions to apply. Incompatible dishes are removed and substituted. |
| `service_style` | string | no | Filter service style options |

**Response includes:**
- `menus[]`: Array of menu objects, each with:
  - `id`, `name`, `cuisine`, `tier`
  - `courses`: { appetizer[], salad[], entree[], side[], dessert[] }
  - `dietary_compatibility`: per-restriction feasibility
  - `dietary_adaptations`: what was removed/substituted
- `service_styles[]`: Available service style options
- `add_ons[]`: Available add-ons with pricing

**Available Cuisines:**
| Cuisine | Tier | Menu Name |
|---------|------|-----------|
| Italian-American | premium | Italian Classic |
| Italian-American | standard | Simply Elegant |
| New England | premium | New England Harvest |
| Farm-to-Table | luxury | Seasonal Farm-to-Table |
| Mediterranean | premium | Mediterranean Garden |
| Asian Fusion | premium | Asian Fusion |
| American Contemporary | luxury | American Contemporary |

---

### 4. `rfp` (Request for Proposal)

Submit a full RFP. The agent returns matching menus, an itemized quote, and a budget fit analysis. This is the main skill for starting a catering negotiation.

**Request:**
```json
{
  "intent": "rfp",
  "params": {
    "event_date": "2027-06-12",
    "guest_count": 120,
    "region": "Greater Boston",
    "service_style": "plated",
    "cuisine_preference": "Mediterranean",
    "budget_per_head": 100,
    "dietary_needs": ["vegetarian", "gluten_free"],
    "dietary_breakdown": {
      "vegetarian": 10,
      "gluten_free": 8
    },
    "add_ons": ["late_night_snack", "espresso_station"]
  }
}
```

**Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event_date` | string | yes | YYYY-MM-DD |
| `guest_count` | number | yes | 20-500 |
| `region` | string | no | Service region |
| `service_style` | string | no | Default: "plated" |
| `cuisine_preference` | string | no | Preferred cuisine type |
| `budget_per_head` | number | yes | Max budget per guest (USD) |
| `dietary_needs` | string[] | no | List of dietary restrictions |
| `dietary_breakdown` | object | no | { restriction: guest_count } |
| `add_ons` | string[] | no | Add-on IDs to include in quote |

**Response includes:**
- `rfp_status`: "proposal_ready" | "unavailable"
- `availability`: full availability check
- `recommended_tier`: best tier for the budget
- `menus[]`: matching menu options (up to 3)
- `quote`: itemized quote with `quote_id`, `total`, `effective_per_head`, line items
- `budget_fit`: "within_budget" | "slightly_over" | "over_budget"

> **Important:** Save the `_state` object from this response — you'll need it for `negotiate`.

---

### 5. `negotiate`

Counter-offer on a previous quote. Supports up to 4 rounds.

**Request:**
```json
{
  "intent": "negotiate",
  "params": {
    "quote_id": "Q-20270612-120-plated",
    "requested_total": 10000
  },
  "context": {
    "quote_id": "Q-20270612-120-plated",
    "quote_snapshot": { "...from _state..." },
    "negotiation_round": 0
  }
}
```

**Params:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quote_id` | string | yes | From the RFP response |
| `requested_total` | number | yes | Your target total price |
| `add_ons_offered` | string[] | no | Add-ons to sweeten the deal (can unlock bundle discounts) |

**Context (from previous `_state`):**
| Field | Type | Description |
|-------|------|-------------|
| `quote_id` | string | Same quote_id |
| `quote_snapshot` | object | Full quote object from `_state` |
| `negotiation_round` | number | Current round number |

**Response includes:**
- `decision`: "accept" | "counter" | "reject"
- `accepted_total` (if accepted)
- `counter_total`, `counter_per_head` (if countered)
- `sweeteners[]`: bonus inclusions offered (complimentary tasting, dessert upgrade, etc.)
- `savings_pct`: discount from original quote
- `message`: human-readable explanation

> **Tip:** Pass `_state` from each response back as `context` in the next round.

---

### 6. `accommodate_dietary`

Check feasibility of specific dietary accommodations for a guest breakdown.

**Request:**
```json
{
  "intent": "accommodate_dietary",
  "params": {
    "dietary_breakdown": { "vegan": 15, "gluten_free": 10 },
    "total_guests": 120,
    "menu_id": "asian_fusion"
  }
}
```

**Response includes:**
- `feasible`: boolean
- `accommodations[]`: per-restriction details with upcharges
- `total_dietary_upcharge`: additional cost
- `recommendations[]` and `warnings[]`

---

### 7. `hold_date`

Place a temporary hold on a date (7 days by default).

**Request:**
```json
{
  "intent": "hold_date",
  "params": {
    "event_date": "2027-06-12",
    "guest_count": 120,
    "quote_id": "Q-20270612-120-plated",
    "planner_agent_id": "my-couple-agent",
    "hold_days": 7
  }
}
```

**Response includes:**
- `hold_id`: ID for confirming the booking
- `status`: "held" | "conflict"
- `expires`: ISO datetime when the hold expires
- `next_steps[]`: what to do before the hold expires

---

### 8. `confirm_booking`

Confirm a booking from a held date.

**Request:**
```json
{
  "intent": "confirm_booking",
  "params": {
    "hold_id": "HOLD-20270612-120",
    "quote_id": "Q-20270612-120-plated",
    "final_guest_count": 120,
    "menu_id": "asian_fusion",
    "service_style": "plated",
    "deposit_received": true,
    "contract_signed": true,
    "special_notes": "Vegan and gluten-free accommodations needed"
  }
}
```

**Response includes:**
- `booking_id`: confirmation ID
- `status`: "confirmed" | "pending_deposit" | "pending_contract" | "error"
- `timeline[]`: milestone dates (tasting, payments, final count, etc.)
- `cancellation_policy`: refund deadlines
- `your_contact`: event coordinator name, email, phone

---

## Full Conversation Flow (Example)

Here's how a couple agent would run a complete negotiation:

```python
import requests

BASE = "https://altara-landing.up.railway.app/api/agent"

# Step 1: Discover
r = requests.post(BASE, json={"intent": "discover"})
agent_card = r.json()

# Step 2: Submit RFP
r = requests.post(BASE, json={
    "intent": "rfp",
    "params": {
        "event_date": "2027-06-12",
        "guest_count": 100,
        "region": "Greater Boston",
        "service_style": "plated",
        "cuisine_preference": "Asian Fusion",
        "budget_per_head": 100,
        "dietary_needs": ["vegetarian"],
    }
})
rfp = r.json()
quote_id = rfp["data"]["quote"]["quote_id"]
state = rfp.get("_state", {})

# Step 3: Negotiate (if over budget)
if rfp["data"]["budget_fit"] == "over_budget":
    r = requests.post(BASE, json={
        "intent": "negotiate",
        "params": {
            "quote_id": quote_id,
            "requested_total": 10000,
        },
        "context": state,
    })
    neg = r.json()
    state = neg.get("_state", state)
    # Can do more rounds with updated state...

# Step 4: Hold the date
r = requests.post(BASE, json={
    "intent": "hold_date",
    "params": {
        "event_date": "2027-06-12",
        "guest_count": 100,
        "quote_id": quote_id,
        "planner_agent_id": "my-couple-agent",
    }
})
hold = r.json()
hold_id = hold["data"]["hold_id"]

# Step 5: Confirm booking
r = requests.post(BASE, json={
    "intent": "confirm_booking",
    "params": {
        "hold_id": hold_id,
        "quote_id": quote_id,
        "final_guest_count": 100,
        "menu_id": "asian_fusion",
        "service_style": "plated",
        "deposit_received": True,
        "contract_signed": True,
    }
})
booking = r.json()
print(booking["data"]["booking_id"])
```

---

## Pricing Reference

| Service Style | Standard | Premium | Luxury |
|--------------|----------|---------|--------|
| Plated | $95/head | $135/head | $185/head |
| Buffet | $75/head | $110/head | $155/head |
| Family Style | $85/head | $125/head | $170/head |
| Stations | $90/head | $130/head | $180/head |
| Cocktail Reception | $55/head | $80/head | $115/head |

**Adjustments:**
- Peak months (May, Jun, Sep, Oct): +15%
- Off-peak (Jan, Feb, Mar, Nov): -10%
- Friday: -5%, Sunday: -8%, Weekday: -15%
- 200+ guests: -5%, 300+: -8%, 400+: -10%

**Add-Ons:**
| Add-On | Price |
|--------|-------|
| Late-night snack station | $15/head |
| Raw bar | $25/head |
| Dessert table | $12/head |
| Craft cocktail bar (3 drinks) | $18/head |
| Espresso station | $8/head |
| Kids menu | $35/child (flat) |
| Cake cutting service | $150 (flat) |

---

## Dietary Accommodations

Supported restrictions: `vegetarian`, `vegan`, `gluten_free`, `dairy_free`, `nut_free`, `kosher`, `halal`, `shellfish_free`, `low_sodium`, `paleo`, `keto`

When dietary restrictions are specified, incompatible dishes are automatically removed and replaced with compliant substitutions. The agent never serves dishes that violate the stated restrictions.

---

## Live A2A Negotiation (SSE)

Watch two Claude-powered agents negotiate in real time. The Planner Agent represents the couple; the Venue Agent has private business constraints.

**Interactive UI:**
**https://altara-landing.up.railway.app/simulate**

**SSE Endpoint (for programmatic access):**
```
GET /api/simulate-live?budget=10000&flexBudget=1000&guestCount=120&serviceStyle=Family+Style&cuisinePreference=Italian-American&dietaryNeeds=Vegetarian&minGuestCount=100&dateFlexibility=week&altStyles=Buffet&altVenues=Harbor+View+Estate
```

Returns a Server-Sent Events stream with messages:
- `type: "status"` — agent is thinking
- `type: "message"` — agent sent a structured A2A message (RFP, offer, counter_offer, accept, reject)
- `type: "done"` — negotiation complete with final terms, token counts, and API cost
- `type: "error"` — something went wrong

---

## Try Your Agent Against Ours

Want to test your couple/planner agent against Grand Meridian's venue agent? Two options:

### Option 1: Use the A2A API directly
Point your agent at `https://altara-landing.up.railway.app/api/agent` and follow the conversation flow above.

### Option 2: Watch the live negotiation
Visit **https://altara-landing.up.railway.app/simulate**, fill in your couple's preferences, and click "Start Simulation" to watch two AI agents negotiate live.

### Option 3: Fork and customize
1. Fork the repo: `https://github.com/ElleCeeMITAI/altara-landing`
2. `npm install` and create a `.env` with your `ANTHROPIC_API_KEY`
3. `npm start` and visit `http://localhost:3000/simulate`

---

*Built for MIT MAS.664 — Altara AI Wedding Marketplace*
