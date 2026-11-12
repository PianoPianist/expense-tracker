// ==========================================================================
// PENNY CLIENT CONTROLLER — REACTIVE HORIZON ARCHITECTURE
// Connects to Node.js REST Endpoints & Renders Fluid SVG Visualizations
// ==========================================================================

const STATE = {
  profile: null,
  predictedBudget: 24800,
  transactions: [],
  goals: [],
  benchmarks: null,
  meta: null,
  activeView: 'overview',
  activeFilter: 'all',
  simCutPct: 20
};

const CAT_COLORS = {
  food: '#FF5A1F',
  entertainment: '#7C3AED',
  travel: '#0284C7',
  technology: '#2563EB',
  education: '#0D9488',
  shopping: '#DB2777',
  utilities: '#D97706',
  healthcare: '#DC2626',
  emi: '#4F46E5',
  investment: '#059669',
  miscellaneous: '#64748B'
};

const CAT_NAMES = {
  food: 'Food & Dining',
  entertainment: 'Entertainment',
  travel: 'Transit & Travel',
  technology: 'Technology',
  education: 'Education',
  shopping: 'Shopping',
  utilities: 'Utilities & Bills',
  healthcare: 'Healthcare',
  emi: 'Loans & EMI',
  investment: 'Savings & Invest',
  miscellaneous: 'Miscellaneous'
};

// --------------------------------------------------------------------------
// LIFECYCLE & INITIAL LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Set default dates
  const todayStr = new Date().toISOString().split('T')[0];
  const qmDate = document.getElementById('qm-date');
  const inDate = document.getElementById('inline-date');
  const gmDate = document.getElementById('gm-deadline');
  if (qmDate) qmDate.value = todayStr;
  if (inDate) inDate.value = todayStr;
  if (gmDate) {
    const future = new Date();
    future.setMonth(future.getMonth() + 6);
    gmDate.value = future.toISOString().split('T')[0];
  }

  await loadMetadata();
  await loadProfile();
  await loadTransactions();
  await loadGoals();
  await loadPeerBenchmarks();

  renderAll();
});

// --------------------------------------------------------------------------
// API FETCHERS
// --------------------------------------------------------------------------
async function loadMetadata() {
  try {
    const res = await fetch('/api/meta');
    STATE.meta = await res.json();
    populateMetaDropdowns();
  } catch (err) {
    console.error('Failed to load metadata:', err);
  }
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data.exists && data.profile) {
      STATE.profile = data.profile;
      STATE.predictedBudget = data.predicted_budget || 24800;
      updateSidebarProfile();
    } else {
      openProfileModal(true); // First run: force onboarding modal
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

async function loadTransactions() {
  try {
    const res = await fetch('/api/transactions');
    STATE.transactions = await res.json();
  } catch (err) {
    console.error('Failed to load transactions:', err);
  }
}

async function loadGoals() {
  try {
    const res = await fetch('/api/goals');
    STATE.goals = await res.json();
  } catch (err) {
    console.error('Failed to load goals:', err);
  }
}

async function loadPeerBenchmarks() {
  try {
    const res = await fetch('/api/peer-benchmarks');
    STATE.benchmarks = await res.json();
  } catch (err) {
    console.error('Failed to load peer benchmarks:', err);
  }
}

// --------------------------------------------------------------------------
// VIEW SWITCHING
// --------------------------------------------------------------------------
function switchView(viewName, btn) {
  STATE.activeView = viewName;
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const matching = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (matching) matching.classList.add('active');
  }

  // Switch canvas panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
  }

  // Re-render appropriate view
  if (viewName === 'overview') renderOverview();
  else if (viewName === 'expenses') renderExpenses();
  else if (viewName === 'goals') renderGoals();
  else if (viewName === 'analytics') renderAnalytics();
  else if (viewName === 'studio') renderStudio();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// RENDERERS
// --------------------------------------------------------------------------
function renderAll() {
  updateSidebarProfile();
  renderOverview();
  renderExpenses();
  renderGoals();
  renderAnalytics();
  renderStudio();
}

function updateSidebarProfile() {
  if (!STATE.profile) return;
  const p = STATE.profile;

  const initials = p.name ? p.name.split(' ').map(n => n[0].toUpperCase()).slice(0, 2).join('') : 'ST';
  const avatarEl = document.getElementById('rail-avatar');
  const nameEl = document.getElementById('rail-name');
  const majorEl = document.getElementById('rail-major');
  const incomeEl = document.getElementById('rail-income');
  const aidEl = document.getElementById('rail-aid');
  const payEl = document.getElementById('rail-payment');
  const budgetEl = document.getElementById('rail-budget');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = p.name || 'Scholar';
  if (majorEl) majorEl.textContent = `${p.year_in_school || 'Junior'} · ${p.major || 'Computer Science'}`;
  if (incomeEl) incomeEl.textContent = `₹${parseFloat(p.monthly_income || 0).toLocaleString()}`;
  if (aidEl) aidEl.textContent = `₹${parseFloat(p.financial_aid || 0).toLocaleString()}`;
  if (payEl) payEl.textContent = p.preferred_payment_method || 'Credit Card';
  if (budgetEl) budgetEl.textContent = `₹${parseFloat(STATE.predictedBudget || 0).toLocaleString()}`;
}

// 1. Overview Renderer
function renderOverview() {
  const budget = STATE.predictedBudget;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let spentThisMonth = 0;
  let totalAllTime = 0;

  STATE.transactions.forEach(t => {
    const amt = parseFloat(t.amount || 0);
    totalAllTime += amt;
    if (t.date && t.date.startsWith(currentMonthKey)) {
      spentThisMonth += amt;
    }
  });

  const runway = budget - spentThisMonth;
  const pctUsed = Math.min((spentThisMonth / Math.max(budget, 1)) * 100, 100);

  // Calculate days left in month
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(lastDay - now.getDate(), 1);
  const velocity = Math.max(Math.round(runway / daysLeft), 0);

  // Update KPI Cards
  const kpiBudget = document.getElementById('kpi-budget');
  const kpiSpent = document.getElementById('kpi-spent');
  const kpiCount = document.getElementById('kpi-count');
  const kpiTotalAll = document.getElementById('kpi-total-all');
  const kpiRunway = document.getElementById('kpi-runway');
  const kpiStatus = document.getElementById('kpi-status-pill');
  const kpiDays = document.getElementById('kpi-days-left');
  const kpiVelocity = document.getElementById('kpi-velocity');

  if (kpiBudget) kpiBudget.textContent = `₹${budget.toLocaleString()}`;
  if (kpiSpent) kpiSpent.textContent = `₹${spentThisMonth.toLocaleString()}`;
  if (kpiCount) kpiCount.textContent = `${STATE.transactions.length} entries`;
  if (kpiTotalAll) kpiTotalAll.textContent = `(₹${totalAllTime.toLocaleString()} total)`;
  if (kpiRunway) kpiRunway.textContent = `₹${runway.toLocaleString()}`;
  if (kpiDays) kpiDays.textContent = `${daysLeft} days left`;
  if (kpiVelocity) kpiVelocity.textContent = `₹${velocity.toLocaleString()}`;

  if (kpiStatus) {
    if (runway >= 0) {
      kpiStatus.className = 'pill pill-emerald';
      kpiStatus.textContent = 'On Track';
    } else {
      kpiStatus.className = 'pill pill-rose';
      kpiStatus.textContent = 'Over Budget';
    }
  }

  // Update Runway Gauge
  const gaugePct = document.getElementById('gauge-pct');
  const gaugeDetail = document.getElementById('gauge-detail');
  const gaugeBar = document.getElementById('gauge-bar');

  if (gaugePct) gaugePct.textContent = `${pctUsed.toFixed(1)}%`;
  if (gaugeDetail) gaugeDetail.textContent = `₹${spentThisMonth.toLocaleString()} of ₹${budget.toLocaleString()} allocated`;
  if (gaugeBar) {
    gaugeBar.style.width = `${pctUsed}%`;
    gaugeBar.style.background = pctUsed < 70 ? 'var(--blue-primary)' : (pctUsed < 90 ? 'var(--orange-primary)' : 'var(--rose)');
  }

  renderTrendChart();
  renderDonutChart(totalAllTime);
  renderObservations(runway, budget, spentThisMonth, velocity, totalAllTime);
  renderRecentOverviewTable();
}

function renderTrendChart() {
  const container = document.getElementById('svg-trend-chart');
  if (!container) return;

  const txns = [...STATE.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (!txns.length) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;">No transactions logged yet.</div>';
    return;
  }

  // Group by date
  const byDate = {};
  txns.forEach(t => {
    byDate[t.date] = (byDate[t.date] || 0) + parseFloat(t.amount || 0);
  });

  const dates = Object.keys(byDate).slice(-8); // Last 8 days
  const maxVal = Math.max(...dates.map(d => byDate[d]), 1);

  const w = 540;
  const h = 180;
  const barW = Math.max(Math.floor((w - 60) / dates.length) - 12, 14);

  let barsSvg = '';
  dates.forEach((d, idx) => {
    const val = byDate[d];
    const barH = Math.round((val / maxVal) * (h - 40));
    const x = 40 + idx * (barW + 12);
    const y = h - 20 - barH;
    const dayLabel = d.split('-')[2];

    barsSvg += `
      <g class="chart-bar-group" style="cursor:pointer;">
        <title>${d}: ₹${val.toLocaleString()}</title>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="var(--blue-primary)" opacity="0.9" />
        <text x="${x + barW / 2}" y="${h - 4}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--text-muted)">${dayLabel}</text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="30" y1="20" x2="${w}" y2="20" stroke="#F1F5F9" stroke-dasharray="4" />
      <line x1="30" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#F1F5F9" stroke-dasharray="4" />
      <line x1="30" y1="${h - 20}" x2="${w}" y2="${h - 20}" stroke="#CBD5E1" />
      ${barsSvg}
    </svg>
  `;
}

function renderDonutChart(totalAllTime) {
  const container = document.getElementById('svg-donut-chart');
  if (!container) return;

  const catSums = {};
  STATE.transactions.forEach(t => {
    catSums[t.category] = (catSums[t.category] || 0) + parseFloat(t.amount || 0);
  });

  const cats = Object.keys(catSums);
  if (!cats.length || totalAllTime <= 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No category data.</div>';
    return;
  }

  // Build SVG Donut arcs
  const size = 160;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  let circlesSvg = '';

  cats.forEach(c => {
    const val = catSums[c];
    const pct = val / totalAllTime;
    const strokeDash = pct * circumference;
    const color = CAT_COLORS[c] || '#64748B';

    circlesSvg += `
      <circle cx="80" cy="80" r="${radius}" fill="none" stroke="${color}" stroke-width="16"
        stroke-dasharray="${strokeDash} ${circumference - strokeDash}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 80 80)">
        <title>${CAT_NAMES[c] || c}: ₹${val.toLocaleString()} (${(pct * 100).toFixed(1)}%)</title>
      </circle>
    `;
    offset += strokeDash;
  });

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 160 160">
      ${circlesSvg}
    </svg>
    <div style="position:absolute; text-align:center; pointer-events:none;">
      <div style="font-size:17px; font-weight:800; color:var(--text-main);">₹${totalAllTime.toLocaleString()}</div>
      <div style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Verified Outlay</div>
    </div>
  `;
}

function renderObservations(runway, budget, spentThisMonth, velocity, totalAllTime) {
  const container = document.getElementById('ai-observations-container');
  if (!container) return;

  const items = [];
  if (runway < 0) {
    items.append([
      'Budget Alert',
      `You have exceeded your monthly predicted subsistence by ₹${Math.abs(runway).toLocaleString()}. Postpone non-essential dining and shopping.`,
      'pill-rose'
    ]);
  } else if (runway < budget * 0.2) {
    items.push([
      'Runway Caution',
      `Only ₹${runway.toLocaleString()} remaining for the cycle (~₹${velocity.toLocaleString()}/day). Exercise caution on food delivery outlays.`,
      'pill-orange'
    ]);
  } else {
    items.push([
      'Healthy Cashflow',
      `You are pacing comfortably beneath your predicted budget with ₹${runway.toLocaleString()} liquid margin remaining.`,
      'pill-emerald'
    ]);
  }

  // Top driver
  const catTotals = {};
  STATE.transactions.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount || 0);
  });
  let maxCat = null;
  let maxAmt = 0;
  for (const [c, amt] of Object.entries(catTotals)) {
    if (amt > maxAmt) { maxAmt = amt; maxCat = c; }
  }

  if (maxCat && totalAllTime > 0) {
    const pct = ((maxAmt / totalAllTime) * 100).toFixed(0);
    items.push([
      'Primary Cost Driver',
      `${CAT_NAMES[maxCat] || maxCat} represents your largest outlay at ₹${maxAmt.toLocaleString()} (${pct}% of total disbursements).`,
      'pill-blue'
    ]);
  }

  let html = '';
  items.forEach(([tag, desc, pillClass]) => {
    html += `
      <div class="advice-callout">
        <span class="pill ${pillClass}" style="margin-right:6px;">${tag}</span>
        ${desc}
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderRecentOverviewTable() {
  const tbody = document.getElementById('overview-recent-tbody');
  if (!tbody) return;

  const recent = STATE.transactions.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:18px;">No entries logged.</td></tr>';
    return;
  }

  let html = '';
  recent.forEach(t => {
    const catName = CAT_NAMES[t.category] || t.category;
    html += `
      <tr>
        <td style="color:var(--text-muted);">${t.date}</td>
        <td><span class="pill pill-blue">${catName}</span></td>
        <td style="font-weight:600;">${t.description}</td>
        <td class="amt">₹${parseFloat(t.amount).toLocaleString()}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

// 2. Expenses & Ledger Renderer
function renderExpenses() {
  const tbody = document.getElementById('ledger-tbody');
  if (!tbody) return;

  let list = STATE.transactions;
  if (STATE.activeFilter !== 'all') {
    list = list.filter(t => t.category === STATE.activeFilter);
  }

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No transactions matching this filter.</td></tr>';
    return;
  }

  let html = '';
  list.forEach(t => {
    const catName = CAT_NAMES[t.category] || t.category;
    html += `
      <tr>
        <td style="color:var(--text-muted);">${t.date}</td>
        <td><span class="pill pill-blue">${catName}</span></td>
        <td style="font-weight:600;">${t.description}</td>
        <td class="amt">₹${parseFloat(t.amount).toLocaleString()}</td>
        <td style="text-align:center;">
          <button class="btn-secondary" style="padding:3px 8px;font-size:11px;color:#DC2626;" onclick="deleteTransaction(${t.id})">Delete</button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;

  // Populate teach dropdown
  const teachSel = document.getElementById('inline-teach-select');
  if (teachSel && !teachSel.children.length) {
    for (const [k, name] of Object.entries(CAT_NAMES)) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = name;
      teachSel.appendChild(opt);
    }
  }
}

function filterLedger(cat, btn) {
  STATE.activeFilter = cat;
  document.querySelectorAll('#ledger-filter-chips .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderExpenses();
}

async function deleteTransaction(id) {
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    STATE.transactions = data.all || [];
    renderAll();
    showToast('Transaction removed.');
  } catch (err) {
    console.error('Failed to delete transaction:', err);
  }
}

async function resetLedgerDemo() {
  try {
    const res = await fetch('/api/transactions/reset', { method: 'POST' });
    const data = await res.json();
    STATE.transactions = data.all;
    renderAll();
    showToast('Reset to demo student transactions.');
  } catch (err) {
    console.error('Failed to reset ledger:', err);
  }
}

async function clearLedger() {
  if (!confirm('Are you sure you want to clear your entire transaction ledger?')) return;
  try {
    const res = await fetch('/api/transactions/clear', { method: 'POST' });
    const data = await res.json();
    STATE.transactions = data.all;
    renderAll();
    showToast('Ledger cleared.');
  } catch (err) {
    console.error('Failed to clear ledger:', err);
  }
}

function exportLedgerCsv() {
  if (!STATE.transactions.length) {
    showToast('No entries to export.');
    return;
  }
  const headers = ['date', 'category', 'description', 'amount'];
  const rows = STATE.transactions.map(t => [t.date, t.category, `"${t.description.replace(/"/g, '""')}"`, t.amount].join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'penny_student_ledger.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported penny_student_ledger.csv');
}

// Inline NLP Prediction
let predictTimer = null;
function handleInlinePredict(val) {
  clearTimeout(predictTimer);
  const preview = document.getElementById('inline-nlp-preview');
  if (!val.trim()) {
    if (preview) preview.style.display = 'none';
    return;
  }
  predictTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/nlp/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: val })
      });
      const data = await res.json();
      const catEl = document.getElementById('inline-pred-cat');
      const confEl = document.getElementById('inline-pred-conf');
      if (catEl) catEl.textContent = CAT_NAMES[data.category] || data.category;
      if (confEl) confEl.textContent = `${Math.round(data.confidence * 100)}% Confidence`;
      if (preview) preview.style.display = 'flex';
      preview.setAttribute('data-cat', data.category);
    } catch (err) {
      console.error('Prediction failed:', err);
    }
  }, 180);
}

function toggleInlineTeach() {
  const drawer = document.getElementById('inline-teach-drawer');
  if (drawer) {
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
  }
}

async function handleInlineTeach() {
  const desc = document.getElementById('inline-desc').value.trim();
  const select = document.getElementById('inline-teach-select');
  const newCat = select.value;
  if (!desc) return;

  try {
    await fetch('/api/nlp/teach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: desc, category: newCat })
    });
    showToast(`Learned rule: "${desc}" -> ${CAT_NAMES[newCat]}`);
    const preview = document.getElementById('inline-nlp-preview');
    if (preview) {
      document.getElementById('inline-pred-cat').textContent = CAT_NAMES[newCat];
      document.getElementById('inline-pred-conf').textContent = '100% (Rule Memory)';
      preview.setAttribute('data-cat', newCat);
    }
    toggleInlineTeach();
  } catch (err) {
    console.error('Teach failed:', err);
  }
}

async function handleInlineSubmit() {
  const desc = document.getElementById('inline-desc').value.trim();
  const amt = parseFloat(document.getElementById('inline-amt').value) || 0;
  const d = document.getElementById('inline-date').value || new Date().toISOString().split('T')[0];
  const preview = document.getElementById('inline-nlp-preview');
  const cat = preview && preview.getAttribute('data-cat') ? preview.getAttribute('data-cat') : 'miscellaneous';

  if (!desc || amt <= 0) {
    showToast('Please provide a description and amount.');
    return;
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, amount: amt, date: d, category: cat })
    });
    const data = await res.json();
    STATE.transactions = data.all;
    document.getElementById('inline-desc').value = '';
    if (preview) preview.style.display = 'none';
    renderAll();
    showToast(`Recorded: ₹${amt.toLocaleString()} for ${desc}`);
  } catch (err) {
    console.error('Submit failed:', err);
  }
}

// 3. Goals & Milestones Renderer
function renderGoals() {
  const container = document.getElementById('goals-cards-container');
  if (!container) return;

  let totalTar = 0;
  let totalSav = 0;

  STATE.goals.forEach(g => {
    totalTar += parseFloat(g.target_amount || 0);
    totalSav += parseFloat(g.saved_amount || 0);
  });

  const gap = Math.max(totalTar - totalSav, 0);
  const pct = totalTar > 0 ? (totalSav / totalTar) * 100 : 0;

  document.getElementById('goals-total-target').textContent = `₹${totalTar.toLocaleString()}`;
  document.getElementById('goals-active-count').textContent = `Across ${STATE.goals.length} active milestone(s)`;
  document.getElementById('goals-total-saved').textContent = `₹${totalSav.toLocaleString()}`;
  document.getElementById('goals-overall-pct').textContent = `${pct.toFixed(1)}% funded overall`;
  document.getElementById('goals-total-gap').textContent = `₹${gap.toLocaleString()}`;

  if (!STATE.goals.length) {
    container.innerHTML = '<div class="lumi-box" style="text-align:center;color:var(--text-muted);padding:32px;">No savings milestones registered. Click Register Milestone above to begin.</div>';
    return;
  }

  let html = '';
  STATE.goals.forEach(g => {
    const target = parseFloat(g.target_amount || 0);
    const saved = parseFloat(g.saved_amount || 0);
    const rem = Math.max(target - saved, 0);
    const prog = target > 0 ? Math.min((saved / target) * 100, 100) : 0;

    // Calculate months left
    let monthsLeft = 1;
    if (g.deadline) {
      const d = new Date(g.deadline);
      const today = new Date();
      monthsLeft = Math.max((d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()), 1);
    }
    const monthlyNeeded = Math.round(rem / monthsLeft);

    const pri = g.priority || 'Medium';
    const priPill = pri === 'High' ? 'pill-orange' : 'pill-blue';

    html += `
      <div class="lumi-box">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:18px; font-weight:700; color:var(--text-main);">${g.name}</span>
            <span class="pill ${priPill}" style="margin-left:8px;">${pri} Priority</span>
          </div>
          <div style="font-size:12.5px; color:var(--text-muted);">
            Target Date: <b style="color:var(--text-main);">${g.deadline || 'Ongoing'}</b> (${monthsLeft} mos remaining)
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:13.5px;">
          <span style="color:#059669; font-weight:700;">₹${saved.toLocaleString()} saved of ₹${target.toLocaleString()}</span>
          <span style="color:var(--blue-primary); font-weight:700;">₹${monthlyNeeded.toLocaleString()} / month required</span>
        </div>

        <div class="progress-track" style="margin:8px 0;">
          <div class="progress-fill" style="width:${prog}%; background:var(--blue-primary);"></div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text-muted); margin-top:4px;">
          <span>${prog.toFixed(1)}% funded</span>
          <span>₹${rem.toLocaleString()} remaining</span>
        </div>

        <div style="display:flex; gap:8px; margin-top:14px; border-top:1px solid var(--bg-subtle); padding-top:10px;">
          <button class="btn-secondary" style="font-size:12px; padding:4px 10px;" onclick="depositGoal(${g.id}, 500)">+ ₹500</button>
          <button class="btn-secondary" style="font-size:12px; padding:4px 10px;" onclick="depositGoal(${g.id}, 1000)">+ ₹1,000</button>
          <button class="btn-secondary" style="font-size:12px; padding:4px 10px;" onclick="depositGoal(${g.id}, 5000)">+ ₹5,000</button>
          <button class="btn-secondary" style="font-size:12px; padding:4px 10px; margin-left:auto; color:#DC2626;" onclick="deleteGoal(${g.id})">Delete</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function depositGoal(id, amt) {
  try {
    await fetch(`/api/goals/${id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt })
    });
    await loadGoals();
    renderGoals();
    showToast(`Added ₹${amt.toLocaleString()} to milestone!`);
  } catch (err) {
    console.error('Deposit failed:', err);
  }
}

async function deleteGoal(id) {
  try {
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    await loadGoals();
    renderGoals();
    showToast('Milestone deleted.');
  } catch (err) {
    console.error('Delete goal failed:', err);
  }
}

// 4. Peer Benchmarks & Analytics Renderer
function renderAnalytics() {
  if (!STATE.benchmarks) return;

  const titleEl = document.getElementById('bench-header-title');
  const subEl = document.getElementById('bench-header-sub');
  if (titleEl) titleEl.textContent = `Spending Comparison: You vs. ${STATE.benchmarks.scope}`;
  if (subEl) subEl.textContent = `Calibrated across n = ${STATE.benchmarks.cohort_size} verified student peers`;

  renderBenchmarkChart();
  renderOutliers();
  updateSavingsSimulator();
}

function renderBenchmarkChart() {
  const container = document.getElementById('svg-bench-chart');
  if (!container || !STATE.benchmarks) return;

  // Compute your totals per category
  const yourTotals = {};
  STATE.transactions.forEach(t => {
    yourTotals[t.category] = (yourTotals[t.category] || 0) + parseFloat(t.amount || 0);
  });

  const bData = STATE.benchmarks.benchmarks || [];
  const maxVal = Math.max(...bData.map(b => Math.max(yourTotals[b.category] || 0, b.peer_avg)), 1);

  const w = 680;
  const h = 200;
  const groupW = Math.floor((w - 50) / bData.length);
  const barW = Math.max(Math.floor((groupW - 14) / 2), 8);

  let barsSvg = '';
  bData.forEach((b, idx) => {
    const you = yourTotals[b.category] || 0;
    const peer = b.peer_avg;
    const youH = Math.round((you / maxVal) * (h - 40));
    const peerH = Math.round((peer / maxVal) * (h - 40));

    const xYou = 40 + idx * groupW;
    const xPeer = xYou + barW + 2;

    const yYou = h - 20 - youH;
    const yPeer = h - 20 - peerH;

    const catShort = CAT_NAMES[b.category] ? CAT_NAMES[b.category].split(' ')[0] : b.category;

    barsSvg += `
      <g>
        <title>${CAT_NAMES[b.category] || b.category}\nYou: ₹${you.toLocaleString()}\nPeers: ₹${peer.toLocaleString()}</title>
        <rect x="${xYou}" y="${yYou}" width="${barW}" height="${youH}" rx="3" fill="var(--blue-primary)" />
        <rect x="${xPeer}" y="${yPeer}" width="${barW}" height="${peerH}" rx="3" fill="#CBD5E1" />
        <text x="${xYou + barW}" y="${h - 4}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--text-muted)">${catShort}</text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="30" y1="${h - 20}" x2="${w}" y2="${h - 20}" stroke="#CBD5E1" />
      ${barsSvg}
    </svg>
    <div style="display:flex; justify-content:flex-end; gap:16px; font-size:11.5px; font-weight:600; margin-top:8px;">
      <span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:10px;height:10px;background:var(--blue-primary);border-radius:2px;"></span> You</span>
      <span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:10px;height:10px;background:#CBD5E1;border-radius:2px;"></span> Peer Average</span>
    </div>
  `;
}

function renderOutliers() {
  const container = document.getElementById('outliers-container');
  if (!container) return;

  const amounts = STATE.transactions.map(t => parseFloat(t.amount || 0));
  if (amounts.length < 4) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12.5px;padding:8px 0;">Log a few more transactions to calibrate anomaly thresholds.</div>';
    return;
  }

  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const std = Math.sqrt(variance);
  const threshold = mean + 2 * std;

  const outliers = STATE.transactions.filter(t => parseFloat(t.amount) > threshold);
  if (!outliers.length) {
    container.innerHTML = `
      <div style="background:#F0FDF4; border-left:3px solid #10B981; border-radius:0 8px 8px 0; padding:12px 14px; font-size:13px; color:#065F46;">
        <b>Zero Anomalies Detected:</b> All disbursements fall within standard variance bounds (threshold: ₹${Math.round(threshold).toLocaleString()}).
      </div>
    `;
    return;
  }

  let html = '';
  outliers.forEach(o => {
    html += `
      <div style="background:#FFF5F5; border-left:3px solid #DC2626; border-radius:0 8px 8px 0; padding:10px 14px; margin-bottom:8px;">
        <div style="font-weight:700; color:#B91C1C; font-size:13px;">${o.description}</div>
        <div style="font-size:11.5px; color:var(--text-muted);">₹${parseFloat(o.amount).toLocaleString()} on ${o.date} · Exceeds mean + 2σ limit</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function handleSimSlider(val) {
  STATE.simCutPct = parseInt(val, 10);
  updateSavingsSimulator();
}

function updateSavingsSimulator() {
  const discCats = ['food', 'entertainment', 'shopping', 'travel'];
  let discTotal = 0;
  STATE.transactions.forEach(t => {
    if (discCats.includes(t.category)) {
      discTotal += parseFloat(t.amount || 0);
    }
  });

  const monthlySav = Math.round(discTotal * (STATE.simCutPct / 100));
  const annualSav = monthlySav * 12;

  const pctLbl = document.getElementById('sim-pct-lbl');
  const monthLbl = document.getElementById('sim-monthly-val');
  const annLbl = document.getElementById('sim-annual-val');

  if (pctLbl) pctLbl.textContent = `${STATE.simCutPct}%`;
  if (monthLbl) monthLbl.textContent = `₹${monthlySav.toLocaleString()} / mo`;
  if (annLbl) annLbl.textContent = `₹${annualSav.toLocaleString()} / yr`;
}

// 5. Model Studio Renderer
function renderStudio() {
  const countEl = document.getElementById('studio-rules-count');
  if (countEl) countEl.textContent = '14 Rules';
  runScratchpadNLP(document.getElementById('scratch-input')?.value || 'Campus bookstore notebook');
}

let scratchTimer = null;
function runScratchpadNLP(val) {
  clearTimeout(scratchTimer);
  scratchTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/nlp/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: val })
      });
      const data = await res.json();
      document.getElementById('scratch-cat-lbl').textContent = CAT_NAMES[data.category] || data.category;
      document.getElementById('scratch-conf-lbl').textContent = `${Math.round(data.confidence * 100)}% Confidence`;
    } catch (err) {
      console.error('Scratchpad predict error:', err);
    }
  }, 150);
}

// --------------------------------------------------------------------------
// MODAL CONTROLLERS & SUBMISSIONS
// --------------------------------------------------------------------------
function openProfileModal(isForced = false) {
  const backdrop = document.getElementById('onboarding-modal-backdrop');
  const dialog = document.getElementById('onboarding-modal');
  const closeBtn = document.getElementById('ob-close-btn');
  const cancelBtn = document.getElementById('ob-cancel-btn');
  const titleEl = document.getElementById('ob-modal-title');
  const subEl = document.getElementById('ob-modal-sub');
  const submitBtn = document.getElementById('ob-submit-btn');

  if (isForced) {
    if (closeBtn) closeBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (titleEl) titleEl.textContent = 'Welcome to Penny';
    if (subEl) subEl.textContent = 'Configure your actual student financial parameters. This is saved permanently and will not be asked again.';
    if (submitBtn) submitBtn.textContent = 'Save Profile & Launch Co-Pilot';
    backdrop.onclick = null;
  } else {
    if (closeBtn) closeBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (titleEl) titleEl.textContent = 'Edit Student Financial Profile';
    if (subEl) subEl.textContent = 'Update your academic parameters, stipend income, or financial aid amounts.';
    if (submitBtn) submitBtn.textContent = 'Update Profile';
    backdrop.onclick = closeProfileModal;
  }

  // Pre-fill fields if profile exists
  if (STATE.profile) {
    document.getElementById('ob-name').value = STATE.profile.name || '';
    document.getElementById('ob-major').value = STATE.profile.major || '';
    document.getElementById('ob-year').value = STATE.profile.year_in_school || '';
    document.getElementById('ob-age').value = STATE.profile.age || 22;
    document.getElementById('ob-gender').value = STATE.profile.gender || '';
    document.getElementById('ob-income').value = STATE.profile.monthly_income || 90000;
    document.getElementById('ob-aid').value = STATE.profile.financial_aid || 45000;
    document.getElementById('ob-payment').value = STATE.profile.preferred_payment_method || '';
  }

  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  setTimeout(() => {
    backdrop.style.opacity = '1';
    dialog.style.opacity = '1';
    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
}

function closeProfileModal() {
  const backdrop = document.getElementById('onboarding-modal-backdrop');
  const dialog = document.getElementById('onboarding-modal');
  backdrop.style.opacity = '0';
  dialog.style.opacity = '0';
  dialog.style.transform = 'translate(-50%, -46%) scale(0.96)';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 220);
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('ob-name').value.trim() || 'Scholar';
  const major = document.getElementById('ob-major').value;
  const year = document.getElementById('ob-year').value;
  const age = parseInt(document.getElementById('ob-age').value, 10) || 22;
  const gender = document.getElementById('ob-gender').value;
  const income = parseFloat(document.getElementById('ob-income').value) || 90000;
  const aid = parseFloat(document.getElementById('ob-aid').value) || 45000;
  const payment = document.getElementById('ob-payment').value;

  const payload = {
    name, major, year_in_school: year, age, gender,
    monthly_income: income, financial_aid: aid, preferred_payment_method: payment
  };

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    STATE.profile = data.profile;
    STATE.predictedBudget = data.predicted_budget;
    closeProfileModal();
    await loadPeerBenchmarks();
    renderAll();
    showToast('Student profile saved permanently!');
  } catch (err) {
    console.error('Failed to save profile:', err);
  }
}

// Quick Add Modal
function openQuickModal() {
  const backdrop = document.getElementById('quick-modal-backdrop');
  const dialog = document.getElementById('quick-modal');
  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  setTimeout(() => {
    backdrop.style.opacity = '1';
    dialog.style.opacity = '1';
    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
}

function closeQuickModal() {
  const backdrop = document.getElementById('quick-modal-backdrop');
  const dialog = document.getElementById('quick-modal');
  backdrop.style.opacity = '0';
  dialog.style.opacity = '0';
  dialog.style.transform = 'translate(-50%, -46%) scale(0.96)';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 220);
}

let modalPredictTimer = null;
function handleModalPredict(val) {
  clearTimeout(modalPredictTimer);
  modalPredictTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/nlp/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: val })
      });
      const data = await res.json();
      document.getElementById('qm-cat-name').textContent = CAT_NAMES[data.category] || data.category;
      document.getElementById('qm-cat-conf').textContent = `${Math.round(data.confidence * 100)}% Match`;
      document.getElementById('qm-pred-box').setAttribute('data-cat', data.category);
    } catch (err) {
      console.error('Modal predict failed:', err);
    }
  }, 180);
}

async function handleQuickModalSubmit(e) {
  e.preventDefault();
  const desc = document.getElementById('qm-desc').value.trim();
  const amt = parseFloat(document.getElementById('qm-amt').value) || 0;
  const d = document.getElementById('qm-date').value || new Date().toISOString().split('T')[0];
  const cat = document.getElementById('qm-pred-box').getAttribute('data-cat') || 'miscellaneous';

  if (!desc || amt <= 0) return;

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, amount: amt, date: d, category: cat })
    });
    const data = await res.json();
    STATE.transactions = data.all;
    closeQuickModal();
    document.getElementById('qm-desc').value = '';
    renderAll();
    showToast(`Logged ₹${amt.toLocaleString()} for ${desc}`);
  } catch (err) {
    console.error('Quick submit failed:', err);
  }
}

// New Goal Modal
function openNewGoalModal() {
  const backdrop = document.getElementById('goal-modal-backdrop');
  const dialog = document.getElementById('goal-modal');
  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  setTimeout(() => {
    backdrop.style.opacity = '1';
    dialog.style.opacity = '1';
    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
}

function closeGoalModal() {
  const backdrop = document.getElementById('goal-modal-backdrop');
  const dialog = document.getElementById('goal-modal');
  backdrop.style.opacity = '0';
  dialog.style.opacity = '0';
  dialog.style.transform = 'translate(-50%, -46%) scale(0.96)';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 220);
}

async function handleNewGoalSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('gm-name').value.trim();
  const target = parseFloat(document.getElementById('gm-target').value) || 10000;
  const saved = parseFloat(document.getElementById('gm-saved').value) || 0;
  const deadline = document.getElementById('gm-deadline').value;
  const priority = document.getElementById('gm-priority').value;

  if (!name) return;

  try {
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, target_amount: target, saved_amount: saved, deadline, priority })
    });
    await loadGoals();
    closeGoalModal();
    renderGoals();
    showToast(`Registered milestone "${name}"!`);
  } catch (err) {
    console.error('New goal failed:', err);
  }
}

// Populate Meta Options
function populateMetaDropdowns() {
  if (!STATE.meta) return;

  const obMajor = document.getElementById('ob-major');
  const obYear = document.getElementById('ob-year');
  const obGender = document.getElementById('ob-gender');
  const obPayment = document.getElementById('ob-payment');

  if (obMajor && !obMajor.children.length) {
    STATE.meta.majors.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      obMajor.appendChild(opt);
    });
  }

  if (obYear && !obYear.children.length) {
    STATE.meta.years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      obYear.appendChild(opt);
    });
  }

  if (obGender && !obGender.children.length) {
    ['Female', 'Male', 'Non-binary'].forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      obGender.appendChild(opt);
    });
  }

  if (obPayment && !obPayment.children.length) {
    STATE.meta.payments.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      obPayment.appendChild(opt);
    });
  }
}

// Toast helper
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
  }, 10);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.style.display = 'none', 250);
  }, 2600);
}
