# Sound sources

Every file in this folder is CC0 and may be used, modified and redistributed freely.

- Kenney Interface Sounds, CC0: https://kenney.nl/assets/interface-sounds
  Used for clicks, opens, confirmation, tick, drop, pluck and scratch material.
- Kenney RPG Audio, CC0: https://kenney.nl/assets/rpg-audio
  Used for book flips, book opens, paper slides, cloth and metal-pot material.

Processing: mono 44.1 kHz MP3 at 128 kbps, trimmed to short UI lengths, level-matched to a common
RMS target with peaks kept below −1 dBFS, and given 15 ms fades at both ends. Camera and map
whooshes are reversed paper/cloth recordings, not synthesized tones.

Sounds are optional. Delete a file and its entry in `src/lib/sfx.ts` and every interaction still
works, silently.
