#!/usr/bin/env python3
"""
Altara Caterer Agent — Demo Scenario
=====================================
Simulates a full A2A conversation between the Planner Agent and
the Bella Tavola Catering vendor agent.

Scenario: A couple wants a June 14, 2026 wedding for 120 guests
with a $40K total budget (~$130/head for catering).

Run: python -m agents.caterer.demo
"""

import json
from datetime import date
from .agent import CatererAgent


def pp(label: str, data: dict):
    """Pretty-print a labeled JSON response."""
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(json.dumps(data, indent=2, default=str))


def main():
    agent = CatererAgent()

    print("\n" + "~"*60)
    print("  ALTARA — Caterer Agent Demo")
    print("  Bella Tavola Catering × Planner Agent")
    print("~"*60)

    # ── Step 1: Discovery ─────────────────────────────────────────
    print("\n\n>>> PLANNER: Discover vendor capabilities")
    response = agent.handle_message({
        "intent": "discover",
        "params": {},
    })
    pp("CATERER → Agent Card", response)

    # ── Step 2: RFP (combined availability + quote) ───────────────
    print("\n\n>>> PLANNER: Submit RFP — June 14, 120 guests, $130/head budget")
    response = agent.handle_message({
        "intent": "rfp",
        "params": {
            "event_date": "2026-06-14",
            "guest_count": 120,
            "region": "Greater Boston",
            "service_style": "plated",
            "budget_per_head": 130,
            "dietary_needs": ["vegan", "gluten_free"],
            "dietary_breakdown": {"vegan": 12, "gluten_free": 8},
            "kids_count": 5,
        },
    })
    pp("CATERER → RFP Response", response)
    quote_id = response["data"].get("quote", {}).get("quote_id")

    # ── Step 3: Check dietary feasibility in detail ───────────────
    print("\n\n>>> PLANNER: Detailed dietary check (12 vegan, 8 GF, 3 kosher)")
    response = agent.handle_message({
        "intent": "accommodate_dietary",
        "params": {
            "dietary_breakdown": {
                "vegan": 12,
                "gluten_free": 8,
                "kosher": 3,
                "nut_free": 5,
            },
            "total_guests": 120,
            "menu_id": "italian_classic",
        },
    })
    pp("CATERER → Dietary Assessment", response)

    # ── Step 4: Explore menus ─────────────────────────────────────
    print("\n\n>>> PLANNER: Show me premium Italian menus")
    response = agent.handle_message({
        "intent": "get_menus",
        "params": {
            "cuisine": "Italian",
            "tier": "premium",
            "dietary_needs": ["vegan", "gluten_free"],
        },
    })
    pp("CATERER → Menu Options", response)

    # ── Step 5: Customize a menu ──────────────────────────────────
    print("\n\n>>> PLANNER: Customize Italian Classic — swap salmon for lobster ravioli")
    response = agent.handle_message({
        "intent": "build_custom_menu",
        "params": {
            "base_menu_id": "italian_classic",
            "substitutions": {
                "entree": {
                    "Pan-Seared Salmon with Lemon Caper Sauce": "Lobster Ravioli in Cream Sauce"
                }
            },
            "add_courses": {
                "appetizer": ["Prosciutto-Wrapped Figs"]
            },
            "dietary_needs": ["vegan", "gluten_free"],
        },
    })
    pp("CATERER → Custom Menu", response)

    # ── Step 6: Negotiate! ────────────────────────────────────────
    if quote_id:
        print("\n\n>>> PLANNER: Can you do $110/head? (couple's budget is tight)")
        response = agent.handle_message({
            "intent": "negotiate",
            "params": {
                "quote_id": quote_id,
                "requested_per_head": 110,
            },
            "context": {"quote_id": quote_id},
        })
        pp("CATERER → Negotiation Round 1", response)

        # Round 2
        counter = response["data"].get("counter_per_head", 125)
        print(f"\n\n>>> PLANNER: Meet in the middle at ${int((110 + counter) / 2)}/head?")
        response = agent.handle_message({
            "intent": "negotiate",
            "params": {
                "quote_id": quote_id,
                "requested_per_head": int((110 + counter) / 2),
                "add_ons_offered": ["late_night_snack", "espresso_station"],
            },
            "context": {"quote_id": quote_id},
        })
        pp("CATERER → Negotiation Round 2", response)

    # ── Step 7: Hold the date ─────────────────────────────────────
    print("\n\n>>> PLANNER: Hold June 14 for this couple")
    response = agent.handle_message({
        "intent": "hold_date",
        "params": {
            "event_date": "2026-06-14",
            "guest_count": 120,
            "quote_id": quote_id or "QT-20260614-120",
            "planner_agent_id": "altara-planner-001",
            "hold_days": 7,
        },
    })
    pp("CATERER → Date Hold", response)
    hold_id = response["data"].get("hold_id")

    # ── Step 8: Confirm booking ───────────────────────────────────
    print("\n\n>>> PLANNER: Couple approved! Confirm booking (contract signed, deposit sent)")
    response = agent.handle_message({
        "intent": "confirm_booking",
        "params": {
            "hold_id": hold_id,
            "quote_id": quote_id or "QT-20260614-120",
            "final_guest_count": 118,
            "menu_id": "italian_classic",
            "service_style": "plated",
            "deposit_received": True,
            "contract_signed": True,
            "special_notes": "Bride's table needs all vegan options. Groom allergic to shellfish.",
        },
    })
    pp("CATERER → Booking Confirmed!", response)

    # ── Step 9: Test edge case — unavailable date ─────────────────
    print("\n\n>>> PLANNER: Check availability for June 6 (blackout date)")
    response = agent.handle_message({
        "intent": "check_availability",
        "params": {
            "event_date": "2026-06-06",
            "guest_count": 120,
            "region": "Greater Boston",
        },
    })
    pp("CATERER → Unavailable (with alternatives)", response)

    print("\n\n" + "~"*60)
    print("  Demo complete!")
    print("~"*60 + "\n")


if __name__ == "__main__":
    main()
