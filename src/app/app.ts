import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonApp } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { CarCardComponent } from './components/car-card.component';
import { ClimatePanelComponent } from './components/climate-panel.component';
import { ControlsWindowComponent } from './components/controls-window.component';
import { DockComponent } from './components/dock.component';
import { IconComponent } from './components/icon.component';
import { EnvironmentService } from './services/environment.service';
import { SettingsService } from './services/settings.service';
import { UiService } from './services/ui.service';
import { VehicleService } from './services/vehicle.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, CarCardComponent, ControlsWindowComponent, ClimatePanelComponent, DockComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <div class="shell">
        <div class="main">
          <app-car-card />
          <div class="right">
            <div class="topstrip">
              <span class="s"><app-icon [name]="vehicle.controls().locked ? 'lock' : 'unlock'" [size]="18" /></span>
              <span>{{ time() }}</span>
              @if (env.outsideC() !== null) { <span>{{ settings.temp(env.outsideC()!) }}°{{ settings.imperial() ? 'F' : 'C' }}</span> }
            </div>
            <app-controls-window />
            @if (ui.climateOpen()) {
              <div class="scrim" (click)="ui.climateOpen.set(false)"></div>
              <div class="sheet">
                <div class="grab" (click)="ui.climateOpen.set(false)"></div>
                <app-climate-panel />
              </div>
            }
          </div>
        </div>
        <app-dock />
      </div>
    </ion-app>
  `,
})
export class App {
  protected readonly ui = inject(UiService);
  protected readonly env = inject(EnvironmentService);
  protected readonly settings = inject(SettingsService);
  protected readonly vehicle = inject(VehicleService);

  constructor() {
    if (Capacitor.isNativePlatform()) StatusBar.hide().catch(() => undefined);
  }

  protected time(): string {
    return this.env.now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
