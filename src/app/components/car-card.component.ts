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
  template: `
    <div class="status">
      <div class="prnd">
        @for (g of gears; track g) {
          @if (g === vehicle.gear()) { <b>{{ g }}</b> } @else { <span>{{ g }}</span> }
        }
      </div>
      @if (vehicle.battery() !== null) {
        <div class="batt">
          <div class="b"><i [style.width.%]="vehicle.battery()" [class.chg]="env.charging()"></i></div>
          {{ vehicle.battery() }} %
        </div>
      }
    </div>

    <div class="speedrow">
      <div class="limit" [class.hidden]="limit() === null" [class.over]="over()">{{ limit() }}</div>
      <div class="speed">
        <div class="n">{{ drive.speed() }}</div>
        <div class="u">{{ settings.speedUnit() }}</div>
      </div>
      <div class="ap" [class.on]="drive.status() === 'ok' || drive.status() === 'demo'" [title]="gpsLabel()">
        <app-icon name="gps" [size]="28" />
      </div>
    </div>

    <div class="powerline" title="Acceleration">
      <i [style.left.%]="power().left" [style.width.%]="power().width" [class.regen]="power().regen"></i><b></b>
    </div>

    @if (gpsLabel()) {
      <div class="gps-pill" (click)="useDemo()">{{ gpsLabel() }}</div>
    }

    <div class="lane">
      <svg viewBox="0 0 400 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--panel)" />
            <stop offset=".55" stop-color="var(--panel)" stop-opacity="0" />
            <stop offset=".85" stop-color="var(--panel)" stop-opacity="0" />
            <stop offset="1" stop-color="var(--panel)" />
          </linearGradient>
        </defs>
        <path d="M190 0 L 60 300" stroke="var(--muted)" stroke-width="2.5" opacity=".55" />
        <path d="M210 0 L 340 300" stroke="var(--muted)" stroke-width="2.5" opacity=".55" />
        <path d="M200 0 L 200 300" stroke="var(--blue)" stroke-width="70" opacity=".12" />
        <path class="dash" d="M197 0 L 130 300" stroke="var(--muted)" stroke-width="2" stroke-dasharray="14 16" opacity=".35"
              [style.animation-duration.s]="dashSpeed()" [class.paused]="!drive.moving()" />
        <path class="dash" d="M203 0 L 270 300" stroke="var(--muted)" stroke-width="2" stroke-dasharray="14 16" opacity=".35"
              [style.animation-duration.s]="dashSpeed()" [class.paused]="!drive.moving()" />
        <rect width="400" height="300" fill="url(#lf)" />
      </svg>
    </div>

    <div class="infocard">
      <div class="tabs">
        <span [class.on]="tab() === 'trip'" (click)="tab.set('trip')">Trip</span>
        <span [class.on]="tab() === 'speed'" (click)="tab.set('speed')">Speed</span>
        <span [class.on]="tab() === 'gps'" (click)="tab.set('gps')">GPS</span>
      </div>
      <div class="grid">
        @switch (tab()) {
          @case ('trip') {
            <div><div class="v">{{ settings.distance(drive.trip().distanceM) | number: '1.1-1' }}<small>{{ settings.distUnit() }}</small></div><div class="l">Distance</div></div>
            <div><div class="v">{{ duration() }}<small>h</small></div><div class="l">Driving time</div></div>
            <div><div class="v">{{ drive.avgSpeed() | number: '1.0-0' }}<small>{{ unitLower() }}</small></div><div class="l">Avg speed</div></div>
          }
          @case ('speed') {
            <div><div class="v">{{ settings.speed(drive.trip().maxMs) | number: '1.0-0' }}<small>{{ unitLower() }}</small></div><div class="l">Max speed</div></div>
            <div><div class="v">{{ heading() }}</div><div class="l">Heading</div></div>
            <div><div class="v">{{ limit() ?? '—' }}<small>{{ limit() === null ? '' : unitLower() }}</small></div><div class="l">Limit</div></div>
          }
          @case ('gps') {
            <div><div class="v">{{ drive.accuracy() === null ? '—' : '±' + (drive.accuracy()! | number: '1.0-0') }}<small>m</small></div><div class="l">Accuracy</div></div>
            <div><div class="v">{{ drive.altitude() === null ? '—' : (drive.altitude()! | number: '1.0-0') }}<small>m</small></div><div class="l">Altitude</div></div>
            <div><div class="v">{{ drive.heading() === null ? '—' : (drive.heading()! | number: '1.0-0') + '°' }}</div><div class="l">Bearing</div></div>
          }
        }
      </div>
      <div class="pdots">
        <i [class.on]="tab() === 'trip'"></i><i [class.on]="tab() === 'speed'"></i><i [class.on]="tab() === 'gps'"></i>
      </div>
    </div>
  `,
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
