# Background music

Track: **Chill lofi inspired (loop edit)**
Original by **omfgdude**; loop edit by **qubodup**
License: **CC0 1.0 Universal (public domain)**
Source: https://opengameart.org/content/chill-lofi-inspired-loop-edit

Files:

- `peaceful-loop.ogg` (preferred in Chromium and Firefox)
- `peaceful-loop.mp3` (fallback)

Both files are the same loop. The room plays one bed at 0.08 volume under the 0.5 SFX master,
starts it only after a real gesture, and pauses it while the tab is hidden.

To use your own track, replace both files (or edit `src/lib/music.ts`) and update this note. To
remove music entirely, delete `src/lib/music.ts` and its two imports in `src/lib/sfx.ts` and
`src/ui/Header.tsx`; every other sound keeps working.
