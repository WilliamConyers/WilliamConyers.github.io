/* ─────────────────────────────────────────────
   calculator/chart.js
   Owns the Chart.js instance and knows how to
   build the dataset array from projection results.

   Depends on: math.js (for fmt, CURRENT_YEAR)
   Load order: after math.js, before calculator.js
───────────────────────────────────────────── */

/* ── Chart instance ── */
const growthChart = new Chart(
  document.getElementById('growthChart').getContext('2d'),
  {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Inter', size: 12 },
            color: 'rgba(45,44,41,0.55)',
            boxWidth: 16,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          titleColor: '#2d2c29',
          bodyColor: 'rgba(45,44,41,0.65)',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont:  { family: 'Inter' },
          padding: 12,
          callbacks: {
            label: c => '  ' + c.dataset.label + ': ' + fmt(c.parsed.y),
          },
        },
      },
      scales: {
        x: {
          grid:   { color: 'rgba(0,0,0,0.04)' },
          ticks:  { font: { family: 'Inter', size: 11 }, color: 'rgba(45,44,41,0.4)', maxTicksLimit: 12 },
          border: { color: 'rgba(0,0,0,0.08)' },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { family: 'Inter', size: 11 },
            color: 'rgba(45,44,41,0.4)',
            callback: v => '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'k'),
          },
          border: { color: 'rgba(0,0,0,0.08)' },
        },
      },
    },
  }
);

/* ── Dataset builder ──
   Constructs the Chart.js datasets array from projection data.

   Params:
     displayAfterTax  — primary series reflecting the user's chosen Roth/Traditional mix
     steadyAfterTax   — steady-growth reference line (simulation mode only)
     combinedContrib  — cumulative contributions (always steady)
     chartMode        — 'steady' | 'simulate'                        */
function buildDatasets({
  displayAfterTax,
  steadyAfterTax,
  combinedContrib,
  chartMode,
}) {
  const datasets = [];

  // Primary: user's configured setup
  datasets.push({
    label: chartMode === 'simulate'
      ? 'Portfolio — simulated (after-tax)'
      : 'Portfolio — projected (after-tax)',
    data: displayAfterTax,
    borderColor: '#4A72B8',
    backgroundColor: 'rgba(74,114,184,0.08)',
    borderWidth: 2.5,
    pointRadius: 0, pointHoverRadius: 4,
    fill: true, tension: 0,
  });

  // Simulation mode: dashed steady-growth reference so you can see variance
  if (chartMode === 'simulate') {
    datasets.push({
      label: 'Steady growth (reference)',
      data: steadyAfterTax,
      borderColor: 'rgba(45,44,41,0.15)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0, pointHoverRadius: 0,
      fill: false, tension: 0.4,
    });
  }

  // Always: total contributions (dashed) so you can see growth vs principal
  datasets.push({
    label: 'Amount contributed',
    data: combinedContrib,
    borderColor: 'rgba(45,44,41,0.2)',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderDash: [5, 4],
    pointRadius: 0, pointHoverRadius: 4,
    fill: false, tension: 0.4,
  });

  return datasets;
}

/* ── Chart updater ── */
function updateChart(labels, datasets) {
  growthChart.data.labels   = labels;
  growthChart.data.datasets = datasets;
  growthChart.update();
}
