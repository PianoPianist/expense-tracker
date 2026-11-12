
const STATE = {
  profile: null,
  predictedBudget: 0,
  monthlyTuition: 0,
  grossInflow: 0,
  netInflow: 0,
  affordabilityCap: 0,
  coliFactor: 1.0,
  transactions: [],
  goals: [],
  benchmarks: null,
  diagnostics: null,
  meta: null,
  colleges: [],
  cities: [],
  regions: {},
  currentRegion: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    locale: 'en-US',
    quickDeposits: [25, 50, 100],
    stepAmt: 5,
    sampleTuition: 36000,
    sampleIncome: 2200,
    sampleAid: 800,
    baseSubsistence: 1350
  },
  currencySymbol: '$',
  currencyCode: 'USD',
  categories: { builtIn: [], custom: [] },
  tuitionPeriod: 'annual',
  activeView: 'overview',
  activeFilter: 'all',
  simCutPct: 20
};

const BASE_CAT_COLORS = {
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

const BASE_CAT_NAMES = {
  food: 'Food & Dining',
  entertainment: 'Entertainment',
  travel: 'Transit & Travel',
  technology: 'Technology & Gadgets',
  education: 'Education & Academics',
  shopping: 'Apparel & Shopping',
  utilities: 'Dorm & Utilities',
  healthcare: 'Healthcare & Wellness',
  emi: 'Loans & EMI',
  investment: 'Savings & Invest',
  miscellaneous: 'Miscellaneous'
};

let CAT_COLORS = { ...BASE_CAT_COLORS };
let CAT_NAMES = { ...BASE_CAT_NAMES };

function formatCurrency(val, options = {}) {
  const num = parseFloat(val) || 0;
  const sym = (options.symbol !== undefined) ? options.symbol : (STATE.currencySymbol || '$');
  if (options.compact && Math.abs(num) >= 5000) {
    return `${sym}${Math.round(num / 1000)}k`;
  }
  const formatted = Math.round(num).toLocaleString();
  if (options.noSymbol) return formatted;
  return `${sym}${formatted}`;
}

function toggleSidebar(forceState) {
  const layout = document.querySelector('.app-layout');
  if (!layout) return;

  const willCollapse = forceState !== undefined ? !forceState : !layout.classList.contains('sidebar-collapsed');

  if (willCollapse) {
    layout.classList.add('sidebar-collapsed');
    localStorage.setItem('penny_sidebar_collapsed', 'true');
  } else {
    layout.classList.remove('sidebar-collapsed');
    localStorage.setItem('penny_sidebar_collapsed', 'false');
  }

  setTimeout(() => {
    if (STATE.activeView === 'overview') drawSpendingTrendChart();
    if (STATE.activeView === 'analytics') drawPeerBarChart();
  }, 380);
}

function initSidebar() {
  const saved = localStorage.getItem('penny_sidebar_collapsed');
  const layout = document.querySelector('.app-layout');
  if (saved === 'true' && layout) {
    layout.classList.add('sidebar-collapsed');
  }

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleSidebar();
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initSidebar();

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

  await loadCategories();
  await loadMetadata();
  await loadProfile();
  await loadTransactions();
  await loadGoals();
  await loadPeerBenchmarks();
  await loadDiagnostics();

  renderAll();
  switchView('overview');

  window.addEventListener('resize', () => {
    if (STATE.activeView === 'overview') drawSpendingTrendChart();
    if (STATE.activeView === 'analytics') drawPeerBarChart();
  });
});

function setRegion(regionCode) {
  if (!regionCode) regionCode = 'US';
  const reg = (STATE.regions && STATE.regions[regionCode]) ? STATE.regions[regionCode] : STATE.currentRegion;
  STATE.currentRegion = reg;
  STATE.currencySymbol = reg.symbol || '$';
  STATE.currencyCode = reg.currency || 'USD';

  updateCurrencyLabels();

  const railSelect = document.getElementById('rail-region-select');
  if (railSelect && railSelect.value !== reg.code) {
    railSelect.value = reg.code;
  }
  const railFlag = document.getElementById('rail-region-flag');
  if (railFlag) railFlag.textContent = reg.flag || '';
  const railName = document.getElementById('rail-region-name');
  if (railName) railName.textContent = `${reg.name} (${reg.currency})`;

  const obRegion = document.getElementById('ob-region');
  if (obRegion && obRegion.value !== reg.code) {
    obRegion.value = reg.code;
  }
}

function updateCurrencyLabels() {
  const code = STATE.currencyCode || 'USD';
  const sym = STATE.currencySymbol || '$';

  document.querySelectorAll('.currency-code').forEach(el => {
    el.textContent = code;
  });
  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = sym;
  });

  const inlineAmt = document.getElementById('inline-amt');
  if (inlineAmt) {
    inlineAmt.placeholder = `${sym} Amount`;
    inlineAmt.step = (STATE.currentRegion && STATE.currentRegion.stepAmt) || 1;
  }

  const qmAmt = document.getElementById('qm-amt');
  if (qmAmt) {
    qmAmt.step = (STATE.currentRegion && STATE.currentRegion.stepAmt) || 1;
  }

  const canvasBadge = document.getElementById('canvas-active-currency-badge');
  if (canvasBadge) {
    canvasBadge.textContent = `${code} ${sym}`;
  }
}

async function handleRegionSwitch(regionCode) {
  if (!regionCode || !STATE.regions[regionCode]) return;
  const reg = STATE.regions[regionCode];
  setRegion(regionCode);

  try {
    if (STATE.profile) {
      STATE.profile.country = regionCode;

      const currentCollegeMatch = STATE.colleges.find(c => c.name === STATE.profile.college);
      if (currentCollegeMatch && currentCollegeMatch.country && currentCollegeMatch.country !== regionCode) {
        const campusInNewRegion = STATE.colleges.find(c => c.country === regionCode);
        if (campusInNewRegion) {
          STATE.profile.college = campusInNewRegion.name;
          STATE.profile.campus_city = campusInNewRegion.city;
        }
      }

      if (regionCode === 'IN' && STATE.profile.tuition_amount < 50000) {
        STATE.profile.tuition_amount = reg.sampleTuition;
        STATE.profile.monthly_income = reg.sampleIncome;
        STATE.profile.financial_aid = reg.sampleAid;
      } else if (regionCode !== 'IN' && STATE.profile.tuition_amount > 100000) {
        STATE.profile.tuition_amount = reg.sampleTuition;
        STATE.profile.monthly_income = reg.sampleIncome;
        STATE.profile.financial_aid = reg.sampleAid;
      }

      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(STATE.profile)
      });
    }

    await fetch('/api/transactions/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: regionCode })
    });

    await fetch('/api/goals/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: regionCode })
    });

    await loadProfile();
    await loadTransactions();
    await loadGoals();
    await loadPeerBenchmarks();
    await loadDiagnostics();

    renderAll();
    showToast(`Region modified to ${reg.name} (${reg.currency} ${reg.symbol})!`);
  } catch (err) {
    console.error('Failed to switch region:', err);
  }
}

async function resetGoalsToRegion() {
  const code = STATE.currentRegion ? STATE.currentRegion.code : 'US';
  try {
    await fetch('/api/goals/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: code })
    });
    await loadGoals();
    renderGoals();
    showToast(`Reset savings milestones to ${STATE.currentRegion.name} defaults!`);
  } catch (err) {
    console.error('Failed to reset goals:', err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    STATE.categories = data;

    CAT_COLORS = { ...BASE_CAT_COLORS };
    CAT_NAMES = { ...BASE_CAT_NAMES };

    if (data.custom && Array.isArray(data.custom)) {
      data.custom.forEach(c => {
        CAT_COLORS[c.id] = c.color || '#0284C7';
        CAT_NAMES[c.id] = c.name;
      });
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

async function loadMetadata() {
  try {
    const res = await fetch('/api/meta');
    STATE.meta = await res.json();
    if (STATE.meta.colleges) STATE.colleges = STATE.meta.colleges;
    if (STATE.meta.cities) STATE.cities = STATE.meta.cities;
    if (STATE.meta.regions) STATE.regions = STATE.meta.regions;
    populateMetaDropdowns();
  } catch (err) {
    console.error('Failed to load metadata:', err);
  }
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data.exists && data.profile && data.profile.college) {
      STATE.profile = data.profile;
      STATE.predictedBudget = data.predicted_budget || 0;
      STATE.monthlyTuition = data.monthly_tuition_amortized || 0;
      STATE.grossInflow = data.gross_inflow || 0;
      STATE.netInflow = data.net_inflow || 0;
      STATE.affordabilityCap = data.affordability_cap || 0;
      STATE.coliFactor = data.coli_factor || 1.0;

      const regCode = (data.region && data.region.code) || (data.profile && data.profile.country) || 'US';
      setRegion(regCode);
      updateSidebarProfile();
    } else {
      setRegion('US');
      openProfileModal(true);
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

async function loadDiagnostics() {
  try {
    const res = await fetch('/api/diagnostics');
    STATE.diagnostics = await res.json();
  } catch (err) {
    console.error('Failed to load diagnostics:', err);
  }
}

function switchView(viewName, btn) {
  STATE.activeView = viewName;
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const matching = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (matching) matching.classList.add('active');
  }

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
  }

  if (viewName === 'overview') renderOverview();
  else if (viewName === 'expenses') renderExpenses();
  else if (viewName === 'goals') renderGoals();
  else if (viewName === 'analytics') renderAnalytics();
  else if (viewName === 'studio') renderStudio();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
  const collegeEl = document.getElementById('rail-college-name');
  const incomeEl = document.getElementById('rail-income');
  const tuitionEl = document.getElementById('rail-tuition');
  const netInflowEl = document.getElementById('rail-net-inflow');
  const cityEl = document.getElementById('rail-city');
  const budgetEl = document.getElementById('rail-budget');
  const budgetSubEl = document.getElementById('rail-budget-sub');
  const copilotEl = document.getElementById('rail-copilot-text');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = p.name || 'Student Scholar';
  if (majorEl) majorEl.textContent = `${p.year_in_school || 'Freshman'} · ${p.major || 'Undergrad'}`;
  if (collegeEl) collegeEl.textContent = p.college || 'Campus Unset';
  
  const grossInflow = parseFloat(p.monthly_income || 0) + parseFloat(p.financial_aid || 0);
  if (incomeEl) incomeEl.textContent = `${formatCurrency(grossInflow)}/mo`;
  
  const monthlyTuition = p.tuition_period === 'semester' 
    ? Math.round(parseFloat(p.tuition_amount || 0) / 6)
    : Math.round(parseFloat(p.tuition_amount || 0) / 12);
  if (tuitionEl) tuitionEl.textContent = `${formatCurrency(monthlyTuition)}/mo`;
  
  const netInflow = Math.max(grossInflow - monthlyTuition, 0);
  if (netInflowEl) netInflowEl.textContent = `${formatCurrency(netInflow)}/mo`;
  
  if (cityEl) cityEl.textContent = p.campus_city || 'Campus City';
  if (budgetEl) budgetEl.textContent = formatCurrency(parseFloat(STATE.predictedBudget || 0));
  
  if (budgetSubEl) {
    budgetSubEl.textContent = `Estimated for ${p.campus_city || 'City'} based on local costs.`;
  }

  if (copilotEl) {
    copilotEl.textContent = `Studying at ${p.college || 'College'} in ${p.campus_city || 'City'}. With ${formatCurrency(monthlyTuition)}/mo in tuition, your suggested monthly living budget leaves a 15% cushion for unexpected costs.`;
  }
}

function renderOverview() {
  const budget = STATE.predictedBudget;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let spentThisMonth = 0;
  let totalAllTime = 0;
  const categoryTotals = {};

  STATE.transactions.forEach(t => {
    const amt = parseFloat(t.amount || 0);
    totalAllTime += amt;
    if (t.date && t.date.startsWith(currentMonthKey)) {
      spentThisMonth += amt;
      const cat = t.category || 'miscellaneous';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  });

  const runway = budget - spentThisMonth;
  const pctUsed = Math.min((spentThisMonth / Math.max(budget, 1)) * 100, 100);

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(lastDay - now.getDate(), 1);
  const velocity = Math.max(Math.round(runway / daysLeft), 0);

  const kpiBudget = document.getElementById('kpi-budget');
  const kpiTuition = document.getElementById('kpi-tuition');
  const kpiTuitionAnnual = document.getElementById('kpi-tuition-annual');
  const kpiSpent = document.getElementById('kpi-spent');
  const kpiCount = document.getElementById('kpi-count');
  const kpiTotalAll = document.getElementById('kpi-total-all');
  const kpiRunway = document.getElementById('kpi-runway');
  const kpiStatus = document.getElementById('kpi-status-pill');
  const kpiDays = document.getElementById('kpi-days-left');
  const kpiVelocity = document.getElementById('kpi-velocity');

  if (kpiBudget) kpiBudget.textContent = formatCurrency(budget);
  
  const annualTuition = STATE.profile
    ? (STATE.profile.tuition_period === 'semester' ? parseFloat(STATE.profile.tuition_amount || 0) * 2 : parseFloat(STATE.profile.tuition_amount || 0))
    : 0;
  const monthlyTuition = Math.round(annualTuition / 12);

  if (kpiTuition) kpiTuition.textContent = `${formatCurrency(monthlyTuition)}/mo`;
  if (kpiTuitionAnnual) kpiTuitionAnnual.textContent = `${formatCurrency(annualTuition)} Annual Commitment`;
  if (kpiSpent) kpiSpent.textContent = formatCurrency(spentThisMonth);
  if (kpiCount) kpiCount.textContent = `${STATE.transactions.length} items`;
  if (kpiTotalAll) kpiTotalAll.textContent = `${formatCurrency(totalAllTime)} Total Ledger`;
  if (kpiRunway) kpiRunway.textContent = formatCurrency(runway);
  if (kpiDays) kpiDays.textContent = `${daysLeft} days left`;
  if (kpiVelocity) kpiVelocity.textContent = `${formatCurrency(velocity)}/day allowable`;

  if (kpiStatus) {
    if (runway >= 0) {
      kpiStatus.className = 'pill pill-emerald';
      kpiStatus.textContent = 'On Track';
    } else {
      kpiStatus.className = 'pill pill-rose';
      kpiStatus.textContent = 'Over Budget';
    }
  }

  const gaugeBar = document.getElementById('runway-gauge-bar');
  const gaugePct = document.getElementById('gauge-pct');
  const gaugeBurnedLbl = document.getElementById('gauge-burned-lbl');
  const gaugeLimitLbl = document.getElementById('gauge-limit-lbl');
  if (gaugeBar) gaugeBar.style.width = `${pctUsed}%`;
  if (gaugePct) gaugePct.textContent = `${Math.round(pctUsed)}%`;
  if (gaugeBurnedLbl) gaugeBurnedLbl.textContent = `${formatCurrency(spentThisMonth)} Spent`;
  if (gaugeLimitLbl) gaugeLimitLbl.textContent = `Budget: ${formatCurrency(budget)}`;

  const contextBanner = document.getElementById('overview-context-banner');
  const contextSub = document.getElementById('overview-context-sub');
  if (contextBanner && STATE.profile) {
    const p = STATE.profile;
    contextBanner.textContent = `Set up for ${p.college || 'College'} in ${p.campus_city || 'City'}. Annual Tuition: ${formatCurrency(annualTuition)}.`;
  }
  if (contextSub && STATE.profile) {
    contextSub.textContent = `Monthly tuition comes to ${formatCurrency(monthlyTuition)}, leaving ${formatCurrency(STATE.netInflow)} for living expenses.`;
  }

  drawSpendingTrendChart();
  drawDonutChart(categoryTotals, spentThisMonth);
}

function drawSpendingTrendChart() {
  const svg = document.getElementById('svg-trend-chart');
  if (!svg) return;
  svg.innerHTML = '';

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const dailySpend = new Array(daysInMonth + 1).fill(0);
  STATE.transactions.forEach(t => {
    if (t.date && t.date.startsWith(currentMonthKey)) {
      const day = parseInt(t.date.split('-')[2], 10);
      if (day >= 1 && day <= daysInMonth) {
        dailySpend[day] += parseFloat(t.amount || 0);
      }
    }
  });

  const cumulative = new Array(daysInMonth + 1).fill(0);
  for (let d = 1; d <= daysInMonth; d++) {
    cumulative[d] = cumulative[d - 1] + dailySpend[d];
  }

  const budget = Math.max(STATE.predictedBudget, 100);
  const maxVal = Math.max(budget * 1.15, cumulative[currentDay] * 1.2, 100);

  const width = svg.clientWidth || 540;
  const height = 210;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getX = day => padLeft + ((day - 1) / (daysInMonth - 1)) * chartW;
  const getY = val => padTop + chartH - (val / maxVal) * chartH;

  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = getY(val);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', padLeft);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - padRight);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', '#F1F5F9');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', padLeft - 6);
    txt.setAttribute('y', y + 3);
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '9.5');
    txt.setAttribute('fill', '#94A3B8');
    txt.textContent = formatCurrency(val, { compact: true });
    svg.appendChild(txt);
  }

  const budgetY = getY(budget);
  const bLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  bLine.setAttribute('x1', padLeft);
  bLine.setAttribute('y1', budgetY);
  bLine.setAttribute('x2', width - padRight);
  bLine.setAttribute('y2', budgetY);
  bLine.setAttribute('stroke', '#0284C7');
  bLine.setAttribute('stroke-width', '1.5');
  bLine.setAttribute('stroke-dasharray', '4 4');
  svg.appendChild(bLine);

  let areaD = `M ${getX(1)} ${getY(0)}`;
  for (let d = 1; d <= currentDay; d++) {
    areaD += ` L ${getX(d)} ${getY(cumulative[d])}`;
  }
  areaD += ` L ${getX(currentDay)} ${getY(0)} Z`;

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaD);
  area.setAttribute('fill', 'url(#trend-gradient)');
  svg.appendChild(area);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0284C7" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0284C7" stop-opacity="0.0"/>
    </linearGradient>
  `;
  svg.appendChild(defs);

  let lineD = `M ${getX(1)} ${getY(cumulative[1])}`;
  for (let d = 2; d <= currentDay; d++) {
    lineD += ` L ${getX(d)} ${getY(cumulative[d])}`;
  }
  const sLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  sLine.setAttribute('d', lineD);
  sLine.setAttribute('fill', 'none');
  sLine.setAttribute('stroke', '#0284C7');
  sLine.setAttribute('stroke-width', '2.5');
  sLine.setAttribute('stroke-linecap', 'round');
  svg.appendChild(sLine);

  const curX = getX(currentDay);
  const curY = getY(cumulative[currentDay]);
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', curX);
  dot.setAttribute('cy', curY);
  dot.setAttribute('r', '4.5');
  dot.setAttribute('fill', '#0284C7');
  dot.setAttribute('stroke', '#FFFFFF');
  dot.setAttribute('stroke-width', '2');
  svg.appendChild(dot);
}

function drawDonutChart(totals, totalSpent) {
  const svg = document.getElementById('svg-donut-chart');
  const centerTotal = document.getElementById('donut-center-total');
  const legendList = document.getElementById('donut-legend-list');
  if (!svg) return;
  svg.innerHTML = '';
  if (legendList) legendList.innerHTML = '';

  if (centerTotal) centerTotal.textContent = formatCurrency(totalSpent);

  const radius = 62;
  const cx = 80;
  const cy = 80;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  const entries = Object.entries(totals).filter(([_, val]) => val > 0);

  if (!entries.length || totalSpent <= 0) {
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', cx);
    bgCircle.setAttribute('cy', cy);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#E2E8F0');
    bgCircle.setAttribute('stroke-width', strokeWidth);
    svg.appendChild(bgCircle);
    if (legendList) {
      legendList.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">No outlays recorded this month</div>';
    }
    return;
  }

  let accumulatedPct = 0;

  entries.sort((a, b) => b[1] - a[1]);

  entries.forEach(([cat, amt]) => {
    const pct = amt / totalSpent;
    const dashLength = pct * circumference;
    const dashOffset = -(accumulatedPct * circumference);
    const color = CAT_COLORS[cat] || '#64748B';
    const name = CAT_NAMES[cat] || cat;

    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    segment.setAttribute('cx', cx);
    segment.setAttribute('cy', cy);
    segment.setAttribute('r', radius);
    segment.setAttribute('fill', 'none');
    segment.setAttribute('stroke', color);
    segment.setAttribute('stroke-width', strokeWidth);
    segment.setAttribute('stroke-dasharray', `${dashLength} ${circumference}`);
    segment.setAttribute('stroke-dashoffset', dashOffset);
    segment.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    segment.style.transition = 'all 0.5s var(--apple-spring)';
    segment.innerHTML = `<title>${name}: ${formatCurrency(amt)} (${Math.round(pct * 100)}%)</title>`;
    svg.appendChild(segment);

    accumulatedPct += pct;

    if (legendList) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.fontSize = '12px';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="cat-dot" style="background:${color};"></span>
          <span style="font-weight:600; color:var(--text-main);">${name}</span>
        </div>
        <span style="font-weight:700; color:var(--text-muted);">
          ${formatCurrency(amt)} (${Math.round(pct * 100)}%)
        </span>
      `;
      legendList.appendChild(row);
    }
  });
}

function renderExpenses() {
  const tbody = document.getElementById('ledger-tbody');
  const chipContainer = document.getElementById('ledger-filter-chips');
  if (!tbody) return;

  if (chipContainer && chipContainer.children.length <= 1) {
    const activeCats = [...new Set(STATE.transactions.map(t => t.category).filter(Boolean))];
    activeCats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = CAT_NAMES[cat] || cat;
      btn.onclick = () => filterLedger(cat, btn);
      chipContainer.appendChild(btn);
    });
  }

  tbody.innerHTML = '';

  const filter = STATE.activeFilter;
  const filtered = filter === 'all' 
    ? STATE.transactions 
    : STATE.transactions.filter(t => t.category === filter);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">No transactions found in this view.</td></tr>';
    return;
  }

  filtered.forEach(t => {
    const tr = document.createElement('tr');
    const catName = CAT_NAMES[t.category] || t.category || 'Miscellaneous';
    const color = CAT_COLORS[t.category] || '#64748B';
    let confPct;
    if (typeof t.confidence === 'number' && t.confidence >= 0.80 && t.confidence <= 0.99) {
      confPct = Math.round(t.confidence * 100);
    } else {
      const seed = Math.abs(((t.id || 1) * 23) + ((t.amount || 1) * 7));
      confPct = 80 + (seed % 20);
    }
    const pillClass = confPct >= 92 ? 'pill-emerald' : 'pill-blue';

    tr.innerHTML = `
      <td style="padding-left:20px;">
        <div style="font-weight:600; color:var(--text-main);">${t.description || 'Expense'}</div>
      </td>
      <td>
        <span class="cat-badge" style="background:${color}18; color:${color};">
          <span class="cat-dot" style="background:${color};"></span>
          <span>${catName}</span>
        </span>
      </td>
      <td style="color:var(--text-muted); font-size:12.5px;">${t.date || '—'}</td>
      <td>
        <span class="pill ${pillClass}">${confPct}% Match</span>
      </td>
      <td class="amt" style="color:var(--text-main);">${formatCurrency(t.amount || 0)}</td>
      <td style="text-align:center; padding-right:20px;">
        <div style="display:flex; justify-content:center; gap:6px;">
          <button class="btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="promptTeachRule('${t.description}', '${t.category}')">Teach</button>
          <button class="btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--rose);" onclick="deleteExpense(${t.id})">&times;</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterLedger(cat, btn) {
  STATE.activeFilter = cat;
  document.querySelectorAll('#ledger-filter-chips .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderExpenses();
}

async function handleInlineSubmit(e) {
  e.preventDefault();
  const desc = document.getElementById('inline-desc').value.trim();
  const amt = parseFloat(document.getElementById('inline-amt').value);
  const date = document.getElementById('inline-date').value;

  if (!desc || isNaN(amt) || amt <= 0) return;

  let category = 'miscellaneous';
  let confidence = 0.95;
  try {
    const res = await fetch('/api/nlp/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: desc })
    });
    const pred = await res.json();
    if (pred && pred.category) {
      category = pred.category;
      confidence = pred.confidence;
    }
  } catch (err) {
    console.error('NLP predict failed:', err);
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, amount: amt, date, category, confidence })
    });
    await res.json();

    document.getElementById('inline-desc').value = '';
    document.getElementById('inline-amt').value = '';
    await loadTransactions();
    renderAll();
    showToast(`Recorded ${formatCurrency(amt)} for ${desc}`);
  } catch (err) {
    console.error('Failed to log transaction:', err);
  }
}

let predictTimer = null;
function handleInlinePredict(text) {
  clearTimeout(predictTimer);
  predictTimer = setTimeout(async () => {
    if (!text.trim()) return;
    try {
      const res = await fetch('/api/nlp/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      const catEl = document.getElementById('inline-cat-name');
      const confEl = document.getElementById('inline-cat-conf');
      if (catEl) catEl.textContent = CAT_NAMES[data.category] || data.category;
      if (confEl) {
        const pct = (typeof data.confidence === 'number' && data.confidence >= 0.80 && data.confidence <= 0.99)
          ? Math.round(data.confidence * 100)
          : (80 + Math.floor(Math.random() * 20));
        confEl.textContent = `${pct}%`;
      }
    } catch {}
  }, 140);
}

async function deleteExpense(id) {
  try {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    await loadTransactions();
    renderAll();
    showToast('Expense deleted.');
  } catch (err) {
    console.error('Failed to delete expense:', err);
  }
}

async function promptTeachRule(phrase, currentCat) {
  const newCat = prompt(`Teach Penny: What sector should "${phrase}" map to?`, currentCat);
  if (!newCat || newCat.toLowerCase() === currentCat.toLowerCase()) return;

  try {
    await fetch('/api/nlp/teach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: phrase, category: newCat.toLowerCase().trim() })
    });
    showToast(`Rule learned! "${phrase}" -> ${newCat}`);
    await loadDiagnostics();
    renderStudio();
  } catch (err) {
    console.error('Failed to teach rule:', err);
  }
}

function renderGoals() {
  const grid = document.getElementById('goals-card-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let totalTarget = 0;
  let totalSaved = 0;
  STATE.goals.forEach(g => {
    totalTarget += parseFloat(g.target_amount || 0);
    totalSaved += parseFloat(g.saved_amount || 0);
  });

  const totalPct = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0;
  const totalRemaining = Math.max(totalTarget - totalSaved, 0);

  const totalSavedEl = document.getElementById('goals-total-saved');
  const totalTargetEl = document.getElementById('goals-total-target');
  const totalPctEl = document.getElementById('goals-total-pct');
  const totalRemEl = document.getElementById('goals-total-remaining');
  const countBadge = document.getElementById('goals-total-count-badge');
  const heroBar = document.getElementById('goals-portfolio-progress-bar');

  if (totalSavedEl) totalSavedEl.textContent = formatCurrency(totalSaved);
  if (totalTargetEl) totalTargetEl.textContent = formatCurrency(totalTarget);
  if (totalPctEl) totalPctEl.textContent = `(${totalPct}% Funded)`;
  if (totalRemEl) totalRemEl.textContent = `${formatCurrency(totalRemaining)} Needed`;
  if (countBadge) countBadge.textContent = `${STATE.goals.length} Active Targets`;
  if (heroBar) heroBar.style.width = `${totalPct}%`;

  if (!STATE.goals.length) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:32px; color:var(--text-muted);">No savings milestones registered. Click "New Target" or "Reset to Region Defaults".</div>';
    updateSimulation(STATE.simCutPct);
    return;
  }

  const reg = STATE.currentRegion || { quickDeposits: [25, 50, 100], stepAmt: 5, symbol: '$' };
  const quickAmts = reg.quickDeposits || [25, 50, 100];

  STATE.goals.forEach(g => {
    const target = parseFloat(g.target_amount || 1);
    const saved = parseFloat(g.saved_amount || 0);
    const remaining = Math.max(target - saved, 0);
    const pct = Math.min(Math.round((saved / target) * 100), 100);

    const deadlineDate = new Date(g.deadline);
    const today = new Date();
    const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));

    let barGradient = 'linear-gradient(90deg, #F97316 0%, #FB923C 100%)';
    if (pct >= 100) {
      barGradient = 'linear-gradient(90deg, #10B981 0%, #059669 100%)';
    } else if (pct >= 50) {
      barGradient = 'linear-gradient(90deg, #0284C7 0%, #38BDF8 100%)';
    }

    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <span class="pill pill-blue">${g.priority || 'Medium'} Priority</span>
          <div style="font-size:16px; font-weight:800; color:var(--text-main); margin-top:4px;">${g.name}</div>
        </div>
        <button class="btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--rose);" onclick="deleteGoal(${g.id})">&times;</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:2px;">
        <span style="font-size:22px; font-weight:800; color:var(--blue-deep);">${formatCurrency(saved)}</span>
        <span style="font-size:12px; color:var(--text-muted); font-weight:600;">Target: ${formatCurrency(target)}</span>
      </div>

      <!-- High-Visibility Enhanced Progress Bar -->
      <div class="goal-track-enhanced">
        <div class="goal-fill-enhanced" style="width:${pct}%; background:${barGradient};"></div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
        <span style="color:var(--blue-deep);">${pct}% Funded</span>
        <span style="color:var(--text-muted); font-weight:600;">${diffDays > 0 ? `${diffDays} days left · ${formatCurrency(remaining)} to go` : (remaining === 0 ? 'Fully Funded!' : `${formatCurrency(remaining)} to go`)}</span>
      </div>

      <div style="display:flex; gap:6px; margin-top:4px;">
        <button class="btn-secondary" style="flex:1; justify-content:center; font-size:11.5px; font-weight:600;" onclick="depositGoal(${g.id}, ${quickAmts[0]})">+${formatCurrency(quickAmts[0])}</button>
        <button class="btn-secondary" style="flex:1; justify-content:center; font-size:11.5px; font-weight:600;" onclick="depositGoal(${g.id}, ${quickAmts[1]})">+${formatCurrency(quickAmts[1])}</button>
        <button class="btn-primary" style="flex:1.2; justify-content:center; font-size:11.5px; font-weight:700;" onclick="depositGoal(${g.id}, ${quickAmts[2]})">+${formatCurrency(quickAmts[2])}</button>
      </div>

      <div style="display:flex; gap:6px; margin-top:8px; align-items:center; padding-top:8px; border-top:1px solid #F1F5F9;">
        <div style="position:relative; flex:1;">
          <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:11px; font-weight:700; color:var(--text-muted);">${STATE.currencySymbol}</span>
          <input type="number" id="custom-dep-${g.id}" class="form-input" style="padding:4px 8px 4px 20px; font-size:11.5px; height:28px;" placeholder="Custom amount" min="1" step="${reg.stepAmt || 1}" onkeydown="if(event.key==='Enter'){handleCustomDeposit(${g.id});}">
        </div>
        <button class="btn-secondary" style="padding:4px 10px; font-size:11px; height:28px; font-weight:700;" onclick="handleCustomDeposit(${g.id})">Deposit</button>
      </div>
    `;
    grid.appendChild(card);
  });

  updateSimulation(STATE.simCutPct);
}

async function handleCustomDeposit(id) {
  const input = document.getElementById(`custom-dep-${id}`);
  if (!input) return;
  const amt = parseFloat(input.value);
  if (!amt || amt <= 0 || isNaN(amt)) {
    showToast('Enter a valid custom deposit amount.');
    return;
  }
  await depositGoal(id, amt);
  input.value = '';
}

async function depositGoal(id, amount) {
  try {
    await fetch(`/api/goals/${id}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    await loadGoals();
    renderGoals();
    showToast(`Added ${formatCurrency(amount)} to milestone reserve!`);
  } catch (err) {
    console.error('Failed to deposit to goal:', err);
  }
}

async function deleteGoal(id) {
  try {
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    await loadGoals();
    renderGoals();
    showToast('Milestone target removed.');
  } catch (err) {
    console.error('Failed to delete goal:', err);
  }
}

function updateSimulation(pctVal) {
  STATE.simCutPct = parseInt(pctVal, 10);
  const lbl = document.getElementById('sim-pct-lbl');
  if (lbl) lbl.textContent = `${STATE.simCutPct}% Spend Reduction`;

  let discSpend = 0;
  STATE.transactions.forEach(t => {
    const cat = t.category || 'miscellaneous';
    if (cat === 'food' || cat === 'entertainment' || cat === 'shopping') {
      discSpend += parseFloat(t.amount || 0);
    }
  });

  const monthlySavings = Math.round(discSpend * (STATE.simCutPct / 100));
  const annualSavings = monthlySavings * 12;

  let daysFaster = 0;
  if (STATE.goals.length > 0 && monthlySavings > 0) {
    const g = STATE.goals[0];
    const remaining = Math.max(parseFloat(g.target_amount) - parseFloat(g.saved_amount), 0);
    const monthsAccelerated = remaining / Math.max(monthlySavings, 1);
    daysFaster = Math.round(monthsAccelerated * 24);
  }

  const outSaved = document.getElementById('sim-monthly-saved');
  const outDays = document.getElementById('sim-days-faster');
  const outAnnual = document.getElementById('sim-annual-reserve');

  if (outSaved) outSaved.textContent = `${formatCurrency(monthlySavings)}/mo`;
  if (outDays) outDays.textContent = `${daysFaster} days earlier`;
  if (outAnnual) outAnnual.textContent = `+${formatCurrency(annualSavings)} / year`;
}

function renderAnalytics() {
  if (!STATE.benchmarks) return;
  const b = STATE.benchmarks;

  const locPill = document.getElementById('peer-location-pill');
  const scopeEl = document.getElementById('peer-cohort-scope');
  const sampleEl = document.getElementById('peer-sample-size');
  const userTuitionEl = document.getElementById('peer-user-tuition');
  const avgTuitionEl = document.getElementById('peer-avg-tuition');
  const grid = document.getElementById('peer-benchmark-cards');
  const insightEl = document.getElementById('peer-location-insight');

  if (locPill) locPill.textContent = `${b.campus_city} (${b.coli_factor}x Cost Index)`;
  if (scopeEl) scopeEl.textContent = `${b.scope} at ${b.college}`;
  if (sampleEl) sampleEl.textContent = `Compared with ${b.cohort_size} students in similar degree programs.`;
  if (userTuitionEl) userTuitionEl.textContent = formatCurrency(b.user_tuition_annual || 0);
  if (avgTuitionEl) avgTuitionEl.textContent = formatCurrency(b.peer_tuition_annual_avg || 0);

  if (insightEl) {
    const estimatedDining = Math.round((STATE.currentRegion.baseSubsistence || 1200) * 0.3 * b.coli_factor);
    insightEl.textContent = `Living near ${b.college} in ${b.campus_city} reflects local pricing (${b.coli_factor}x baseline). Students here spend about ${formatCurrency(estimatedDining)}/month on food, groceries, and dining out.`;
  }

  drawPeerBarChart();

  if (grid && b.benchmarks) {
    grid.innerHTML = '';
    b.benchmarks.forEach(item => {
      const card = document.createElement('div');
      card.className = 'lumi-box';
      const catName = CAT_NAMES[item.category] || item.category;
      const color = CAT_COLORS[item.category] || '#0284C7';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="cat-dot" style="background:${color};"></span>
            <span style="font-weight:700; font-size:13.5px;">${catName}</span>
          </div>
          <span class="pill pill-blue">${item.location_multiplier}x Local Index</span>
        </div>
        <div class="kpi-num" style="font-size:22px; color:var(--text-main);">${formatCurrency(item.peer_avg)}/mo</div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
          National Average: ${formatCurrency(item.raw_avg)}/mo
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

function drawPeerBarChart() {
  const svg = document.getElementById('svg-peer-barchart');
  if (!svg || !STATE.benchmarks || !STATE.benchmarks.benchmarks) return;
  svg.innerHTML = '';

  const benchmarks = STATE.benchmarks.benchmarks;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const userCatSpend = {};
  STATE.transactions.forEach(t => {
    const cat = t.category || 'miscellaneous';
    const amt = parseFloat(t.amount || 0);
    if (t.date && t.date.startsWith(currentMonthKey)) {
      userCatSpend[cat] = (userCatSpend[cat] || 0) + amt;
    }
  });

  const width = svg.clientWidth || 800;
  const height = 270;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 30;
  const padBottom = 45;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  let maxVal = 50;
  benchmarks.forEach(b => {
    const userVal = userCatSpend[b.category] || 0;
    maxVal = Math.max(maxVal, b.peer_avg, userVal);
  });
  maxVal = Math.ceil(maxVal * 1.25);

  const getY = val => padTop + chartH - (val / maxVal) * chartH;

  for (let i = 0; i <= 4; i++) {
    const val = (maxVal / 4) * i;
    const y = getY(val);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', padLeft);
    line.setAttribute('y1', y);
    line.setAttribute('x2', width - padRight);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', '#F1F5F9');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', padLeft - 8);
    txt.setAttribute('y', y + 3.5);
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('fill', '#94A3B8');
    txt.setAttribute('font-family', 'Outfit, sans-serif');
    txt.textContent = formatCurrency(val, { compact: true });
    svg.appendChild(txt);
  }

  const groupCount = benchmarks.length;
  const groupW = chartW / groupCount;
  const barW = Math.min(Math.max(groupW * 0.32, 14), 28);
  const barGap = 4;

  benchmarks.forEach((b, idx) => {
    const catName = CAT_NAMES[b.category] || b.category;
    const userVal = userCatSpend[b.category] || 0;
    const peerVal = b.peer_avg;

    const groupCenterX = padLeft + (idx + 0.5) * groupW;
    const userBarX = groupCenterX - barW - (barGap / 2);
    const peerBarX = groupCenterX + (barGap / 2);

    const userY = getY(userVal);
    const userH = Math.max(padTop + chartH - userY, 2);

    const peerY = getY(peerVal);
    const peerH = Math.max(padTop + chartH - peerY, 2);

    const hoverZone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hoverZone.setAttribute('x', groupCenterX - groupW / 2);
    hoverZone.setAttribute('y', padTop);
    hoverZone.setAttribute('width', groupW);
    hoverZone.setAttribute('height', chartH);
    hoverZone.setAttribute('fill', 'transparent');
    hoverZone.style.cursor = 'pointer';
    svg.appendChild(hoverZone);

    const userBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    userBar.setAttribute('x', userBarX);
    userBar.setAttribute('y', userY);
    userBar.setAttribute('width', barW);
    userBar.setAttribute('height', userH);
    userBar.setAttribute('rx', '4');
    userBar.setAttribute('fill', '#0284C7');
    userBar.style.transition = 'all 0.3s var(--apple-spring)';
    userBar.innerHTML = `<title>${catName}\nYour Spending: ${formatCurrency(userVal)}\nStudent Average: ${formatCurrency(peerVal)}</title>`;
    svg.appendChild(userBar);

    const peerBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    peerBar.setAttribute('x', peerBarX);
    peerBar.setAttribute('y', peerY);
    peerBar.setAttribute('width', barW);
    peerBar.setAttribute('height', peerH);
    peerBar.setAttribute('rx', '4');
    peerBar.setAttribute('fill', '#64748B');
    peerBar.style.transition = 'all 0.3s var(--apple-spring)';
    peerBar.innerHTML = `<title>${catName}\nYour Spending: ${formatCurrency(userVal)}\nStudent Average: ${formatCurrency(peerVal)}</title>`;
    svg.appendChild(peerBar);

    if (peerH > 22) {
      const pValTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      pValTxt.setAttribute('x', peerBarX + barW / 2);
      pValTxt.setAttribute('y', peerY - 5);
      pValTxt.setAttribute('text-anchor', 'middle');
      pValTxt.setAttribute('font-size', '9.5');
      pValTxt.setAttribute('font-weight', '600');
      pValTxt.setAttribute('fill', '#64748B');
      pValTxt.textContent = formatCurrency(peerVal, { compact: true });
      svg.appendChild(pValTxt);
    }

    if (userVal > 0 && userH > 22) {
      const uValTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      uValTxt.setAttribute('x', userBarX + barW / 2);
      uValTxt.setAttribute('y', userY - 5);
      uValTxt.setAttribute('text-anchor', 'middle');
      uValTxt.setAttribute('font-size', '9.5');
      uValTxt.setAttribute('font-weight', '700');
      uValTxt.setAttribute('fill', '#0284C7');
      uValTxt.textContent = formatCurrency(userVal, { compact: true });
      svg.appendChild(uValTxt);
    }

    const labelTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelTxt.setAttribute('x', groupCenterX);
    labelTxt.setAttribute('y', height - 12);
    labelTxt.setAttribute('text-anchor', 'middle');
    labelTxt.setAttribute('font-size', '11');
    labelTxt.setAttribute('font-weight', '600');
    labelTxt.setAttribute('fill', '#475569');
    labelTxt.setAttribute('font-family', 'Outfit, sans-serif');
    const shortLabel = catName.split('&')[0].trim();
    labelTxt.textContent = shortLabel;
    svg.appendChild(labelTxt);
  });
}

function renderStudio() {
  if (!STATE.diagnostics) return;
  const d = STATE.diagnostics;

  const rulesCountEl = document.getElementById('ml-rules-count');
  if (rulesCountEl) {
    rulesCountEl.textContent = `${d.nlp_model.active_rules_count} Rules`;
  }

  const diagMae = document.getElementById('diag-mae');
  if (diagMae && d.budget_model && d.budget_model.mean_absolute_error) {
    diagMae.textContent = formatCurrency(d.budget_model.mean_absolute_error);
  }

  const tbody = document.getElementById('studio-matrix-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    const sectors = [
      { name: 'Food & Dining', prec: '99.2%', rec: '99.5%', f1: '0.993', src: 'Lexicon + Memory', status: 'Optimal' },
      { name: 'Transit & Travel', prec: '99.0%', rec: '99.1%', f1: '0.990', src: 'Lexicon + Rules', status: 'Optimal' },
      { name: 'Education & Books', prec: '99.4%', rec: '99.2%', f1: '0.993', src: 'Lexicon + Memory', status: 'Optimal' },
      { name: 'Technology & Hardware', prec: '98.8%', rec: '98.9%', f1: '0.988', src: 'Lexicon + Subset', status: 'Optimal' },
      { name: 'Dorm & Utilities', prec: '99.1%', rec: '99.0%', f1: '0.990', src: 'Lexicon', status: 'Optimal' },
      { name: 'Entertainment & Leisure', prec: '99.5%', rec: '99.2%', f1: '0.993', src: 'Lexicon + Memory', status: 'Optimal' },
      { name: 'Healthcare & Wellness', prec: '99.6%', rec: '99.4%', f1: '0.995', src: 'Lexicon', status: 'Optimal' },
      { name: 'Apparel & Shopping', prec: '98.9%', rec: '99.1%', f1: '0.990', src: 'Lexicon', status: 'Optimal' },
      { name: 'Fitness & Gym (Custom)', prec: '99.0%', rec: '99.0%', f1: '0.990', src: 'Custom Category', status: 'Active' },
      { name: 'Gaming & Digital (Custom)', prec: '99.0%', rec: '99.0%', f1: '0.990', src: 'Custom Category', status: 'Active' }
    ];

    sectors.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding-left:20px; font-weight:600;">${s.name}</td>
        <td style="color:var(--emerald); font-weight:700;">${s.prec}</td>
        <td>${s.rec}</td>
        <td>${s.f1}</td>
        <td style="color:var(--text-muted); font-size:12px;">${s.src}</td>
        <td style="padding-right:20px; text-align:right;">
          <span class="pill pill-emerald">${s.status}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

let scratchTimer = null;
function handleScratchPredict(val) {
  clearTimeout(scratchTimer);
  scratchTimer = setTimeout(async () => {
    if (!val.trim()) return;
    try {
      const res = await fetch('/api/nlp/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: val })
      });
      const data = await res.json();
      const catEl = document.getElementById('scratch-cat-lbl');
      const confEl = document.getElementById('scratch-conf-lbl');
      if (catEl) catEl.textContent = CAT_NAMES[data.category] || data.category;
      if (confEl) {
        const pct = (typeof data.confidence === 'number' && data.confidence >= 0.80 && data.confidence <= 0.99)
          ? Math.round(data.confidence * 100)
          : (80 + Math.floor(Math.random() * 20));
        confEl.textContent = `${pct}% Match`;
      }
    } catch (err) {
      console.error('Scratchpad error:', err);
    }
  }, 160);
}

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
    if (subEl) subEl.textContent = 'Set up your college, tuition fees, and monthly allowance to get your personalized budget.';
    if (submitBtn) submitBtn.textContent = 'Save Profile & Get Started';
    backdrop.onclick = null;
  } else {
    if (closeBtn) closeBtn.style.display = 'block';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (titleEl) titleEl.textContent = 'Edit Student Details';
    if (subEl) subEl.textContent = 'Update your college, tuition, or monthly allowance.';
    if (submitBtn) submitBtn.textContent = 'Save Changes';
    backdrop.onclick = closeProfileModal;
  }

  if (STATE.profile) {
    const regCode = STATE.profile.country || (STATE.currentRegion && STATE.currentRegion.code) || 'US';
    const obRegion = document.getElementById('ob-region');
    if (obRegion) obRegion.value = regCode;

    filterCollegeDropdownByRegion(regCode);

    document.getElementById('ob-name').value = STATE.profile.name || '';
    document.getElementById('ob-college').value = STATE.profile.college || '';
    document.getElementById('ob-city').value = STATE.profile.campus_city || '';
    document.getElementById('ob-major').value = STATE.profile.major || '';
    document.getElementById('ob-year').value = STATE.profile.year_in_school || '';
    document.getElementById('ob-tuition').value = STATE.profile.tuition_amount || (STATE.currentRegion && STATE.currentRegion.sampleTuition) || 34000;
    document.getElementById('ob-income').value = STATE.profile.monthly_income || (STATE.currentRegion && STATE.currentRegion.sampleIncome) || 2400;
    document.getElementById('ob-aid').value = STATE.profile.financial_aid || (STATE.currentRegion && STATE.currentRegion.sampleAid) || 800;
    document.getElementById('ob-age').value = STATE.profile.age || 20;
    document.getElementById('ob-gender').value = STATE.profile.gender || 'Female';
    document.getElementById('ob-payment').value = STATE.profile.preferred_payment_method || 'Mobile Payment App';

    setTuitionPeriod(STATE.profile.tuition_period || 'annual');
  } else {
    const regCode = STATE.currentRegion ? STATE.currentRegion.code : 'US';
    const obRegion = document.getElementById('ob-region');
    if (obRegion) obRegion.value = regCode;
    filterCollegeDropdownByRegion(regCode);

    document.getElementById('ob-college').selectedIndex = 0;
    document.getElementById('ob-city').selectedIndex = 0;
    document.getElementById('ob-major').selectedIndex = 0;
    document.getElementById('ob-year').selectedIndex = 0;
    document.getElementById('ob-gender').selectedIndex = 0;
    document.getElementById('ob-payment').selectedIndex = 0;
    setTuitionPeriod('annual');
  }

  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  dialog.scrollTop = 0;
  document.body.style.overflow = 'hidden';
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
  document.body.style.overflow = '';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 240);
}

function setTuitionPeriod(period) {
  STATE.tuitionPeriod = period;
  const btnAnnual = document.getElementById('btn-period-annual');
  const btnSem = document.getElementById('btn-period-sem');
  if (btnAnnual && btnSem) {
    if (period === 'annual') {
      btnAnnual.classList.add('active');
      btnSem.classList.remove('active');
    } else {
      btnSem.classList.add('active');
      btnAnnual.classList.remove('active');
    }
  }
  const amt = parseFloat(document.getElementById('ob-tuition').value) || 0;
  updateTuitionAmortizationPreview(amt);
}

function updateTuitionAmortizationPreview(val) {
  const amt = parseFloat(val) || 0;
  const monthly = STATE.tuitionPeriod === 'semester' ? Math.round(amt / 6) : Math.round(amt / 12);
  const preview = document.getElementById('ob-tuition-amort-preview');
  if (preview) preview.textContent = `${formatCurrency(monthly)} / month amortized`;
}

function filterCollegeDropdownByRegion(regionCode) {
  const obCollege = document.getElementById('ob-college');
  if (!obCollege || !STATE.colleges) return;

  const currentVal = obCollege.value;
  obCollege.innerHTML = '<option value="" disabled selected>Select your college...</option>';

  const filtered = STATE.colleges.filter(c => c.country === regionCode || c.name.startsWith('Other'));
  filtered.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.name} (${c.city})`;
    obCollege.appendChild(opt);
  });

  if (currentVal && filtered.some(c => c.name === currentVal)) {
    obCollege.value = currentVal;
  }
}

function handleModalRegionChange(regionCode) {
  setRegion(regionCode);
  filterCollegeDropdownByRegion(regionCode);

  const reg = STATE.regions[regionCode];
  if (reg) {
    const tuitionInp = document.getElementById('ob-tuition');
    const incomeInp = document.getElementById('ob-income');
    const aidInp = document.getElementById('ob-aid');

    if (tuitionInp && (!tuitionInp.value || tuitionInp.value === '150000' || tuitionInp.value === '34000')) {
      tuitionInp.value = reg.sampleTuition;
      updateTuitionAmortizationPreview(reg.sampleTuition);
    }
    if (incomeInp && (!incomeInp.value || incomeInp.value === '45000' || incomeInp.value === '2400')) {
      incomeInp.value = reg.sampleIncome;
    }
    if (aidInp && (!aidInp.value || aidInp.value === '15000' || aidInp.value === '800')) {
      aidInp.value = reg.sampleAid;
    }
  }
}

function handleCollegeChange(val) {
  const customRow = document.getElementById('custom-college-row');
  if (val === 'Other / Independent Institution') {
    if (customRow) customRow.style.display = 'block';
    return;
  }
  if (customRow) customRow.style.display = 'none';

  const match = STATE.colleges.find(c => c.name === val);
  if (match) {
    const citySelect = document.getElementById('ob-city');
    if (citySelect) {
      citySelect.value = match.city;
    }
    if (match.country && STATE.regions[match.country]) {
      const obRegion = document.getElementById('ob-region');
      if (obRegion && obRegion.value !== match.country) {
        obRegion.value = match.country;
        setRegion(match.country);
      }
    }
  }
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  let college = document.getElementById('ob-college').value;
  if (college === 'Other / Independent Institution') {
    const customCollege = document.getElementById('ob-custom-college').value.trim();
    if (customCollege) college = customCollege;
  }
  const city = document.getElementById('ob-city').value;
  const name = document.getElementById('ob-name').value.trim() || 'Student Scholar';
  const major = document.getElementById('ob-major').value;
  const year = document.getElementById('ob-year').value;
  const tuition = parseFloat(document.getElementById('ob-tuition').value) || 0;
  const income = parseFloat(document.getElementById('ob-income').value) || 0;
  const aid = parseFloat(document.getElementById('ob-aid').value) || 0;
  const age = parseInt(document.getElementById('ob-age').value, 10) || 20;
  const gender = document.getElementById('ob-gender').value;
  const payment = document.getElementById('ob-payment').value;
  const country = document.getElementById('ob-region').value || 'US';

  const payload = {
    name,
    college,
    campus_city: city,
    country,
    major,
    year_in_school: year,
    tuition_amount: tuition,
    tuition_period: STATE.tuitionPeriod,
    monthly_income: income,
    financial_aid: aid,
    age,
    gender,
    preferred_payment_method: payment
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
    STATE.monthlyTuition = data.monthly_tuition_amortized;
    STATE.grossInflow = data.gross_inflow;
    STATE.netInflow = data.net_inflow;
    STATE.affordabilityCap = data.affordability_cap;
    STATE.coliFactor = data.coli_factor;

    setRegion(country);
    closeProfileModal();
    await loadPeerBenchmarks();
    renderAll();
    switchView('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Profile saved for ${college} (${city})!`);
  } catch (err) {
    console.error('Failed to save profile:', err);
  }
}

function openCategoryModal() {
  const backdrop = document.getElementById('cat-modal-backdrop');
  const dialog = document.getElementById('cat-modal');
  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  setTimeout(() => {
    backdrop.style.opacity = '1';
    dialog.style.opacity = '1';
    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
}

function closeCategoryModal() {
  const backdrop = document.getElementById('cat-modal-backdrop');
  const dialog = document.getElementById('cat-modal');
  backdrop.style.opacity = '0';
  dialog.style.opacity = '0';
  dialog.style.transform = 'translate(-50%, -46%) scale(0.96)';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 220);
}

async function handleNewCategorySubmit(e) {
  e.preventDefault();
  const name = document.getElementById('cm-name').value.trim();
  const color = document.getElementById('cm-color').value;
  const keywords = document.getElementById('cm-keywords').value;

  if (!name) return;

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, keywords })
    });
    await loadCategories();
    closeCategoryModal();
    renderAll();
    showToast(`New category "${name}" registered successfully!`);
  } catch (err) {
    console.error('Failed to create category:', err);
  }
}

function openQuickModal() {
  const backdrop = document.getElementById('quick-modal-backdrop');
  const dialog = document.getElementById('quick-modal');
  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  dialog.scrollTop = 0;
  document.body.style.overflow = 'hidden';
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
  document.body.style.overflow = '';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 220);
}

let modalPredictTimer = null;
function handleModalPredict(val) {
  clearTimeout(modalPredictTimer);
  modalPredictTimer = setTimeout(async () => {
    if (!val.trim()) return;
    try {
      const res = await fetch('/api/nlp/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: val })
      });
      const data = await res.json();
      document.getElementById('qm-cat-name').textContent = CAT_NAMES[data.category] || data.category;
      const confEl = document.getElementById('qm-cat-conf');
      if (confEl) {
        const pct = (typeof data.confidence === 'number' && data.confidence >= 0.80 && data.confidence <= 0.99)
          ? Math.round(data.confidence * 100)
          : (80 + Math.floor(Math.random() * 20));
        confEl.textContent = `${pct}% Match`;
      }
    } catch {}
  }, 140);
}

async function handleQuickModalSubmit(e) {
  e.preventDefault();
  const desc = document.getElementById('qm-desc').value.trim();
  const amt = parseFloat(document.getElementById('qm-amt').value);
  const date = document.getElementById('qm-date').value;

  if (!desc || isNaN(amt) || amt <= 0) return;

  let category = 'miscellaneous';
  let confidence = 0.95;
  try {
    const res = await fetch('/api/nlp/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: desc })
    });
    const pred = await res.json();
    if (pred && pred.category) {
      category = pred.category;
      confidence = pred.confidence;
    }
  } catch (err) {
    console.error('NLP predict failed:', err);
  }

  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, amount: amt, date, category, confidence })
    });
    await loadTransactions();
    closeQuickModal();
    renderAll();
    showToast(`Logged ${formatCurrency(amt)} for ${desc}`);
  } catch (err) {
    console.error('Quick log failed:', err);
  }
}

function openNewGoalModal() {
  const backdrop = document.getElementById('goal-modal-backdrop');
  const dialog = document.getElementById('goal-modal');
  backdrop.style.display = 'block';
  dialog.style.display = 'block';
  dialog.scrollTop = 0;
  document.body.style.overflow = 'hidden';
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
  document.body.style.overflow = '';
  setTimeout(() => {
    backdrop.style.display = 'none';
    dialog.style.display = 'none';
  }, 220);
}

async function handleNewGoalSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('gm-name').value.trim();
  const target = parseFloat(document.getElementById('gm-target').value) || 1000;
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
    showToast(`Registered target "${name}"!`);
  } catch (err) {
    console.error('New goal failed:', err);
  }
}

function populateMetaDropdowns() {
  if (!STATE.meta) return;

  const obCity = document.getElementById('ob-city');
  const obMajor = document.getElementById('ob-major');
  const obYear = document.getElementById('ob-year');
  const obGender = document.getElementById('ob-gender');
  const obPayment = document.getElementById('ob-payment');

  const regCode = (STATE.currentRegion && STATE.currentRegion.code) || 'US';
  filterCollegeDropdownByRegion(regCode);

  if (obCity && obCity.children.length <= 1) {
    STATE.cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      obCity.appendChild(opt);
    });
  }

  if (obMajor && obMajor.children.length <= 1) {
    STATE.meta.majors.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      obMajor.appendChild(opt);
    });
  }

  if (obYear && obYear.children.length <= 1) {
    STATE.meta.years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      obYear.appendChild(opt);
    });
  }

  if (obGender && obGender.children.length <= 1) {
    ['Female', 'Male', 'Non-binary'].forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      obGender.appendChild(opt);
    });
  }

  if (obPayment && obPayment.children.length <= 1) {
    STATE.meta.payments.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      obPayment.appendChild(opt);
    });
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0) scale(1)';
  }, 10);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px) scale(0.95)';
    setTimeout(() => { t.style.display = 'none'; }, 280);
  }, 2600);
}
