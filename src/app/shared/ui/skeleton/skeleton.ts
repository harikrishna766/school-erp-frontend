import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shimmering placeholder block. Size it with CSS/Tailwind on the host element. */
@Component({
  selector: 'app-skeleton',
  template: '',
  styles: `
    :host {
      display: block;
      min-height: 1em;
      border-radius: var(--skeleton-radius, 8px);
      background: linear-gradient(
        90deg,
        var(--mat-sys-surface-container-high) 25%,
        var(--mat-sys-surface-container-highest) 50%,
        var(--mat-sys-surface-container-high) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    :host(.circle) {
      border-radius: 50%;
    }
    @keyframes shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[class.circle]': "shape() === 'circle'",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly shape = input<'rect' | 'circle'>('rect');
}
