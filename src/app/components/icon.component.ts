import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Renders a symbol from the SVG sprite in index.html (`#i-<name>`). */
@Component({
  selector: 'app-icon',
  template: `<svg class="i" [style.width.px]="size()" [style.height.px]="size()" [style.transform]="flip() ? 'scaleX(-1)' : null">
    <use [attr.href]="href()" />
  </svg>`,
  host: { style: 'display:inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly flip = input(false);
  protected readonly href = computed(() => '#i-' + this.name());
}
