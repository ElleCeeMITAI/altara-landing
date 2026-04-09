/**
 * Altara A2A Wedding Agent Simulation
 * ====================================
 * JavaScript port of the Bella Tavola Catering agent with full business logic
 * from config.py + all skills (pricing, negotiation, availability, menus,
 * dietary, booking). Also includes a CoupleAgent (planner) that orchestrates
 * the 6-step wedding vendor flow.
 */

// ============================================================================
// CONFIG — Private business state (mirrors config.py exactly)
// ============================================================================

const CONFIG = {
  VENDOR_NAME: "Bella Tavola Catering",
  VENDOR_ID: "bella-tavola-catering",

  // Service Regions
  SERVICE_REGIONS: ["Greater Boston", "Cape Cod", "Rhode Island", "Southern NH"],
  TRAVEL_SURCHARGE: {
    "Greater Boston": 0,
    "Cape Cod": 500,
    "Rhode Island": 750,
    "Southern NH": 600,
  },

  // Capacity
  MIN_GUESTS: 20,
  MAX_GUESTS: 500,
  STAFF_PER_GUESTS: {
    plated: 10,
    buffet: 25,
    family_style: 15,
    stations: 20,
    cocktail_reception: 30,
  },
  MAX_STAFF_AVAILABLE: 50,

  // Pricing (per head, USD)
  BASE_PRICING: {
    plated: { standard: 95, premium: 135, luxury: 185 },
    buffet: { standard: 75, premium: 110, luxury: 155 },
    family_style: { standard: 85, premium: 125, luxury: 170 },
    stations: { standard: 90, premium: 130, luxury: 180 },
    cocktail_reception: { standard: 55, premium: 80, luxury: 115 },
  },

  // Volume Discounts
  VOLUME_DISCOUNTS: [
    [200, 0.05],
    [300, 0.08],
    [400, 0.10],
  ],

  // Seasonal Adjustments
  PEAK_MONTHS: [5, 6, 9, 10],
  OFF_PEAK_MONTHS: [1, 2, 3, 11],
  PEAK_SURCHARGE: 0.15,
  OFF_PEAK_DISCOUNT: 0.10,

  // Day-of-Week Adjustments
  SATURDAY_SURCHARGE: 0.0,
  FRIDAY_DISCOUNT: 0.05,
  SUNDAY_DISCOUNT: 0.08,
  WEEKDAY_DISCOUNT: 0.15,

  // Minimum Spend
  MINIMUM_SPEND: 3000,

  // Add-Ons
  ADD_ONS: {
    late_night_snack: { per_head: 15, description: "Late-night snack station (sliders, pizza, fries)" },
    raw_bar: { per_head: 25, description: "Raw bar with oysters, shrimp, ceviche" },
    dessert_table: { per_head: 12, description: "Dessert table with assorted pastries and sweets" },
    craft_cocktail_bar: { per_head: 18, description: "Craft cocktail bar with 3 signature drinks" },
    espresso_station: { per_head: 8, description: "Espresso and cappuccino station" },
    kids_menu: { per_head: 35, description: "Kid-friendly plated meal (flat rate per child)" },
    cake_cutting_service: { flat: 150, description: "Cake cutting and plating service" },
  },

  // Dietary Capabilities
  DIETARY_ACCOMMODATIONS: {
    vegetarian: { supported: true, upcharge: 0, max_pct: 100 },
    vegan: { supported: true, upcharge: 0, max_pct: 100 },
    gluten_free: { supported: true, upcharge: 5, max_pct: 100 },
    dairy_free: { supported: true, upcharge: 0, max_pct: 100 },
    nut_free: { supported: true, upcharge: 0, max_pct: 100 },
    kosher: { supported: true, upcharge: 25, max_pct: 50 },
    halal: { supported: true, upcharge: 15, max_pct: 100 },
    shellfish_free: { supported: true, upcharge: 0, max_pct: 100 },
    low_sodium: { supported: true, upcharge: 0, max_pct: 100 },
    paleo: { supported: true, upcharge: 10, max_pct: 30 },
    keto: { supported: true, upcharge: 10, max_pct: 30 },
  },

  // ── Dish Database: every dish tagged with what it contains ─────────
  // Tags: meat, poultry, fish, shellfish, dairy, eggs, gluten, nuts, pork, alcohol
  DISH_DB: {
    // Italian Classic
    "Bruschetta Trio":              { tags: ["gluten"], label: "Bruschetta Trio" },
    "Burrata with Heirloom Tomatoes": { tags: ["dairy"], label: "Burrata with Heirloom Tomatoes" },
    "Arancini":                     { tags: ["dairy", "gluten", "eggs"], label: "Arancini" },
    "Caesar Salad":                 { tags: ["dairy", "eggs", "fish"], label: "Caesar Salad" }, // anchovies + parm + egg yolk
    "Mixed Greens with Balsamic Vinaigrette": { tags: [], label: "Mixed Greens with Balsamic Vinaigrette" },
    "Chicken Parmigiana":           { tags: ["poultry", "dairy", "gluten", "eggs"], label: "Chicken Parmigiana" },
    "Pan-Seared Salmon with Lemon Caper Sauce": { tags: ["fish"], label: "Pan-Seared Salmon with Lemon Caper Sauce" },
    "Braised Short Rib with Polenta": { tags: ["meat"], label: "Braised Short Rib with Polenta" },
    "Eggplant Rollatini":           { tags: ["dairy", "gluten"], label: "Eggplant Rollatini" },
    "Roasted Seasonal Vegetables":  { tags: [], label: "Roasted Seasonal Vegetables" },
    "Garlic Mashed Potatoes":       { tags: ["dairy"], label: "Garlic Mashed Potatoes" },
    "Risotto":                      { tags: ["dairy"], label: "Risotto" },
    "Tiramisu":                     { tags: ["dairy", "eggs", "gluten", "alcohol"], label: "Tiramisu" },
    "Cannoli":                      { tags: ["dairy", "gluten", "eggs"], label: "Cannoli" },
    "Panna Cotta":                  { tags: ["dairy", "eggs"], label: "Panna Cotta" },

    // New England Harvest
    "Lobster Bisque Shooters":      { tags: ["shellfish", "dairy"], label: "Lobster Bisque Shooters" },
    "New England Clam Chowder Bread Bowls": { tags: ["shellfish", "dairy", "gluten"], label: "New England Clam Chowder Bread Bowls" },
    "Autumn Harvest Salad with Cranberry Vinaigrette": { tags: [], label: "Autumn Harvest Salad with Cranberry Vinaigrette" },
    "Roasted Cod with Brown Butter": { tags: ["fish", "dairy"], label: "Roasted Cod with Brown Butter" },
    "Herb-Crusted Prime Rib":       { tags: ["meat", "gluten"], label: "Herb-Crusted Prime Rib" },
    "Maple-Glazed Duck Breast":     { tags: ["poultry"], label: "Maple-Glazed Duck Breast" },
    "Stuffed Butternut Squash":     { tags: ["dairy"], label: "Stuffed Butternut Squash" },
    "Roasted Root Vegetables":      { tags: [], label: "Roasted Root Vegetables" },
    "Wild Rice Pilaf":              { tags: [], label: "Wild Rice Pilaf" },
    "Corn Bread":                   { tags: ["gluten", "dairy", "eggs"], label: "Corn Bread" },
    "Apple Crisp":                  { tags: ["gluten", "dairy"], label: "Apple Crisp" },
    "Blueberry Buckle":             { tags: ["gluten", "dairy", "eggs"], label: "Blueberry Buckle" },
    "Maple Creme Brulee":           { tags: ["dairy", "eggs"], label: "Maple Creme Brulee" },

    // Farm-to-Table
    "Local Cheese Board":           { tags: ["dairy", "nuts"], label: "Local Cheese Board" },
    "Seasonal Soup du Jour":        { tags: [], label: "Seasonal Soup du Jour" },
    "Farm Greens with Herb Vinaigrette": { tags: [], label: "Farm Greens with Herb Vinaigrette" },
    "Free-Range Chicken with Seasonal Compote": { tags: ["poultry"], label: "Free-Range Chicken with Seasonal Compote" },
    "Grass-Fed Filet Mignon":       { tags: ["meat"], label: "Grass-Fed Filet Mignon" },
    "Wild-Caught Halibut":          { tags: ["fish"], label: "Wild-Caught Halibut" },
    "Vegetable Tasting Plate":      { tags: [], label: "Vegetable Tasting Plate" },
    "Grilled Local Vegetables":     { tags: [], label: "Grilled Local Vegetables" },
    "Potato Gratin":                { tags: ["dairy"], label: "Potato Gratin" },
    "Quinoa Tabbouleh":             { tags: [], label: "Quinoa Tabbouleh" },
    "Seasonal Fruit Tart":          { tags: ["gluten", "dairy", "eggs"], label: "Seasonal Fruit Tart" },
    "Chocolate Ganache Cake":       { tags: ["dairy", "gluten", "eggs"], label: "Chocolate Ganache Cake" },
    "Cheese Course":                { tags: ["dairy"], label: "Cheese Course" },

    // Mediterranean Garden
    "Mezze Platter":                { tags: [], label: "Mezze Platter" },
    "Grilled Halloumi Skewers":     { tags: ["dairy"], label: "Grilled Halloumi Skewers" },
    "Greek Salad":                  { tags: ["dairy"], label: "Greek Salad" },
    "Fattoush":                     { tags: ["gluten"], label: "Fattoush" },
    "Lamb Chops with Tzatziki":     { tags: ["meat", "dairy"], label: "Lamb Chops with Tzatziki" },
    "Grilled Swordfish with Olive Tapenade": { tags: ["fish"], label: "Grilled Swordfish with Olive Tapenade" },
    "Chicken Souvlaki":             { tags: ["poultry", "dairy"], label: "Chicken Souvlaki" },
    "Moussaka":                     { tags: ["meat", "dairy", "gluten", "eggs"], label: "Moussaka" },
    "Roasted Mediterranean Vegetables": { tags: [], label: "Roasted Mediterranean Vegetables" },
    "Couscous":                     { tags: ["gluten"], label: "Couscous" },
    "Warm Pita":                    { tags: ["gluten"], label: "Warm Pita" },
    "Baklava":                      { tags: ["gluten", "nuts"], label: "Baklava" },
    "Loukoumades":                  { tags: ["gluten", "dairy"], label: "Loukoumades" },
    "Galaktoboureko":               { tags: ["gluten", "dairy", "eggs"], label: "Galaktoboureko" },

    // Budget Friendly
    "House Bruschetta":             { tags: ["gluten"], label: "House Bruschetta" },
    "Garden Salad with House Dressing": { tags: [], label: "Garden Salad with House Dressing" },
    "Grilled Chicken Marsala":      { tags: ["poultry", "gluten", "alcohol"], label: "Grilled Chicken Marsala" },
    "Penne alla Vodka":             { tags: ["gluten", "dairy", "alcohol"], label: "Penne alla Vodka" },
    "Baked Haddock":                { tags: ["fish", "gluten"], label: "Baked Haddock" },
    "Roasted Vegetables":           { tags: [], label: "Roasted Vegetables" },
    "Roasted Potatoes":             { tags: [], label: "Roasted Potatoes" },
    "Assorted Cookie Platter":      { tags: ["gluten", "dairy", "eggs", "nuts"], label: "Assorted Cookie Platter" },

    // ── Substitution dishes (added when originals are removed) ──────
    "Bruschetta with Tomato & Basil (GF bread)": { tags: [], label: "Bruschetta with Tomato & Basil (GF bread)" },
    "Grilled Vegetable Antipasto":  { tags: [], label: "Grilled Vegetable Antipasto" },
    "Stuffed Grape Leaves":         { tags: [], label: "Stuffed Grape Leaves" },
    "Roasted Beet & Citrus Salad":  { tags: [], label: "Roasted Beet & Citrus Salad" },
    "Arugula with Lemon Vinaigrette": { tags: [], label: "Arugula with Lemon Vinaigrette" },
    "Mushroom & Herb Risotto (dairy-free)": { tags: [], label: "Mushroom & Herb Risotto (dairy-free)" },
    "Grilled Portobello Steak":     { tags: [], label: "Grilled Portobello Steak" },
    "Cauliflower Steak with Chimichurri": { tags: [], label: "Cauliflower Steak with Chimichurri" },
    "Stuffed Bell Peppers":         { tags: [], label: "Stuffed Bell Peppers" },
    "Wild Mushroom Ragu over Polenta": { tags: [], label: "Wild Mushroom Ragu over Polenta" },
    "Lentil Bolognese with Zucchini Noodles": { tags: [], label: "Lentil Bolognese with Zucchini Noodles" },
    "Herb-Crusted Tofu with Roasted Vegetables": { tags: [], label: "Herb-Crusted Tofu with Roasted Vegetables" },
    "Coconut Milk Panna Cotta with Berries": { tags: [], label: "Coconut Milk Panna Cotta with Berries" },
    "Dark Chocolate Avocado Mousse": { tags: [], label: "Dark Chocolate Avocado Mousse" },
    "Fresh Fruit Platter with Mint": { tags: [], label: "Fresh Fruit Platter with Mint" },
    "Sorbet Trio (Lemon, Raspberry, Mango)": { tags: [], label: "Sorbet Trio (Lemon, Raspberry, Mango)" },
    "Flourless Chocolate Cake":     { tags: ["eggs", "dairy"], label: "Flourless Chocolate Cake" },
    "Flourless Chocolate Cake (Vegan)": { tags: [], label: "Flourless Chocolate Cake (Vegan)" },
    "Rice Noodle Pad Thai (Vegan)": { tags: [], label: "Rice Noodle Pad Thai (Vegan)" },
    "Olive Oil Smashed Potatoes":   { tags: [], label: "Olive Oil Smashed Potatoes" },
    "Steamed Jasmine Rice":         { tags: [], label: "Steamed Jasmine Rice" },
    "Quinoa with Roasted Vegetables": { tags: [], label: "Quinoa with Roasted Vegetables" },
    "Hummus & Crudité Platter":     { tags: [], label: "Hummus & Crudité Platter" },
    "Roasted Red Pepper Soup":      { tags: [], label: "Roasted Red Pepper Soup" },
    "GF Penne with Marinara":       { tags: [], label: "GF Penne with Marinara" },
    "GF Chocolate Torte":           { tags: ["eggs"], label: "GF Chocolate Torte" },
    "GF Chocolate Torte (Vegan)":   { tags: [], label: "GF Chocolate Torte (Vegan)" },
    "Macarons (GF)":                { tags: ["eggs", "nuts"], label: "Macarons (GF)" },
    "Herb-Roasted Chicken (Halal)": { tags: ["poultry"], label: "Herb-Roasted Chicken (Halal)" },
    "Grilled Lamb Kofta (Halal)":   { tags: ["meat"], label: "Grilled Lamb Kofta (Halal)" },
  },

  // ── Dietary filter rules: which tags to exclude ──────────────────
  // vegetarian: no meat, poultry, fish, shellfish
  // vegan: no meat, poultry, fish, shellfish, dairy, eggs
  // gluten_free: no gluten
  // dairy_free: no dairy
  // nut_free: no nuts
  // kosher: no shellfish, no pork (simplified)
  // halal: no pork, no alcohol
  DIETARY_EXCLUSIONS: {
    vegetarian: ["meat", "poultry", "fish", "shellfish", "pork"],
    vegan: ["meat", "poultry", "fish", "shellfish", "dairy", "eggs", "pork"],
    gluten_free: ["gluten"],
    dairy_free: ["dairy"],
    nut_free: ["nuts"],
    kosher: ["shellfish", "pork"],
    halal: ["pork", "alcohol"],
    shellfish_free: ["shellfish"],
  },

  // ── Substitution pool per course (used when dishes are filtered out)
  SUBSTITUTIONS: {
    appetizer: [
      "Grilled Vegetable Antipasto", "Stuffed Grape Leaves", "Hummus & Crudité Platter",
      "Roasted Red Pepper Soup", "Bruschetta with Tomato & Basil (GF bread)",
    ],
    salad: [
      "Roasted Beet & Citrus Salad", "Arugula with Lemon Vinaigrette",
      "Mixed Greens with Balsamic Vinaigrette",
    ],
    entree: [
      "Grilled Portobello Steak", "Cauliflower Steak with Chimichurri",
      "Stuffed Bell Peppers", "Wild Mushroom Ragu over Polenta",
      "Lentil Bolognese with Zucchini Noodles", "Herb-Crusted Tofu with Roasted Vegetables",
      "Rice Noodle Pad Thai (Vegan)",
    ],
    side: [
      "Roasted Seasonal Vegetables", "Olive Oil Smashed Potatoes",
      "Steamed Jasmine Rice", "Quinoa with Roasted Vegetables",
      "Roasted Root Vegetables", "Wild Rice Pilaf",
    ],
    dessert: [
      "Coconut Milk Panna Cotta with Berries", "Dark Chocolate Avocado Mousse",
      "Fresh Fruit Platter with Mint", "Sorbet Trio (Lemon, Raspberry, Mango)",
      "Flourless Chocolate Cake (Vegan)", "GF Chocolate Torte (Vegan)",
    ],
  },

  // Menu Templates
  MENU_TEMPLATES: {
    italian_classic: {
      name: "Italian Classic",
      cuisine: "Italian-American",
      courses: {
        appetizer: ["Bruschetta Trio", "Burrata with Heirloom Tomatoes", "Arancini"],
        salad: ["Caesar Salad", "Mixed Greens with Balsamic Vinaigrette"],
        entree: [
          "Chicken Parmigiana",
          "Pan-Seared Salmon with Lemon Caper Sauce",
          "Braised Short Rib with Polenta",
          "Eggplant Rollatini",
        ],
        side: ["Roasted Seasonal Vegetables", "Garlic Mashed Potatoes", "Risotto"],
        dessert: ["Tiramisu", "Cannoli", "Panna Cotta"],
      },
      tier: "premium",
    },
    new_england_harvest: {
      name: "New England Harvest",
      cuisine: "New England",
      courses: {
        appetizer: ["Lobster Bisque Shooters", "New England Clam Chowder Bread Bowls"],
        salad: ["Autumn Harvest Salad with Cranberry Vinaigrette"],
        entree: [
          "Roasted Cod with Brown Butter",
          "Herb-Crusted Prime Rib",
          "Maple-Glazed Duck Breast",
          "Stuffed Butternut Squash",
        ],
        side: ["Roasted Root Vegetables", "Wild Rice Pilaf", "Corn Bread"],
        dessert: ["Apple Crisp", "Blueberry Buckle", "Maple Creme Brulee"],
      },
      tier: "premium",
    },
    farm_to_table: {
      name: "Seasonal Farm-to-Table",
      cuisine: "Farm-to-Table",
      courses: {
        appetizer: ["Local Cheese Board", "Seasonal Soup du Jour"],
        salad: ["Farm Greens with Herb Vinaigrette"],
        entree: [
          "Free-Range Chicken with Seasonal Compote",
          "Grass-Fed Filet Mignon",
          "Wild-Caught Halibut",
          "Vegetable Tasting Plate",
        ],
        side: ["Grilled Local Vegetables", "Potato Gratin", "Quinoa Tabbouleh"],
        dessert: ["Seasonal Fruit Tart", "Chocolate Ganache Cake", "Cheese Course"],
      },
      tier: "luxury",
    },
    mediterranean_garden: {
      name: "Mediterranean Garden",
      cuisine: "Mediterranean",
      courses: {
        appetizer: ["Mezze Platter", "Grilled Halloumi Skewers"],
        salad: ["Greek Salad", "Fattoush"],
        entree: [
          "Lamb Chops with Tzatziki",
          "Grilled Swordfish with Olive Tapenade",
          "Chicken Souvlaki",
          "Moussaka",
        ],
        side: ["Roasted Mediterranean Vegetables", "Couscous", "Warm Pita"],
        dessert: ["Baklava", "Loukoumades", "Galaktoboureko"],
      },
      tier: "premium",
    },
    budget_friendly: {
      name: "Simply Elegant",
      cuisine: "Italian-American",
      courses: {
        appetizer: ["House Bruschetta"],
        salad: ["Garden Salad with House Dressing"],
        entree: [
          "Grilled Chicken Marsala",
          "Penne alla Vodka",
          "Baked Haddock",
        ],
        side: ["Roasted Vegetables", "Roasted Potatoes"],
        dessert: ["Assorted Cookie Platter"],
      },
      tier: "standard",
    },
  },

  // Blackout Dates
  BLACKOUT_DATES: [
    "2026-05-23", "2026-06-06", "2026-06-13", "2026-06-20",
    "2026-07-04", "2026-09-05", "2026-09-12", "2026-10-03",
    "2026-10-10", "2026-10-17", "2026-12-24", "2026-12-25",
    "2026-12-31",
  ],

  // Existing Bookings (date string -> guest count)
  EXISTING_BOOKINGS: {
    "2026-05-16": 180,
    "2026-05-30": 220,
    "2026-06-27": 150,
    "2026-07-11": 100,
    "2026-08-08": 250,
    "2026-08-15": 300,
    "2026-09-19": 200,
    "2026-09-26": 175,
    "2026-10-24": 280,
  },

  // Negotiation Rules (PRIVATE)
  NEGOTIATION: {
    max_discount_pct: 12,
    auto_accept_margin_pct: 20,
    counter_offer_step_pct: 3,
    max_rounds: 4,
    bundle_discount_pct: 5,
    fill_gap_discount_pct: 8,
    minimum_margin_pct: 15,
    cost_basis_pct_of_price: 55,
  },

  // Tasting Policy
  TASTING_POLICY: {
    complimentary_threshold: 5000,
    tasting_fee: 250,
    max_guests_at_tasting: 4,
  },

  // Advance booking minimum (days)
  CONSTRAINTS_MIN_ADVANCE: 30,

  // Agent Card (public-facing)
  AGENT_CARD: {
    name: "Bella Tavola Catering",
    description:
      "Full-service wedding caterer offering plated, buffet, and family-style dining for 20-500 guests. Specializing in Italian-American and seasonal farm-to-table menus with extensive dietary accommodation.",
    url: "https://agents.altara.ai/vendors/bella-tavola-catering",
    version: "1.0.0",
    protocol: "a2a/1.0",
    capabilities: {
      skills: [
        "check_availability",
        "get_menus",
        "generate_quote",
        "accommodate_dietary",
        "negotiate_pricing",
        "confirm_booking",
      ],
      negotiation: {
        supports_rfp: true,
        supports_counter_offer: true,
        supports_reverse_auction: true,
        auto_approve_threshold_per_head: 85,
      },
    },
    constraints: {
      min_guest_count: 20,
      max_guest_count: 500,
      service_regions: ["Greater Boston", "Cape Cod", "Rhode Island", "Southern NH"],
      advance_booking_days_min: 30,
      cuisine_types: ["Italian-American", "New England", "Farm-to-Table", "Mediterranean"],
      service_styles: ["plated", "buffet", "family_style", "stations", "cocktail_reception"],
    },
    trust: {
      rating: 4.8,
      total_events: 342,
      on_time_delivery_pct: 99.1,
      avg_response_time_hours: 1.2,
    },
  },
};


// ============================================================================
// SKILL: Availability
// ============================================================================

function ceilDiv(a, b) {
  return Math.ceil(a / b);
}

function checkAvailability(eventDate, guestCount, region, serviceStyle = "plated") {
  const result = {
    available: false,
    reason: null,
    date: eventDate,
    guest_count: guestCount,
    capacity_remaining: null,
    suggested_alternatives: null,
  };

  // Region check
  if (!CONFIG.SERVICE_REGIONS.includes(region)) {
    result.reason =
      `Region '${region}' is outside our service area. We serve: ${CONFIG.SERVICE_REGIONS.join(", ")}.`;
    return result;
  }

  // Advance booking check
  const eventDateObj = new Date(eventDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.floor((eventDateObj - today) / (1000 * 60 * 60 * 24));
  if (daysUntil < CONFIG.CONSTRAINTS_MIN_ADVANCE) {
    result.reason =
      `We require at least ${CONFIG.CONSTRAINTS_MIN_ADVANCE} days advance booking. Your event is only ${daysUntil} days away.`;
    return result;
  }

  // Blackout date check
  if (CONFIG.BLACKOUT_DATES.includes(eventDate)) {
    result.reason = "This date is unavailable (fully booked or blacked out).";
    result.suggested_alternatives = findNearbyDates(eventDate, guestCount, serviceStyle);
    return result;
  }

  // Guest count bounds
  if (guestCount < CONFIG.MIN_GUESTS) {
    result.reason = `Minimum guest count is ${CONFIG.MIN_GUESTS}.`;
    return result;
  }
  if (guestCount > CONFIG.MAX_GUESTS) {
    result.reason = `Maximum guest count is ${CONFIG.MAX_GUESTS}.`;
    return result;
  }

  // Staffing capacity check
  const serversPer = CONFIG.STAFF_PER_GUESTS[serviceStyle] || 15;
  const serversNeeded = ceilDiv(guestCount, serversPer);
  const existingGuests = CONFIG.EXISTING_BOOKINGS[eventDate] || 0;
  const existingServers = existingGuests ? ceilDiv(existingGuests, serversPer) : 0;
  const serversAvailable = CONFIG.MAX_STAFF_AVAILABLE - existingServers;

  if (serversNeeded > serversAvailable) {
    const maxAdditionalGuests = serversAvailable * serversPer;
    result.reason =
      `We have an existing booking on this date for ${existingGuests} guests. ` +
      `We can accommodate up to ${maxAdditionalGuests} additional guests for ${serviceStyle} service.`;
    result.capacity_remaining = maxAdditionalGuests;
    result.suggested_alternatives = findNearbyDates(eventDate, guestCount, serviceStyle);
    return result;
  }

  // All checks passed
  const capacityRemaining = (serversAvailable - serversNeeded) * serversPer;
  result.available = true;
  result.capacity_remaining = capacityRemaining;
  result.reason = "Date is available.";
  return result;
}

function findNearbyDates(target, guestCount, serviceStyle, searchRange = 14) {
  const alternatives = [];
  const targetDate = new Date(target + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today.getTime() + CONFIG.CONSTRAINTS_MIN_ADVANCE * 86400000);

  for (let delta = -searchRange; delta <= searchRange; delta++) {
    if (delta === 0) continue;
    const candidate = new Date(targetDate.getTime() + delta * 86400000);
    if (candidate < minDate) continue;
    const candidateStr = candidate.toISOString().slice(0, 10);
    if (CONFIG.BLACKOUT_DATES.includes(candidateStr)) continue;

    const existing = CONFIG.EXISTING_BOOKINGS[candidateStr] || 0;
    const serversPer = CONFIG.STAFF_PER_GUESTS[serviceStyle] || 15;
    const serversNeeded = ceilDiv(guestCount, serversPer);
    const existingServers = existing ? ceilDiv(existing, serversPer) : 0;
    if (serversNeeded <= CONFIG.MAX_STAFF_AVAILABLE - existingServers) {
      alternatives.push(candidateStr);
      if (alternatives.length >= 3) break;
    }
  }
  return alternatives;
}


// ============================================================================
// SKILL: Menu Management
// ============================================================================

// ── Dietary filtering: removes incompatible dishes, adds substitutions ──

function getDishTags(dishName) {
  // Try exact match first, then fuzzy match
  const db = CONFIG.DISH_DB;
  if (db[dishName]) return db[dishName].tags;
  // Strip "(V)", "(GF)", etc. suffixes for matching
  const cleaned = dishName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (db[cleaned]) return db[cleaned].tags;
  // Unknown dish — assume safe (empty tags)
  return [];
}

function isDishCompatible(dishName, dietaryNeeds) {
  const tags = getDishTags(dishName);
  for (const need of dietaryNeeds) {
    const key = need.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
    const exclusions = CONFIG.DIETARY_EXCLUSIONS[key];
    if (!exclusions) continue;
    for (const tag of tags) {
      if (exclusions.includes(tag)) return false;
    }
  }
  return true;
}

function getSubstitution(course, dietaryNeeds, alreadyUsed, existingDishes = []) {
  const pool = CONFIG.SUBSTITUTIONS[course] || [];
  for (const sub of pool) {
    if (alreadyUsed.has(sub)) continue;
    if (existingDishes.includes(sub)) continue; // Don't duplicate dishes already in the course
    if (isDishCompatible(sub, dietaryNeeds)) {
      alreadyUsed.add(sub);
      return sub;
    }
  }
  return null;
}

function filterMenuForDietary(courses, dietaryNeeds) {
  if (!dietaryNeeds || dietaryNeeds.length === 0) {
    return { courses, removed: [], substituted: [] };
  }

  const filtered = {};
  const removed = [];
  const substituted = [];
  const usedSubs = new Set();

  for (const [course, dishes] of Object.entries(courses)) {
    const kept = [];
    // First pass: keep compatible dishes
    for (const dish of dishes) {
      if (isDishCompatible(dish, dietaryNeeds)) {
        kept.push(dish);
      } else {
        removed.push({ course, dish, reason: _getRemovalReason(dish, dietaryNeeds) });
      }
    }
    // Second pass: add substitutes for removed dishes
    const removedInCourse = removed.filter(r => r.course === course);
    for (const r of removedInCourse) {
      const sub = getSubstitution(course, dietaryNeeds, usedSubs, [...kept, ...dishes]);
      if (sub) {
        kept.push(sub);
        substituted.push({ course, removed: r.dish, added: sub });
      }
    }
    // If a course ended up empty, add at least one substitute
    if (kept.length === 0) {
      const sub = getSubstitution(course, dietaryNeeds, usedSubs, dishes);
      if (sub) {
        kept.push(sub);
        substituted.push({ course, removed: "(all items)", added: sub });
      }
    }
    filtered[course] = kept;
  }

  return { courses: filtered, removed, substituted };
}

function _getRemovalReason(dishName, dietaryNeeds) {
  const tags = getDishTags(dishName);
  const reasons = [];
  for (const need of dietaryNeeds) {
    const key = need.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
    const exclusions = CONFIG.DIETARY_EXCLUSIONS[key] || [];
    const conflicts = tags.filter(t => exclusions.includes(t));
    if (conflicts.length > 0) {
      reasons.push(`${need} (contains ${conflicts.join(", ")})`);
    }
  }
  return reasons.join("; ");
}


function getPriceRange(tier) {
  const prices = [];
  for (const stylePrices of Object.values(CONFIG.BASE_PRICING)) {
    if (tier in stylePrices) prices.push(stylePrices[tier]);
  }
  if (prices.length > 0) {
    return { min: Math.min(...prices), max: Math.max(...prices), currency: "USD", unit: "per_head" };
  }
  return { min: 0, max: 0, currency: "USD", unit: "per_head" };
}

function checkMenuDietaryCompatibility(template, dietaryNeeds) {
  const compatibility = {};
  for (const need of dietaryNeeds) {
    const key = need.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
    const acc = CONFIG.DIETARY_ACCOMMODATIONS[key];
    if (acc && acc.supported) {
      compatibility[need] = {
        supported: true,
        upcharge: acc.upcharge,
        note: acc.max_pct === 100 ? "Full menu can be adapted" : `Up to ${acc.max_pct}% of guests`,
      };
    } else if (acc) {
      compatibility[need] = { supported: false, note: "Not available for this menu" };
    } else {
      compatibility[need] = { supported: false, note: "Unknown dietary requirement -- please inquire" };
    }
  }
  return compatibility;
}

function getMenus({ cuisine, tier, dietaryNeeds, serviceStyle } = {}) {
  const menus = [];

  for (const [key, template] of Object.entries(CONFIG.MENU_TEMPLATES)) {
    if (cuisine && !template.cuisine.toLowerCase().includes(cuisine.toLowerCase())) continue;
    if (tier && template.tier !== tier) continue;

    // Apply dietary filtering to courses
    let displayCourses = template.courses;
    let dietaryAdaptations = null;
    if (dietaryNeeds && dietaryNeeds.length > 0) {
      const result = filterMenuForDietary(template.courses, dietaryNeeds);
      displayCourses = result.courses;
      dietaryAdaptations = {
        removed: result.removed,
        substituted: result.substituted,
        note: result.removed.length > 0
          ? `${result.removed.length} item(s) replaced to comply with ${dietaryNeeds.join(", ")} requirements.`
          : "All items are already compliant.",
      };
    }

    const menuEntry = {
      id: key,
      name: template.name,
      cuisine: template.cuisine,
      tier: template.tier,
      courses: displayCourses,
      price_range: getPriceRange(template.tier),
    };

    if (dietaryNeeds && dietaryNeeds.length > 0) {
      menuEntry.dietary_compatibility = checkMenuDietaryCompatibility(template, dietaryNeeds);
      menuEntry.dietary_adaptations = dietaryAdaptations;
    }

    menus.push(menuEntry);
  }

  const serviceStyles = [
    { id: "plated", name: "Plated Dinner", description: "Elegant multi-course meal served to each guest at the table." },
    { id: "buffet", name: "Buffet", description: "Self-serve stations with a wide variety of options." },
    { id: "family_style", name: "Family Style", description: "Shared platters served to each table for a communal feel." },
    { id: "stations", name: "Food Stations", description: "Themed food stations (carving, pasta, sushi, etc.)." },
    { id: "cocktail_reception", name: "Cocktail Reception", description: "Heavy hors d'oeuvres and small plates, no formal seating." },
  ];

  const filteredStyles = serviceStyle
    ? serviceStyles.filter((s) => s.id === serviceStyle)
    : serviceStyles;

  const addOns = Object.entries(CONFIG.ADD_ONS).map(([id, v]) => ({ id, ...v }));

  return { menus, service_styles: filteredStyles, add_ons: addOns };
}


// ============================================================================
// SKILL: Dietary Accommodation
// ============================================================================

function accommodateDietary(dietaryBreakdown, totalGuests, menuId = null) {
  const accommodations = [];
  const recommendations = [];
  const warnings = [];
  let totalUpcharge = 0;
  let feasible = true;

  for (const [need, count] of Object.entries(dietaryBreakdown)) {
    const needKey = need.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
    const acc = CONFIG.DIETARY_ACCOMMODATIONS[needKey];

    if (!acc) {
      warnings.push(
        `'${need}' is not a standard dietary category. We may be able to accommodate -- please discuss with our chef.`
      );
      accommodations.push({
        dietary_need: need,
        guest_count: count,
        supported: null,
        status: "requires_consultation",
        upcharge_per_head: 0,
      });
      continue;
    }

    const pctOfGuests = totalGuests > 0 ? (count / totalGuests) * 100 : 0;

    if (!acc.supported) {
      feasible = false;
      warnings.push(
        `'${need}' cannot be accommodated. Consider a specialty caterer for these ${count} guests.`
      );
      accommodations.push({
        dietary_need: need,
        guest_count: count,
        supported: false,
        status: "not_available",
        upcharge_per_head: 0,
      });
      continue;
    }

    if (pctOfGuests > acc.max_pct) {
      warnings.push(
        `'${need}' requested for ${count} guests (${pctOfGuests.toFixed(0)}%), ` +
        `but we can only accommodate up to ${acc.max_pct}% of guests. ` +
        `Max: ${Math.floor((totalGuests * acc.max_pct) / 100)} guests.`
      );
      feasible = false;
    }

    const upcharge = acc.upcharge * count;
    totalUpcharge += upcharge;

    let status = "fully_supported";
    if (acc.upcharge > 0) status = "supported_with_upcharge";

    accommodations.push({
      dietary_need: need,
      guest_count: count,
      pct_of_total: Math.round(pctOfGuests * 10) / 10,
      supported: true,
      status,
      upcharge_per_head: acc.upcharge,
      upcharge_subtotal: upcharge,
    });
  }

  // Recommendations
  const veganCount = dietaryBreakdown.vegan || 0;
  const vegetarianCount = dietaryBreakdown.vegetarian || 0;
  const plantBasedTotal = veganCount + vegetarianCount;

  if (plantBasedTotal > totalGuests * 0.3) {
    recommendations.push(
      "With 30%+ plant-based guests, we recommend our Farm-to-Table menu which has the strongest vegetable-forward options."
    );
  }
  if (dietaryBreakdown.kosher && dietaryBreakdown.halal) {
    recommendations.push(
      "For events with both kosher and halal requirements, our Mediterranean Garden menu provides the most overlap-friendly base."
    );
  }
  const gfCount = dietaryBreakdown.gluten_free || 0;
  if (gfCount > totalGuests * 0.2) {
    recommendations.push(
      "With significant gluten-free needs, consider our family-style service which allows us to prepare separate GF platters efficiently."
    );
  }
  if (menuId && CONFIG.MENU_TEMPLATES[menuId]) {
    const menu = CONFIG.MENU_TEMPLATES[menuId];
    recommendations.push(
      `The '${menu.name}' menu can be adapted for all supported dietary needs listed above.`
    );
  }

  return {
    feasible,
    total_guests: totalGuests,
    guests_with_dietary_needs: Object.values(dietaryBreakdown).reduce((a, b) => a + b, 0),
    accommodations,
    total_dietary_upcharge: totalUpcharge,
    recommendations,
    warnings,
  };
}


// ============================================================================
// SKILL: Pricing & Negotiation
// ============================================================================

function getMonthName(monthNum) {
  const names = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return names[monthNum] || "";
}

function generateQuote({
  eventDate,
  guestCount,
  serviceStyle,
  tier,
  region,
  menuId = null,
  addOns = null,
  dietaryBreakdown = null,
  kidsCount = 0,
}) {
  const errors = [];

  if (!(serviceStyle in CONFIG.BASE_PRICING)) {
    errors.push(`Unknown service style: '${serviceStyle}'. Options: ${Object.keys(CONFIG.BASE_PRICING).join(", ")}`);
  }
  if (!(tier in (CONFIG.BASE_PRICING[serviceStyle] || {}))) {
    errors.push(`Unknown tier: '${tier}'. Options: ${Object.keys(CONFIG.BASE_PRICING[serviceStyle] || {}).join(", ")}`);
  }
  if (errors.length > 0) return { error: errors };

  const basePerHead = CONFIG.BASE_PRICING[serviceStyle][tier];
  const adultCount = guestCount - kidsCount;
  const lineItems = [];

  lineItems.push({
    item: `${capitalize(tier)} ${serviceStyle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} -- ${adultCount} adults`,
    per_head: basePerHead,
    quantity: adultCount,
    subtotal: basePerHead * adultCount,
  });

  // Kids meals
  if (kidsCount > 0) {
    const kidsPrice = CONFIG.ADD_ONS.kids_menu.per_head;
    lineItems.push({
      item: `Kids Menu -- ${kidsCount} children`,
      per_head: kidsPrice,
      quantity: kidsCount,
      subtotal: kidsPrice * kidsCount,
    });
  }

  // Dietary upcharges
  if (dietaryBreakdown) {
    for (const [need, count] of Object.entries(dietaryBreakdown)) {
      const needKey = need.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
      const acc = CONFIG.DIETARY_ACCOMMODATIONS[needKey] || {};
      if ((acc.upcharge || 0) > 0) {
        const upcharge = acc.upcharge * count;
        lineItems.push({
          item: `Dietary: ${need} accommodation (${count} guests)`,
          per_head: acc.upcharge,
          quantity: count,
          subtotal: upcharge,
        });
      }
    }
  }

  // Add-ons
  if (addOns && addOns.length > 0) {
    for (const addonId of addOns) {
      const addon = CONFIG.ADD_ONS[addonId];
      if (addon) {
        if (addon.per_head !== undefined) {
          const subtotal = addon.per_head * guestCount;
          lineItems.push({
            item: addon.description,
            per_head: addon.per_head,
            quantity: guestCount,
            subtotal,
          });
        } else if (addon.flat !== undefined) {
          lineItems.push({
            item: addon.description,
            flat_fee: addon.flat,
            quantity: 1,
            subtotal: addon.flat,
          });
        }
      }
    }
  }

  // Subtotal before adjustments
  let subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const adjustments = [];

  // Volume discount
  const sortedDiscounts = [...CONFIG.VOLUME_DISCOUNTS].sort((a, b) => b[0] - a[0]);
  for (const [minGuests, discountPct] of sortedDiscounts) {
    if (guestCount >= minGuests) {
      const discountAmt = Math.round(subtotal * discountPct);
      adjustments.push({
        type: "volume_discount",
        description: `Volume discount (${guestCount}+ guests, ${Math.round(discountPct * 100)}% off)`,
        amount: -discountAmt,
      });
      break;
    }
  }

  // Seasonal adjustment
  const eventDateObj = new Date(eventDate + "T00:00:00");
  const month = eventDateObj.getMonth() + 1; // JS months are 0-indexed
  if (CONFIG.PEAK_MONTHS.includes(month)) {
    const surcharge = Math.round(subtotal * CONFIG.PEAK_SURCHARGE);
    adjustments.push({
      type: "peak_season",
      description: `Peak season surcharge (${getMonthName(month)})`,
      amount: surcharge,
    });
  } else if (CONFIG.OFF_PEAK_MONTHS.includes(month)) {
    const discount = Math.round(subtotal * CONFIG.OFF_PEAK_DISCOUNT);
    adjustments.push({
      type: "off_peak_discount",
      description: `Off-peak season discount (${getMonthName(month)})`,
      amount: -discount,
    });
  }

  // Day-of-week adjustment
  const dayOfWeek = eventDateObj.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 5) {
    // Friday
    const discount = Math.round(subtotal * CONFIG.FRIDAY_DISCOUNT);
    adjustments.push({ type: "friday_discount", description: "Friday event discount", amount: -discount });
  } else if (dayOfWeek === 0) {
    // Sunday
    const discount = Math.round(subtotal * CONFIG.SUNDAY_DISCOUNT);
    adjustments.push({ type: "sunday_discount", description: "Sunday event discount", amount: -discount });
  } else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    // Mon-Thu
    const discount = Math.round(subtotal * CONFIG.WEEKDAY_DISCOUNT);
    adjustments.push({ type: "weekday_discount", description: "Weekday event discount", amount: -discount });
  }
  // Saturday (dayOfWeek === 6): no adjustment

  // Travel surcharge
  const travel = CONFIG.TRAVEL_SURCHARGE[region] || 0;
  if (travel > 0) {
    adjustments.push({
      type: "travel_surcharge",
      description: `Travel surcharge (${region})`,
      amount: travel,
    });
  }

  // Total
  const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
  let total = subtotal + adjustmentTotal;

  // Enforce minimum spend
  if (total < CONFIG.MINIMUM_SPEND) {
    const difference = CONFIG.MINIMUM_SPEND - total;
    adjustments.push({
      type: "minimum_spend",
      description: `Minimum spend adjustment ($${CONFIG.MINIMUM_SPEND} minimum)`,
      amount: difference,
    });
    total = CONFIG.MINIMUM_SPEND;
  }

  const effectivePerHead = Math.round((total / guestCount) * 100) / 100;

  // Tasting eligibility
  const tasting = {
    complimentary: total >= CONFIG.TASTING_POLICY.complimentary_threshold,
    fee: total >= CONFIG.TASTING_POLICY.complimentary_threshold ? 0 : CONFIG.TASTING_POLICY.tasting_fee,
    note:
      total >= CONFIG.TASTING_POLICY.complimentary_threshold
        ? "Complimentary tasting included."
        : "Tasting fee is credited toward your booking.",
  };

  // Internal margin (NEVER sent to planner)
  const costBasis = (total * CONFIG.NEGOTIATION.cost_basis_pct_of_price) / 100;
  const margin = total - costBasis;
  const marginPct = total > 0 ? (margin / total) * 100 : 0;

  const quote = {
    quote_id: `QT-${eventDate.replace(/-/g, "")}-${guestCount}`,
    vendor: CONFIG.VENDOR_NAME,
    event_date: eventDate,
    guest_count: guestCount,
    service_style: serviceStyle,
    tier,
    region,
    line_items: lineItems,
    subtotal,
    adjustments,
    total,
    effective_per_head: effectivePerHead,
    currency: "USD",
    tasting,
    valid_for_days: 14,
    deposit_required_pct: 25,
    deposit_amount: Math.round(total * 0.25),
    payment_schedule: [
      { milestone: "Booking deposit", pct: 25, amount: Math.round(total * 0.25) },
      { milestone: "Menu finalization (60 days before)", pct: 25, amount: Math.round(total * 0.25) },
      { milestone: "Final guest count (14 days before)", pct: 25, amount: Math.round(total * 0.25) },
      { milestone: "Day of event", pct: 25, amount: total - 3 * Math.round(total * 0.25) },
    ],
    // PRIVATE
    _internal: {
      cost_basis: costBasis,
      margin,
      margin_pct: Math.round(marginPct * 10) / 10,
      floor_price: Math.round(costBasis / (1 - CONFIG.NEGOTIATION.minimum_margin_pct / 100)),
    },
  };

  return quote;
}

function generateSweeteners(round) {
  const sweeteners = [];
  if (round >= 1) sweeteners.push("Complimentary tasting for up to 4 guests");
  if (round >= 2) sweeteners.push("Complimentary espresso station upgrade");
  if (round >= 3) sweeteners.push("Complimentary late-night snack station for up to 50 guests");
  if (round >= 4) sweeteners.push("15% off add-ons booked within 48 hours");
  return sweeteners;
}

function applyNegotiation({
  originalQuote,
  requestedTotal = null,
  requestedPerHead = null,
  negotiationRound = 1,
  eventDate = null,
  addOnsOffered = null,
}) {
  const internal = originalQuote._internal || {};
  const floorPrice = internal.floor_price || originalQuote.total * 0.88;
  const originalTotal = originalQuote.total;
  const guestCount = originalQuote.guest_count;

  // Determine requested total
  if (requestedPerHead && !requestedTotal) {
    requestedTotal = requestedPerHead * guestCount;
  }
  if (!requestedTotal) {
    return { error: "Provide either requested_total or requested_per_head." };
  }

  const discountPct = ((originalTotal - requestedTotal) / originalTotal) * 100;
  const maxDiscount = CONFIG.NEGOTIATION.max_discount_pct;

  // Fill-gap bonus
  let extraDiscount = 0;
  if (eventDate) {
    const eventMonth = new Date(eventDate + "T00:00:00").getMonth() + 1;
    if (CONFIG.OFF_PEAK_MONTHS.includes(eventMonth)) {
      extraDiscount += CONFIG.NEGOTIATION.fill_gap_discount_pct;
    }
  }
  if (addOnsOffered && addOnsOffered.length >= 2) {
    extraDiscount += CONFIG.NEGOTIATION.bundle_discount_pct;
  }
  const effectiveMaxDiscount = Math.min(maxDiscount + extraDiscount, 20);

  // Too many rounds
  if (negotiationRound > CONFIG.NEGOTIATION.max_rounds) {
    return {
      decision: "reject",
      original_total: originalTotal,
      requested_total: requestedTotal,
      counter_total: null,
      counter_per_head: null,
      message:
        "We've reached the limit of our flexibility on pricing. Our best offer remains on the table. We'd love to work with you -- let us know if the last offer works.",
      round: negotiationRound,
      sweeteners: [],
    };
  }

  // Auto-accept if within margin
  if (requestedTotal >= floorPrice && discountPct <= effectiveMaxDiscount) {
    return {
      decision: "accept",
      original_total: originalTotal,
      requested_total: requestedTotal,
      accepted_total: requestedTotal,
      accepted_per_head: Math.round((requestedTotal / guestCount) * 100) / 100,
      message: "We're happy to accept this price. Let's lock in your date!",
      round: negotiationRound,
      sweeteners: [],
    };
  }

  // Below floor -> counter with best price
  if (requestedTotal < floorPrice) {
    const bestPrice = floorPrice;
    const pctOff = ((originalTotal - bestPrice) / originalTotal) * 100;
    return {
      decision: "counter",
      original_total: originalTotal,
      requested_total: requestedTotal,
      counter_total: Math.round(bestPrice),
      counter_per_head: Math.round((bestPrice / guestCount) * 100) / 100,
      message:
        `We appreciate the offer, but $${requestedTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} is below what we can do. ` +
        `Our absolute best is $${bestPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} ($${Math.round(bestPrice / guestCount)}/head). ` +
        `This is a ${pctOff.toFixed(0)}% discount from our standard rate.`,
      round: negotiationRound,
      sweeteners: generateSweeteners(negotiationRound),
    };
  }

  // Counter-offer: step down from original
  const stepsTaken = negotiationRound * CONFIG.NEGOTIATION.counter_offer_step_pct;
  const counterDiscount = Math.min(stepsTaken, effectiveMaxDiscount) / 100;
  let counterTotal = Math.round(originalTotal * (1 - counterDiscount));
  counterTotal = Math.max(counterTotal, floorPrice);

  const pctOff = ((originalTotal - counterTotal) / originalTotal) * 100;
  return {
    decision: "counter",
    original_total: originalTotal,
    requested_total: requestedTotal,
    counter_total: counterTotal,
    counter_per_head: Math.round((counterTotal / guestCount) * 100) / 100,
    message:
      `We can meet you partway -- how about $${counterTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} ` +
      `($${Math.round(counterTotal / guestCount)}/head)? ` +
      `That's ${pctOff.toFixed(0)}% off our standard rate.`,
    round: negotiationRound,
    sweeteners: generateSweeteners(negotiationRound),
  };
}


// ============================================================================
// SKILL: Booking Management
// ============================================================================

const heldDates = {};
const confirmedBookings = {};

function holdDate({ eventDate, guestCount, quoteId, plannerAgentId = "couple-planner", holdDays = 7 }) {
  const holdKey = eventDate;

  if (heldDates[holdKey]) {
    const existing = heldDates[holdKey];
    if (existing.planner_agent_id !== plannerAgentId) {
      const expiry = new Date(existing.expires);
      if (expiry > new Date()) {
        return {
          hold_id: null,
          status: "conflict",
          expires: null,
          message:
            `This date is currently held by another client. The hold expires on ${existing.expires}. We can notify you if it becomes available.`,
          waitlist_available: true,
        };
      } else {
        delete heldDates[holdKey];
      }
    }
  }

  const holdId = `HOLD-${eventDate.replace(/-/g, "")}-${guestCount}`;
  const now = new Date();
  const expires = new Date(now.getTime() + holdDays * 86400000).toISOString();

  heldDates[holdKey] = {
    hold_id: holdId,
    event_date: eventDate,
    guest_count: guestCount,
    quote_id: quoteId,
    planner_agent_id: plannerAgentId,
    expires,
    created: now.toISOString(),
  };

  return {
    hold_id: holdId,
    status: "held",
    expires,
    message:
      `Date held for ${holdDays} days. Please confirm with a 25% deposit by ${expires.slice(0, 10)} to secure your booking.`,
    next_steps: [
      "Schedule a tasting (if applicable)",
      "Finalize menu selections",
      "Submit signed contract and deposit",
    ],
  };
}

function confirmBooking({
  holdId,
  quoteId,
  finalGuestCount,
  menuId,
  serviceStyle,
  depositReceived = false,
  contractSigned = false,
  specialNotes = null,
}) {
  // Find the hold
  let held = null;
  for (const [key, holdData] of Object.entries(heldDates)) {
    if (holdData.hold_id === holdId) {
      held = holdData;
      break;
    }
  }

  if (!held) {
    return {
      booking_id: null,
      status: "error",
      message: `Hold '${holdId}' not found or has expired. Please request a new quote.`,
    };
  }

  if (!contractSigned) {
    return {
      booking_id: null,
      status: "pending_contract",
      message: "Please sign and return the catering contract before we can confirm.",
      contract_url: `https://altara.ai/contracts/${quoteId}`,
    };
  }

  if (!depositReceived) {
    return {
      booking_id: null,
      status: "pending_deposit",
      message: "Please submit the 25% deposit to confirm your booking.",
      payment_url: `https://altara.ai/pay/${quoteId}`,
    };
  }

  const eventDate = held.event_date;
  const bookingId = `BK-${eventDate.replace(/-/g, "")}-${finalGuestCount}`;
  const eventDateObj = new Date(eventDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  confirmedBookings[bookingId] = {
    booking_id: bookingId,
    event_date: eventDate,
    guest_count: finalGuestCount,
    menu_id: menuId,
    service_style: serviceStyle,
    quote_id: quoteId,
    special_notes: specialNotes,
    confirmed_at: new Date().toISOString(),
  };

  const addDays = (d, n) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);

  const timeline = [
    { milestone: "Booking confirmed", date: today.toISOString().slice(0, 10), status: "complete" },
    { milestone: "Schedule tasting", date: addDays(today, 14), status: "upcoming" },
    { milestone: "Menu finalization deadline", date: addDays(eventDateObj, -60), status: "upcoming" },
    { milestone: "Second payment due (25%)", date: addDays(eventDateObj, -60), status: "upcoming" },
    { milestone: "Final guest count due", date: addDays(eventDateObj, -14), status: "upcoming" },
    { milestone: "Third payment due (25%)", date: addDays(eventDateObj, -14), status: "upcoming" },
    { milestone: "Final walkthrough with venue", date: addDays(eventDateObj, -7), status: "upcoming" },
    { milestone: "Event day -- final payment due", date: eventDate, status: "upcoming" },
  ];

  // Remove the hold
  if (heldDates[eventDate]) delete heldDates[eventDate];

  return {
    booking_id: bookingId,
    status: "confirmed",
    message:
      `Congratulations! Your catering is confirmed for ${eventDate} ` +
      `(${finalGuestCount} guests, ${serviceStyle} ${menuId}). ` +
      `We can't wait to be part of your special day!`,
    timeline,
    cancellation_policy: {
      full_refund_before_days: 90,
      "50pct_refund_before_days": 60,
      no_refund_before_days: 30,
    },
    your_contact: {
      name: "Maria Russo",
      role: "Event Coordinator",
      email: "maria@bellatavola.com",
      phone: "(617) 555-0142",
    },
  };
}


// ============================================================================
// CATERER AGENT — Full agent wrapping all skills
// ============================================================================

class CatererAgent {
  constructor() {
    this.activeQuotes = {};
    this.negotiationState = {};
  }

  handleMessage(message) {
    const intent = message.intent;
    const params = message.params || {};
    const context = message.context || {};

    const handlers = {
      discover: () => this._handleDiscover(),
      check_availability: () => this._handleAvailability(params),
      get_menus: () => this._handleMenus(params),
      accommodate_dietary: () => this._handleDietary(params),
      generate_quote: () => this._handleQuote(params),
      rfp: () => this._handleRfp(params),
      negotiate: () => this._handleNegotiate(params, context),
      hold_date: () => this._handleHold(params),
      confirm_booking: () => this._handleConfirm(params),
    };

    const handler = handlers[intent];
    if (!handler) {
      return this._response(intent || "unknown", "error", {
        message: `Unknown intent: '${intent}'`,
        supported_intents: Object.keys(handlers),
      });
    }

    try {
      const data = handler();
      return this._response(intent, "success", data);
    } catch (e) {
      return this._response(intent, "error", { message: e.message });
    }
  }

  _handleDiscover() {
    return CONFIG.AGENT_CARD;
  }

  _handleAvailability(params) {
    return checkAvailability(
      params.event_date,
      params.guest_count || 100,
      params.region || "Greater Boston",
      params.service_style || "plated"
    );
  }

  _handleMenus(params) {
    return getMenus({
      cuisine: params.cuisine,
      tier: params.tier,
      dietaryNeeds: params.dietary_needs,
      serviceStyle: params.service_style,
    });
  }

  _handleDietary(params) {
    return accommodateDietary(
      params.dietary_breakdown || {},
      params.total_guests || 100,
      params.menu_id
    );
  }

  _handleQuote(params) {
    const quote = generateQuote({
      eventDate: params.event_date,
      guestCount: params.guest_count || 100,
      serviceStyle: params.service_style || "plated",
      tier: params.tier || "premium",
      region: params.region || "Greater Boston",
      menuId: params.menu_id,
      addOns: params.add_ons,
      dietaryBreakdown: params.dietary_breakdown,
      kidsCount: params.kids_count || 0,
    });

    if (quote.quote_id) {
      this.activeQuotes[quote.quote_id] = quote;
      this.negotiationState[quote.quote_id] = 0;
    }

    // Strip internal data
    const publicQuote = {};
    for (const [k, v] of Object.entries(quote)) {
      if (!k.startsWith("_")) publicQuote[k] = v;
    }
    return publicQuote;
  }

  _handleRfp(params) {
    const eventDate = params.event_date;
    const guestCount = params.guest_count || 100;
    const region = params.region || "Greater Boston";
    const serviceStyle = params.service_style || "plated";
    const budgetPerHead = params.budget_per_head;
    const dietaryNeeds = params.dietary_needs;

    // Step 1: Check availability
    const avail = checkAvailability(eventDate, guestCount, region, serviceStyle);
    if (!avail.available) {
      return {
        rfp_status: "unavailable",
        availability: avail,
        message: "Unfortunately we cannot accommodate this event.",
      };
    }

    // Step 2: Recommend tier based on budget
    let recommendedTier = "premium";
    if (budgetPerHead) {
      for (const tierName of ["standard", "premium", "luxury"]) {
        const price = (CONFIG.BASE_PRICING[serviceStyle] || {})[tierName] || 0;
        if (price <= budgetPerHead) {
          recommendedTier = tierName;
        }
      }
    }

    // Step 3: Get matching menus
    const menus = getMenus({ tier: recommendedTier, dietaryNeeds });

    // Step 4: Generate quote
    const quote = generateQuote({
      eventDate,
      guestCount,
      serviceStyle,
      tier: recommendedTier,
      region,
      dietaryBreakdown: params.dietary_breakdown,
      kidsCount: params.kids_count || 0,
    });

    if (quote.quote_id) {
      this.activeQuotes[quote.quote_id] = quote;
      this.negotiationState[quote.quote_id] = 0;
    }

    const publicQuote = {};
    for (const [k, v] of Object.entries(quote)) {
      if (!k.startsWith("_")) publicQuote[k] = v;
    }

    // Budget fit analysis
    let budgetFit = null;
    if (budgetPerHead) {
      const effective = quote.effective_per_head || 0;
      if (effective <= budgetPerHead) {
        budgetFit = "within_budget";
      } else if (effective <= budgetPerHead * 1.1) {
        budgetFit = "slightly_over";
      } else {
        budgetFit = "over_budget";
      }
    }

    return {
      rfp_status: "proposal_ready",
      availability: avail,
      recommended_tier: recommendedTier,
      menus: menus.menus.slice(0, 3),
      quote: publicQuote,
      budget_fit: budgetFit,
      message:
        `Great news! We're available on ${eventDate} for ${guestCount} guests. ` +
        `We recommend our ${recommendedTier} ${serviceStyle} package. ` +
        `See the attached quote and menu options.`,
    };
  }

  _handleNegotiate(params, context) {
    const quoteId = params.quote_id || context.quote_id;
    if (!quoteId || !this.activeQuotes[quoteId]) {
      return { error: "Quote not found. Please generate a quote first." };
    }

    const originalQuote = this.activeQuotes[quoteId];
    this.negotiationState[quoteId] = (this.negotiationState[quoteId] || 0) + 1;
    const currentRound = this.negotiationState[quoteId];

    return applyNegotiation({
      originalQuote,
      requestedTotal: params.requested_total,
      requestedPerHead: params.requested_per_head,
      negotiationRound: currentRound,
      eventDate: originalQuote.event_date,
      addOnsOffered: params.add_ons_offered,
    });
  }

  _handleHold(params) {
    return holdDate({
      eventDate: params.event_date,
      guestCount: params.guest_count || 100,
      quoteId: params.quote_id || "",
      plannerAgentId: params.planner_agent_id || "couple-planner",
      holdDays: params.hold_days || 7,
    });
  }

  _handleConfirm(params) {
    return confirmBooking({
      holdId: params.hold_id,
      quoteId: params.quote_id,
      finalGuestCount: params.final_guest_count || 100,
      menuId: params.menu_id || "italian_classic",
      serviceStyle: params.service_style || "plated",
      depositReceived: params.deposit_received || false,
      contractSigned: params.contract_signed || false,
      specialNotes: params.special_notes,
    });
  }

  _response(intent, status, data) {
    return {
      vendor: CONFIG.VENDOR_NAME,
      vendor_id: CONFIG.VENDOR_ID,
      intent,
      status,
      data,
    };
  }
}


// ============================================================================
// COUPLE AGENT (Planner) — Orchestrates the 6-step simulation
// ============================================================================

class CoupleAgent {
  constructor(preferences) {
    this.preferences = preferences;
    this.eventDate = "2027-06-14"; // Fixed: Saturday June 14, 2027
    this.region = "Greater Boston";
  }

  /**
   * Run the full 6-step simulation and return an array of step objects.
   * Each step: { step, from, label, summary, data }
   */
  runSimulation() {
    const caterer = new CatererAgent();
    const steps = [];
    let quoteId = null;
    let holdId = null;
    let negotiatedTotal = null;
    let selectedMenuId = null;

    const {
      budget,
      guestCount,
      serviceStyle = "plated",
      dietaryNeeds = [],
      addOns = [],
    } = this.preferences;

    const budgetPerHead = Math.round((budget / guestCount) * 100) / 100;

    // ── STEP 1: Discover Vendor Capabilities ──────────────────────
    const discoverResponse = caterer.handleMessage({
      intent: "discover",
      params: {},
    });

    steps.push({
      step: 1,
      from: "couple",
      label: "Discover Vendor",
      summary: `The couple's planner agent discovers ${CONFIG.VENDOR_NAME} on the Altara marketplace and requests its capabilities.`,
      data: {
        request: { intent: "discover" },
        response: discoverResponse,
      },
    });

    // ── STEP 2: Submit RFP ────────────────────────────────────────
    // Build dietary breakdown: distribute dietary needs evenly across ~15% of guests
    const dietaryBreakdown = {};
    if (dietaryNeeds.length > 0) {
      const dietaryGuestsTotal = Math.round(guestCount * 0.15);
      const perNeed = Math.max(1, Math.round(dietaryGuestsTotal / dietaryNeeds.length));
      for (const need of dietaryNeeds) {
        const key = need.toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
        dietaryBreakdown[key] = perNeed;
      }
    }

    const rfpParams = {
      event_date: this.eventDate,
      guest_count: guestCount,
      region: this.region,
      service_style: serviceStyle,
      budget_per_head: budgetPerHead,
      dietary_needs: dietaryNeeds,
      dietary_breakdown: Object.keys(dietaryBreakdown).length > 0 ? dietaryBreakdown : undefined,
      add_ons: addOns.length > 0 ? addOns : undefined,
    };

    const rfpResponse = caterer.handleMessage({
      intent: "rfp",
      params: rfpParams,
    });

    quoteId = rfpResponse.data?.quote?.quote_id || null;
    const rfpTotal = rfpResponse.data?.quote?.total || 0;
    const rfpPerHead = rfpResponse.data?.quote?.effective_per_head || 0;
    const budgetFit = rfpResponse.data?.budget_fit;

    steps.push({
      step: 2,
      from: "caterer",
      label: "RFP Response",
      summary:
        `${CONFIG.VENDOR_NAME} responds with a ${rfpResponse.data?.recommended_tier || "premium"}-tier proposal at $${rfpTotal.toLocaleString("en-US")} total ($${rfpPerHead}/head). ` +
        `Budget status: ${budgetFit || "N/A"}.`,
      data: {
        request: { intent: "rfp", params: rfpParams },
        response: rfpResponse,
      },
    });

    // ── STEP 3: Negotiate (up to 3 rounds if over budget) ─────────
    let needsNegotiation = budgetFit === "over_budget" || budgetFit === "slightly_over";
    let negotiationSteps = [];
    let currentBestTotal = rfpTotal;
    let round = 0;
    const maxNegotiationRounds = 3;

    if (needsNegotiation && quoteId) {
      while (round < maxNegotiationRounds) {
        round++;

        // Couple's strategy: aim for budget, then inch up each round
        let targetTotal;
        if (round === 1) {
          targetTotal = budget; // First ask: hit the budget exactly
        } else if (round === 2) {
          targetTotal = Math.round(budget * 1.05); // Second ask: 5% over budget
        } else {
          targetTotal = Math.round(budget * 1.08); // Third ask: 8% over budget
        }

        const negotiateResponse = caterer.handleMessage({
          intent: "negotiate",
          params: {
            quote_id: quoteId,
            requested_total: targetTotal,
            add_ons_offered: addOns.length >= 2 ? addOns : undefined,
          },
          context: { quote_id: quoteId },
        });

        const decision = negotiateResponse.data?.decision;
        const counterTotal = negotiateResponse.data?.counter_total;
        const acceptedTotal = negotiateResponse.data?.accepted_total;

        let roundSummary;
        if (decision === "accept") {
          currentBestTotal = acceptedTotal || targetTotal;
          roundSummary =
            `Round ${round}: The couple offers $${targetTotal.toLocaleString("en-US")} and ${CONFIG.VENDOR_NAME} accepts at $${currentBestTotal.toLocaleString("en-US")}.`;
          negotiationSteps.push({
            round,
            couple_offer: targetTotal,
            decision,
            result_total: currentBestTotal,
            sweeteners: negotiateResponse.data?.sweeteners || [],
          });
          break;
        } else if (decision === "counter") {
          currentBestTotal = counterTotal;
          roundSummary =
            `Round ${round}: The couple offers $${targetTotal.toLocaleString("en-US")}; vendor counters at $${counterTotal.toLocaleString("en-US")} ($${negotiateResponse.data?.counter_per_head}/head).`;
          negotiationSteps.push({
            round,
            couple_offer: targetTotal,
            decision,
            result_total: counterTotal,
            sweeteners: negotiateResponse.data?.sweeteners || [],
          });
        } else {
          roundSummary = `Round ${round}: Negotiation reached its limit.`;
          negotiationSteps.push({
            round,
            couple_offer: targetTotal,
            decision: decision || "reject",
            result_total: currentBestTotal,
            sweeteners: [],
          });
          break;
        }
      }

      negotiatedTotal = currentBestTotal;
    } else {
      negotiatedTotal = rfpTotal;
    }

    const allSweeteners = negotiationSteps.flatMap((s) => s.sweeteners);
    const uniqueSweeteners = [...new Set(allSweeteners)];

    steps.push({
      step: 3,
      from: needsNegotiation ? "couple" : "couple",
      label: "Negotiate",
      summary: needsNegotiation
        ? `The couple negotiated over ${negotiationSteps.length} round(s), moving from $${rfpTotal.toLocaleString("en-US")} to $${negotiatedTotal.toLocaleString("en-US")}. ` +
          (uniqueSweeteners.length > 0
            ? `Sweeteners offered: ${uniqueSweeteners.join("; ")}.`
            : "No sweeteners offered.")
        : `The proposal is within budget at $${rfpTotal.toLocaleString("en-US")} -- no negotiation needed.`,
      data: {
        needed: needsNegotiation,
        rounds: negotiationSteps,
        original_total: rfpTotal,
        final_total: negotiatedTotal,
        sweeteners: uniqueSweeteners,
      },
    });

    // ── STEP 4: Select Menu Based on Dietary Needs ────────────────
    const availableMenus = rfpResponse.data?.menus || [];
    // Pick the first menu that has good dietary compatibility, or fallback to first
    selectedMenuId = availableMenus.length > 0 ? availableMenus[0].id : "italian_classic";

    // If there are dietary needs, pick the menu with best compatibility
    if (dietaryNeeds.length > 0 && availableMenus.length > 1) {
      let bestScore = -1;
      for (const menu of availableMenus) {
        const compat = menu.dietary_compatibility || {};
        const score = Object.values(compat).filter((c) => c.supported).length;
        if (score > bestScore) {
          bestScore = score;
          selectedMenuId = menu.id;
        }
      }
    }

    const selectedMenuTemplate = CONFIG.MENU_TEMPLATES[selectedMenuId] || availableMenus[0];

    // Apply dietary filtering to the selected menu
    const menuFilterResult = filterMenuForDietary(
      selectedMenuTemplate.courses || selectedMenuTemplate.courses,
      dietaryNeeds
    );
    const filteredMenu = {
      ...selectedMenuTemplate,
      courses: menuFilterResult.courses,
    };

    // Run dietary accommodation check
    const dietaryResult =
      Object.keys(dietaryBreakdown).length > 0
        ? accommodateDietary(dietaryBreakdown, guestCount, selectedMenuId)
        : { feasible: true, accommodations: [], total_dietary_upcharge: 0, recommendations: [], warnings: [] };

    // Build summary with what changed
    const remCount = menuFilterResult.removed.length;
    const subCount = menuFilterResult.substituted.length;
    let menuAdaptNote = "";
    if (remCount > 0) {
      menuAdaptNote = ` ${remCount} dish(es) removed and ${subCount} substitution(s) made to comply with dietary restrictions.`;
    }

    steps.push({
      step: 4,
      from: "couple",
      label: "Select Menu",
      summary:
        `The couple selects the "${filteredMenu?.name || selectedMenuId}" menu` +
        (dietaryNeeds.length > 0
          ? ` with ${dietaryNeeds.join(", ")} accommodations.${menuAdaptNote} ` +
            (dietaryResult.feasible
              ? `All dietary needs are feasible${dietaryResult.total_dietary_upcharge > 0 ? ` (upcharge: $${dietaryResult.total_dietary_upcharge})` : ""}.`
              : `Warning: some dietary needs cannot be fully accommodated.`)
          : "."),
      data: {
        selected_menu_id: selectedMenuId,
        selected_menu: filteredMenu,
        original_courses: selectedMenuTemplate.courses,
        adapted_courses: menuFilterResult.courses,
        dishes_removed: menuFilterResult.removed,
        dishes_substituted: menuFilterResult.substituted,
        dietary_analysis: dietaryResult,
        available_menus: availableMenus.map((m) => ({ id: m.id, name: m.name, tier: m.tier })),
      },
    });

    // ── STEP 5: Hold the Date ─────────────────────────────────────
    const holdResponse = caterer.handleMessage({
      intent: "hold_date",
      params: {
        event_date: this.eventDate,
        guest_count: guestCount,
        quote_id: quoteId,
        planner_agent_id: "couple-planner",
        hold_days: 7,
      },
    });

    holdId = holdResponse.data?.hold_id || null;

    steps.push({
      step: 5,
      from: "caterer",
      label: "Hold Date",
      summary:
        holdResponse.data?.status === "held"
          ? `${CONFIG.VENDOR_NAME} places a 7-day hold on ${this.eventDate}. The couple has until ${(holdResponse.data?.expires || "").slice(0, 10)} to confirm with a 25% deposit ($${Math.round((negotiatedTotal || rfpTotal) * 0.25).toLocaleString("en-US")}).`
          : `Hold request failed: ${holdResponse.data?.message || "unknown error"}.`,
      data: {
        request: {
          intent: "hold_date",
          event_date: this.eventDate,
          guest_count: guestCount,
        },
        response: holdResponse,
      },
    });

    // ── STEP 6: Confirm Booking ───────────────────────────────────
    const confirmResponse = caterer.handleMessage({
      intent: "confirm_booking",
      params: {
        hold_id: holdId,
        quote_id: quoteId,
        final_guest_count: guestCount,
        menu_id: selectedMenuId,
        service_style: serviceStyle,
        deposit_received: true,
        contract_signed: true,
        special_notes: dietaryNeeds.length > 0
          ? `Dietary accommodations required: ${dietaryNeeds.join(", ")}`
          : null,
      },
    });

    steps.push({
      step: 6,
      from: "caterer",
      label: "Confirm Booking",
      summary:
        confirmResponse.data?.status === "confirmed"
          ? `Booking confirmed! ${CONFIG.VENDOR_NAME} is locked in for ${this.eventDate} with ${guestCount} guests. ` +
            `Booking ID: ${confirmResponse.data?.booking_id}. Contact: ${confirmResponse.data?.your_contact?.name} (${confirmResponse.data?.your_contact?.email}).`
          : `Booking confirmation status: ${confirmResponse.data?.status || "unknown"}. ${confirmResponse.data?.message || ""}`,
      data: {
        request: {
          intent: "confirm_booking",
          hold_id: holdId,
          quote_id: quoteId,
          menu_id: selectedMenuId,
        },
        response: confirmResponse,
      },
    });

    return steps;
  }
}


// ============================================================================
// SIMULATION ENTRY POINT
// ============================================================================

/**
 * Run a full wedding catering simulation.
 *
 * @param {Object} preferences
 * @param {number} preferences.budget - Total budget in USD
 * @param {number} preferences.guestCount - Number of guests
 * @param {string} [preferences.serviceStyle="plated"] - Service style
 * @param {string[]} [preferences.dietaryNeeds=[]] - Dietary requirements
 * @param {string[]} [preferences.addOns=[]] - Add-on IDs
 * @returns {Object[]} Array of step objects
 */
function runSimulation(preferences) {
  const agent = new CoupleAgent(preferences);
  return agent.runSimulation();
}


// ============================================================================
// HELPERS
// ============================================================================

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  runSimulation,
  CatererAgent,
  CoupleAgent,
  CONFIG,
  // Individual skills exported for testing
  filterMenuForDietary,
  checkAvailability,
  getMenus,
  accommodateDietary,
  generateQuote,
  applyNegotiation,
  holdDate,
  confirmBooking,
};
