/**
 * Turning an equipped item id into something a screen can draw.
 *
 * The server records *what* a student is wearing — a redeemed item id — and
 * never what it looks like. That split is deliberate: it means restyling a
 * colour or renaming a title is a content republish rather than a migration,
 * and it means a student's choice survives both.
 *
 * The consequence is that every id has to be resolved against the catalogue on
 * the device, and every one of these functions has to answer "nothing" for an
 * id it cannot resolve. That happens for real reasons, not just corrupt data:
 * a catalogue that has not synced yet, an item withdrawn in a later version, or
 * a classmate wearing something bought after this device last pulled. In all of
 * them the right answer is the default appearance, never a crash and never a
 * raw id shown to a child.
 */

import { rewardCatalog, type RewardItem } from '@/src/data/cache/catalog';

/** Cheap per-call lookup. The catalogue is a dozen items read from local storage. */
function itemOf(accountId: string | null, itemId: string | null, kind: RewardItem['kind']) {
  if (!accountId || !itemId) return null;
  const item = rewardCatalog(accountId).find((candidate) => candidate.id === itemId);
  // The kind check is not paranoia about our own server: this same resolver
  // reads ids that arrived on a leaderboard row, and a colour slot holding a
  // title would otherwise be handed to `backgroundColor`.
  return item && item.kind === kind ? item : null;
}

/**
 * The colour a student has on, or null to fall back to the name-derived one.
 *
 * Null rather than a default value, so the caller keeps whatever it already
 * does. Handing back a fixed colour here would quietly overwrite the hashed
 * palette for every student who has bought nothing.
 */
export function avatarColorOf(accountId: string | null, itemId: string | null): string | null {
  const item = itemOf(accountId, itemId, 'avatar_color');
  // Only a hex value is accepted. This string reaches `backgroundColor`, and it
  // can have come from another student's profile by way of the leaderboard.
  if (!item || !/^#[0-9a-f]{6}$/i.test(item.value)) return null;
  return item.value;
}

/**
 * The skin token for a board, e.g. `congklak.kayu`.
 *
 * Returns null unless the token names the game being drawn — a congklak skin on
 * a benteng board is a purchase applied to the wrong screen, which looks like a
 * bug to the student who paid for it.
 */
export function boardSkinOf(
  accountId: string | null,
  itemId: string | null,
  game: 'congklak' | 'benteng',
): string | null {
  const item = itemOf(accountId, itemId, 'board_skin');
  if (!item || !item.value.startsWith(`${game}.`)) return null;
  return item.value;
}

/**
 * The i18n key for a title, or null.
 *
 * A key rather than a word, because a class may be reading in either locale and
 * the catalogue stores neither rendering — `content/strings/*.yaml` holds both
 * under `reward:`.
 *
 * It is the item's *own* name key, not a second one derived from `value`. The
 * shop already shows "Rajin Berlatih" for `title.rajin`, and a title that read
 * differently under a name than it did on the card a student bought it from
 * would look like two different rewards.
 */
export function titleKeyOf(accountId: string | null, itemId: string | null): string | null {
  const item = itemOf(accountId, itemId, 'title');
  return item ? `reward.${item.id}` : null;
}
