/**
 * Resolving an equipped item id into something a screen can draw.
 *
 * These functions sit between a string chosen on another device and a React
 * Native style prop, which is the whole reason they are worth testing. The
 * leaderboard carries what *classmates* are wearing, so `avatarColorOf` is
 * handed ids this device did not choose, against a catalogue it may not have
 * pulled yet. Every one of those paths has to end in the default appearance
 * rather than a crash or a raw id shown to a child.
 */

const catalog: { id: string; cost: number; kind: string; value: string }[] = [];

jest.mock('@/src/data/cache/catalog', () => ({
  rewardCatalog: () => catalog,
}));

import { avatarColorOf, boardSkinOf, titleKeyOf } from '../wardrobe';

const ACCOUNT = 'account-1';

beforeEach(() => {
  catalog.length = 0;
  catalog.push(
    { id: 'avatar.color.laut', cost: 100, kind: 'avatar_color', value: '#0E7C86' },
    { id: 'board.congklak.kayu', cost: 300, kind: 'board_skin', value: 'congklak.kayu' },
    { id: 'board.benteng.malam', cost: 500, kind: 'board_skin', value: 'benteng.malam' },
    { id: 'title.pemikir', cost: 800, kind: 'title', value: 'pemikir' },
  );
});

describe('avatarColorOf', () => {
  it('resolves an equipped colour', () => {
    expect(avatarColorOf(ACCOUNT, 'avatar.color.laut')).toBe('#0E7C86');
  });

  it('is null when nothing is equipped, so the hashed default stands', () => {
    // Null rather than a colour: returning one here would overwrite the
    // name-derived palette for every student who has bought nothing.
    expect(avatarColorOf(ACCOUNT, null)).toBeNull();
  });

  it('is null with no account', () => {
    expect(avatarColorOf(null, 'avatar.color.laut')).toBeNull();
  });

  it('is null for an id this device’s catalogue has never seen', () => {
    // The ordinary case, not a corrupt one: a classmate wearing something
    // bought after this device last synced.
    expect(avatarColorOf(ACCOUNT, 'avatar.color.emas')).toBeNull();
  });

  it('is null when the catalogue has not synced at all', () => {
    catalog.length = 0;
    expect(avatarColorOf(ACCOUNT, 'avatar.color.laut')).toBeNull();
  });

  it('refuses an item of the wrong kind', () => {
    // This value reaches `backgroundColor`, and the id it came from arrived on
    // a leaderboard row rather than from this student.
    expect(avatarColorOf(ACCOUNT, 'title.pemikir')).toBeNull();
    expect(avatarColorOf(ACCOUNT, 'board.congklak.kayu')).toBeNull();
  });

  it('refuses anything that is not a plain hex colour', () => {
    for (const value of ['red', 'rgb(1,2,3)', '#fff', '#0E7C8', 'javascript:x', '', '#0E7C86; x']) {
      catalog[0] = { id: 'avatar.color.laut', cost: 100, kind: 'avatar_color', value };
      expect(avatarColorOf(ACCOUNT, 'avatar.color.laut')).toBeNull();
    }
  });

  it('accepts either case of hex', () => {
    catalog[0] = { id: 'avatar.color.laut', cost: 100, kind: 'avatar_color', value: '#0e7c86' };
    expect(avatarColorOf(ACCOUNT, 'avatar.color.laut')).toBe('#0e7c86');
  });
});

describe('boardSkinOf', () => {
  it('resolves a skin for the game being drawn', () => {
    expect(boardSkinOf(ACCOUNT, 'board.congklak.kayu', 'congklak')).toBe('congklak.kayu');
    expect(boardSkinOf(ACCOUNT, 'board.benteng.malam', 'benteng')).toBe('benteng.malam');
  });

  it('refuses a skin belonging to the other game', () => {
    // One slot holds one skin, so a student who owns a congklak board and plays
    // benteng must see the default rather than a repainted field.
    expect(boardSkinOf(ACCOUNT, 'board.congklak.kayu', 'benteng')).toBeNull();
    expect(boardSkinOf(ACCOUNT, 'board.benteng.malam', 'congklak')).toBeNull();
  });

  it('is null for nothing equipped, no account, or an unknown id', () => {
    expect(boardSkinOf(ACCOUNT, null, 'congklak')).toBeNull();
    expect(boardSkinOf(null, 'board.congklak.kayu', 'congklak')).toBeNull();
    expect(boardSkinOf(ACCOUNT, 'board.congklak.emas', 'congklak')).toBeNull();
  });

  it('refuses an item of the wrong kind', () => {
    expect(boardSkinOf(ACCOUNT, 'avatar.color.laut', 'congklak')).toBeNull();
  });

  it('does not match a game name by prefix alone', () => {
    // `congklakX.kayu` must not pass as a congklak skin.
    catalog.push({
      id: 'board.other',
      cost: 1,
      kind: 'board_skin',
      value: 'congklakX.kayu',
    });
    expect(boardSkinOf(ACCOUNT, 'board.other', 'congklak')).toBeNull();
  });
});

describe('titleKeyOf', () => {
  it('returns the item’s own name key', () => {
    // The same key the shop card uses. A title that read differently under a
    // name than on the card it was bought from would look like two rewards.
    expect(titleKeyOf(ACCOUNT, 'title.pemikir')).toBe('reward.title.pemikir');
  });

  it('is null for nothing equipped, no account, or an unknown id', () => {
    expect(titleKeyOf(ACCOUNT, null)).toBeNull();
    expect(titleKeyOf(null, 'title.pemikir')).toBeNull();
    expect(titleKeyOf(ACCOUNT, 'title.juara')).toBeNull();
  });

  it('refuses an item of the wrong kind', () => {
    expect(titleKeyOf(ACCOUNT, 'avatar.color.laut')).toBeNull();
  });
});
