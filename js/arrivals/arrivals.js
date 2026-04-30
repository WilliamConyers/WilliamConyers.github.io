/* ─────────────────────────────────────────────
   arrivals/arrivals.js
   Next three Muni 7 arrivals at Haight & Stanyan
   (the Stanyan/Shrader stop), inbound and outbound.

   Uses 511 SF Bay StopMonitoring for real predicted
   arrival times (ExpectedArrivalTime).

   Stop codes confirmed from sfmta.com:
     14963 — Haight & Stanyan, inbound (toward downtown)
     14962 — Haight & Stanyan, outbound (toward Ocean Beach)
───────────────────────────────────────────── */

const ARR_STOP_IB = '14963';
const ARR_STOP_OB = '14962';
const ARR_REFRESH = 30000;
const ARR_KEY     = 'sf511ApiKey';

let arrTimer = null;

/* ── Pre-fill key on page load ── */
(function () {
  const saved = localStorage.getItem(ARR_KEY);
  if (saved) document.getElementById('arr-key-input').value = saved;
})();

/* ── Button wiring ── */
document.getElementById('arr-key-save').addEventListener('click', () => {
  const key = document.getElementById('arr-key-input').value.trim();
  if (!key) return;
  localStorage.setItem(ARR_KEY, key);
  showBoard();
});

document.getElementById('arr-key-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('arr-key-save').click();
});

document.getElementById('arr-refresh').addEventListener('click', fetchArrivals);

document.getElementById('arr-clear-key').addEventListener('click', () => {
  localStorage.removeItem(ARR_KEY);
  stopArrTimer();
  document.getElementById('arr-board').style.display = 'none';
  document.getElementById('arr-setup').style.display = '';
  document.getElementById('arr-key-input').value     = '';
});

/* ── Called by tabs.js on panel activation ── */
function startArrBoard() {
  if (!localStorage.getItem(ARR_KEY)) return;
  showBoard();
}

function showBoard() {
  document.getElementById('arr-setup').style.display = 'none';
  document.getElementById('arr-board').style.display = '';
  fetchArrivals();
  startArrTimer();
}

function startArrTimer() {
  stopArrTimer();
  arrTimer = setInterval(fetchArrivals, ARR_REFRESH);
}

function stopArrTimer() {
  if (arrTimer) { clearInterval(arrTimer); arrTimer = null; }
}

/* ── Main fetch ── */
async function fetchArrivals() {
  const apiKey = localStorage.getItem(ARR_KEY);
  if (!apiKey) return;
  setArrStatus('Updating…');

  try {
    const [ibData, obData] = await Promise.all([
      fetchStop(apiKey, ARR_STOP_IB),
      fetchStop(apiKey, ARR_STOP_OB),
    ]);

    const ib = parseVisits(ibData);
    const ob = parseVisits(obData);

    renderArrivals('arr-ib', ib.slice(0, 3));
    renderArrivals('arr-ob', ob.slice(0, 3));

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setArrStatus(`Updated ${ts} · ${ib.length} IB / ${ob.length} OB approaching`);

  } catch (err) {
    setArrStatus(
      (err.message || '').includes('key')
        ? 'Invalid API key — check your key and try again.'
        : 'Could not reach 511 API — check your connection.',
      true
    );
  }
}

/* ── StopMonitoring fetch ── */
async function fetchStop(apiKey, stopCode) {
  const url = `https://api.511.org/transit/StopMonitoring?api_key=${apiKey}&agency=SF&stopCode=${stopCode}&format=json`;
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('key invalid');
    throw new Error(`API error ${res.status}`);
  }

  // 511 API sometimes prepends a UTF-8 BOM — strip it before parsing
  const text = await res.text();
  return JSON.parse(text.replace(/^﻿/, ''));
}

/* ── Parse StopMonitoring visits ── */
function parseVisits(data) {
  try {
    // 511 wraps in Siri on some endpoints, not others
    const svc       = data?.Siri?.ServiceDelivery ?? data?.ServiceDelivery ?? data;
    const delivery  = svc?.StopMonitoringDelivery;
    const container = Array.isArray(delivery) ? delivery[0] : delivery;
    const visits    = container?.MonitoredStopVisit ?? [];
    const now       = Date.now();

    return visits
      .map(v => {
        const journey = v?.MonitoredVehicleJourney;
        // Filter to Route 7 only (stop may serve other routes)
        if (!isRoute7(journey?.LineRef)) return null;

        const call    = journey?.MonitoredCall;
        const timeStr = call?.ExpectedArrivalTime || call?.AimedArrivalTime;
        if (!timeStr) return null;

        const arrivalMs = new Date(timeStr).getTime();
        if (isNaN(arrivalMs)) return null;

        // Next stop after ours, from OnwardCalls (if returned by API)
        const onward   = journey?.OnwardCalls?.OnwardCall;
        const nextRaw  = Array.isArray(onward) ? onward[0]?.StopPointName : onward?.StopPointName;
        const nextStop = extractName(nextRaw);

        const mins = Math.max(0, Math.round((arrivalMs - now) / 60000));
        return { mins, arrivalMs, nextStop };
      })
      .filter(v => v !== null && v.arrivalMs >= now - 60000)
      .sort((a, b) => a.arrivalMs - b.arrivalMs);
  } catch {
    return [];
  }
}

/* ── Render ── */
function renderArrivals(elId, buses) {
  const el = document.getElementById(elId);
  if (!buses.length) {
    el.innerHTML = '<p class="arr-empty">No buses approaching</p>';
    return;
  }
  el.innerHTML = buses.map(v => {
    const isNow    = v.mins <= 1;
    const unit     = isNow ? '' : '<span class="arr-unit">min</span>';
    const nextStop = v.nextStop
      ? `<span class="arr-dest"><span class="arr-dest-label">next stop</span>${v.nextStop}</span>`
      : '';
    return `<div class="arr-row">
      <span class="arr-mins">${isNow ? 'Now' : v.mins}${unit}</span>
      ${nextStop}
    </div>`;
  }).join('');
}

/* ── Helpers ── */
function extractName(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) return extractName(field[0]);
  return field.value ?? field._ ?? '';
}

function isRoute7(lineRef) {
  // LineRef can be "7", "SF:7", "7-Haight/Noriega", {value:"SF:7"}, etc.
  const s = String(lineRef?.value ?? lineRef ?? '').replace(/^[^:]+:/, '');
  return s === '7' || s.startsWith('7-') || s.startsWith('7 ');
}

function setArrStatus(msg, isError = false) {
  const el = document.getElementById('arr-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', isError);
}
