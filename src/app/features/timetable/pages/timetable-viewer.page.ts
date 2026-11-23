import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { interval, map, startWith } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { BreakpointService } from '../../../core/layout/breakpoint.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { TimetableStore } from '../data/timetable.store';
import type { ViewMode, Weekday } from '../data/timetable.models';
import { minutesOf } from '../ui/time-format';
import { TimetableGrid } from '../ui/timetable-grid/timetable-grid';

/**
 * Read-only timetable browser (step 1): any version, by section, teacher or room, as a
 * week grid or (tablet/desktop) the virtualized master view of every target.
 * Editing arrives with the editor (step 4).
 */
@Component({
  selector: 'app-timetable-viewer-page',
  imports: [
    MatButtonToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    TranslatePipe,
    TimetableGrid,
    EmptyState,
    Skeleton,
  ],
  templateUrl: './timetable-viewer.page.html',
  styleUrl: './timetable-viewer.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimetableViewerPage {
  protected readonly store = inject(TimetableStore);
  protected readonly language = inject(LanguageService);
  protected readonly breakpoints = inject(BreakpointService);

  protected readonly layout = signal<'week' | 'master'>('week');
  protected readonly effectiveLayout = computed(() =>
    this.breakpoints.isPhone() ? 'week' : this.layout(),
  );
  protected readonly modes: readonly ViewMode[] = ['section', 'teacher', 'room'];

  private readonly now = toSignal(
    interval(60_000).pipe(
      startWith(0),
      map(() => new Date()),
    ),
    { initialValue: new Date() },
  );

  /** The period happening right now, if today is a school day. */
  protected readonly currentPeriod = computed(() => {
    const template = this.store.template();
    const now = this.now();
    const day = (((now.getDay() + 6) % 7) + 1) as Weekday;
    if (!template?.days.includes(day)) {
      return null;
    }
    const minutes = now.getHours() * 60 + now.getMinutes();
    const slot = template.slots.find(
      (s) => minutesOf(s.start) <= minutes && minutes < minutesOf(s.end),
    );
    return slot ? { day, slotIndex: slot.index } : null;
  });

  constructor() {
    void this.store.init();
  }

  protected setMode(mode: ViewMode): void {
    this.store.setMode(mode);
  }

  protected setTarget(targetId: string): void {
    const mode = this.store.view()?.mode ?? 'section';
    this.store.setView({ mode, targetId });
  }
}
