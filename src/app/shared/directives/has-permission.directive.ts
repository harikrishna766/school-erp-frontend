import {
  Directive,
  type EmbeddedViewRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { AccessStore } from '../../core/access/access.store';
import type { PermissionMode } from '../../core/access/permission';

/**
 * Renders its template only if the user holds the permission(s). Re-evaluates when access
 * changes (login, role change), creating/destroying the view only when the outcome flips.
 *
 * ```html
 * <button *hasPermission="'fees:invoice:create'">New invoice</button>
 * <section *hasPermission="['exam:marks:enter', 'exam:marks:approve']; mode: 'all'; else readOnly">
 * ```
 *
 * UI hiding is convenience, not security: the backend enforces every permission.
 */
@Directive({
  // The brief specifies `*hasPermission`; the app- prefix rule is waived for this API.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[hasPermission]',
})
export class HasPermission {
  private readonly access = inject(AccessStore);
  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly hasPermission = input.required<string | readonly string[]>();
  readonly hasPermissionMode = input<PermissionMode>('any');
  readonly hasPermissionElse = input<TemplateRef<unknown> | null>(null);

  private shown: 'main' | 'else' | 'none' | null = null;
  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const allowed = this.access.can(this.hasPermission(), this.hasPermissionMode());
      const elseTemplate = this.hasPermissionElse();
      const next = allowed ? 'main' : elseTemplate ? 'else' : 'none';
      if (next === this.shown) {
        return;
      }
      this.container.clear();
      this.view = null;
      if (next === 'main') {
        this.view = this.container.createEmbeddedView(this.template);
      } else if (next === 'else' && elseTemplate) {
        this.view = this.container.createEmbeddedView(elseTemplate);
      }
      this.view?.markForCheck();
      this.shown = next;
    });
  }
}
