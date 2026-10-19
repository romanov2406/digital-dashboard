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
  template: `
    <div class="row1">
      <button class="pw" [class.on]="c().on" (click)="vehicle.toggleClimate('on')" aria-label="Climate power">
        <app-icon name="power" [size]="28" />
      </button>
      <div class="zone">
        <div class="tz">
          <button class="c" (click)="vehicle.stepTemp('driverC', -0.5)" aria-label="Driver colder">‹</button>
          <span class="t">{{ fmt(c().driverC) }}°</span>
          <button class="c" (click)="vehicle.stepTemp('driverC', 0.5)" aria-label="Driver warmer">›</button>
        </div>
        <div class="lbl">Driver</div>
      </div>
      <button class="autopill" [class.on]="c().auto" (click)="vehicle.toggleClimate('auto')">Auto</button>
      <div class="zone passenger">
        <div class="tz">
          <button class="c" (click)="vehicle.stepTemp('passengerC', -0.5)" aria-label="Passenger colder">‹</button>
          <span class="t">{{ fmt(c().passengerC) }}°</span>
          <button class="c" (click)="vehicle.stepTemp('passengerC', 0.5)" aria-label="Passenger warmer">›</button>
        </div>
        <div class="lbl">Passenger</div>
      </div>
      <div class="inout">
        @if (env.outsideC() !== null) { Outside <b>{{ settings.temp(env.outsideC()!) }}°</b> }
      </div>
    </div>

    <div class="fanrow">
      <app-icon name="fan" [size]="26" />
      <div class="bars">
        @for (i of levels; track i) {
          <i [class.on]="c().on && i <= c().fan" [style.height.%]="30 + (i - 1) * 7.5" (click)="setFan(i)"></i>
        }
      </div>
      <div class="n">{{ c().on ? c().fan : 'Off' }}</div>
    </div>

    <div class="cbtns">
      @for (b of buttons; track b.key) {
        <button class="cb" [class.on]="c()[b.key] && !b.hot" [class.hot]="c()[b.key] && b.hot" (click)="vehicle.toggleClimate(b.key)">
          <app-icon [name]="b.icon" [size]="28" />{{ b.label }}
        </button>
      }
      <button class="cb" [class.hot]="c().seatDriver > 0" (click)="vehicle.cycleSeat('seatDriver')">
        <app-icon name="seat" [size]="28" />
        <span class="heat">@for (i of [1, 2, 3]; track i) { <i [class.on]="c().seatDriver >= i"></i> }</span>
      </button>
      <button class="cb" [class.hot]="c().seatPassenger > 0" (click)="vehicle.cycleSeat('seatPassenger')">
        <app-icon name="seat" [size]="28" [flip]="true" />
        <span class="heat">@for (i of [1, 2, 3]; track i) { <i [class.on]="c().seatPassenger >= i"></i> }</span>
      </button>
    </div>
  `,
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
