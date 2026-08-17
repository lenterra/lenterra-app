/**
 * Connectivity.
 *
 * `@react-native-community/netinfo` has been a dependency since the demo and
 * imported nowhere. It gets a real job here: deciding when to drain the outbox,
 * and recording honestly whether an attempt was played offline — metric M-A01
 * is only meaningful if that flag is true.
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface Connectivity {
  online: boolean;
  /** Metered connections change what we are willing to download. */
  metered: boolean;
  type: string;
}

let latest: Connectivity = { online: true, metered: false, type: 'unknown' };
const listeners = new Set<(state: Connectivity) => void>();

function toConnectivity(state: NetInfoState): Connectivity {
  return {
    // `isInternetReachable` is null while it is still being determined. Treating
    // unknown as online is the right default: a false "offline" would stop a
    // drain that would have succeeded, and a failed request costs nothing.
    online: state.isConnected === true && state.isInternetReachable !== false,
    metered: state.type === 'cellular',
    type: state.type,
  };
}

export function startConnectivityWatch(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const next = toConnectivity(state);
    const changed = next.online !== latest.online || next.metered !== latest.metered;
    latest = next;
    if (changed) listeners.forEach((listener) => listener(next));
  });

  void NetInfo.fetch().then((state) => {
    latest = toConnectivity(state);
  });

  return unsubscribe;
}

export function connectivity(): Connectivity {
  return latest;
}

export function isOnline(): boolean {
  return latest.online;
}

/** Notified only when the state actually changes, not on every poll. */
export function onConnectivityChange(listener: (state: Connectivity) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fresh check, for the moment a student taps "sync now" while hunting signal. */
export async function refreshConnectivity(): Promise<Connectivity> {
  latest = toConnectivity(await NetInfo.fetch());
  return latest;
}
