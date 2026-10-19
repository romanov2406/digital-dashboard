import { Injectable, signal } from '@angular/core';

export type Section = 'controls' | 'lights' | 'locks' | 'climate' | 'seats' | 'trip' | 'parking' | 'display' | 'settings';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly section = signal<Section>('controls');
  readonly climateOpen = signal(false);

  open(section: Section): void {
    this.section.set(section);
    this.climateOpen.set(false);
  }

  toggleClimate(): void {
    this.climateOpen.update((v) => !v);
  }
}
