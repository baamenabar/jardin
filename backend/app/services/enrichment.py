import json
import logging
from typing import Optional
import httpx

from app.config import settings
from app.schemas.entities import PlantSpeciesCreate

logger = logging.getLogger(__name__)

ENRICHMENT_SYSTEM_PROMPT = """You are a master botanist and horticultural data extraction assistant.
Given a plant name or cultivar, generate a valid JSON object matching this exact schema:
{
  "botanical_name": "Latin binomial name, e.g. Lavandula angustifolia",
  "common_name": "Common English name, e.g. English Lavender",
  "variety": "Cultivar name or null, e.g. Hidcote",
  "mature_height_m": 0.6,
  "mature_spread_m": 0.6,
  "bloom_start_month": 6,
  "bloom_end_month": 8,
  "bloom_colors": ["#967BB6"],
  "foliage_type": "evergreen | deciduous | perennial | annual | grass | shrub | tree",
  "sun_requirement": "full_sun | partial_shade | full_shade",
  "watering_needs": "low | medium | high",
  "hardiness_zone": "USDA Zone string, e.g. Zone 5-9 or null",
  "notes": "Short sentence summarizing soil preferences and pruning advice."
}

Rules:
1. mature_height_m and mature_spread_m MUST be realistic numbers in meters (e.g. 0.5 to 25.0).
2. bloom_start_month and bloom_end_month must be integers 1-12. If non-blooming (e.g. fern), set both to 0 or null and bloom_colors to [].
3. bloom_colors must be an array of hex color strings representing the dominant flower colors (e.g. ["#FF69B4", "#FFFFFF"]).
4. sun_requirement must be one of: "full_sun" (>=6h direct sun), "partial_shade" (3-6h sun), "full_shade" (<3h sun).
5. Output ONLY the raw JSON object, without markdown formatting, code blocks, or explanatory text.
"""


async def enrich_plant_with_llm(
    query: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> Optional[PlantSpeciesCreate]:
    """
    Query Nous Hermes (or configured LLM) to generate a complete botanical profile.
    """
    key = api_key or settings.OPENAI_API_KEY
    url = (base_url or settings.OPENAI_BASE_URL).rstrip("/")
    target_model = model or settings.DEFAULT_LLM_MODEL

    # If no API key is provided, provide an intelligent fallback for common queries
    if not key:
        return _mock_or_fallback_enrichment(query)

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": target_model,
        "messages": [
            {"role": "system", "content": ENRICHMENT_SYSTEM_PROMPT},
            {"role": "user", "content": f"Plant to catalog: {query}"},
        ],
        "temperature": 0.1,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{url}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

            # Clean markdown if model wrapped it in ```json ... ```
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                content = "\n".join(lines).strip()

            parsed = json.loads(content)
            return PlantSpeciesCreate(
                botanical_name=parsed.get("botanical_name", query),
                common_name=parsed.get("common_name", query),
                variety=parsed.get("variety"),
                mature_height_m=float(parsed.get("mature_height_m", 1.0)),
                mature_spread_m=float(parsed.get("mature_spread_m", 1.0)),
                bloom_start_month=int(parsed.get("bloom_start_month", 6)),
                bloom_end_month=int(parsed.get("bloom_end_month", 8)),
                bloom_colors=parsed.get("bloom_colors", ["#967BB6"]),
                foliage_type=parsed.get("foliage_type", "perennial"),
                sun_requirement=parsed.get("sun_requirement", "full_sun"),
                watering_needs=parsed.get("watering_needs", "medium"),
                hardiness_zone=parsed.get("hardiness_zone"),
                notes=parsed.get("notes"),
            )
    except Exception as e:
        logger.warning(f"LLM enrichment failed for '{query}': {e}. Using fallback generator.")
        return _mock_or_fallback_enrichment(query)


def _mock_or_fallback_enrichment(query: str) -> PlantSpeciesCreate:
    """Pre-curated botanical defaults for when LLM is unconfigured or offline."""
    q_lower = query.lower()
    if "lavender" in q_lower or "lavandula" in q_lower:
        return PlantSpeciesCreate(
            botanical_name="Lavandula angustifolia",
            common_name="English Lavender",
            variety="Munstead",
            mature_height_m=0.5,
            mature_spread_m=0.6,
            bloom_start_month=6,
            bloom_end_month=8,
            bloom_colors=["#967BB6", "#8A2BE2"],
            foliage_type="evergreen",
            sun_requirement="full_sun",
            watering_needs="low",
            hardiness_zone="Zone 5-9",
            notes="Requires well-draining soil and full direct sun. Prune after summer flowering.",
        )
    elif "hydrangea" in q_lower:
        return PlantSpeciesCreate(
            botanical_name="Hydrangea paniculata",
            common_name="Panicle Hydrangea",
            variety="Limelight",
            mature_height_m=2.0,
            mature_spread_m=1.8,
            bloom_start_month=7,
            bloom_end_month=10,
            bloom_colors=["#D0F0C0", "#FDFBF7", "#E6A8D7"],
            foliage_type="deciduous",
            sun_requirement="partial_shade",
            watering_needs="high",
            hardiness_zone="Zone 3-8",
            notes="Large cone blooms emerge lime green, transition to white, then antique pink.",
        )
    elif "rose" in q_lower or "rosa" in q_lower:
        return PlantSpeciesCreate(
            botanical_name="Rosa rugosa",
            common_name="Beach Rose",
            variety=None,
            mature_height_m=1.5,
            mature_spread_m=1.5,
            bloom_start_month=5,
            bloom_end_month=9,
            bloom_colors=["#E0115F", "#FF69B4"],
            foliage_type="deciduous",
            sun_requirement="full_sun",
            watering_needs="medium",
            hardiness_zone="Zone 2-7",
            notes="Hardy shrub rose with fragrant flowers followed by large ornamental hips.",
        )
    elif "hosta" in q_lower:
        return PlantSpeciesCreate(
            botanical_name="Hosta sieboldiana",
            common_name="Plantain Lily",
            variety="Elegans",
            mature_height_m=0.7,
            mature_spread_m=1.0,
            bloom_start_month=6,
            bloom_end_month=7,
            bloom_colors=["#E6E6FA"],
            foliage_type="perennial",
            sun_requirement="full_shade",
            watering_needs="medium",
            hardiness_zone="Zone 3-8",
            notes="Prized for huge blue-green textured foliage; thrives in deep to partial shade.",
        )
    else:
        return PlantSpeciesCreate(
            botanical_name=query.title(),
            common_name=query.title(),
            variety=None,
            mature_height_m=1.0,
            mature_spread_m=0.8,
            bloom_start_month=5,
            bloom_end_month=8,
            bloom_colors=["#FFB7B2"],
            foliage_type="perennial",
            sun_requirement="full_sun",
            watering_needs="medium",
            hardiness_zone=None,
            notes=f"Cataloged entry for {query}.",
        )
