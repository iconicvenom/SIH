# Globe spacecraft and regional animation

Research and orbital snapshot retrieved **25 September 2026**.

## Primary visual references

- [ESA Sentinel-2 operations](https://www.esa.int/Enabling_Support/Operations/Sentinel-2_operations): AstroBus-L box, 3.4 × 1.8 × 2.35 m body, one three-panel solar array, three-axis Earth-pointing stabilisation. [ESA deployed illustration](https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2015/03/sentinel-2/15292660-1-eng-GB/Sentinel-2_pillars.jpg) informs gold insulation, imager housing, white radiator and single wing.
- [NASA Landsat-9](https://science.nasa.gov/mission/landsat-9/): LEOStar-3 bus, OLI-2 and TIRS-2 as separate payloads; nominal 705 km / 98.2° orbit. [NASA deployed illustration](https://assets.science.nasa.gov/dynamicimage/assets/science/missions/landsat/2023/09/L9-Stills-Cover-3.png) informs silver insulation, instrument deck, long four-section array and asymmetric antenna assembly.
- [ISRO Cartosat-3](https://www.isro.gov.in/Cartosat_3.html): nominal launch orbit 509 km / 97.5°. [ISRO configuration drawing](https://www.isro.gov.in/media_isro/image/media/Missions/Spacecraft/resized/cartosat3_large.png.webp) informs the large cylindrical telescope, two solar wings with two panels each, radiator and antenna layout. Drawing colours identify components; they are not treated as flight-surface colours.

Geometry is original and procedural, with shared material batches, bevelled enclosures, optical baffles, solar-cell textures, blanket bump detail, radiator fins, supports and deployment hinges. It is a visual reconstruction, **not flight CAD**. Only Sentinel's main body dimensions are source-specified; other proportions and small fittings are approximate. No downloaded reference imagery is redistributed in the app.

## Regional animation — current presentation

The user requested a clear visual presentation with all three satellites moving together around India, without a replay panel, clock, playback controls or drawn trajectories. The active globe now uses `regionalSatelliteMotion.ts`: three staggered, continuous 18-second loops within 3–45°N and 64–110°E. This keeps the spacecraft on the visible India-facing hemisphere, including the peninsula, Arabian Sea and Bay of Bengal. These loops are intentionally illustrative and do not represent actual orbital paths, timing, live positions or tasking.

Each model retains its mission's nominal orbital radius (786 / 705 / 509 km above a 6371 km Earth), but the spacecraft geometry is enlarged at 0.02 globe units per model metre. Bodies face Earth, with their attitude following the path tangent; the solar drives orient toward the fixed presentation Sun used by the existing globe lighting. The independent inspector supports drag rotation, uses studio lighting, and displays nominal mission altitude and orbital period. Reduced-motion preferences stop automatic movement. There is no playback control UI.

The animation loops continuously without reversing abruptly or teleporting. All three are visible together at the default camera orientation throughout a full cycle. If the user turns the globe manually, Earth-occluded labels and mesh clicks are disabled.

## Retained orbital research

The original implementation researched CelesTrak NORAD 42063, 49260 and 44804. Unmodified TLE snapshots dated 24–25 September 2026 remain in `spacecraft.ts`; `orbits.ts` and its tests preserve the SGP4 calculations for future use. **Those calculations do not drive the current regional animation.** The dated replay controls and their state store were removed following the user's presentation feedback.

- [Sentinel-2B elements](https://celestrak.org/NORAD/elements/gp.php?CATNR=42063&FORMAT=TLE)
- [Landsat-9 elements](https://celestrak.org/NORAD/elements/gp.php?CATNR=49260&FORMAT=TLE)
- [Cartosat-3 elements](https://celestrak.org/NORAD/elements/gp.php?CATNR=44804&FORMAT=TLE)

## Verification

`tests/regionalSatelliteMotion.test.ts` checks continuous motion, loop closure, nominal height, Earth-facing orientation, regional bounds and visibility of all three spacecraft over a complete cycle, plus far-side occlusion. `tests/orbits.test.ts` covers the retained orbital research independently. Browser checks cover model inspection, selection, automatic motion, reduced motion, desktop panel placement and leaving/re-entering globe mode. Production build and the full existing suite must also pass.
