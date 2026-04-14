export const INVIDIOUS_INSTANCES: readonly string[] = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://iv.ggtyler.dev',
  'https://invidious.perennialte.ch',
  'https://invidious.darkness.services',
  'https://yt.drgnz.club',
] as const;

export const PIPED_INSTANCES: readonly string[] = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.privacydev.net',
  'https://pipedapi.coldify.de',
] as const;

export type InvidiousInstance = typeof INVIDIOUS_INSTANCES[number];
export type PipedInstance = typeof PIPED_INSTANCES[number];
