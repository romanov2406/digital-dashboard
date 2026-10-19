import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { compass, DriveService } from '../services/drive.service';
import { EnvironmentService } from '../services/environment.service';
import { SettingsService } from '../services/settings.service';
import { VehicleService } from '../services/vehicle.service';
import { IconComponent } from './icon.component';

type InfoTab = 'trip' | 'speed' | 'gps';

/** Left "car card": gear, battery, speed, power bar and swipeable trip card. */
@Component({
  selector: 'app-car-card',
  imports: [DecimalPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card-left' },
  templateUrl: './car-card.component.html',
})
export class CarCardComponent {
  protected readonly drive = inject(DriveService);
  protected readonly env = inject(EnvironmentService);
  protected readonly settings = inject(SettingsService);
  protected readonly vehicle = inject(VehicleService);

  protected readonly gears = ['P', 'R', 'N', 'D'] as const;
  protected readonly tab = signal<InfoTab>('trip');

  protected readonly unitLower = computed(() => this.settings.speedUnit().toLowerCase());
  protected readonly heading = computed(() => compass(this.drive.heading()));

  protected readonly limit = computed(() => {
    const kmh = this.env.limitKmh();
    if (kmh === null) return null;
    return this.settings.imperial() ? Math.round(kmh / 1.609344 / 5) * 5 : kmh;
  });
  protected readonly over = computed(() => this.limit() !== null && this.drive.speed() > this.limit()! + 2);

  protected readonly duration = computed(() => {
    const s = Math.floor(this.drive.trip().movingS);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  });

  /** Power bar: zero mark at 30 %, acceleration grows right, braking (regen) grows left. */
  protected readonly power = computed(() => {
    const a = this.drive.accel();
    const zero = 30;
    if (a >= 0) return { left: zero, width: Math.min(70, (a / 3) * 70), regen: false };
    const w = Math.min(zero, (-a / 4) * zero);
    return { left: zero - w, width: w, regen: true };
  });

  /** Lane dashes scroll faster the faster we go. */
  protected readonly dashSpeed = computed(() => Math.max(0.15, 12 / Math.max(1, this.drive.speedMs())));

  protected readonly gpsLabel = computed(() => {
    switch (this.drive.status()) {
      case 'searching': return 'Searching for GPS…';
      case 'denied': return 'Location permission denied · tap for demo mode';
      case 'unavailable': return 'GPS unavailable · tap for demo mode';
      default: return '';
    }
  });

  protected useDemo(): void {
    if (this.drive.status() !== 'searching') this.settings.update({ demo: true });
  }
}
