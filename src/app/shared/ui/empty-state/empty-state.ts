import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Centered icon + heading + message, with an optional projected action
 * (`<button empty-state-action>`). Used for "no data", "no access" and placeholders.
 */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="icon" aria-hidden="true">
      <mat-icon>{{ icon() }}</mat-icon>
    </div>
    <h2 class="heading">{{ heading() }}</h2>
    @if (message(); as text) {
      <p class="message">{{ text }}</p>
    }
    <ng-content select="[empty-state-action]" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      text-align: center;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .icon mat-icon {
      width: 36px;
      height: 36px;
      font-size: 36px;
    }
    .heading {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    .message {
      margin: 0;
      max-width: 48ch;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
}
