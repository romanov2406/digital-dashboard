# Digital Dashboard

A Tesla-style digital dashboard built with **Ionic + Angular + Capacitor**. It shows your live speed from the phone's GPS, together with climate and car controls in the layout of Tesla's latest UI. It works on tablets (landscape) and phones (portrait), in light and dark mode.

| Tablet – light | Climate pop-up – dark |
| --- | --- |
| ![Tablet](docs/screenshots/tablet-light.png) | ![Climate](docs/screenshots/climate-dark.png) |

| Settings | Phone | Phone – climate |
| --- | --- | --- |
| ![Settings](docs/screenshots/settings-light.png) | <img src="docs/screenshots/phone.png" width="260"> | <img src="docs/screenshots/phone-climate.png" width="260"> |

## Features

- **Speed**: large live speed from GPS (km/h or mph), with a power/regen bar driven by acceleration and moving lane lines.
- **Speed limit**: looked up from OpenStreetMap; the sign pulses when you are over the limit.
- **Trip card**: distance, driving time, average and max speed, heading, plus GPS accuracy and altitude. The trip is saved between launches and can be reset.
- **Climate**: driver and passenger temperature, Auto, a 10-step fan, A/C, recirculation, face/feet airflow, front and rear defrost, 3-level seat heaters and steering wheel heat. Tap the temperature in the bottom bar to open the pop-up.
- **Controls**: headlights (Off/Parking/On/Auto), fog lights, mirrors, child and window locks, glovebox, door lock, frunk, trunk, wipers and steering mode.
- **Bottom bar** in Tesla's layout: car, temperature ‹ ›, shortcuts, seat heaters, rear defrost and wheel heat.
- **Settings**: units, light/dark/auto appearance, keep the screen on, demo mode, and on/off switches for the speed-limit and weather lookups.
- **Demo mode**: simulated driving, so you can try the app at your desk. It is offered automatically if GPS is denied or unavailable.

> **About the car controls:** out of the box, climate and control buttons only keep their state in the app; they don't talk to the car (see *Connecting a real car* below).
> Gear (P/D) is inferred from movement, and the battery shows the phone/tablet battery, unless a vehicle link provides real values.

## Getting started

Requirements: Node.js 20.19+ or 22.12+, plus Android Studio (Android) or Xcode (iOS) for device builds.

```bash
npm install
npm start            # dev server at http://localhost:4200
```

In a desktop browser, allow location access or switch on **Settings → Demo mode**.

### Run on Android

```bash
npm run android      # builds, syncs and opens Android Studio
```

Then press **Run** in Android Studio. Location permissions are already in `android/app/src/main/AndroidManifest.xml`.

### Run on iOS

```bash
npx cap add ios
```

Then add these keys to `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to show your speed and trip.</string>
```

Then run:

```bash
npm run ios
```

## Project structure

```
src/app/
├── app.ts                         # layout: car card | controls window, climate sheet, dock
├── components/
│   ├── car-card.component.ts      # gear, battery, speed, power bar, trip card
│   ├── controls-window.component.ts  # Tesla "Controls" window with side menu
│   ├── climate-panel.component.ts # climate controls (sheet + Climate section)
│   ├── dock.component.ts          # bottom bar
│   └── icon.component.ts          # icons from the SVG sprite in index.html
└── services/
    ├── drive.service.ts           # GPS speed, heading, trip, demo simulator
    ├── environment.service.ts     # clock, battery, outside temp, speed limit
    ├── vehicle.service.ts         # climate/controls state + VehicleLink interface
    ├── settings.service.ts        # units, theme, demo, keep-awake
    └── ui.service.ts              # active section, climate sheet
```

## Connecting a real car

Every button goes through `VehicleService`, which sends a `VehicleCommand` to a `VehicleLink`, for example:

```ts
{ kind: 'climate', key: 'driverC', value: 22 }
```

The default `DemoVehicleLink` only logs the commands. To control real hardware (such as an ESP32 or Arduino over Bluetooth LE, or an OBD adapter), implement `VehicleLink` and provide it in `src/app/app.config.ts`:

```ts
{ provide: VEHICLE_LINK, useClass: MyBleVehicleLink }
```

A link can also expose `batteryPercent()` and `gear()` so the dashboard shows real car data.

## Data sources

- Speed and position: device GPS via `@capacitor/geolocation`
- Speed limits: [OpenStreetMap Overpass API](https://overpass-api.de) (`maxspeed` tag)
- Outside temperature: [Open-Meteo](https://open-meteo.com) (free, no API key)

Both lookups can be switched off in Settings.
