# World map

Open `map.html` through the site's **World Map** navigation link.

- Select a zone square or search the sidebar to open its detailed map.
- Drag to pan; use the wheel, pinch gesture, or +/− controls to zoom.
- Keyboard: arrow keys pan, +/− zoom, 0 fits the map, Escape returns to the overview.
- The World button restores the previous overview position. Connected-zone buttons open neighboring maps.
- Each individual map has an on-map **Back to world map** button. Connected destinations are SVG nodes outside the map image, joined to its border by dotted lines. Nodes and lines share the image’s pan/zoom transform. Directions are calculated from zone coordinates in the world overview. For example, Shaded Dunes is west of Night Harbor; Sungreet Strand is north. Nodes sharing a direction are spaced apart; land and boat connections to the same destination are grouped. Fit map includes the image and its connection nodes. Connections remain available for zones without imagery, using a placeholder map boundary. Placement represents the relative world position, not an exact exit coordinate in the map artwork.
- URLs such as `map.html?zone=harbor` can be bookmarked or shared.

The overview's layout, zone classifications, portals and connections are transcribed from the supplied reference. The Deep's unknown connections remain unknown. Module 1 is a classification in that reference, not a claim about current game availability. Map imagery is from the community wiki and can depict a different development version than the reference diagram.

## Assets and credits

`data/zone-maps.json` records original image URLs, wiki file pages, zone pages, original dimensions and available attribution metadata. Every detailed map links to its source/credits page. Embedded map credits are retained. Local WebP versions retain the original pixel dimensions; overview thumbnails are limited to 320 pixels.

Detailed maps were found for 16 zones. Field of the Lost, Fallen Watch, Night Harbor Sewers, Ail’Vorith, Great Cavern Sea and Rothold had no usable detailed map on their inspected zone pages (some use generic placeholders). These zones remain selectable with an explicit unavailable state.

## Updating maps

1. `node scripts/discover-zone-maps.mjs` lists image candidates from each wiki zone page. Review candidates manually; screenshots and placeholder images are not detailed maps.
2. Update the curated file list in `scripts/fetch-zone-maps.mjs`, then run it to download originals and record source metadata.
3. Run `python scripts/optimize-zone-maps.py` (requires Pillow) to generate WebP images and thumbnails, update the manifest, and remove downloaded originals after conversion.
4. Run `node scripts/check-zone-maps.mjs` and `npm run build`.

Topology is in `src/world-map-data.js`; the viewer is in `src/world-map.js` and `src/world-map.css`. Asset URLs respect Vite's configured base path. No runtime wiki requests or API keys are needed.
