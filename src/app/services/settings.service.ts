import { Injectable, computed, effect, signal } from '@angular/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { load, save } from './storage';

export type Theme = 'auto' | 'light' | 'dark';
export type Units = 'metric' | 'imperial';

export interface Settings {
  theme: Theme;
  units: Units;
  /** Simulate driving instead of reading GPS (useful at a desk). */
  demo: boolean;
  keepAwake: boolean;
  /** Look up the road speed limit from OpenStreetMap. */
  speedLimits: boolean;
  /** Fetch outside temperature from Open-Meteo. */
  weather: boolean;
}

const DEFAULTS: Settings = {
  theme: 'auto',
  units: 'metric',
  demo: false,
  keepAwake: true,
  speedLimits: true,
  weather: true,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly value = signal<Settings>(DEFAULTS);
  readonly loaded = signal(false);

  private readonly systemDark = signal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  readonly dark = computed(() => {
    const t = this.value().theme;
    return t === 'dark' || (t === 'auto' && this.systemDark());
  });

  readonly imperial = computed(() => this.value().units === 'imperial');
  readonly speedUnit = computed(() => (this.imperial() ? 'MPH' : 'KM/H'));
  readonly distUnit = computed(() => (this.imperial() ? 'mi' : 'km'));

  constructor() {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => this.systemDark.set(e.matches));

    load('settings', DEFAULTS).then((s) => {
      this.value.set(s);
      this.loaded.set(true);
    });

    effect(() => document.body.classList.toggle('dark', this.dark()));

    effect(() => {
      const on = this.value().keepAwake;
      (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => undefined);
    });
  }

  update(patch: Partial<Settings>): void {
    this.value.update((s) => ({ ...s, ...patch }));
    save('settings', this.value());
  }

  /** m/s -> km/h or mph */
  speed(ms: number): number {
    return ms * (this.imperial() ? 2.23694 : 3.6);
  }

  /** metres -> km or mi */
  distance(m: number): number {
    return m / (this.imperial() ? 1609.344 : 1000);
  }

  /** °C -> display unit */
  temp(c: number): number {
    return this.imperial() ? Math.round(c * 1.8 + 32) : c;
  }
}
