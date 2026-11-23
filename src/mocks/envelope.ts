import { HttpResponse } from 'msw';
import type { ApiFailure, ApiSuccess, PageMeta } from '../app/core/http/api-envelope';

/** Any envelope the backend can return; handler resolvers are typed with this. */
export type EnvelopeResponse = HttpResponse<ApiSuccess<unknown> | ApiFailure>;

/** Builds responses in the exact envelope the NestJS backend emits. */
export function ok<T>(
  data: T,
  options: { meta?: PageMeta; status?: number } = {},
): EnvelopeResponse {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    meta: options.meta,
    requestId: crypto.randomUUID(),
  };
  return HttpResponse.json<ApiSuccess<unknown> | ApiFailure>(body, {
    status: options.status ?? 200,
  });
}

export function fail(
  status: number,
  code: string,
  message: string,
  path: string,
): EnvelopeResponse {
  const body: ApiFailure = {
    success: false,
    error: { code, message },
    requestId: crypto.randomUUID(),
    path,
    timestamp: new Date().toISOString(),
  };
  return HttpResponse.json<ApiSuccess<unknown> | ApiFailure>(body, { status });
}
