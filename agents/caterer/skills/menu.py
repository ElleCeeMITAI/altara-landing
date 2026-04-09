"""
Skill: Menu Management
======================
Retrieves menu templates, filters by cuisine/tier/dietary needs,
and builds custom menus from available options.
"""

from typing import Optional
from .. import config


def get_menus(
    cuisine: Optional[str] = None,
    tier: Optional[str] = None,
    dietary_needs: Optional[list[str]] = None,
    service_style: Optional[str] = None,
) -> dict:
    """
    Return available menus, optionally filtered.

    Returns:
        {
            "menus": [...],
            "service_styles": [...],
            "add_ons": [...],
        }
    """
    menus = []

    for key, template in config.MENU_TEMPLATES.items():
        # Filter by cuisine
        if cuisine and cuisine.lower() not in template["cuisine"].lower():
            continue

        # Filter by tier
        if tier and template["tier"] != tier:
            continue

        menu_entry = {
            "id": key,
            "name": template["name"],
            "cuisine": template["cuisine"],
            "tier": template["tier"],
            "courses": template["courses"],
            "price_range": _get_price_range(template["tier"]),
        }

        # Check dietary compatibility
        if dietary_needs:
            compatibility = _check_menu_dietary_compatibility(template, dietary_needs)
            menu_entry["dietary_compatibility"] = compatibility

        menus.append(menu_entry)

    # Available service styles with descriptions
    service_styles = [
        {
            "id": "plated",
            "name": "Plated Dinner",
            "description": "Elegant multi-course meal served to each guest at the table.",
        },
        {
            "id": "buffet",
            "name": "Buffet",
            "description": "Self-serve stations with a wide variety of options.",
        },
        {
            "id": "family_style",
            "name": "Family Style",
            "description": "Shared platters served to each table for a communal feel.",
        },
        {
            "id": "stations",
            "name": "Food Stations",
            "description": "Themed food stations (carving, pasta, sushi, etc.).",
        },
        {
            "id": "cocktail_reception",
            "name": "Cocktail Reception",
            "description": "Heavy hors d'oeuvres and small plates, no formal seating.",
        },
    ]

    if service_style:
        service_styles = [s for s in service_styles if s["id"] == service_style]

    # Available add-ons
    add_ons = [
        {"id": k, **v} for k, v in config.ADD_ONS.items()
    ]

    return {
        "menus": menus,
        "service_styles": service_styles,
        "add_ons": add_ons,
    }


def build_custom_menu(
    base_menu_id: str,
    substitutions: Optional[dict] = None,
    add_courses: Optional[dict] = None,
    remove_courses: Optional[list[str]] = None,
    dietary_needs: Optional[list[str]] = None,
) -> dict:
    """
    Build a customized menu from a base template.

    Args:
        base_menu_id: Key from MENU_TEMPLATES
        substitutions: {"course": {"old_item": "new_item"}}
        add_courses: {"course": ["new_item"]}
        remove_courses: ["course_name"] to remove entirely
        dietary_needs: List of dietary requirements to validate against

    Returns:
        Customized menu dict with feasibility notes.
    """
    if base_menu_id not in config.MENU_TEMPLATES:
        return {"error": f"Menu '{base_menu_id}' not found.", "available_menus": list(config.MENU_TEMPLATES.keys())}

    template = config.MENU_TEMPLATES[base_menu_id]
    custom_courses = {}

    for course, items in template["courses"].items():
        if remove_courses and course in remove_courses:
            continue
        custom_courses[course] = list(items)  # copy

    # Apply substitutions
    if substitutions:
        for course, swaps in substitutions.items():
            if course in custom_courses:
                for old_item, new_item in swaps.items():
                    if old_item in custom_courses[course]:
                        idx = custom_courses[course].index(old_item)
                        custom_courses[course][idx] = new_item

    # Add extra items
    if add_courses:
        for course, new_items in add_courses.items():
            if course not in custom_courses:
                custom_courses[course] = []
            custom_courses[course].extend(new_items)

    # Dietary validation
    dietary_notes = []
    if dietary_needs:
        for need in dietary_needs:
            accommodation = config.DIETARY_ACCOMMODATIONS.get(need)
            if accommodation and accommodation["supported"]:
                if accommodation["upcharge"] > 0:
                    dietary_notes.append(
                        f"{need}: +${accommodation['upcharge']}/head upcharge applies"
                    )
                else:
                    dietary_notes.append(f"{need}: fully supported, no upcharge")
            elif accommodation and not accommodation["supported"]:
                dietary_notes.append(f"{need}: not supported")
            else:
                dietary_notes.append(f"{need}: please inquire — custom accommodation may be possible")

    return {
        "base_menu": template["name"],
        "tier": template["tier"],
        "courses": custom_courses,
        "dietary_notes": dietary_notes,
        "customization_fee": 0 if not substitutions else 200,
        "note": "Custom menus include a complimentary tasting for the couple.",
    }


def _get_price_range(tier: str) -> dict:
    """Get min/max per-head price for a tier across all service styles."""
    prices = []
    for style_prices in config.BASE_PRICING.values():
        if tier in style_prices:
            prices.append(style_prices[tier])
    if prices:
        return {"min": min(prices), "max": max(prices), "currency": "USD", "unit": "per_head"}
    return {"min": 0, "max": 0, "currency": "USD", "unit": "per_head"}


def _check_menu_dietary_compatibility(template: dict, dietary_needs: list[str]) -> dict:
    """Check how well a menu can accommodate dietary requirements."""
    compatibility = {}
    for need in dietary_needs:
        acc = config.DIETARY_ACCOMMODATIONS.get(need)
        if acc and acc["supported"]:
            compatibility[need] = {
                "supported": True,
                "upcharge": acc["upcharge"],
                "note": "Full menu can be adapted" if acc["max_pct"] == 100 else f"Up to {acc['max_pct']}% of guests",
            }
        elif acc:
            compatibility[need] = {"supported": False, "note": "Not available for this menu"}
        else:
            compatibility[need] = {"supported": False, "note": "Unknown dietary requirement — please inquire"}
    return compatibility
