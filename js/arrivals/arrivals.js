/* ─────────────────────────────────────────────
   arrivals/arrivals.js
   Next three Muni 7 arrivals at Haight & Shrader,
   inbound and outbound.

   Uses 511 SF Bay StopMonitoring for real predicted
   arrival times. Stop codes are discovered once via
   the stops API and cached in localStorage.
───────────────────────────────────────────── */

const ARR_LAT       = 37.76990;
const ARR_LON       = -122.44680;   // Haight St & Shrader St
const ARR_REFRESH   = 30000;
const ARR_KEY       = 'sf511ApiKey';
const ARR_STOPS_KEY = 'arr7StopCodes';  // cached { ib, ob } stop codes

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
  localStorage.removeItem(ARR_STOPS_KEY);
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
    const stops = await resolveStopCodes(apiKey);

    const [ibRes, obRes] = await Promise.all([
      fetchStopMonitoring(apiKey, stops.ib),
      fetchStopMonitoring(apiKey, stops.ob),
    ]);

    const ib = parseVisits(ibRes);
    const ob = parseVisits(obRes);

    renderArrivals('arr-ib', ib.slice(0, 3));
    renderArrivals('arr-ob', ob.slice(0, 3));

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setArrStatus(`Updated ${ts} · ${ib.length} IB / ${ob.length} OB approaching`);

  } catch (err) {
    setArrStatus(
      err.message.startsWith('API key')
        ? 'Invalid API key — check your key and try again.'
        : 'Could not reach 511 API — check your connection.',
      true
    );
  }
}

/* ─────────────────────────────────────────────
   Stop code discovery
   Queries the 511 stops API for Route 7, finds
   the two nearest stops to ARR_LAT/ARR_LON, and
   identifies which is IB vs OB from the direction
   of the first StopMonitoring response.
───────────────────────────────────────────── */
async function resolveStopCodes(apiKey) {
  const cached = localStorage.getItem(ARR_STOPS_KEY);
  if (cached) {
    try {
      const p = JSON.parse(cached);
      if (p.ib && p.ob) return p;
    } catch {}
  }

  setArrStatus('Finding nearby stops…');
  const codes = await discoverStopCodes(apiKey);
  localStorage.setItem(ARR_STOPS_KEY, JSON.stringify(codes));
  return codes;
}

async function discoverStopCodes(apiKey) {
  const url = `https://api.511.org/transit/stops?api_key=${apiKey}&agency=SF&route_id=7&format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('API key invalid');
    throw new Error(`Stops API error ${res.status}`);
  }

  const data = await res.json();
  const stops = extractStopList(data);

  if (!stops.length) throw new Error('No stops returned from API');

  // Sort by distance to our target coordinates
  const sorted = stops
    .map(s => ({ ...s, dist: haversineM(ARR_LAT, ARR_LON, s.lat, s.lon) }))
    .filter(s => isFinite(s.dist))
    .sort((a, b) => a.dist - b.dist);

  // The two nearest stops are the IB and OB stops at (or near) the intersection.
  // They sit on opposite sides of Haight St, so one is slightly north and one south.
  // Eastbound (IB) stops are on the south side of the street (lower latitude).
  const pair = sorted.slice(0, 2);
  if (pair.length < 2) throw new Error('Could not find a stop pair');

  const [a, b] = pair.sort((x, y) => x.lat - y.lat); // a = more southern
  return { ib: a.id, ob: b.id };
}

function extractStopList(data) {
  // Handle the several JSON shapes the 511 API returns
  let raw = data;

  // Unwrap SIRI-style envelope if present
  if (raw?.Contents?.dataObjects?.ScheduledStopPoint) {
    raw = raw.Contents.dataObjects.ScheduledStopPoint;
  } else if (raw?.body) {
    raw = raw.body;
  }

  if (!Array.isArray(raw)) return [];

  return raw.map(s => {
    const id  = String(s.id ?? s.stop_id ?? s.Id ?? '').replace(/^[^:]+:/, '');
    const lat = parseFloat(s.lat ?? s.stop_lat ?? s.Latitude  ?? s.Location?.Latitude);
    const lon = parseFloat(s.lon ?? s.stop_lon ?? s.Longitude ?? s.Location?.Longitude);
    return { id, lat, lon };
  }).filter(s => s.id && isFinite(s.lat) && isFinite(s.lon));
}

/* ── StopMonitoring fetch ── */
async function fetchStopMonitoring(apiKey, stopCode) {
  const url = `https://api.511.org/transit/StopMonitoring?api_key=${apiKey}&agency=SF&stopCode=${stopCode}&LineRef=7&MaximumNumberOfCalls.Onwards=1&format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('API key invalid');
    throw new Error(`StopMonitoring error ${res.status}`);
  }
  return res.json();
}

/* ── Parse StopMonitoring response ── */
function parseVisits(data) {
  try {
    const delivery  = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery;
    const container = Array.isArray(delivery) ? delivery[0] : delivery;
    const visits    = container?.MonitoredStopVisit ?? [];
    const now       = Date.now();

    return visits
      .map(v => {
        const journey  = v?.MonitoredVehicleJourney;
        const call     = journey?.MonitoredCall;
        const timeStr  = call?.ExpectedArrivalTime || call?.AimedArrivalTime;
        if (!timeStr) return null;

        const arrivalMs = new Date(timeStr).getTime();
        if (isNaN(arrivalMs)) return null;

        // Next stop after ours, from OnwardCalls
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

function haversineM(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
  const dp   = (lat2 - lat1) * Math.PI / 180;
  const dl   = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dp / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function setArrStatus(msg, isError = false) {
  const el = document.getElementById('arr-status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', isError);
}
