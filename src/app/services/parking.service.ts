import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { bearing, DriveService, haversine, LatLon } from './drive.service';
import { SettingsService } from './settings.service';
import { load, save } from './storage';
import { ParkSensors, VehicleService } from './vehicle.service';

export interface ParkingSpot extends LatLon {
  accuracy: number | null;
  savedAt: number;
  auto: boolean;
}

interface ParkingState {
  spot: ParkingSpot | null;
  /** When the parking timer runs out (epoch ms), or null when no timer is set. */
  expiresAt: number | null;
  /** Length of the running timer, to highlight the chosen option. */
  timerMinutes: number | null;
  autoSave: boolean;
}

const DEFAULTS: ParkingState = { spot: null, expiresAt: null, timerMinutes: null, autoSave: true };

/** Stationary this long after a drive → the spot is saved automatically. */
const AUTO_SAVE_AFTER_MS = 60_000;
/** Only auto-save after a drive of at least this distance, so traffic lights don't count. */
const AUTO_SAVE_MIN_DRIVE_M = 300;
/** Remind this long before the parking timer runs out. */
const REMIND_BEFORE_MS = 10 * 60_000;

const NOTIFY_SOON = 7101;
const NOTIFY_EXPIRED = 7102;

/** Distances (cm) at which park-assist arcs change colour. */
export const ZONE_STOP = 30;
export const ZONE_NEAR = 60;
export const ZONE_MID = 100;

/**
 * Parking: where the car is parked, a parking timer with reminders,
 * and park-assist sensor data (from the vehicle link, or simulated in demo mode).
 */
@Injectable({ providedIn: 'root' })
export class ParkingService {
  private readonly drive = inject(DriveService);
  private readonly settings = inject(SettingsService);
  private readonly vehicle = inject(VehicleService);

  readonly state = signal<ParkingState>(DEFAULTS);
  readonly spot = computed(() => this.state().spot);
  readonly expiresAt = computed(() => this.state().expiresAt);

  /** Ticks every second while a timer runs, for countdowns. */
  readonly now = signal(Date.now());

  /** Distance (m) and bearing (°) from where we are to the parked car. */
  readonly toCar = computed(() => {
    const s = this.spot();
    const p = this.drive.position();
    if (!s || !p) return null;
    return { metres: haversine(p.lat, p.lon, s.lat, s.lon), bearing: bearing(p, s) };
  });

  readonly remainingMs = computed(() => {
    const e = this.expiresAt();
    return e === null ? null : Math.max(0, e - this.now());
  });

  private readonly demoSensors = signal<ParkSensors | null>(null);
  /** Sensor readings from the car if available, simulated in demo mode, else null. */
  readonly sensors = computed<ParkSensors | null>(
    () => this.vehicle.link.parkSensors?.() ?? (this.settings.value().demo ? this.demoSensors() : null),
  );

  private stoppedTimer: ReturnType<typeof setTimeout> | null = null;
  private driveStartM = 0;
  private sensorTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    load('parking', DEFAULTS).then((s) => this.state.set(s));
    setInterval(() => {
      if (this.expiresAt() !== null) this.now.set(Date.now());
    }, 1000);

    // Auto-save the spot once the car has been stationary for a while after a drive.
    effect(() => {
      const moving = this.drive.moving();
      untracked(() => this.onMovingChange(moving));
    });
  }

  /** Save the current position as the parking spot. */
  park(auto = false): boolean {
    const p = this.drive.position();
    if (!p) return false;
    this.patch({ spot: { ...p, accuracy: this.drive.accuracy(), savedAt: Date.now(), auto } });
    return true;
  }

  clearSpot(): void {
    this.patch({ spot: null });
    this.setTimer(null);
  }

  setAutoSave(on: boolean): void {
    this.patch({ autoSave: on });
  }

  /** Start a parking timer of `minutes`, or cancel it with null. */
  async setTimer(minutes: number | null): Promise<void> {
    const expiresAt = minutes === null ? null : Date.now() + minutes * 60_000;
    this.patch({ expiresAt, timerMinutes: minutes });
    this.now.set(Date.now());
    await this.scheduleReminders(expiresAt);
  }

  /** Open walking directions to the parked car in the maps app. */
  navigate(): void {
    const s = this.spot();
    if (!s) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=walking`, '_blank');
  }

  /** Start simulated sensor readings (demo mode) while the park-assist view is visible. */
  startSensorDemo(): void {
    if (this.sensorTimer) return;
    let t = 0;
    this.sensorTimer = setInterval(() => {
      t += 0.05;
      const rear = 22 + ((Math.sin(t) + 1) / 2) * 110; // backing up towards a wall and away again
      const front = 95 + Math.sin(t * 0.7) * 35;
      const wobble = (i: number) => Math.sin(t * 1.3 + i) * 8;
      const cm = (v: number) => (v > 150 ? null : Math.round(v));
      this.demoSensors.set({
        front: [front + 30 + wobble(0), front + wobble(1), front + 5 + wobble(2), front + 40 + wobble(7)].map(cm),
        rear: [rear + 25 + wobble(3), rear + wobble(4), rear + 4 + wobble(5), rear + 30 + wobble(6)].map(cm),
      });
    }, 100);
  }

  stopSensorDemo(): void {
    if (this.sensorTimer) clearInterval(this.sensorTimer);
    this.sensorTimer = null;
  }

  private onMovingChange(moving: boolean): void {
    if (this.stoppedTimer) clearTimeout(this.stoppedTimer);
    this.stoppedTimer = null;
    const dist = this.drive.trip().distanceM;
    if (moving) {
      if (this.driveStartM === 0) this.driveStartM = dist;
      return;
    }
    this.stoppedTimer = setTimeout(() => {
      const drove = this.drive.trip().distanceM - this.driveStartM;
      if (this.state().autoSave && drove >= AUTO_SAVE_MIN_DRIVE_M && !this.drive.moving()) {
        this.park(true);
        this.driveStartM = 0;
      }
    }, AUTO_SAVE_AFTER_MS);
  }

  private async scheduleReminders(expiresAt: number | null): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFY_SOON }, { id: NOTIFY_EXPIRED }] });
      if (expiresAt === null) return;
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;
      const notifications = [
        { id: NOTIFY_EXPIRED, title: 'Parking expired', body: 'Your parking time is up.', schedule: { at: new Date(expiresAt) } },
      ];
      if (expiresAt - Date.now() > REMIND_BEFORE_MS) {
        notifications.push({
          id: NOTIFY_SOON,
          title: 'Parking ends soon',
          body: 'Your parking time ends in 10 minutes.',
          schedule: { at: new Date(expiresAt - REMIND_BEFORE_MS) },
        });
      }
      await LocalNotifications.schedule({ notifications });
    } catch {
      /* notifications not available (e.g. some browsers) – the in-app countdown still works */
    }
  }

  private patch(p: Partial<ParkingState>): void {
    this.state.update((s) => ({ ...s, ...p }));
    save('parking', this.state());
  }
}
