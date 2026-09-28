import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from sqlmodel import Session, select

from app.config import settings
from app.models.property import Property
from app.models.obstacle import Obstacle
from app.models.bed import GardenBed
from app.models.plant import PlantSpecies
from app.models.placement import PlantPlacement
from app.api.v1.property import get_or_create_default_property
from app.services.shadows import calculate_daily_sunlight_analysis
from app.services.blooms import calculate_monthly_bloom_states
from app.services.enrichment import enrich_plant_with_llm

logger = logging.getLogger(__name__)

HERMES_SYSTEM_PROMPT = """You are Hermes, an expert landscape architect and botanical assistant managing this garden.
You have tools to query the garden layout, inspect solar shadows and sunlight hours, look up plants, and place plants into garden beds.

Garden Guidelines:
1. Coordinate space: (0, 0) is top-left in meters. X goes right (East if North is up), Y goes down (South if North is up).
2. Sunlight ratings: Full Sun requires >= 6.0 hours of direct sun. Partial Shade requires 3.0-6.0 hours. Full Shade is < 3.0 hours.
3. Always check sunlight analysis before placing sun-loving plants to ensure they will thrive.
4. Be helpful, concise, and explain why you placed or recommended specific cultivars.
"""

HERMES_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_garden_overview",
            "description": "Get current property boundaries, orientation, garden beds, and obstacles (house, fences, trees).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_bed_sunlight_analysis",
            "description": "Calculate direct sunlight hours and exposure rating (full_sun, partial_shade, full_shade) for all garden beds on a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_str": {
                        "type": "string",
                        "description": "ISO date YYYY-MM-DD (e.g. 2026-06-21 for summer solstice)",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_bloom_calendar",
            "description": "Get all placed plants and whether they bloom in a given month (1-12) with flower colors.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {
                        "type": "integer",
                        "description": "Month number 1 to 12",
                    }
                },
                "required": ["month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "catalog_and_place_plant",
            "description": "Enrich a plant's botanical profile and place it at specific coordinates (x, y) in a garden bed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "bed_id": {"type": "integer", "description": "ID of the target garden bed"},
                    "plant_name": {"type": "string", "description": "Common or botanical name, e.g. 'Lavender Munstead'"},
                    "x": {"type": "number", "description": "X coordinate in meters"},
                    "y": {"type": "number", "description": "Y coordinate in meters"},
                },
                "required": ["bed_id", "plant_name", "x", "y"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_obstacle",
            "description": "Add an obstacle (house, fence, wall, tree) that casts shadows.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of obstacle, e.g. 'North Fence'"},
                    "type": {
                        "type": "string",
                        "enum": [
                            "house",
                            "neighbor_house",
                            "shed",
                            "fence",
                            "wall",
                            "tree",
                            "paved_sidewalk",
                            "table",
                            "bench",
                            "chair",
                            "terrace_cover",
                            "compost_pile",
                            "custom",
                        ],
                    },
                    "polygon_coords": {
                        "type": "array",
                        "items": {"type": "array", "items": {"type": "number"}},
                        "description": "List of 2D vertices [[x1, y1], [x2, y2], ...]",
                    },
                    "height_m": {"type": "number", "description": "Height in meters"},
                    "opacity": {"type": "number", "description": "1.0 for solid, 0.6 for trees"},
                },
                "required": ["name", "polygon_coords", "height_m"],
            },
        },
    },
]


def execute_agent_tool(tool_name: str, tool_args: Dict[str, Any], session: Session) -> Dict[str, Any]:
    """Execute a tool called by Hermes or another agent."""
    prop = get_or_create_default_property(session)

    if tool_name == "get_garden_overview":
        beds = session.exec(select(GardenBed).where(GardenBed.property_id == prop.id)).all()
        obstacles = session.exec(select(Obstacle).where(Obstacle.property_id == prop.id)).all()
        placements = session.exec(select(PlantPlacement)).all()
        return {
            "property": {
                "name": prop.name,
                "width_m": prop.width_m,
                "height_m": prop.height_m,
                "north_angle_deg": prop.north_angle_deg,
                "latitude": prop.latitude,
                "longitude": prop.longitude,
            },
            "beds": [{"id": b.id, "name": b.name, "zone": b.zone, "coords": json.loads(b.polygon_coords)} for b in beds],
            "obstacles": [
                {"id": o.id, "name": o.name, "type": o.type, "height_m": o.height_m, "coords": json.loads(o.polygon_coords)}
                for o in obstacles
            ],
            "total_plants_placed": len(placements),
        }

    elif tool_name == "get_bed_sunlight_analysis":
        from datetime import date
        date_str = tool_args.get("date_str")
        target_date = date.fromisoformat(date_str) if date_str else date.today()
        obstacles = session.exec(select(Obstacle).where(Obstacle.property_id == prop.id)).all()
        beds = session.exec(select(GardenBed).where(GardenBed.property_id == prop.id)).all()
        res = calculate_daily_sunlight_analysis(prop, obstacles, beds, target_date=target_date)
        return {
            "date": res.date_iso,
            "daylight_hours": res.daylight_hours,
            "beds": [
                {
                    "bed_id": b.bed_id,
                    "bed_name": b.bed_name,
                    "zone": b.zone,
                    "direct_sun_hours": b.direct_sun_hours,
                    "classification": b.classification,
                }
                for b in res.beds
            ],
        }

    elif tool_name == "get_bloom_calendar":
        month = tool_args.get("month", 6)
        query = (
            select(PlantPlacement, PlantSpecies)
            .join(PlantSpecies, PlantPlacement.species_id == PlantSpecies.id)
            .join(GardenBed, PlantPlacement.bed_id == GardenBed.id)
            .where(GardenBed.property_id == prop.id)
        )
        placements = session.exec(query).all()
        bloom_res = calculate_monthly_bloom_states(placements, target_month=month)
        return {
            "month": bloom_res.month_name,
            "blooming_count": bloom_res.blooming_plants_count,
            "blooming_plants": [
                {
                    "common_name": p.common_name,
                    "variety": p.variety,
                    "colors": p.bloom_colors,
                    "location": f"({p.x}, {p.y})",
                }
                for p in bloom_res.plants
                if p.is_blooming
            ],
        }

    elif tool_name == "catalog_and_place_plant":
        bed_id = tool_args["bed_id"]
        plant_name = tool_args["plant_name"]
        x = float(tool_args["x"])
        y = float(tool_args["y"])

        bed = session.get(GardenBed, bed_id)
        if not bed:
            return {"error": f"Bed {bed_id} not found"}

        # Find or create species
        species = session.exec(
            select(PlantSpecies).where(PlantSpecies.common_name.ilike(f"%{plant_name}%"))
        ).first()

        if not species:
            from app.services.enrichment import _mock_or_fallback_enrichment
            enriched = _mock_or_fallback_enrichment(plant_name)
            species = PlantSpecies(
                botanical_name=enriched.botanical_name,
                common_name=enriched.common_name,
                variety=enriched.variety,
                mature_height_m=enriched.mature_height_m,
                mature_spread_m=enriched.mature_spread_m,
                bloom_start_month=enriched.bloom_start_month,
                bloom_end_month=enriched.bloom_end_month,
                bloom_colors=json.dumps(enriched.bloom_colors),
                foliage_type=enriched.foliage_type,
                sun_requirement=enriched.sun_requirement,
                watering_needs=enriched.watering_needs,
                notes=enriched.notes,
            )
            session.add(species)
            session.commit()
            session.refresh(species)

        placement = PlantPlacement(
            bed_id=bed_id,
            species_id=species.id,
            x=x,
            y=y,
            current_height_m=species.mature_height_m,
            current_spread_m=species.mature_spread_m,
        )
        session.add(placement)
        session.commit()
        session.refresh(placement)

        return {
            "success": True,
            "placement_id": placement.id,
            "placed_plant": species.common_name,
            "coordinates": [x, y],
            "bed": bed.name,
            "bloom_months": f"{species.bloom_start_month} - {species.bloom_end_month}",
            "sun_requirement": species.sun_requirement,
        }

    elif tool_name == "create_obstacle":
        obs = Obstacle(
            property_id=prop.id,
            name=tool_args["name"],
            type=tool_args.get("type", "custom"),
            polygon_coords=json.dumps(tool_args["polygon_coords"]),
            height_m=float(tool_args["height_m"]),
            opacity=float(tool_args.get("opacity", 1.0)),
        )
        session.add(obs)
        session.commit()
        session.refresh(obs)
        return {"success": True, "obstacle_id": obs.id, "name": obs.name, "height_m": obs.height_m}

    return {"error": f"Unknown tool: {tool_name}"}


async def run_agent_turn(messages: List[Dict[str, Any]], session: Session) -> Dict[str, Any]:
    """
    Run an agent turn with Nous Hermes (or fallback local responses if offline).
    """
    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL.rstrip("/")
    model = settings.DEFAULT_LLM_MODEL

    # If no external API key, provide helpful internal agent intelligence
    if not api_key:
        last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        lower = last_user_msg.lower()

        if "sun" in lower or "shade" in lower:
            tool_data = execute_agent_tool("get_bed_sunlight_analysis", {}, session)
            summary = "\n".join([f"- **{b['bed_name']}** ({b['zone']}): {b['direct_sun_hours']}h sun ({b['classification'].replace('_', ' ')})" for b in tool_data["beds"]])
            return {
                "role": "assistant",
                "content": f"Here is the sunlight analysis for your garden beds:\n\n{summary}\n\n*Configure an LLM API key in Settings to unlock full conversational Hermes tool calling!*",
            }
        elif "bloom" in lower:
            tool_data = execute_agent_tool("get_bloom_calendar", {"month": 6}, session)
            blooming = tool_data.get("blooming_plants", [])
            if not blooming:
                return {
                    "role": "assistant",
                    "content": "No plants are currently recorded blooming in June. You can add flowering plants using the Catalog or dragging them onto beds!",
                }
            items = "\n".join([f"- **{p['common_name']}** ({p.get('variety') or ''}) at {p['location']}" for p in blooming])
            return {
                "role": "assistant",
                "content": f"Plants blooming in June:\n\n{items}",
            }
        else:
            overview = execute_agent_tool("get_garden_overview", {}, session)
            return {
                "role": "assistant",
                "content": f"Hello! I am Hermes, your garden assistant. Your property has {len(overview['beds'])} garden beds and {len(overview['obstacles'])} obstacles casting shadows. You can ask me to analyze sunlight, project blooms, or add plants. (Configure an API key in settings for autonomous tool calling!)",
            }

    # Prepare chat payload with function calling
    system_msg = {"role": "system", "content": HERMES_SYSTEM_PROMPT}
    full_messages = [system_msg] + messages

    payload = {
        "model": model,
        "messages": full_messages,
        "tools": HERMES_TOOLS,
        "tool_choice": "auto",
        "temperature": 0.2,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        res = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
        choice = data["choices"][0]
        msg = choice["message"]

        # Check if Hermes invoked tools
        tool_calls = msg.get("tool_calls", [])
        if tool_calls:
            # Execute tool calls
            tool_messages = list(full_messages)
            tool_messages.append(msg)

            for tc in tool_calls:
                func_name = tc["function"]["name"]
                args = json.loads(tc["function"]["arguments"])
                result = execute_agent_tool(func_name, args, session)
                tool_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": func_name,
                    "content": json.dumps(result),
                })

            # Get final conversational answer from Hermes with tool outputs
            second_res = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json={"model": model, "messages": tool_messages},
            )
            second_res.raise_for_status()
            final_data = second_res.json()
            return final_data["choices"][0]["message"]

        return msg
