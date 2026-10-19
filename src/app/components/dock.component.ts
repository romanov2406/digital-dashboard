import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SettingsService } from '../services/settings.service';
import { Section, UiService } from '../services/ui.service';
import { VehicleService } from '../services/vehicle.service';
import { IconComponent } from './icon.component';

/** Bottom bar, laid out like Tesla's: car · temperature · shortcuts · seat heat. */
@Component({
  selector: 'app-dock',
  imports: [IconComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dock' },
  templateUrl: './dock.component.html',
})
export class DockComponent {
  protected readonly ui = inject(UiService);
  protected readonly vehicle = inject(VehicleService);
  protected readonly settings = inject(SettingsService);
  protected readonly c = this.vehicle.climate;

  protected readonly shortcuts: { id: Section; icon: string }[] = [
    { id: 'lights', icon: 'bulb' },
    { id: 'locks', icon: 'lock' },
    { id: 'trip', icon: 'chart' },
    { id: 'settings', icon: 'cog' },
  ];
}
