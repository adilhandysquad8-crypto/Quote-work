// ─── DATA LOADING ───────────────────────────────────────────────
async function loadAllData() {
  try {
    const uid = STATE.profile?.id;
    const role = STATE.role;

    const [leads, jobs, quotations, payments, expenses, advances, releases, plans, reports, reworks, visits, allUsers] = await Promise.all([
      sb.from('sales_leads').select('*').order('created_at', { ascending: false }),
      role === 'manager' && uid
        ? sb.from('jobs').select('*, users!jobs_assigned_manager_id_fkey(name)').eq('assigned_manager_id', uid).order('created_at', { ascending: false })
        : sb.from('jobs').select('*, users!jobs_assigned_manager_id_fkey(name)').order('created_at', { ascending: false }),
      sb.from('quotations').select('*, jobs(customer_name), quotation_items(*)').order('created_at', { ascending: false }),
      sb.from('payments').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('expenses').select('*, expense_items(*), jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('advance_requests').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('fund_releases').select('*').order('created_at', { ascending: false }),
      sb.from('daily_plans').select('*').order('date', { ascending: false }),
      sb.from('daily_reports').select('*').order('date', { ascending: false }),
      sb.from('rework_requests').select('*, jobs(customer_name)').order('created_at', { ascending: false }),
      sb.from('site_visits').select('*, jobs(customer_name)').order('scheduled_date', { ascending: true }),
      sb.from('users').select('*').order('name', { ascending: true })
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
    STATE.data.allUsers      = allUsers.data || [];

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
  closeSidebar();
  updateBottomNav(pageId);
}

