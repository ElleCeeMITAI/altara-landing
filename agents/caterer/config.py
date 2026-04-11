"""
Grand Meridian Ballroom Catering — Private Business Configuration
=======================================================
This represents the vendor's PRIVATE state that is never exposed publicly.
The agent uses this to make decisions, generate quotes, and negotiate.
"""

from datetime import date, timedelta

# ── Identity ──────────────────────────────────────────────────────────
VENDOR_NAME = "Grand Meridian Ballroom Catering"
VENDOR_ID = "grand-meridian-ballroom-catering"

# ── Service Regions ───────────────────────────────────────────────────
SERVICE_REGIONS = ["Greater Boston", "Cape Cod", "Rhode Island", "Southern NH"]
TRAVEL_SURCHARGE = {
    "Greater Boston": 0,
    "Cape Cod": 500,
    "Rhode Island": 750,
    "Southern NH": 600,
}

# ── Capacity ──────────────────────────────────────────────────────────
MIN_GUESTS = 20
MAX_GUESTS = 500
STAFF_PER_GUESTS = {
    "plated": 10,       # 1 server per 10 guests
    "buffet": 25,       # 1 server per 25 guests
    "family_style": 15,
    "stations": 20,
    "cocktail_reception": 30,
}
MAX_STAFF_AVAILABLE = 50

# ── Pricing (per head, in USD) ────────────────────────────────────────
BASE_PRICING = {
    "plated": {
        "standard": 95,
        "premium": 135,
        "luxury": 185,
    },
    "buffet": {
        "standard": 75,
        "premium": 110,
        "luxury": 155,
    },
    "family_style": {
        "standard": 85,
        "premium": 125,
        "luxury": 170,
    },
    "stations": {
        "standard": 90,
        "premium": 130,
        "luxury": 180,
    },
    "cocktail_reception": {
        "standard": 55,
        "premium": 80,
        "luxury": 115,
    },
}

# ── Volume Discounts ──────────────────────────────────────────────────
VOLUME_DISCOUNTS = [
    (200, 0.05),   # 5% off for 200+ guests
    (300, 0.08),   # 8% off for 300+ guests
    (400, 0.10),   # 10% off for 400+ guests
]

# ── Seasonal Adjustments ─────────────────────────────────────────────
PEAK_MONTHS = [5, 6, 9, 10]        # May, June, Sep, Oct
OFF_PEAK_MONTHS = [1, 2, 3, 11]    # Jan, Feb, Mar, Nov
PEAK_SURCHARGE = 0.15               # +15%
OFF_PEAK_DISCOUNT = 0.10            # -10%

# ── Day-of-Week Adjustments ──────────────────────────────────────────
SATURDAY_SURCHARGE = 0.0            # Already priced in
FRIDAY_DISCOUNT = 0.05              # -5%
SUNDAY_DISCOUNT = 0.08              # -8%
WEEKDAY_DISCOUNT = 0.15             # -15%

# ── Minimum Spend ─────────────────────────────────────────────────────
MINIMUM_SPEND = 3000

# ── Add-Ons ───────────────────────────────────────────────────────────
ADD_ONS = {
    "late_night_snack": {"per_head": 15, "description": "Late-night snack station (sliders, pizza, fries)"},
    "raw_bar": {"per_head": 25, "description": "Raw bar with oysters, shrimp, ceviche"},
    "dessert_table": {"per_head": 12, "description": "Dessert table with assorted pastries and sweets"},
    "craft_cocktail_bar": {"per_head": 18, "description": "Craft cocktail bar with 3 signature drinks"},
    "espresso_station": {"per_head": 8, "description": "Espresso and cappuccino station"},
    "kids_menu": {"per_head": 35, "description": "Kid-friendly plated meal (flat rate per child)"},
    "cake_cutting_service": {"flat": 150, "description": "Cake cutting and plating service"},
}

# ── Dietary Capabilities ──────────────────────────────────────────────
DIETARY_ACCOMMODATIONS = {
    "vegetarian": {"supported": True, "upcharge": 0, "max_pct": 100},
    "vegan": {"supported": True, "upcharge": 0, "max_pct": 100},
    "gluten_free": {"supported": True, "upcharge": 5, "max_pct": 100},
    "dairy_free": {"supported": True, "upcharge": 0, "max_pct": 100},
    "nut_free": {"supported": True, "upcharge": 0, "max_pct": 100},
    "kosher": {"supported": True, "upcharge": 25, "max_pct": 50},
    "halal": {"supported": True, "upcharge": 15, "max_pct": 100},
    "shellfish_free": {"supported": True, "upcharge": 0, "max_pct": 100},
    "low_sodium": {"supported": True, "upcharge": 0, "max_pct": 100},
    "paleo": {"supported": True, "upcharge": 10, "max_pct": 30},
    "keto": {"supported": True, "upcharge": 10, "max_pct": 30},
}

# ── Menu Templates ────────────────────────────────────────────────────
MENU_TEMPLATES = {
    "italian_classic": {
        "name": "Italian Classic",
        "cuisine": "Italian-American",
        "courses": {
            "appetizer": ["Bruschetta Trio", "Burrata with Heirloom Tomatoes", "Arancini"],
            "salad": ["Caesar Salad", "Mixed Greens with Balsamic Vinaigrette"],
            "entree": [
                "Chicken Parmigiana",
                "Pan-Seared Salmon with Lemon Caper Sauce",
                "Braised Short Rib with Polenta",
                "Eggplant Rollatini (V)",
            ],
            "side": ["Roasted Seasonal Vegetables", "Garlic Mashed Potatoes", "Risotto"],
            "dessert": ["Tiramisu", "Cannoli", "Panna Cotta"],
        },
        "tier": "premium",
    },
    "new_england_harvest": {
        "name": "New England Harvest",
        "cuisine": "New England",
        "courses": {
            "appetizer": ["Lobster Bisque Shooters", "New England Clam Chowder Bread Bowls"],
            "salad": ["Autumn Harvest Salad with Cranberry Vinaigrette"],
            "entree": [
                "Roasted Cod with Brown Butter",
                "Herb-Crusted Prime Rib",
                "Maple-Glazed Duck Breast",
                "Stuffed Butternut Squash (V)",
            ],
            "side": ["Roasted Root Vegetables", "Wild Rice Pilaf", "Corn Bread"],
            "dessert": ["Apple Crisp", "Blueberry Buckle", "Maple Creme Brulee"],
        },
        "tier": "premium",
    },
    "farm_to_table": {
        "name": "Seasonal Farm-to-Table",
        "cuisine": "Farm-to-Table",
        "courses": {
            "appetizer": ["Local Cheese Board", "Seasonal Soup du Jour"],
            "salad": ["Farm Greens with Herb Vinaigrette"],
            "entree": [
                "Free-Range Chicken with Seasonal Compote",
                "Grass-Fed Filet Mignon",
                "Wild-Caught Halibut",
                "Vegetable Tasting Plate (V/GF)",
            ],
            "side": ["Grilled Local Vegetables", "Potato Gratin", "Quinoa Tabbouleh"],
            "dessert": ["Seasonal Fruit Tart", "Chocolate Ganache Cake", "Cheese Course"],
        },
        "tier": "luxury",
    },
    "mediterranean_garden": {
        "name": "Mediterranean Garden",
        "cuisine": "Mediterranean",
        "courses": {
            "appetizer": ["Mezze Platter", "Grilled Halloumi Skewers"],
            "salad": ["Greek Salad", "Fattoush"],
            "entree": [
                "Lamb Chops with Tzatziki",
                "Grilled Swordfish with Olive Tapenade",
                "Chicken Souvlaki",
                "Moussaka (V option available)",
            ],
            "side": ["Roasted Mediterranean Vegetables", "Couscous", "Warm Pita"],
            "dessert": ["Baklava", "Loukoumades", "Galaktoboureko"],
        },
        "tier": "premium",
    },
    "budget_friendly": {
        "name": "Simply Elegant",
        "cuisine": "Italian-American",
        "courses": {
            "appetizer": ["House Bruschetta"],
            "salad": ["Garden Salad with House Dressing"],
            "entree": [
                "Grilled Chicken Marsala",
                "Penne alla Vodka (V)",
                "Baked Haddock",
            ],
            "side": ["Roasted Vegetables", "Roasted Potatoes"],
            "dessert": ["Assorted Cookie Platter"],
        },
        "tier": "standard",
    },
}

# ── Blackout Dates (already booked or unavailable) ────────────────────
BLACKOUT_DATES = [
    date(2026, 5, 23),
    date(2026, 6, 6),
    date(2026, 6, 13),
    date(2026, 6, 20),
    date(2026, 7, 4),
    date(2026, 9, 5),
    date(2026, 9, 12),
    date(2026, 10, 3),
    date(2026, 10, 10),
    date(2026, 10, 17),
    date(2026, 12, 24),
    date(2026, 12, 25),
    date(2026, 12, 31),
]

# ── Existing Bookings (date → guest count committed) ──────────────────
EXISTING_BOOKINGS = {
    date(2026, 5, 16): 180,
    date(2026, 5, 30): 220,
    date(2026, 6, 27): 150,
    date(2026, 7, 11): 100,
    date(2026, 8, 8): 250,
    date(2026, 8, 15): 300,
    date(2026, 9, 19): 200,
    date(2026, 9, 26): 175,
    date(2026, 10, 24): 280,
}

# ── Negotiation Rules (PRIVATE — never exposed) ──────────────────────
NEGOTIATION = {
    "max_discount_pct": 12,                # Absolute floor: never go below 12% off
    "auto_accept_margin_pct": 20,          # Auto-accept if margin >= 20%
    "counter_offer_step_pct": 3,           # Each counter drops by 3%
    "max_rounds": 4,                       # Walk away after 4 rounds
    "bundle_discount_pct": 5,              # Extra 5% if booking dessert + late-night
    "fill_gap_discount_pct": 8,            # Extra 8% off for filling a slow month
    "minimum_margin_pct": 15,              # Never go below 15% margin
    "cost_basis_pct_of_price": 55,         # ~55% of price is hard cost
}

# ── Tasting Policy ────────────────────────────────────────────────────
TASTING_POLICY = {
    "complimentary_threshold": 5000,   # Free tasting if estimated spend > $5K
    "tasting_fee": 250,                # Otherwise $250 (credited toward booking)
    "max_guests_at_tasting": 4,
}
