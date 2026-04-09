const express = require("express");
const path = require("path");
const { runSimulation } = require("./agents");

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

    const steps = runSimulation({
      budget,
      guestCount,
      serviceStyle,
      dietaryNeeds,
      addOns,
    });

    res.json({
      simulation: {
        event_date: "2027-06-14",
        region: "Greater Boston",
        preferences: { budget, guestCount, serviceStyle, dietaryNeeds, addOns },
      },
      steps,
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: "Simulation failed", details: err.message });
  }
});

// Catch-all: serve index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Altara landing page running on port ${PORT}`);
});
