import json
from sqlmodel import Session, select

from app.models.property import Property
from app.models.obstacle import Obstacle
from app.models.bed import GardenBed
from app.models.plant import PlantSpecies
from app.models.placement import PlantPlacement


def seed_demo_data_if_empty(session: Session) -> None:
    """Populate default garden layout if database is empty."""
    existing_prop = session.exec(select(Property)).first()
    if existing_prop:
        return

    # 1. Create Property
    prop = Property(
        name="Garden with Terrace & Pond",
        latitude=52.5200,  # e.g., Central Europe default
        longitude=13.4050,
        timezone="Europe/Berlin",
        north_angle_deg=0.0,
        width_m=28.0,
        height_m=38.0,
        staging_area_x=22.0,
        staging_area_y=9.0,
        staging_area_w=4.5,
        staging_area_h=4.0,
    )
    session.add(prop)
    session.commit()
    session.refresh(prop)

    # 2. Create Obstacles (Main House, Shed, Neighbor's House, Boundary Fences)
    house = Obstacle(
        property_id=prop.id,
        name="Main Residence",
        type="house",
        polygon_coords=json.dumps([[6.0, 16.0], [22.0, 16.0], [22.0, 24.0], [6.0, 24.0]]),
        height_m=6.5,
        opacity=1.0,
    )
    shed = Obstacle(
        property_id=prop.id,
        name="Garden Shed",
        type="shed",
        polygon_coords=json.dumps([[2.0, 3.0], [6.0, 3.0], [6.0, 6.5], [2.0, 6.5]]),
        height_m=2.6,
        opacity=1.0,
    )
    north_fence = Obstacle(
        property_id=prop.id,
        name="North Boundary Fence",
        type="fence",
        polygon_coords=json.dumps([[0.5, 0.5], [27.5, 0.5], [27.5, 1.0], [0.5, 1.0]]),
        height_m=1.8,
        opacity=0.9,
    )
    birch_tree = Obstacle(
        property_id=prop.id,
        name="Silver Birch",
        type="tree",
        polygon_coords=json.dumps([
            [19.0, 4.0], [21.0, 3.0], [23.0, 4.0], [23.5, 6.0],
            [22.5, 7.5], [20.5, 8.0], [19.0, 6.5]
        ]),
        height_m=7.0,
        opacity=0.7,
    )
    session.add_all([house, shed, north_fence, birch_tree])
    session.commit()

    # 3. Create Beds & Surfaces: Front Bed, Back Bed, Paved Terrace, and Pond ("Teich")
    front_bed = GardenBed(
        property_id=prop.id,
        name="Front Sunny Border",
        zone="front_garden",
        surface_type="soil",
        polygon_coords=json.dumps([[7.0, 28.0], [21.0, 28.0], [21.0, 31.5], [7.0, 31.5]]),
        soil_type="loam",
        color="#7C5028",
    )
    # Stone Paver Terrace adjacent to back of house
    terrace = GardenBed(
        property_id=prop.id,
        name="Stone Paver Terrace",
        zone="back_garden",
        surface_type="terrace",
        polygon_coords=json.dumps([[8.0, 11.0], [20.0, 11.0], [20.0, 16.0], [8.0, 16.0]]),
        soil_type="paving_sand",
        color="#64748b",
    )
    back_bed = GardenBed(
        property_id=prop.id,
        name="Back Woodland Border",
        zone="back_garden",
        surface_type="soil",
        polygon_coords=json.dumps([[9.0, 4.0], [17.0, 4.0], [17.0, 8.0], [9.0, 8.0]]),
        soil_type="humus",
        color="#5C3B1E",
    )
    # Small Teich / Pond with swamp area
    teich_pond = GardenBed(
        property_id=prop.id,
        name="Gartenteich (Pond & Swamp)",
        zone="back_garden",
        surface_type="pond",
        polygon_coords=json.dumps([
            [2.5, 9.0], [5.5, 8.0], [7.0, 9.5], [6.5, 12.5], [3.5, 13.0], [2.0, 11.0]
        ]),
        soil_type="aquatic_pond_silt",
        color="#0284c7",
    )
    session.add_all([front_bed, terrace, back_bed, teich_pond])
    session.commit()
    session.refresh(front_bed)
    session.refresh(terrace)
    session.refresh(back_bed)
    session.refresh(teich_pond)

    # 4. Create Plant Species (including swamp / pond plants)
    lavender = PlantSpecies(
        botanical_name="Lavandula angustifolia",
        common_name="English Lavender",
        variety="Munstead",
        mature_height_m=0.5,
        mature_spread_m=0.6,
        bloom_start_month=6,
        bloom_end_month=8,
        bloom_colors=json.dumps(["#967BB6", "#8A2BE2"]),
        foliage_type="evergreen",
        sun_requirement="full_sun",
        watering_needs="low",
        hardiness_zone="Zone 5-9",
        notes="Aromatic purple spikes. Needs sharp drainage.",
    )
    hydrangea = PlantSpecies(
        botanical_name="Hydrangea paniculata",
        common_name="Panicle Hydrangea",
        variety="Limelight",
        mature_height_m=1.8,
        mature_spread_m=1.6,
        bloom_start_month=7,
        bloom_end_month=10,
        bloom_colors=json.dumps(["#D0F0C0", "#FDFBF7"]),
        foliage_type="deciduous",
        sun_requirement="partial_shade",
        watering_needs="high",
        hardiness_zone="Zone 3-8",
        notes="Prune in early spring down to 2-3 buds.",
    )
    water_lily = PlantSpecies(
        botanical_name="Nymphaea alba",
        common_name="European White Water Lily",
        variety=None,
        mature_height_m=0.2,
        mature_spread_m=1.2,
        bloom_start_month=6,
        bloom_end_month=9,
        bloom_colors=json.dumps(["#FFFFFF", "#FFFDD0"]),
        foliage_type="perennial",
        sun_requirement="full_sun",
        watering_needs="high",
        hardiness_zone="Zone 4-11",
        notes="Aquatic pond plant with floating leaves and star-shaped flowers.",
    )
    marsh_marigold = PlantSpecies(
        botanical_name="Caltha palustris",
        common_name="Marsh Marigold (Sumpfdotterblume)",
        variety=None,
        mature_height_m=0.4,
        mature_spread_m=0.4,
        bloom_start_month=4,
        bloom_end_month=6,
        bloom_colors=json.dumps(["#FFD700", "#FFC72C"]),
        foliage_type="perennial",
        sun_requirement="partial_shade",
        watering_needs="high",
        hardiness_zone="Zone 3-7",
        notes="Native swamp plant that thrives in pond margins and shallow water.",
    )
    rosemary = PlantSpecies(
        botanical_name="Salvia rosmarinus",
        common_name="Rosemary",
        variety="Tuscan Blue",
        mature_height_m=0.8,
        mature_spread_m=0.7,
        bloom_start_month=4,
        bloom_end_month=6,
        bloom_colors=json.dumps(["#6495ED"]),
        foliage_type="evergreen",
        sun_requirement="full_sun",
        watering_needs="low",
        hardiness_zone="Zone 7-10",
        notes="Potted Mediterranean herb on the sunny terrace.",
    )

    session.add_all([lavender, hydrangea, water_lily, marsh_marigold, rosemary])
    session.commit()
    for s in [lavender, hydrangea, water_lily, marsh_marigold, rosemary]:
        session.refresh(s)

    # 5. Place Individual Plant Instances (with Care History)
    # Front sunny border (lavenders in ground)
    p1 = PlantPlacement(
        bed_id=front_bed.id,
        species_id=lavender.id,
        x=9.0,
        y=29.5,
        container_type="ground",
        planted_date="2025-04-15",
        last_pruned_date="2026-03-10",
        last_fertilized_date="2026-04-01",
        notes="Healthy, full sun position.",
    )
    p2 = PlantPlacement(
        bed_id=front_bed.id,
        species_id=lavender.id,
        x=11.5,
        y=29.5,
        container_type="ground",
        planted_date="2025-04-15",
        last_pruned_date="2026-03-10",
        last_fertilized_date="2026-04-01",
    )
    # Back bed (hydrangea)
    p3 = PlantPlacement(
        bed_id=back_bed.id,
        species_id=hydrangea.id,
        x=13.0,
        y=6.0,
        container_type="ground",
        planted_date="2024-05-20",
        last_pruned_date="2026-03-01",
        last_fertilized_date="2026-05-15",
        notes="Mulched with pine bark for moisture retention.",
    )
    # Pond (water lily in center, marsh marigold at swamp margin)
    p4 = PlantPlacement(
        bed_id=teich_pond.id,
        species_id=water_lily.id,
        x=4.5,
        y=10.5,
        container_type="pond_basket",
        planted_date="2025-05-10",
        notes="Planted in heavy aquatic basket at 60cm water depth.",
    )
    p5 = PlantPlacement(
        bed_id=teich_pond.id,
        species_id=marsh_marigold.id,
        x=6.0,
        y=9.2,
        container_type="pond_basket",
        planted_date="2025-05-10",
        notes="Marginal swamp shelf at 10cm depth.",
    )
    # Terrace Planter / Pots (Rosemary in terracotta pot)
    p6 = PlantPlacement(
        bed_id=terrace.id,
        species_id=rosemary.id,
        x=10.0,
        y=12.5,
        container_type="pot",
        planted_date="2026-03-15",
        last_pruned_date="2026-04-20",
        last_fertilized_date="2026-05-01",
        notes="Large 45cm terracotta pot on the terrace.",
    )

    session.add_all([p1, p2, p3, p4, p5, p6])
    session.commit()
