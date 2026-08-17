/**
 * The cache key for "what are these students wearing".
 *
 * This is a key test rather than a hook test, because the bug it guards is a
 * caching bug and nothing else. The friends list showed classmates in the
 * name-derived colour while the leaderboard showed the colour they had bought,
 * and closing that meant asking the server about a set of user ids the *client*
 * chose — which is the one shape react-query gets wrong quietly.
 *
 * If the ids are not in the key, the cached answer outlives the question. A
 * student accepts a friend request, the friend list changes, and the hook keeps
 * serving the previous response: the new classmate appears in the default
 * colour and stays that way until something unrelated evicts the entry. Nothing
 * errors, and the screen looks like a student who has bought nothing.
 */

import { queryKeys } from '../client';

const ME = 'account-1';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('queryKeys.worn', () => {
  it('changes when the set of students changes', () => {
    expect(queryKeys.worn(ME, [A])).not.toEqual(queryKeys.worn(ME, [A, B]));
  });

  it('is the same key however the ids happen to be ordered', () => {
    // The friends API returns mutual, incoming and outgoing in whatever order
    // it likes. Treating a reordering as a new question would refetch on most
    // loads and cache nothing.
    expect(queryKeys.worn(ME, [A, B])).toEqual(queryKeys.worn(ME, [B, A]));
  });

  it('does not mutate the array it was given', () => {
    // It is the same array the friends list renders from; sorting in place
    // would reorder the rows on screen as a side effect of building a key.
    const ids = [B, A];
    queryKeys.worn(ME, ids);
    expect(ids).toEqual([B, A]);
  });

  it('separates one account from another', () => {
    // Two students may share a device. The answer is school-scoped and differs
    // per caller, so it must never be read across accounts.
    expect(queryKeys.worn(ME, [A])).not.toEqual(queryKeys.worn('account-2', [A]));
  });

  it('is distinct from the friends key it is derived from', () => {
    expect(queryKeys.worn(ME, [A])[0]).not.toEqual(queryKeys.friends(ME)[0]);
  });

  it('holds an empty set without throwing', () => {
    expect(() => queryKeys.worn(ME, [])).not.toThrow();
  });
});
