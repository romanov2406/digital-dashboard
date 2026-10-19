import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { SettingsService } from './settings.service';
import { load, save } from './storage';

export type GpsStatus = 'searching' | 'ok' | 'denied' | 'unavailable' | 'demo';

export interface LatLon {
  lat: number;
  lon: number;
}

interface Trip {
  distanceM: number;
  movingS: number;
  maxMs: number;
  startedAt: number;
}

const NEW_TRIP = (): Trip => ({ distanceM: 0, movingS: 0, maxMs: 0, startedAt: Date.now() });

/** Below this speed (m/s) the car counts as stationary; filters GPS jitter. */
const MOVING_MS = 0.8;
/** Fixes less accurate than this (metres) are not used for distance. */
const MAX_ACCURACY_M = 35;

/**
 * Speed, heading and trip data from the phone's GPS (or a simulator in demo mode).
 */
@Injectable({ providedIn: 'root' })
export class DriveService {
  private readonly settings = inject(SettingsService);

  readonly speedMs = signal(0);
  /** Smoothed longitudinal acceleration in m/s², drives the power bar. */
  readonly accel = signal(0);
  readonly heading = signal<number | null>(null);
  readonly accuracy = signal<number | null>(null);
  readonly altitude = signal<number | null>(null);
  readonly position = signal<LatLon | null>(null);
  readonly status = signal<GpsStatus>('searching');
  readonly trip = signal<Trip>(NEW_TRIP());

  readonly speed = computed(() => Math.round(this.settings.speed(this.speedMs())));
  readonly moving = computed(() => this.speedMs() > MOVING_MS);
  readonly avgSpeed = computed(() => {
    const t = this.trip();
    return t.movingS > 0 ? this.settings.speed(t.distanceM / t.movingS) : 0;
  });

  private watchId: string | null = null;
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private last: { t: number; lat: number; lon: number; v: number } | null = null;
  private lastSaved = 0;

  constructor() {
    load('trip', NEW_TRIP()).then((t) => this.trip.set(t));

    effect(() => {
      if (!this.settings.loaded()) return;
      const demo = this.settings.value().demo;
      this.stop();
      if (demo) this.startDemo();
      else this.startGps();
    });
  }

  resetTrip(): void {
    this.trip.set(NEW_TRIP());
    save('trip', this.trip());
  }

  private stop(): void {
    if (this.watchId) Geolocation.clearWatch({ id: this.watchId }).catch(() => undefined);
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.watchId = null;
    this.demoTimer = null;
    this.last = null;
  }

  private async startGps(): Promise<void> {
    this.status.set('searching');
    try {
      if (Capacitor.isNativePlatform()) {
        const p = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (p.location === 'denied') {
          this.status.set('denied');
          return;
        }
      }
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        (pos, err) => {
          if (err || !pos) {
            const denied = err?.code === 1 || /denied/i.test(err?.message ?? '');
            this.status.set(denied ? 'denied' : 'searching');
            return;
          }
          this.onFix(pos);
        },
      );
    } catch {
      this.status.set('unavailable');
    }
  }

  private onFix(pos: Position): void {
    const { latitude: lat, longitude: lon, speed, heading, accuracy, altitude } = pos.coords;
    const t = pos.timestamp || Date.now();
    this.status.set('ok');
    this.position.set({ lat, lon });
    this.accuracy.set(accuracy);
    this.altitude.set(altitude ?? null);

    const prev = this.last;
    const dt = prev ? (t - prev.t) / 1000 : 0;
    const dist = prev ? haversine(prev.lat, prev.lon, lat, lon) : 0;

    // Prefer the speed reported by the GPS chip; derive it from position otherwise.
    let v = speed != null && speed >= 0 ? speed : dt > 0 ? dist / dt : 0;
    if (accuracy > MAX_ACCURACY_M && speed == null) v = prev?.v ?? 0;
    if (v < MOVING_MS / 2) v = 0;

    if (heading != null && !Number.isNaN(heading) && v > MOVING_MS) this.heading.set(heading);

    if (prev && dt > 0 && dt < 30) {
      this.accel.update((a) => a * 0.6 + ((v - prev.v) / dt) * 0.4);
      if (accuracy <= MAX_ACCURACY_M && v > MOVING_MS) this.addTrip(dist, dt, v);
    }

    this.speedMs.set(v);
    this.last = { t, lat, lon, v };
  }

  private startDemo(): void {
    this.status.set('demo');
    let v = this.speedMs();
    let target = 60 / 3.6;
    let heading = this.heading() ?? 40;
    let tick = 0;
    const dt = 0.2;
    this.demoTimer = setInterval(() => {
      if (tick++ % 40 === 0) target = Math.random() < 0.12 ? 0 : (25 + Math.random() * 95) / 3.6;
      const a = Math.max(-4, Math.min(2.5, (target - v) * 0.5));
      v = Math.max(0, v + a * dt);
      heading = (heading + (Math.random() - 0.5) * 2 + 360) % 360;
      this.accel.update((x) => x * 0.6 + a * 0.4);
      this.speedMs.set(v);
      this.heading.set(heading);
      this.accuracy.set(5);
      this.position.set(move(this.position() ?? DEMO_START, heading, v * dt));
      if (v > MOVING_MS) this.addTrip(v * dt, dt, v);
    }, dt * 1000);
  }

  private addTrip(dist: number, dt: number, v: number): void {
    this.trip.update((t) => ({
      ...t,
      distanceM: t.distanceM + dist,
      movingS: t.movingS + dt,
      maxMs: Math.max(t.maxMs, v),
    }));
    if (Date.now() - this.lastSaved > 10000) {
      this.lastSaved = Date.now();
      save('trip', this.trip());
    }
  }
}

/** Where the demo drive starts (Berlin). */
const DEMO_START: LatLon = { lat: 52.52, lon: 13.405 };

/** Move a point `metres` along `bearing` degrees (flat-earth approximation, fine for short steps). */
function move(p: LatLon, bearing: number, metres: number): LatLon {
  const rad = (bearing * Math.PI) / 180;
  const dLat = (metres * Math.cos(rad)) / 111_320;
  const dLon = (metres * Math.sin(rad)) / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lon: p.lon + dLon };
}

/** Initial bearing in degrees from point a to point b. */
export function bearing(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x =
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function compass(deg: number | null): string {
  if (deg == null) return '—';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}
