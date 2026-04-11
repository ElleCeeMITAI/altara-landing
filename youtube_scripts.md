# YouTube Video Scripts — Altara A2A Wedding Marketplace

## Recording Instructions

1. **Screen recording**: Use QuickTime Player (Cmd+Shift+5 on Mac), select "Record Selected Portion" and frame your browser window.
2. **Demo URL**: https://altara-landing.up.railway.app/simulate.html — have this open and ready before you start recording. Run a negotiation ahead of time so you have a completed one to show, then start a fresh one live.
3. **Audio**: Record voiceover simultaneously (make sure your mic is selected in QuickTime). Alternatively, record screen first, then add voiceover in iMovie.
4. **Timing**: Practice reading the script aloud with a timer. Each video should be exactly 60 seconds. Cut filler words — every second counts.
5. **Upload**: Upload to YouTube as **Unlisted**. This keeps it accessible via link but not publicly searchable.
6. **Resolution**: Record at 1920x1080 if possible. Close unnecessary tabs and notifications before recording.
7. **Browser**: Use Chrome in a clean window. Zoom the page to 110-125% so text is readable in the video.

---

## Video 1: HW7 — Initial Agent Experiments (1 minute)

### Script

```
[0:00-0:05] SHOW: Altara landing page hero section
SAY: "Altara is an A2A wedding marketplace where a planner agent
negotiates with vendor agents on behalf of couples."

[0:05-0:20] SHOW: Simulate page — start a negotiation, let it run.
         Scroll slowly so the viewer can see messages exchanging
         between planner and vendor agents in real time.
SAY: "Here's a live negotiation. The planner agent sends an RFP to
a venue agent, they go back and forth on pricing and terms, and
reach agreement — all autonomously. No human in the loop."

[0:20-0:35] SHOW: Switch to experiment results. If you have
         experiment_report.md open in a text editor or a screenshot
         of the results table, show that. Highlight the venue
         savings number.
SAY: "We ran three experiments. First: auction versus RFP. Auctions
saved 17.8 percent on venue — our biggest line item — but backfired
on boutique vendors. Bakery prices jumped 25 percent. Smaller vendors
anchor defensively when they sense competitive pressure."

[0:35-0:50] SHOW: Scroll to experiment 2 and 3 results, or show a
         summary table with the key numbers.
SAY: "Experiment two: parallel negotiation gave us a 2.2x speedup
at six vendors. And experiment three tested failure recovery — when
a vendor crashes mid-negotiation, backups activate automatically.
We hit 100 percent recovery, and backup vendors actually closed
faster than the originals."

[0:50-1:00] SHOW: Summary slide or table with three key findings:
         - Auction: 17.8% venue savings, bad for artisans
         - Parallel: 2.2x faster
         - Recovery: 100% rate
SAY: "Key takeaway: A2A negotiation works, but mechanism choice
matters by vendor category. Auctions for high-value venues, direct
proposals for artisan vendors."
```

### Screen Prep Checklist (Video 1)
- [ ] Landing page loaded at https://altara-landing.up.railway.app
- [ ] Simulate page loaded at https://altara-landing.up.railway.app/simulate.html
- [ ] One completed negotiation visible (run one beforehand)
- [ ] Experiment results ready to show (screenshot, text file, or slide)
- [ ] Summary table ready (can be a simple slide or text file)

---

## Video 2: HW8 — Scaled Experiments (1 minute)

### Script

```
[0:00-0:05] SHOW: Simulate page with the multi-category dropdown or
         view visible. If the UI shows category tabs (venue,
         catering, photographer, etc.), make sure those are visible.
SAY: "For HW8, we scaled Altara from 6 agents to 30 — negotiating
across 7 vendor categories simultaneously."

[0:05-0:20] SHOW: Run or show a multi-category simulation. Scroll
         through the different category negotiations as they happen.
         If budget tracking is visible in the UI, point to it.
SAY: "The planner now negotiates venue first, then uses that as an
anchor — filtering all downstream vendors by distance, partnerships,
and availability. Budget tracks across every category in real time,
redistributing savings automatically."

[0:20-0:40] SHOW: Results table showing scale vs latency. Key numbers:
         - 6 agents: baseline
         - 30 agents: 4.3x speedup
         - Cost: 28% cheaper
         If you have a chart or table, show it here.
SAY: "At 30 agents, parallel negotiation hit a 4.3x speedup —
completing in 2 minutes instead of 9. It was also 28 percent cheaper,
because concurrent negotiations avoid building up long context
histories that inflate token costs."

[0:40-0:55] SHOW: "What broke" section — can be a slide, doc, or
         just scroll through notes. Highlight the 40% mismatch
         stat and the budget cascade problem.
SAY: "What broke: without pre-screening, 40 percent of vendors were
poor matches — wrong location, wrong capacity. And budget
redistribution had edge cases where a venue overage would starve
downstream categories like florals and photography. We fixed both
with an 8-criteria pre-screening pipeline and a 15 percent budget
buffer per category."

[0:55-1:00] SHOW: Final summary — one line on screen:
         "30 agents. 2 minutes. Under $1 in API cost."
SAY: "Bottom line: the system is production-viable. Thirty agents,
two minutes, under a dollar in API cost."
```

### Screen Prep Checklist (Video 2)
- [ ] Multi-category simulation ready to run or already completed
- [ ] Budget tracking visible in the UI
- [ ] Scale results table or chart prepared (6 vs 15 vs 30 agents)
- [ ] "What broke" summary ready to show
- [ ] Final summary slide or text ready
- [ ] Close all other browser tabs and silence notifications
