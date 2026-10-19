import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { DriveService } from '../services/drive.service';
import { SettingsService } from '../services/settings.service';
import { Section, UiService } from '../services/ui.service';
import { ControlsState, VehicleService } from '../services/vehicle.service';
import { IconComponent } from './icon.component';
import { ClimatePanelComponent } from './climate-panel.component';
import { ParkingPanelComponent } from './parking-panel.component';

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
  imports: [IconComponent, DecimalPipe, NgTemplateOutlet, ClimatePanelComponent, ParkingPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'window' },
  templateUrl: './controls-window.component.html',
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
    { id: 'parking', icon: 'parking', label: 'Parking' },
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
