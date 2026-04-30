/* ─────────────────────────────────────────────
   arrivals/arrivals.js
   Next three Muni 7 arrivals at Haight & Shrader,
   inbound (toward downtown) and outbound (toward
   Ocean Beach). ETAs are estimated from each bus's
   live GPS position and typical Haight St pace.

   API: 511 SF Bay VehicleMonitoring (same key as
   the bus tracker — shared via localStorage).
───────────────────────────────────────────── */

const ARR_STOP_LAT  = 37.76990;
const ARR_STOP_LON  = -122.44680;   // Haight St & Shrader St
const ARR_SPEED_MPS = 3.8;          // ~8.5 mph — typical Haight St pace with stops
const ARR_REFRESH   = 30000;        // 30 s
const ARR_KEY       = 'sf511ApiKey';

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

/* ── Fetch + render ── */
async function fetchArrivals() {
  const apiKey = localStorage.getItem(ARR_KEY);
  if (!apiKey) return;
  setArrStatus('Updating…');

  try {
    const url = `https://api.511.org/transit/VehicleMonitoring?api_key=${apiKey}&agency=SF&format=json`;
    const res = await fetch(url);

    if (!res.ok) {
      setArrStatus(
        res.status === 401 || res.status === 403
          ? 'Invalid API key — check your key and try again.'
          : `API error (${res.status}) — will retry.`,
        true
      );
      return;
    }

    const data     = await res.json();
    const vehicles = parseVehicles(data).filter(v => isRoute7(v.lineRef));
    const ib       = approaching(vehicles, true);
    const ob       = approaching(vehicles, false);

    renderArrivals('arr-ib', ib.slice(0, 3));
    renderArrivals('arr-ob', ob.slice(0, 3));

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setArrStatus(`Updated ${ts} · ${vehicles.length} buses tracked · ${ib.length} IB / ${ob.length} OB approaching`);

  } catch {
    setArrStatus('Could not reach 511 API — check your connection.', true);
  }
}

/* ─────────────────────────────────────────────
   approaching(vehicles, inbound)
   Filters to buses upstream of the stop and sorts
   by distance. IB buses travel east (longitude
   increases / less negative); to be approaching
   they must still be west of the stop (more
   negative lon). OB buses travel west; they must
   be east of the stop.
───────────────────────────────────────────── */
function approaching(vehicles, inbound) {
  const buffer = 0.0006; // ~53 m grace past the stop before we drop a bus

  return vehicles
    .filter(v => {
      const d = (v.direction || '').toLowerCase();
      return inbound ? d.startsWith('i') : d.startsWith('o');
    })
    .filter(v => {
      // Longitude gate only — route 7 crosses multiple streets at different
      // latitudes (Noriega, Lincoln, Haight) so a lat filter misses most buses.
      return inbound
        ? v.lon < ARR_STOP_LON + buffer   // west of stop → IB approaching
        : v.lon > ARR_STOP_LON - buffer;  // east of stop → OB approaching
    })
    .map(v => ({
      ...v,
      distM: haversineM(ARR_STOP_LAT, ARR_STOP_LON, v.lat, v.lon),
    }))
    .map(v => ({
      ...v,
      mins: Math.max(0, Math.round(v.distM / ARR_SPEED_MPS / 60)),
    }))
    .sort((a, b) => a.distM - b.distM);
}

function renderArrivals(elId, buses) {
  const el = document.getElementById(elId);
  if (!buses.length) {
    el.innerHTML = '<p class="arr-empty">No buses approaching</p>';
    return;
  }
  el.innerHTML = buses.map(v => {
    const isNow   = v.mins <= 1;
    const unit    = isNow ? '' : '<span class="arr-unit">min</span>';
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

function haversineM(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
  const dp   = (lat2 - lat1) * Math.PI / 180;
  const dl   = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dp / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isRoute7(lineRef) {
  return String(lineRef ?? '').replace(/^[^:]+:/, '') === '7';
}

function parseVehicles(data) {
  try {
    const delivery   = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery;
    const container  = Array.isArray(delivery) ? delivery[0] : delivery;
    const activities = container?.VehicleActivity ?? [];
    return activities.map(a => {
      const j   = a.MonitoredVehicleJourney;
      const loc = j?.VehicleLocation;
      return {
        ref:       j?.VehicleRef                          ?? '—',
        lineRef:   j?.LineRef?.value ?? j?.LineRef        ?? '',
        lat:       parseFloat(loc?.Latitude),
        lon:       parseFloat(loc?.Longitude),
        direction: j?.DirectionRef                        ?? '',
        nextStop:  extractName(j?.MonitoredCall?.StopPointName)
                || extractName(j?.DestinationName)
                || '',
      };
    }).filter(v => isFinite(v.lat) && isFinite(v.lon));
  } catch {
    return [];
  }
}

function setArrStatus(msg, isError = false) {
  const el = document.getElementById('arr-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', isError);
}
