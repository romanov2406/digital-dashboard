import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Renders a symbol from the SVG sprite in index.html (`#i-<name>`). */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  host: { style: 'display:inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly flip = input(false);
  protected readonly href = computed(() => '#i-' + this.name());
}
