"""
Skill: Booking Management
=========================
Handles date holds, booking confirmations, and cancellation policy.
"""

from datetime import date, datetime, timedelta
from typing import Optional
from .. import config

# In-memory booking state (would be a database in production)
_held_dates: dict[str, dict] = {}
_confirmed_bookings: dict[str, dict] = {}


def hold_date(
    event_date: date,
    guest_count: int,
    quote_id: str,
    planner_agent_id: str,
    hold_days: int = 7,
) -> dict:
    """
    Place a temporary hold on a date. Holds expire automatically.

    Returns:
        {
            "hold_id": str,
            "status": "held" | "conflict",
            "expires": str,
            "message": str,
        }
    """
    hold_key = event_date.isoformat()

    # Check if date already held by someone else
    if hold_key in _held_dates:
        existing = _held_dates[hold_key]
        if existing["planner_agent_id"] != planner_agent_id:
            expiry = datetime.fromisoformat(existing["expires"])
            if expiry > datetime.now():
                return {
                    "hold_id": None,
                    "status": "conflict",
                    "expires": None,
                    "message": (
                        f"This date is currently held by another client. "
                        f"The hold expires on {existing['expires']}. "
                        f"We can notify you if it becomes available."
                    ),
                    "waitlist_available": True,
                }
            else:
                # Hold expired, remove it
                del _held_dates[hold_key]

    hold_id = f"HOLD-{event_date.strftime('%Y%m%d')}-{guest_count}"
    expires = (datetime.now() + timedelta(days=hold_days)).isoformat()

    _held_dates[hold_key] = {
        "hold_id": hold_id,
        "event_date": event_date.isoformat(),
        "guest_count": guest_count,
        "quote_id": quote_id,
        "planner_agent_id": planner_agent_id,
        "expires": expires,
        "created": datetime.now().isoformat(),
    }

    return {
        "hold_id": hold_id,
        "status": "held",
        "expires": expires,
        "message": (
            f"Date held for {hold_days} days. "
            f"Please confirm with a 25% deposit "
            f"by {expires[:10]} to secure your booking."
        ),
        "next_steps": [
            "Schedule a tasting (if applicable)",
            "Finalize menu selections",
            "Submit signed contract and deposit",
        ],
    }


def confirm_booking(
    hold_id: str,
    quote_id: str,
    final_guest_count: int,
    menu_id: str,
    service_style: str,
    deposit_received: bool = False,
    contract_signed: bool = False,
    special_notes: Optional[str] = None,
) -> dict:
    """
    Confirm a booking from a held date.

    Returns:
        {
            "booking_id": str,
            "status": "confirmed" | "pending_deposit" | "pending_contract" | "error",
            "message": str,
            "timeline": [...],
        }
    """
    # Find the hold
    held = None
    for key, hold_data in _held_dates.items():
        if hold_data["hold_id"] == hold_id:
            held = hold_data
            break

    if not held:
        return {
            "booking_id": None,
            "status": "error",
            "message": f"Hold '{hold_id}' not found or has expired. Please request a new quote.",
        }

    # Check deposit and contract
    if not contract_signed:
        return {
            "booking_id": None,
            "status": "pending_contract",
            "message": "Please sign and return the catering contract before we can confirm.",
            "contract_url": f"https://altara.ai/contracts/{quote_id}",
        }

    if not deposit_received:
        return {
            "booking_id": None,
            "status": "pending_deposit",
            "message": "Please submit the 25% deposit to confirm your booking.",
            "payment_url": f"https://altara.ai/pay/{quote_id}",
        }

    # Confirm!
    event_date = held["event_date"]
    booking_id = f"BK-{event_date.replace('-', '')}-{final_guest_count}"

    event_date_obj = date.fromisoformat(event_date)

    _confirmed_bookings[booking_id] = {
        "booking_id": booking_id,
        "event_date": event_date,
        "guest_count": final_guest_count,
        "menu_id": menu_id,
        "service_style": service_style,
        "quote_id": quote_id,
        "special_notes": special_notes,
        "confirmed_at": datetime.now().isoformat(),
    }

    # Build timeline
    timeline = [
        {
            "milestone": "Booking confirmed",
            "date": date.today().isoformat(),
            "status": "complete",
        },
        {
            "milestone": "Schedule tasting",
            "date": (date.today() + timedelta(days=14)).isoformat(),
            "status": "upcoming",
        },
        {
            "milestone": "Menu finalization deadline",
            "date": (event_date_obj - timedelta(days=60)).isoformat(),
            "status": "upcoming",
        },
        {
            "milestone": "Second payment due (25%)",
            "date": (event_date_obj - timedelta(days=60)).isoformat(),
            "status": "upcoming",
        },
        {
            "milestone": "Final guest count due",
            "date": (event_date_obj - timedelta(days=14)).isoformat(),
            "status": "upcoming",
        },
        {
            "milestone": "Third payment due (25%)",
            "date": (event_date_obj - timedelta(days=14)).isoformat(),
            "status": "upcoming",
        },
        {
            "milestone": "Final walkthrough with venue",
            "date": (event_date_obj - timedelta(days=7)).isoformat(),
            "status": "upcoming",
        },
        {
            "milestone": "Event day — final payment due",
            "date": event_date,
            "status": "upcoming",
        },
    ]

    # Remove the hold
    hold_key = event_date
    if hold_key in _held_dates:
        del _held_dates[hold_key]

    return {
        "booking_id": booking_id,
        "status": "confirmed",
        "message": (
            f"Congratulations! Your catering is confirmed for {event_date} "
            f"({final_guest_count} guests, {service_style} {menu_id}). "
            f"We can't wait to be part of your special day!"
        ),
        "timeline": timeline,
        "cancellation_policy": {
            "full_refund_before_days": 90,
            "50pct_refund_before_days": 60,
            "no_refund_before_days": 30,
        },
        "your_contact": {
            "name": "Maria Russo",
            "role": "Event Coordinator",
            "email": "maria@bellatavola.com",
            "phone": "(617) 555-0142",
        },
    }
