/**
 * The colour scheme, narrowed to one this app has colours for.
 *
 * React Native 0.86 widened `ColorSchemeName` to include `'unspecified'`, which
 * a device reports when the user has expressed no preference. `?? 'light'` no
 * longer narrows it, so every `Colors[scheme]` lookup became an implicit `any`
 * — the sort of break that a build catches and a runtime would not.
 *
 * One helper rather than a cast at each site, so there is a single place that
 * decides what "no preference" means. It means light, which is what the app did
 * before the type widened.
 */

import { useColorScheme as useRNColorScheme } from 'react-native';

export type Scheme = 'light' | 'dark';

export function useScheme(): Scheme {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
