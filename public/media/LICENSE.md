# Map image

`world-map.jpg` is an equirectangular (north-up, 2:1) land-and-ocean map with a 15° graticule.

- Imagery: **NASA Earth Observatory — Blue Marble**, public domain.
- Assembled as a flat equirectangular plate for use as a wall print.

The room reads this file at `/media/world-map.jpg` and maps pin coordinates onto it
(longitude across, latitude up). To use a different map, keep the 2:1 equirectangular shape and
replace the file — no code changes are needed. If the file is missing, the board shows a plain
deep-blue plate and the pins still work.
