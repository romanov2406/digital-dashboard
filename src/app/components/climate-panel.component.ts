import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { EnvironmentService } from '../services/environment.service';
import { SettingsService } from '../services/settings.service';
import { ClimateState, VehicleService } from '../services/vehicle.service';
import { IconComponent } from './icon.component';

type BoolClimate = { [K in keyof ClimateState]: ClimateState[K] extends boolean ? K : never }[keyof ClimateState];

/** Climate controls; shown in the pop-up sheet and in the Climate section. */
@Component({
  selector: 'app-climate-panel',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'climate-panel', '[class.off]': '!c().on' },
  templateUrl: './climate-panel.component.html',
})
export class ClimatePanelComponent {
  protected readonly vehicle = inject(VehicleService);
  protected readonly settings = inject(SettingsService);
  protected readonly env = inject(EnvironmentService);
  protected readonly c = this.vehicle.climate;
  protected readonly levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  protected readonly buttons: { key: BoolClimate; icon: string; label: string; hot?: boolean }[] = [
    { key: 'ac', icon: 'snow', label: 'A/C' },
    { key: 'recirc', icon: 'recirc', label: 'Recirculate' },
    { key: 'airFace', icon: 'face', label: 'Face' },
    { key: 'airFeet', icon: 'feet', label: 'Feet' },
    { key: 'defrostFront', icon: 'defF', label: 'Front defrost', hot: true },
    { key: 'defrostRear', icon: 'defR', label: 'Rear defrost', hot: true },
    { key: 'wheelHeat', icon: 'wheel', label: 'Wheel heat', hot: true },
  ];

  private readonly decimal = new DecimalPipe('en-US');

  protected fmt(c: number): string {
    return this.settings.imperial() ? String(this.settings.temp(c)) : this.decimal.transform(c, '1.1-1')!;
  }

  protected setFan(level: number): void {
    this.vehicle.setClimate('fan', level);
    if (!this.c().on) this.vehicle.setClimate('on', true);
    if (this.c().auto) this.vehicle.setClimate('auto', false);
  }
}
