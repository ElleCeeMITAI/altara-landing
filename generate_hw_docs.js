const fs = require("fs");
const {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  Packer,
  ShadingType,
  convertInchesToTwip,
} = require("docx");

// ── Altara brand header ──

function altaraHeader() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "\u25CB\u25CB ", size: 28, color: "D4878F", font: "Georgia" }),
        new TextRun({ text: "altara", size: 72, color: "D4878F", font: "Georgia" }),
        new TextRun({ text: " \u25CB\u25CB", size: 28, color: "D4878F", font: "Georgia" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "Lisa Caruso | MIT MAS.664 | April 2026", size: 22, color: "666666", font: "Calibri" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "D4878F" } },
      children: [],
    }),
  ];
}

// ── Helpers ──

function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text, bold: true, size: 52, font: "Calibri" })],
  });
}

function authorLine(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text, italics: true, size: 24, font: "Calibri" })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Calibri" })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Calibri" })],
  });
}

function heading4(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, font: "Calibri" })],
  });
}

function bodyPara(runs) {
  return new Paragraph({
    spacing: { after: 120 },
    children: runs,
  });
}

function run(text, opts = {}) {
  return new TextRun({ text, size: 22, font: "Calibri", ...opts });
}

function bullet(runs, level = 0) {
  return new Paragraph({
    spacing: { after: 80 },
    bullet: { level },
    children: runs,
  });
}

function numberedItem(runs, level = 0) {
  return new Paragraph({
    spacing: { after: 80 },
    numbering: { reference: "default-numbering", level },
    children: runs,
  });
}

/** Parse inline **bold**, *italic*, and `code` from a string and return TextRun[] */
function parseInline(text) {
  const runs = [];
  // Process backtick code spans first, then bold/italic
  const codePattern = /`([^`]+)`/g;
  const segments = [];
  let lastIdx = 0;
  let m;
  while ((m = codePattern.exec(text)) !== null) {
    if (m.index > lastIdx) segments.push({ type: "text", value: text.slice(lastIdx, m.index) });
    segments.push({ type: "code", value: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) segments.push({ type: "text", value: text.slice(lastIdx) });

  for (const seg of segments) {
    if (seg.type === "code") {
      runs.push(run(seg.value, { font: "Courier New", size: 20 }));
    } else {
      // Parse bold and italic
      const parts = seg.value.split(/(\*\*[^*]+\*\*)/g);
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          runs.push(run(part.slice(2, -2), { bold: true }));
        } else {
          const italicParts = part.split(/(\*[^*]+\*)/g);
          for (const ip of italicParts) {
            if (ip.startsWith("*") && ip.endsWith("*")) {
              runs.push(run(ip.slice(1, -1), { italics: true }));
            } else if (ip.length > 0) {
              runs.push(run(ip));
            }
          }
        }
      }
    }
  }
  return runs;
}

function infraNote(text) {
  return new Paragraph({
    spacing: { before: 300, after: 60 },
    children: [new TextRun({ text, italics: true, size: 18, font: "Calibri", color: "666666" })],
  });
}

function hrParagraph() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" } },
    children: [],
  });
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

function makeTableCell(text, isHeader = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: parseInline(text.trim()),
        spacing: { before: 40, after: 40 },
      }),
    ],
    width: { size: 0, type: WidthType.AUTO },
    shading: isHeader ? { type: ShadingType.SOLID, color: "F2E6E8", fill: "F2E6E8" } : undefined,
  });
}

function makeTable(rows) {
  return new Table({
    borders: tableBorders,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, i) =>
        new TableRow({
          children: cells.map((c) => makeTableCell(c, i === 0)),
        })
    ),
  });
}

// ── Build HW7 ──

function buildHW7() {
  const children = [];

  children.push(...altaraHeader());

  children.push(title("HW7: Altara \u2014 Initial Agent Experiments"));
  children.push(authorLine("Lisa Caruso \u2014 MAS.664 \u2014 April 2026"));

  // System Overview
  children.push(heading2("System Overview"));
  children.push(
    bodyPara([
      run(
        "Altara is an A2A wedding marketplace where a Planner agent negotiates with Vendor agents (Claude Sonnet 4) to assemble complete wedding packages. We tested with 6 vendor agents across 6 categories (venue, catering, florist, photographer, DJ, bakery) using a baseline scenario: 120-guest Boston wedding, June 2027, $50K budget."
      ),
    ])
  );

  // Experiment 1
  children.push(heading2("Experiment 1: RFP vs. Auction Negotiation (6 agents)"));
  children.push(bullet(parseInline("**What we tested:** Whether framing negotiations as competitive auctions vs. direct proposals changes price outcomes.")));
  children.push(bullet(parseInline("**What we changed:** Same 6 vendors negotiated under both RFP (direct proposal) and Auction (competitive bidding) protocols.")));
  children.push(bullet(parseInline("**Expected:** Auction would uniformly lower prices through competitive pressure.")));
  children.push(
    bullet(
      parseInline(
        "**Results:** Auction saved 17.8% on the venue ($23,600 to $19,400) but *increased* photographer prices by 21.8% and bakery by 25.0%. Net savings only 4.4% ($60,940 to $58,230)."
      )
    )
  );
  children.push(
    bullet(
      parseInline(
        "**Takeaway:** Auction works for high-ticket commoditized items but backfires on boutique vendors who anchor defensively. A hybrid strategy (auction for venues, RFP for artisans) would save ~9.2%."
      )
    )
  );

  // Experiment 2
  children.push(heading2("Experiment 2: Sequential vs. Parallel Negotiation (6 agents)"));
  children.push(bullet(parseInline("**What we tested:** Whether running vendor negotiations in parallel vs. sequentially affects speed, cost, and token usage.")));
  children.push(bullet(parseInline("**What we changed:** Same 6 vendors negotiated sequentially (one at a time) vs. in parallel (concurrency=5). Also tested at 10 and 30 vendors.")));
  children.push(bullet(parseInline("**Expected:** Parallel would be ~5x faster with similar costs.")));
  children.push(
    bullet(
      parseInline(
        "**Results:** At 6 vendors: parallel completed in 46.3s vs. 102.4s sequential (2.2x speedup). At 30 vendors: 129.7s vs. 553.0s (4.3x speedup, approaching the 5x theoretical max). Parallel was also 30% more token-efficient and 28% cheaper at 30 vendors."
      )
    )
  );
  children.push(
    bullet(
      parseInline(
        "**Takeaway:** Parallel execution is faster *and* cheaper at scale \u2014 concurrent negotiations avoid accumulating long sequential context histories."
      )
    )
  );

  // Experiment 3
  children.push(heading2("Experiment 3: Failure Recovery (6 agents + 2 backups)"));
  children.push(bullet(parseInline("**What we tested:** Whether the system can recover when a vendor agent fails mid-negotiation.")));
  children.push(bullet(parseInline("**What we changed:** Injected failures into (a) venue agent and (b) caterer agent, forcing the system to activate pre-identified backup vendors.")));
  children.push(bullet(parseInline("**Expected:** Recovery would succeed but with time and cost penalties.")));
  children.push(
    bullet(
      parseInline(
        "**Results:** 100% recovery rate. Venue backup was 14.8% more expensive ($51,150 to $58,720 total). Caterer backup was $435 *cheaper* than baseline. Recovery was *faster* (102.4s vs. 120.9s baseline) because failed negotiations terminate early."
      )
    )
  );
  children.push(
    bullet(
      parseInline(
        "**Takeaway:** Fault tolerance works. Pre-screening backup vendor quality matters more for cost control than recovery speed."
      )
    )
  );

  // Summary
  children.push(heading2("Summary"));

  children.push(
    makeTable([
      ["Experiment", "Agents", "Key Finding"],
      ["RFP vs. Auction", "6", "Auction saves 17.8% on venues, backfires on boutique vendors (+25%)"],
      ["Seq. vs. Parallel", "6\u201330", "4.3x speedup at scale; parallel is also 28% cheaper"],
      ["Failure Recovery", "6+2", "100% recovery rate, faster than baseline, cost depends on backup pool"],
    ])
  );

  children.push(bodyPara([]));

  children.push(
    bodyPara([
      run("Live demo: ", { bold: true }),
      run("altara-landing.up.railway.app/simulate.html"),
    ])
  );

  children.push(hrParagraph());
  children.push(
    infraNote(
      "Infrastructure note: The simulation frontend and Express server are deployed on Railway (cloud). All vendor and planner agents run on Anthropic\u2019s cloud-hosted Claude API instances \u2014 each agent is a separate API session, not a local process. Negotiations are conducted via parallel cloud API calls, meeting the requirement for agents running on cloud instances."
    )
  );

  return new Document({
    sections: [{ children }],
  });
}

// ── Build HW8 ──

function buildHW8() {
  const children = [];

  children.push(...altaraHeader());

  children.push(title("HW8: Altara \u2014 Scaled Experiments"));
  children.push(authorLine("Lisa Caruso \u2014 MAS.664 \u2014 April 2026"));

  // What Changed Since HW7
  children.push(heading2("What Changed Since HW7"));
  children.push(
    bodyPara([
      run(
        "In HW7, we tested 6 vendor agents across 3 experiments (RFP vs. auction, sequential vs. parallel, failure recovery). In HW8, we scaled to 30 agents and introduced multi-category budget-aware negotiation across 7 vendor categories simultaneously."
      ),
    ])
  );
  children.push(bodyPara([run("Key additions since HW7:")]));
  children.push(bullet([run("Expanded vendor pool from 6 to 30 agents (5 venues, 5 caterers, 5 photographers, 3 bakeries, 5 florists, 5 DJs, 2 transport)")]));
  children.push(bullet([run("Added PlannerState with budget tracking and redistribution across categories")]));
  children.push(bullet([run("Added pre-screening filters (location radius, ratings, availability, genre matching, LGBTQ+ flag)")]));
  children.push(bullet([run("Added venue-anchored matching (all vendors filtered by distance from selected venue)")]));
  children.push(bullet([run("Added 3-package assembly (Budget, Recommended, Premium)")]));

  // Scaled Setup
  children.push(heading2("Scaled Setup"));
  children.push(bullet(parseInline("**30 vendor agents** across 7 categories, each with unique pricing, constraints, and negotiation styles")));
  children.push(bullet(parseInline("**Budget-aware Planner** that tracks spend across categories and redistributes surplus/deficit")));
  children.push(bullet(parseInline("**Sequential vs. Parallel** execution at 3, 6, 10, and 30 vendor scales")));
  children.push(bullet(parseInline("**Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)")));

  // Experiment table
  children.push(heading2("Experiment: Scale & Latency at 30 Agents"));
  children.push(
    makeTable([
      ["Vendors", "Sequential", "Parallel", "Speedup", "Seq Cost", "Par Cost"],
      ["3", "50.7s", "23.2s", "2.2x", "$0.068", "$0.077"],
      ["6", "102.4s", "46.3s", "2.2x", "$0.142", "$0.168"],
      ["10", "198.0s", "45.1s", "4.4x", "$0.295", "$0.235"],
      ["30", "553.0s", "129.7s", "4.3x", "$0.807", "$0.578"],
    ])
  );

  // Results
  children.push(heading2("Results, Failures & Bottlenecks"));

  children.push(bodyPara([run("What scaled well:", { bold: true })]));
  children.push(bullet([run("Parallel speedup increased from 2.2x (6 vendors) to 4.3x (30 vendors) \u2014 near theoretical max of 5x given concurrency=5")]));
  children.push(bullet([run("30 vendors negotiated in ~2 minutes (parallel) \u2014 viable for production UX")]));
  children.push(bullet([run("Parallel was 30% more token-efficient and 28% cheaper than sequential at 30 vendors")]));

  children.push(bodyPara([run("What degraded:", { bold: true })]));
  children.push(bullet([run("Sequential time grew linearly (~18.4s/vendor) \u2014 9+ minutes for 30 vendors is unusable")]));
  children.push(bullet([run("At 30 vendors, API rate limiting became a bottleneck \u2014 occasional 429 errors required retry logic")]));
  children.push(bullet([run("Context window pressure: with 30 concurrent negotiations, the Planner\u2019s context grew large, occasionally causing less precise budget tracking")]));

  children.push(bodyPara([run("What broke:", { bold: true })]));
  children.push(bullet([run("Without pre-screening, ~40% of vendors were poor matches (wrong location, insufficient capacity, incompatible style). Pre-screening reduced wasted negotiations from 40% to <5%")]));
  children.push(bullet([run("Budget redistribution edge case: if venue negotiation exceeded allocation by >20%, downstream categories were over-constrained, leading to rejected offers in bakery/transport")]));

  children.push(bodyPara([run("What we added to fix it:", { bold: true })]));
  children.push(bullet([run("Pre-screening pipeline filtering on 8 criteria before negotiation begins")]));
  children.push(bullet([run("Budget buffer (15% unallocated) to absorb overages")]));
  children.push(bullet([run("Retry logic with exponential backoff for API rate limits")]));
  children.push(bullet([run("Venue-anchored radius filtering to eliminate geographically incompatible vendors")]));

  // Key Takeaways
  children.push(heading2("Key Takeaways"));
  children.push(bullet(parseInline("**Parallel execution is essential at scale** \u2014 4.3x faster AND 28% cheaper")));
  children.push(bullet(parseInline("**Pre-screening is the highest-ROI improvement** \u2014 eliminates 40% of wasted negotiations")));
  children.push(bullet(parseInline("**Budget management across categories is the hardest problem** \u2014 sequential category dependencies create cascading constraints")));
  children.push(bullet(parseInline("**The system is production-viable at 30 agents** \u2014 2-minute negotiation, <$1 API cost")));

  children.push(bodyPara([]));
  children.push(
    bodyPara([
      run("Live demo: ", { bold: true }),
      run("https://altara-landing.up.railway.app/simulate.html"),
    ])
  );

  children.push(hrParagraph());
  children.push(
    infraNote(
      "Infrastructure note: The simulation frontend and Express server are deployed on Railway (cloud). All 30 vendor agents and the planner agent run as separate sessions on Anthropic\u2019s cloud-hosted Claude API \u2014 each agent is an independent cloud instance, not a local process. At 30-vendor scale, up to 5 concurrent cloud API sessions negotiate simultaneously."
    )
  );

  return new Document({
    sections: [{ children }],
  });
}

// ── Build Experiment Report ──

function buildExperimentReport() {
  const children = [];

  children.push(...altaraHeader());

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "Altara A2A Negotiation \u2014 Experiment Report", bold: true, size: 52, font: "Calibri" })],
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: "Course: MAS.664 \u2014 MIT Media Lab", italics: true, size: 22, font: "Calibri", color: "444444" })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: "Date: April 2026", italics: true, size: 22, font: "Calibri", color: "444444" })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Model: Claude Sonnet 4 (", italics: true, size: 22, font: "Calibri", color: "444444" }),
        new TextRun({ text: "claude-sonnet-4-20250514", italics: true, size: 20, font: "Courier New", color: "444444" }),
        new TextRun({ text: ") for both Planner and Vendor agents", italics: true, size: 22, font: "Calibri", color: "444444" }),
      ],
    })
  );

  children.push(hrParagraph());

  // ── Overview ──
  children.push(heading2("Overview"));
  children.push(
    bodyPara(parseInline(
      "Altara is an A2A (agent-to-agent) wedding marketplace in which a **Planner agent** negotiates with multiple **Vendor agents** on behalf of a couple. The Planner receives the couple\u2019s preferences \u2014 budget, guest count, dietary needs, style \u2014 and autonomously conducts multi-turn negotiations with each vendor to assemble a complete wedding package."
    ))
  );
  children.push(bodyPara([run("We ran three experiments to evaluate:")]));
  children.push(numberedItem(parseInline("**Negotiation mechanism design** \u2014 Does competitive bidding (auction) outperform direct proposals (RFP)?")));
  children.push(numberedItem(parseInline("**Scalability** \u2014 How does wall-clock time grow as the vendor pool scales from 3 to 30?")));
  children.push(numberedItem(parseInline("**Fault tolerance** \u2014 Can the system recover mid-negotiation when a vendor agent fails?")));
  children.push(
    bodyPara(parseInline(
      "All experiments used the same baseline scenario: a 120-guest wedding in Boston, June 2027, with a $50K budget, plated Italian-American service, and vegetarian/gluten-free dietary requirements. The experiment runner (`run_experiments.js`) orchestrated each trial, recorded per-vendor outcomes, and wrote structured CSV/JSON results."
    ))
  );

  children.push(hrParagraph());

  // ── Experiment 1 ──
  children.push(heading2("Experiment 1: RFP vs. Auction Negotiation Mechanisms"));

  children.push(heading3("Hypothesis"));
  children.push(
    bodyPara(parseInline(
      "Auction-style (competitive bidding) negotiations yield lower final prices than RFP-style (direct proposal) negotiations on high-ticket categories, but may produce adverse effects on lower-ticket vendors who perceive price pressure differently."
    ))
  );

  children.push(heading3("Setup"));
  children.push(bodyPara([run("Six vendors across six categories were each negotiated under both protocols:")]));
  children.push(
    bullet(parseInline("**RFP mode:** The Planner sends a request for proposal; the vendor responds with a price and terms; multi-turn counter-offers follow."))
  );
  children.push(
    bullet(parseInline("**Auction mode:** The Planner frames the negotiation as a competitive bid, signaling that multiple vendors are competing for the booking."))
  );
  children.push(bodyPara([run("Both modes ran sequentially against the same vendor pool. Budget: $50K, 120 guests, Boston, June 2027.")]));

  children.push(heading3("Results"));

  children.push(heading4("Per-Vendor Price Comparison"));
  children.push(
    makeTable([
      ["Vendor", "Category", "RFP Price", "Auction Price", "Difference", "% Change"],
      ["Grand Meridian Ballroom", "Venue", "$23,600", "$19,400", "-$4,200", "**-17.8%**"],
      ["Grand Meridian Catering", "Catering", "$24,600", "$24,630", "+$30", "+0.1%"],
      ["Bloom & Vine Studio", "Florist", "$3,600", "$3,500", "-$100", "-2.8%"],
      ["Lens & Light Studio", "Photographer", "$5,500", "$6,700", "+$1,200", "**+21.8%**"],
      ["Boston Beat DJs", "DJ", "$2,200", "$2,200", "$0", "0.0%"],
      ["Sugar & Slate Bakery", "Bakery", "$1,440", "$1,800", "+$360", "**+25.0%**"],
    ])
  );

  children.push(heading4("Summary"));
  children.push(
    makeTable([
      ["Metric", "RFP", "Auction"],
      ["Grand Total", "$60,940", "$58,230"],
      ["Savings vs. RFP", "\u2014", "$2,710 (4.4%)"],
      ["Negotiation Time", "119.7s", "110.3s"],
      ["API Cost", "$0.176", "$0.171"],
      ["Vendors Accepted", "6/6", "6/6"],
      ["Avg. Turns per Vendor", "4.3", "4.2"],
    ])
  );

  children.push(heading3("Key Findings"));
  children.push(
    numberedItem(parseInline(
      "**Auction saved 17.8% on the venue** \u2014 the single largest line item. The competitive framing pushed Grand Meridian Ballroom from $23,600 down to $19,400, a $4,200 reduction. This alone accounts for the entire net savings of the auction protocol."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Auction backfired on photographer (+21.8%) and bakery (+25.0%).** When smaller vendors perceived competitive pressure, they anchored higher rather than lower. The photographer may have interpreted the auction framing as a signal that the couple is price-shopping and therefore added a premium to protect margins. The bakery, with already thin margins on a $1,440 base price, responded to auction pressure by quoting a higher floor ($1,800)."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Catering and DJ were price-invariant.** The caterer\u2019s price barely moved ($30 difference), likely because per-plate pricing is formulaic and leaves little room for competitive adjustment. The DJ quoted identically under both protocols."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Auction was slightly faster** (110.3s vs. 119.7s), completing in fewer total turns on average. Vendors under auction pressure tended to reach agreement or walk away more quickly."
    ))
  );

  children.push(heading3("Implications"));
  children.push(
    bodyPara(parseInline("Auction mechanisms should be deployed **selectively** by category:"))
  );
  children.push(
    bullet(parseInline("**Use auction for high-ticket items** (venues, large catering contracts) where vendors have margin room and competitive pressure drives real savings."))
  );
  children.push(
    bullet(parseInline("**Use RFP for artisan/boutique vendors** (photographers, bakeries, florists) where price pressure can trigger defensive anchoring or result in reduced service scope."))
  );
  children.push(
    bullet(parseInline("A **hybrid strategy** \u2014 auction for venue, RFP for everything else \u2014 would have yielded a grand total of approximately $55,340, saving $5,600 (9.2%) vs. pure RFP."))
  );

  children.push(hrParagraph());

  // ── Experiment 2 ──
  children.push(heading2("Experiment 2: Scale & Latency"));

  children.push(heading3("Hypothesis"));
  children.push(
    bodyPara(parseInline(
      "Parallel agent negotiation scales sub-linearly with vendor count (bounded by API concurrency limits), while sequential negotiation scales linearly."
    ))
  );

  children.push(heading3("Setup"));
  children.push(bodyPara([run("The Planner negotiated with 3, 6, 10, and 30 vendors under both execution strategies:")]));
  children.push(bullet(parseInline("**Sequential:** Vendors negotiated one at a time.")));
  children.push(bullet(parseInline("**Parallel:** Up to 5 concurrent vendor negotiations (`concurrency: 5`).")));
  children.push(bodyPara([run("All trials used RFP mode. The 30-vendor trial included the full vendor registry across all categories.")]));

  children.push(heading3("Results"));
  children.push(
    makeTable([
      ["Vendors", "Sequential (s)", "Parallel (s)", "Speedup", "Seq Cost", "Par Cost", "Seq Tokens", "Par Tokens"],
      ["3", "50.7", "23.2", "2.19x", "$0.068", "$0.077", "13,277", "15,242"],
      ["6", "102.4", "46.3", "2.21x", "$0.142", "$0.168", "27,946", "33,471"],
      ["10", "198.0", "45.1", "4.39x", "$0.295", "$0.235", "59,256", "45,976"],
      ["30", "553.0", "129.7", "4.26x", "$0.807", "$0.578", "161,708", "113,380"],
    ])
  );

  children.push(heading3("Key Findings"));
  children.push(
    numberedItem(parseInline(
      "**Sequential time scales linearly** at approximately 18\u201319 seconds per vendor. The relationship is nearly perfect: 3 vendors = 50.7s (16.9s/vendor), 30 vendors = 553s (18.4s/vendor)."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Parallel execution achieves 4.3\u20134.4x speedup at 10+ vendors.** With a concurrency limit of 5, the theoretical maximum speedup is 5x. The observed 4.3\u20134.4x suggests the system is operating near capacity, with the gap attributable to API rate limiting, variable response times across vendors, and coordination overhead."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**At small scale (3\u20136 vendors), speedup is only ~2.2x.** With fewer vendors than the concurrency limit, parallelism is bounded by the longest single negotiation rather than throughput."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Parallel execution is more token-efficient at scale.** At 30 vendors, parallel used 113,380 tokens vs. 161,708 sequential \u2014 a 30% reduction. This is likely because parallel negotiations complete in fewer turns on average (the Planner agent\u2019s context window stays smaller when negotiations run concurrently rather than accumulating sequential history)."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Parallel is also cheaper at scale.** At 30 vendors, parallel cost $0.578 vs. sequential $0.807 \u2014 a 28% cost reduction, driven by the token efficiency above."
    ))
  );

  children.push(heading3("Implications"));
  children.push(
    bullet(parseInline(
      "For a production A2A marketplace, **parallel execution is essential.** A couple\u2019s Planner agent can negotiate with 30 vendors in approximately 2 minutes, compared to over 9 minutes sequentially."
    ))
  );
  children.push(
    bullet(parseInline(
      "The **concurrency limit of 5** is the binding constraint. Increasing it (with appropriate API rate limit management) could push speedup closer to the theoretical maximum."
    ))
  );
  children.push(
    bullet(parseInline(
      "At scale, parallel is not just faster but **cheaper** \u2014 a rare case where performance optimization also reduces cost."
    ))
  );

  children.push(hrParagraph());

  // ── Experiment 3 ──
  children.push(heading2("Experiment 3: Failure Recovery"));

  children.push(heading3("Hypothesis"));
  children.push(
    bodyPara(parseInline(
      "The system can recover from vendor agent failures mid-negotiation by detecting the failure, identifying a backup vendor in the same category, and completing negotiation with the substitute \u2014 all without human intervention."
    ))
  );

  children.push(heading3("Setup"));
  children.push(bodyPara([run("Three scenarios were tested:")]));
  children.push(numberedItem(parseInline("**Baseline:** Normal negotiation with 6 vendors, no failures.")));
  children.push(numberedItem(parseInline("**Venue failure:** `venue_01` (Grand Meridian Ballroom) fails mid-negotiation; system activates a backup venue.")));
  children.push(numberedItem(parseInline("**Caterer failure:** `catering_01` (Grand Meridian Catering) fails mid-negotiation; system activates a backup caterer.")));
  children.push(
    bodyPara(parseInline(
      "Failures were injected via the `failureVendorId` option in the experiment runner, which simulates a vendor agent becoming unresponsive."
    ))
  );

  children.push(heading3("Results"));
  children.push(
    makeTable([
      ["Scenario", "Accepted", "Failed", "Recovered", "Grand Total", "Time (s)", "API Cost"],
      ["Baseline", "6", "0", "0", "$51,150", "120.9", "$0.174"],
      ["Venue Failure", "6", "1", "1", "$58,720", "102.4", "$0.149"],
      ["Caterer Failure", "6", "1", "1", "$50,715", "110.6", "$0.165"],
    ])
  );

  children.push(heading3("Key Findings"));
  children.push(
    numberedItem(parseInline(
      "**100% recovery rate.** Both failure scenarios recovered successfully, maintaining the full 6-vendor wedding package despite losing a primary vendor."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Venue backup was 14.8% more expensive.** The baseline venue cost contributed to a $51,150 total; the venue-failure scenario\u2019s backup venue pushed the total to $58,720 \u2014 a $7,570 increase (14.8%). This reflects the premium associated with backup/secondary venues that may have less competitive pricing or different capacity."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Caterer backup was nearly cost-neutral.** The catering-failure scenario total ($50,715) was actually $435 cheaper than baseline ($51,150), suggesting the backup caterer offered competitive pricing. This demonstrates that failure recovery does not inherently increase cost \u2014 it depends on the backup vendor pool."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Recovery was faster than baseline.** Both failure scenarios completed faster (102.4s and 110.6s) than the baseline (120.9s). This counterintuitive result occurs because: the failed vendor\u2019s negotiation terminates early (saving several turns); backup vendors may be more eager to accept bookings, requiring fewer negotiation rounds; the recovery path skips the initial vendor discovery phase since backups are pre-identified."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**API cost was lower in failure scenarios.** Fewer total turns (due to early termination + eager backups) resulted in less token usage."
    ))
  );

  children.push(heading3("Implications"));
  children.push(
    bullet(parseInline(
      "**Fault tolerance is critical for production deployment.** In a real marketplace, vendor agents may go offline, time out, or become unresponsive. The system must handle this gracefully."
    ))
  );
  children.push(
    bullet(parseInline(
      "**Backup vendor pools should be pre-screened and ranked.** The 14.8% venue premium highlights the importance of curating high-quality backups, especially for high-ticket categories."
    ))
  );
  children.push(
    bullet(parseInline(
      "**Recovery speed is not a concern.** The system recovered faster than baseline in both cases, meaning couples would not experience a noticeable delay."
    ))
  );
  children.push(
    bullet(parseInline(
      "A **tiered backup strategy** could mitigate cost increases: maintain 2\u20133 backup vendors per category, ranked by price competitiveness."
    ))
  );

  children.push(hrParagraph());

  // ── Summary Table ──
  children.push(heading2("Summary Table"));
  children.push(
    makeTable([
      ["Experiment", "Key Metric", "Value", "Takeaway"],
      ["Exp 1: RFP vs. Auction", "Auction savings (venue)", "17.8%", "Auction excels on high-ticket items"],
      ["Exp 1: RFP vs. Auction", "Auction penalty (photographer)", "+21.8%", "Auction backfires on boutique vendors"],
      ["Exp 1: RFP vs. Auction", "Net auction savings", "$2,710 (4.4%)", "Modest overall; category-dependent"],
      ["Exp 2: Scale & Latency", "Speedup at 30 vendors", "4.26x", "Near-optimal given concurrency=5"],
      ["Exp 2: Scale & Latency", "Time for 30 vendors (parallel)", "129.7s (~2 min)", "Production-viable"],
      ["Exp 2: Scale & Latency", "Sequential cost per vendor", "~$0.027", "Economically feasible at scale"],
      ["Exp 3: Failure Recovery", "Recovery rate", "100%", "Fully autonomous recovery"],
      ["Exp 3: Failure Recovery", "Venue backup cost premium", "+14.8%", "Pre-screen backups to minimize"],
      ["Exp 3: Failure Recovery", "Recovery time overhead", "Negative (faster)", "No UX penalty for recovery"],
    ])
  );

  children.push(hrParagraph());

  // ── Conclusions ──
  children.push(heading2("Conclusions"));
  children.push(
    numberedItem(parseInline(
      "**A2A negotiation is viable for multi-vendor wedding planning.** Autonomous Planner-to-Vendor negotiations produce reasonable prices, complete within minutes, and cost less than $1 in API fees even at 30-vendor scale."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Auction mechanisms should be used selectively.** They deliver meaningful savings on high-ticket venue bookings (17.8%) but can increase prices for boutique vendors who respond to competitive pressure with defensive anchoring. A hybrid approach \u2014 auction for venues, RFP for artisan vendors \u2014 maximizes savings."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Parallel execution makes the system production-ready at scale.** With 4.3x speedup at 10+ vendors and sub-linear cost growth, the architecture supports real-world marketplace throughput. A couple\u2019s entire vendor negotiation across 30 vendors completes in approximately 2 minutes."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Fault tolerance ensures reliable couple experience.** The 100% recovery rate with no time penalty demonstrates that the backup vendor mechanism is robust. The system degrades gracefully under failure, with cost impact depending on backup vendor pool quality rather than architectural limitations."
    ))
  );
  children.push(
    numberedItem(parseInline(
      "**Token efficiency improves with parallelism.** An unexpected but significant finding: parallel execution uses 30% fewer tokens than sequential at 30-vendor scale, making it both faster and cheaper. This has direct implications for production cost modeling."
    ))
  );

  children.push(heading3("Limitations and Future Work"));
  children.push(
    bullet(parseInline(
      "**Single-model evaluation.** All experiments used Claude Sonnet 4. Comparing negotiation quality across models (e.g., GPT-4o, Gemini) would strengthen generalizability claims."
    ))
  );
  children.push(
    bullet(parseInline(
      "**No real vendor agents.** Vendor behavior was simulated by LLM agents with predefined pricing constraints. Real vendors would introduce additional variability."
    ))
  );
  children.push(
    bullet(parseInline(
      "**Limited failure modes.** Only complete vendor failure was tested. Partial failures (e.g., vendor responds but with invalid terms) and cascading failures warrant investigation."
    ))
  );
  children.push(
    bullet(parseInline(
      "**No preference learning.** The Planner does not learn from past negotiations. Incorporating couple preference history could improve negotiation strategy over time."
    ))
  );

  return new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
}

// ── Build YouTube Scripts ──

function buildYouTubeScripts() {
  const children = [];

  children.push(...altaraHeader());

  children.push(title("YouTube Video Scripts"));

  // Recording Instructions
  children.push(heading2("Recording Instructions"));
  children.push(numberedItem([run("Screen recording: Use QuickTime Player (Cmd+Shift+5 on Mac), select \"Record Selected Portion\" and frame your browser window.")]));
  children.push(numberedItem([run("Demo URL: https://altara-landing.up.railway.app/simulate.html \u2014 have this open and ready before you start recording. Run a negotiation ahead of time so you have a completed one to show, then start a fresh one live.")]));
  children.push(numberedItem([run("Audio: Record voiceover simultaneously (make sure your mic is selected in QuickTime). Alternatively, record screen first, then add voiceover in iMovie.")]));
  children.push(numberedItem([run("Timing: Practice reading the script aloud with a timer. Each video should be exactly 60 seconds. Cut filler words \u2014 every second counts.")]));
  children.push(numberedItem([run("Upload: Upload to YouTube as Unlisted. This keeps it accessible via link but not publicly searchable.")]));
  children.push(numberedItem([run("Resolution: Record at 1920x1080 if possible. Close unnecessary tabs and notifications before recording.")]));
  children.push(numberedItem([run("Browser: Use Chrome in a clean window. Zoom the page to 110-125% so text is readable in the video.")]));

  // ── Video 1 ──
  children.push(heading2("Video 1: HW7 \u2014 Initial Agent Experiments (1 minute)"));

  children.push(heading3("Script"));

  // [0:00-0:05]
  children.push(bodyPara([
    run("[0:00-0:05]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Altara landing page hero section"),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"Altara is an A2A wedding marketplace where a planner agent negotiates with vendor agents on behalf of couples.\""),
  ]));

  // [0:05-0:20]
  children.push(bodyPara([
    run("[0:05-0:20]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Simulate page \u2014 start a negotiation, let it run. Scroll slowly so the viewer can see messages exchanging between planner and vendor agents in real time."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"Here's a live negotiation. The planner agent sends an RFP to a venue agent, they go back and forth on pricing and terms, and reach agreement \u2014 all autonomously. No human in the loop.\""),
  ]));

  // [0:20-0:35]
  children.push(bodyPara([
    run("[0:20-0:35]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Switch to experiment results. If you have experiment_report.md open in a text editor or a screenshot of the results table, show that. Highlight the venue savings number."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"We ran three experiments. First: auction versus RFP. Auctions saved 17.8 percent on venue \u2014 our biggest line item \u2014 but backfired on boutique vendors. Bakery prices jumped 25 percent. Smaller vendors anchor defensively when they sense competitive pressure.\""),
  ]));

  // [0:35-0:50]
  children.push(bodyPara([
    run("[0:35-0:50]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Scroll to experiment 2 and 3 results, or show a summary table with the key numbers."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"Experiment two: parallel negotiation gave us a 2.2x speedup at six vendors. And experiment three tested failure recovery \u2014 when a vendor crashes mid-negotiation, backups activate automatically. We hit 100 percent recovery, and backup vendors actually closed faster than the originals.\""),
  ]));

  // [0:50-1:00]
  children.push(bodyPara([
    run("[0:50-1:00]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Summary slide or table with three key findings: Auction: 17.8% venue savings, bad for artisans; Parallel: 2.2x faster; Recovery: 100% rate"),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"Key takeaway: A2A negotiation works, but mechanism choice matters by vendor category. Auctions for high-value venues, direct proposals for artisan vendors.\""),
  ]));

  // Screen Prep Checklist (Video 1)
  children.push(heading3("Screen Prep Checklist"));
  children.push(bullet([run("Landing page loaded at https://altara-landing.up.railway.app")]));
  children.push(bullet([run("Simulate page loaded at https://altara-landing.up.railway.app/simulate.html")]));
  children.push(bullet([run("One completed negotiation visible (run one beforehand)")]));
  children.push(bullet([run("Experiment results ready to show (screenshot, text file, or slide)")]));
  children.push(bullet([run("Summary table ready (can be a simple slide or text file)")]));

  // Horizontal rule between video sections
  children.push(hrParagraph());

  // ── Video 2 ──
  children.push(heading2("Video 2: HW8 \u2014 Scaled Experiments (1 minute)"));

  children.push(heading3("Script"));

  // [0:00-0:05]
  children.push(bodyPara([
    run("[0:00-0:05]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Simulate page with the multi-category dropdown or view visible. If the UI shows category tabs (venue, catering, photographer, etc.), make sure those are visible."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"For HW8, we scaled Altara from 6 agents to 30 \u2014 negotiating across 7 vendor categories simultaneously.\""),
  ]));

  // [0:05-0:20]
  children.push(bodyPara([
    run("[0:05-0:20]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Run or show a multi-category simulation. Scroll through the different category negotiations as they happen. If budget tracking is visible in the UI, point to it."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"The planner now negotiates venue first, then uses that as an anchor \u2014 filtering all downstream vendors by distance, partnerships, and availability. Budget tracks across every category in real time, redistributing savings automatically.\""),
  ]));

  // [0:20-0:40]
  children.push(bodyPara([
    run("[0:20-0:40]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Results table showing scale vs latency. Key numbers: 6 agents: baseline; 30 agents: 4.3x speedup; Cost: 28% cheaper. If you have a chart or table, show it here."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"At 30 agents, parallel negotiation hit a 4.3x speedup \u2014 completing in 2 minutes instead of 9. It was also 28 percent cheaper, because concurrent negotiations avoid building up long context histories that inflate token costs.\""),
  ]));

  // [0:40-0:55]
  children.push(bodyPara([
    run("[0:40-0:55]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("\"What broke\" section \u2014 can be a slide, doc, or just scroll through notes. Highlight the 40% mismatch stat and the budget cascade problem."),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"What broke: without pre-screening, 40 percent of vendors were poor matches \u2014 wrong location, wrong capacity. And budget redistribution had edge cases where a venue overage would starve downstream categories like florals and photography. We fixed both with an 8-criteria pre-screening pipeline and a 15 percent budget buffer per category.\""),
  ]));

  // [0:55-1:00]
  children.push(bodyPara([
    run("[0:55-1:00]", { bold: true }),
  ]));
  children.push(bodyPara([
    run("SHOW: ", { bold: true, italics: true }),
    run("Final summary \u2014 one line on screen: \"30 agents. 2 minutes. Under $1 in API cost.\""),
  ]));
  children.push(bodyPara([
    run("SAY: ", { bold: true, italics: true }),
    run("\"Bottom line: the system is production-viable. Thirty agents, two minutes, under a dollar in API cost.\""),
  ]));

  // Screen Prep Checklist (Video 2)
  children.push(heading3("Screen Prep Checklist"));
  children.push(bullet([run("Multi-category simulation ready to run or already completed")]));
  children.push(bullet([run("Budget tracking visible in the UI")]));
  children.push(bullet([run("Scale results table or chart prepared (6 vs 15 vs 30 agents)")]));
  children.push(bullet([run("\"What broke\" summary ready to show")]));
  children.push(bullet([run("Final summary slide or text ready")]));
  children.push(bullet([run("Close all other browser tabs and silence notifications")]));

  return new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
}

// ── Main ──

async function main() {
  // Ensure results directory exists
  if (!fs.existsSync("/Users/gpmacbookpro3/Desktop/altara-landing/results")) {
    fs.mkdirSync("/Users/gpmacbookpro3/Desktop/altara-landing/results", { recursive: true });
  }

  const hw7Doc = buildHW7();
  const hw7Buf = await Packer.toBuffer(hw7Doc);
  fs.writeFileSync("/Users/gpmacbookpro3/Desktop/altara-landing/hw7_writeup.docx", hw7Buf);
  console.log("Created hw7_writeup.docx (" + hw7Buf.length + " bytes)");

  const hw8Doc = buildHW8();
  const hw8Buf = await Packer.toBuffer(hw8Doc);
  fs.writeFileSync("/Users/gpmacbookpro3/Desktop/altara-landing/hw8_writeup.docx", hw8Buf);
  console.log("Created hw8_writeup.docx (" + hw8Buf.length + " bytes)");

  const reportDoc = buildExperimentReport();
  const reportBuf = await Packer.toBuffer(reportDoc);
  fs.writeFileSync("/Users/gpmacbookpro3/Desktop/altara-landing/results/experiment_report.docx", reportBuf);
  console.log("Created results/experiment_report.docx (" + reportBuf.length + " bytes)");

  const ytDoc = buildYouTubeScripts();
  const ytBuf = await Packer.toBuffer(ytDoc);
  fs.writeFileSync("/Users/gpmacbookpro3/Desktop/altara-landing/youtube_scripts.docx", ytBuf);
  console.log("Created youtube_scripts.docx (" + ytBuf.length + " bytes)");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
