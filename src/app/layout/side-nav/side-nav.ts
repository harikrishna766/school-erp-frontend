import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { NavItem, NavSection } from '../navigation/navigation.service';

/**
 * Side navigation. Full width on desktop and in the phone drawer; icon-only "rail"
 * when `collapsed` (tablet default), with tooltips carrying the labels.
 */
@Component({
  selector: 'app-side-nav',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './side-nav.html',
  styleUrl: './side-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.collapsed]': 'collapsed()' },
})
export class SideNav {
  readonly home = input.required<NavItem>();
  readonly sections = input.required<readonly NavSection[]>();
  readonly collapsed = input(false);
  readonly schoolName = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);

  /** Emitted when a destination is chosen, so the phone drawer can close. */
  readonly navigated = output();
}
