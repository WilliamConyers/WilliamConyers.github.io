/* ─────────────────────────────────────────────
   calculator/math.js
   Pure projection math — no DOM access.

   All functions are stateless and testable in
   isolation. Import order: load before chart.js
   and calculator.js.
───────────────────────────────────────────── */

const CURRENT_YEAR = new Date().getFullYear();
const IRS_401K_CAP = 23500;   // 2026 employee contribution limit
const IRS_IRA_CAP  = 7000;    // 2026 IRA contribution limit

/* ── Formatting helpers ── */
function fmt(n)   { return '$' + Math.round(n).toLocaleString(); }
function fmtYr(n) { return '$' + Math.round(n).toLocaleString() + '/yr'; }

/* ── Box-Muller: standard normal random draw ── */
function randn() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ── Steady compound growth (annual data points) ──
   annualContribFn(yearIndex) → contribution amount for that year,
   allowing salary-linked contributions that grow over time.
   Returns:
     bals    — balance at the start of each year (index 0 = today)
     contribs — cumulative amount contributed at each year */
function projectSteady(startBal, annualContribFn, annualRate, years) {
  const mRate = annualRate / 12;
  let bal = startBal, contrib = startBal;
  const bals    = [Math.round(bal)];
  const contribs = [Math.round(contrib)];

  for (let y = 0; y < years; y++) {
    const c = annualContribFn(y);
    const monthly = c / 12;
    for (let m = 0; m < 12; m++) bal = bal * (1 + mRate) + monthly;
    contrib += c;
    bals.push(Math.round(bal));
    contribs.push(Math.round(contrib));
  }
  return { bals, contribs };
}

/* ── Geometric Brownian Motion simulation (annual data points) ──
   Uses 252 daily steps per year (trading days) to simulate
   realistic market volatility (σ = 16%, historical S&P 500).
   Expected long-run value matches projectSteady; individual
   paths will differ. Returns only bals (no contrib tracking
   needed — use the steady contribs for the contributed line). */
function projectGBM(startBal, annualContribFn, annualRate, years) {
  const SIGMA = 0.16;          // annualised volatility
  const STEPS = 252;           // trading days per year
  const dt    = 1 / STEPS;
  const drift = (annualRate - 0.5 * SIGMA * SIGMA) * dt;
  const vol   = SIGMA * Math.sqrt(dt);

  let bal = startBal;
  const bals = [Math.round(bal)];

  for (let y = 0; y < years; y++) {
    const daily = annualContribFn(y) / STEPS;
    for (let d = 0; d < STEPS; d++) {
      bal *= Math.exp(drift + vol * randn());
      bal += daily;
    }
    bals.push(Math.round(bal));
  }
  return { bals };
}

/* ── After-tax value ──
   Roth accounts are tax-free at withdrawal; Traditional accounts
   are taxed at the retirement bracket. */
function afterTax(balance, accountType, taxRetirement) {
  return accountType === 'roth' ? balance : balance * (1 - taxRetirement);
}
