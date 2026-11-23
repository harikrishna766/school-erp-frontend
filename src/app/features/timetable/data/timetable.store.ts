import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, forkJoin } from 'rxjs';
import { isApiFailure } from '../../../core/http/api-envelope';
import {
  type GridView,
  buildCells,
  conflictsByEntry,
  entriesForView,
  indexLookups,
} from './grid-model';
import { TimetableApi } from './timetable.api';
import type {
  Conflict,
  GenerationProgress,
  MoveRequest,
  TimetableEntry,
  TimetableLookups,
  TimetableVersion,
  ViewMode,
  Weekday,
} from './timetable.models';

/** A reversible edit: replaying `backward` restores the state before `forward`. */
interface HistoryItem {
  readonly forward: MoveRequest;
  readonly backward: MoveRequest;
}

interface TimetableState {
  readonly lookups: TimetableLookups | null;
  readonly versions: readonly TimetableVersion[];
  readonly activeVersionId: string | null;
  readonly entries: readonly TimetableEntry[];
  readonly conflicts: readonly Conflict[];
  readonly view: GridView | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  /** A move/lock request is in flight. */
  readonly saving: boolean;
  /** Translation key of the last failed edit, shown by the editor. */
  readonly editErrorKey: string | null;
  readonly undoStack: readonly HistoryItem[];
  readonly redoStack: readonly HistoryItem[];
  readonly generation: GenerationProgress | null;
}

const initialState: TimetableState = {
  lookups: null,
  versions: [],
  activeVersionId: null,
  entries: [],
  conflicts: [],
  view: null,
  status: 'idle',
  saving: false,
  editErrorKey: null,
  undoStack: [],
  redoStack: [],
  generation: null,
};

/** Undo depth: plenty for an editing session, bounded for memory. */
const MAX_HISTORY = 100;

/** Applies a move (and optional swap) to a local copy, for optimistic updates. */
export function applyMoveLocally(
  entries: readonly TimetableEntry[],
  request: MoveRequest,
): TimetableEntry[] {
  const moving = entries.find((e) => e.id === request.entryId);
  const other = request.swapWithEntryId
    ? entries.find((e) => e.id === request.swapWithEntryId)
    : undefined;
  if (!moving) {
    return [...entries];
  }
  return entries.map((e) => {
    if (e.id === moving.id) {
      return { ...e, day: request.toDay, slotIndex: request.toSlotIndex };
    }
    if (other && e.id === other.id) {
      return { ...e, day: moving.day, slotIndex: moving.slotIndex };
    }
    return e;
  });
}

/** The request that undoes `request` given the entries *before* it was applied. */
export function inverseOf(
  entries: readonly TimetableEntry[],
  request: MoveRequest,
): MoveRequest | null {
  const moving = entries.find((e) => e.id === request.entryId);
  if (!moving) {
    return null;
  }
  return {
    entryId: request.entryId,
    toDay: moving.day,
    toSlotIndex: moving.slotIndex,
    ...(request.swapWithEntryId ? { swapWithEntryId: request.swapWithEntryId } : {}),
  };
}

function errorKeyOf(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'errors.network';
    }
    const code = isApiFailure(error.error) ? error.error.error.code : '';
    if (code === 'CONFLICT') {
      return 'timetable.errors.staleVersion';
    }
    if (code === 'PERMISSION_DENIED' || error.status === 403) {
      return 'errors.forbidden';
    }
  }
  return 'timetable.errors.moveFailed';
}

/**
 * State of the timetable feature: lookups, versions, the active version's entries and
 * conflicts, the current view (section / teacher / room), edit history and generation
 * progress. Provided at the timetable route, so it is lazy and scoped to the feature.
 */
export const TimetableStore = signalStore(
  withState(initialState),
  withComputed((store) => {
    const index = computed(() => {
      const lookups = store.lookups();
      return lookups ? indexLookups(lookups) : null;
    });
    const conflictMap = computed(() => conflictsByEntry(store.conflicts()));
    const activeVersion = computed(
      () => store.versions().find((v) => v.id === store.activeVersionId()) ?? null,
    );
    const viewEntries = computed(() => {
      const view = store.view();
      return view ? entriesForView(store.entries(), view) : [];
    });
    return {
      index,
      activeVersion,
      conflictMap,
      viewEntries,
      template: computed(() => store.lookups()?.template ?? null),
      cells: computed(() => {
        const view = store.view();
        const idx = index();
        return view && idx ? buildCells(viewEntries(), view.mode, idx, conflictMap()) : new Map();
      }),
      isEditable: computed(() => activeVersion()?.status === 'DRAFT'),
      /** Master view: one row per target of the current mode. */
      masterRows: computed(() => {
        const view = store.view();
        const lookups = store.lookups();
        const idx = index();
        if (!view || !lookups || !idx) {
          return [];
        }
        const targets = {
          section: lookups.sections,
          teacher: lookups.teachers,
          room: lookups.rooms,
        }[view.mode];
        const conflicts = conflictMap();
        return targets.map((t) => ({
          id: t.id,
          label: t.name,
          cells: buildCells(
            entriesForView(store.entries(), { mode: view.mode, targetId: t.id }),
            view.mode,
            idx,
            conflicts,
          ),
        }));
      }),
      canUndo: computed(() => store.undoStack().length > 0 && !store.saving()),
      canRedo: computed(() => store.redoStack().length > 0 && !store.saving()),
      hardConflicts: computed(() => store.conflicts().filter((c) => c.severity === 'HARD').length),
      softConflicts: computed(() => store.conflicts().filter((c) => c.severity === 'SOFT').length),
      /** Choices for the "show timetable of …" picker in the current mode. */
      targets: computed(() => {
        const lookups = store.lookups();
        const mode = store.view()?.mode ?? 'section';
        if (!lookups) {
          return [];
        }
        const map: Record<ViewMode, readonly { id: string; name: string }[]> = {
          section: lookups.sections,
          teacher: lookups.teachers,
          room: lookups.rooms,
        };
        return map[mode];
      }),
    };
  }),
  withMethods((store, api = inject(TimetableApi)) => {
    const loadVersion = async (versionId: string): Promise<void> => {
      const { entries, conflicts } = await firstValueFrom(
        forkJoin({ entries: api.entries(versionId), conflicts: api.conflicts(versionId) }),
      );
      patchState(store, {
        activeVersionId: versionId,
        entries,
        conflicts,
        undoStack: [],
        redoStack: [],
        editErrorKey: null,
      });
    };

    /** Sends a move; on success the server's result is authoritative. */
    const send = async (
      request: MoveRequest,
      history: 'record' | 'undo' | 'redo',
    ): Promise<boolean> => {
      const versionId = store.activeVersionId();
      if (!versionId || !store.isEditable() || store.saving()) {
        return false;
      }
      const before = store.entries();
      const moving = before.find((e) => e.id === request.entryId);
      const other = request.swapWithEntryId
        ? before.find((e) => e.id === request.swapWithEntryId)
        : undefined;
      if (!moving || (history === 'record' && (moving.locked || other?.locked))) {
        return false;
      }
      const backward = inverseOf(before, request);
      patchState(store, {
        entries: applyMoveLocally(before, request),
        saving: true,
        editErrorKey: null,
      });
      try {
        const result = await firstValueFrom(api.move(versionId, request));
        const changed = new Map(result.changed.map((e) => [e.id, e]));
        patchState(store, (state) => {
          const item = backward ? { forward: request, backward } : null;
          return {
            entries: state.entries.map((e) => changed.get(e.id) ?? e),
            conflicts: result.conflicts,
            saving: false,
            ...(item && history === 'record'
              ? { undoStack: [...state.undoStack, item].slice(-MAX_HISTORY), redoStack: [] }
              : {}),
          };
        });
        return true;
      } catch (error) {
        patchState(store, { entries: before, saving: false, editErrorKey: errorKeyOf(error) });
        return false;
      }
    };

    return {
      /** Loads lookups + versions and opens the draft (else the published) version. */
      async init(preferred?: { versionId?: string; view?: GridView }): Promise<void> {
        patchState(store, { status: 'loading' });
        try {
          const { lookups, versions } = await firstValueFrom(
            forkJoin({ lookups: api.lookups(), versions: api.versions() }),
          );
          const version =
            versions.find((v) => v.id === preferred?.versionId) ??
            versions.find((v) => v.status === 'DRAFT') ??
            versions.find((v) => v.status === 'PUBLISHED') ??
            versions[0];
          patchState(store, {
            lookups,
            versions,
            view:
              preferred?.view ??
              (lookups.sections[0] ? { mode: 'section', targetId: lookups.sections[0].id } : null),
          });
          if (version) {
            await loadVersion(version.id);
          }
          patchState(store, { status: 'ready' });
        } catch {
          patchState(store, { status: 'error' });
        }
      },

      async selectVersion(versionId: string): Promise<void> {
        patchState(store, { status: 'loading' });
        try {
          await loadVersion(versionId);
          patchState(store, { status: 'ready' });
        } catch {
          patchState(store, { status: 'error' });
        }
      },

      setView(view: GridView): void {
        patchState(store, { view });
      },

      /** Switches mode and picks the first target of that mode. */
      setMode(mode: ViewMode): void {
        const lookups = store.lookups();
        if (!lookups) {
          return;
        }
        const first = { section: lookups.sections, teacher: lookups.teachers, room: lookups.rooms }[
          mode
        ][0];
        patchState(store, { view: first ? { mode, targetId: first.id } : null });
      },

      /** Move an entry (swapping with the occupant, if any) and validate server-side. */
      move(
        entryId: string,
        toDay: Weekday,
        toSlotIndex: number,
        swapWithEntryId?: string,
      ): Promise<boolean> {
        return send(
          { entryId, toDay, toSlotIndex, ...(swapWithEntryId ? { swapWithEntryId } : {}) },
          'record',
        );
      },

      async undo(): Promise<void> {
        const item = store.undoStack().at(-1);
        if (!item || !store.canUndo()) {
          return;
        }
        if (await send(item.backward, 'undo')) {
          patchState(store, (s) => ({
            undoStack: s.undoStack.slice(0, -1),
            redoStack: [...s.redoStack, item],
          }));
        }
      },

      async redo(): Promise<void> {
        const item = store.redoStack().at(-1);
        if (!item || !store.canRedo()) {
          return;
        }
        if (await send(item.forward, 'redo')) {
          patchState(store, (s) => ({
            redoStack: s.redoStack.slice(0, -1),
            undoStack: [...s.undoStack, item],
          }));
        }
      },

      async toggleLock(entryId: string): Promise<void> {
        const versionId = store.activeVersionId();
        const entry = store.entries().find((e) => e.id === entryId);
        if (!versionId || !entry || !store.isEditable()) {
          return;
        }
        patchState(store, { saving: true });
        try {
          const updated = await firstValueFrom(api.setLocked(versionId, entryId, !entry.locked));
          patchState(store, (s) => ({
            entries: s.entries.map((e) => (e.id === entryId ? updated : e)),
            saving: false,
          }));
        } catch (error) {
          patchState(store, { saving: false, editErrorKey: errorKeyOf(error) });
        }
      },

      clearEditError(): void {
        patchState(store, { editErrorKey: null });
      },

      /** Realtime generation updates (generation screen, step 3). */
      applyGenerationProgress(progress: GenerationProgress | null): void {
        patchState(store, { generation: progress });
      },
    };
  }),
);

export type TimetableStore = InstanceType<typeof TimetableStore>;
