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
  template: `
    <button class="d" [class.act]="ui.section() === 'controls' && !ui.climateOpen()" (click)="ui.open('controls')" aria-label="Controls">
      <app-icon name="car" [size]="30" />
    </button>
    <div class="temp">
      <button class="c" (click)="vehicle.stepTemp('driverC', -0.5)" aria-label="Colder">‹</button>
      <span (click)="ui.toggleClimate()" [class.off]="!c().on">
        {{ c().on ? (settings.imperial() ? settings.temp(c().driverC) : (c().driverC | number: '1.1-1')) + '°' : 'Off' }}
      </span>
      <button class="c" (click)="vehicle.stepTemp('driverC', 0.5)" aria-label="Warmer">›</button>
    </div>

    <div class="mid">
      @for (s of shortcuts; track s.id) {
        <button class="d" [class.act]="ui.section() === s.id && !ui.climateOpen()" (click)="ui.open(s.id)" [attr.aria-label]="s.id">
          <app-icon [name]="s.icon" [size]="30" />
        </button>
      }
      <button class="d" [class.act]="ui.climateOpen()" (click)="ui.toggleClimate()" aria-label="Climate">
        <app-icon name="fan" [size]="30" />
      </button>
    </div>

    <button class="d seatd" [class.hot]="c().seatDriver > 0" (click)="vehicle.cycleSeat('seatDriver')" aria-label="Driver seat heat">
      <app-icon name="seat" [size]="28" />
      <span class="heat">@for (i of [1, 2, 3]; track i) { <i [class.on]="c().seatDriver >= i"></i> }</span>
    </button>
    <button class="d" [class.hot]="c().defrostRear" (click)="vehicle.toggleClimate('defrostRear')" aria-label="Rear defrost">
      <app-icon name="defR" [size]="28" />
    </button>
    <button class="d" [class.hot]="c().wheelHeat" (click)="vehicle.toggleClimate('wheelHeat')" aria-label="Wheel heat">
      <app-icon name="wheel" [size]="28" />
    </button>
    <button class="d seatd" [class.hot]="c().seatPassenger > 0" (click)="vehicle.cycleSeat('seatPassenger')" aria-label="Passenger seat heat">
      <app-icon name="seat" [size]="28" [flip]="true" />
      <span class="heat">@for (i of [1, 2, 3]; track i) { <i [class.on]="c().seatPassenger >= i"></i> }</span>
    </button>
  `,
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
