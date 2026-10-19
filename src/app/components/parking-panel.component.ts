import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { compass, DriveService } from '../services/drive.service';
import { EnvironmentService } from '../services/environment.service';
import { ParkingService, ZONE_MID, ZONE_NEAR, ZONE_STOP } from '../services/parking.service';
import { SettingsService } from '../services/settings.service';
import { IconComponent } from './icon.component';

interface Arc {
  path: string;
  zone: 'far' | 'mid' | 'near' | 'stop';
}

/** Car outline centre and size in the park-assist SVG (viewBox 0 0 300 440). */
const CX = 150;
const CY = 220;
const CAR_HALF_LEN = 105;
/** Sensor range shown, in cm. */
const MAX_CM = 150;

/** Parking section: park assist, parked-car location and parking timer. */
@Component({
  selector: 'app-parking-panel',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'parking' },
  templateUrl: './parking-panel.component.html',
})
export class ParkingPanelComponent implements OnInit, OnDestroy {
  protected readonly parking = inject(ParkingService);
  protected readonly drive = inject(DriveService);
  protected readonly settings = inject(SettingsService);
  private readonly env = inject(EnvironmentService);

  protected readonly timerOpts = [
    { min: null, l: 'Off' },
    { min: 30, l: '30 min' },
    { min: 60, l: '1 h' },
    { min: 120, l: '2 h' },
    { min: 180, l: '3 h' },
  ] as const;

  protected readonly frontArcs = computed(() => this.arcs(this.parking.sensors()?.front ?? [], -140, -40));
  protected readonly rearArcs = computed(() => this.arcs(this.parking.sensors()?.rear ?? [], 40, 140));
  protected readonly frontMin = computed(() => minOf(this.parking.sensors()?.front));
  protected readonly rearMin = computed(() => minOf(this.parking.sensors()?.rear));

  protected readonly toCarText = computed(() => {
    const t = this.parking.toCar();
    if (!t) return null;
    return { dist: this.formatDistance(t.metres), dir: compass(t.bearing), bearing: t.bearing };
  });

  protected readonly savedText = computed(() => {
    const s = this.parking.spot();
    if (!s) return '';
    const mins = Math.max(0, Math.round((this.env.now().getTime() - s.savedAt) / 60_000));
    const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ${mins % 60} min ago`;
    const time = new Date(s.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${s.auto ? 'Saved automatically' : 'Saved'} at ${time} · ${ago}`;
  });

  protected readonly countdown = computed(() => {
    const ms = this.parking.remainingMs();
    if (ms === null) return null;
    if (ms === 0) return 'Expired';
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (h ? `${h}:${pad(m)}` : `${m}`) + `:${pad(sec)}`;
  });

  protected readonly endsAt = computed(() => {
    const e = this.parking.expiresAt();
    return e === null ? '' : new Date(e).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  ngOnInit(): void {
    this.parking.startSensorDemo();
  }

  ngOnDestroy(): void {
    this.parking.stopSensorDemo();
  }

  protected label(cm: number | null): string {
    if (cm === null) return '';
    if (cm <= ZONE_STOP) return 'STOP';
    return this.settings.imperial() ? `${Math.round(cm / 2.54)} in` : `${cm} cm`;
  }

  protected zoneOf(cm: number | null): string {
    return cm === null ? 'far' : zone(cm);
  }

  protected timerActive(min: number | null): boolean {
    const remaining = this.parking.remainingMs();
    if (min === null) return remaining === null;
    return remaining !== null && this.parking.state().timerMinutes === min;
  }

  private formatDistance(m: number): string {
    if (this.settings.imperial()) {
      const ft = m * 3.28084;
      return ft < 1000 ? `${Math.round(ft / 10) * 10} ft` : `${(m / 1609.344).toFixed(1)} mi`;
    }
    return m < 1000 ? `${Math.round(m / 5) * 5} m` : `${(m / 1000).toFixed(1)} km`;
  }

  /** One arc per sensor, spread evenly between two angles; closer obstacles sit nearer the car. */
  private arcs(readings: (number | null)[], from: number, to: number): Arc[] {
    const n = readings.length;
    const step = (to - from) / Math.max(1, n);
    return readings.flatMap((cm, i) => {
      if (cm === null) return [];
      const r = CAR_HALF_LEN + 14 + (Math.min(cm, MAX_CM) / MAX_CM) * 80;
      const a0 = from + i * step + 2.5;
      const a1 = from + (i + 1) * step - 2.5;
      return [{ path: arcPath(r, a0, a1), zone: zone(cm) }];
    });
  }
}

function zone(cm: number): Arc['zone'] {
  return cm <= ZONE_STOP ? 'stop' : cm <= ZONE_NEAR ? 'near' : cm <= ZONE_MID ? 'mid' : 'far';
}

function minOf(v: (number | null)[] | undefined): number | null {
  const nums = (v ?? []).filter((x): x is number => x !== null);
  return nums.length ? Math.min(...nums) : null;
}

function arcPath(r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(CX + r * Math.cos(rad)).toFixed(1)} ${(CY + r * Math.sin(rad)).toFixed(1)}`;
  };
  return `M ${p(a0)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${p(a1)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
