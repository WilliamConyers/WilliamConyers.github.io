/* ─────────────────────────────────────────────
   arrivals/arrivals.js
   Next three Muni 7 arrivals at Haight & Stanyan
   (the Stanyan/Shrader stop), inbound and outbound.

   StopMonitoring gives accurate predicted arrival times.
   VehicleMonitoring gives each bus's current next stop.
   The two are joined by VehicleRef.

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
    const [ibData, obData, vmData] = await Promise.all([
      fetchJSON(`https://api.511.org/transit/StopMonitoring?api_key=${apiKey}&agency=SF&stopCode=${ARR_STOP_IB}&format=json`),
      fetchJSON(`https://api.511.org/transit/StopMonitoring?api_key=${apiKey}&agency=SF&stopCode=${ARR_STOP_OB}&format=json`),
      fetchJSON(`https://api.511.org/transit/VehicleMonitoring?api_key=${apiKey}&agency=SF&format=json`),
    ]);

    // Build VehicleRef → current next stop name from live GPS data
    const nextStopMap = buildNextStopMap(vmData);

    const ib = parseVisits(ibData, nextStopMap);
    const ob = parseVisits(obData, nextStopMap);

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

/* ── Fetch helper (strips UTF-8 BOM that 511 sometimes prepends) ── */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('key invalid');
    throw new Error(`API error ${res.status}`);
  }
  const text = await res.text();
  return JSON.parse(text.replace(/^﻿/, ''));
}

/* ── Build VehicleRef → next stop name from VehicleMonitoring ── */
function buildNextStopMap(data) {
  const map = {};
  try {
    const delivery   = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery;
    const container  = Array.isArray(delivery) ? delivery[0] : delivery;
    const activities = container?.VehicleActivity ?? [];
    for (const a of activities) {
      const j   = a?.MonitoredVehicleJourney;
      const ref = j?.VehicleRef;
      const name = extractName(j?.MonitoredCall?.StopPointName);
      if (ref && name) map[ref] = name;
    }
  } catch {}
  return map;
}

/* ── Parse StopMonitoring visits ── */
function parseVisits(data, nextStopMap) {
  try {
    const svc       = data?.Siri?.ServiceDelivery ?? data?.ServiceDelivery ?? data;
    const delivery  = svc?.StopMonitoringDelivery;
    const container = Array.isArray(delivery) ? delivery[0] : delivery;
    const visits    = container?.MonitoredStopVisit ?? [];
    const now       = Date.now();

    return visits
      .map(v => {
        const journey = v?.MonitoredVehicleJourney;
        if (!isRoute7(journey?.LineRef)) return null;

        const call    = journey?.MonitoredCall;
        const timeStr = call?.ExpectedArrivalTime || call?.AimedArrivalTime;
        if (!timeStr) return null;

        const arrivalMs = new Date(timeStr).getTime();
        if (isNaN(arrivalMs)) return null;

        const vehicleRef = journey?.VehicleRef;
        const nextStop   = nextStopMap[vehicleRef] ?? '';

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
  const s = String(lineRef?.value ?? lineRef ?? '').replace(/^[^:]+:/, '');
  return s === '7' || s.startsWith('7-') || s.startsWith('7 ');
}

function setArrStatus(msg, isError = false) {
  const el = document.getElementById('arr-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', isError);
}
