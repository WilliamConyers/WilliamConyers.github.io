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
  const k401SelfPct      = parseFloat(document.getElementById('self-pct').value)          / 100 || 0;
  const k401EmpPct       = parseFloat(document.getElementById('employer-pct').value)      / 100 || 0;
  const k401RothStartBal = parseFloat(document.getElementById('k401-roth-balance').value) || 0;
  const k401TradStartBal = parseFloat(document.getElementById('k401-trad-balance').value) || 0;

  /* ── Read IRA inputs ── */
  const iraContribRaw   = parseFloat(document.getElementById('ira-contrib').value)        || 0;
  const iraRothStartBal = parseFloat(document.getElementById('ira-roth-balance').value)   || 0;
  const iraTradStartBal = parseFloat(document.getElementById('ira-trad-balance').value)   || 0;

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

  /* ── Contribution functions (year-indexed so salary and caps grow) ── */
  const k401ContribFn = y => {
    const sal          = salary0 * Math.pow(1 + salaryGrowth, y);
    const inflator     = Math.pow(1 + IRS_CAP_INFLATION, y);
    const employeeCap  = Math.round(IRS_401K_CAP * inflator / 500) * 500;
    const totalCap     = Math.round(IRS_415_CAP   * inflator / 500) * 500;
    const employee     = Math.min(sal * k401SelfPct, employeeCap);
    const employer     = Math.max(0, Math.min(sal * k401EmpPct, totalCap - employee));
    return employee + employer;
  };
  const iraContribFn = y => {
    const cap = Math.round(IRS_IRA_CAP * Math.pow(1 + IRS_CAP_INFLATION, y) / 500) * 500;
    return Math.min(iraContribRaw, cap);
  };
  const zeroFn = () => 0;

  /* ── Steady projections — each sub-account projected independently.
     New contributions go to the selected type; the other type just compounds.
     In simulate mode use monthly resolution so the reference/contrib lines
     match the GBM line's data point count. ── */
  const useMonthly = chartMode === 'simulate';
  const k401RothSteady = projectSteady(k401RothStartBal, acctTypes.k401 === 'roth'        ? k401ContribFn : zeroFn, annualRate, years, useMonthly);
  const k401TradSteady = projectSteady(k401TradStartBal, acctTypes.k401 === 'traditional' ? k401ContribFn : zeroFn, annualRate, years, useMonthly);
  const iraRothSteady  = projectSteady(iraRothStartBal,  acctTypes.ira  === 'roth'        ? iraContribFn  : zeroFn, annualRate, years, useMonthly);
  const iraTradSteady  = projectSteady(iraTradStartBal,  acctTypes.ira  === 'traditional' ? iraContribFn  : zeroFn, annualRate, years, useMonthly);

  const combinedSteadyContrib = k401RothSteady.contribs.map((v, i) =>
    v + k401TradSteady.contribs[i] + iraRothSteady.contribs[i] + iraTradSteady.contribs[i]
  );

  /* ── GBM simulation (only in simulate mode) ──
     One shared returns array so all accounts ride the same market each month. */
  let k401RothSim = null, k401TradSim = null, iraRothSim = null, iraTradSim = null;
  if (chartMode === 'simulate') {
    const monthlyReturns = generateMonthlyReturns(annualRate, years);
    k401RothSim = projectGBM(k401RothStartBal, acctTypes.k401 === 'roth'        ? k401ContribFn : zeroFn, monthlyReturns);
    k401TradSim = projectGBM(k401TradStartBal, acctTypes.k401 === 'traditional' ? k401ContribFn : zeroFn, monthlyReturns);
    iraRothSim  = projectGBM(iraRothStartBal,  acctTypes.ira  === 'roth'        ? iraContribFn  : zeroFn, monthlyReturns);
    iraTradSim  = projectGBM(iraTradStartBal,  acctTypes.ira  === 'traditional' ? iraContribFn  : zeroFn, monthlyReturns);
  }

  /* ── After-tax series — all four sub-accounts combined ── */
  const numPoints = useMonthly ? years * 12 + 1 : years + 1;

  const displayAfterTax = Array.from({ length: numPoints }, (_, i) => {
    const k401Roth = k401RothSim ? k401RothSim.bals[i] : k401RothSteady.bals[i];
    const k401Trad = k401TradSim ? k401TradSim.bals[i] : k401TradSteady.bals[i];
    const iraRoth  = iraRothSim  ? iraRothSim.bals[i]  : iraRothSteady.bals[i];
    const iraTrad  = iraTradSim  ? iraTradSim.bals[i]  : iraTradSteady.bals[i];
    return afterTax(k401Roth, 'roth', taxRetirement) + afterTax(k401Trad, 'traditional', taxRetirement)
         + afterTax(iraRoth,  'roth', taxRetirement) + afterTax(iraTrad,  'traditional', taxRetirement);
  });

  /* ── Steady reference for simulation mode ── */
  const steadyAfterTax = Array.from({ length: numPoints }, (_, i) =>
    afterTax(k401RothSteady.bals[i], 'roth', taxRetirement) +
    afterTax(k401TradSteady.bals[i], 'traditional', taxRetirement) +
    afterTax(iraRothSteady.bals[i],  'roth', taxRetirement) +
    afterTax(iraTradSteady.bals[i],  'traditional', taxRetirement)
  );

  /* ── Update chart ── */
  const labels = useMonthly
    ? Array.from({ length: years * 12 + 1 }, (_, i) => i % 12 === 0 ? String(CURRENT_YEAR + i / 12) : '')
    : Array.from({ length: years + 1 },      (_, i) => String(CURRENT_YEAR + i));

  updateChart(labels, buildDatasets({
    displayAfterTax,
    steadyAfterTax,
    combinedContrib: combinedSteadyContrib,
    chartMode,
  }));

  /* ── Update result cards ── */
  const k401RothFinal = (k401RothSim ? k401RothSim.bals : k401RothSteady.bals).at(-1);
  const k401TradFinal = (k401TradSim ? k401TradSim.bals : k401TradSteady.bals).at(-1);
  const iraRothFinal  = (iraRothSim  ? iraRothSim.bals  : iraRothSteady.bals).at(-1);
  const iraTradFinal  = (iraTradSim  ? iraTradSim.bals  : iraTradSteady.bals).at(-1);

  const k401Val = Math.round(
    afterTax(k401RothFinal, 'roth', taxRetirement) + afterTax(k401TradFinal, 'traditional', taxRetirement)
  );
  const iraVal = Math.round(
    afterTax(iraRothFinal, 'roth', taxRetirement) + afterTax(iraTradFinal, 'traditional', taxRetirement)
  );

  const totalContrib    = combinedSteadyContrib.at(-1);
  const k401Contrib     = k401RothSteady.contribs.at(-1) + k401TradSteady.contribs.at(-1);
  const iraContribFinal = iraRothSteady.contribs.at(-1)  + iraTradSteady.contribs.at(-1);

  document.getElementById('res-portfolio').textContent          = fmt(k401Val + iraVal);
  document.getElementById('res-portfolio-breakdown').textContent = `401k: ${fmt(k401Val)}  ·  IRA: ${fmt(iraVal)}`;

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
document.querySelectorAll('#tab-calculator input[type=number]').forEach(el => {
  el.addEventListener('input', calculate);
});

/* ── Initial render ── */
calculate();
