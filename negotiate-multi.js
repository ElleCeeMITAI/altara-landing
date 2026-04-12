/**
 * negotiate-multi.js — Multi-vendor A2A negotiation engine (v2)
 *
 * Architecture:
 *   PlannerState → preScreenVendors → negotiateCategory (per category in order)
 *   → assemblePackages (Budget / Recommended / Premium) → presentToCouple
 *
 * The Planner agent maintains state across categories:
 *   - Running budget spent / remaining
 *   - Held offers with expiration dates
 *   - Venue location (anchor for service area filtering)
 *   - Skipped categories
 *   - Couple preferences (floral scope, DJ genre, etc.)
 */

const dotenv = require("dotenv");
const envResult = dotenv.config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const apiKey = envResult.parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("❌ ANTHROPIC_API_KEY not found in .env or environment");
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey });

// Models — Haiku for testing (~10x cheaper), switch to Sonnet for investor demos
const MODEL_LIVE = "claude-haiku-3-5-20241022";
const MODEL_EXPERIMENT = "claude-haiku-3-5-20241022";
// const MODEL_LIVE = "claude-sonnet-4-20250514";       // ← uncomment for investor demos
// const MODEL_EXPERIMENT = "claude-sonnet-4-20250514";  // ← uncomment for investor demos

// Cost per million tokens
const COSTS = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku-latest": { input: 0.80, output: 4.0 },
};

const MAX_TURNS_PER_VENDOR = 6; // 3 rounds each side

// ── Category Negotiation Order ─────────────────────────────────────────
// Mirrors real wedding planner protocol: lock venue first, then build outward

const CATEGORY_ORDER = [
  "venue",
  "catering",
  "photographer",
  "bakery",
  "florist",
  "dj",
  "transport",
];

// Default budget allocation percentages (Planner adjusts dynamically)
const DEFAULT_BUDGET_ALLOCATION = {
  venue: 0.30,       // 30% — often bundled with catering
  catering: 0.18,    // 18% — or bundled with venue
  photographer: 0.12, // 12%
  bakery: 0.04,      // 4%
  florist: 0.10,     // 10%
  dj: 0.07,          // 7%
  transport: 0.04,   // 4%
  // ~85% allocated, 15% buffer for flex/overruns
};

// ── Registry & Config Loading ───────────────────────────────────────────

function loadRegistry() {
  const regPath = path.join(__dirname, "vendors", "registry.json");
  return JSON.parse(fs.readFileSync(regPath, "utf-8"));
}

function loadVendorConfig(filePath) {
  const fullPath = path.join(__dirname, filePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function loadPromptTemplate(category) {
  const tplPath = path.join(__dirname, "prompts", `${category}.txt`);
  return fs.readFileSync(tplPath, "utf-8");
}

// ── Planner State ──────────────────────────────────────────────────────
// Tracks running state across all category negotiations

class PlannerState {
  constructor(formData) {
    this.budget = formData.budget;
    this.flexBudget = formData.flexBudget || 0;
    this.maxBudget = this.budget + this.flexBudget;
    this.guestCount = formData.guestCount;
    this.weddingDate = formData.weddingDate || "2027-06-12";
    this.formData = formData;

    // Budget tracking
    this.spent = {};          // { category: amount }
    this.remaining = this.budget;
    this.allocations = {};    // { category: allocated_amount }

    // Held offers
    this.heldOffers = {};     // { category: { vendor_id, vendor_name, terms, hold_expires } }

    // Venue anchor (set after venue negotiation)
    this.venueLocation = null;
    this.venueId = null;
    this.venueCateringPolicy = null; // "in_house_only" | "in_house_preferred" | "outside_allowed" | "outside_only"

    // Skipped categories
    this.skippedCategories = new Set(formData.skippedCategories || []);

    // Couple preferences (used for filtering)
    this.preferences = {
      minRating: formData.minRating || 4.0,
      lgbtqFilter: formData.lgbtqFilter || false,
      ecoPreferred: formData.ecoPreferred || false,
      // DJ/Band
      entertainmentType: formData.entertainmentType || null, // "dj", "live_band", "hybrid", null=any
      genrePreferences: formData.genrePreferences || [],
      wantVocalist: formData.wantVocalist || false,
      // Florist
      floralScope: formData.floralScope || ["personal_flowers", "ceremony_decor", "reception_decor"],
      floralStyle: formData.floralStyle || null,
      hasPetInWedding: formData.hasPetInWedding || false,
      // Photographer
      wantVideography: formData.wantVideography || false,
      wantDrone: formData.wantDrone || false,
      // Transport
      transportScope: formData.transportScope || "couple_only", // "couple_only", "bridal_party", "full_fleet"
      preferEcoVehicle: formData.preferEcoVehicle || false,
    };

    // Initialize allocations
    this._initAllocations();

    // Results tracking
    this.allResults = [];     // all negotiation results across categories
    this.negotiationLog = []; // chronological log of events
  }

  _initAllocations() {
    const activeBudget = this.budget;
    const activeCategories = CATEGORY_ORDER.filter(c => !this.skippedCategories.has(c));

    // If venue has in-house catering, merge venue+catering allocation
    let totalAllocPct = 0;
    for (const cat of activeCategories) {
      totalAllocPct += DEFAULT_BUDGET_ALLOCATION[cat] || 0.05;
    }

    // Normalize allocations to sum to ~85% (keep 15% buffer)
    for (const cat of activeCategories) {
      const rawPct = DEFAULT_BUDGET_ALLOCATION[cat] || 0.05;
      this.allocations[cat] = Math.round(activeBudget * (rawPct / totalAllocPct) * 0.85);
    }
  }

  // Called after venue is locked — adjusts catering allocation if in-house
  lockVenue(venueResult, venueConfig) {
    this.venueId = venueConfig.id;
    this.venueLocation = venueConfig.location || venueConfig.base_location;
    this.venueCateringPolicy = venueConfig.catering_policy;

    const venuePrice = venueResult.final_terms?.total_price || 0;
    this.spent.venue = venuePrice;
    this.remaining = this.budget - venuePrice;
    this.heldOffers.venue = {
      vendor_id: venueConfig.id,
      vendor_name: venueConfig.name,
      terms: venueResult.final_terms,
      hold_expires: this._calcHoldExpiry(venueConfig.hold_days || 14),
    };

    // If venue is in-house-only catering, skip separate catering
    if (this.venueCateringPolicy === "in_house_only") {
      this.skippedCategories.add("catering");
      // Redistribute catering budget to other categories
      const cateringAlloc = this.allocations.catering || 0;
      delete this.allocations.catering;
      this._redistributeBudget(cateringAlloc);
    }

    // Recalculate remaining allocations based on actual venue spend
    const overUnder = this.allocations.venue - venuePrice;
    if (overUnder > 0) {
      // Under budget on venue — redistribute surplus
      this._redistributeBudget(overUnder);
    } else if (overUnder < 0) {
      // Over budget on venue — reduce other allocations proportionally
      this._reduceBudget(Math.abs(overUnder));
    }

    this.log(`Venue locked: ${venueConfig.name} at $${venuePrice}. Remaining budget: $${this.remaining}`);
  }

  // Record a completed category negotiation
  recordCategoryResult(category, result, vendorConfig) {
    const price = result.final_terms?.total_price || 0;
    this.spent[category] = price;
    this.remaining = this.budget - Object.values(this.spent).reduce((s, v) => s + v, 0);

    if (result.outcome === "accepted") {
      this.heldOffers[category] = {
        vendor_id: vendorConfig.id,
        vendor_name: vendorConfig.name,
        terms: result.final_terms,
        hold_expires: this._calcHoldExpiry(vendorConfig.hold_days || 14),
        rating: vendorConfig.ratings?.composite_score || vendorConfig.ratings?.external_average || null,
        venue_partnership: vendorConfig.venue_partnerships?.preferred_venues?.includes(this.venueId)
          ? "tried_and_true" : "independent",
        website: vendorConfig.website || null,
      };

      // Redistribute surplus/deficit
      const allocated = this.allocations[category] || 0;
      const diff = allocated - price;
      if (diff > 0) {
        this._redistributeBudget(diff);
      } else if (diff < 0) {
        this._reduceBudget(Math.abs(diff));
      }
    }

    this.log(`${category}: ${result.outcome} with ${vendorConfig.name} at $${price}. Remaining: $${this.remaining}`);
  }

  // Redistribute surplus budget to remaining categories
  _redistributeBudget(surplus) {
    const remaining = CATEGORY_ORDER.filter(c =>
      !this.skippedCategories.has(c) && !this.spent[c]
    );
    if (remaining.length === 0) return;
    const perCat = Math.round(surplus / remaining.length);
    for (const cat of remaining) {
      this.allocations[cat] = (this.allocations[cat] || 0) + perCat;
    }
  }

  // Reduce remaining category budgets proportionally
  _reduceBudget(deficit) {
    const remaining = CATEGORY_ORDER.filter(c =>
      !this.skippedCategories.has(c) && !this.spent[c]
    );
    if (remaining.length === 0) return;
    const totalRemaining = remaining.reduce((s, c) => s + (this.allocations[c] || 0), 0);
    if (totalRemaining === 0) return;
    for (const cat of remaining) {
      const share = (this.allocations[cat] || 0) / totalRemaining;
      this.allocations[cat] = Math.round((this.allocations[cat] || 0) - deficit * share);
    }
  }

  _calcHoldExpiry(holdDays) {
    const now = new Date();
    now.setDate(now.getDate() + holdDays);
    return now.toISOString().split("T")[0];
  }

  log(message) {
    this.negotiationLog.push({
      timestamp: new Date().toISOString(),
      message,
    });
  }

  // Get budget context string for planner prompts
  getBudgetContext() {
    const spentTotal = Object.values(this.spent).reduce((s, v) => s + v, 0);
    const lines = [`Total budget: $${this.budget.toLocaleString()}`];
    lines.push(`Spent so far: $${spentTotal.toLocaleString()}`);
    lines.push(`Remaining: $${this.remaining.toLocaleString()}`);
    if (this.flexBudget > 0) {
      lines.push(`Flex budget available: $${this.flexBudget.toLocaleString()}`);
    }
    lines.push("");
    lines.push("Category allocations:");
    for (const cat of CATEGORY_ORDER) {
      if (this.skippedCategories.has(cat)) {
        lines.push(`  - ${cat}: SKIPPED`);
      } else if (this.spent[cat] !== undefined) {
        lines.push(`  - ${cat}: $${this.spent[cat].toLocaleString()} (LOCKED — ${this.heldOffers[cat]?.vendor_name})`);
      } else {
        lines.push(`  - ${cat}: ~$${(this.allocations[cat] || 0).toLocaleString()} allocated`);
      }
    }
    return lines.join("\n");
  }

  // Get held offers summary
  getHeldOffersSummary() {
    const lines = [];
    for (const [cat, offer] of Object.entries(this.heldOffers)) {
      const partnerTag = offer.venue_partnership === "tried_and_true"
        ? " [Tried & True Venue Partner]"
        : offer.venue_partnership === "independent" && offer.rating >= 4.5
          ? " [Great Reviews]"
          : "";
      lines.push(`  - ${cat}: ${offer.vendor_name}${partnerTag} — $${offer.terms?.total_price || "TBD"} (hold expires ${offer.hold_expires})`);
    }
    return lines.length > 0 ? lines.join("\n") : "  No offers held yet.";
  }
}

// ── Pre-Screening ──────────────────────────────────────────────────────
// Filters vendors before negotiation based on couple preferences + logistics

function preScreenVendors(vendorConfigs, plannerState, category) {
  const prefs = plannerState.preferences;
  const weddingDate = new Date(plannerState.weddingDate);
  const today = new Date();
  const daysUntilWedding = Math.ceil((weddingDate - today) / (1000 * 60 * 60 * 24));

  let candidates = vendorConfigs.filter(config => {
    // 1. Lead time check — can they actually do it?
    if (config.lead_time_days && config.lead_time_days > daysUntilWedding) {
      plannerState.log(`FILTERED OUT: ${config.name} — needs ${config.lead_time_days} days lead time, only ${daysUntilWedding} available`);
      return false;
    }

    // 2. Minimum rating threshold
    const rating = config.ratings?.composite_score || config.ratings?.external_average || config.ratings?.average || 0;
    if (rating > 0 && rating < prefs.minRating) {
      plannerState.log(`FILTERED OUT: ${config.name} — rating ${rating} below minimum ${prefs.minRating}`);
      return false;
    }

    // 3. LGBTQ+ filter
    if (prefs.lgbtqFilter && config.lgbtq_welcoming === false) {
      plannerState.log(`FILTERED OUT: ${config.name} — not LGBTQ+ welcoming`);
      return false;
    }

    // 4. Service area check (requires venue to be locked)
    if (plannerState.venueLocation && config.service_area) {
      const maxMiles = config.service_area.max_service_miles || config.service_area.max_delivery_miles || config.max_delivery_miles;
      const willNotService = config.service_area.will_not_service_beyond_max || config.will_not_service_beyond_max;
      // Simplified distance check — in production, use geocoding API
      // For now, use region matching as proxy
      // TODO: Replace with actual distance calculation using geocoding
    }

    // 5. Venue catering policy check
    if (category === "catering") {
      if (config.venue_exclusive && config.venue_exclusive !== plannerState.venueId) {
        plannerState.log(`FILTERED OUT: ${config.name} — exclusive to venue ${config.venue_exclusive}, not our venue`);
        return false;
      }
    }

    // 6. DJ/Band filters
    if (category === "dj") {
      if (prefs.entertainmentType && config.entertainment_type !== prefs.entertainmentType) {
        // Allow hybrid to match either dj or live_band
        if (config.entertainment_type !== "hybrid") {
          plannerState.log(`FILTERED OUT: ${config.name} — type ${config.entertainment_type} doesn't match preference ${prefs.entertainmentType}`);
          return false;
        }
      }
      if (prefs.wantVocalist && !config.vocalist_available) {
        plannerState.log(`FILTERED OUT: ${config.name} — no vocalist available`);
        return false;
      }
      if (prefs.genrePreferences.length > 0) {
        const vendorGenres = [
          ...(config.genre_specialties || []),
          ...(config.will_play_genres || []),
          ...(config.genres || []),
        ].map(g => g.toLowerCase());
        const hasMatch = prefs.genrePreferences.some(g => vendorGenres.includes(g.toLowerCase()));
        if (!hasMatch) {
          plannerState.log(`FILTERED OUT: ${config.name} — no genre match for ${prefs.genrePreferences.join(", ")}`);
          return false;
        }
      }
    }

    // 7. Guest capacity check (DJ equipment)
    if (config.max_guests_supported && config.max_guests_supported < plannerState.guestCount) {
      plannerState.log(`FILTERED OUT: ${config.name} — max ${config.max_guests_supported} guests, need ${plannerState.guestCount}`);
      return false;
    }

    return true;
  });

  // Sort candidates: venue partners first, then by rating
  candidates.sort((a, b) => {
    // Venue partners first
    const aPartner = a.venue_partnerships?.preferred_venues?.includes(plannerState.venueId) ? 1 : 0;
    const bPartner = b.venue_partnerships?.preferred_venues?.includes(plannerState.venueId) ? 1 : 0;
    if (aPartner !== bPartner) return bPartner - aPartner;

    // Then by composite rating
    const aRating = a.ratings?.composite_score || a.ratings?.external_average || a.ratings?.average || 0;
    const bRating = b.ratings?.composite_score || b.ratings?.external_average || b.ratings?.average || 0;
    return bRating - aRating;
  });

  plannerState.log(`Pre-screening for ${category}: ${vendorConfigs.length} vendors → ${candidates.length} candidates`);
  return candidates;
}

// ── Template Rendering ──────────────────────────────────────────────────

function renderTemplate(template, config) {
  let result = template;

  // Simple {{key}} replacements
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (config[key] !== undefined) {
      if (Array.isArray(config[key])) return config[key].join(", ");
      if (typeof config[key] === "object") return JSON.stringify(config[key], null, 2);
      return String(config[key]);
    }
    return match;
  });

  // Nested {{a.b}} replacements
  result = result.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, a, b) => {
    if (config[a] && config[a][b] !== undefined) {
      const val = config[a][b];
      if (Array.isArray(val)) return val.join(", ");
      if (typeof val === "object") return JSON.stringify(val, null, 2);
      return String(val);
    }
    return match;
  });

  // Deeper {{a.b.c}} replacements
  result = result.replace(/\{\{(\w+)\.(\w+)\.(\w+)\}\}/g, (match, a, b, c) => {
    if (config[a] && config[a][b] && config[a][b][c] !== undefined) {
      const val = config[a][b][c];
      if (Array.isArray(val)) return val.join(", ");
      if (typeof val === "object") return JSON.stringify(val, null, 2);
      return String(val);
    }
    return match;
  });

  // Computed fields
  if (config.peak_surcharge !== undefined) {
    result = result.replace("{{peak_surcharge_pct}}", String(Math.round(config.peak_surcharge * 100)));
  }
  if (config.max_discount_peak !== undefined) {
    result = result.replace("{{max_discount_peak_pct}}", String(Math.round(config.max_discount_peak * 100)));
  }
  if (config.max_discount_offpeak !== undefined) {
    result = result.replace("{{max_discount_offpeak_pct}}", String(Math.round(config.max_discount_offpeak * 100)));
  }

  // Negotiation style fields
  if (config.negotiation_style?.discount_ceiling_pct !== undefined) {
    result = result.replace(/\{\{negotiation_style\.discount_ceiling_pct\}\}/g, String(config.negotiation_style.discount_ceiling_pct));
  }
  if (config.negotiation_style?.walkaway_below_per_head !== undefined) {
    result = result.replace(/\{\{negotiation_style\.walkaway_below_per_head\}\}/g, String(config.negotiation_style.walkaway_below_per_head));
  }

  // Catering: price_floor_per_head
  if (config.pricing?.price_floor_per_head !== undefined) {
    result = result.replace(/\{\{price_floor_per_head\}\}/g, String(config.pricing.price_floor_per_head));
  }

  // Field name aliases
  if (config.price_floor !== undefined) {
    result = result.replace(/\{\{min_order\}\}/g, String(config.price_floor));
    result = result.replace(/\{\{min_booking\}\}/g, String(config.price_floor));
    result = result.replace(/\{\{price_floor\}\}/g, String(config.price_floor));
  }
  if (config.negotiation_style?.discount_ceiling_pct !== undefined) {
    result = result.replace(/\{\{max_discount_pct\}\}/g, String(config.negotiation_style.discount_ceiling_pct));
  }
  if (result.includes("{{max_discount_pct}}")) {
    result = result.replace(/\{\{max_discount_pct\}\}/g, "10");
  }
  if (result.includes("{{seasonal_surcharge_pct}}")) {
    result = result.replace(/\{\{seasonal_surcharge_pct\}\}/g, "10");
  }
  if (result.includes("{{peak_months}}")) {
    result = result.replace(/\{\{peak_months\}\}/g, "May-October");
  }

  // Florist: styles and signature flowers
  if (config.specialties && result.includes("{{styles}}")) {
    result = result.replace("{{styles}}", config.specialties.join(", "));
  }
  if (config.preferred_flowers && result.includes("{{signature_flowers}}")) {
    result = result.replace("{{signature_flowers}}", config.preferred_flowers.join(", "));
  }

  // Transport: overtime_rate, travel_fee
  if (result.includes("{{overtime_rate}}")) {
    const rate = config.overtime_rate_per_hour || 75;
    result = result.replace(/\{\{overtime_rate\}\}/g, String(rate));
  }
  if (result.includes("{{travel_fee}}")) {
    const fee = config.service_area?.beyond_radius_fee
      ? `$${config.service_area.beyond_radius_fee} (beyond ${config.service_area.radius_miles} miles)`
      : "$100";
    result = result.replace(/\{\{travel_fee\}\}/g, fee);
  }

  // Package details — flatten for prompt
  if (config.packages) {
    const pkgLines = Object.entries(config.packages).map(([name, pkg]) => {
      if (typeof pkg === "object" && pkg.price !== undefined) {
        return `  - ${name}: $${pkg.price} (${pkg.hours || "N/A"} hrs) — includes: ${(pkg.includes || []).join(", ")}`;
      }
      if (typeof pkg === "object" && pkg.price_range) {
        return `  - ${name}: $${pkg.price_range.min}-$${pkg.price_range.max} — includes: ${(pkg.includes || []).join(", ")}`;
      }
      return `  - ${name}: ${JSON.stringify(pkg)}`;
    });
    result = result.replace("{{packages_detail}}", pkgLines.join("\n"));
  }

  // Florist: build packages_detail from pricing object when no packages
  if (config.pricing && !config.packages && result.includes("{{packages_detail}}")) {
    const pkgLines = Object.entries(config.pricing).map(([key, val]) => {
      if (typeof val === "object" && val.min !== undefined) {
        return `  - ${key.replace(/_/g, " ")}: $${val.min}-$${val.max}${val.note ? ` (${val.note})` : ""}`;
      }
      if (typeof val === "object" && val.flat_fee !== undefined) {
        return `  - ${key.replace(/_/g, " ")}: $${val.flat_fee} flat`;
      }
      return `  - ${key.replace(/_/g, " ")}: $${val}`;
    });
    result = result.replace("{{packages_detail}}", pkgLines.join("\n"));
  }

  // Transport: build packages_detail from vehicles
  if (config.vehicles && result.includes("{{packages_detail}}")) {
    const pkgLines = config.vehicles.map(v =>
      `  - ${v.type}: $${v.price_per_hour}/hr (min ${v.minimum_hours}hrs, seats ${v.capacity})`
    );
    result = result.replace("{{packages_detail}}", pkgLines.join("\n"));
  }

  // Fleet details for transport
  if (config.vehicles) {
    const fleetLines = config.vehicles.map(v =>
      `  - ${v.type}: $${v.price_per_hour}/hr (min ${v.minimum_hours}hrs, seats ${v.capacity}) — ${(v.features || []).join(", ")}`
    );
    result = result.replace("{{fleet}}", fleetLines.join("\n"));
  }

  return result;
}

// ── Build vendor system prompt from config + template ───────────────────

function buildVendorSystemPrompt(vendorConfig) {
  const template = loadPromptTemplate(vendorConfig.category);
  return renderTemplate(template, vendorConfig);
}

// ── Budget-Aware Planner Prompt ────────────────────────────────────────
// Evolves as categories are negotiated — includes running budget context

function buildPlannerPrompt(plannerState, vendorConfig, candidateVendors) {
  const fd = plannerState.formData;
  const dateFlexMap = {
    fixed: `Date is FIXED — ${plannerState.weddingDate} only.`,
    week: `Flexible within 1 week of ${plannerState.weddingDate}.`,
    month: `Flexible on any Saturday in the same month.`,
    season: "Flexible on any date May-October 2027.",
    offpeak: "Will consider off-peak dates (Jan-Mar, Nov-Dec 2027) for significant savings.",
  };
  const dateFlex = dateFlexMap[fd.dateFlexibility] || dateFlexMap.fixed;

  const altStylesNote = fd.altStyles?.length > 0
    ? `Acceptable alternate food styles: ${fd.altStyles.join(", ")}.`
    : "Only the preferred service style is acceptable.";

  const guestFlexNote = fd.minGuestCount && fd.minGuestCount < fd.guestCount
    ? `Can reduce guest list to ${fd.minGuestCount} if needed.`
    : "Guest count is firm.";

  // Vendor relationship context
  const isVenuePartner = vendorConfig.venue_partnerships?.preferred_venues?.includes(plannerState.venueId);
  const partnerContext = isVenuePartner
    ? `\n⭐ ${vendorConfig.name} is a TRIED & TRUE VENUE PARTNER at your selected venue. They know the space, the staff, and the logistics. This is a significant advantage.`
    : vendorConfig.ratings?.composite_score >= 4.5 || vendorConfig.ratings?.external_average >= 4.5
      ? `\n🆕 ${vendorConfig.name} has GREAT REVIEWS (${vendorConfig.ratings?.composite_score || vendorConfig.ratings?.external_average} stars) but hasn't worked at your venue before.`
      : "";

  // Category-specific couple preferences
  let categoryPrefs = "";
  const prefs = plannerState.preferences;
  if (vendorConfig.category === "dj") {
    categoryPrefs = `
## Music Preferences
- Entertainment type wanted: ${prefs.entertainmentType || "any (DJ or live)"}
- Genre preferences: ${prefs.genrePreferences.length > 0 ? prefs.genrePreferences.join(", ") : "Open to suggestions"}
- Vocalist wanted: ${prefs.wantVocalist ? "Yes" : "Not required"}`;
  } else if (vendorConfig.category === "florist") {
    categoryPrefs = `
## Floral Preferences
- Scope: ${Array.isArray(prefs.floralScope) ? prefs.floralScope.join(", ") : prefs.floralScope}
- Style preference: ${prefs.floralStyle || "Open to suggestions"}
- Pet in wedding: ${prefs.hasPetInWedding ? "Yes — needs pet floral collar" : "No"}
- Eco-friendly preferred: ${prefs.ecoPreferred ? "Yes" : "Not required"}`;
  } else if (vendorConfig.category === "photographer") {
    categoryPrefs = `
## Photography Preferences
- Videography add-on: ${prefs.wantVideography ? "Yes — need video" : "Photo only"}
- Drone footage: ${prefs.wantDrone ? "Yes — want aerial shots" : "Not needed"}`;
  } else if (vendorConfig.category === "transport") {
    categoryPrefs = `
## Transport Preferences
- Scope: ${prefs.transportScope}
- Eco-friendly vehicle preferred: ${prefs.preferEcoVehicle ? "Yes" : "Not required"}`;
  } else if (vendorConfig.category === "bakery") {
    const dietary = fd.dietaryNeeds?.length > 0 ? fd.dietaryNeeds.join(", ") : "None";
    categoryPrefs = `
## Bakery Preferences
- Dietary needs: ${dietary}`;
  }

  // How many vendors we're comparing
  const competitionNote = candidateVendors && candidateVendors.length > 1
    ? `\nYou are comparing ${candidateVendors.length} vendors for ${vendorConfig.category}. Negotiate the best deal, but value quality and venue compatibility alongside price.`
    : "";

  return `You are the Planner Agent negotiating on behalf of a couple for their wedding. You are currently negotiating the ${vendorConfig.category.toUpperCase()} category with ${vendorConfig.name}.

## Couple's Requirements
- Total budget: $${fd.budget.toLocaleString()}
- Guest count: ${fd.guestCount}
- Preferred date: ${plannerState.weddingDate}
- Service style: ${fd.serviceStyle || "elegant"}
- Cuisine: ${fd.cuisinePreference || "No preference"}
- Dietary needs: ${fd.dietaryNeeds?.length > 0 ? fd.dietaryNeeds.join(", ") : "None"}

## Date Flexibility
${dateFlex}
${altStylesNote}
${guestFlexNote}

## Current Budget Status
${plannerState.getBudgetContext()}

## Budget for This Category
Target: ~$${(plannerState.allocations[vendorConfig.category] || 0).toLocaleString()}
Hard ceiling: $${Math.round((plannerState.allocations[vendorConfig.category] || 0) * 1.3).toLocaleString()} (use flex budget only if deal is exceptional)

## Already Locked Vendors
${plannerState.getHeldOffersSummary()}
${partnerContext}
${categoryPrefs}
${competitionNote}

## Strategy
1. Send an RFP with the couple's requirements and your target budget for this category
2. Negotiate the best price — use date flexibility, style alternatives, and guest count adjustments before touching flex budget
3. Consider venue partnership value (tried & true vendors reduce risk)
4. If the vendor's best price exceeds your ceiling, reject politely
5. When accepting, confirm hold period and next steps

## Response Format
You MUST respond with ONLY valid JSON:
{
  "from": "planner_agent",
  "to": "${vendorConfig.id}",
  "message_type": "rfp" | "counter_offer" | "accept" | "reject",
  "content": "Natural language summary (2-3 sentences)",
  "proposed_terms": {
    "total_price": <number or null>,
    "package": "<package name if applicable>",
    "date": "${plannerState.weddingDate}",
    "guest_count": ${fd.guestCount},
    "notes": "any specific terms or requests"
  }
}

IMPORTANT: Output ONLY the JSON object. No markdown, no code fences.`;
}

// ── Parse JSON response ─────────────────────────────────────────────────

function parseAgentResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

// ── Single vendor negotiation ─────────────────────────────────────────

async function negotiateWithVendor(formData, vendorConfig, model, sendEvent, startStep, plannerState = null, candidateVendors = null) {
  const vendorPrompt = buildVendorSystemPrompt(vendorConfig);

  // Use budget-aware planner prompt if state is available, otherwise legacy
  const plannerPrompt = plannerState
    ? buildPlannerPrompt(plannerState, vendorConfig, candidateVendors)
    : _legacyPlannerPrompt(formData, vendorConfig);

  const costRate = COSTS[model] || COSTS[MODEL_EXPERIMENT];
  const plannerMessages = [];
  const vendorMessages = [];
  const messages = [];

  let turnCount = 0;
  let resolved = false;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  while (turnCount < MAX_TURNS_PER_VENDOR && !resolved) {
    const isPlanner = turnCount % 2 === 0;
    const step = startStep + turnCount;

    if (sendEvent) {
      sendEvent({
        type: "status",
        vendor_id: vendorConfig.id,
        vendor_name: vendorConfig.name,
        step,
        message: `${isPlanner ? "Planner" : vendorConfig.name} is responding...`,
      });
    }

    try {
      let response;

      if (isPlanner) {
        if (turnCount === 0) {
          const budgetHint = plannerState
            ? ` Your target budget for ${vendorConfig.category} is ~$${(plannerState.allocations[vendorConfig.category] || 0).toLocaleString()}.`
            : "";
          plannerMessages.push({
            role: "user",
            content: `Send your opening RFP to ${vendorConfig.name} (${vendorConfig.category}). Request pricing for ${formData.guestCount} guests, ${formData.serviceStyle || "elegant"} style, for ${plannerState?.weddingDate || "June 12, 2027"}.${budgetHint}`,
          });
        } else {
          const lastVendorParsed = messages[messages.length - 1]?.parsed;
          plannerMessages.push({
            role: "user",
            content: `${vendorConfig.name} responded:\n${JSON.stringify(lastVendorParsed, null, 2)}\n\nRespond. Turn ${turnCount + 1} of ${MAX_TURNS_PER_VENDOR}.${turnCount >= MAX_TURNS_PER_VENDOR - 2 ? " You MUST accept or reject now." : ""}`,
          });
        }

        response = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: plannerPrompt,
          messages: plannerMessages,
        });
      } else {
        const lastPlannerParsed = messages[messages.length - 1]?.parsed;
        vendorMessages.push({
          role: "user",
          content: `The planner agent sent:\n${JSON.stringify(lastPlannerParsed, null, 2)}\n\nRespond. Turn ${turnCount + 1} of ${MAX_TURNS_PER_VENDOR}.${turnCount >= MAX_TURNS_PER_VENDOR - 2 ? " You MUST accept or reject now." : ""}`,
        });

        response = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: vendorPrompt,
          messages: vendorMessages,
        });
      }

      const text = response.content[0].text;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cost = (inputTokens / 1e6) * costRate.input + (outputTokens / 1e6) * costRate.output;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCost += cost;

      let parsed;
      try {
        parsed = parseAgentResponse(text);
      } catch {
        parsed = {
          from: isPlanner ? "planner_agent" : vendorConfig.id,
          to: isPlanner ? vendorConfig.id : "planner_agent",
          message_type: "counter_offer",
          content: text,
          proposed_terms: {},
        };
      }

      if (isPlanner) {
        plannerMessages.push({ role: "assistant", content: text });
      } else {
        vendorMessages.push({ role: "assistant", content: text });
      }

      const entry = {
        turn: turnCount + 1,
        agent: isPlanner ? "planner_agent" : vendorConfig.id,
        vendor_id: vendorConfig.id,
        vendor_name: vendorConfig.name,
        category: vendorConfig.category,
        timestamp: new Date().toISOString(),
        parsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: Math.round(cost * 1e6) / 1e6,
      };
      messages.push(entry);

      // Send SSE event if available
      if (sendEvent) {
        const mt = parsed.message_type;
        let label = "Negotiation";
        if (mt === "rfp") label = "RFP";
        else if (mt === "offer") label = "Proposal";
        else if (mt === "counter_offer") label = "Counter-Offer";
        else if (mt === "accept") label = "Accepted";
        else if (mt === "reject") label = "Rejected";

        sendEvent({
          type: "message",
          vendor_id: vendorConfig.id,
          vendor_name: vendorConfig.name,
          category: vendorConfig.category,
          step,
          from: isPlanner ? "couple" : "vendor",
          label: `[${vendorConfig.name}] ${label}`,
          summary: parsed.content || "Agent responded.",
          data: parsed,
        });
      }

      if (parsed.message_type === "accept" || parsed.message_type === "reject") {
        resolved = true;
      }

      turnCount++;
    } catch (err) {
      if (sendEvent) {
        sendEvent({
          type: "error",
          vendor_id: vendorConfig.id,
          message: `API error with ${vendorConfig.name}: ${err.message}`,
        });
      }
      break;
    }
  }

  // Extract final terms
  let finalTerms = {};
  let outcome = "unknown";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.parsed?.message_type === "accept" && outcome === "unknown") outcome = "accepted";
    if (msg.parsed?.message_type === "reject" && outcome === "unknown") outcome = "rejected";
    if (msg.parsed?.proposed_terms?.total_price && !finalTerms.total_price) {
      finalTerms = msg.parsed.proposed_terms;
    }
    if (finalTerms.total_price && outcome !== "unknown") break;
  }

  return {
    vendor_id: vendorConfig.id,
    vendor_name: vendorConfig.name,
    category: vendorConfig.category,
    outcome,
    final_terms: finalTerms,
    turns: turnCount,
    messages,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
  };
}

// Legacy planner prompt (backward compat for experiments)
function _legacyPlannerPrompt(formData, vendorConfig) {
  const dateFlexMap = {
    fixed: "Date is FIXED — June 12, 2027 only.",
    week: "Flexible within 1 week of June 12 (June 5-19, 2027).",
    month: "Flexible on any Saturday in June 2027.",
    season: "Flexible on any date May-October 2027.",
    offpeak: "Will consider off-peak dates (Jan-Mar, Nov-Dec 2027) for significant savings.",
  };
  const dateFlex = dateFlexMap[formData.dateFlexibility] || dateFlexMap.fixed;

  return `You are the Planner Agent negotiating a wedding on behalf of a couple with ${vendorConfig.name} (${vendorConfig.category}).

## Couple's Requirements
- Total budget: $${formData.budget.toLocaleString()}
- Guest count: ${formData.guestCount}
- Preferred date: June 12, 2027
- Service style: ${formData.serviceStyle}
- Date flexibility: ${dateFlex}

## Response Format
You MUST respond with ONLY valid JSON:
{
  "from": "planner_agent",
  "to": "${vendorConfig.id}",
  "message_type": "rfp" | "counter_offer" | "accept" | "reject",
  "content": "Natural language summary (2-3 sentences)",
  "proposed_terms": {
    "total_price": <number or null>,
    "date": "2027-06-12",
    "guest_count": ${formData.guestCount},
    "notes": "any terms"
  }
}

IMPORTANT: Output ONLY the JSON object. No markdown, no code fences.`;
}

// ── 3-Package Assembly ─────────────────────────────────────────────────
// Assembles Budget / Recommended / Premium packages from negotiation results

function assemblePackages(plannerState) {
  // Group all accepted results by category
  const resultsByCategory = {};
  for (const result of plannerState.allResults) {
    if (!resultsByCategory[result.category]) {
      resultsByCategory[result.category] = [];
    }
    resultsByCategory[result.category].push(result);
  }

  // For each category, sort by price (ascending)
  for (const cat of Object.keys(resultsByCategory)) {
    resultsByCategory[cat].sort((a, b) =>
      (a.final_terms?.total_price || Infinity) - (b.final_terms?.total_price || Infinity)
    );
  }

  const packages = {
    budget: { name: "Budget Package", vendors: {}, total: 0, notes: [] },
    recommended: { name: "Recommended Package", vendors: {}, total: 0, notes: [] },
    premium: { name: "Premium Package", vendors: {}, total: 0, notes: [] },
  };

  for (const cat of CATEGORY_ORDER) {
    if (plannerState.skippedCategories.has(cat)) continue;

    const results = (resultsByCategory[cat] || []).filter(r => r.outcome === "accepted");
    if (results.length === 0) {
      // No accepted offers for this category
      packages.budget.notes.push(`No vendor secured for ${cat}`);
      packages.recommended.notes.push(`No vendor secured for ${cat}`);
      packages.premium.notes.push(`No vendor secured for ${cat}`);
      continue;
    }

    // Budget: cheapest accepted offer
    const cheapest = results[0];
    packages.budget.vendors[cat] = _formatVendorForPackage(cheapest, plannerState);
    packages.budget.total += cheapest.final_terms?.total_price || 0;

    // Premium: most expensive (often highest rated / venue partner)
    const priciest = results[results.length - 1];
    packages.premium.vendors[cat] = _formatVendorForPackage(priciest, plannerState);
    packages.premium.total += priciest.final_terms?.total_price || 0;

    // Recommended: best value (venue partner > high rating > mid price)
    const recommended = _pickRecommended(results, plannerState);
    packages.recommended.vendors[cat] = _formatVendorForPackage(recommended, plannerState);
    packages.recommended.total += recommended.final_terms?.total_price || 0;
  }

  // Add hold expiration info
  for (const pkg of Object.values(packages)) {
    const holdDates = Object.values(pkg.vendors)
      .map(v => v.hold_expires)
      .filter(Boolean)
      .sort();
    pkg.earliest_hold_expiry = holdDates[0] || null;
    if (pkg.earliest_hold_expiry) {
      pkg.notes.push(`⚠️ Earliest hold expires: ${pkg.earliest_hold_expiry} — decision needed before then`);
    }
  }

  return packages;
}

function _formatVendorForPackage(result, plannerState) {
  const held = plannerState.heldOffers[result.category];
  return {
    vendor_id: result.vendor_id,
    vendor_name: result.vendor_name,
    category: result.category,
    price: result.final_terms?.total_price || 0,
    terms: result.final_terms,
    rating: held?.rating || null,
    venue_tag: held?.venue_partnership === "tried_and_true"
      ? "⭐ Tried & True Venue Partner"
      : held?.rating >= 4.5
        ? "🆕 Great Reviews"
        : null,
    website: held?.website || null,
    hold_expires: held?.hold_expires || null,
  };
}

function _pickRecommended(results, plannerState) {
  // Priority: venue partner with good rating > highest rated > median price
  const venuePartners = results.filter(r =>
    plannerState.heldOffers[r.category]?.venue_partnership === "tried_and_true"
  );
  if (venuePartners.length > 0) return venuePartners[0];

  // Highest rated
  const withRatings = results.filter(r => {
    const held = plannerState.heldOffers[r.category];
    return held?.rating != null;
  });
  if (withRatings.length > 0) {
    withRatings.sort((a, b) => {
      const aR = plannerState.heldOffers[a.category]?.rating || 0;
      const bR = plannerState.heldOffers[b.category]?.rating || 0;
      return bR - aR;
    });
    return withRatings[0];
  }

  // Middle option
  return results[Math.floor(results.length / 2)];
}

// ── Full Wedding Negotiation (Category-by-Category) ───────────────────

async function runFullWeddingNegotiation(formData, options = {}) {
  const {
    model = MODEL_EXPERIMENT,
    sendEvent = null,
    vendorsPerCategory = null, // limit for experiments (e.g., negotiate with top 3 per category)
  } = options;

  const registry = loadRegistry();
  const plannerState = new PlannerState(formData);
  const startTime = Date.now();
  let stepCounter = 1;

  if (sendEvent) {
    sendEvent({
      type: "start",
      message: `Starting full wedding negotiation across ${CATEGORY_ORDER.filter(c => !plannerState.skippedCategories.has(c)).length} categories...`,
    });
  }

  // Negotiate each category in order
  for (const category of CATEGORY_ORDER) {
    if (plannerState.skippedCategories.has(category)) {
      plannerState.log(`Skipping ${category} — couple indicated not needed`);
      if (sendEvent) {
        sendEvent({ type: "skip", category, message: `Skipping ${category}` });
      }
      continue;
    }

    const catVendors = registry.categories[category]?.vendors || [];
    if (catVendors.length === 0) {
      plannerState.log(`No vendors available for ${category}`);
      continue;
    }

    // Load all vendor configs for this category
    const vendorConfigs = catVendors.map(v => ({
      ...loadVendorConfig(v.file),
      _file: v.file,
    }));

    // Pre-screen vendors
    const candidates = preScreenVendors(vendorConfigs, plannerState, category);

    if (candidates.length === 0) {
      plannerState.log(`No vendors passed pre-screening for ${category}`);
      if (sendEvent) {
        sendEvent({ type: "no_candidates", category, message: `No ${category} vendors available (filtered out by lead time, rating, or service area)` });
      }
      // If no venue candidates at all, stop — can't proceed without a venue
      if (category === "venue") {
        plannerState.log("STOPPING: No venue candidates passed pre-screening. Cannot proceed even with flex budget — no venues match date, location, or capacity requirements.");
        if (sendEvent) {
          sendEvent({
            type: "venue_failed_abort",
            category: "venue",
            from: "couple",
            label: "Belle — Negotiation Paused",
            summary: "Belle couldn't find any venues that match your criteria (date, location, guest count). This isn't a budget issue — no venues in the area are available for your requirements. Please try adjusting your guest count, date, or location.",
            message: "Negotiation stopped — no venue candidates available.",
          });
        }
        break;
      }
      continue;
    }

    // Limit candidates if specified (for experiments)
    const toNegotiate = vendorsPerCategory
      ? candidates.slice(0, vendorsPerCategory)
      : candidates;

    if (sendEvent) {
      sendEvent({
        type: "category_start",
        category,
        message: `Negotiating ${category} with ${toNegotiate.length} vendor(s): ${toNegotiate.map(v => v.name).join(", ")}`,
        budget_allocated: plannerState.allocations[category],
      });
    }

    // Negotiate with each candidate
    const categoryResults = [];
    for (const vendorConfig of toNegotiate) {
      const result = await negotiateWithVendor(
        formData, vendorConfig, model, sendEvent, stepCounter,
        plannerState, toNegotiate
      );
      categoryResults.push(result);
      plannerState.allResults.push(result);
      stepCounter += result.turns;
    }

    // Pick the best accepted offer for this category
    const accepted = categoryResults.filter(r => r.outcome === "accepted");
    if (accepted.length > 0) {
      // For now, pick the one closest to allocation (best value)
      accepted.sort((a, b) => {
        const aPrice = a.final_terms?.total_price || Infinity;
        const bPrice = b.final_terms?.total_price || Infinity;
        const target = plannerState.allocations[category] || 0;
        return Math.abs(aPrice - target) - Math.abs(bPrice - target);
      });

      const best = accepted[0];
      const bestConfig = toNegotiate.find(v => v.id === best.vendor_id);

      // Special handling for venue
      if (category === "venue") {
        plannerState.lockVenue(best, bestConfig);
      } else {
        plannerState.recordCategoryResult(category, best, bestConfig);
      }

      if (sendEvent) {
        sendEvent({
          type: "category_locked",
          category,
          vendor_name: best.vendor_name,
          price: best.final_terms?.total_price,
          message: `Locked ${category}: ${best.vendor_name} at $${best.final_terms?.total_price}`,
        });
      }
    } else {
      plannerState.log(`No accepted offers for ${category} — all vendors rejected or failed`);
      if (sendEvent) {
        sendEvent({
          type: "category_failed",
          category,
          message: `Could not secure a ${category} vendor within budget`,
        });
      }

      // If venue failed, try again with flex budget before giving up
      if (category === "venue") {
        const venueAlloc = plannerState.allocations.venue || 0;
        const flexAvailable = plannerState.flexBudget || 0;

        if (flexAvailable > 0 && !plannerState._venueRetried) {
          // RETRY: Boost venue allocation with flex budget
          plannerState._venueRetried = true;
          const boostedAlloc = venueAlloc + flexAvailable;
          plannerState.allocations.venue = boostedAlloc;
          plannerState.log(`VENUE RETRY: Initial venue budget of $${venueAlloc.toLocaleString()} wasn't enough. Belle is using the $${flexAvailable.toLocaleString()} flex budget — new venue ceiling: $${boostedAlloc.toLocaleString()}`);

          if (sendEvent) {
            sendEvent({
              type: "venue_retry",
              category: "venue",
              from: "couple",
              label: "Belle — Using Flexibility Budget",
              summary: `Belle couldn't secure a venue within the initial $${venueAlloc.toLocaleString()} allocation. She's now tapping into your $${flexAvailable.toLocaleString()} flexibility budget — new venue ceiling: $${boostedAlloc.toLocaleString()}. Re-negotiating...`,
              message: `Retrying venue negotiation with boosted budget: $${boostedAlloc.toLocaleString()}`,
            });
          }

          // Re-negotiate with the same vendors at the higher ceiling
          const retryResults = [];
          for (const vendorConfig of toNegotiate) {
            const result = await negotiateWithVendor(
              formData, vendorConfig, model, sendEvent, stepCounter,
              plannerState, toNegotiate
            );
            retryResults.push(result);
            plannerState.allResults.push(result);
            stepCounter += result.turns;
          }

          const retryAccepted = retryResults.filter(r => r.outcome === "accepted");
          if (retryAccepted.length > 0) {
            retryAccepted.sort((a, b) => {
              const aPrice = a.final_terms?.total_price || Infinity;
              const bPrice = b.final_terms?.total_price || Infinity;
              const target = plannerState.allocations.venue || 0;
              return Math.abs(aPrice - target) - Math.abs(bPrice - target);
            });

            const best = retryAccepted[0];
            const bestConfig = toNegotiate.find(v => v.id === best.vendor_id);
            plannerState.lockVenue(best, bestConfig);

            if (sendEvent) {
              sendEvent({
                type: "category_locked",
                category: "venue",
                vendor_name: best.vendor_name,
                price: best.final_terms?.total_price,
                message: `Locked venue (with flex budget): ${best.vendor_name} at $${best.final_terms?.total_price}`,
              });
            }
            // Venue secured with flex — reduce flex budget by the overage
            const overage = (best.final_terms?.total_price || 0) - venueAlloc;
            if (overage > 0) {
              plannerState.flexBudget = Math.max(0, flexAvailable - overage);
              plannerState.log(`Flex budget used for venue overage: $${overage.toLocaleString()}. Remaining flex: $${plannerState.flexBudget.toLocaleString()}`);
            }
            continue; // Venue secured, move to next category
          }
        }

        // Venue truly failed — even with flex budget
        const finalAlloc = plannerState.allocations.venue || 0;
        plannerState.log("STOPPING: Cannot proceed without a venue — all other categories depend on venue location, capacity, and partnerships.");
        if (sendEvent) {
          sendEvent({
            type: "venue_failed_abort",
            category: "venue",
            from: "couple",
            label: "Belle — Negotiation Paused",
            summary: `Belle couldn't secure a venue even with your flexibility budget (ceiling was $${finalAlloc.toLocaleString()}). Without a venue, she can't negotiate catering, photography, or any other category — vendor availability, service areas, and partnerships all depend on the venue. Please consider increasing your total budget, adjusting your guest count, or choosing a different date for more availability.`,
            message: "Negotiation stopped — no venue secured. Belle needs a venue before she can continue.",
          });
        }
        break;
      }
    }
  }

  // Assemble 3 packages
  const packages = assemblePackages(plannerState);

  const elapsed = Date.now() - startTime;
  const totalCost = plannerState.allResults.reduce((s, r) => s + r.total_cost_usd, 0);
  const totalTokens = plannerState.allResults.reduce((s, r) => s + r.total_input_tokens + r.total_output_tokens, 0);

  const summary = {
    mode: "full_wedding",
    model,
    categories_negotiated: CATEGORY_ORDER.filter(c => !plannerState.skippedCategories.has(c)).length,
    categories_skipped: [...plannerState.skippedCategories],
    elapsed_ms: elapsed,
    elapsed_sec: Math.round(elapsed / 1000 * 10) / 10,
    budget: formData.budget,
    total_spent: Object.values(plannerState.spent).reduce((s, v) => s + v, 0),
    remaining: plannerState.remaining,
    within_budget: plannerState.remaining >= 0,
    packages: {
      budget: { total: packages.budget.total, vendors: Object.keys(packages.budget.vendors).length },
      recommended: { total: packages.recommended.total, vendors: Object.keys(packages.recommended.vendors).length },
      premium: { total: packages.premium.total, vendors: Object.keys(packages.premium.vendors).length },
    },
    total_api_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    total_tokens: totalTokens,
    negotiation_log: plannerState.negotiationLog,
  };

  // Save full log
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logsDir, `wedding_full_${ts}.json`);
  const fullLog = {
    summary,
    packages,
    form_data: formData,
    planner_state: {
      spent: plannerState.spent,
      allocations: plannerState.allocations,
      held_offers: plannerState.heldOffers,
      skipped: [...plannerState.skippedCategories],
    },
    vendor_results: plannerState.allResults,
  };
  fs.writeFileSync(logPath, JSON.stringify(fullLog, null, 2));

  if (sendEvent) {
    sendEvent({
      type: "done",
      summary,
      packages,
      log_file: logPath,
    });
  }

  return { summary, packages, results: plannerState.allResults, logPath };
}

// ── Legacy: Sequential multi-vendor negotiation (for experiments) ─────

async function runMultiNegotiation(formData, vendorIds, options = {}) {
  const {
    model = MODEL_EXPERIMENT,
    sendEvent = null,
    mode = "rfp",
    failureVendorId = null,
  } = options;

  const registry = loadRegistry();
  const allVendors = [];
  for (const cat of Object.values(registry.categories)) {
    allVendors.push(...cat.vendors);
  }

  const selectedVendors = vendorIds
    ? allVendors.filter(v => vendorIds.includes(v.id))
    : allVendors;

  const results = [];
  const startTime = Date.now();
  let stepCounter = 1;

  if (sendEvent) {
    sendEvent({
      type: "start",
      message: `Starting ${mode.toUpperCase()} negotiation with ${selectedVendors.length} vendors...`,
      vendor_count: selectedVendors.length,
    });
  }

  for (const vendorRef of selectedVendors) {
    const vendorConfig = loadVendorConfig(vendorRef.file);

    // Experiment 3: simulate vendor failure
    if (failureVendorId && vendorRef.id === failureVendorId) {
      const failResult = {
        vendor_id: vendorRef.id,
        vendor_name: vendorRef.name,
        category: vendorConfig.category,
        outcome: "failed",
        final_terms: {},
        turns: 0,
        messages: [],
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0,
        failure_reason: "simulated_vendor_unavailable",
      };
      results.push(failResult);

      if (sendEvent) {
        sendEvent({
          type: "failure",
          vendor_id: vendorRef.id,
          vendor_name: vendorRef.name,
          message: `${vendorRef.name} is unavailable! Finding backup...`,
        });
      }

      const backups = allVendors.filter(
        v => v.id !== vendorRef.id &&
          registry.categories[vendorConfig.category]?.vendors.some(cv => cv.id === v.id)
      );
      if (backups.length > 0) {
        const backup = backups[0];
        const backupConfig = loadVendorConfig(backup.file);

        if (sendEvent) {
          sendEvent({
            type: "recovery",
            vendor_id: backup.id,
            vendor_name: backup.name,
            message: `Switching to backup: ${backup.name}`,
          });
        }

        const backupResult = await negotiateWithVendor(formData, backupConfig, model, sendEvent, stepCounter);
        backupResult.is_backup = true;
        backupResult.replaced_vendor_id = vendorRef.id;
        results.push(backupResult);
        stepCounter += backupResult.turns;
      }
      continue;
    }

    // Auction mode
    if (mode === "auction" && results.length > 0) {
      const sameCategory = results.filter(r => r.category === vendorConfig.category && r.outcome === "accepted");
      if (sameCategory.length > 0) {
        const bestSoFar = sameCategory.reduce((best, r) =>
          (r.final_terms?.total_price || Infinity) < (best.final_terms?.total_price || Infinity) ? r : best
        );
        formData._auction_context = `Another ${vendorConfig.category} vendor has offered $${bestSoFar.final_terms.total_price}. Can you beat that price?`;
      }
    }

    const result = await negotiateWithVendor(formData, vendorConfig, model, sendEvent, stepCounter);
    results.push(result);
    stepCounter += result.turns;
  }

  const elapsed = Date.now() - startTime;
  const totalCost = results.reduce((s, r) => s + r.total_cost_usd, 0);
  const totalTokens = results.reduce((s, r) => s + r.total_input_tokens + r.total_output_tokens, 0);
  const accepted = results.filter(r => r.outcome === "accepted");
  const rejected = results.filter(r => r.outcome === "rejected");
  const failed = results.filter(r => r.outcome === "failed");
  const grandTotal = accepted.reduce((s, r) => s + (r.final_terms?.total_price || 0), 0);

  const summary = {
    mode,
    model,
    vendor_count: selectedVendors.length,
    elapsed_ms: elapsed,
    elapsed_sec: Math.round(elapsed / 1000 * 10) / 10,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    failed_count: failed.length,
    grand_total_wedding_cost: grandTotal,
    budget: formData.budget,
    flex_budget: formData.flexBudget,
    within_budget: grandTotal <= formData.budget,
    within_flex: grandTotal <= formData.budget + formData.flexBudget,
    total_api_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    total_tokens: totalTokens,
    results: results.map(r => ({
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      category: r.category,
      outcome: r.outcome,
      total_price: r.final_terms?.total_price || null,
      turns: r.turns,
      cost_usd: r.total_cost_usd,
      is_backup: r.is_backup || false,
    })),
  };

  // Save log
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logsDir, `multi_${mode}_${selectedVendors.length}v_${ts}.json`);
  fs.writeFileSync(logPath, JSON.stringify({ summary, form_data: formData, vendor_results: results }, null, 2));

  if (sendEvent) {
    sendEvent({ type: "done", summary, log_file: logPath });
  }

  return { summary, results, logPath };
}

// ── Parallel multi-vendor (for latency experiments) ─────────────────────

async function runMultiNegotiationParallel(formData, vendorIds, options = {}) {
  const {
    model = MODEL_EXPERIMENT,
    sendEvent = null,
    concurrency = 5,
  } = options;

  const registry = loadRegistry();
  const allVendors = [];
  for (const cat of Object.values(registry.categories)) {
    allVendors.push(...cat.vendors);
  }

  const selectedVendors = vendorIds
    ? allVendors.filter(v => vendorIds.includes(v.id))
    : allVendors;

  const startTime = Date.now();

  const results = [];
  for (let i = 0; i < selectedVendors.length; i += concurrency) {
    const batch = selectedVendors.slice(i, i + concurrency);
    const batchPromises = batch.map(vendorRef => {
      const vendorConfig = loadVendorConfig(vendorRef.file);
      return negotiateWithVendor(formData, vendorConfig, model, sendEvent, i + 1);
    });
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  const elapsed = Date.now() - startTime;
  const totalCost = results.reduce((s, r) => s + r.total_cost_usd, 0);
  const totalTokens = results.reduce((s, r) => s + r.total_input_tokens + r.total_output_tokens, 0);
  const accepted = results.filter(r => r.outcome === "accepted");
  const grandTotal = accepted.reduce((s, r) => s + (r.final_terms?.total_price || 0), 0);

  const summary = {
    mode: "parallel",
    model,
    vendor_count: selectedVendors.length,
    concurrency,
    elapsed_ms: elapsed,
    elapsed_sec: Math.round(elapsed / 1000 * 10) / 10,
    accepted_count: accepted.length,
    rejected_count: results.filter(r => r.outcome === "rejected").length,
    grand_total_wedding_cost: grandTotal,
    budget: formData.budget,
    within_budget: grandTotal <= formData.budget,
    total_api_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    total_tokens: totalTokens,
  };

  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(logsDir, `multi_parallel_${selectedVendors.length}v_${ts}.json`);
  fs.writeFileSync(logPath, JSON.stringify({ summary, form_data: formData, vendor_results: results }, null, 2));

  return { summary, results, logPath };
}

module.exports = {
  loadRegistry,
  loadVendorConfig,
  buildVendorSystemPrompt,
  negotiateWithVendor,
  runMultiNegotiation,
  runMultiNegotiationParallel,
  runFullWeddingNegotiation,
  assemblePackages,
  preScreenVendors,
  PlannerState,
  CATEGORY_ORDER,
  MODEL_LIVE,
  MODEL_EXPERIMENT,
};
