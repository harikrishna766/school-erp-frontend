import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { NavItem } from '../navigation/navigation.service';

/** Phone-only bottom navigation bar: top destinations plus a "More" drawer trigger. */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatRippleModule, TranslatePipe],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  readonly items = input.required<readonly NavItem[]>();
  readonly moreExpanded = input(false);
  readonly more = output();
}
