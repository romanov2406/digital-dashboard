import { Preferences } from '@capacitor/preferences';

/** Load a JSON value saved with {@link save}, merged over the given defaults. */
export async function load<T extends object>(key: string, defaults: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? { ...defaults, ...JSON.parse(value) } : defaults;
  } catch {
    return defaults;
  }
}

export function save(key: string, value: unknown): void {
  Preferences.set({ key, value: JSON.stringify(value) }).catch(() => undefined);
}
