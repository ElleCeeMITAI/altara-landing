"""
Bella Tavola Catering — Vendor Agent
=====================================
The main agent that receives A2A messages from the Altara Planner Agent,
interprets intent, invokes the appropriate skills, and returns structured
responses. This agent encapsulates all private business logic.

Skills:
  1. check_availability  — Date, capacity, region feasibility
  2. get_menus           — Menu catalog with filtering
  3. build_custom_menu   — Menu customization from templates
  4. accommodate_dietary — Dietary feasibility analysis
  5. generate_quote      — Itemized pricing with adjustments
  6. apply_negotiation   — Multi-round negotiation handling
  7. hold_date           — Temporary date reservation
  8. confirm_booking     — Final booking confirmation
"""

import json
from datetime import date
from typing import Any, Optional

from . import config
from .skills.availability import check_availability
from .skills.menu import get_menus, build_custom_menu
from .skills.dietary import accommodate_dietary
from .skills.pricing import generate_quote, apply_negotiation
from .skills.booking import hold_date, confirm_booking


class CatererAgent:
    """
    Autonomous vendor agent for Bella Tavola Catering.

    Processes structured A2A messages and returns structured responses.
    Maintains negotiation state across conversation turns.
    """

    def __init__(self):
        self.agent_card = self._load_agent_card()
        self.active_quotes: dict[str, dict] = {}
        self.negotiation_state: dict[str, int] = {}  # quote_id → round number

    def _load_agent_card(self) -> dict:
        """Load the public agent card."""
        import os
        card_path = os.path.join(os.path.dirname(__file__), "agent_card.json")
        with open(card_path) as f:
            return json.load(f)

    # ── Public A2A Interface ──────────────────────────────────────

    def handle_message(self, message: dict) -> dict:
        """
        Main entry point for A2A messages from the planner agent.

        Message format:
            {
                "intent": str,          # The skill to invoke
                "params": dict,         # Skill-specific parameters
                "context": dict | None, # Conversation context (quote IDs, etc.)
            }

        Returns:
            {
                "vendor": str,
                "intent": str,
                "status": "success" | "error",
                "data": dict,
            }
        """
        intent = message.get("intent")
        params = message.get("params", {})
        context = message.get("context", {})

        handler = {
            "discover": self._handle_discover,
            "check_availability": self._handle_availability,
            "get_menus": self._handle_menus,
            "build_custom_menu": self._handle_custom_menu,
            "accommodate_dietary": self._handle_dietary,
            "generate_quote": self._handle_quote,
            "rfp": self._handle_rfp,
            "negotiate": self._handle_negotiate,
            "hold_date": self._handle_hold,
            "confirm_booking": self._handle_confirm,
        }.get(intent)

        if not handler:
            return self._response(intent or "unknown", "error", {
                "message": f"Unknown intent: '{intent}'",
                "supported_intents": [
                    "discover", "check_availability", "get_menus",
                    "build_custom_menu", "accommodate_dietary",
                    "generate_quote", "rfp", "negotiate",
                    "hold_date", "confirm_booking",
                ],
            })

        try:
            data = handler(params, context)
            return self._response(intent, "success", data)
        except Exception as e:
            return self._response(intent, "error", {"message": str(e)})

    # ── Intent Handlers ───────────────────────────────────────────

    def _handle_discover(self, params: dict, context: dict) -> dict:
        """Return the public agent card (capabilities, constraints, trust)."""
        return self.agent_card

    def _handle_availability(self, params: dict, context: dict) -> dict:
        """Check date/capacity availability."""
        event_date = _parse_date(params.get("event_date"))
        return check_availability(
            event_date=event_date,
            guest_count=params.get("guest_count", 100),
            region=params.get("region", "Greater Boston"),
            service_style=params.get("service_style", "plated"),
        )

    def _handle_menus(self, params: dict, context: dict) -> dict:
        """Return available menus with optional filtering."""
        return get_menus(
            cuisine=params.get("cuisine"),
            tier=params.get("tier"),
            dietary_needs=params.get("dietary_needs"),
            service_style=params.get("service_style"),
        )

    def _handle_custom_menu(self, params: dict, context: dict) -> dict:
        """Build a customized menu."""
        return build_custom_menu(
            base_menu_id=params.get("base_menu_id"),
            substitutions=params.get("substitutions"),
            add_courses=params.get("add_courses"),
            remove_courses=params.get("remove_courses"),
            dietary_needs=params.get("dietary_needs"),
        )

    def _handle_dietary(self, params: dict, context: dict) -> dict:
        """Evaluate dietary accommodation feasibility."""
        return accommodate_dietary(
            dietary_breakdown=params.get("dietary_breakdown", {}),
            total_guests=params.get("total_guests", 100),
            menu_id=params.get("menu_id"),
        )

    def _handle_quote(self, params: dict, context: dict) -> dict:
        """Generate an itemized quote."""
        event_date = _parse_date(params.get("event_date"))
        quote = generate_quote(
            event_date=event_date,
            guest_count=params.get("guest_count", 100),
            service_style=params.get("service_style", "plated"),
            tier=params.get("tier", "premium"),
            region=params.get("region", "Greater Boston"),
            menu_id=params.get("menu_id"),
            add_ons=params.get("add_ons"),
            dietary_breakdown=params.get("dietary_breakdown"),
            kids_count=params.get("kids_count", 0),
        )

        # Store quote for negotiation (with internal data)
        if "quote_id" in quote:
            self.active_quotes[quote["quote_id"]] = quote
            self.negotiation_state[quote["quote_id"]] = 0

        # Strip internal data before returning
        public_quote = {k: v for k, v in quote.items() if not k.startswith("_")}
        return public_quote

    def _handle_rfp(self, params: dict, context: dict) -> dict:
        """
        Handle a Request for Proposal — a combined availability + quote flow.
        This is the most common first message from a planner agent.
        """
        event_date = _parse_date(params.get("event_date"))
        guest_count = params.get("guest_count", 100)
        region = params.get("region", "Greater Boston")
        service_style = params.get("service_style", "plated")
        budget_per_head = params.get("budget_per_head")
        dietary_needs = params.get("dietary_needs")

        # Step 1: Check availability
        avail = check_availability(event_date, guest_count, region, service_style)
        if not avail["available"]:
            return {
                "rfp_status": "unavailable",
                "availability": avail,
                "message": "Unfortunately we cannot accommodate this event.",
            }

        # Step 2: Recommend a tier based on budget
        recommended_tier = "premium"  # default
        if budget_per_head:
            for tier_name in ["standard", "premium", "luxury"]:
                price = config.BASE_PRICING.get(service_style, {}).get(tier_name, 0)
                if price <= budget_per_head:
                    recommended_tier = tier_name

        # Step 3: Get matching menus
        menus = get_menus(tier=recommended_tier, dietary_needs=dietary_needs)

        # Step 4: Generate quote
        quote = generate_quote(
            event_date=event_date,
            guest_count=guest_count,
            service_style=service_style,
            tier=recommended_tier,
            region=region,
            dietary_breakdown=params.get("dietary_breakdown"),
            kids_count=params.get("kids_count", 0),
        )

        if "quote_id" in quote:
            self.active_quotes[quote["quote_id"]] = quote
            self.negotiation_state[quote["quote_id"]] = 0

        public_quote = {k: v for k, v in quote.items() if not k.startswith("_")}

        # Step 5: Budget fit analysis
        budget_fit = None
        if budget_per_head:
            effective = quote.get("effective_per_head", 0)
            if effective <= budget_per_head:
                budget_fit = "within_budget"
            elif effective <= budget_per_head * 1.1:
                budget_fit = "slightly_over"
            else:
                budget_fit = "over_budget"

        return {
            "rfp_status": "proposal_ready",
            "availability": avail,
            "recommended_tier": recommended_tier,
            "menus": menus["menus"][:3],  # Top 3 menu options
            "quote": public_quote,
            "budget_fit": budget_fit,
            "message": (
                f"Great news! We're available on {event_date.isoformat()} for {guest_count} guests. "
                f"We recommend our {recommended_tier} {service_style} package. "
                f"See the attached quote and menu options."
            ),
        }

    def _handle_negotiate(self, params: dict, context: dict) -> dict:
        """Handle a negotiation round."""
        quote_id = params.get("quote_id") or context.get("quote_id")
        if not quote_id or quote_id not in self.active_quotes:
            return {"error": "Quote not found. Please generate a quote first."}

        original_quote = self.active_quotes[quote_id]

        # Increment negotiation round
        self.negotiation_state[quote_id] = self.negotiation_state.get(quote_id, 0) + 1
        current_round = self.negotiation_state[quote_id]

        event_date = _parse_date(original_quote.get("event_date"))

        result = apply_negotiation(
            original_quote=original_quote,
            requested_total=params.get("requested_total"),
            requested_per_head=params.get("requested_per_head"),
            negotiation_round=current_round,
            event_date=event_date,
            add_ons_offered=params.get("add_ons_offered"),
        )

        return result

    def _handle_hold(self, params: dict, context: dict) -> dict:
        """Place a date hold."""
        event_date = _parse_date(params.get("event_date"))
        return hold_date(
            event_date=event_date,
            guest_count=params.get("guest_count", 100),
            quote_id=params.get("quote_id", ""),
            planner_agent_id=params.get("planner_agent_id", "unknown"),
            hold_days=params.get("hold_days", 7),
        )

    def _handle_confirm(self, params: dict, context: dict) -> dict:
        """Confirm a booking."""
        return confirm_booking(
            hold_id=params.get("hold_id"),
            quote_id=params.get("quote_id"),
            final_guest_count=params.get("final_guest_count", 100),
            menu_id=params.get("menu_id", "italian_classic"),
            service_style=params.get("service_style", "plated"),
            deposit_received=params.get("deposit_received", False),
            contract_signed=params.get("contract_signed", False),
            special_notes=params.get("special_notes"),
        )

    # ── Helpers ───────────────────────────────────────────────────

    def _response(self, intent: str, status: str, data: Any) -> dict:
        return {
            "vendor": config.VENDOR_NAME,
            "vendor_id": config.VENDOR_ID,
            "intent": intent,
            "status": status,
            "data": data,
        }


def _parse_date(value) -> date:
    """Parse a date from string or return as-is if already a date."""
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError(f"Cannot parse date from: {value}")
