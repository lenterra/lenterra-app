/**
 * Board skins.
 *
 * A skin repaints surfaces and nothing else. That constraint is the reason the
 * catalogue can sell them: the pits, the squares, the legal-move markers, and
 * every hit target stay exactly where they are, so a student who owns a skin is
 * playing the same game as one who does not. A skin that moved anything would
 * be a purchase that changes play, which the catalogue rules out.
 *
 * Two things are deliberately not skinnable, and both are accessibility rather
 * than taste:
 *
 *  - **The legal-move and selection borders.** They carry meaning no colour
 *    duplicates, and a skin free to restyle them could produce a board where a
 *    playable pit is indistinguishable from an empty one.
 *  - **The text.** Seed counts are read against these fills, so the contrast
 *    ratio has to hold for every skin. Each palette below keeps its surfaces
 *    light enough for `ink900` to clear WCAG AA at the sizes used.
 *
 * A skin is applied as an extra style layered over the base, so anything a
 * palette leaves undefined keeps the default rather than becoming transparent.
 */

import { palette } from '@/src/ui/tokens';

export interface BoardSkin {
  /** The panel the whole board sits on. */
  board: string;
  /** The student's own pits or squares. */
  own: string;
  /** The opponent's. */
  opponent: string;
  /** Stores in congklak, bases in benteng. */
  accent: string;
}

const DEFAULTS: Record<'congklak' | 'benteng', BoardSkin> = {
  congklak: {
    board: palette.surface,
    own: palette.blue050,
    opponent: palette.ink100,
    accent: palette.blue100,
  },
  benteng: {
    board: palette.surface,
    own: palette.blue100,
    opponent: palette.orange100,
    accent: palette.ink100,
  },
};

/**
 * The four purchasable palettes.
 *
 * Named for materials a student in Ende would recognise on a real board rather
 * than for colours: `kayu` is wood, `batu` is stone, `pasir` is sand, `malam`
 * is night. `malam` is the one that inverts, so its surfaces are mid-tones
 * rather than true darks — the seed counts are still drawn in ink.
 */
const SKINS: Record<string, BoardSkin> = {
  'congklak.kayu': {
    board: '#F3E4CE',
    own: '#E4C79B',
    opponent: '#D9B889',
    accent: '#C8A16A',
  },
  'congklak.batu': {
    board: '#ECEEF0',
    own: '#D6DBE0',
    opponent: '#C3CAD1',
    accent: '#AEB7C0',
  },
  'benteng.pasir': {
    board: '#FAF0DC',
    own: '#EBD9AE',
    opponent: '#E8C9A0',
    accent: '#D8C08C',
  },
  'benteng.malam': {
    board: '#DDE3F0',
    own: '#C2CDE6',
    opponent: '#CFC3E6',
    accent: '#B3BFDA',
  },
};

/**
 * The palette for a board, given whatever the student has equipped.
 *
 * Falls through to the default for a null token, an unknown one, or one
 * belonging to the other game. That last case matters: a student owning a
 * congklak skin should not repaint a benteng board, and the value arrives from
 * the catalogue rather than from anything this module controls.
 */
export function skinFor(game: 'congklak' | 'benteng', token: string | null): BoardSkin {
  if (token && token.startsWith(`${game}.`)) {
    const skin = SKINS[token];
    if (skin) return skin;
  }
  return DEFAULTS[game];
}
