/* ─────────────────────────────────────────────
   tabs.js
   Drives the top-level tab bar.

   Convention: each tab has data-tab="<id>" and
   a corresponding <div id="tab-<id>"> in the page.
   Adding a new tab only requires matching HTML —
   no changes needed here.
───────────────────────────────────────────── */

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});
