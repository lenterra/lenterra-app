/**
 * Design tokens (TRD-APP-005).
 *
 * The demo built `ThemedText`, `ThemedView`, `Colors` and `useThemeColor`, and
 * then the five tab screens ignored all of it and hardcoded hex values —
 * `#2E8DE1` and `#ED5B3A` appear dozens of times across `games.tsx`,
 * `board.tsx`, `courses.tsx`, `index.tsx` and `profile.tsx`. Two conventions
 * coexisting means neither is real.
 *
 * These are the same values, named once. Nothing here is new design; it is the
 * demo's palette made editable.
 */

export const palette = {
  /** The demo's primary blue. */
  blue600: '#2E8DE1',
  blue500: '#4A9FE8',
  blue100: '#D1E5FF',
  blue050: '#EEF5FF',

  /** The demo's accent orange. */
  orange600: '#ED5B3A',
  orange100: '#FFE2DB',

  ink900: '#12203A',
  ink700: '#33415C',
  ink500: '#64748B',
  ink300: '#B8C1CF',
  ink100: '#E6EAF0',
  surface: '#FFFFFF',
  canvas: '#F6F8FB',

  success600: '#1E9E63',
  success100: '#D8F3E5',
  warning600: '#C77700',
  warning100: '#FFF3D1',
  danger600: '#C63A2A',
  danger100: '#FBE0DC',
} as const;

/**
 * Skill-domain colours, matching the tags already rendered in `index.tsx`.
 *
 * Colour is never the only channel: every place these appear also carries the
 * label, because a colour-blind student on a cheap panel in daylight has to be
 * able to read the same information (PRD-ACC-013).
 */
export const domainColors = {
  computation: { bg: '#FFCECE', fg: '#FF5757' },
  algorithms: { bg: '#D1E5FF', fg: '#0066FF' },
  security: { bg: '#FFF3D1', fg: '#FFB800' },
} as const;

/**
 * Mastery band colours.
 *
 * Ordered light to dark so the heatmap still reads as a gradient when printed
 * in greyscale — a teacher with an unreliable connection prints it.
 */
export const bandColors = {
  not_started: { bg: '#F1F4F8', fg: palette.ink500 },
  emerging: { bg: '#FBE0DC', fg: palette.danger600 },
  developing: { bg: '#FFF3D1', fg: palette.warning600 },
  proficient: { bg: '#D8F3E5', fg: palette.success600 },
  mastered: { bg: '#BFEBD6', fg: '#12613D' },
} as const;

/** 4px base. Every gap and padding is a multiple. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/**
 * Type scale.
 *
 * `body` is 16 rather than 14: the reference device is a 5-inch screen often
 * used in daylight, and 14pt body text is a readability problem before it is a
 * style choice.
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

/**
 * Minimum touch target.
 *
 * 48dp, not 44. Shared phones have scratched screens and students play on a
 * bus.
 */
export const MIN_TOUCH_TARGET = 48;

export const elevation = {
  card: {
    shadowColor: palette.ink900,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

export type BandName = keyof typeof bandColors;
export type DomainName = keyof typeof domainColors;
