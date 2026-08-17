/**
 * A student's equipped title, wherever their name appears.
 *
 * There were two copies of this, one on the leaderboard and one on the profile
 * header, and the friends list had neither. Three surfaces showing the same
 * student is exactly the situation where a second implementation drifts — and
 * the failure would be silent, because a title that renders in one place and
 * not another looks like that student simply has none.
 *
 * **Renders nothing** — not a placeholder, not the raw id — when there is no
 * title, when this device's catalogue does not know the id, or when the locale
 * has no string for it. Each of those happens for an ordinary reason: a
 * catalogue that has not synced, an item withdrawn in a later content version,
 * a classmate wearing something bought since this device last pulled. Showing
 * `title.pemikir` to a child would be worse than showing nothing, and an empty
 * line would read as a rendering fault.
 */

import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { titleKeyOf } from './wardrobe';

export function RewardTitle({
  accountId,
  itemId,
  style,
  numberOfLines,
}: {
  accountId: string | null;
  itemId: string | null;
  style?: StyleProp<TextStyle>;
  /** Set on a list row, where a long title must not push the layout around. */
  numberOfLines?: number;
}) {
  const { t } = useTranslation();

  const key = titleKeyOf(accountId, itemId);
  if (!key) return null;

  // `t` returns the key itself when the string is missing, which is the only
  // signal i18next gives; without this check that key reaches the screen.
  const label = t(key);
  if (label === key) return null;

  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {label}
    </Text>
  );
}
