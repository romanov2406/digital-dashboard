import { Injectable, inject, signal } from '@angular/core';
import { DriveService, haversine, LatLon } from './drive.service';
import { SettingsService } from './settings.service';

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

/**
 * Everything around the drive that isn't speed: clock, phone battery,
 * outside temperature (Open-Meteo) and road speed limit (OpenStreetMap).
 */
@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly drive = inject(DriveService);
  private readonly settings = inject(SettingsService);

  readonly now = signal(new Date());
  readonly battery = signal<number | null>(null);
  readonly charging = signal(false);
  readonly outsideC = signal<number | null>(null);
  /** Speed limit in km/h, or null when unknown. */
  readonly limitKmh = signal<number | null>(null);

  private weatherAt: { t: number; p: LatLon } | null = null;
  private limitAt: { t: number; p: LatLon } | null = null;
  private limitBusy = false;

  constructor() {
    setInterval(() => this.now.set(new Date()), 10_000);
    setInterval(() => this.poll(), 5_000);
    this.initBattery();
  }

  private async initBattery(): Promise<void> {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return;
    try {
      const b = await nav.getBattery();
      const read = () => {
        this.battery.set(Math.round(b.level * 100));
        this.charging.set(b.charging);
      };
      read();
      b.addEventListener('levelchange', read);
      b.addEventListener('chargingchange', read);
    } catch {
      /* not supported */
    }
  }

  private poll(): void {
    const p = this.drive.position();
    if (!p) return;
    const s = this.settings.value();
    if (s.weather && due(this.weatherAt, p, 15 * 60_000, 5000)) this.fetchWeather(p);
    if (s.speedLimits && due(this.limitAt, p, 20_000, 120)) this.fetchLimit(p);
    if (!s.speedLimits) this.limitKmh.set(null);
  }

  private async fetchWeather(p: LatLon): Promise<void> {
    this.weatherAt = { t: Date.now(), p };
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&current=temperature_2m`;
      const r = await fetch(url);
      const j = await r.json();
      const c = j?.current?.temperature_2m;
      if (typeof c === 'number') this.outsideC.set(Math.round(c));
    } catch {
      /* offline */
    }
  }

  private async fetchLimit(p: LatLon): Promise<void> {
    if (this.limitBusy) return;
    this.limitBusy = true;
    this.limitAt = { t: Date.now(), p };
    try {
      const q = `[out:json][timeout:8];way(around:20,${p.lat},${p.lon})[highway][maxspeed];out tags 1;`;
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const j = await r.json();
      this.limitKmh.set(parseMaxspeed(j?.elements?.[0]?.tags?.maxspeed));
    } catch {
      /* offline – keep the last known limit */
    } finally {
      this.limitBusy = false;
    }
  }
}

function due(last: { t: number; p: LatLon } | null, p: LatLon, ms: number, metres: number): boolean {
  if (!last) return true;
  return Date.now() - last.t > ms || haversine(last.p.lat, last.p.lon, p.lat, p.lon) > metres;
}

/** OSM maxspeed tag ("50", "30 mph", "none", "RU:urban") -> km/h */
export function parseMaxspeed(tag: unknown): number | null {
  if (typeof tag !== 'string') return null;
  const m = tag.match(/^(\d+)\s*(mph)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? Math.round(n * 1.609344) : n;
}
