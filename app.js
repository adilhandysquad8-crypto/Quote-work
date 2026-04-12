/* ═══════════════════════════════════════════════════════════════
   HANDY sQUAD — app.js
   Full role-based field management system
   Supabase backend · White & Blue design
═══════════════════════════════════════════════════════════════ */

// ─── SUPABASE INIT ─────────────────────────────────────────────
const SUPABASE_URL = 'https://zkzehotlgoroxdwwsjfx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpremVob3RsZ29yb3hkd3dzamZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjgwNzIsImV4cCI6MjA5MTUwNDA3Mn0.JFkI_Lk5ReZDIht5yRsE57ALc-PRGobGxmJ67i48cSI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── APP STATE ──────────────────────────────────────────────────
let STATE = {
  user: null,
  profile: null,
  role: null,
  currentPage: 'dashboard',
  data: {
    leads: [], jobs: [], quotations: [], payments: [],
    expenses: [], advances: [], fundReleases: [],
    dailyPlans: [], dailyReports: [], reworkRequests: [], siteVisits: []
  }
};

// ─── BOOT ───────────────────────────────────────────────────────
async function boot() {
  const safetyTimer = setTimeout(() => { hideLoading(); showAuth(); }, 6000);
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    clearTimeout(safetyTimer);
    if (error || !session) {
      // Stale/invalid token — wipe it so user gets a clean login screen
      await sb.auth.signOut();
      showAuth();
    } else {
      STATE.user = session.user;
      await loadProfile();
      showApp();
    }
  } catch (e) {
    clearTimeout(safetyTimer);
    console.error('Boot error:', e);
    await sb.auth.signOut();
    showAuth();
  }
  hideLoading();
}

window.addEventListener('DOMContentLoaded', boot);

// Handle post-boot auth events (user-triggered login / logout)
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    STATE.user = session.user;
    await loadProfile();
    showApp();
    hideLoading();
  } else if (event === 'SIGNED_OUT') {
    STATE.user = null; STATE.profile = null; STATE.role = null;
    showAuth();
  }
});

// ─── AUTH HELPERS ───────────────────────────────────────────────
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}
function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  buildSidebar();
  renderPage('dashboard');
  loadAllData();
}

async function loadProfile() {
  try {
    // Use maybeSingle() instead of single() — avoids 406 error when no row exists
    const { data, error } = await sb.from('users').select('*').eq('email', STATE.user.email).maybeSingle();

    if (data) {
      STATE.profile = data;
      STATE.role = data.role;
    } else {
      // User exists in Auth but not in users table — auto-create the row
      const name = STATE.user.user_metadata?.name || STATE.user.email.split('@')[0];
      const role = STATE.user.user_metadata?.role || 'sales';
      const { data: newUser, error: insertError } = await sb.from('users').insert({
        id: STATE.user.id,
        name,
        role,
        email: STATE.user.email,
        phone: STATE.user.user_metadata?.phone || null
      }).select().single();

      if (newUser) {
        STATE.profile = newUser;
        STATE.role = newUser.role;
      } else {
        // Insert failed (e.g. RLS blocks it) — use a safe in-memory fallback
        console.warn('Could not create user row:', insertError?.message);
        STATE.role = role;
        STATE.profile = { id: STATE.user.id, name, role, email: STATE.user.email };
      }
    }
  } catch (e) {
    console.error('loadProfile error:', e);
    STATE.role = 'sales';
    STATE.profile = { id: STATE.user?.id, name: STATE.user.email?.split('@')[0] || 'User', role: 'sales', email: STATE.user.email };
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const btnTxt = document.getElementById('login-btn-text');
  document.getElementById('auth-error').style.display = 'none';
  if (!email || !pass) { showAuthError('Please enter email and password.'); return; }
  btn.disabled = true;
  btnTxt.innerHTML = '<div class="spinner"></div>';
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) {
      showAuthError(error.message);
      btn.disabled = false;
      btnTxt.textContent = 'Sign In';
      return;
    }
    // Manually drive the app forward — don't rely solely on onAuthStateChange
    if (data?.session) {
      STATE.user = data.session.user;
      await loadProfile();
      showApp();
      hideLoading();
    }
  } catch (e) {
    showAuthError('Login failed. Please try again.');
    btn.disabled = false;
    btnTxt.textContent = 'Sign In';
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}

async function handleLogout() {
  await sb.auth.signOut();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') handleLogin();
});

// ─── DATA LOADING ───────────────────────────────────────────────
async function loadAllData() {
  try {
    const uid = STATE.profile?.id;
    const role = STATE.role;

    const [leads, jobs, quotations, payments, expenses, advances, releases, plans, reports, reworks, visits] = await Promise.all([
      sb.from('sales_leads').select('*').order('created_at', { ascending: false }),
      role === 'manager' && uid
        ? sb.from('jobs').select('*, users!jobs_assigned_manager_id_fkey(name)').eq('assigned_manager_id', uid).order('created_at', { ascending: false })
        : sb.from('jobs').select('*, users!jobs_assigned_manager_id_fkey(name)').order('created_at', { ascending: false }),
      sb.from('quotations').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('payments').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('expenses').select('*, expense_items(*), jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('advance_requests').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('fund_releases').select('*').order('created_at', { ascending: false }),
      sb.from('daily_plans').select('*').order('date', { ascending: false }),
      sb.from('daily_reports').select('*').order('date', { ascending: false }),
      sb.from('rework_requests').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('site_visits').select('*, jobs(customer_name)').order('scheduled_date', { ascending: true })
    ]);

    STATE.data.leads         = leads.data || [];
    STATE.data.jobs          = jobs.data || [];
    STATE.data.quotations    = quotations.data || [];
    STATE.data.payments      = payments.data || [];
    STATE.data.expenses      = expenses.data || [];
    STATE.data.advances      = advances.data || [];
    STATE.data.fundReleases  = releases.data || [];
    STATE.data.dailyPlans    = plans.data || [];
    STATE.data.dailyReports  = reports.data || [];
    STATE.data.reworkRequests= reworks.data || [];
    STATE.data.siteVisits    = visits.data || [];

    renderPage(STATE.currentPage);
  } catch (e) {
    console.error('Data load error:', e);
    showToast('Failed to load data. Check connection.', 'error');
  }
}

// ─── SIDEBAR CONFIG PER ROLE ─────────────────────────────────────
const NAV_CONFIG = {
  sales: [
    { section: 'Overview', items: [
      { id: 'dashboard', icon: '◈', label: 'Dashboard' },
      { id: 'leads', icon: '●', label: 'Leads', badgeKey: 'newLeads' }
    ]},
    { section: 'Jobs', items: [
      { id: 'jobs', icon: '▣', label: 'My Jobs' },
      { id: 'quotations', icon: '◎', label: 'Quotations' },
      { id: 'payments', icon: '↑', label: 'Upload Payment' }
    ]},
    { section: 'Follow-up', items: [
      { id: 'rework', icon: '↩', label: 'Rework Requests' }
    ]}
  ],
  scheduling: [
    { section: 'Overview', items: [
      { id: 'dashboard', icon: '◈', label: 'Dashboard' },
      { id: 'delayed', icon: '⚠', label: 'Delayed Jobs', badgeKey: 'delayedJobs', badgeWarn: true }
    ]},
    { section: 'Management', items: [
      { id: 'jobs', icon: '▣', label: 'All Jobs' },
      { id: 'site-visits', icon: '◷', label: 'Site Visits' },
      { id: 'quotations', icon: '◎', label: 'Quotations' },
      { id: 'rework', icon: '↩', label: 'Rework Queue', badgeKey: 'pendingRework' }
    ]},
    { section: 'Finance', items: [
      { id: 'advances', icon: '◑', label: 'Advance Requests', badgeKey: 'pendingAdvances', badgeWarn: true }
    ]},
    { section: 'Reports', items: [
      { id: 'final-reports', icon: '◎', label: 'Final Reports' }
    ]}
  ],
  manager: [
    { section: 'Overview', items: [
      { id: 'dashboard', icon: '◈', label: 'Dashboard' }
    ]},
    { section: 'My Jobs', items: [
      { id: 'jobs', icon: '▣', label: 'Assigned Jobs' },
      { id: 'site-visits', icon: '◁', label: 'Site Visits' },
      { id: 'quotations', icon: '◎', label: 'Draft Quotation' }
    ]},
    { section: 'Execution', items: [
      { id: 'daily-plans', icon: '◷', label: 'Daily Plans' },
      { id: 'daily-reports', icon: '✓', label: 'Daily Reports' },
      { id: 'expenses', icon: '◈', label: 'Expenses' }
    ]},
    { section: 'Finance', items: [
      { id: 'advance-balance', icon: '◑', label: 'Advance Balance' }
    ]},
    { section: 'Rework', items: [
      { id: 'rework', icon: '↩', label: 'Execute Rework' }
    ]}
  ],
  accounts: [
    { section: 'Overview', items: [
      { id: 'dashboard', icon: '◈', label: 'Dashboard' }
    ]},
    { section: 'Payments', items: [
      { id: 'payments', icon: '↑', label: 'Verify Payments', badgeKey: 'pendingPayments' },
      { id: 'payment-history', icon: '◎', label: 'Payment History' }
    ]},
    { section: 'Advances', items: [
      { id: 'advances', icon: '◑', label: 'Advance Requests', badgeKey: 'pendingAdvances', badgeWarn: true },
      { id: 'fund-releases', icon: '→', label: 'Fund Releases' }
    ]},
    { section: 'Expenses', items: [
      { id: 'expenses', icon: '◈', label: 'Approve Expenses', badgeKey: 'pendingExpenses' }
    ]},
    { section: 'Reports', items: [
      { id: 'profit-overview', icon: '◎', label: 'Profit Overview' },
      { id: 'job-financials', icon: '▣', label: 'Job Financials' }
    ]}
  ]
};

function getBadgeCount(key) {
  const d = STATE.data;
  switch(key) {
    case 'newLeads':       return d.leads.filter(l => l.status === 'new').length;
    case 'delayedJobs':    return d.jobs.filter(j => j.status === 'delayed').length;
    case 'pendingRework':  return d.reworkRequests.filter(r => r.status === 'pending').length;
    case 'pendingAdvances':return d.advances.filter(a => a.status === 'pending').length;
    case 'pendingPayments':return d.payments.filter(p => p.status === 'pending').length;
    case 'pendingExpenses':return d.expenses.filter(e => e.status === 'pending').length;
    default: return 0;
  }
}

function buildSidebar() {
  const role = STATE.role;
  const profile = STATE.profile;
  document.getElementById('sb-name').textContent = profile?.name || 'User';
  document.getElementById('sb-role').textContent = (role || 'sales').charAt(0).toUpperCase() + (role || 'sales').slice(1);
  document.getElementById('sb-avatar').textContent = (profile?.name || 'U').substring(0, 2).toUpperCase();
  document.getElementById('topbar-role').textContent = (role || 'sales').charAt(0).toUpperCase() + (role || 'sales').slice(1);

  const nav = NAV_CONFIG[role] || NAV_CONFIG.sales;
  let html = '';
  nav.forEach(sec => {
    html += `<div class="nav-section-label">${sec.section}</div>`;
    sec.items.forEach(item => {
      const count = item.badgeKey ? getBadgeCount(item.badgeKey) : 0;
      const badgeHtml = count > 0 ? `<span class="nav-badge${item.badgeWarn ? ' warn' : ''}">${count}</span>` : '';
      html += `<div class="nav-item${STATE.currentPage === item.id ? ' active' : ''}" onclick="renderPage('${item.id}')">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
        ${badgeHtml}
      </div>`;
    });
  });
  document.getElementById('sidebar-nav').innerHTML = html;
}

// ─── PAGE ROUTER ─────────────────────────────────────────────────
function renderPage(pageId) {
  STATE.currentPage = pageId;
  buildSidebar();
  const el = document.getElementById('page-content');
  const titleEl = document.getElementById('topbar-title');

  const pages = {
    'dashboard':        renderDashboard,
    'leads':            renderLeads,
    'jobs':             renderJobs,
    'quotations':       renderQuotations,
    'payments':         renderPayments,
    'payment-history':  renderPaymentHistory,
    'expenses':         renderExpenses,
    'advances':         renderAdvances,
    'fund-releases':    renderFundReleases,
    'rework':           renderRework,
    'site-visits':      renderSiteVisits,
    'daily-plans':      renderDailyPlans,
    'daily-reports':    renderDailyReports,
    'advance-balance':  renderAdvanceBalance,
    'delayed':          renderDelayedJobs,
    'final-reports':    renderFinalReports,
    'profit-overview':  renderProfitOverview,
    'job-financials':   renderJobFinancials
  };

  const titles = {
    'dashboard': 'Dashboard', 'leads': 'Sales Leads', 'jobs': 'Jobs',
    'quotations': 'Quotations', 'payments': 'Payments', 'payment-history': 'Payment History',
    'expenses': 'Expenses', 'advances': 'Advance Requests', 'fund-releases': 'Fund Releases',
    'rework': 'Rework Requests', 'site-visits': 'Site Visits', 'daily-plans': 'Daily Plans',
    'daily-reports': 'Daily Reports', 'advance-balance': 'Advance Balance',
    'delayed': 'Delayed Jobs', 'final-reports': 'Final Reports',
    'profit-overview': 'Profit Overview', 'job-financials': 'Job Financials'
  };

  titleEl.textContent = titles[pageId] || pageId;
  el.innerHTML = (pages[pageId] || renderDashboard)();
}

// ─── DASHBOARD ───────────────────────────────────────────────────
function renderDashboard() {
  const role = STATE.role;
  if (role === 'sales')       return renderSalesDashboard();
  if (role === 'scheduling')  return renderSchedulingDashboard();
  if (role === 'manager')     return renderManagerDashboard();
  if (role === 'accounts')    return renderAccountsDashboard();
  return renderSalesDashboard();
}

function renderSalesDashboard() {
  const d = STATE.data;
  const totalLeads = d.leads.length;
  const converted = d.jobs.length;
  const quoteSent = d.quotations.filter(q => q.status === 'sent' || q.status === 'approved').length;
  const pendingPay = d.payments.filter(p => p.status === 'pending').length;

  return `
    <div class="stats-grid">
      ${statCard('Total Leads', totalLeads, '#2196F3', 'badge-info', `${d.leads.filter(l=>l.status==='new').length} new`)}
      ${statCard('Converted Jobs', converted, '#1565C0', 'badge-info', 'Active')}
      ${statCard('Quotations Sent', quoteSent, '#42A5F5', 'badge-info', 'This month')}
      ${statCard('Pending Payments', pendingPay, '#EF5350', pendingPay>0?'badge-danger':'badge-up', pendingPay>0?'Needs attention':'All clear')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Jobs</span>
          <span class="card-link" onclick="renderPage('jobs')">View all</span>
        </div>
        ${jobsList(d.jobs.slice(0, 5), 'sales')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Status Timeline</span></div>
        <div class="card-body">${statusTimeline(d.jobs[0])}</div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Leads</span><span class="card-link" onclick="renderPage('leads')">View all</span></div>
        ${leadsList(d.leads.slice(0, 4))}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="qa-btn" onclick="openModal('new-lead')"><span class="qa-icon">+</span>New Lead</button>
            <button class="qa-btn" onclick="renderPage('payments')"><span class="qa-icon">↑</span>Upload Payment</button>
            <button class="qa-btn" onclick="renderPage('rework')"><span class="qa-icon">↩</span>Request Rework</button>
            <button class="qa-btn" onclick="renderPage('quotations')"><span class="qa-icon">◎</span>View Quotations</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderSchedulingDashboard() {
  const d = STATE.data;
  const activeJobs = d.jobs.filter(j => j.status !== 'completed').length;
  const delayed = d.jobs.filter(j => j.status === 'delayed').length;
  const pendingVisits = d.siteVisits.filter(v => v.status === 'scheduled').length;
  const pendingRework = d.reworkRequests.filter(r => r.status === 'pending').length;

  return `
    <div class="stats-grid">
      ${statCard('Active Jobs', activeJobs, '#1976D2', 'badge-info', 'Ongoing')}
      ${statCard('Delayed Jobs', delayed, '#EF5350', delayed>0?'badge-danger':'badge-up', delayed>0?'Urgent':'All on track')}
      ${statCard('Pending Visits', pendingVisits, '#0D47A1', 'badge-info', 'This week')}
      ${statCard('Rework Requests', pendingRework, '#F59E0B', pendingRework>0?'badge-warn':'badge-up', pendingRework>0?'Needs review':'Clear')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">All Jobs</span><span class="card-link" onclick="renderPage('jobs')">View all</span></div>
        ${jobsList(d.jobs.slice(0, 6), 'scheduling')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="qa-btn" onclick="openModal('assign-manager')"><span class="qa-icon">◈</span>Assign Manager</button>
            <button class="qa-btn" onclick="openModal('schedule-visit')"><span class="qa-icon">◷</span>Schedule Visit</button>
            <button class="qa-btn" onclick="renderPage('rework')"><span class="qa-icon">↩</span>Review Rework</button>
            <button class="qa-btn" onclick="openModal('new-advance')"><span class="qa-icon">◑</span>Create Advance</button>
          </div>
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-100)">
            <div class="card-title" style="margin-bottom:10px">Upcoming Site Visits</div>
            ${siteVisitMini(d.siteVisits.filter(v => v.status === 'scheduled').slice(0, 3))}
          </div>
        </div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">Rework Queue</span><span class="card-link" onclick="renderPage('rework')">View all</span></div>
        ${reworkList(d.reworkRequests.filter(r=>r.status==='pending').slice(0,3), 'scheduling')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Pending Advance Requests</span></div>
        ${advanceMini(d.advances.filter(a=>a.status==='pending').slice(0,3))}
      </div>
    </div>`;
}

function renderManagerDashboard() {
  const d = STATE.data;
  const myJobs = d.jobs;
  const pendingReports = d.dailyPlans.filter(p => {
    const today = new Date().toISOString().split('T')[0];
    return p.date === today && !d.dailyReports.find(r => r.job_id === p.job_id && r.date === today);
  }).length;
  const totalReleased = d.advances.filter(a=>a.status==='released').reduce((s,a)=>s+(a.released_amount||0),0);
  const totalSpent = d.expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
  const balance = totalReleased - totalSpent;

  return `
    <div class="stats-grid">
      ${statCard('Assigned Jobs', myJobs.length, '#1976D2', 'badge-info', 'Active')}
      ${statCard('Reports Pending', pendingReports, '#EF5350', pendingReports>0?'badge-danger':'badge-up', pendingReports>0?'Due today':'All done')}
      ${statCard('Advance Balance', '₹'+fmt(balance), '#42A5F5', balance>0?'badge-up':'badge-danger', balance>0?'Available':'Overspent')}
      ${statCard('Active Expenses', d.expenses.filter(e=>e.status==='pending').length, '#F59E0B', 'badge-warn', 'Awaiting approval')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">My Jobs with Progress</span><span class="card-link" onclick="renderPage('jobs')">View all</span></div>
        ${jobsWithProgress(myJobs.slice(0, 5))}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="qa-btn" onclick="openModal('daily-plan')"><span class="qa-icon">+</span>Add Daily Plan</button>
            <button class="qa-btn" onclick="openModal('daily-report')"><span class="qa-icon">✓</span>Submit Report</button>
            <button class="qa-btn" onclick="openModal('new-expense')"><span class="qa-icon">◈</span>Add Expense</button>
            <button class="qa-btn" onclick="openModal('new-quotation')"><span class="qa-icon">◎</span>Draft Quotation</button>
          </div>
        </div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Expenses</span><span class="card-link" onclick="renderPage('expenses')">View all</span></div>
        ${expensesList(d.expenses.slice(0, 4))}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Advance & Fund Balance</span></div>
        <div class="card-body">
          <div class="finance-grid" style="grid-template-columns:1fr 1fr">
            <div class="finance-box"><div class="finance-label">Total released</div><div class="finance-val fv-blue">₹${fmt(totalReleased)}</div></div>
            <div class="finance-box"><div class="finance-label">Total spent</div><div class="finance-val fv-red">₹${fmt(totalSpent)}</div></div>
            <div class="finance-box"><div class="finance-label">Remaining</div><div class="finance-val fv-green">₹${fmt(balance)}</div></div>
            <div class="finance-box"><div class="finance-label">Pending approval</div><div class="finance-val" style="color:var(--amber-700)">₹${fmt(d.expenses.filter(e=>e.status==='pending').reduce((s,e)=>s+(e.total_amount||0),0))}</div></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderAccountsDashboard() {
  const d = STATE.data;
  const totalCollected = d.payments.filter(p=>p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
  const pendingVerif = d.payments.filter(p=>p.status==='pending').length;
  const totalAdvReleased = d.advances.filter(a=>a.status==='released').reduce((s,a)=>s+(a.released_amount||0),0);
  const totalExpenses = d.expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
  const totalQuoted = d.quotations.filter(q=>q.status==='approved').reduce((s,q)=>s+(q.final_amount||0),0);
  const profit = totalQuoted - totalExpenses;

  return `
    <div class="stats-grid">
      ${statCard('Total Collected', '₹'+fmt(totalCollected), '#1976D2', 'badge-up', 'Verified')}
      ${statCard('Pending Verifications', pendingVerif, '#EF5350', pendingVerif>0?'badge-danger':'badge-up', pendingVerif>0?'Urgent':'All clear')}
      ${statCard('Advance Released', '₹'+fmt(totalAdvReleased), '#0D47A1', 'badge-info', 'This month')}
      ${statCard('Total Expenses', '₹'+fmt(totalExpenses), '#F59E0B', 'badge-warn', d.expenses.filter(e=>e.status==='pending').length+' pending')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Payments Pending Verification</span>
          <span class="nav-badge">${pendingVerif}</span>
        </div>
        ${paymentVerifyList(d.payments.filter(p=>p.status==='pending').slice(0,4))}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Profit Overview</span></div>
        <div class="card-body">
          <div class="finance-grid" style="grid-template-columns:1fr 1fr">
            <div class="finance-box"><div class="finance-label">Total quoted</div><div class="finance-val fv-blue">₹${fmt(totalQuoted)}</div></div>
            <div class="finance-box"><div class="finance-label">Total expenses</div><div class="finance-val fv-red">₹${fmt(totalExpenses)}</div></div>
            <div class="finance-box"><div class="finance-label">Gross profit</div><div class="finance-val fv-green">₹${fmt(profit)}</div></div>
            <div class="finance-box"><div class="finance-label">Margin</div><div class="finance-val fv-green">${totalQuoted > 0 ? ((profit/totalQuoted)*100).toFixed(1) : 0}%</div></div>
          </div>
          <div class="progress-bar" style="height:8px;margin-top:10px">
            <div class="progress-fill" style="width:${totalQuoted>0?Math.min(100,(profit/totalQuoted)*100):0}%;background:var(--green-700)"></div>
          </div>
          <div class="text-sm text-muted mt-4">Profit margin</div>
        </div>
      </div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Advance Requests</span>
          <span class="card-link" onclick="renderPage('advances')">View all</span>
        </div>
        ${advanceApproveList(d.advances.filter(a=>a.status==='pending').slice(0,3))}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Expenses Pending Approval</span>
          <span class="card-link" onclick="renderPage('expenses')">View all</span>
        </div>
        ${expenseApproveList(d.expenses.filter(e=>e.status==='pending').slice(0,3))}
      </div>
    </div>`;
}

// ─── PAGE RENDERERS ──────────────────────────────────────────────
function renderLeads() {
  const d = STATE.data;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div></div>
      <button class="btn-submit" onclick="openModal('new-lead')">+ New Lead</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th>Requirement</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
        ${d.leads.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No leads yet</div></div></td></tr>` :
          d.leads.map(l => `<tr>
            <td><strong>${l.customer_name||'—'}</strong></td>
            <td>${l.customer_phone||'—'}</td>
            <td>${l.location_link ? `<span class="loc-badge">📍 <a href="${l.location_link}" target="_blank" style="color:inherit">Map</a></span>` : l.location_text||'—'}</td>
            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.requirement_summary||'—'}</td>
            <td><span class="job-status ${leadStatusClass(l.status)}">${l.status||'—'}</span></td>
            <td>${fmtDate(l.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderJobs() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.jobs.length} jobs total</div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Location</th>${role==='scheduling'?'<th>Manager</th>':''}<th>Status</th>${role!=='sales'?'<th>Progress</th>':''}${role==='accounts'?'<th>Quoted</th>':''}<th>Created</th></tr></thead>
        <tbody>
        ${d.jobs.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No jobs found</div></div></td></tr>` :
          d.jobs.map(j => `<tr onclick="openJobDetail('${j.id}')" style="cursor:pointer">
            <td><strong>${j.customer_name||'—'}</strong><div class="text-sm text-muted">#${j.id?.substring(0,8)}</div></td>
            <td>${j.location_link ? `<span class="loc-badge">📍 <a href="${j.location_link}" target="_blank" style="color:inherit" onclick="event.stopPropagation()">Map</a></span>` : j.location_text||'—'}</td>
            ${role==='scheduling'?`<td>${j.users?.name||'Unassigned'}</td>`:''}
            <td><span class="job-status ${jobStatusClass(j.status)}">${j.status||'—'}</span></td>
            ${role!=='sales'?`<td><div class="progress-bar"><div class="progress-fill" style="width:${jobProgress(j)}%"></div></div><div class="text-sm text-muted">${jobProgress(j)}%</div></td>`:''}
            ${role==='accounts'?`<td class="font-mono">₹${fmt(d.quotations.find(q=>q.job_id===j.id&&q.status==='approved')?.final_amount||0)}</td>`:''}
            <td>${fmtDate(j.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderQuotations() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.quotations.length} quotations</div>
      ${role==='manager'?`<button class="btn-submit" onclick="openModal('new-quotation')">+ Draft Quotation</button>`:''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job / Customer</th><th>Version</th><th>Subtotal</th>${role!=='sales'?'<th>Profit</th><th>GST</th>':''}<th>Final Amount</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${d.quotations.length === 0 ? `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No quotations yet</div></div></td></tr>` :
          d.quotations.map(q => `<tr>
            <td><strong>${q.jobs?.customer_name||'—'}</strong></td>
            <td>v${q.version||1}</td>
            <td>${role!=='sales'?'₹'+fmt(q.subtotal||0):'—'}</td>
            ${role!=='sales'?`<td>₹${fmt(q.profit_added||0)}</td><td>${q.gst||0}%</td>`:''}
            <td><strong>₹${fmt(q.final_amount||0)}</strong></td>
            <td><span class="job-status ${quoteStatusClass(q.status)}">${q.status||'—'}</span></td>
            <td>
              ${role==='scheduling'&&q.status==='draft'?`<button class="btn-sm btn-approve" onclick="finalizeQuotation('${q.id}')">Finalize</button>`:''}
              ${q.document_url&&(q.status==='approved'||q.status==='sent')?`<a href="${q.document_url}" target="_blank"><button class="btn-sm btn-verify">PDF</button></a>`:''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderPayments() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.payments.length} payments</div>
      ${role==='sales'?`<button class="btn-submit" onclick="openModal('upload-payment')">↑ Upload Proof</button>`:''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Type</th><th>Amount</th><th>Status</th><th>Uploaded</th>${role==='accounts'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${d.payments.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">↑</div><div class="empty-text">No payments yet</div></div></td></tr>` :
          d.payments.map(p => `<tr>
            <td>${p.jobs?.customer_name||p.job_id?.substring(0,8)||'—'}</td>
            <td><span class="pay-type ${p.type==='advance'?'pay-adv':'pay-fin'}">${p.type||'—'}</span></td>
            <td><strong style="font-family:'DM Mono',monospace">₹${fmt(p.amount||0)}</strong></td>
            <td><span class="job-status ${payStatusClass(p.status)}">${p.status||'—'}</span></td>
            <td>${fmtDate(p.created_at)}</td>
            ${role==='accounts'&&p.status==='pending'?`<td><button class="btn-sm btn-verify" onclick="verifyPayment('${p.id}','verified')">Verify</button> <button class="btn-sm btn-reject" onclick="verifyPayment('${p.id}','rejected')">Reject</button></td>`:role==='accounts'?`<td>—</td>`:''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderPaymentHistory() { return renderPayments(); }

function renderExpenses() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.expenses.length} expenses</div>
      ${role==='manager'?`<button class="btn-submit" onclick="openModal('new-expense')">+ Add Expense</button>`:''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th>${role==='accounts'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${d.expenses.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No expenses yet</div></div></td></tr>` :
          d.expenses.map(e => `<tr>
            <td>${e.jobs?.customer_name||'—'}</td>
            <td>${e.description||'—'}</td>
            <td><strong style="font-family:'DM Mono',monospace">₹${fmt(e.total_amount||0)}</strong></td>
            <td><span class="exp-status ${e.status==='approved'?'exp-appr':e.status==='rejected'?'exp-rej':'exp-pend'}">${e.status||'pending'}</span></td>
            <td>${fmtDate(e.created_at)}</td>
            ${role==='accounts'&&e.status==='pending'?`<td><button class="btn-sm btn-approve" onclick="approveExpense('${e.id}','approved')">Approve</button> <button class="btn-sm btn-reject" onclick="approveExpense('${e.id}','rejected')">Reject</button></td>`:role==='accounts'?`<td>—</td>`:''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdvances() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.advances.length} requests</div>
      ${role==='scheduling'?`<button class="btn-submit" onclick="openModal('new-advance')">+ New Advance Request</button>`:''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Material</th><th>Labour</th><th>Other</th><th>Total</th><th>Approved</th><th>Released</th><th>Status</th>${role==='accounts'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${d.advances.length === 0 ? `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">◑</div><div class="empty-text">No advance requests</div></div></td></tr>` :
          d.advances.map(a => `<tr>
            <td>${a.jobs?.customer_name||'—'}</td>
            <td>₹${fmt(a.material_amount||0)}</td>
            <td>₹${fmt(a.labour_amount||0)}</td>
            <td>₹${fmt(a.other_amount||0)}</td>
            <td><strong>₹${fmt(a.total_amount||0)}</strong></td>
            <td>₹${fmt(a.approved_amount||0)}</td>
            <td>₹${fmt(a.released_amount||0)}</td>
            <td><span class="job-status ${advStatusClass(a.status)}">${a.status||'pending'}</span></td>
            ${role==='accounts'&&a.status==='pending'?`<td><button class="btn-sm btn-approve" onclick="approveAdvance('${a.id}','approved')">Approve</button> <button class="btn-sm btn-reject" onclick="approveAdvance('${a.id}','rejected')">Reject</button></td>`:
              role==='accounts'&&a.status==='approved'?`<td><button class="btn-sm btn-verify" onclick="releaseAdvanceFunds('${a.id}')">Release</button></td>`:
              role==='accounts'?`<td>—</td>`:''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderFundReleases() {
  const d = STATE.data;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.fundReleases.length} releases</div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Amount</th><th>Method</th><th>Note</th><th>Date</th></tr></thead>
        <tbody>
        ${d.fundReleases.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">→</div><div class="empty-text">No fund releases yet</div></div></td></tr>` :
          d.fundReleases.map(r => `<tr>
            <td>${r.job_id?.substring(0,8)||'—'}</td>
            <td><strong style="font-family:'DM Mono',monospace">₹${fmt(r.amount||0)}</strong></td>
            <td><span class="exp-cat exp-mat">${r.release_method||'—'}</span></td>
            <td>${r.note||'—'}</td>
            <td>${fmtDate(r.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderRework() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.reworkRequests.length} requests</div>
      ${role==='sales'?`<button class="btn-submit" onclick="openModal('new-rework')">+ Request Rework</button>`:''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Reason</th><th>Status</th><th>Requested</th>${role==='scheduling'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${d.reworkRequests.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">↩</div><div class="empty-text">No rework requests</div></div></td></tr>` :
          d.reworkRequests.map(r => `<tr>
            <td>${r.jobs?.customer_name||'—'}</td>
            <td>${r.reason||'—'}</td>
            <td><span class="job-status ${reworkStatusClass(r.status)}">${r.status||'pending'}</span></td>
            <td>${fmtDate(r.created_at)}</td>
            ${role==='scheduling'&&r.status==='pending'?`<td><button class="btn-sm btn-approve" onclick="approveRework('${r.id}','approved')">Approve</button> <button class="btn-sm btn-reject" onclick="approveRework('${r.id}','rejected')">Reject</button></td>`:role==='scheduling'?'<td>—</td>':''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderSiteVisits() {
  const d = STATE.data;
  const role = STATE.role;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="text-muted text-sm">${d.siteVisits.length} visits</div>
      ${role==='scheduling'?`<button class="btn-submit" onclick="openModal('schedule-visit')">+ Schedule Visit</button>`:''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Scheduled Date</th><th>Status</th><th>Previous Date</th><th>Reschedule Reason</th>${role!=='sales'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${d.siteVisits.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">◷</div><div class="empty-text">No site visits scheduled</div></div></td></tr>` :
          d.siteVisits.map(v => `<tr>
            <td>${v.jobs?.customer_name||'—'}</td>
            <td>${fmtDateTime(v.scheduled_date)}</td>
            <td><span class="job-status ${visitStatusClass(v.status)}">${v.status||'—'}</span></td>
            <td>${v.previous_date?fmtDateTime(v.previous_date):'—'}</td>
            <td>${v.reschedule_reason||'—'}</td>
            ${role!=='sales'?`<td>
              ${v.status==='scheduled'?`<button class="btn-sm btn-verify" onclick="rescheduleVisit('${v.id}')">Reschedule</button>
              <button class="btn-sm btn-approve" onclick="completeVisit('${v.id}')">Complete</button>`:'—'}
            </td>`:''}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderDailyPlans() {
  const d = STATE.data;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div></div>
      <button class="btn-submit" onclick="openModal('daily-plan')">+ Add Daily Plan</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Planned Tasks</th><th>Expected Progress</th><th>Labor Required</th><th>Expected Expense</th></tr></thead>
        <tbody>
        ${d.dailyPlans.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">◷</div><div class="empty-text">No plans yet</div></div></td></tr>` :
          d.dailyPlans.map(p => `<tr>
            <td>${p.date||'—'}</td>
            <td>${p.planned_tasks||'—'}</td>
            <td>${p.expected_progress||'—'}</td>
            <td>${p.required_labor||0} workers</td>
            <td>₹${fmt(p.expected_expense||0)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderDailyReports() {
  const d = STATE.data;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div></div>
      <button class="btn-submit" onclick="openModal('daily-report')">+ Submit Report</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Tasks Done</th><th>Progress</th><th>Labor Used</th><th>Actual Expense</th><th>Issues</th></tr></thead>
        <tbody>
        ${d.dailyReports.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No reports yet</div></div></td></tr>` :
          d.dailyReports.map(r => `<tr>
            <td>${r.date||'—'}</td>
            <td>${r.actual_tasks||'—'}</td>
            <td>${r.progress_done||'—'}</td>
            <td>${r.labor_used||0} workers</td>
            <td>₹${fmt(r.actual_expense||0)}</td>
            <td style="color:var(--red-700)">${r.issues||'None'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdvanceBalance() {
  const d = STATE.data;
  const totalReleased = d.advances.filter(a=>a.status==='released').reduce((s,a)=>s+(a.released_amount||0),0);
  const totalSpent = d.expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
  const balance = totalReleased - totalSpent;
  return `
    <div class="stats-grid">
      ${statCard('Total Released', '₹'+fmt(totalReleased), '#1976D2', 'badge-info', 'By accounts')}
      ${statCard('Total Spent', '₹'+fmt(totalSpent), '#EF5350', 'badge-warn', 'Approved expenses')}
      ${statCard('Remaining', '₹'+fmt(balance), balance>=0?'#15803D':'#EF5350', balance>=0?'badge-up':'badge-danger', balance>=0?'Available':'Over budget')}
    </div>
    ${renderAdvances()}`;
}

function renderDelayedJobs() {
  const d = STATE.data;
  const delayed = d.jobs.filter(j => j.status === 'delayed');
  return `<div class="card"><div class="card-header"><span class="card-title">Delayed Jobs (${delayed.length})</span></div>${jobsList(delayed, 'scheduling')}</div>`;
}

function renderFinalReports() {
  const d = STATE.data;
  const completedJobs = d.jobs.filter(j => j.status === 'completed');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Quoted</th><th>Actual Expenses</th><th>Profit</th><th>Days</th></tr></thead>
        <tbody>
        ${completedJobs.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No completed jobs yet</div></div></td></tr>` :
          completedJobs.map(j => {
            const q = d.quotations.find(q=>q.job_id===j.id&&q.status==='approved');
            const jobExp = d.expenses.filter(e=>e.job_id===j.id&&e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
            const profit = (q?.final_amount||0) - jobExp;
            return `<tr>
              <td><strong>${j.customer_name}</strong></td>
              <td>₹${fmt(q?.final_amount||0)}</td>
              <td>₹${fmt(jobExp)}</td>
              <td style="color:${profit>=0?'var(--green-700)':'var(--red-700)'}"><strong>₹${fmt(profit)}</strong></td>
              <td>${d.dailyReports.filter(r=>r.job_id===j.id).length} days</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderProfitOverview() {
  const d = STATE.data;
  const jobs = d.jobs;
  return `
    <div class="stats-grid">
      ${statCard('Total Jobs', jobs.length, '#1976D2', 'badge-info', 'All time')}
      ${statCard('Completed', jobs.filter(j=>j.status==='completed').length, '#15803D', 'badge-up', 'Finished')}
      ${statCard('Gross Profit', '₹'+fmt(d.quotations.filter(q=>q.status==='approved').reduce((s,q)=>s+(q.final_amount||0),0) - d.expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0)), '#0D47A1', 'badge-up', 'Estimated')}
    </div>
    ${renderFinalReports()}`;
}

function renderJobFinancials() {
  const d = STATE.data;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Job</th><th>Quoted</th><th>Adv. Approved</th><th>Adv. Released</th><th>Expenses</th><th>Balance</th><th>Payments In</th></tr></thead>
        <tbody>
        ${d.jobs.map(j => {
          const q = d.quotations.find(q=>q.job_id===j.id&&(q.status==='approved'||q.status==='sent'));
          const adv = d.advances.filter(a=>a.job_id===j.id);
          const advAppr = adv.filter(a=>a.status!=='rejected').reduce((s,a)=>s+(a.approved_amount||a.total_amount||0),0);
          const advRel = adv.reduce((s,a)=>s+(a.released_amount||0),0);
          const exp = d.expenses.filter(e=>e.job_id===j.id&&e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
          const payin = d.payments.filter(p=>p.job_id===j.id&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
          const balance = advRel - exp;
          return `<tr>
            <td><strong>${j.customer_name||'—'}</strong></td>
            <td>₹${fmt(q?.final_amount||0)}</td>
            <td>₹${fmt(advAppr)}</td>
            <td>₹${fmt(advRel)}</td>
            <td>₹${fmt(exp)}</td>
            <td style="color:${balance>=0?'var(--green-700)':'var(--red-700)'}">₹${fmt(balance)}</td>
            <td>₹${fmt(payin)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── COMPONENT HELPERS ───────────────────────────────────────────
function statCard(label, value, accentColor, badgeClass, badgeText) {
  return `<div class="stat-card">
    <div class="stat-accent" style="background:${accentColor}"></div>
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <span class="stat-badge ${badgeClass}">${badgeText}</span>
  </div>`;
}

function jobsList(jobs, role) {
  if (!jobs || jobs.length === 0) return `<div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No jobs</div></div>`;
  return jobs.map(j => `
    <div class="job-item" onclick="openJobDetail('${j.id}')">
      <div class="job-dot" style="background:${dotColor(j.status)}"></div>
      <div class="job-info">
        <div class="job-name">${j.customer_name||'—'}</div>
        <div class="job-meta">${j.location_text||'No location'} · #${j.id?.substring(0,8)}</div>
      </div>
      <span class="job-status ${jobStatusClass(j.status)}">${j.status||'—'}</span>
    </div>`).join('');
}

function jobsWithProgress(jobs) {
  if (!jobs || jobs.length === 0) return `<div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No jobs assigned</div></div>`;
  return jobs.map(j => {
    const prog = jobProgress(j);
    return `<div class="job-item" onclick="openJobDetail('${j.id}')">
      <div class="job-dot" style="background:${dotColor(j.status)}"></div>
      <div class="job-info">
        <div class="job-name">${j.customer_name||'—'}</div>
        <div class="job-meta">${j.location_text||'No location'}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${prog}%"></div></div>
        <div class="text-sm text-muted">${prog}% complete</div>
      </div>
      <span class="job-status ${jobStatusClass(j.status)}">${j.status||'—'}</span>
    </div>`;
  }).join('');
}

function leadsList(leads) {
  if (!leads || leads.length === 0) return `<div class="empty-state"><div class="empty-icon">●</div><div class="empty-text">No leads</div></div>`;
  return leads.map(l => `
    <div class="job-item">
      <div class="job-dot" style="background:${dotColor(l.status)}"></div>
      <div class="job-info">
        <div class="job-name">${l.customer_name||'—'}</div>
        <div class="job-meta">${l.location_text||'No location'}</div>
      </div>
      <span class="job-status ${leadStatusClass(l.status)}">${l.status||'—'}</span>
    </div>`).join('');
}

function statusTimeline(job) {
  const steps = [
    { label: 'Lead Created', sub: 'Initial enquiry captured', state: 'done' },
    { label: 'Converted to Job', sub: 'Job created in system', state: job ? 'done' : 'pending' },
    { label: 'Site Visit', sub: 'Manager visits site', state: job ? 'done' : 'pending' },
    { label: 'Quotation Sent', sub: 'Customer receives quote', state: 'active' },
    { label: 'Payment Received', sub: 'Advance payment', state: 'pending' },
    { label: 'Execution', sub: 'Work in progress', state: 'pending' },
    { label: 'Completed', sub: 'Job closed', state: 'pending' }
  ];
  return `<div class="timeline">${steps.map((s,i) => `
    <div class="tl-item tl-${s.state}">
      <div class="tl-track">
        <div class="tl-dot"></div>
        ${i < steps.length-1 ? '<div class="tl-line"></div>' : ''}
      </div>
      <div class="tl-content">
        <div class="tl-label">${s.label}</div>
        <div class="tl-sub">${s.sub}</div>
      </div>
    </div>`).join('')}</div>`;
}

function siteVisitMini(visits) {
  if (!visits || visits.length === 0) return `<div class="text-sm text-muted">No upcoming visits</div>`;
  return visits.map(v => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-100)">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--blue-600)"></div>
      <div style="flex:1"><div class="text-sm">${v.jobs?.customer_name||'—'}</div><div class="text-sm text-muted">${fmtDateTime(v.scheduled_date)}</div></div>
      <span class="job-status status-review">${v.status}</span>
    </div>`).join('');
}

function reworkList(items, role) {
  if (!items || items.length === 0) return `<div class="empty-state"><div class="empty-icon">↩</div><div class="empty-text">No pending rework</div></div>`;
  return items.map(r => `
    <div class="rework-item">
      <div class="rework-info">
        <div class="rework-name">${r.jobs?.customer_name||'—'}</div>
        <div class="rework-reason">${r.reason||'No reason given'}</div>
      </div>
      <div class="rework-actions">
        <span class="job-status ${reworkStatusClass(r.status)}">${r.status}</span>
        ${role==='scheduling'&&r.status==='pending'?`<button class="btn-sm btn-approve" onclick="approveRework('${r.id}','approved')">Approve</button>`:''}
      </div>
    </div>`).join('');
}

function advanceMini(items) {
  if (!items || items.length === 0) return `<div class="card-body"><div class="text-sm text-muted">No pending advances</div></div>`;
  return `<div>${items.map(a => `
    <div class="payment-row">
      <div class="pay-info">
        <div class="pay-name">${a.jobs?.customer_name||'—'}</div>
        <div class="pay-sub">Total: ₹${fmt(a.total_amount||0)}</div>
      </div>
      <span class="job-status status-pending">${a.status}</span>
    </div>`).join('')}</div>`;
}

function paymentVerifyList(payments) {
  if (!payments || payments.length === 0) return `<div class="empty-state"><div class="empty-icon">↑</div><div class="empty-text">No pending payments</div></div>`;
  return payments.map(p => `
    <div class="payment-row" style="padding:12px 20px">
      <span class="pay-type ${p.type==='advance'?'pay-adv':'pay-fin'}">${p.type||'—'}</span>
      <div class="pay-info">
        <div class="pay-name">${p.jobs?.customer_name||'—'}</div>
        <div class="pay-sub">${fmtDate(p.created_at)}</div>
      </div>
      <span class="pay-amount">₹${fmt(p.amount||0)}</span>
      <button class="btn-sm btn-verify" onclick="verifyPayment('${p.id}','verified')">Verify</button>
      <button class="btn-sm btn-reject" onclick="verifyPayment('${p.id}','rejected')" style="margin-left:4px">Reject</button>
    </div>`).join('');
}

function advanceApproveList(items) {
  if (!items || items.length === 0) return `<div class="empty-state"><div class="empty-icon">◑</div><div class="empty-text">No pending advances</div></div>`;
  return items.map(a => `
    <div class="payment-row" style="padding:12px 20px">
      <div class="pay-info">
        <div class="pay-name">${a.jobs?.customer_name||'—'}</div>
        <div class="pay-sub">Mat: ₹${fmt(a.material_amount||0)} · Lab: ₹${fmt(a.labour_amount||0)} · Other: ₹${fmt(a.other_amount||0)}</div>
      </div>
      <span class="pay-amount">₹${fmt(a.total_amount||0)}</span>
      <button class="btn-sm btn-approve" onclick="approveAdvance('${a.id}','approved')">Approve</button>
    </div>`).join('');
}

function expenseApproveList(items) {
  if (!items || items.length === 0) return `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No pending expenses</div></div>`;
  return items.map(e => `
    <div class="expense-item" style="padding:10px 20px">
      <div class="exp-name">${e.description||'—'}</div>
      <span class="exp-amt">₹${fmt(e.total_amount||0)}</span>
      <button class="btn-sm btn-approve" onclick="approveExpense('${e.id}','approved')">Approve</button>
      <button class="btn-sm btn-reject" onclick="approveExpense('${e.id}','rejected')" style="margin-left:4px">Reject</button>
    </div>`).join('');
}

function expensesList(items) {
  if (!items || items.length === 0) return `<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No expenses</div></div>`;
  return items.map(e => `
    <div class="expense-item" style="padding:10px 16px">
      <div class="exp-name">${e.description||'—'}</div>
      <span class="exp-amt">₹${fmt(e.total_amount||0)}</span>
      <span class="exp-status ${e.status==='approved'?'exp-appr':e.status==='rejected'?'exp-rej':'exp-pend'}">${e.status||'pending'}</span>
    </div>`).join('');
}

// ─── JOB DETAIL MODAL ────────────────────────────────────────────
function openJobDetail(jobId) {
  const job = STATE.data.jobs.find(j => j.id === jobId);
  if (!job) return;
  const role = STATE.role;
  const quote = STATE.data.quotations.find(q => q.job_id === jobId && (q.status === 'approved' || q.status === 'sent'));
  const payments = STATE.data.payments.filter(p => p.job_id === jobId);
  const expenses = STATE.data.expenses.filter(e => e.job_id === jobId);
  const visit = STATE.data.siteVisits.find(v => v.job_id === jobId);

  const payIn = payments.filter(p=>p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
  const totalExp = expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);

  document.getElementById('modal-title').textContent = `Job: ${job.customer_name}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div class="form-label">Customer</div><div>${job.customer_name||'—'}</div></div>
      <div><div class="form-label">Phone</div><div>${job.customer_phone||'—'}</div></div>
      <div><div class="form-label">Location</div><div>${job.location_link?`<a href="${job.location_link}" target="_blank" class="loc-badge">📍 Open Map</a>`:job.location_text||'—'}</div></div>
      <div><div class="form-label">Status</div><span class="job-status ${jobStatusClass(job.status)}">${job.status||'—'}</span></div>
      <div style="grid-column:1/-1"><div class="form-label">Description</div><div>${job.description||'—'}</div></div>
    </div>
    ${visit?`<div style="background:var(--blue-50);border:1px solid var(--blue-100);border-radius:var(--radius-md);padding:12px;margin-bottom:14px">
      <div class="text-sm" style="color:var(--blue-800);font-weight:500">Site Visit: ${fmtDateTime(visit.scheduled_date)} · <span class="job-status ${visitStatusClass(visit.status)}">${visit.status}</span></div>
      ${visit.reschedule_reason?`<div class="text-sm text-muted mt-4">Rescheduled: ${visit.reschedule_reason}</div>`:''}
    </div>`:''}
    ${role!=='sales'?`<div style="margin-bottom:14px">
      <div class="form-label" style="margin-bottom:8px">Financial Summary</div>
      <div class="finance-grid">
        <div class="finance-box"><div class="finance-label">Quoted</div><div class="finance-val fv-blue">₹${fmt(quote?.final_amount||0)}</div></div>
        <div class="finance-box"><div class="finance-label">Collected</div><div class="finance-val fv-green">₹${fmt(payIn)}</div></div>
        <div class="finance-box"><div class="finance-label">Expenses</div><div class="finance-val fv-red">₹${fmt(totalExp)}</div></div>
        <div class="finance-box"><div class="finance-label">Profit est.</div><div class="finance-val fv-green">₹${fmt((quote?.final_amount||0)-totalExp)}</div></div>
      </div>
    </div>`:`<div style="margin-bottom:14px">
      <div class="form-label" style="margin-bottom:8px">Quotation</div>
      <div style="background:var(--gray-50);padding:12px;border-radius:var(--radius-md)">
        Final Amount: <strong>₹${fmt(quote?.final_amount||0)}</strong> · Status: <span class="job-status ${quoteStatusClass(quote?.status)}">${quote?.status||'Not quoted'}</span>
      </div>
    </div>`}
    ${payments.length>0?`<div><div class="form-label" style="margin-bottom:8px">Payments</div>${payments.map(p=>`<div class="payment-row"><span class="pay-type ${p.type==='advance'?'pay-adv':'pay-fin'}">${p.type}</span><span class="pay-amount">₹${fmt(p.amount||0)}</span><span class="job-status ${payStatusClass(p.status)}">${p.status}</span></div>`).join('')}</div>`:''}`;
  openModalRaw();
}

// ─── MODALS ──────────────────────────────────────────────────────
function openModal(type) {
  const configs = {
    'new-lead': { title: 'New Sales Lead', body: newLeadForm() },
    'upload-payment': { title: 'Upload Payment Proof', body: uploadPaymentForm() },
    'new-expense': { title: 'Add Expense', body: newExpenseForm() },
    'new-advance': { title: 'New Advance Request', body: newAdvanceForm() },
    'new-rework': { title: 'Request Rework', body: newReworkForm() },
    'schedule-visit': { title: 'Schedule Site Visit', body: scheduleVisitForm() },
    'daily-plan': { title: 'Add Daily Plan', body: dailyPlanForm() },
    'daily-report': { title: 'Submit Daily Report', body: dailyReportForm() },
    'new-quotation': { title: 'Create Draft Quotation', body: newQuotationForm() },
    'assign-manager': { title: 'Assign Manager to Job', body: assignManagerForm() },
    'release-funds': { title: 'Release Funds', body: releaseFundsForm() }
  };
  const cfg = configs[type];
  if (!cfg) return;
  document.getElementById('modal-title').textContent = cfg.title;
  document.getElementById('modal-body').innerHTML = cfg.body;
  openModalRaw();
}

function openModalRaw() { document.getElementById('modal-backdrop').classList.add('open'); }
function closeModal() { document.getElementById('modal-backdrop').classList.remove('open'); }
function closeModalOnBackdrop(e) { if (e.target === document.getElementById('modal-backdrop')) closeModal(); }

function jobOptions() {
  return STATE.data.jobs.map(j => `<option value="${j.id}">${j.customer_name} (#${j.id.substring(0,8)})</option>`).join('');
}

function newLeadForm() {
  return `<div class="form-row"><div class="form-group"><label class="form-label">Customer Name</label><input class="form-input" id="f-cname" placeholder="Full name"/></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="f-cphone" placeholder="+91..."/></div></div>
    <div class="form-row-single form-group"><label class="form-label">Location Text</label><input class="form-input" id="f-loctext" placeholder="Near temple, Kollam"/></div>
    <div class="form-row-single form-group"><label class="form-label">Google Maps Link</label><input class="form-input" id="f-loclink" placeholder="https://maps.google.com/..."/></div>
    <div class="form-row-single form-group"><label class="form-label">Requirement Summary</label><textarea class="form-textarea" id="f-req" placeholder="Describe what the customer needs..."></textarea></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitNewLead()">Create Lead</button></div>`;
}

async function submitNewLead() {
  const name = document.getElementById('f-cname').value.trim();
  const phone = document.getElementById('f-cphone').value.trim();
  const locText = document.getElementById('f-loctext').value.trim();
  const locLink = document.getElementById('f-loclink').value.trim();
  const req = document.getElementById('f-req').value.trim();
  if (!name) { showToast('Customer name is required', 'error'); return; }
  if (!locText && !locLink) { showToast('At least one location field is required', 'error'); return; }
  const { error } = await sb.from('sales_leads').insert({
    customer_name: name, customer_phone: phone,
    location_text: locText, location_link: locLink,
    requirement_summary: req, status: 'new',
    assigned_to: STATE.profile?.id
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Lead created!', 'success');
  closeModal(); loadAllData();
}

function uploadPaymentForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-pjob">${jobOptions()}</select></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Payment Type</label><select class="form-select" id="f-ptype"><option value="advance">Advance</option><option value="final">Final</option></select></div>
    <div class="form-group"><label class="form-label">Amount (₹)</label><input class="form-input" id="f-pamount" type="number" placeholder="0"/></div></div>
    <div class="form-row-single form-group"><label class="form-label">Proof URL / Reference</label><input class="form-input" id="f-pproof" placeholder="Screenshot URL or reference number"/></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitPayment()">Upload</button></div>`;
}

async function submitPayment() {
  const jobId = document.getElementById('f-pjob').value;
  const type = document.getElementById('f-ptype').value;
  const amount = parseFloat(document.getElementById('f-pamount').value);
  const proof = document.getElementById('f-pproof').value.trim();
  if (!amount || amount <= 0) { showToast('Enter valid amount', 'error'); return; }
  const { error } = await sb.from('payments').insert({
    job_id: jobId, type, amount, proof_url: proof,
    uploaded_by: STATE.profile?.id, status: 'pending'
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Payment proof uploaded!', 'success');
  closeModal(); loadAllData();
}

function newExpenseForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-ejob">${jobOptions()}</select></div>
    <div class="form-row-single form-group"><label class="form-label">Description</label><input class="form-input" id="f-edesc" placeholder="Cement, sand, labour etc."/></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Total Amount (₹)</label><input class="form-input" id="f-eamt" type="number" placeholder="0"/></div>
    <div class="form-group"><label class="form-label">Proof URL</label><input class="form-input" id="f-eproof" placeholder="Bill photo URL"/></div></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitExpense()">Add Expense</button></div>`;
}

async function submitExpense() {
  const jobId = document.getElementById('f-ejob').value;
  const desc = document.getElementById('f-edesc').value.trim();
  const amt = parseFloat(document.getElementById('f-eamt').value);
  const proof = document.getElementById('f-eproof').value.trim();
  if (!desc || !amt) { showToast('Fill all required fields', 'error'); return; }
  const { error } = await sb.from('expenses').insert({
    job_id: jobId, description: desc, total_amount: amt,
    proof_url: proof, added_by: STATE.profile?.id, status: 'pending'
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Expense added!', 'success');
  closeModal(); loadAllData();
}

function newAdvanceForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-ajob">${jobOptions()}</select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Material Amount (₹)</label><input class="form-input" id="f-amat" type="number" placeholder="0" oninput="calcAdvTotal()"/></div>
      <div class="form-group"><label class="form-label">Labour Amount (₹)</label><input class="form-input" id="f-alab" type="number" placeholder="0" oninput="calcAdvTotal()"/></div>
    </div>
    <div class="form-row"><div class="form-group"><label class="form-label">Other Amount (₹)</label><input class="form-input" id="f-aoth" type="number" placeholder="0" oninput="calcAdvTotal()"/></div>
    <div class="form-group"><label class="form-label">Total (₹)</label><input class="form-input" id="f-atotal" type="number" placeholder="0" readonly style="background:var(--gray-50)"/></div></div>
    <div class="form-row-single form-group"><label class="form-label">Note</label><textarea class="form-textarea" id="f-anote" placeholder="Additional notes..."></textarea></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitAdvance()">Submit Request</button></div>`;
}

function calcAdvTotal() {
  const mat = parseFloat(document.getElementById('f-amat').value)||0;
  const lab = parseFloat(document.getElementById('f-alab').value)||0;
  const oth = parseFloat(document.getElementById('f-aoth').value)||0;
  document.getElementById('f-atotal').value = mat+lab+oth;
}

async function submitAdvance() {
  const jobId = document.getElementById('f-ajob').value;
  const mat = parseFloat(document.getElementById('f-amat').value)||0;
  const lab = parseFloat(document.getElementById('f-alab').value)||0;
  const oth = parseFloat(document.getElementById('f-aoth').value)||0;
  const total = mat+lab+oth;
  const note = document.getElementById('f-anote').value.trim();
  if (total <= 0) { showToast('Enter at least one amount', 'error'); return; }
  const { error } = await sb.from('advance_requests').insert({
    job_id: jobId, material_amount: mat, labour_amount: lab,
    other_amount: oth, total_amount: total, note,
    requested_by: STATE.profile?.id, status: 'pending'
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Advance request submitted!', 'success');
  closeModal(); loadAllData();
}

function newReworkForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-rwjob">${jobOptions()}</select></div>
    <div class="form-row-single form-group"><label class="form-label">Reason for Rework</label><textarea class="form-textarea" id="f-rwreason" placeholder="Describe the issue that needs rework..."></textarea></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitRework()">Submit Request</button></div>`;
}

async function submitRework() {
  const jobId = document.getElementById('f-rwjob').value;
  const reason = document.getElementById('f-rwreason').value.trim();
  if (!reason) { showToast('Please provide a reason', 'error'); return; }
  const { error } = await sb.from('rework_requests').insert({
    job_id: jobId, reason, status: 'pending',
    requested_by: STATE.profile?.id
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Rework request submitted!', 'success');
  closeModal(); loadAllData();
}

function scheduleVisitForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-svjob">${jobOptions()}</select></div>
    <div class="form-row-single form-group"><label class="form-label">Scheduled Date & Time</label><input class="form-input" id="f-svdate" type="datetime-local"/></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitSiteVisit()">Schedule</button></div>`;
}

async function submitSiteVisit() {
  const jobId = document.getElementById('f-svjob').value;
  const date = document.getElementById('f-svdate').value;
  if (!date) { showToast('Select a date', 'error'); return; }
  const { error } = await sb.from('site_visits').insert({
    job_id: jobId, scheduled_date: date,
    assigned_to: STATE.profile?.id, status: 'scheduled'
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Site visit scheduled!', 'success');
  closeModal(); loadAllData();
}

function dailyPlanForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-dpjob">${jobOptions()}</select></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Date</label><input class="form-input" id="f-dpdate" type="date" value="${new Date().toISOString().split('T')[0]}"/></div>
    <div class="form-group"><label class="form-label">Required Labour (workers)</label><input class="form-input" id="f-dplabor" type="number" placeholder="0"/></div></div>
    <div class="form-row-single form-group"><label class="form-label">Planned Tasks</label><textarea class="form-textarea" id="f-dptasks" placeholder="What work is planned today..."></textarea></div>
    <div class="form-row-single form-group"><label class="form-label">Expected Progress</label><input class="form-input" id="f-dpprog" placeholder="e.g. Lay tiles in bathroom floor"/></div>
    <div class="form-row-single form-group"><label class="form-label">Expected Expense (₹)</label><input class="form-input" id="f-dpexp" type="number" placeholder="0"/></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitDailyPlan()">Save Plan</button></div>`;
}

async function submitDailyPlan() {
  const jobId = document.getElementById('f-dpjob').value;
  const date = document.getElementById('f-dpdate').value;
  const labor = parseInt(document.getElementById('f-dplabor').value)||0;
  const tasks = document.getElementById('f-dptasks').value.trim();
  const prog = document.getElementById('f-dpprog').value.trim();
  const exp = parseFloat(document.getElementById('f-dpexp').value)||0;
  if (!tasks) { showToast('Please add planned tasks', 'error'); return; }
  const { error } = await sb.from('daily_plans').insert({
    job_id: jobId, date, planned_tasks: tasks,
    expected_progress: prog, required_labor: labor,
    expected_expense: exp, created_by: STATE.profile?.id
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Daily plan saved!', 'success');
  closeModal(); loadAllData();
}

function dailyReportForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-drjob">${jobOptions()}</select></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Date</label><input class="form-input" id="f-drdate" type="date" value="${new Date().toISOString().split('T')[0]}"/></div>
    <div class="form-group"><label class="form-label">Labour Used (workers)</label><input class="form-input" id="f-drlabor" type="number" placeholder="0"/></div></div>
    <div class="form-row-single form-group"><label class="form-label">Tasks Completed</label><textarea class="form-textarea" id="f-drtasks" placeholder="What was actually done today..."></textarea></div>
    <div class="form-row-single form-group"><label class="form-label">Progress Done</label><input class="form-input" id="f-drprog" placeholder="e.g. 60% tiles complete"/></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Actual Expense (₹)</label><input class="form-input" id="f-drexp" type="number" placeholder="0"/></div>
    <div class="form-group"><label class="form-label">Issues (if any)</label><input class="form-input" id="f-drissues" placeholder="Any problems encountered"/></div></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitDailyReport()">Submit Report</button></div>`;
}

async function submitDailyReport() {
  const jobId = document.getElementById('f-drjob').value;
  const date = document.getElementById('f-drdate').value;
  const labor = parseInt(document.getElementById('f-drlabor').value)||0;
  const tasks = document.getElementById('f-drtasks').value.trim();
  const prog = document.getElementById('f-drprog').value.trim();
  const exp = parseFloat(document.getElementById('f-drexp').value)||0;
  const issues = document.getElementById('f-drissues').value.trim();
  if (!tasks) { showToast('Please add completed tasks', 'error'); return; }
  const { error } = await sb.from('daily_reports').insert({
    job_id: jobId, date, actual_tasks: tasks,
    progress_done: prog, labor_used: labor,
    actual_expense: exp, issues, created_by: STATE.profile?.id
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Daily report submitted!', 'success');
  closeModal(); loadAllData();
}

function newQuotationForm() {
  const role = STATE.role;
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-qjob">${jobOptions()}</select></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Subtotal (₹)</label><input class="form-input" id="f-qsub" type="number" placeholder="0" oninput="calcQuoteTotal()"/></div>
    ${role==='scheduling'?`<div class="form-group"><label class="form-label">Profit Added (₹)</label><input class="form-input" id="f-qprofit" type="number" placeholder="0" oninput="calcQuoteTotal()"/></div></div>
    <div class="form-row"><div class="form-group"><label class="form-label">GST (%)</label><input class="form-input" id="f-qgst" type="number" placeholder="18" oninput="calcQuoteTotal()"/></div>
    <div class="form-group"><label class="form-label">Final Amount (₹)</label><input class="form-input" id="f-qfinal" type="number" readonly style="background:var(--gray-50)"/></div></div>`
    :`<div class="form-group"><label class="form-label">Final Amount (₹)</label><input class="form-input" id="f-qfinal" type="number" placeholder="0"/></div></div>
    <div style="background:var(--amber-50);border:1px solid var(--amber-100);padding:10px 14px;border-radius:var(--radius-md);font-size:12px;color:var(--amber-700);margin-bottom:14px">Note: Profit and GST will be added by Scheduling when reviewing this quotation.</div>`}
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitQuotation()">Save Draft</button></div>`;
}

function calcQuoteTotal() {
  const sub = parseFloat(document.getElementById('f-qsub')?.value)||0;
  const profit = parseFloat(document.getElementById('f-qprofit')?.value)||0;
  const gst = parseFloat(document.getElementById('f-qgst')?.value)||0;
  const total = (sub + profit) * (1 + gst/100);
  const el = document.getElementById('f-qfinal');
  if (el) el.value = total.toFixed(0);
}

async function submitQuotation() {
  const jobId = document.getElementById('f-qjob').value;
  const sub = parseFloat(document.getElementById('f-qsub')?.value)||0;
  const profit = parseFloat(document.getElementById('f-qprofit')?.value)||0;
  const gst = parseFloat(document.getElementById('f-qgst')?.value)||0;
  const final = parseFloat(document.getElementById('f-qfinal')?.value)||0;
  const existing = STATE.data.quotations.filter(q=>q.job_id===jobId);
  const { error } = await sb.from('quotations').insert({
    job_id: jobId, version: (existing.length||0)+1,
    subtotal: sub, profit_added: profit, gst,
    final_amount: final, status: 'draft',
    created_by: STATE.profile?.id
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Quotation draft created!', 'success');
  closeModal(); loadAllData();
}

function assignManagerForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-amjob">${jobOptions()}</select></div>
    <div class="form-row-single form-group"><label class="form-label">Manager Name</label><input class="form-input" id="f-amname" placeholder="Manager name"/></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="showToast('Manager assignment requires user lookup — connect via Supabase users table','error')">Assign</button></div>`;
}

function releaseFundsForm() {
  return `<div class="form-row-single form-group"><label class="form-label">Amount to Release (₹)</label><input class="form-input" id="f-rfamt" type="number" placeholder="0"/></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Release Method</label><select class="form-select" id="f-rfmethod"><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="upi">UPI</option></select></div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="f-rfnote" placeholder="Reference/note"/></div></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="closeModal();showToast('Fund release recorded!','success')">Release Funds</button></div>`;
}

// ─── ACTIONS ─────────────────────────────────────────────────────
async function verifyPayment(id, status) {
  const { error } = await sb.from('payments').update({ status, verified_by: STATE.profile?.id, verified_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(status === 'verified' ? 'Payment verified!' : 'Payment rejected', status==='verified'?'success':'error');
  loadAllData();
}

async function approveExpense(id, status) {
  const { error } = await sb.from('expenses').update({ status, approved_by: STATE.profile?.id }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(status==='approved'?'Expense approved!':'Expense rejected', status==='approved'?'success':'error');
  loadAllData();
}

async function approveAdvance(id, status) {
  const update = { status, approved_by: STATE.profile?.id, approved_at: new Date().toISOString() };
  if (status === 'approved') {
    const adv = STATE.data.advances.find(a=>a.id===id);
    if (adv) update.approved_amount = adv.total_amount;
  }
  const { error } = await sb.from('advance_requests').update(update).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(status==='approved'?'Advance approved!':'Advance rejected', status==='approved'?'success':'error');
  loadAllData();
}

async function releaseAdvanceFunds(advId) {
  openModal('release-funds');
}

async function approveRework(id, status) {
  const { error } = await sb.from('rework_requests').update({ status, reviewed_by: STATE.profile?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(status==='approved'?'Rework approved!':'Rework rejected', status==='approved'?'success':'error');
  loadAllData();
}

async function finalizeQuotation(id) {
  const { error } = await sb.from('quotations').update({ status: 'reviewed', reviewed_by: STATE.profile?.id }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Quotation finalized!', 'success');
  loadAllData();
}

async function completeVisit(id) {
  const { error } = await sb.from('site_visits').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Site visit marked complete!', 'success');
  loadAllData();
}

async function rescheduleVisit(id) {
  const reason = prompt('Reason for rescheduling?');
  if (!reason) return;
  const newDate = prompt('New date & time (YYYY-MM-DDTHH:MM)?');
  if (!newDate) return;
  const visit = STATE.data.siteVisits.find(v=>v.id===id);
  const { error } = await sb.from('site_visits').update({
    previous_date: visit?.scheduled_date,
    scheduled_date: newDate,
    status: 'rescheduled',
    reschedule_reason: reason,
    rescheduled_by: STATE.profile?.id,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Visit rescheduled!', 'success');
  loadAllData();
}

// ─── UTILITIES ───────────────────────────────────────────────────
function fmt(n) {
  if (!n && n!==0) return '0';
  if (n >= 100000) return (n/100000).toFixed(1)+'L';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return Math.round(n).toLocaleString('en-IN');
}
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }); }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }

function dotColor(status) {
  const map = { active:'#4CAF50', completed:'#9C27B0', pending:'#FF9800', delayed:'#EF5350', rework:'#EF5350', site_visit:'#2196F3', quotation:'#1976D2', new:'#2196F3', contacted:'#FF9800', converted:'#4CAF50', lost:'#EF5350' };
  return map[status] || '#94A3B8';
}
function jobStatusClass(s) { const m={active:'status-active',completed:'status-done',pending:'status-pending',delayed:'status-rework',rework:'status-rework',site_visit:'status-review',quotation:'status-review'}; return m[s]||'status-pending'; }
function leadStatusClass(s) { const m={new:'status-review',contacted:'status-pending',site_visit_requested:'status-review',converted:'status-active',lost:'status-rework'}; return m[s]||'status-pending'; }
function quoteStatusClass(s) { const m={draft:'status-pending',reviewed:'status-review',sent:'status-review',approved:'status-active',rejected:'status-rework'}; return m[s]||'status-pending'; }
function payStatusClass(s) { const m={pending:'status-pending',verified:'status-active',rejected:'status-rework'}; return m[s]||'status-pending'; }
function advStatusClass(s) { const m={pending:'status-pending',approved:'status-review',released:'status-active',rejected:'status-rework'}; return m[s]||'status-pending'; }
function visitStatusClass(s) { const m={scheduled:'status-review',completed:'status-active',rescheduled:'status-pending'}; return m[s]||'status-pending'; }
function reworkStatusClass(s) { const m={pending:'status-pending',approved:'status-active',rejected:'status-rework',completed:'status-done'}; return m[s]||'status-pending'; }
function jobProgress(j) {
  const statMap = { new:0, site_visit:10, quotation:25, pending:30, active:60, rework:70, completed:100, delayed:50 };
  return statMap[j?.status] || 0;
}

function showToast(msg, type = '') {
  const tc = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type==='success'?'✓':type==='error'?'✗':'ℹ';
  t.innerHTML = `<span>${icon}</span> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(), 300); }, 3200);
}
