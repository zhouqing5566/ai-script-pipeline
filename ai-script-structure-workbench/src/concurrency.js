export function clampConcurrency(value, maxConcurrency = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 3;
  return Math.max(1, Math.min(Math.floor(numeric), maxConcurrency));
}

export function createChunkQueueState(items = [], options = {}) {
  const concurrency = clampConcurrency(options.concurrency ?? 3, options.maxConcurrency ?? 6);
  return {
    concurrency,
    runningChunks: [],
    queuedChunks: items.map((item) => item.chunkKey || item.id || item.episodeNo || item.title || "chunk"),
    completedChunks: 0,
    averageChunkLatencyMs: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    rateLimitDowngraded: false,
    stopped: false,
    stopReason: ""
  };
}

export async function runWithConcurrency(items = [], worker, options = {}) {
  const results = new Array(items.length);
  const state = createChunkQueueState(items, options);
  const maxConcurrency = Number(options.maxConcurrency) || 6;
  let nextIndex = 0;
  let active = 0;
  let completed = 0;
  let stopped = false;
  let stopReason = "";
  let currentConcurrency = state.concurrency;
  let settled = false;

  const updateProgress = (event, extra = {}) => {
    options.onProgress?.({
      ...state,
      ...extra,
      event,
      concurrency: currentConcurrency,
      queuedChunks: items.slice(nextIndex).map((item) => item.chunkKey || item.id || item.episodeNo || item.title || "chunk"),
      completedChunks: completed,
      stopped,
      stopReason
    });
  };

  const setConcurrency = (value, reason = "") => {
    const next = clampConcurrency(value, maxConcurrency);
    if (next < currentConcurrency && reason) state.rateLimitDowngraded = true;
    currentConcurrency = next;
    state.concurrency = next;
    updateProgress("concurrency", { reason });
  };

  const stop = (reason = "stopped") => {
    stopped = true;
    state.stopped = true;
    stopReason ||= reason;
    state.stopReason = stopReason;
  };

  return await new Promise((resolve) => {
    const maybeFinish = () => {
      if (settled) return;
      if ((stopped || nextIndex >= items.length) && active === 0) {
        for (let index = 0; index < items.length; index += 1) {
          if (!results[index]) {
            results[index] = {
              item: items[index],
              index,
              status: "skipped",
              skipped: true,
              stopReason: stopReason || "stopped"
            };
          }
        }
        state.completedAt = new Date().toISOString();
        settled = true;
        updateProgress("complete");
        resolve({
          results,
          stopped,
          stopReason,
          rateLimitDowngraded: state.rateLimitDowngraded,
          state
        });
      }
    };

    const launch = () => {
      while (!stopped && active < currentConcurrency && nextIndex < items.length) {
        const index = nextIndex;
        const item = items[index];
        nextIndex += 1;
        active += 1;
        const started = performance.now();
        const chunkKey = item.chunkKey || item.id || item.episodeNo || item.title || `chunk-${index}`;
        state.runningChunks = [...state.runningChunks, chunkKey];
        updateProgress("start", { item, index });

        Promise.resolve()
          .then(() =>
            worker(item, {
              index,
              state,
              setConcurrency,
              stop
            })
          )
          .then((result) => {
            const latencyMs = Math.round(performance.now() - started);
            results[index] = {
              item,
              index,
              status: result?.ok === false ? "failed" : "fulfilled",
              latencyMs,
              ...result
            };
            if (result?.rateLimitDowngraded) setConcurrency(1, "rate_limit");
            if (result?.stopScheduling) stop(result.stopReason || result.errorType || "worker_stop");
            if (options.shouldStopOnFailure?.(results[index], state)) {
              stop(results[index].stopReason || results[index].errorType || "failure_stop");
            }
          })
          .catch((error) => {
            const latencyMs = Math.round(performance.now() - started);
            results[index] = {
              item,
              index,
              ok: false,
              status: "failed",
              latencyMs,
              error
            };
            if (options.shouldStopOnFailure?.(results[index], state)) {
              stop(results[index].stopReason || "failure_stop");
            }
          })
          .finally(() => {
            active -= 1;
            completed += 1;
            state.runningChunks = state.runningChunks.filter((key) => key !== chunkKey);
            const done = results.filter(Boolean).filter((itemResult) => !itemResult.skipped);
            const latencies = done.map((itemResult) => itemResult.latencyMs).filter((itemLatency) => Number.isFinite(itemLatency));
            state.averageChunkLatencyMs = latencies.length
              ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
              : 0;
            updateProgress("finish", { item, index, result: results[index] });
            launch();
            maybeFinish();
          });
      }
      maybeFinish();
    };

    updateProgress("init");
    launch();
  });
}

export const runChunkPool = runWithConcurrency;
