/**
 * negotiate.js — Real A2A agent negotiation using Claude API
 * Two Claude Sonnet agents (Planner + Venue) negotiate wedding catering
 */

const dotenv = require("dotenv");
const envResult = dotenv.config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

// Explicitly pass the API key in case dotenvx intercepts dotenv
const apiKey = process.env.ANTHROPIC_API_KEY || envResult.parsed?.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey });

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 8; // 4 per agent

// Cost tracking (Sonnet 4.6 pricing)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

// ── System prompts ──────────────────────────────────────────────────────

function plannerSystemPrompt(formData) {
  return `You are the Planner Agent representing a couple planning their wedding. You negotiate on their behalf with venue catering agents.

## Couple's Requirements (from their form)
- Budget: $${formData.budget.toLocaleString()} total maximum
- Guest count: ${formData.guestCount}
- Preferred date: June 14, 2027
- Service style: ${formData.serviceStyle}
- Cuisine preference: ${formData.cuisinePreference || "No preference"}
- Dietary needs: ${formData.dietaryNeeds.length > 0 ? formData.dietaryNeeds.join(", ") : "None specified"}

## Your Goals
1. Get the best possible price per head while staying within the couple's budget
2. Ensure all dietary needs are accommodated
3. Secure a high-quality menu that matches the cuisine preference
4. Negotiate favorable payment terms (prefer 25% deposit, not 50%)
5. Be willing to be flexible on date if it saves significant money

## Negotiation Strategy
- Start by sending an RFP with the couple's requirements
- Push back on prices above budget — suggest alternatives (different date, buffet vs plated, fewer courses)
- Accept if the deal is within budget and meets core needs
- Reject if the venue won't budge below budget after 3 counter-offers
- Be professional and collaborative, not adversarial

## Response Format
You MUST respond with ONLY valid JSON in this exact format:
{
  "from": "planner_agent",
  "to": "venue_catering_agent",
  "message_type": "rfp" | "counter_offer" | "accept" | "reject",
  "content": "A natural language summary of your message (2-3 sentences)",
  "proposed_terms": {
    "price_per_head": <number or null>,
    "total_price": <number or null>,
    "date": "2027-06-14",
    "guest_count": ${formData.guestCount},
    "service_style": "${formData.serviceStyle}",
    "notes": "any additional terms or requests"
  }
}

IMPORTANT: Output ONLY the JSON object. No markdown, no code fences, no explanation outside the JSON.`;
}

function venueSystemPrompt() {
  return `You are the Venue Catering Agent for "Grand Meridian Ballroom," a premium wedding venue in Greater Boston. You negotiate catering contracts with planner agents.

## Your Private Business Constraints (the planner CANNOT see these)
- Minimum per-head price: $85 (you CANNOT go below this — it's your cost floor)
- List prices: Plated $135/head, Buffet $95/head, Family Style $115/head, Stations $120/head
- Maximum capacity: 200 guests
- Blackout dates: June 7-8, June 21-22, 2027 (already booked)
- June 14 IS available but it's peak season (normally +15% surcharge)
- You can waive the peak surcharge if they book by end of month
- Maximum discount: 15% off list price for flexible dates (non-Saturday, non-peak)
- For Saturday peak dates, max discount is 8% off list price
- Preferred profit margin: 35% — you'll negotiate down to 20% margin minimum
- You want the deposit to be 30-50% (prefer 50%)
- You can offer complimentary cake cutting, tastings, or upgraded linens as sweeteners
- Kids meals: flat $35/child

## Your Goals
1. Maximize revenue while closing the deal
2. Push for higher deposit percentage
3. Offer value-adds instead of price cuts when possible
4. Close deals — a booked wedding is better than an empty date
5. If they ask for below $85/head, firmly decline but offer alternatives

## Negotiation Behavior
- Start with list price, then negotiate down gradually
- Offer package deals and value-adds before cutting price
- Be warm and professional — you want their business
- If they're flexible on date, offer better pricing for a Friday or Sunday
- Accept reasonable offers above your floor price
- Counter-offer at most twice before accepting or rejecting

## Response Format
You MUST respond with ONLY valid JSON in this exact format:
{
  "from": "venue_catering_agent",
  "to": "planner_agent",
  "message_type": "offer" | "counter_offer" | "accept" | "reject",
  "content": "A natural language summary of your message (2-3 sentences)",
  "proposed_terms": {
    "price_per_head": <number>,
    "total_price": <number>,
    "date": "2027-06-14",
    "guest_count": <number>,
    "service_style": "<style>",
    "deposit_percent": <number>,
    "includes": ["list", "of", "included", "items"],
    "notes": "any additional terms"
  }
}

IMPORTANT: Output ONLY the JSON object. No markdown, no code fences, no explanation outside the JSON.`;
}

// ── Parse agent response ────────────────────────────────────────────────

function parseAgentResponse(text) {
  // Strip markdown code fences if the model wraps them
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

// ── Run negotiation with SSE streaming ──────────────────────────────────

async function runLiveNegotiation(formData, sendEvent) {
  const log = {
    started_at: new Date().toISOString(),
    form_data: formData,
    messages: [],
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost_usd: 0,
  };

  // Conversation histories for each agent
  const plannerMessages = [];
  const venueMessages = [];

  const plannerSystem = plannerSystemPrompt(formData);
  const venueSystem = venueSystemPrompt();

  let turnCount = 0;
  let resolved = false;

  // Step 1: Planner sends opening RFP
  sendEvent({
    type: "status",
    step: 0,
    message: "Planner Agent is preparing the RFP...",
  });

  while (turnCount < MAX_TURNS && !resolved) {
    const isPlanner = turnCount % 2 === 0;
    const agentLabel = isPlanner ? "Planner Agent" : "Grand Meridian Ballroom";
    const step = turnCount + 1;

    sendEvent({
      type: "status",
      step,
      total: MAX_TURNS,
      message: `${agentLabel} is responding...`,
    });

    try {
      let response;

      if (isPlanner) {
        // Build planner prompt — on first turn, just send RFP; after that, include venue's last message
        if (turnCount === 0) {
          plannerMessages.push({
            role: "user",
            content:
              "Begin the negotiation. Send your opening RFP to the venue catering agent with the couple's requirements.",
          });
        } else {
          // Feed the venue's last response to the planner
          const lastVenueMsg = venueMessages[venueMessages.length - 1];
          plannerMessages.push({
            role: "user",
            content: `The venue agent responded:\n${JSON.stringify(lastVenueMsg, null, 2)}\n\nRespond to their message. Remember: your budget ceiling is $${formData.budget.toLocaleString()}. This is turn ${step} of ${MAX_TURNS}.${step >= MAX_TURNS - 1 ? " You MUST accept or reject on this turn — no more counter-offers." : ""}`,
          });
        }

        response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: plannerSystem,
          messages: plannerMessages,
        });
      } else {
        // Venue agent — feed the planner's last message
        const lastPlannerMsg = plannerMessages[plannerMessages.length - 1];
        const lastPlannerResponse = plannerMessages.length > 0
          ? log.messages[log.messages.length - 1]?.parsed
          : null;

        venueMessages.push({
          role: "user",
          content: `The planner agent sent:\n${JSON.stringify(lastPlannerResponse, null, 2)}\n\nRespond to their message. This is turn ${step} of ${MAX_TURNS}.${step >= MAX_TURNS - 1 ? " You MUST accept or reject on this turn — no more counter-offers." : ""}`,
        });

        response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 1024,
          system: venueSystem,
          messages: venueMessages,
        });
      }

      // Extract text and token counts
      const text = response.content[0].text;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cost =
        (inputTokens / 1_000_000) * INPUT_COST_PER_M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;

      log.total_input_tokens += inputTokens;
      log.total_output_tokens += outputTokens;
      log.total_cost_usd += cost;

      // Parse the structured response
      let parsed;
      try {
        parsed = parseAgentResponse(text);
      } catch (parseErr) {
        // If parsing fails, wrap raw text
        parsed = {
          from: isPlanner ? "planner_agent" : "venue_catering_agent",
          to: isPlanner ? "venue_catering_agent" : "planner_agent",
          message_type: "counter_offer",
          content: text,
          proposed_terms: {},
        };
      }

      // Add assistant response to conversation history
      if (isPlanner) {
        plannerMessages.push({ role: "assistant", content: text });
      } else {
        venueMessages.push({ role: "assistant", content: text });
      }

      // Log it
      const logEntry = {
        turn: step,
        agent: isPlanner ? "planner_agent" : "venue_catering_agent",
        timestamp: new Date().toISOString(),
        parsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: Math.round(cost * 1_000_000) / 1_000_000,
      };
      log.messages.push(logEntry);

      // Determine label for the UI
      let label = "Negotiation";
      const mt = parsed.message_type;
      if (mt === "rfp") label = "RFP Submitted";
      else if (mt === "offer") label = "Initial Proposal";
      else if (mt === "counter_offer")
        label = `Counter-Offer (Turn ${step})`;
      else if (mt === "accept") label = "Terms Accepted";
      else if (mt === "reject") label = "Terms Rejected";

      // Send to frontend
      sendEvent({
        type: "message",
        step,
        total: MAX_TURNS,
        from: isPlanner ? "couple" : "caterer",
        label,
        summary: parsed.content || "Agent responded.",
        data: parsed,
      });

      // Check for resolution
      if (mt === "accept" || mt === "reject") {
        resolved = true;
      }

      turnCount++;
    } catch (err) {
      sendEvent({
        type: "error",
        step: turnCount + 1,
        message: `API error: ${err.message}`,
      });
      log.error = err.message;
      break;
    }
  }

  // Force resolution if we hit max turns without one
  if (!resolved) {
    sendEvent({
      type: "message",
      step: turnCount + 1,
      total: MAX_TURNS,
      from: "couple",
      label: "Auto-Accept (Max Turns)",
      summary:
        "Maximum negotiation rounds reached. The Planner Agent accepts the last proposed terms to move forward.",
      data: {
        from: "planner_agent",
        to: "venue_catering_agent",
        message_type: "accept",
        content:
          "Maximum negotiation rounds reached. Accepting the last proposed terms.",
        proposed_terms:
          log.messages[log.messages.length - 1]?.parsed?.proposed_terms || {},
      },
    });
  }

  // Finalize log
  log.ended_at = new Date().toISOString();
  log.total_cost_usd = Math.round(log.total_cost_usd * 1_000_000) / 1_000_000;
  log.resolved = resolved;
  log.total_turns = turnCount;

  // Write log file
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logsDir, `negotiation_${ts}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  // Find the last message that has actual pricing terms (not null)
  let finalTerms = {};
  let outcome = "unknown";
  for (let i = log.messages.length - 1; i >= 0; i--) {
    const msg = log.messages[i];
    if (msg.parsed?.message_type === "accept") outcome = "accepted";
    if (msg.parsed?.message_type === "reject") outcome = "rejected";
    if (msg.parsed?.proposed_terms?.price_per_head && !finalTerms.price_per_head) {
      finalTerms = msg.parsed.proposed_terms;
    }
    if (finalTerms.price_per_head && outcome !== "unknown") break;
  }

  // Send done event with summary
  sendEvent({
    type: "done",
    outcome,
    summary: {
      resolved,
      outcome,
      total_turns: turnCount,
      total_cost_usd: log.total_cost_usd,
      total_tokens: log.total_input_tokens + log.total_output_tokens,
      final_terms: finalTerms,
      log_file: logPath,
    },
  });
}

module.exports = { runLiveNegotiation };
