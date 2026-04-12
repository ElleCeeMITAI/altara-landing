require("dotenv").config();
const express = require("express");
const path = require("path");
const { runSimulation, CatererAgent, CONFIG } = require("./agents");
const { runLiveNegotiation } = require("./negotiate");
const { runFullWeddingNegotiation } = require("./negotiate-multi");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, "public")));

// GET /simulate — serve the simulation UI
app.get("/simulate", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "simulate.html"));
});

// POST /api/simulate — run the full A2A wedding agent simulation
app.post("/api/simulate", (req, res) => {
  try {
    const {
      budget = 15000,
      guestCount = 120,
      serviceStyle = "plated",
      cuisinePreference = "",
      dietaryNeeds = [],
      addOns = [],
    } = req.body;

    // Validate inputs
    if (typeof budget !== "number" || budget <= 0) {
      return res.status(400).json({ error: "budget must be a positive number" });
    }
    if (typeof guestCount !== "number" || guestCount <= 0) {
      return res.status(400).json({ error: "guestCount must be a positive number" });
    }

    // Normalize serviceStyle to lowercase with underscores (e.g. "Family Style" → "family_style")
    const normalizedStyle = serviceStyle
      .toLowerCase()
      .replace(/\s+/g, "_");

    // Normalize dietary needs to lowercase with underscores (e.g. "Gluten Free" → "gluten_free")
    const normalizedDietary = dietaryNeeds.map(d =>
      d.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
    );

    const steps = runSimulation({
      budget,
      guestCount,
      serviceStyle: normalizedStyle,
      cuisinePreference,
      dietaryNeeds: normalizedDietary,
      addOns,
    });

    res.json({
      simulation: {
        event_date: "2027-06-12",
        region: "Greater Boston",
        preferences: { budget, guestCount, serviceStyle, cuisinePreference, dietaryNeeds, addOns },
      },
      steps,
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: "Simulation failed", details: err.message });
  }
});

// ============================================================================
// A2A PROTOCOL ENDPOINTS — for classmates' couple agents
// ============================================================================

// GET /.well-known/agent.json — A2A Agent Card (discovery)
app.get("/.well-known/agent.json", (req, res) => {
  const card = {
    ...CONFIG.AGENT_CARD,
    url: `${req.protocol}://${req.get("host")}`,
    endpoints: {
      agent_message: `${req.protocol}://${req.get("host")}/api/agent`,
      simulate: `${req.protocol}://${req.get("host")}/api/simulate`,
      skills_doc: `${req.protocol}://${req.get("host")}/skills.md`,
    },
  };
  res.json(card);
});

// GET /skills.md — serve skills documentation
app.get("/skills.md", (req, res) => {
  res.sendFile(path.join(__dirname, "skills.md"));
});

// POST /api/agent — A2A message handler (stateless per-request)
// Each request creates a fresh agent instance. For multi-turn negotiation,
// the caller must include context (e.g. quote_id) from previous responses.
app.post("/api/agent", (req, res) => {
  try {
    const { intent, params = {}, context = {} } = req.body;

    if (!intent) {
      return res.status(400).json({
        error: "Missing 'intent' field",
        supported_intents: [
          "discover",
          "check_availability",
          "get_menus",
          "accommodate_dietary",
          "rfp",
          "negotiate",
          "hold_date",
          "confirm_booking",
        ],
        example: {
          intent: "discover",
          params: {},
        },
      });
    }

    const agent = new CatererAgent();

    // If there's a quote_id from a previous RFP, restore it into the agent's state
    // so negotiation can reference it
    if (context.quote_id && context.quote_snapshot) {
      agent.activeQuotes[context.quote_id] = context.quote_snapshot;
      agent.negotiationState[context.quote_id] = context.negotiation_round || 0;
    }

    const response = agent.handleMessage({ intent, params, context });

    // Include state hints so the caller can continue multi-turn conversations
    const stateHints = {};
    if (response.data?.quote?.quote_id) {
      stateHints.quote_id = response.data.quote.quote_id;
      stateHints.quote_snapshot = agent.activeQuotes[response.data.quote.quote_id];
      stateHints.negotiation_round = 0;
    }
    if (context.quote_id) {
      stateHints.quote_id = context.quote_id;
      stateHints.negotiation_round = agent.negotiationState[context.quote_id] || 0;
      stateHints.quote_snapshot = agent.activeQuotes[context.quote_id];
    }

    res.json({
      ...response,
      _state: Object.keys(stateHints).length > 0 ? stateHints : undefined,
    });
  } catch (err) {
    console.error("Agent message error:", err);
    res.status(500).json({ error: "Agent error", details: err.message });
  }
});

// GET /api/simulate-live — SSE endpoint for real Claude-powered negotiation
app.get("/api/simulate-live", async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const formData = {
    budget: parseInt(req.query.budget, 10) || 10000,
    flexBudget: parseInt(req.query.flexBudget, 10) || 0,
    guestCount: parseInt(req.query.guestCount, 10) || 120,
    serviceStyle: (req.query.serviceStyle || "Plated").replace(/_/g, " "),
    cuisinePreference: req.query.cuisinePreference || "",
    dietaryNeeds: req.query.dietaryNeeds
      ? req.query.dietaryNeeds.split(",").filter(Boolean)
      : [],
    // Fallback preferences
    minGuestCount: parseInt(req.query.minGuestCount, 10) || 0,
    dateFlexibility: req.query.dateFlexibility || "fixed",
    altStyles: req.query.altStyles
      ? req.query.altStyles.split(",").filter(Boolean)
      : [],
    altVenues: req.query.altVenues
      ? req.query.altVenues.split(",").filter(Boolean)
      : [],
  };

  // Validate guest count against venue capacity
  if (formData.guestCount > 200) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: "Grand Meridian Ballroom has a maximum capacity of 200 guests." })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await runLiveNegotiation(formData, sendEvent);
  } catch (err) {
    sendEvent({ type: "error", message: err.message });
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

// GET /api/simulate-multi — SSE endpoint for multi-category negotiation
app.get("/api/simulate-multi", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const formData = {
    budget: (function() {
      var g = Math.min(75, Math.max(20, parseInt(req.query.guestCount, 10) || 50));
      var floors = { 20: 20000, 30: 25000, 40: 30000, 50: 35000, 60: 40000, 75: 50000 };
      var floor = g <= 20 ? 20000 : g <= 30 ? 25000 : g <= 40 ? 30000 : g <= 50 ? 35000 : g <= 60 ? 40000 : 50000;
      return Math.min(100000, Math.max(floor, parseInt(req.query.budget, 10) || 50000));
    })(),
    flexBudget: parseInt(req.query.flexBudget, 10) || 0,
    guestCount: Math.min(75, Math.max(20, parseInt(req.query.guestCount, 10) || 50)),
    serviceStyle: (req.query.serviceStyle || "Plated").replace(/_/g, " "),
    cuisinePreference: req.query.cuisinePreference || "",
    dietaryNeeds: req.query.dietaryNeeds ? req.query.dietaryNeeds.split(",").filter(Boolean) : [],
    weddingDate: req.query.weddingDate || "2027-06-12",
    location: req.query.location || "",
    style: req.query.style || "classic",
    entertainmentType: req.query.entertainmentType || "dj",
    genrePreferences: req.query.genrePreferences ? req.query.genrePreferences.split(",").filter(Boolean) : [],
    floralScope: req.query.floralScope || "full",
    transportScope: req.query.transportScope || "couple_only",
  };

  function sendEvent(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const result = await runFullWeddingNegotiation(formData, {
      model: "claude-sonnet-4-20250514",
      sendEvent,
      vendorsPerCategory: 2,
    });
    sendEvent({ type: "complete", result });
  } catch (err) {
    sendEvent({ type: "error", message: err.message });
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

// Catch-all: serve index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Altara landing page running on port ${PORT}`);
});
