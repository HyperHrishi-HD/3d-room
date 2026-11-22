/**
 * Optional media manifest.
 *
 * The template ships no photographs: every image in the room is a designed
 * placeholder drawn on a canvas. When you add real files under
 * /public/media, list them here so the progressive loader can warm them
 * before a station opens.
 */
export interface MediaSlot {
  /** Optional art seed, so a designed placeholder can be swapped for a print. */
  seed?: number
  station: string
  slot: string
  file: string
  aspect: string
  description: string
}

export const MEDIA_SLOTS: MediaSlot[] = []

export const MEDIA_BY_SEED = new Map<number, MediaSlot>()
