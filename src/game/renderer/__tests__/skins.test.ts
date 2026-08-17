/**
 * Board skins.
 *
 * A skin is the only purchasable thing that touches a surface a student plays
 * on, so the rules it must not break are worth asserting rather than trusting
 * to review:
 *
 *  - a skin belonging to the other game must not apply
 *  - an unknown token must not blank the board
 *  - every palette must stay light enough for the seed counts drawn on it
 *
 * The last one is the reason a skin cannot simply be a colour a student picks.
 * The numbers on a congklak pit are the entire game state; a palette that put
 * ink900 on a mid-dark fill would make them unreadable in daylight for exactly
 * the students most likely to be playing outdoors.
 */

import { skinFor } from '../skins';

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const channel = (pair: string) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `palette.ink900`, the colour every seed count and freshness number is drawn in. */
const INK = '#111827';

const CONGKLAK = ['congklak.kayu', 'congklak.batu'];
const BENTENG = ['benteng.pasir', 'benteng.malam'];

describe('skinFor', () => {
  it('returns the default palette when nothing is equipped', () => {
    expect(skinFor('congklak', null)).toEqual(skinFor('congklak', null));
    expect(skinFor('congklak', null).board).toBeTruthy();
    expect(skinFor('benteng', null).board).toBeTruthy();
  });

  it('applies a skin belonging to the game being drawn', () => {
    expect(skinFor('congklak', 'congklak.kayu')).not.toEqual(skinFor('congklak', null));
    expect(skinFor('benteng', 'benteng.pasir')).not.toEqual(skinFor('benteng', null));
  });

  it('ignores a skin belonging to the other game', () => {
    // A student who owns a congklak skin has not bought a benteng one, and
    // applying it anyway would look like a purchase leaking onto the wrong
    // screen.
    expect(skinFor('benteng', 'congklak.kayu')).toEqual(skinFor('benteng', null));
    expect(skinFor('congklak', 'benteng.malam')).toEqual(skinFor('congklak', null));
  });

  it('ignores a token it does not recognise', () => {
    // Reachable without any tampering: a catalogue published after this build
    // can name a skin this build has never heard of.
    for (const token of ['congklak.emas', 'benteng.hujan', '', 'congklak.', 'nonsense']) {
      expect(skinFor('congklak', token)).toEqual(skinFor('congklak', null));
    }
  });

  it('never returns an undefined surface', () => {
    // Every field reaches `backgroundColor`, where undefined is transparent
    // rather than an error — a board that renders as nothing at all.
    for (const game of ['congklak', 'benteng'] as const) {
      for (const token of [null, ...CONGKLAK, ...BENTENG, 'unknown']) {
        const skin = skinFor(game, token);
        for (const surface of [skin.board, skin.own, skin.opponent, skin.accent]) {
          expect(typeof surface).toBe('string');
          expect(surface.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps every surface readable against the ink the numbers are drawn in', () => {
    // 4.5:1 is the AA threshold for body text. The seed count is the game, so
    // this is not a nicety — a skin that failed here would sell a student a
    // board they cannot read.
    for (const game of ['congklak', 'benteng'] as const) {
      const tokens = game === 'congklak' ? CONGKLAK : BENTENG;
      for (const token of tokens) {
        const skin = skinFor(game, token);
        for (const [name, surface] of Object.entries(skin)) {
          expect({ token, name, ratio: contrast(surface, INK) >= 4.5 }).toEqual({
            token,
            name,
            ratio: true,
          });
        }
      }
    }
  });

  it('distinguishes a student’s own side from the opponent’s in every skin', () => {
    // The two sides of a congklak board and the two bases of a benteng one are
    // told apart by fill. A skin that painted them the same colour would remove
    // information the game depends on.
    for (const game of ['congklak', 'benteng'] as const) {
      for (const token of [null, ...(game === 'congklak' ? CONGKLAK : BENTENG)]) {
        const skin = skinFor(game, token);
        expect(skin.own).not.toEqual(skin.opponent);
      }
    }
  });
});
