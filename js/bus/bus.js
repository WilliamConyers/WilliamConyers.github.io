/* ─────────────────────────────────────────────
   bus/bus.js
   Live vehicle tracker for SF Muni Route 7.

   Data source: 511 SF Bay VehicleMonitoring + patterns API
   Map:         Leaflet + CartoDB Voyager tiles
   Refresh:     every 15 seconds while tab is active
───────────────────────────────────────────── */

const BUS_API_KEY_STORAGE = 'sf511ApiKey';
const REFRESH_MS = 15000;
const SF_CENTER  = [37.7650, -122.4530];  // mid Route 7 corridor

let busMap         = null;
let busMarkers     = {};       // vehicleRef → L.marker
let routeLine      = null;     // L.polyline for the route shape
let refreshTimer   = null;
let mapInitialized = false;

/* ─────────────────────────────────────────────
   Button wiring
───────────────────────────────────────────── */
document.getElementById('bus-api-key-save').addEventListener('click', () => {
  const key = document.getElementById('bus-api-key-input').value.trim();
  if (!key) return;
  localStorage.setItem(BUS_API_KEY_STORAGE, key);
  showTracker();
});

document.getElementById('bus-api-key-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('bus-api-key-save').click();
});

document.getElementById('bus-refresh').addEventListener('click', fetchAndRender);

document.getElementById('bus-clear-key').addEventListener('click', () => {
  localStorage.removeItem(BUS_API_KEY_STORAGE);
  stopRefresh();
  document.getElementById('bus-tracker').style.display = 'none';
  document.getElementById('bus-setup').style.display   = '';
  document.getElementById('bus-api-key-input').value   = '';
});

/* Pause/resume refresh on tab switch */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'buses') {
      if (localStorage.getItem(BUS_API_KEY_STORAGE)) showTracker();
    } else {
      stopRefresh();
    }
  });
});

/* ─────────────────────────────────────────────
   Show tracker panel
───────────────────────────────────────────── */
function showTracker() {
  document.getElementById('bus-setup').style.display   = 'none';
  document.getElementById('bus-tracker').style.display = '';
  // Defer so the browser reflows the container before Leaflet measures its size
  setTimeout(() => {
    initMap();
    busMap.invalidateSize();
    fetchRouteShape();
    fetchAndRender();
    startRefresh();
  }, 50);
}

/* ─────────────────────────────────────────────
   Map init
───────────────────────────────────────────── */
function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  busMap = L.map('bus-map', { zoomControl: true }).setView(SF_CENTER, 14);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© <a href="https://www.esri.com">Esri</a>',
    maxZoom: 16,
  }).addTo(busMap);
}

/* ─────────────────────────────────────────────
   Route shape — fetch from OpenStreetMap via
   the Overpass API (free, no key required).
   Queries the SF Muni Route 7 relation and
   draws each way segment as a polyline.
───────────────────────────────────────────── */
async function fetchRouteShape() {
  if (!busMap) return;

  try {
    const query = '[out:json][timeout:30];' +
      'relation["network"="Muni"]["ref"="7"]["route"="bus"];' +
      'out geom;';
    const res = await fetch(
      'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query)
    );
    if (!res.ok) return;

    const data   = await res.json();
    const coords = extractOSMCoords(data);
    if (coords.length < 2) return;

    if (routeLine) routeLine.remove();
    routeLine = L.polyline(coords, {
      color:   '#4A72B8',
      weight:  3,
      opacity: 0.45,
    }).addTo(busMap);

    busMap.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
  } catch {
    // Route line is decorative — fail silently
  }
}

function extractOSMCoords(data) {
  // Return one array of coords per way segment so Leaflet draws each
  // independently — passing an array of arrays to L.polyline prevents
  // it from drawing spurious connecting lines between unrelated segments.
  for (const el of data.elements ?? []) {
    if (el.type !== 'relation') continue;
    const segments = [];
    for (const member of el.members ?? []) {
      if (member.type === 'way' && member.geometry?.length) {
        segments.push(member.geometry.map(pt => [pt.lat, pt.lon]));
      }
    }
    if (segments.length > 0) return segments;
  }
  return [];
}

/* ─────────────────────────────────────────────
   Fetch vehicles + render
───────────────────────────────────────────── */
async function fetchAndRender() {
  const apiKey = localStorage.getItem(BUS_API_KEY_STORAGE);
  if (!apiKey) return;

  setStatus('Updating…');

  try {
    // Omit route param so the API returns all SF vehicles;
    // we filter client-side to ensure only route 7/7R buses show.
    const url = `https://api.511.org/transit/VehicleMonitoring?api_key=${apiKey}&agency=SF&format=json`;
    const res  = await fetch(url);

    if (!res.ok) {
      setStatus(res.status === 401 || res.status === 403
        ? 'Invalid API key — check your key and try again.'
        : `API error (${res.status}) — will retry.`, true);
      return;
    }

    const data     = await res.json();
    const vehicles = extractVehicles(data).filter(v => isRoute7(v.lineRef));
    updateMarkers(vehicles);

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStatus(vehicles.length === 0
      ? `No route 7 buses active right now · ${ts}`
      : `${vehicles.length} bus${vehicles.length !== 1 ? 'es' : ''} on route · updated ${ts}`);

  } catch {
    setStatus('Could not reach 511 API — check your connection.', true);
  }
}

/* ─────────────────────────────────────────────
   Route filter — accept "7" and "7R" only
───────────────────────────────────────────── */
function isRoute7(lineRef) {
  const id = String(lineRef ?? '').replace(/^[^:]+:/, ''); // strip "SF:" prefix
  return id === '7';
}

/* ─────────────────────────────────────────────
   Parse 511 SIRI VehicleMonitoring response
───────────────────────────────────────────── */
function extractVehicles(data) {
  try {
    const delivery   = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery;
    const container  = Array.isArray(delivery) ? delivery[0] : delivery;
    const activities = container?.VehicleActivity ?? [];

    return activities.map(a => {
      const j   = a.MonitoredVehicleJourney;
      const loc = j?.VehicleLocation;
      return {
        ref:       j?.VehicleRef                         ?? '—',
        lineRef:   j?.LineRef?.value ?? j?.LineRef       ?? '',
        lat:       parseFloat(loc?.Latitude),
        lng:       parseFloat(loc?.Longitude),
        direction: j?.DirectionRef                       ?? '',
        dest:      j?.DestinationName                    ?? '',
      };
    }).filter(v => isFinite(v.lat) && isFinite(v.lng));
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────────
   Markers
───────────────────────────────────────────── */
function updateMarkers(vehicles) {
  const seen = new Set();

  vehicles.forEach(v => {
    seen.add(v.ref);
    if (busMarkers[v.ref]) {
      busMarkers[v.ref].setLatLng([v.lat, v.lng]);
      busMarkers[v.ref].setPopupContent(popupHtml(v));
    } else {
      const marker = L.marker([v.lat, v.lng], { icon: busIcon(v) })
        .bindPopup(popupHtml(v), { className: 'bus-popup-wrap' });
      marker.addTo(busMap);
      busMarkers[v.ref] = marker;
    }
  });

  Object.keys(busMarkers).forEach(ref => {
    if (!seen.has(ref)) {
      busMarkers[ref].remove();
      delete busMarkers[ref];
    }
  });
}

function busIcon(v) {
  const colorClass = (v.direction || '').toLowerCase().startsWith('i')
    ? 'bus-dot-inbound' : 'bus-dot-outbound';
  return L.divIcon({
    className: '',
    html: `<div class="bus-marker-wrap"><div class="bus-dot ${colorClass}"></div></div>`,
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  });
}

function popupHtml(v) {
  const dir = v.direction
    ? (v.direction.toLowerCase().startsWith('i') ? 'Inbound' : 'Outbound')
    : '—';
  return `<div class="bus-popup">
    <strong>Bus ${v.ref}</strong>
    ${v.dest ? `<span>To: ${v.dest}</span>` : ''}
    <span>Direction: ${dir}</span>
  </div>`;
}

/* ─────────────────────────────────────────────
   Status + refresh helpers
───────────────────────────────────────────── */
function setStatus(msg, isError = false) {
  const el = document.getElementById('bus-status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(fetchAndRender, REFRESH_MS);
}

function stopRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

/* ─────────────────────────────────────────────
   Pre-fill saved key on page load
───────────────────────────────────────────── */
(function () {
  const saved = localStorage.getItem(BUS_API_KEY_STORAGE);
  if (saved) document.getElementById('bus-api-key-input').value = saved;
})();
