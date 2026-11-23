import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

/**
 * Material 3 window size classes: compact < 600, medium 600–1239, expanded ≥ 1240.
 * Keep in sync with the `--bp-*` comments in styles.scss and the Tailwind `md`/`xl` usage.
 */
export const DEVICE_QUERIES = {
  phone: '(max-width: 599.98px)',
  tablet: '(min-width: 600px) and (max-width: 1239.98px)',
  desktop: '(min-width: 1240px)',
} as const satisfies Record<DeviceClass, string>;

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly observer = inject(BreakpointObserver);

  private readonly queries = [DEVICE_QUERIES.phone, DEVICE_QUERIES.tablet];

  private readonly matches = toSignal(
    this.observer.observe(this.queries).pipe(map((state) => state.breakpoints)),
    {
      initialValue: Object.fromEntries(this.queries.map((q) => [q, this.observer.isMatched(q)])),
    },
  );

  readonly device = computed<DeviceClass>(() => {
    const m = this.matches();
    if (m[DEVICE_QUERIES.phone]) {
      return 'phone';
    }
    return m[DEVICE_QUERIES.tablet] ? 'tablet' : 'desktop';
  });

  readonly isPhone = computed(() => this.device() === 'phone');
  readonly isTablet = computed(() => this.device() === 'tablet');
  readonly isDesktop = computed(() => this.device() === 'desktop');
}
