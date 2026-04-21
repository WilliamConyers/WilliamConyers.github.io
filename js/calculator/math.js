/* ─────────────────────────────────────────────
   calculator/math.js
   Pure projection math — no DOM access.

   All functions are stateless and testable in
   isolation. Import order: load before chart.js
   and calculator.js.
───────────────────────────────────────────── */

const CURRENT_YEAR = new Date().getFullYear();
const IRS_401K_CAP    = 23500;  // 2026 employee elective deferral limit
const IRS_415_CAP     = 70000;  // 2026 total additions limit (employee + employer)
const IRS_IRA_CAP     = 7000;   // 2026 IRA contribution limit
const IRS_CAP_INFLATION = 0.025; // assumed annual cap growth rate (IRS adjusts in $500 steps with CPI)

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

/* ── Steady compound growth ──
   annualContribFn(yearIndex) → contribution amount for that year.
   monthly=false → one data point per year (index 0 = today, length = years+1)
   monthly=true  → one data point per month (length = years*12+1)
   Returns: { bals, contribs } */
function projectSteady(startBal, annualContribFn, annualRate, years, monthly = false) {
  const mRate = annualRate / 12;
  let bal = startBal, contrib = startBal;
  const bals    = [Math.round(bal)];
  const contribs = [Math.round(contrib)];

  for (let y = 0; y < years; y++) {
    const c = annualContribFn(y);
    const monthlyAmt = c / 12;
    for (let m = 0; m < 12; m++) {
      bal = bal * (1 + mRate) + monthlyAmt;
      contrib += monthlyAmt;
      if (monthly) {
        bals.push(Math.round(bal));
        contribs.push(Math.round(contrib));
      }
    }
    if (!monthly) {
      bals.push(Math.round(bal));
      contribs.push(Math.round(contrib));
    }
  }
  return { bals, contribs };
}

/* ── Generate shared monthly market returns ──
   Call once per simulation run; pass the result to every projectGBM call
   so all accounts experience identical market conditions each month. */
function generateMonthlyReturns(annualRate, years) {
  const SIGMA = 0.16;
  const dt    = 1 / 12;
  const drift = (annualRate - 0.5 * SIGMA * SIGMA) * dt;
  const vol   = SIGMA * Math.sqrt(dt);
  return Array.from({ length: years * 12 }, () => Math.exp(drift + vol * randn()));
}

/* ── Apply pre-generated returns to one account ──
   All accounts sharing the same returns array move with the same market. */
function projectGBM(startBal, annualContribFn, returns) {
  const years = returns.length / 12;
  let bal = startBal;
  const bals = [Math.round(bal)];

  for (let y = 0; y < years; y++) {
    const monthlyContrib = annualContribFn(y) / 12;
    for (let m = 0; m < 12; m++) {
      bal *= returns[y * 12 + m];
      bal += monthlyContrib;
      bals.push(Math.round(bal));
    }
  }
  return { bals };
}

/* ── After-tax value ──
   Roth accounts are tax-free at withdrawal; Traditional accounts
   are taxed at the retirement bracket. */
function afterTax(balance, accountType, taxRetirement) {
  return accountType === 'roth' ? balance : balance * (1 - taxRetirement);
}
