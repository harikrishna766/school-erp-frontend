import { Injectable, signal } from '@angular/core';
import { prefs } from '../storage/local-storage';

const KEY = 'erp.branch';

/**
 * The branch the user is working in, sent as `x-branch-id` (the backend checks it
 * against the user's branch access). Kept separate from AccessStore so the HTTP layer
 * can read it without depending on a store that itself makes HTTP calls.
 */
@Injectable({ providedIn: 'root' })
export class BranchContext {
  private readonly _id = signal<string | null>(prefs.get(KEY));
  readonly id = this._id.asReadonly();

  set(id: string | null): void {
    this._id.set(id);
    if (id) {
      prefs.set(KEY, id);
    } else {
      prefs.remove(KEY);
    }
  }
}
