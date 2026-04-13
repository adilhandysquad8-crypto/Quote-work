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
  const newLeads = d.leads.filter(l => l.status === 'site_visit_requested' || l.status === 'new').length;

  return `
    <div class="stats-grid">
      ${statCard('Active Jobs', activeJobs, '#1976D2', 'badge-info', 'Ongoing')}
      ${statCard('Delayed Jobs', delayed, '#EF5350', delayed>0?'badge-danger':'badge-up', delayed>0?'Urgent':'All on track')}
      ${statCard('Site Visits', pendingVisits, '#0D47A1', pendingVisits>0?'badge-warn':'badge-up', pendingVisits>0?'Needs scheduling':'Clear')}
      ${statCard('New Leads', newLeads, '#F59E0B', newLeads>0?'badge-warn':'badge-up', newLeads>0?'Awaiting visit':'All handled')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">Incoming Site Visits</span><span class="card-link" onclick="renderPage('site-visits')">View all</span></div>
        ${siteVisitMiniScheduling(d.siteVisits.filter(v => v.status === 'scheduled').slice(0, 5))}
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
            <div class="card-title" style="margin-bottom:10px">New Leads Needing Visit</div>
            ${newLeadsNeedingVisit(d.leads.filter(l=>l.status==='site_visit_requested'||l.status==='new').slice(0,3))}
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

