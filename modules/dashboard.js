// ─── DASHBOARD ───────────────────────────────────────────────────
function renderDashboard() {
  const role = STATE.role;
  if (role === 'sales')       return renderSalesDashboard();
  if (role === 'scheduling')  return renderSchedulingDashboard();
  if (role === 'manager')     return renderManagerDashboard();
  if (role === 'accounts')    return renderAccountsDashboard();
  return renderSalesDashboard();
}

// Helper to prevent XSS (optional but safe)
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function renderSalesDashboard() {
  const d = STATE.data;
  const myLeads = d.leads.filter(l => l.assigned_to === STATE.profile?.id);
  
  // FIX: Use Map to avoid duplicate jobs
  const myJobsMap = new Map();
  d.jobs.forEach(j => {
    if (j.created_by === STATE.profile?.id) myJobsMap.set(j.id, j);
    else {
      const lead = d.leads.find(l => l.id === j.lead_id);
      if (lead?.assigned_to === STATE.profile?.id) myJobsMap.set(j.id, j);
    }
  });
  const myJobs = Array.from(myJobsMap.values());
  const activeJobs = myJobs.filter(j => j.status !== 'completed');
  const doneJobs   = myJobs.filter(j => j.status === 'completed');
  const pendingPay = d.payments.filter(p => p.status === 'pending' && myJobs.some(j=>j.id===p.job_id)).length;
  const quoteSent  = d.quotations.filter(q => (q.status==='sent'||q.status==='approved') && myJobs.some(j=>j.id===q.job_id)).length;

  return `
    <div class="stats-grid">
      ${statCard('My Leads', myLeads.length, '#2196F3', 'badge-info', myLeads.filter(l=>l.status==='new').length+' new')}
      ${statCard('Active Jobs', activeJobs.length, '#1565C0', 'badge-info', 'In progress')}
      ${statCard('Quotations Sent', quoteSent, '#42A5F5', quoteSent>0?'badge-info':'badge-up', 'This month')}
      ${statCard('Pending Payments', pendingPay, '#EF5350', pendingPay>0?'badge-danger':'badge-up', pendingPay>0?'Awaiting verify':'All clear')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">My Active Jobs</span>
        <span class="card-link" onclick="renderPage('jobs')">View all</span>
      </div>
      ${activeJobs.length === 0
        ? `<div class="card-body"><div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No active jobs yet. Create a lead to get started.</div></div></div>`
        : `<div>${activeJobs.map(j => {
            const allVisits = d.siteVisits.filter(v=>v.job_id===j.id);
            const latestScheduled = allVisits.filter(v=>v.status==='scheduled')
              .sort((a,b)=>new Date(b.scheduled_date)-new Date(a.scheduled_date))[0];
            const visit = latestScheduled || allVisits.find(v=>v.status==='completed');
            const quote = d.quotations.filter(q=>q.job_id===j.id&&q.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
            const payments = d.payments.filter(p=>p.job_id===j.id);
            const advPay   = payments.filter(p=>p.type==='advance'&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
            const finPay   = payments.filter(p=>p.type==='final'&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
            return `
            <div key="job-${j.id}" style="border-bottom:1px solid var(--gray-100);padding:14px 16px" onclick="openJobDetail('${j.id}')" style="cursor:pointer">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px">
                <div>
                  <div style="font-weight:600;font-size:14px">${escapeHtml(j.customer_name||'—')}</div>
                  <div style="font-size:12px;color:var(--gray-500)">${escapeHtml(j.location_text||'')} ${j.location_link?`<a href="${j.location_link}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-600)">📍 Map</a>`:''}</div>
                </div>
                <span class="job-status ${jobStatusClass(j.status)}">${(j.status||'').replace(/_/g,' ')}</span>
              </div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                ${[
                  {label:'Site Visit', done: visit?.status==='completed', active: visit?.status==='scheduled', info: visit?fmtDate(visit.scheduled_date):'Not scheduled'},
                  {label:'Quotation', done: quote?.status==='approved', active: quote?.status==='sent'||quote?.status==='reviewed', info: quote?`₹${fmt(quote.final_amount||0)}`:'Pending'},
                  {label:'Advance Paid', done: advPay>0, active: false, info: advPay>0?`₹${fmt(advPay)}`:'Not yet'},
                  {label:'Work Done', done: j.status==='completed', active: j.status==='active', info: ''},
                  {label:'Final Payment', done: finPay>0, active: false, info: finPay>0?`₹${fmt(finPay)}`:'Not yet'},
                ].map(s => `<div style="flex:1;min-width:80px;background:${s.done?'var(--green-50)':s.active?'var(--blue-50)':'var(--gray-50)'};border:1px solid ${s.done?'var(--green-100)':s.active?'var(--blue-100)':'var(--gray-200)'};border-radius:6px;padding:5px 8px;text-align:center">
                  <div style="font-size:10px;font-weight:600;color:${s.done?'var(--green-700)':s.active?'var(--blue-700)':'var(--gray-400)'}">${s.done?'✓ ':s.active?'⏳ ':''}${s.label}</div>
                  ${s.info?`<div style="font-size:10px;color:var(--gray-500)">${s.info}</div>`:''}
                </div>`).join('')}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px" onclick="event.stopPropagation()">
                ${visit?.status==='scheduled' ? `<button class="btn-sm" style="background:var(--red-50);color:var(--red-700);border:1px solid var(--red-100)" onclick="deleteSiteVisit('${visit.id}','${j.lead_id}')">✕ Cancel Visit</button>` : ''}
                ${j.status==='pending_approval' ? `<button class="btn-sm btn-approve" onclick="openModal('upload-payment')">↑ Upload Payment Proof</button>` : ''}
                ${(j.status==='active'||j.status==='completed') ? `<button class="btn-sm btn-approve" onclick="openModal('upload-payment')">↑ Upload Payment</button>` : ''}
                ${!quote && j.status!=='site_visit' ? `<button class="btn-sm btn-verify" onclick="showToast('Quotation will be sent by the scheduling team','')">Quote Pending</button>` : ''}
              </div>
            </div>`;
          }).join('')}</div>`
      }
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Leads</span><span class="card-link" onclick="renderPage('leads')">View all</span></div>
        ${leadsList(myLeads.slice(0, 4))}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="qa-btn" onclick="openModal('new-lead')"><span class="qa-icon">+</span>New Lead</button>
            <button class="qa-btn" onclick="openModal('upload-payment')"><span class="qa-icon">↑</span>Upload Payment</button>
            <button class="qa-btn" onclick="renderPage('rework')"><span class="qa-icon">↩</span>Request Rework</button>
            <button class="qa-btn" onclick="renderPage('quotations')"><span class="qa-icon">◎</span>View Quotations</button>
          </div>
        </div>
      </div>
    </div>
    ${doneJobs.length > 0 ? `
    <div class="card">
      <div class="card-header"><span class="card-title">Completed Jobs</span></div>
      ${jobsList(doneJobs, 'sales')}
    </div>` : ''}`;
}

function renderSchedulingDashboard() {
  const d = STATE.data;
  const needsAction = d.jobs.filter(j => j.status !== 'completed' && j.status !== 'delayed').length;
  const delayed     = d.jobs.filter(j => j.status === 'delayed').length;
  const inVisit     = d.jobs.filter(j => j.status === 'site_visit').length;
  const inQuote     = d.jobs.filter(j => j.status === 'quotation' || j.status === 'pending_approval').length;
  const inWork      = d.jobs.filter(j => j.status === 'active').length;
  const pendingRework = d.reworkRequests.filter(r => r.status === 'pending').length;

  return `
    <div class="stats-grid">
      ${statCard('Needs Action', needsAction, '#1976D2', needsAction>0?'badge-warn':'badge-up', 'Jobs in pipeline')}
      ${statCard('Site Visit Stage', inVisit, '#2196F3', inVisit>0?'badge-info':'badge-up', inVisit>0?'Visit pending':'Clear')}
      ${statCard('Quote Stage', inQuote, '#FF9800', inQuote>0?'badge-warn':'badge-up', inQuote>0?'Awaiting approval':'Clear')}
      ${statCard('Work In Progress', inWork, '#4CAF50', inWork>0?'badge-info':'badge-up', inWork>0?'Active':'None')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">Job Pipeline</span>
        <span class="card-link" onclick="renderPage('jobs')">All Jobs</span>
      </div>
      <div class="card-body" style="padding:8px">
        ${renderJobPipeline()}
      </div>
    </div>

    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">Rework Queue</span><span class="card-link" onclick="renderPage('rework')">View all</span></div>
        ${reworkList(d.reworkRequests.filter(r=>r.status==='pending').slice(0,3), 'scheduling')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="qa-btn" onclick="openModal('assign-manager')"><span class="qa-icon">◈</span>Assign Manager</button>
            <button class="qa-btn" onclick="renderPage('advances')"><span class="qa-icon">◑</span>Advances</button>
            <button class="qa-btn" onclick="renderPage('quotations')"><span class="qa-icon">◎</span>Quotations</button>
            <button class="qa-btn" onclick="renderPage('rework')"><span class="qa-icon">↩</span>Rework</button>
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--gray-100)">
            <div class="card-title" style="margin-bottom:8px">Pending Advances</div>
            ${advanceMini(d.advances.filter(a=>a.status==='pending').slice(0,3))}
          </div>
        </div>
      </div>
    </div>`;
}

function renderManagerDashboard() {
  const d = STATE.data;
  const uid = STATE.profile?.id;
  const myJobs = d.jobs.filter(j => j.assigned_manager_id === uid || d.siteVisits.some(v => v.assigned_to === uid && v.job_id === j.id));
  const myVisits = d.siteVisits.filter(v => v.assigned_to === uid && v.status === 'scheduled');
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
      ${statCard('Site Visits', myVisits.length, '#2196F3', myVisits.length>0?'badge-warn':'badge-up', myVisits.length>0?'Upcoming':'Clear')}
      ${statCard('Advance Balance', '₹'+fmt(balance), '#42A5F5', balance>0?'badge-up':'badge-danger', balance>0?'Available':'Overspent')}
      ${statCard('Pending Expenses', d.expenses.filter(e=>e.status==='pending'&&e.added_by===uid).length, '#F59E0B', 'badge-warn', 'Awaiting approval')}
    </div>

    ${myVisits.length > 0 ? `
    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--blue-500)">
      <div class="card-header"><span class="card-title">📍 Upcoming Site Visits</span></div>
      <div class="card-body" style="padding:0">
        ${myVisits.map(v => {
          const job = d.jobs.find(j => j.id === v.job_id);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--gray-100)">
            <div>
              <div style="font-weight:600">${job?.customer_name||'—'}</div>
              <div style="font-size:12px;color:var(--gray-500)">${job?.location_text||''} · ${fmtDateTime(v.scheduled_date)}</div>
              <div style="font-size:12px;color:var(--gray-600);margin-top:2px">${job?.description||''}</div>
            </div>
            <div style="display:flex;gap:6px">
              ${job?.location_link?`<a href="${job.location_link}" target="_blank" class="btn-sm btn-verify" style="text-decoration:none">📍 Map</a>`:''}
              <button class="btn-sm btn-approve" onclick="completeVisitAndAdvance('${v.id}','${v.job_id}')">✓ Done</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <div class="two-col">
      <div class="card">
        <div class="card-header"><span class="card-title">My Jobs</span><span class="card-link" onclick="renderPage('jobs')">View all</span></div>
        ${jobsWithProgress(myJobs.slice(0, 5), true)}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="qa-btn" onclick="openModal('daily-plan')"><span class="qa-icon">+</span>Daily Plan</button>
            <button class="qa-btn" onclick="openModal('daily-report')"><span class="qa-icon">✓</span>Report</button>
            <button class="qa-btn" onclick="openModal('new-expense')"><span class="qa-icon">◈</span>Expense</button>
            <button class="qa-btn" onclick="openModal('new-quotation')"><span class="qa-icon">◎</span>Quotation</button>
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

// renderAccountsDashboard is defined in finance.js
