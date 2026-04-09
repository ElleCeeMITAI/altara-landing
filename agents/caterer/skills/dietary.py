"""
Skill: Dietary Accommodation
=============================
Evaluates dietary requirements for a guest list and determines
what the caterer can and cannot accommodate, with cost implications.
"""

from typing import Optional
from .. import config


def accommodate_dietary(
    dietary_breakdown: dict[str, int],
    total_guests: int,
    menu_id: Optional[str] = None,
) -> dict:
    """
    Evaluate dietary accommodation feasibility for a guest list.

    Args:
        dietary_breakdown: {"vegan": 15, "gluten_free": 8, "kosher": 5, ...}
        total_guests: Total guest count
        menu_id: Optional menu template to check against

    Returns:
        {
            "feasible": bool,
            "accommodations": [...],
            "total_dietary_upcharge": float,
            "recommendations": [...],
            "warnings": [...],
        }
    """
    accommodations = []
    recommendations = []
    warnings = []
    total_upcharge = 0.0
    feasible = True

    for need, count in dietary_breakdown.items():
        need_lower = need.lower().replace("-", "_").replace(" ", "_")
        acc = config.DIETARY_ACCOMMODATIONS.get(need_lower)

        if not acc:
            warnings.append(
                f"'{need}' is not a standard dietary category. "
                f"We may be able to accommodate — please discuss with our chef."
            )
            accommodations.append({
                "dietary_need": need,
                "guest_count": count,
                "supported": None,
                "status": "requires_consultation",
                "upcharge_per_head": 0,
            })
            continue

        pct_of_guests = (count / total_guests) * 100 if total_guests > 0 else 0

        if not acc["supported"]:
            feasible = False
            warnings.append(
                f"'{need}' cannot be accommodated. Consider a specialty caterer for these {count} guests."
            )
            accommodations.append({
                "dietary_need": need,
                "guest_count": count,
                "supported": False,
                "status": "not_available",
                "upcharge_per_head": 0,
            })
            continue

        if pct_of_guests > acc["max_pct"]:
            warnings.append(
                f"'{need}' requested for {count} guests ({pct_of_guests:.0f}%), "
                f"but we can only accommodate up to {acc['max_pct']}% of guests. "
                f"Max: {int(total_guests * acc['max_pct'] / 100)} guests."
            )
            feasible = False

        upcharge = acc["upcharge"] * count
        total_upcharge += upcharge

        status = "fully_supported"
        if acc["upcharge"] > 0:
            status = "supported_with_upcharge"

        accommodations.append({
            "dietary_need": need,
            "guest_count": count,
            "pct_of_total": round(pct_of_guests, 1),
            "supported": True,
            "status": status,
            "upcharge_per_head": acc["upcharge"],
            "upcharge_subtotal": upcharge,
        })

    # Recommendations
    vegan_count = dietary_breakdown.get("vegan", 0)
    vegetarian_count = dietary_breakdown.get("vegetarian", 0)
    plant_based_total = vegan_count + vegetarian_count

    if plant_based_total > total_guests * 0.3:
        recommendations.append(
            "With 30%+ plant-based guests, we recommend our Farm-to-Table menu "
            "which has the strongest vegetable-forward options."
        )

    if "kosher" in dietary_breakdown and "halal" in dietary_breakdown:
        recommendations.append(
            "For events with both kosher and halal requirements, our Mediterranean Garden "
            "menu provides the most overlap-friendly base."
        )

    gf_count = dietary_breakdown.get("gluten_free", 0)
    if gf_count > total_guests * 0.2:
        recommendations.append(
            "With significant gluten-free needs, consider our family-style service "
            "which allows us to prepare separate GF platters efficiently."
        )

    if menu_id and menu_id in config.MENU_TEMPLATES:
        menu = config.MENU_TEMPLATES[menu_id]
        recommendations.append(
            f"The '{menu['name']}' menu can be adapted for all supported dietary needs listed above."
        )

    return {
        "feasible": feasible,
        "total_guests": total_guests,
        "guests_with_dietary_needs": sum(dietary_breakdown.values()),
        "accommodations": accommodations,
        "total_dietary_upcharge": total_upcharge,
        "recommendations": recommendations,
        "warnings": warnings,
    }
