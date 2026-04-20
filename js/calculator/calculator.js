/* ─────────────────────────────────────────────
   calculator/calculator.js
   Orchestrator for the Net Worth Calculator tab.

   Responsibilities:
     - Owns UI state (acctTypes, chartMode)
     - Reads all input values from the DOM
     - Calls math.js for projections
     - Calls chart.js to render the chart
     - Writes result values back to the DOM

   Depends on: math.js, chart.js
   Load order: last, after both dependencies
───────────────────────────────────────────── */

/* ── UI state ── */
const acctTypes = { k401: 'roth', ira: 'roth' };   // tracks Roth/Traditional toggle per account
let chartMode = 'steady';                            // 'steady' | 'simulate'

/* ─────────────────────────────────────────────
   calculate()
   Central function — called on every input change.
   Reads DOM → runs projections → updates chart + result cards.
───────────────────────────────────────────── */
function calculate() {

  /* ── Read shared profile inputs ── */
  const salary0       = parseFloat(document.getElementById('salary').value)          || 0;
  const years         = parseInt(document.getElementById('years').value)              || 35;
  const annualRate    = parseFloat(document.getElementById('growth-rate').value)      / 100 || 0;
  const salaryGrowth  = parseFloat(document.getElementById('salary-growth').value)   / 100 || 0;
  const taxNow        = parseFloat(document.getElementById('tax-now').value)          / 100 || 0;
  const taxRetirement = parseFloat(document.getElementById('tax-retirement').value)  / 100 || 0;

  /* ── Read 401k inputs ── */
  const k401SelfPct  = parseFloat(document.getElementById('self-pct').value)         / 100 || 0;
  const k401EmpPct   = parseFloat(document.getElementById('employer-pct').value)     / 100 || 0;
  const k401StartBal = parseFloat(document.getElementById('k401-balance').value)     || 0;

  /* ── Read IRA inputs ── */
  const iraContribRaw = parseFloat(document.getElementById('ira-contrib').value)     || 0;
  const iraStartBal   = parseFloat(document.getElementById('ira-balance').value)     || 0;

  /* ── Update live dollar-equivalent labels on 401k inputs ── */
  document.getElementById('self-dollar').textContent     = fmtYr(salary0 * k401SelfPct);
  document.getElementById('employer-dollar').textContent = fmtYr(salary0 * k401EmpPct);

  /* ── IRS cap warnings ── */
  const k401OverCap = (salary0 * k401SelfPct) > IRS_401K_CAP;
  document.getElementById('self-pct').classList.toggle('over-cap', k401OverCap);
  document.getElementById('k401-cap-warning').classList.toggle('visible', k401OverCap);

  const iraOverCap = iraContribRaw > IRS_IRA_CAP;
  document.getElementById('ira-contrib').classList.toggle('over-cap', iraOverCap);
  document.getElementById('ira-cap-warning').classList.toggle('visible', iraOverCap);

  const iraContrib = Math.min(iraContribRaw, IRS_IRA_CAP);

  /* ── Contribution functions (year-indexed so salary can grow) ── */
  const k401ContribFn = y => {
    const sal = salary0 * Math.pow(1 + salaryGrowth, y);
    return Math.min(sal * k401SelfPct, IRS_401K_CAP) + sal * k401EmpPct;
  };
  const iraContribFn = () => iraContrib;

  /* ── Steady projections (always computed — used for contrib line + reference) ── */
  const k401Steady = projectSteady(k401StartBal, k401ContribFn, annualRate, years);
  const iraSteady  = projectSteady(iraStartBal,  iraContribFn,  annualRate, years);

  const combinedSteadyBals   = k401Steady.bals.map((v, i) => v + iraSteady.bals[i]);
  const combinedSteadyContrib = k401Steady.contribs.map((v, i) => v + iraSteady.contribs[i]);

  /* ── GBM simulation (only in simulate mode) ── */
  let k401Sim = null, iraSim = null, combinedSimBals = null;
  if (chartMode === 'simulate') {
    k401Sim = projectGBM(k401StartBal, k401ContribFn, annualRate, years);
    iraSim  = projectGBM(iraStartBal,  iraContribFn,  annualRate, years);
    combinedSimBals = k401Sim.bals.map((v, i) => v + iraSim.bals[i]);
  }

  /* ── After-tax series using user's current type selection ── */
  const displayAfterTax = (combinedSimBals || combinedSteadyBals).map((_, i) => {
    const k401bal = combinedSimBals ? k401Sim.bals[i] : k401Steady.bals[i];
    const iraBal  = combinedSimBals ? iraSim.bals[i]  : iraSteady.bals[i];
    return afterTax(k401bal, acctTypes.k401, taxRetirement)
         + afterTax(iraBal,  acctTypes.ira,  taxRetirement);
  });

  /* ── Alternate strategy (flipped Roth/Traditional) for comparison line ── */
  const altK401 = acctTypes.k401 === 'roth' ? 'traditional' : 'roth';
  const altIra  = acctTypes.ira  === 'roth' ? 'traditional' : 'roth';

  const altAfterTax = (combinedSimBals || combinedSteadyBals).map((_, i) => {
    const k401bal = combinedSimBals ? k401Sim.bals[i] : k401Steady.bals[i];
    const iraBal  = combinedSimBals ? iraSim.bals[i]  : iraSteady.bals[i];
    return afterTax(k401bal, altK401, taxRetirement)
         + afterTax(iraBal,  altIra,  taxRetirement);
  });

  // Only show comparison line when setup is uniformly one type (mixed is self-explanatory)
  const allRoth = acctTypes.k401 === 'roth' && acctTypes.ira === 'roth';
  const allTrad = acctTypes.k401 === 'traditional' && acctTypes.ira === 'traditional';
  const showAltSeries = allRoth || allTrad;
  const altLabel = allRoth
    ? 'All Traditional (after-tax, for comparison)'
    : 'All Roth (tax-free, for comparison)';

  /* ── Steady reference for simulation mode ── */
  const steadyAfterTax = combinedSteadyBals.map((_, i) =>
    afterTax(k401Steady.bals[i], acctTypes.k401, taxRetirement) +
    afterTax(iraSteady.bals[i],  acctTypes.ira,  taxRetirement)
  );

  /* ── Update chart ── */
  const labels = Array.from({ length: years + 1 }, (_, i) => String(CURRENT_YEAR + i));

  updateChart(labels, buildDatasets({
    displayAfterTax,
    altAfterTax,
    showAltSeries,
    altLabel,
    steadyAfterTax,
    combinedContrib: combinedSteadyContrib,
    chartMode,
  }));

  /* ── Update result cards ── */
  const lastIdx      = years;
  const k401FinalBal = combinedSimBals ? k401Sim.bals[lastIdx] : k401Steady.bals[lastIdx];
  const iraFinalBal  = combinedSimBals ? iraSim.bals[lastIdx]  : iraSteady.bals[lastIdx];

  const k401RothVal = k401FinalBal;
  const iraRothVal  = iraFinalBal;
  const k401TradVal = Math.round(k401FinalBal * (1 - taxRetirement));
  const iraTradVal  = Math.round(iraFinalBal  * (1 - taxRetirement));

  const totalRoth    = k401RothVal + iraRothVal;
  const totalTrad    = k401TradVal + iraTradVal;
  const totalContrib = combinedSteadyContrib[lastIdx];
  const k401Contrib  = k401Steady.contribs[lastIdx];
  const iraContribFinal = iraSteady.contribs[lastIdx];

  document.getElementById('res-roth').textContent     = fmt(totalRoth);
  document.getElementById('res-roth-sub').textContent = 'Tax-free at withdrawal';
  document.getElementById('res-roth-breakdown').textContent =
    `401k: ${fmt(k401RothVal)}  ·  IRA: ${fmt(iraRothVal)}`;

  document.getElementById('res-trad').textContent     = fmt(totalTrad);
  document.getElementById('res-trad-sub').textContent = `Taxed at ${Math.round(taxRetirement * 100)}% at withdrawal`;
  document.getElementById('res-trad-breakdown').textContent =
    `401k: ${fmt(k401TradVal)}  ·  IRA: ${fmt(iraTradVal)}`;

  document.getElementById('res-contributed').textContent = fmt(totalContrib);
  document.getElementById('res-contrib-breakdown').textContent =
    `401k: ${fmt(k401Contrib)}  ·  IRA: ${fmt(iraContribFinal)}`;
}

/* ─────────────────────────────────────────────
   Event listeners
───────────────────────────────────────────── */

/* Roth / Traditional pills */
document.querySelectorAll('.type-pill').forEach(pill => {
  pill.querySelectorAll('.type-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      pill.querySelectorAll('.type-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      acctTypes[pill.dataset.account] = opt.dataset.type;
      calculate();
    });
  });
});

/* Steady / Simulate toggle */
document.querySelectorAll('.pill-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.pill-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    chartMode = opt.dataset.mode;
    document.getElementById('rerun-btn').classList.toggle('visible', chartMode === 'simulate');
    calculate();
  });
});

/* Re-run button (simulation mode) */
document.getElementById('rerun-btn').addEventListener('click', calculate);

/* Any number input change */
document.querySelectorAll('#tab-calculator input').forEach(el => {
  el.addEventListener('input', calculate);
});

/* ── Initial render ── */
calculate();
