/* Which footage the hero runs. Both sheets are built and committed, so
 * switching back is this one line plus a rebuild.
 *
 *   hero-eyes     amulets and all-seeing eyes, quick cuts   (source/eyes-amulets.mp4)
 *   hero-eyeball  one eyeball looking around                (source/eye.mp4)
 *
 * Rebuild either with tools/footage-to-strip.mjs — the commands are in the
 * README under "The hero footage".
 */
export const HERO_FOOTAGE = 'hero-eyes';
