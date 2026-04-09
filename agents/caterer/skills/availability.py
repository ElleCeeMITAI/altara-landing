"""
Skill: Check Availability
=========================
Determines whether the caterer can serve a given date, guest count,
and region — factoring in blackout dates, existing bookings, staffing
capacity, and advance-booking requirements.
"""

from datetime import date, timedelta
from typing import Optional
from .. import config


def check_availability(
    event_date: date,
    guest_count: int,
    region: str,
    service_style: str = "plated",
) -> dict:
    """
    Check if the caterer can serve the requested event.

    Returns:
        {
            "available": bool,
            "reason": str | None,
            "date": str,
            "guest_count": int,
            "capacity_remaining": int | None,
            "suggested_alternatives": list[str] | None,
        }
    """
    result = {
        "available": False,
        "reason": None,
        "date": event_date.isoformat(),
        "guest_count": guest_count,
        "capacity_remaining": None,
        "suggested_alternatives": None,
    }

    # ── Region check ──────────────────────────────────────────────
    if region not in config.SERVICE_REGIONS:
        result["reason"] = (
            f"Region '{region}' is outside our service area. "
            f"We serve: {', '.join(config.SERVICE_REGIONS)}."
        )
        return result

    # ── Advance booking check ─────────────────────────────────────
    days_until = (event_date - date.today()).days
    if days_until < config.CONSTRAINTS_MIN_ADVANCE:
        result["reason"] = (
            f"We require at least {config.CONSTRAINTS_MIN_ADVANCE} days advance booking. "
            f"Your event is only {days_until} days away."
        )
        return result

    # ── Blackout date check ───────────────────────────────────────
    if event_date in config.BLACKOUT_DATES:
        result["reason"] = "This date is unavailable (fully booked or blacked out)."
        alternatives = _find_nearby_dates(event_date, guest_count, service_style)
        if alternatives:
            result["suggested_alternatives"] = alternatives
        return result

    # ── Guest count bounds ────────────────────────────────────────
    if guest_count < config.MIN_GUESTS:
        result["reason"] = f"Minimum guest count is {config.MIN_GUESTS}."
        return result

    if guest_count > config.MAX_GUESTS:
        result["reason"] = f"Maximum guest count is {config.MAX_GUESTS}."
        return result

    # ── Staffing capacity check ───────────────────────────────────
    servers_per = config.STAFF_PER_GUESTS.get(service_style, 15)
    servers_needed = -(-guest_count // servers_per)  # ceiling division
    existing_guests = config.EXISTING_BOOKINGS.get(event_date, 0)
    existing_servers = -(-existing_guests // servers_per) if existing_guests else 0
    servers_available = config.MAX_STAFF_AVAILABLE - existing_servers

    if servers_needed > servers_available:
        max_additional_guests = servers_available * servers_per
        result["reason"] = (
            f"We have an existing booking on this date for {existing_guests} guests. "
            f"We can accommodate up to {max_additional_guests} additional guests "
            f"for {service_style} service."
        )
        result["capacity_remaining"] = max_additional_guests
        alternatives = _find_nearby_dates(event_date, guest_count, service_style)
        if alternatives:
            result["suggested_alternatives"] = alternatives
        return result

    # ── All checks passed ─────────────────────────────────────────
    capacity_remaining = (servers_available - servers_needed) * servers_per
    result["available"] = True
    result["capacity_remaining"] = capacity_remaining
    result["reason"] = "Date is available."
    return result


def _find_nearby_dates(
    target: date,
    guest_count: int,
    service_style: str,
    search_range: int = 14,
) -> list[str]:
    """Find up to 3 available dates within ±search_range days."""
    alternatives = []
    for delta in range(-search_range, search_range + 1):
        if delta == 0:
            continue
        candidate = target + timedelta(days=delta)
        if candidate < date.today() + timedelta(days=config.CONSTRAINTS_MIN_ADVANCE):
            continue
        if candidate in config.BLACKOUT_DATES:
            continue
        # Quick capacity check
        existing = config.EXISTING_BOOKINGS.get(candidate, 0)
        servers_per = config.STAFF_PER_GUESTS.get(service_style, 15)
        servers_needed = -(-guest_count // servers_per)
        existing_servers = -(-existing // servers_per) if existing else 0
        if servers_needed <= config.MAX_STAFF_AVAILABLE - existing_servers:
            alternatives.append(candidate.isoformat())
            if len(alternatives) >= 3:
                break
    return alternatives


# Convenience alias
CONSTRAINTS_MIN_ADVANCE = 30
# Monkey-patch into config for cleanliness
if not hasattr(config, "CONSTRAINTS_MIN_ADVANCE"):
    config.CONSTRAINTS_MIN_ADVANCE = CONSTRAINTS_MIN_ADVANCE
