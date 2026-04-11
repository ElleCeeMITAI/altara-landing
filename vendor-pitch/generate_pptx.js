const pptxgen = require("pptxgenjs");
const path = require("path");

const ROSE = "C4636E";
const CREAM = "FAF7F2";
const DARK = "2C2C2C";
const SECONDARY = "4A4A4A";
const WHITE = "FFFFFF";
const LIGHT_ROSE = "F5E6E8";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "The Big Day";
pptx.title = "The Big Day — Vendor Partnership Program";

// Helper: add rose accent bar at top of slide
function addAccentBar(slide) {
  slide.background = { color: CREAM };
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: "100%", h: 0.4,
    fill: { color: ROSE },
  });
}

// Helper: add slide title
function addTitle(slide, text, opts = {}) {
  slide.addText(text, {
    x: 0.6, y: 0.6, w: 11.5, h: 0.7,
    fontSize: 28, fontFace: "Calibri",
    color: ROSE, bold: true,
    ...opts,
  });
}

// Helper: add body text
function addBody(slide, text, opts = {}) {
  slide.addText(text, {
    x: 0.6, y: 1.5, w: 11.5, h: 5,
    fontSize: 14, fontFace: "Calibri",
    color: DARK, valign: "top",
    lineSpacingMultiple: 1.3,
    ...opts,
  });
}

// ── Slide 1: Title ──
(() => {
  const slide = pptx.addSlide();
  slide.background = { color: CREAM };
  // Large rose bar
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: "100%", h: 1.2,
    fill: { color: ROSE },
  });
  slide.addText("The Big Day", {
    x: 0.6, y: 1.6, w: 11.5, h: 1.0,
    fontSize: 48, fontFace: "Calibri",
    color: ROSE, bold: true,
  });
  slide.addText("Vendor Partnership Program", {
    x: 0.6, y: 2.6, w: 11.5, h: 0.6,
    fontSize: 24, fontFace: "Calibri",
    color: DARK,
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.6, y: 3.4, w: 2, h: 0.05,
    fill: { color: ROSE },
  });
  slide.addText("Stop Selling. Start Creating.", {
    x: 0.6, y: 3.7, w: 11.5, h: 0.5,
    fontSize: 20, fontFace: "Calibri",
    color: SECONDARY, italic: true,
  });
  slide.addText("Your AI agent handles unlimited negotiations simultaneously\nwhile you focus on what you do best.", {
    x: 0.6, y: 4.5, w: 11.5, h: 0.8,
    fontSize: 14, fontFace: "Calibri",
    color: SECONDARY, lineSpacingMultiple: 1.4,
  });
})();

// ── Slide 2: The Problem ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "Wedding vendors spend more time selling than creating.");

  const bullets = [
    "Receives 50-100 inquiry emails per week during peak season",
    "Spends 8-12 hours per booking on responses, consultations, follow-ups",
    "Converts only 15-20% of inquiries into bookings",
    "The other 80% ghost after the first quote — hours wasted",
    "Pays The Knot / WeddingWire $200-400/month whether they book or not",
    "Manually tracks holds, deposits, and cancellations in spreadsheets",
  ];

  slide.addText("The average Boston wedding vendor:", {
    x: 0.6, y: 1.4, w: 11.5, h: 0.4,
    fontSize: 16, fontFace: "Calibri", bold: true, color: DARK,
  });

  slide.addText(
    bullets.map(b => ({ text: b, options: { bullet: true, indentLevel: 0 } })),
    {
      x: 0.8, y: 1.9, w: 11, h: 3.2,
      fontSize: 13, fontFace: "Calibri", color: DARK,
      lineSpacingMultiple: 1.5,
      paraSpaceAfter: 4,
    }
  );

  // Callout box
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 5.2, w: 11.5, h: 0.8,
    fill: { color: LIGHT_ROSE },
    rectRadius: 0.1,
  });
  slide.addText("For every wedding you book, you waste 40+ hours on couples who never hire you.", {
    x: 0.8, y: 5.3, w: 11.1, h: 0.6,
    fontSize: 15, fontFace: "Calibri", bold: true, color: ROSE,
    align: "center",
  });
})();

// ── Slide 3: The Solution ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "Your AI Vendor Agent");
  slide.addText("Always on, always selling, always you.", {
    x: 0.6, y: 1.2, w: 11.5, h: 0.4,
    fontSize: 16, fontFace: "Calibri", italic: true, color: SECONDARY,
  });

  // Left column box
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 1.9, w: 5.5, h: 4.0,
    fill: { color: WHITE }, rectRadius: 0.1,
    line: { color: ROSE, width: 1.5 },
  });
  slide.addText("You set it up once:", {
    x: 0.8, y: 2.0, w: 5.1, h: 0.4,
    fontSize: 15, fontFace: "Calibri", bold: true, color: ROSE,
  });
  const leftItems = [
    "Your pricing, packages, and price floors",
    "Your negotiation style and flexibility",
    "Your sweeteners and value-adds",
    "Your service area, lead time, and availability",
  ];
  slide.addText(
    leftItems.map(t => ({ text: t, options: { bullet: true } })),
    {
      x: 1.0, y: 2.5, w: 4.9, h: 3.0,
      fontSize: 13, fontFace: "Calibri", color: DARK,
      lineSpacingMultiple: 1.6,
    }
  );

  // Right column box
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.6, y: 1.9, w: 5.5, h: 4.0,
    fill: { color: WHITE }, rectRadius: 0.1,
    line: { color: ROSE, width: 1.5 },
  });
  slide.addText("Your agent does the rest:", {
    x: 6.8, y: 2.0, w: 5.1, h: 0.4,
    fontSize: 15, fontFace: "Calibri", bold: true, color: ROSE,
  });
  const rightItems = [
    "Responds to qualified inquiries instantly",
    "Negotiates within your parameters",
    "Highlights your strengths, reviews, and partnerships",
    "Holds dates and manages deposit timelines",
    "Sends you only serious, ready-to-book couples",
  ];
  slide.addText(
    rightItems.map(t => ({ text: t, options: { bullet: true } })),
    {
      x: 6.8, y: 2.5, w: 5.1, h: 3.0,
      fontSize: 13, fontFace: "Calibri", color: DARK,
      lineSpacingMultiple: 1.5,
    }
  );
})();

// ── Slide 4: How It Works ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "From inquiry to booking in 4 steps");

  const steps = [
    { num: "1", title: "Couple Tells Their Planner", desc: '"We want a romantic garden wedding in Boston, $35K budget, 120 guests, June 2027"' },
    { num: "2", title: "Planner Agent Finds You", desc: "Matched based on style, budget, location, availability, and ratings" },
    { num: "3", title: "Your Agent Negotiates", desc: "Presents packages, counters offers, offers sweeteners — all within your rules" },
    { num: "4", title: "You Confirm the Booking", desc: "Couple reviews your website, you confirm, deposit is collected. Done." },
  ];

  steps.forEach((s, i) => {
    const xPos = 0.5 + i * 3.0;
    // Number circle
    slide.addShape(pptx.shapes.OVAL, {
      x: xPos + 0.8, y: 1.6, w: 0.6, h: 0.6,
      fill: { color: ROSE },
    });
    slide.addText(s.num, {
      x: xPos + 0.8, y: 1.6, w: 0.6, h: 0.6,
      fontSize: 18, fontFace: "Calibri", bold: true,
      color: WHITE, align: "center", valign: "middle",
    });
    // Step title
    slide.addText(s.title, {
      x: xPos, y: 2.4, w: 2.8, h: 0.5,
      fontSize: 13, fontFace: "Calibri", bold: true,
      color: DARK, align: "center",
    });
    // Step desc
    slide.addText(s.desc, {
      x: xPos, y: 2.9, w: 2.8, h: 1.8,
      fontSize: 11, fontFace: "Calibri",
      color: SECONDARY, align: "center",
      lineSpacingMultiple: 1.3,
    });
  });

  // Bottom callout
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1.5, y: 5.2, w: 9.7, h: 0.6,
    fill: { color: LIGHT_ROSE }, rectRadius: 0.1,
  });
  slide.addText("You only hear about it when there's a real booking on the table.", {
    x: 1.5, y: 5.2, w: 9.7, h: 0.6,
    fontSize: 14, fontFace: "Calibri", bold: true,
    color: ROSE, align: "center", valign: "middle",
  });
})();

// ── Slide 5: Comparison Table ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "What Makes This Different");

  const rows = [
    [{ text: "", options: { fill: ROSE } }, { text: "The Knot / WeddingWire", options: { bold: true, color: WHITE, fill: ROSE, align: "center" } }, { text: "The Big Day", options: { bold: true, color: WHITE, fill: ROSE, align: "center" } }],
    [{ text: "Cost", options: { bold: true } }, "$200-400/month flat fee", "Free to list. Pay only on booking (5-8%)"],
    [{ text: "Leads", options: { bold: true } }, "Raw inquiries — you sell", "Pre-qualified, ready to book"],
    [{ text: "Time per booking", options: { bold: true } }, "8-12 hours", "30 minutes"],
    [{ text: "Availability", options: { bold: true } }, "When you can respond", "24/7 instant response"],
    [{ text: "Simultaneous inquiries", options: { bold: true } }, "Limited by bandwidth", "Unlimited"],
    [{ text: "Market intelligence", options: { bold: true } }, "None", "Anonymized pricing data"],
    [{ text: "Hold management", options: { bold: true } }, "Manual tracking", "Automated deadlines"],
    [{ text: "Couple matching", options: { bold: true } }, "Couples browse listings", "AI matches couples to you"],
  ];

  slide.addTable(rows, {
    x: 0.6, y: 1.5, w: 11.5,
    fontSize: 11, fontFace: "Calibri",
    color: DARK,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [2.5, 4.5, 4.5],
    rowH: 0.45,
    autoPage: false,
  });
})();

// ── Slide 6: Vendor Agent Setup ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "30 minutes to set up. Then it works forever.");

  const steps = [
    { title: "Create Your Profile (10 min)", items: "Business name, location, photos, website, social links. Pre-populate from existing Knot listing." },
    { title: "Set Your Pricing (10 min)", items: "Packages, price floors, seasonal pricing, deposit terms, cancellation policy." },
    { title: "Negotiation Style (5 min)", items: "Flexibility level, max discount, tactics (add value, seasonal swaps, bundles), sweeteners." },
    { title: "Set Preferences (5 min)", items: "Service area, travel surcharges, lead time, max events per weekend, venue partnerships." },
  ];

  steps.forEach((s, i) => {
    const yPos = 1.5 + i * 1.1;
    // Step number box
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: yPos, w: 0.5, h: 0.5,
      fill: { color: ROSE }, rectRadius: 0.05,
    });
    slide.addText(`${i + 1}`, {
      x: 0.6, y: yPos, w: 0.5, h: 0.5,
      fontSize: 16, fontFace: "Calibri", bold: true,
      color: WHITE, align: "center", valign: "middle",
    });
    slide.addText(s.title, {
      x: 1.3, y: yPos, w: 4, h: 0.4,
      fontSize: 14, fontFace: "Calibri", bold: true, color: DARK,
    });
    slide.addText(s.items, {
      x: 1.3, y: yPos + 0.4, w: 10.5, h: 0.5,
      fontSize: 12, fontFace: "Calibri", color: SECONDARY,
    });
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 5.6, w: 11.5, h: 0.5,
    fill: { color: LIGHT_ROSE }, rectRadius: 0.1,
  });
  slide.addText("Your agent is live. It starts receiving matched inquiries immediately.", {
    x: 0.6, y: 5.6, w: 11.5, h: 0.5,
    fontSize: 13, fontFace: "Calibri", bold: true, color: ROSE, align: "center", valign: "middle",
  });
})();

// ── Slide 7: Smart Matching ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "We only send you couples who actually fit.");

  const filters = [
    { label: "Budget match", desc: "Their budget allocation fits your pricing" },
    { label: "Date match", desc: "Their date works with your lead time and availability" },
    { label: "Location match", desc: "Their venue is within your service radius" },
    { label: "Style match", desc: "Their aesthetic preferences align with your specialties" },
    { label: "Rating threshold", desc: "They meet your minimums (and you meet theirs)" },
  ];

  filters.forEach((f, i) => {
    const yPos = 1.6 + i * 0.7;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 1.5, y: yPos, w: 9.7, h: 0.55,
      fill: { color: i % 2 === 0 ? WHITE : LIGHT_ROSE }, rectRadius: 0.05,
      line: { color: "E0D5D5", width: 0.5 },
    });
    slide.addText(f.label, {
      x: 1.7, y: yPos + 0.05, w: 2.5, h: 0.45,
      fontSize: 13, fontFace: "Calibri", bold: true, color: ROSE, valign: "middle",
    });
    slide.addText(f.desc, {
      x: 4.2, y: yPos + 0.05, w: 6.8, h: 0.45,
      fontSize: 12, fontFace: "Calibri", color: DARK, valign: "middle",
    });
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1.5, y: 5.3, w: 9.7, h: 0.6,
    fill: { color: LIGHT_ROSE }, rectRadius: 0.1,
  });
  slide.addText("Every inquiry your agent handles is a real opportunity, not a tire-kicker.", {
    x: 1.5, y: 5.3, w: 9.7, h: 0.6,
    fontSize: 14, fontFace: "Calibri", bold: true, color: ROSE, align: "center", valign: "middle",
  });
})();

// ── Slide 8: Ratings & Reputation ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "Your Reputation Works For You");

  slide.addText("Three-layer rating system:", {
    x: 0.6, y: 1.4, w: 11.5, h: 0.4,
    fontSize: 16, fontFace: "Calibri", bold: true, color: DARK,
  });

  const layers = [
    { num: "1", title: "Platform Ratings", desc: "Verified reviews from couples who booked through The Big Day (weighted highest)" },
    { num: "2", title: "External Ratings", desc: "Aggregated from Google, Yelp, The Knot, WeddingWire" },
    { num: "3", title: "Composite Score", desc: "Blended score that couples see when reviewing packages" },
  ];

  layers.forEach((l, i) => {
    const yPos = 2.0 + i * 0.8;
    slide.addShape(pptx.shapes.OVAL, {
      x: 1.0, y: yPos, w: 0.5, h: 0.5,
      fill: { color: ROSE },
    });
    slide.addText(l.num, {
      x: 1.0, y: yPos, w: 0.5, h: 0.5,
      fontSize: 16, fontFace: "Calibri", bold: true,
      color: WHITE, align: "center", valign: "middle",
    });
    slide.addText(l.title, {
      x: 1.7, y: yPos, w: 3, h: 0.5,
      fontSize: 14, fontFace: "Calibri", bold: true, color: DARK, valign: "middle",
    });
    slide.addText(l.desc, {
      x: 4.7, y: yPos, w: 7, h: 0.5,
      fontSize: 12, fontFace: "Calibri", color: SECONDARY, valign: "middle",
    });
  });

  // Flywheel
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 4.5, w: 11.5, h: 1.2,
    fill: { color: WHITE }, rectRadius: 0.1,
    line: { color: ROSE, width: 1.5 },
  });
  slide.addText("The Flywheel", {
    x: 0.8, y: 4.6, w: 11.1, h: 0.4,
    fontSize: 14, fontFace: "Calibri", bold: true, color: ROSE,
  });
  slide.addText("More bookings  →  more verified reviews  →  higher composite score  →  more matches  →  more bookings", {
    x: 0.8, y: 5.0, w: 11.1, h: 0.5,
    fontSize: 13, fontFace: "Calibri", color: DARK, align: "center",
  });
})();

// ── Slide 9: Pricing ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "You Only Pay When You Win");

  const rows = [
    [
      { text: "", options: { fill: ROSE } },
      { text: "Free", options: { bold: true, color: WHITE, fill: ROSE, align: "center" } },
      { text: "Founding Vendor", options: { bold: true, color: WHITE, fill: ROSE, align: "center" } },
      { text: "Premium", options: { bold: true, color: WHITE, fill: ROSE, align: "center" } },
    ],
    [{ text: "Listing", options: { bold: true } }, "Free", "Free", "Free"],
    [{ text: "Agent setup", options: { bold: true } }, "Free", "Free", "Free"],
    [{ text: "Commission", options: { bold: true } }, "5-8%", "0% for 6 months, then 5%", "5-8%"],
    [{ text: "Analytics", options: { bold: true } }, "Basic", "Premium (free 1 year)", "Basic"],
    [{ text: "Badge", options: { bold: true } }, "Standard", '"Founding Vendor" (permanent)', "Standard"],
    [{ text: "Priority matching", options: { bold: true } }, "No", "Yes (6 months)", "Available ($49/mo)"],
  ];

  slide.addTable(rows, {
    x: 0.6, y: 1.5, w: 11.5,
    fontSize: 11, fontFace: "Calibri",
    color: DARK,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [2.5, 2.5, 3.5, 3.0],
    rowH: 0.45,
    autoPage: false,
  });

  // Founding vendor highlight
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 4.8, w: 11.5, h: 1.4,
    fill: { color: LIGHT_ROSE }, rectRadius: 0.1,
  });
  slide.addText("Founding Vendor Program — First 50 vendors per category in Boston", {
    x: 0.8, y: 4.9, w: 11.1, h: 0.4,
    fontSize: 14, fontFace: "Calibri", bold: true, color: ROSE,
  });
  const fvBenefits = [
    "0% commission for the first 6 months",
    "Permanent \"Founding Vendor\" badge",
    "Free premium analytics for 1 year",
    "Direct input into platform features",
    "Priority matching for 6 months",
  ];
  slide.addText(
    fvBenefits.map(t => ({ text: t, options: { bullet: true } })),
    {
      x: 1.0, y: 5.3, w: 10.5, h: 0.9,
      fontSize: 11, fontFace: "Calibri", color: DARK,
      lineSpacingMultiple: 1.2,
    }
  );
})();

// ── Slide 10: The Math ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "What The Big Day Saves You");

  // Current cost table
  slide.addText("Current cost of acquiring a booking:", {
    x: 0.6, y: 1.4, w: 5.5, h: 0.4,
    fontSize: 14, fontFace: "Calibri", bold: true, color: DARK,
  });
  const currentRows = [
    [{ text: "Item", options: { bold: true, color: WHITE, fill: ROSE } }, { text: "Cost", options: { bold: true, color: WHITE, fill: ROSE, align: "right" } }],
    ["The Knot monthly listing", "$3,600/year"],
    ["Your time (8-12 hrs at $50/hr)", "$400-600/booking"],
    ["Wasted time on non-converts (80%)", "~$2,000/year"],
    [{ text: "Total annual sales overhead", options: { bold: true } }, { text: "$6,000-8,000+", options: { bold: true } }],
  ];
  slide.addTable(currentRows, {
    x: 0.6, y: 1.9, w: 5.3,
    fontSize: 11, fontFace: "Calibri", color: DARK,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [3.3, 2.0], rowH: 0.38,
  });

  // Big Day cost table
  slide.addText("With The Big Day:", {
    x: 6.4, y: 1.4, w: 5.5, h: 0.4,
    fontSize: 14, fontFace: "Calibri", bold: true, color: ROSE,
  });
  const newRows = [
    [{ text: "Item", options: { bold: true, color: WHITE, fill: ROSE } }, { text: "Cost", options: { bold: true, color: WHITE, fill: ROSE, align: "right" } }],
    ["Listing", "$0"],
    ["Your time (30 min/booking)", "$25/booking"],
    ["Commission (6% on $3K avg)", "$180/booking"],
    [{ text: "Total cost per booking", options: { bold: true } }, { text: "$205", options: { bold: true } }],
  ];
  slide.addTable(newRows, {
    x: 6.4, y: 1.9, w: 5.3,
    fontSize: 11, fontFace: "Calibri", color: DARK,
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    colW: [3.3, 2.0], rowH: 0.38,
  });

  // Summary
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 4.2, w: 11.5, h: 0.7,
    fill: { color: WHITE }, rectRadius: 0.1,
    line: { color: ROSE, width: 1.5 },
  });
  slide.addText("20 weddings/year:  Old way = $6,000-8,000  |  The Big Day = $4,100 + 400 hours back", {
    x: 0.8, y: 4.2, w: 11.1, h: 0.7,
    fontSize: 14, fontFace: "Calibri", bold: true, color: DARK, align: "center", valign: "middle",
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 1.5, y: 5.2, w: 9.7, h: 0.8,
    fill: { color: LIGHT_ROSE }, rectRadius: 0.1,
  });
  slide.addText("The real value isn't the money — it's the time.\nThose 400 hours are hours for design, creativity, family, or more weddings.", {
    x: 1.7, y: 5.2, w: 9.3, h: 0.8,
    fontSize: 13, fontFace: "Calibri", bold: true, color: ROSE, align: "center", valign: "middle",
    lineSpacingMultiple: 1.3,
  });
})();

// ── Slide 11: Launch Plan ──
(() => {
  const slide = pptx.addSlide();
  addAccentBar(slide);
  addTitle(slide, "Starting Local. Starting Now.");

  const phases = [
    {
      title: "Phase 1: Boston Metro",
      subtitle: "30-mile radius",
      items: ["50 founding vendors across 7 categories", "Venues, caterers, photographers, florists, DJs/bands, bakeries, transport", "Greater Boston, Cambridge, North/South Shore"],
    },
    {
      title: "Phase 2: Cape Cod & Rhode Island",
      subtitle: "Natural extension",
      items: ["Natural extension of the Boston wedding market", "Many Boston couples marry on the Cape or in Newport"],
    },
    {
      title: "Phase 3: Southern NH & Beyond",
      subtitle: "Complete New England",
      items: ["Barn weddings, rustic venues, budget-friendly options", "Complete the New England wedding market"],
    },
  ];

  phases.forEach((p, i) => {
    const xPos = 0.5 + i * 4.0;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: xPos, y: 1.6, w: 3.7, h: 4.2,
      fill: { color: WHITE }, rectRadius: 0.1,
      line: { color: ROSE, width: 1.5 },
    });
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: xPos, y: 1.6, w: 3.7, h: 0.6,
      fill: { color: ROSE }, rectRadius: 0.0,
    });
    slide.addText(p.title, {
      x: xPos, y: 1.6, w: 3.7, h: 0.6,
      fontSize: 14, fontFace: "Calibri", bold: true,
      color: WHITE, align: "center", valign: "middle",
    });
    slide.addText(p.subtitle, {
      x: xPos + 0.2, y: 2.3, w: 3.3, h: 0.4,
      fontSize: 12, fontFace: "Calibri", italic: true, color: SECONDARY,
    });
    slide.addText(
      p.items.map(t => ({ text: t, options: { bullet: true } })),
      {
        x: xPos + 0.2, y: 2.8, w: 3.3, h: 2.8,
        fontSize: 11, fontFace: "Calibri", color: DARK,
        lineSpacingMultiple: 1.5,
      }
    );
  });
})();

// ── Slide 12: Call to Action ──
(() => {
  const slide = pptx.addSlide();
  slide.background = { color: CREAM };
  // Full-width rose bar at top
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: "100%", h: 1.2,
    fill: { color: ROSE },
  });
  slide.addText("Join the Waitlist", {
    x: 0, y: 0.2, w: "100%", h: 0.8,
    fontSize: 36, fontFace: "Calibri", bold: true,
    color: WHITE, align: "center", valign: "middle",
  });

  slide.addText("Be one of the first 50. Shape the future of wedding vendor sales.", {
    x: 1.5, y: 1.5, w: 9.7, h: 0.5,
    fontSize: 18, fontFace: "Calibri", color: DARK, align: "center",
  });

  // Founding Vendor benefits
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 2.5, y: 2.2, w: 7.7, h: 2.5,
    fill: { color: WHITE }, rectRadius: 0.1,
    line: { color: ROSE, width: 1.5 },
  });
  slide.addText("Founding Vendor Benefits", {
    x: 2.7, y: 2.3, w: 7.3, h: 0.4,
    fontSize: 15, fontFace: "Calibri", bold: true, color: ROSE,
  });
  const benefits = [
    "0% commission for 6 months",
    'Permanent "Founding Vendor" badge',
    "Free premium analytics for 1 year",
    "Direct input on platform features",
    "Priority matching",
  ];
  slide.addText(
    benefits.map(t => ({ text: t, options: { bullet: true } })),
    {
      x: 3.0, y: 2.8, w: 6.7, h: 1.8,
      fontSize: 13, fontFace: "Calibri", color: DARK,
      lineSpacingMultiple: 1.5,
    }
  );

  // Contact
  slide.addText("vendors@thebigdayapp.com", {
    x: 1.5, y: 4.9, w: 9.7, h: 0.5,
    fontSize: 18, fontFace: "Calibri", bold: true, color: ROSE, align: "center",
  });

  // Quote
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 5.7, w: "100%", h: 0.8,
    fill: { color: LIGHT_ROSE },
  });
  slide.addText('"Your agent does the selling. You do the creating."', {
    x: 1.5, y: 5.7, w: 9.7, h: 0.8,
    fontSize: 16, fontFace: "Calibri", italic: true, bold: true,
    color: ROSE, align: "center", valign: "middle",
  });
})();

// ── Write the file ──
const outPath = path.join(__dirname, "vendor_pitch_deck.pptx");
pptx.writeFile({ fileName: outPath })
  .then(() => {
    console.log(`Presentation saved to: ${outPath}`);
  })
  .catch((err) => {
    console.error("Error generating PPTX:", err);
    process.exit(1);
  });
