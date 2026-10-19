import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { DriveService } from './drive.service';
import { EnvironmentService } from './environment.service';
import { load, save } from './storage';

export type Headlights = 'off' | 'parking' | 'on' | 'auto';
export type Wipers = 'off' | 'auto' | '1' | '2' | '3' | '4';
export type Steering = 'comfort' | 'standard' | 'sport';
export type Gear = 'P' | 'R' | 'N' | 'D';

export interface ClimateState {
  on: boolean;
  auto: boolean;
  driverC: number;
  passengerC: number;
  fan: number; // 1–10
  ac: boolean;
  recirc: boolean;
  airFace: boolean;
  airFeet: boolean;
  defrostFront: boolean;
  defrostRear: boolean;
  seatDriver: number; // 0–3
  seatPassenger: number; // 0–3
  wheelHeat: boolean;
}

export interface ControlsState {
  headlights: Headlights;
  fog: boolean;
  mirrorsFolded: boolean;
  childLock: boolean;
  windowLock: boolean;
  glovebox: boolean;
  locked: boolean;
  frunk: boolean;
  trunk: boolean;
  wipers: Wipers;
  steering: Steering;
}

export interface VehicleState {
  climate: ClimateState;
  controls: ControlsState;
}

export type VehicleCommand =
  | { kind: 'climate'; key: keyof ClimateState; value: ClimateState[keyof ClimateState] }
  | { kind: 'controls'; key: keyof ControlsState; value: ControlsState[keyof ControlsState] };

/**
 * Connection to the actual car. The app ships with {@link DemoVehicleLink},
 * which only keeps state inside the app. To drive real hardware (ESP32/Arduino
 * over BLE, an OBD adapter, a manufacturer API…) provide another implementation
 * for VEHICLE_LINK in app.config.ts.
 */
export interface VehicleLink {
  readonly name: string;
  readonly connected: () => boolean;
  send(cmd: VehicleCommand): Promise<void>;
  /** Optional live data from the car; null when the link can't provide it. */
  readonly batteryPercent?: () => number | null;
  readonly gear?: () => Gear | null;
}

export class DemoVehicleLink implements VehicleLink {
  readonly name = 'Demo (not connected)';
  readonly connected = () => false;
  async send(cmd: VehicleCommand): Promise<void> {
    console.debug('[vehicle]', cmd.kind, cmd.key, '=', cmd.value);
  }
}

export const VEHICLE_LINK = new InjectionToken<VehicleLink>('VEHICLE_LINK', {
  providedIn: 'root',
  factory: () => new DemoVehicleLink(),
});

const DEFAULTS: VehicleState = {
  climate: {
    on: true,
    auto: true,
    driverC: 21.5,
    passengerC: 21.5,
    fan: 4,
    ac: true,
    recirc: false,
    airFace: true,
    airFeet: false,
    defrostFront: false,
    defrostRear: false,
    seatDriver: 0,
    seatPassenger: 0,
    wheelHeat: false,
  },
  controls: {
    headlights: 'auto',
    fog: false,
    mirrorsFolded: false,
    childLock: false,
    windowLock: false,
    glovebox: false,
    locked: true,
    frunk: false,
    trunk: false,
    wipers: 'auto',
    steering: 'standard',
  },
};

export const TEMP_MIN = 15;
export const TEMP_MAX = 28;

@Injectable({ providedIn: 'root' })
export class VehicleService {
  readonly link = inject(VEHICLE_LINK);
  private readonly drive = inject(DriveService);
  private readonly env = inject(EnvironmentService);

  readonly state = signal<VehicleState>(DEFAULTS);
  readonly climate = computed(() => this.state().climate);
  readonly controls = computed(() => this.state().controls);

  /** Gear from the car if the link knows it, otherwise inferred from motion. */
  readonly gear = computed<Gear>(() => this.link.gear?.() ?? (this.drive.moving() ? 'D' : 'P'));
  /** Car battery if available, otherwise the phone/tablet battery. */
  readonly battery = computed(() => this.link.batteryPercent?.() ?? this.env.battery());

  constructor() {
    load('vehicle', DEFAULTS).then((s) =>
      this.state.set({
        climate: { ...DEFAULTS.climate, ...s.climate },
        controls: { ...DEFAULTS.controls, ...s.controls },
      }),
    );
  }

  setClimate<K extends keyof ClimateState>(key: K, value: ClimateState[K]): void {
    this.state.update((s) => ({ ...s, climate: { ...s.climate, [key]: value } }));
    this.commit({ kind: 'climate', key, value });
  }

  setControl<K extends keyof ControlsState>(key: K, value: ControlsState[K]): void {
    this.state.update((s) => ({ ...s, controls: { ...s.controls, [key]: value } }));
    this.commit({ kind: 'controls', key, value });
  }

  toggleClimate(key: { [K in keyof ClimateState]: ClimateState[K] extends boolean ? K : never }[keyof ClimateState]): void {
    this.setClimate(key, !this.climate()[key]);
  }

  toggleControl(key: { [K in keyof ControlsState]: ControlsState[K] extends boolean ? K : never }[keyof ControlsState]): void {
    this.setControl(key, !this.controls()[key]);
  }

  stepTemp(zone: 'driverC' | 'passengerC', delta: number): void {
    const v = Math.min(TEMP_MAX, Math.max(TEMP_MIN, this.climate()[zone] + delta));
    this.setClimate(zone, v);
    if (!this.climate().on) this.setClimate('on', true);
  }

  cycleSeat(zone: 'seatDriver' | 'seatPassenger'): void {
    this.setClimate(zone, (this.climate()[zone] + 1) % 4);
  }

  private commit(cmd: VehicleCommand): void {
    save('vehicle', this.state());
    this.link.send(cmd).catch((e) => console.warn('[vehicle] send failed', e));
  }
}
