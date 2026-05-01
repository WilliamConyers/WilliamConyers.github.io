/* ─────────────────────────────────────────────
   tabs.js
   Section navigation and calculator tile collapse.

   Navigation: any element with [data-section] switches
   to #panel-<id> and marks the matching .nav-link active.
───────────────────────────────────────────── */

function showPanel(id) {
  // Stop live-refresh tools when navigating away from them
  if (typeof stopArrTimer === 'function') stopArrTimer();
  if (typeof stopRefresh  === 'function') stopRefresh();

  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  // Exact match first; if on a sub-page, activate the parent section's nav link
  // by reading the back button's target (e.g. fantasy-post-1 → fantasy).
  let activeLink = document.querySelector('.nav-link[data-section="' + id + '"]');
  if (!activeLink) {
    const backBtn = panel?.querySelector('.back-btn[data-section]');
    if (backBtn) activeLink = document.querySelector('.nav-link[data-section="' + backBtn.dataset.section + '"]');
  }
  if (activeLink) activeLink.classList.add('active');

  location.hash = id;
  window.scrollTo(0, 0);

  // Chart.js initializes while the panel is hidden (0-width canvas).
  // Resize and re-render on first reveal so the chart fills the container.
  if (id === 'calculator') {
    setTimeout(() => {
      if (typeof growthChart !== 'undefined') growthChart.resize();
      if (typeof calculate === 'function') calculate();
    }, 0);
  }

  // Start live tools when navigating to their panel
  if (id === 'arrivals' && typeof startArrBoard === 'function') startArrBoard();
  if (id === 'buses' && localStorage.getItem('sf511ApiKey') && typeof showTracker === 'function') showTracker();
}

document.querySelectorAll('[data-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    showPanel(el.dataset.section);
  });
});

// Restore panel from URL hash on load/refresh
const initialHash = location.hash.replace('#', '');
if (initialHash && document.getElementById('panel-' + initialHash)) {
  showPanel(initialHash);
}

/* Calculator input tile collapse (syncs both account tiles) */
document.querySelectorAll('.tile-header').forEach(header => {
  header.addEventListener('click', () => {
    const tile = header.closest('.input-tile');
    const group = tile.closest('.account-row');
    if (group) {
      const collapsed = !tile.classList.contains('collapsed');
      group.querySelectorAll('.input-tile').forEach(t => t.classList.toggle('collapsed', collapsed));
    } else {
      tile.classList.toggle('collapsed');
    }
  });
});
