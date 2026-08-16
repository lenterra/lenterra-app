/**
 * An initials avatar.
 *
 * The demo shipped a bundled photo per person — `faiz.png`, `nadya.png`,
 * `athaya.png`. That works for a mockup with seven fixed names and for nothing
 * else: a real class has forty students whose names arrive from the server.
 *
 * Initials on a deterministic colour also avoids asking children to upload
 * photographs of themselves, which is a data-collection decision the product
 * should not make casually (20-14).
 */

import { StyleSheet, Text, View } from 'react-native';

import { palette, typography } from '../tokens';

const COLORS = [
  palette.blue600,
  palette.orange600,
  palette.success600,
  palette.warning600,
  '#7A5AF8',
  '#0E7C86',
];

/** Stable per name, so a student's colour does not change between renders. */
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length] as string;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] as string).slice(0, 1).toUpperCase();
  return (
    (parts[0] as string).slice(0, 1) + (parts[parts.length - 1] as string).slice(0, 1)
  ).toUpperCase();
}

export function Avatar({
  name,
  size = 48,
  highlighted = false,
}: {
  name: string;
  size?: number;
  highlighted?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colorFor(name),
        },
        highlighted && styles.highlighted,
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  highlighted: { borderWidth: 3, borderColor: palette.ink900 },
  initials: { ...typography.label, color: palette.surface, fontWeight: '700' },
});
