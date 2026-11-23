import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { SKIP_ERROR_TOAST } from '../../../core/http/http-context';
import type {
  Conflict,
  MoveRequest,
  TimetableEntry,
  TimetableLookups,
  TimetableVersion,
  ValidateResult,
} from './timetable.models';

/**
 * PROVISIONAL HTTP client for the proposed timetable API (docs/timetable-contract.md).
 * Replaced by the generated `TimetableService` once the backend ships it. Responses are
 * enveloped; envelopeInterceptor unwraps them, so types here are the payloads.
 */
@Injectable({ providedIn: 'root' })
export class TimetableApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/timetable`;

  lookups(): Observable<TimetableLookups> {
    return this.http.get<TimetableLookups>(`${this.base}/lookups`);
  }

  versions(): Observable<TimetableVersion[]> {
    return this.http.get<TimetableVersion[]>(`${this.base}/versions`);
  }

  entries(versionId: string): Observable<TimetableEntry[]> {
    return this.http.get<TimetableEntry[]>(`${this.base}/versions/${versionId}/entries`);
  }

  conflicts(versionId: string): Observable<Conflict[]> {
    return this.http.get<Conflict[]>(`${this.base}/versions/${versionId}/conflicts`);
  }

  /** Applies a move/swap to the draft and returns what changed plus all conflicts. */
  move(versionId: string, request: MoveRequest): Observable<ValidateResult> {
    return this.http.post<ValidateResult>(`${this.base}/versions/${versionId}/moves`, request, {
      // The editor shows conflicts inline; a toast on top would be noise.
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  setLocked(versionId: string, entryId: string, locked: boolean): Observable<TimetableEntry> {
    return this.http.patch<TimetableEntry>(
      `${this.base}/versions/${versionId}/entries/${entryId}`,
      { locked },
    );
  }
}
