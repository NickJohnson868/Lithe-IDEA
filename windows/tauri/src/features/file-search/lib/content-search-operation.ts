import {
  cancelCoreOperation,
  executeCore,
  type CoreRequest,
  type CoreResponse,
} from "@/core/lithe-core-client";

export const CONTENT_SEARCH_TIMEOUT_MS = 15_000;
const RESPONSE_GRACE_MS = 1_000;
interface SearchOperationEffects {
  execute: typeof executeCore;
  cancel: typeof cancelCoreOperation;
  schedule: (callback: () => void, delay: number) => () => void;
}
const defaultEffects: SearchOperationEffects = {
  execute: (request) => executeCore(request),
  cancel: (operationId) => cancelCoreOperation(operationId),
  schedule: (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
};

/** Owns the native deadline, cancellation and the IPC fallback timer together. */
export function executeContentSearch<T>(
  request: CoreRequest,
  signal?: AbortSignal,
  effects: SearchOperationEffects = defaultEffects,
): Promise<CoreResponse<T>> {
  const operationId = request.id;
  return new Promise((resolve, reject) => {
    let settled = false;
    let clearTimer = () => {};
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      clearTimer();
      signal?.removeEventListener("abort", abort);
      complete();
    };
    const cancel = (code: string, message: string) => {
      if (settled) return;
      finish(() => reject(Object.assign(new Error(message), { code })));
      void effects
        .cancel(operationId)
        .catch((error) => console.warn("Search cancellation failed", error));
    };
    const abort = () => cancel("cancelled", "Search cancelled");
    if (signal?.aborted) {
      finish(() => reject(Object.assign(new Error("Search cancelled"), { code: "cancelled" })));
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    clearTimer = effects.schedule(
      () => cancel("timed_out", "Search timed out. Try a more specific query or retry."),
      CONTENT_SEARCH_TIMEOUT_MS + RESPONSE_GRACE_MS,
    );
    void Promise.resolve()
      .then(() =>
        effects.execute<T>({
          ...request,
          operationId,
          timeoutMilliseconds: CONTENT_SEARCH_TIMEOUT_MS,
        }),
      )
      .then(
        (response) => finish(() => resolve(response)),
        (error) => finish(() => reject(error)),
      );
  });
}
