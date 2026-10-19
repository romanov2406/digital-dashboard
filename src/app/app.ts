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
  templateUrl: './app.html',
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
