import json
from calendar import month_name
from typing import List, Tuple
from app.models.plant import PlantSpecies
from app.models.placement import PlantPlacement
from app.schemas.analysis import MonthlyBloomResponse, PlantBloomState


def calculate_monthly_bloom_states(
    placements: List[Tuple[PlantPlacement, PlantSpecies]],
    target_month: int,
) -> MonthlyBloomResponse:
    """
    Calculate the bloom state of all placed plants for a given month (1-12).
    Determines whether each plant is blooming, its flower colors, and care dates.
    """
    if target_month < 1 or target_month > 12:
        target_month = 1

    plant_states: List[PlantBloomState] = []
    blooming_count = 0

    for placement, species in placements:
        # Check if target_month falls inside [bloom_start_month, bloom_end_month]
        start = species.bloom_start_month
        end = species.bloom_end_month

        if start <= end:
            is_blooming = start <= target_month <= end
        else:
            is_blooming = (target_month >= start) or (target_month <= end)

        if is_blooming:
            blooming_count += 1

        try:
            colors = json.loads(species.bloom_colors)
            if not isinstance(colors, list):
                colors = [str(colors)]
        except Exception:
            colors = ["#967BB6"]

        spread = placement.current_spread_m if placement.current_spread_m else species.mature_spread_m
        height = placement.current_height_m if placement.current_height_m else species.mature_height_m

        plant_states.append(
            PlantBloomState(
                placement_id=placement.id or 0,
                species_id=species.id or 0,
                bed_id=placement.bed_id,
                botanical_name=species.botanical_name,
                common_name=species.common_name,
                variety=species.variety,
                x=round(placement.x, 2),
                y=round(placement.y, 2),
                spread_m=round(spread, 2),
                height_m=round(height, 2),
                is_blooming=is_blooming,
                bloom_colors=colors,
                foliage_type=species.foliage_type,
                bloom_start_month=species.bloom_start_month,
                bloom_end_month=species.bloom_end_month,
                container_type=placement.container_type or "ground",
                planted_date=placement.planted_date,
                last_pruned_date=placement.last_pruned_date,
                last_fertilized_date=placement.last_fertilized_date,
                notes=placement.notes,
            )
        )

    return MonthlyBloomResponse(
        month=target_month,
        month_name=month_name[target_month],
        total_plants=len(placements),
        blooming_plants_count=blooming_count,
        plants=plant_states,
    )
