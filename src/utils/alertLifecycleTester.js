import { submitDraftAlert, subscribeToApprovedAlerts } from '../lib/spatialQueries';

const TEST_ALERT_POLYGON = [
  [78.01, 30.28],
  [78.08, 30.28],
  [78.08, 30.34],
  [78.01, 30.34],
  [78.01, 30.28],
];

function watchForCitizenReceipt(alertId, timeoutMs) {
  let resolveReady;
  let rejectReady;
  let resolveReceipt;
  let rejectReceipt;
  let timeoutId;
  let subscription;
  let settled = false;

  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const receipt = new Promise((resolve, reject) => {
    resolveReceipt = resolve;
    rejectReceipt = reject;
  });

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    subscription?.unsubscribe();
  };

  subscription = subscribeToApprovedAlerts((row) => {
    if (!settled && row?.id === alertId && row?.status === 'APPROVED') {
      settled = true;
      cleanup();
      resolveReceipt({ alertId, receivedAt: new Date().toISOString(), alert: row });
    }
  }, (status) => {
    if (status === 'SUBSCRIBED') {
      resolveReady();
      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = new Error(`Citizen receipt was not observed within ${timeoutMs} ms.`);
        rejectReady(error);
        rejectReceipt(error);
      }, timeoutMs);
    } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && !settled) {
      settled = true;
      cleanup();
      const error = new Error(`Citizen realtime subscription ended with status ${status}.`);
      rejectReady(error);
      rejectReceipt(error);
    }
  });

  return { ready, receipt, cancel: cleanup };
}

export async function createLifecycleTestDraft(overrides = {}) {
  const result = await submitDraftAlert({
    identifier: `IN-IMD-EXERCISE-${crypto.randomUUID()}`,
    event_type: 'TEST_EXERCISE',
    urgency: 'Future',
    severity: 'Moderate',
    certainty: 'Possible',
    headline_en: 'TEST EXERCISE: CAP alert lifecycle validation',
    description_en: 'Exercise-only alert. Do not take protective action.',
    location: 'Dehradun lifecycle test area',
    affected_zone: { type: 'Polygon', coordinates: [TEST_ALERT_POLYGON] },
    ...overrides,
  });
  if (result.error) throw result.error;
  if (!result.data?.id || result.data.status !== 'DRAFT') {
    throw new Error('Supabase did not return the inserted DRAFT test alert.');
  }
  return result.data;
}

export async function simulateAlertLifecycle({ onDraftCreated, alert = {}, timeoutMs = 900 } = {}) {
  if (typeof onDraftCreated !== 'function') {
    throw new Error('Provide onDraftCreated so an authenticated officer can review and approve the test alert.');
  }
  const boundedTimeout = Math.min(Math.max(Number(timeoutMs) || 900, 1), 950);
  const draft = await createLifecycleTestDraft(alert);
  const watcher = watchForCitizenReceipt(draft.id, boundedTimeout);
  try {
    await watcher.ready;
    await onDraftCreated(draft);
    const citizenReceipt = await watcher.receipt;
    return { draft, citizenReceipt, latencyTargetMs: boundedTimeout };
  } catch (error) {
    watcher.cancel();
    throw error;
  }
}