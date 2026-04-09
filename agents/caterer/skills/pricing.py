"""
Skill: Pricing & Negotiation
=============================
Generates detailed quotes and handles multi-round negotiation
with the planner agent. Contains PRIVATE margin logic.
"""

from datetime import date
from typing import Optional
from .. import config


def generate_quote(
    event_date: date,
    guest_count: int,
    service_style: str,
    tier: str,
    region: str,
    menu_id: Optional[str] = None,
    add_ons: Optional[list[str]] = None,
    dietary_breakdown: Optional[dict[str, int]] = None,
    kids_count: int = 0,
) -> dict:
    """
    Generate a detailed, itemized quote.

    Returns a full quote breakdown with line items, adjustments,
    and total — plus internal margin data (for agent use only).
    """
    errors = []

    # Validate inputs
    if service_style not in config.BASE_PRICING:
        errors.append(f"Unknown service style: '{service_style}'. Options: {list(config.BASE_PRICING.keys())}")
    if tier not in config.BASE_PRICING.get(service_style, {}):
        errors.append(f"Unknown tier: '{tier}'. Options: {list(config.BASE_PRICING.get(service_style, {}).keys())}")

    if errors:
        return {"error": errors}

    # ── Base per-head price ───────────────────────────────────────
    base_per_head = config.BASE_PRICING[service_style][tier]
    adult_count = guest_count - kids_count
    line_items = []

    line_items.append({
        "item": f"{tier.title()} {service_style.replace('_', ' ').title()} — {adult_count} adults",
        "per_head": base_per_head,
        "quantity": adult_count,
        "subtotal": base_per_head * adult_count,
    })

    # Kids meals
    if kids_count > 0:
        kids_price = config.ADD_ONS["kids_menu"]["per_head"]
        line_items.append({
            "item": f"Kids Menu — {kids_count} children",
            "per_head": kids_price,
            "quantity": kids_count,
            "subtotal": kids_price * kids_count,
        })

    # ── Dietary upcharges ─────────────────────────────────────────
    dietary_upcharge = 0
    if dietary_breakdown:
        for need, count in dietary_breakdown.items():
            need_key = need.lower().replace("-", "_").replace(" ", "_")
            acc = config.DIETARY_ACCOMMODATIONS.get(need_key, {})
            if acc.get("upcharge", 0) > 0:
                upcharge = acc["upcharge"] * count
                dietary_upcharge += upcharge
                line_items.append({
                    "item": f"Dietary: {need} accommodation ({count} guests)",
                    "per_head": acc["upcharge"],
                    "quantity": count,
                    "subtotal": upcharge,
                })

    # ── Add-ons ───────────────────────────────────────────────────
    add_on_total = 0
    if add_ons:
        for addon_id in add_ons:
            addon = config.ADD_ONS.get(addon_id)
            if addon:
                if "per_head" in addon:
                    subtotal = addon["per_head"] * guest_count
                    line_items.append({
                        "item": addon["description"],
                        "per_head": addon["per_head"],
                        "quantity": guest_count,
                        "subtotal": subtotal,
                    })
                elif "flat" in addon:
                    subtotal = addon["flat"]
                    line_items.append({
                        "item": addon["description"],
                        "flat_fee": addon["flat"],
                        "quantity": 1,
                        "subtotal": subtotal,
                    })
                add_on_total += subtotal

    # ── Subtotal before adjustments ───────────────────────────────
    subtotal = sum(item["subtotal"] for item in line_items)

    # ── Adjustments ───────────────────────────────────────────────
    adjustments = []

    # Volume discount
    for min_guests, discount_pct in sorted(config.VOLUME_DISCOUNTS, reverse=True):
        if guest_count >= min_guests:
            discount_amt = round(subtotal * discount_pct)
            adjustments.append({
                "type": "volume_discount",
                "description": f"Volume discount ({guest_count}+ guests, {int(discount_pct*100)}% off)",
                "amount": -discount_amt,
            })
            break

    # Seasonal adjustment
    month = event_date.month
    if month in config.PEAK_MONTHS:
        surcharge = round(subtotal * config.PEAK_SURCHARGE)
        adjustments.append({
            "type": "peak_season",
            "description": f"Peak season surcharge ({event_date.strftime('%B')})",
            "amount": surcharge,
        })
    elif month in config.OFF_PEAK_MONTHS:
        discount = round(subtotal * config.OFF_PEAK_DISCOUNT)
        adjustments.append({
            "type": "off_peak_discount",
            "description": f"Off-peak season discount ({event_date.strftime('%B')})",
            "amount": -discount,
        })

    # Day-of-week adjustment
    day_of_week = event_date.weekday()  # 0=Mon, 6=Sun
    if day_of_week == 4:  # Friday
        discount = round(subtotal * config.FRIDAY_DISCOUNT)
        adjustments.append({
            "type": "friday_discount",
            "description": "Friday event discount",
            "amount": -discount,
        })
    elif day_of_week == 6:  # Sunday
        discount = round(subtotal * config.SUNDAY_DISCOUNT)
        adjustments.append({
            "type": "sunday_discount",
            "description": "Sunday event discount",
            "amount": -discount,
        })
    elif day_of_week < 4:  # Mon-Thu
        discount = round(subtotal * config.WEEKDAY_DISCOUNT)
        adjustments.append({
            "type": "weekday_discount",
            "description": "Weekday event discount",
            "amount": -discount,
        })

    # Travel surcharge
    travel = config.TRAVEL_SURCHARGE.get(region, 0)
    if travel > 0:
        adjustments.append({
            "type": "travel_surcharge",
            "description": f"Travel surcharge ({region})",
            "amount": travel,
        })

    # ── Total ─────────────────────────────────────────────────────
    adjustment_total = sum(a["amount"] for a in adjustments)
    total = subtotal + adjustment_total

    # Enforce minimum spend
    if total < config.MINIMUM_SPEND:
        difference = config.MINIMUM_SPEND - total
        adjustments.append({
            "type": "minimum_spend",
            "description": f"Minimum spend adjustment (${config.MINIMUM_SPEND} minimum)",
            "amount": difference,
        })
        total = config.MINIMUM_SPEND

    effective_per_head = round(total / guest_count, 2)

    # ── Tasting eligibility ───────────────────────────────────────
    tasting = {
        "complimentary": total >= config.TASTING_POLICY["complimentary_threshold"],
        "fee": 0 if total >= config.TASTING_POLICY["complimentary_threshold"] else config.TASTING_POLICY["tasting_fee"],
        "note": "Tasting fee is credited toward your booking." if total < config.TASTING_POLICY["complimentary_threshold"] else "Complimentary tasting included.",
    }

    # ── Internal margin (NEVER sent to planner) ───────────────────
    cost_basis = total * config.NEGOTIATION["cost_basis_pct_of_price"] / 100
    margin = total - cost_basis
    margin_pct = (margin / total) * 100 if total > 0 else 0

    quote = {
        "quote_id": f"QT-{event_date.strftime('%Y%m%d')}-{guest_count}",
        "vendor": config.VENDOR_NAME,
        "event_date": event_date.isoformat(),
        "guest_count": guest_count,
        "service_style": service_style,
        "tier": tier,
        "region": region,
        "line_items": line_items,
        "subtotal": subtotal,
        "adjustments": adjustments,
        "total": total,
        "effective_per_head": effective_per_head,
        "currency": "USD",
        "tasting": tasting,
        "valid_for_days": 14,
        "deposit_required_pct": 25,
        "deposit_amount": round(total * 0.25),
        "payment_schedule": [
            {"milestone": "Booking deposit", "pct": 25, "amount": round(total * 0.25)},
            {"milestone": "Menu finalization (60 days before)", "pct": 25, "amount": round(total * 0.25)},
            {"milestone": "Final guest count (14 days before)", "pct": 25, "amount": round(total * 0.25)},
            {"milestone": "Day of event", "pct": 25, "amount": total - 3 * round(total * 0.25)},
        ],
        # ── PRIVATE: for agent negotiation logic only ─────────────
        "_internal": {
            "cost_basis": cost_basis,
            "margin": margin,
            "margin_pct": round(margin_pct, 1),
            "floor_price": round(cost_basis / (1 - config.NEGOTIATION["minimum_margin_pct"] / 100)),
        },
    }

    return quote


def apply_negotiation(
    original_quote: dict,
    requested_total: Optional[float] = None,
    requested_per_head: Optional[float] = None,
    negotiation_round: int = 1,
    event_date: Optional[date] = None,
    add_ons_offered: Optional[list[str]] = None,
) -> dict:
    """
    Process a negotiation request from the planner agent.

    The caterer agent evaluates the offer against its private margin
    rules and responds with accept / counter / reject.

    Returns:
        {
            "decision": "accept" | "counter" | "reject",
            "original_total": float,
            "requested_total": float,
            "counter_total": float | None,
            "counter_per_head": float | None,
            "message": str,
            "round": int,
            "sweeteners": list[str],   # extras offered to close the deal
        }
    """
    internal = original_quote.get("_internal", {})
    floor_price = internal.get("floor_price", original_quote["total"] * 0.88)
    original_total = original_quote["total"]
    guest_count = original_quote["guest_count"]

    # Determine requested total
    if requested_per_head and not requested_total:
        requested_total = requested_per_head * guest_count
    elif not requested_total:
        return {"error": "Provide either requested_total or requested_per_head."}

    discount_pct = ((original_total - requested_total) / original_total) * 100
    max_discount = config.NEGOTIATION["max_discount_pct"]

    # ── Check for fill-gap bonus ──────────────────────────────────
    extra_discount = 0
    if event_date and event_date.month in config.OFF_PEAK_MONTHS:
        extra_discount += config.NEGOTIATION["fill_gap_discount_pct"]

    if add_ons_offered and len(add_ons_offered) >= 2:
        extra_discount += config.NEGOTIATION["bundle_discount_pct"]

    effective_max_discount = min(max_discount + extra_discount, 20)  # hard cap at 20%

    # ── Too many rounds → walk away ───────────────────────────────
    if negotiation_round > config.NEGOTIATION["max_rounds"]:
        return {
            "decision": "reject",
            "original_total": original_total,
            "requested_total": requested_total,
            "counter_total": None,
            "counter_per_head": None,
            "message": (
                "We've reached the limit of our flexibility on pricing. "
                "Our best offer remains on the table. We'd love to work with you — "
                "let us know if the last offer works."
            ),
            "round": negotiation_round,
            "sweeteners": [],
        }

    # ── Auto-accept if within margin ──────────────────────────────
    if requested_total >= floor_price and discount_pct <= effective_max_discount:
        return {
            "decision": "accept",
            "original_total": original_total,
            "requested_total": requested_total,
            "accepted_total": requested_total,
            "accepted_per_head": round(requested_total / guest_count, 2),
            "message": "We're happy to accept this price. Let's lock in your date!",
            "round": negotiation_round,
            "sweeteners": [],
        }

    # ── Below floor → reject with explanation ─────────────────────
    if requested_total < floor_price:
        # Offer our best possible price
        best_price = floor_price
        return {
            "decision": "counter",
            "original_total": original_total,
            "requested_total": requested_total,
            "counter_total": round(best_price),
            "counter_per_head": round(best_price / guest_count, 2),
            "message": (
                f"We appreciate the offer, but ${requested_total:,.0f} is below what we can do. "
                f"Our absolute best is ${best_price:,.0f} (${best_price/guest_count:.0f}/head). "
                f"This is a {((original_total - best_price)/original_total)*100:.0f}% discount from our standard rate."
            ),
            "round": negotiation_round,
            "sweeteners": _generate_sweeteners(negotiation_round),
        }

    # ── Counter-offer: step down from original ────────────────────
    steps_taken = negotiation_round * config.NEGOTIATION["counter_offer_step_pct"]
    counter_discount = min(steps_taken, effective_max_discount) / 100
    counter_total = round(original_total * (1 - counter_discount))

    # Don't counter below floor
    counter_total = max(counter_total, floor_price)

    return {
        "decision": "counter",
        "original_total": original_total,
        "requested_total": requested_total,
        "counter_total": counter_total,
        "counter_per_head": round(counter_total / guest_count, 2),
        "message": (
            f"We can meet you partway — how about ${counter_total:,.0f} "
            f"(${counter_total/guest_count:.0f}/head)? "
            f"That's {((original_total - counter_total)/original_total)*100:.0f}% off our standard rate."
        ),
        "round": negotiation_round,
        "sweeteners": _generate_sweeteners(negotiation_round),
    }


def _generate_sweeteners(negotiation_round: int) -> list[str]:
    """Offer extras to close the deal as rounds increase."""
    sweeteners = []
    if negotiation_round >= 1:
        sweeteners.append("Complimentary tasting for up to 4 guests")
    if negotiation_round >= 2:
        sweeteners.append("Complimentary espresso station upgrade")
    if negotiation_round >= 3:
        sweeteners.append("Complimentary late-night snack station for up to 50 guests")
    if negotiation_round >= 4:
        sweeteners.append("15% off add-ons booked within 48 hours")
    return sweeteners
