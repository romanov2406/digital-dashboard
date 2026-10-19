import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { DriveService } from '../services/drive.service';
import { SettingsService } from '../services/settings.service';
import { Section, UiService } from '../services/ui.service';
import { ControlsState, VehicleService } from '../services/vehicle.service';
import { IconComponent } from './icon.component';
import { ClimatePanelComponent } from './climate-panel.component';

type BoolControl = { [K in keyof ControlsState]: ControlsState[K] extends boolean ? K : never }[keyof ControlsState];

interface Tile {
  key: BoolControl;
  icon: string;
  label: string;
  onLabel?: string;
}

const LIGHT_TILES: Tile[] = [{ key: 'fog', icon: 'fog', label: 'Fog Lights' }];
const LOCK_TILES: Tile[] = [
  { key: 'locked', icon: 'unlock', label: 'Unlocked', onLabel: 'Locked' },
  { key: 'childLock', icon: 'child', label: 'Child Lock' },
  { key: 'windowLock', icon: 'window', label: 'Window Lock' },
];
const OPEN_TILES: Tile[] = [
  { key: 'mirrorsFolded', icon: 'mirror', label: 'Fold Mirrors' },
  { key: 'glovebox', icon: 'glove', label: 'Glovebox' },
  { key: 'frunk', icon: 'frunk', label: 'Frunk' },
  { key: 'trunk', icon: 'trunk', label: 'Trunk' },
];

/** Tesla-style "Controls" window: side menu + section content. */
@Component({
  selector: 'app-controls-window',
  imports: [IconComponent, DecimalPipe, NgTemplateOutlet, ClimatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'window' },
  template: `
    <nav class="menu">
      @for (m of menu; track m.id) {
        <div class="it" [class.on]="ui.section() === m.id" (click)="ui.open(m.id)">
          <app-icon [name]="m.icon" />{{ m.label }}
        </div>
      }
    </nav>

    <div class="content">
      @switch (ui.section()) {
        @case ('controls') {
          <ng-container *ngTemplateOutlet="headlights" />
          <div class="tiles">
            @for (t of quickTiles; track t.key) { <ng-container *ngTemplateOutlet="tile; context: { $implicit: t }" /> }
          </div>
          <ng-container *ngTemplateOutlet="wipers" />
          <div class="two">
            <ng-container *ngTemplateOutlet="steering" />
            <ng-container *ngTemplateOutlet="appearance" />
          </div>
        }
        @case ('lights') {
          <h2>Lights</h2>
          <ng-container *ngTemplateOutlet="headlights" />
          <div class="tiles">
            @for (t of lightTiles; track t.key) { <ng-container *ngTemplateOutlet="tile; context: { $implicit: t }" /> }
          </div>
        }
        @case ('locks') {
          <h2>Locks</h2>
          <div class="tiles">
            @for (t of lockTiles.concat(openTiles); track t.key) { <ng-container *ngTemplateOutlet="tile; context: { $implicit: t }" /> }
          </div>
        }
        @case ('climate') {
          <h2>Climate</h2>
          <app-climate-panel />
        }
        @case ('seats') {
          <h2>Seats</h2>
          <div class="tiles">
            <div class="tile" [class.hot]="c().seatDriver > 0" (click)="vehicle.cycleSeat('seatDriver')">
              <app-icon name="seat" [size]="28" /><span>Driver seat <span class="heat">@for (i of [1, 2, 3]; track i) { <i [class.on]="c().seatDriver >= i"></i> }</span></span>
            </div>
            <div class="tile" [class.hot]="c().seatPassenger > 0" (click)="vehicle.cycleSeat('seatPassenger')">
              <app-icon name="seat" [size]="28" [flip]="true" /><span>Passenger seat <span class="heat">@for (i of [1, 2, 3]; track i) { <i [class.on]="c().seatPassenger >= i"></i> }</span></span>
            </div>
            <div class="tile" [class.hot]="c().wheelHeat" (click)="vehicle.toggleClimate('wheelHeat')">
              <app-icon name="wheel" [size]="28" />Steering wheel heat
            </div>
          </div>
          <ng-container *ngTemplateOutlet="steering" />
        }
        @case ('trip') {
          <h2>Trip</h2>
          <div class="stats">
            <div><div class="v">{{ settings.distance(drive.trip().distanceM) | number: '1.1-1' }}<small>{{ settings.distUnit() }}</small></div><div class="l">Distance</div></div>
            <div><div class="v">{{ drivingTime() }}</div><div class="l">Driving time</div></div>
            <div><div class="v">{{ drive.avgSpeed() | number: '1.0-0' }}<small>{{ settings.speedUnit() }}</small></div><div class="l">Average speed</div></div>
            <div><div class="v">{{ settings.speed(drive.trip().maxMs) | number: '1.0-0' }}<small>{{ settings.speedUnit() }}</small></div><div class="l">Max speed</div></div>
          </div>
          <div class="sub">Started {{ started() }}</div>
          <div><button class="btn" (click)="drive.resetTrip()"><app-icon name="reset" [size]="20" />Reset trip</button></div>
        }
        @case ('display') {
          <h2>Display</h2>
          <ng-container *ngTemplateOutlet="appearance" />
          <ng-container *ngTemplateOutlet="switchRow; context: { label: 'Keep screen on', desc: 'Prevent the screen from sleeping while the app is open', key: 'keepAwake' }" />
        }
        @case ('settings') {
          <h2>Settings</h2>
          <div>
            <div class="sec-t">Units</div>
            <div class="seg">
              <span [class.on]="!settings.imperial()" (click)="settings.update({ units: 'metric' })">km/h · °C</span>
              <span [class.on]="settings.imperial()" (click)="settings.update({ units: 'imperial' })">mph · °F</span>
            </div>
          </div>
          <ng-container *ngTemplateOutlet="switchRow; context: { label: 'Demo mode', desc: 'Simulate driving instead of using GPS', key: 'demo' }" />
          <ng-container *ngTemplateOutlet="switchRow; context: { label: 'Speed limits', desc: 'Look up road speed limits from OpenStreetMap', key: 'speedLimits' }" />
          <ng-container *ngTemplateOutlet="switchRow; context: { label: 'Outside temperature', desc: 'Fetch the local temperature from Open-Meteo', key: 'weather' }" />
          <div class="row">
            <div><div class="t">Vehicle connection</div><div class="d">{{ vehicle.link.name }}</div></div>
            <span class="dot" [class.ok]="vehicle.link.connected()"></span>
          </div>
        }
      }
    </div>

    <!-- reusable pieces -->
    <ng-template #tile let-t>
      <div class="tile" [class.on]="isOn(t)" (click)="vehicle.toggleControl(t.key)">
        <app-icon [name]="isOn(t) && t.key === 'locked' ? 'lock' : t.icon" [size]="28" />
        {{ isOn(t) && t.onLabel ? t.onLabel : t.label }}
      </div>
    </ng-template>

    <ng-template #headlights>
      <div>
        <div class="sec-t"><app-icon name="bulb" [size]="20" />Headlights</div>
        <div class="seg">
          @for (o of headlightOpts; track o.v) {
            <span [class.on]="ctl().headlights === o.v" (click)="vehicle.setControl('headlights', o.v)">{{ o.l }}</span>
          }
        </div>
      </div>
    </ng-template>

    <ng-template #wipers>
      <div>
        <div class="sec-t"><app-icon name="wiper" [size]="20" />Wipers</div>
        <div class="seg">
          @for (o of wiperOpts; track o.v) {
            <span [class.on]="ctl().wipers === o.v" (click)="vehicle.setControl('wipers', o.v)">{{ o.l }}</span>
          }
        </div>
      </div>
    </ng-template>

    <ng-template #steering>
      <div>
        <div class="sec-t"><app-icon name="wheel" [size]="20" />Steering</div>
        <div class="seg">
          @for (o of steeringOpts; track o.v) {
            <span [class.on]="ctl().steering === o.v" (click)="vehicle.setControl('steering', o.v)">{{ o.l }}</span>
          }
        </div>
      </div>
    </ng-template>

    <ng-template #appearance>
      <div>
        <div class="sec-t"><app-icon name="display" [size]="20" />Appearance</div>
        <div class="seg">
          @for (o of themeOpts; track o.v) {
            <span [class.on]="settings.value().theme === o.v" (click)="settings.update({ theme: o.v })">{{ o.l }}</span>
          }
        </div>
      </div>
    </ng-template>

    <ng-template #switchRow let-label="label" let-desc="desc" let-key="key">
      <div class="row" (click)="toggleSetting(key)">
        <div><div class="t">{{ label }}</div><div class="d">{{ desc }}</div></div>
        <span class="switch" [class.on]="settingOn(key)"><i></i></span>
      </div>
    </ng-template>
  `,
})
export class ControlsWindowComponent {
  protected readonly ui = inject(UiService);
  protected readonly vehicle = inject(VehicleService);
  protected readonly settings = inject(SettingsService);
  protected readonly drive = inject(DriveService);

  protected readonly ctl = this.vehicle.controls;
  protected readonly c = this.vehicle.climate;

  protected readonly menu: { id: Section; icon: string; label: string }[] = [
    { id: 'controls', icon: 'toggle', label: 'Controls' },
    { id: 'lights', icon: 'bulb', label: 'Lights' },
    { id: 'locks', icon: 'lock', label: 'Locks' },
    { id: 'climate', icon: 'fan', label: 'Climate' },
    { id: 'seats', icon: 'seat', label: 'Seats' },
    { id: 'trip', icon: 'chart', label: 'Trip' },
    { id: 'display', icon: 'display', label: 'Display' },
    { id: 'settings', icon: 'cog', label: 'Settings' },
  ];

  protected readonly quickTiles: Tile[] = [
    LIGHT_TILES[0], OPEN_TILES[0], LOCK_TILES[1], LOCK_TILES[2], OPEN_TILES[1], LOCK_TILES[0], OPEN_TILES[2], OPEN_TILES[3],
  ];
  protected readonly lightTiles = LIGHT_TILES;
  protected readonly lockTiles = LOCK_TILES;
  protected readonly openTiles = OPEN_TILES;

  protected readonly headlightOpts = [
    { v: 'off', l: 'Off' }, { v: 'parking', l: 'Parking' }, { v: 'on', l: 'On' }, { v: 'auto', l: 'Auto' },
  ] as const;
  protected readonly wiperOpts = [
    { v: 'off', l: 'Off' }, { v: 'auto', l: 'Auto' }, { v: '1', l: 'I' }, { v: '2', l: 'II' }, { v: '3', l: 'III' }, { v: '4', l: 'IIII' },
  ] as const;
  protected readonly steeringOpts = [
    { v: 'comfort', l: 'Comfort' }, { v: 'standard', l: 'Standard' }, { v: 'sport', l: 'Sport' },
  ] as const;
  protected readonly themeOpts = [
    { v: 'auto', l: 'Auto' }, { v: 'light', l: 'Light' }, { v: 'dark', l: 'Dark' },
  ] as const;

  protected readonly drivingTime = computed(() => {
    const s = Math.floor(this.drive.trip().movingS);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h} h ${m} min` : `${m} min`;
  });
  protected readonly started = computed(() =>
    new Date(this.drive.trip().startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
  );

  protected isOn(t: Tile): boolean {
    return this.ctl()[t.key];
  }

  protected settingOn(key: 'demo' | 'keepAwake' | 'speedLimits' | 'weather'): boolean {
    return this.settings.value()[key];
  }

  protected toggleSetting(key: 'demo' | 'keepAwake' | 'speedLimits' | 'weather'): void {
    this.settings.update({ [key]: !this.settings.value()[key] });
  }
}
