/* ─────────────────────────────────────────────
   tabs.js
   Section navigation and calculator tile collapse.

   Navigation: any element with [data-section] switches
   to #panel-<id> and marks the matching .nav-link active.
───────────────────────────────────────────── */

function showPanel(id) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector('.nav-link[data-section="' + id + '"]');
  if (activeLink) activeLink.classList.add('active');

  window.scrollTo(0, 0);

  // Chart.js initializes while the panel is hidden (0-width canvas).
  // Resize and re-render on first reveal so the chart fills the container.
  if (id === 'calculator') {
    setTimeout(() => {
      if (typeof growthChart !== 'undefined') growthChart.resize();
      if (typeof calculate === 'function') calculate();
    }, 0);
  }
}

document.querySelectorAll('[data-section]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    showPanel(el.dataset.section);
  });
});

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
