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

function jobsWithProgress(jobs, showTracker) {
  if (!jobs || jobs.length === 0) return `<div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No jobs assigned</div></div>`;
  return jobs.map(j => {
    const prog = jobProgress(j);
    return `<div class="job-item" style="cursor:pointer">
      <div class="job-dot" style="background:${dotColor(j.status)}"></div>
      <div class="job-info" onclick="openJobDetail('${j.id}')">
        <div class="job-name">${j.customer_name||'—'}</div>
        <div class="job-meta">${j.location_text||'No location'} · <span class="job-status ${jobStatusClass(j.status)}" style="font-size:10px;padding:1px 5px">${j.status}</span></div>
        <div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${prog}%"></div></div>
        <div class="text-sm text-muted">${prog}% complete</div>
      </div>
      ${showTracker ? `<button class="btn-sm btn-verify" style="flex-shrink:0;margin-left:8px;white-space:nowrap" onclick="openJobTracker('${j.id}')">📊 Track</button>` : ''}
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

function siteVisitMiniScheduling(visits) {
  if (!visits || visits.length === 0) return `<div class="card-body"><div class="empty-state"><div class="empty-icon">◷</div><div class="empty-text">No site visits scheduled</div></div></div>`;
  return `<div style="padding:0 16px">` + visits.map(v => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--blue-500);flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:13px">${v.jobs?.customer_name||'—'}</div>
        <div style="font-size:12px;color:var(--gray-500)">${fmtDateTime(v.scheduled_date)}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="job-status status-review">scheduled</span>
        <button class="btn-sm btn-approve" onclick="completeVisit('${v.id}')">Done</button>
        <button class="btn-sm btn-verify" onclick="rescheduleVisit('${v.id}')">Reschedule</button>
      </div>
    </div>`).join('') + `</div>`;
}

function newLeadsNeedingVisit(leads) {
  if (!leads || leads.length === 0) return `<div class="text-sm text-muted">No pending leads</div>`;
  return leads.map(l => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-100)">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--amber-700);flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:13px">${l.customer_name||'—'}</div>
        <div style="font-size:12px;color:var(--gray-500)">${l.location_text||'No location'} · ${fmtDate(l.created_at)}</div>
      </div>
      <button class="btn-sm btn-approve" onclick="convertLeadToVisit('${l.id}')">Schedule</button>
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
