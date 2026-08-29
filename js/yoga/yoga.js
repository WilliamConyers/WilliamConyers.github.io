/* ─────────────────────────────────────────────
   yoga/yoga.js
   Free Yoga Near the Haight — curated class finder.

   All entries are recurring weekly classes at known
   low-cost or free venues near Haight-Ashbury, SF.
   Schedules change seasonally — verify before going.

   To add or edit a class, update YOGA_CLASSES below.
───────────────────────────────────────────── */

const YOGA_LAST_UPDATED = 'June 2026';

/* dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
   cost:      'free' | 'donation' | 'low'                       */
const YOGA_CLASSES = [
  {
    id: 'panhandle-sun',
    venue: 'Panhandle Park',
    address: 'Fell St & Baker St',
    neighborhood: 'Haight-Ashbury',
    classType: 'Outdoor Flow',
    cost: 'free',
    costLabel: 'Free',
    dayOfWeek: 0,
    time: '08:30',
    duration: 60,
    url: 'https://sfrecpark.org/programs-and-events/',
    notes: 'Community class — weather permitting'
  },
  {
    id: 'buena-vista-sun',
    venue: 'Buena Vista Park',
    address: 'Buena Vista Ave E & Central',
    neighborhood: 'Haight-Ashbury',
    classType: 'Outdoor Flow',
    cost: 'free',
    costLabel: 'Free',
    dayOfWeek: 0,
    time: '09:30',
    duration: 60,
    url: 'https://sfrecpark.org/programs-and-events/',
    notes: 'SF Rec & Parks program — weather permitting'
  },
  {
    id: 'yoga-flow-sun',
    venue: 'Yoga Flow SF',
    address: '302 Cole St',
    neighborhood: 'Cole Valley',
    classType: 'Vinyasa',
    cost: 'donation',
    costLabel: 'Donation',
    dayOfWeek: 0,
    time: '10:00',
    duration: 75,
    url: 'https://yogaflowsf.com',
    notes: 'Community class — RSVP recommended'
  },
  {
    id: 'ymca-mon',
    venue: 'YMCA of San Francisco',
    address: '220 Golden Gate Ave',
    neighborhood: 'Civic Center',
    classType: 'Mixed Levels',
    cost: 'low',
    costLabel: '$5–15',
    dayOfWeek: 1,
    time: '07:00',
    duration: 60,
    url: 'https://ymcasf.org/programs/yoga/',
    notes: 'Drop-in with day pass — multiple weekly classes available'
  },
  {
    id: 'sfpl-tue',
    venue: 'SF Public Library',
    address: '100 Larkin St',
    neighborhood: 'Civic Center',
    classType: 'Gentle Yoga',
    cost: 'free',
    costLabel: 'Free',
    dayOfWeek: 2,
    time: '11:00',
    duration: 45,
    url: 'https://sfpl.org/events',
    notes: 'Varies by branch — check SFPL events calendar'
  },
  {
    id: 'golden-gate-wed',
    venue: 'Golden Gate Park',
    address: 'Near Kezar Pavilion',
    neighborhood: 'Golden Gate Park',
    classType: 'Outdoor Flow',
    cost: 'free',
    costLabel: 'Free',
    dayOfWeek: 3,
    time: '08:00',
    duration: 60,
    url: 'https://sfrecpark.org/programs-and-events/',
    notes: 'SF Rec & Parks summer series — weather permitting'
  },
  {
    id: 'yoga-flow-wed',
    venue: 'Yoga Flow SF',
    address: '302 Cole St',
    neighborhood: 'Cole Valley',
    classType: 'Vinyasa',
    cost: 'donation',
    costLabel: 'Donation',
    dayOfWeek: 3,
    time: '19:00',
    duration: 60,
    url: 'https://yogaflowsf.com',
    notes: 'Evening community class'
  },
  {
    id: 'deyoung-fri',
    venue: 'de Young Museum',
    address: '50 Hagiwara Tea Garden Dr',
    neighborhood: 'Golden Gate Park',
    classType: 'Hatha',
    cost: 'free',
    costLabel: 'Free',
    dayOfWeek: 5,
    time: '18:00',
    duration: 60,
    url: 'https://deyoung.famsf.org/programs',
    notes: 'Seasonal series — verify current dates on museum site'
  },
  {
    id: 'panhandle-sat',
    venue: 'Panhandle Park',
    address: 'Fell St & Baker St',
    neighborhood: 'Haight-Ashbury',
    classType: 'Outdoor Flow',
    cost: 'free',
    costLabel: 'Free',
    dayOfWeek: 6,
    time: '09:00',
    duration: 60,
    url: 'https://sfrecpark.org/programs-and-events/',
    notes: 'Community class — weather permitting'
  },
  {
    id: 'iyengar-sat',
    venue: 'Iyengar Yoga Institute SF',
    address: '2404 27th Ave',
    neighborhood: 'Inner Sunset',
    classType: 'Iyengar',
    cost: 'low',
    costLabel: '$5–10',
    dayOfWeek: 6,
    time: '10:30',
    duration: 90,
    url: 'https://iyisf.org',
    notes: 'Sliding scale community class'
  }
];

/* ── State ── */
let yogaFilterDay  = 'today';
let yogaFilterCost = 'all';

/* ── Called once when the panel is first shown ── */
function initYoga() {
  const updatedEl = document.getElementById('yoga-updated');
  if (updatedEl) updatedEl.textContent = YOGA_LAST_UPDATED;
  buildDayFilter();
  attachYogaFilterListeners();
  renderYogaGrid();
}

/* ── Build the day filter pills dynamically (today + next 6 days) ── */
function buildDayFilter() {
  const container = document.getElementById('yoga-day-filter');
  if (!container || container.dataset.built) return;
  container.dataset.built = '1';

  const weekDates = yogaWeekDates();
  const today     = new Date();
  today.setHours(0, 0, 0, 0);

  const pills = [
    { label: 'All week', value: 'all' },
    { label: 'Today', value: 'today' },
    ...weekDates.map(d => ({
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      value: String(d.getDay())
    }))
  ];

  // Deduplicate: if two entries map to the same dayOfWeek (shouldn't happen in 7 days
  // but guard against DST weirdness).
  const seen = new Set();
  const unique = pills.filter(p => {
    if (seen.has(p.value)) return false;
    seen.add(p.value);
    return true;
  });

  container.innerHTML = unique.map(p =>
    `<button class="yoga-filter-btn${p.value === 'today' ? ' active' : ''}"
             data-day="${p.value}">${p.label}</button>`
  ).join('');
}

/* ── Wire filter button clicks ── */
function attachYogaFilterListeners() {
  const dayGroup  = document.getElementById('yoga-day-filter');
  const costGroup = document.getElementById('yoga-cost-filter');
  if (!dayGroup || !costGroup) return;

  dayGroup.addEventListener('click', e => {
    const btn = e.target.closest('.yoga-filter-btn');
    if (!btn) return;
    yogaFilterDay = btn.dataset.day;
    dayGroup.querySelectorAll('.yoga-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderYogaGrid();
  });

  costGroup.addEventListener('click', e => {
    const btn = e.target.closest('.yoga-filter-btn');
    if (!btn) return;
    yogaFilterCost = btn.dataset.cost;
    costGroup.querySelectorAll('.yoga-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderYogaGrid();
  });
}

/* ── Render the filtered grid ── */
function renderYogaGrid() {
  const weekDates = yogaWeekDates();
  const today     = new Date();
  today.setHours(0, 0, 0, 0);

  let filtered = YOGA_CLASSES.filter(c => {
    if (yogaFilterCost !== 'all' && c.cost !== yogaFilterCost) return false;

    if (yogaFilterDay === 'all')   return true;
    if (yogaFilterDay === 'today') return c.dayOfWeek === today.getDay();
    return c.dayOfWeek === parseInt(yogaFilterDay, 10);
  });

  // Sort within the rolling 7-day window, then by time
  filtered = filtered.slice().sort((a, b) => {
    const ai = weekDates.findIndex(d => d.getDay() === a.dayOfWeek);
    const bi = weekDates.findIndex(d => d.getDay() === b.dayOfWeek);
    if (ai !== bi) return ai - bi;
    return a.time.localeCompare(b.time);
  });

  const grid = document.getElementById('yoga-grid');
  if (!filtered.length) {
    grid.innerHTML = '<p class="yoga-empty">No classes match this filter — try "All week".</p>';
    return;
  }

  grid.innerHTML = filtered.map(c => yogaCardHTML(c, weekDates)).join('');
}

/* ── Build one card's HTML ── */
function yogaCardHTML(c, weekDates) {
  const matchDate = weekDates.find(d => d.getDay() === c.dayOfWeek);
  const dateLabel = matchDate
    ? matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][c.dayOfWeek];

  const timeLabel     = yogaFormatTime(c.time);
  const durationLabel = yogaFormatDuration(c.duration);

  const linkHtml  = c.url
    ? `<a class="yoga-card-link" href="${c.url}" target="_blank" rel="noopener">Visit site →</a>`
    : '';
  const notesHtml = c.notes
    ? `<p class="yoga-card-notes">${c.notes}</p>`
    : '';

  return `<div class="yoga-card yoga-card-${c.cost}">
  <div class="yoga-card-top">
    <span class="yoga-badge yoga-cost-${c.cost}">${c.costLabel}</span>
    <span class="yoga-type-label">${c.classType}</span>
  </div>
  <h3 class="yoga-card-venue">${c.venue}</h3>
  <p class="yoga-card-location">${c.address} &middot; ${c.neighborhood}</p>
  <div class="yoga-card-time">
    <span class="yoga-date-chip">${dateLabel}</span>
    <span class="yoga-time-text">${timeLabel} &middot; ${durationLabel}</span>
  </div>
  ${notesHtml}
  ${linkHtml}
</div>`;
}

/* ── Helpers ── */

// Returns an array of 7 Date objects: today, tomorrow, ..., today+6
function yogaWeekDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function yogaFormatTime(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12    = h % 12 || 12;
  return m === 0
    ? `${h12} ${period}`
    : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function yogaFormatDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
