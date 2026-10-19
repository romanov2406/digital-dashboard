import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideIonicAngular } from '@ionic/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'ios' }),
    // To control real hardware, provide your own VehicleLink here, e.g.
    // { provide: VEHICLE_LINK, useClass: BleVehicleLink },
  ],
};
