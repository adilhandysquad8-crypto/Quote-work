function renderSalesDashboard() {
  const d = STATE.data;
  const myLeads    = d.leads.filter(l => l.assigned_to === STATE.profile?.id);
  // FIX 1: Use Set to avoid duplicate job entries
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

    <!-- Active jobs with full status per job -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <span class="card-title">My Active Jobs</span>
        <span class="card-link" onclick="renderPage('jobs')">View all</span>
      </div>
      ${activeJobs.length === 0
        ? `<div class="card-body"><div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No active jobs yet. Create a lead to get started.</div></div></div>`
        : `<div>${activeJobs.map(j => {
            // FIX 2: Get the latest scheduled visit (most recent scheduled_date)
            const allVisits = d.siteVisits.filter(v=>v.job_id===j.id);
            const latestScheduled = allVisits.filter(v=>v.status==='scheduled')
              .sort((a,b)=>new Date(b.scheduled_date)-new Date(a.scheduled_date))[0];
            const visit = latestScheduled || allVisits.find(v=>v.status==='completed');
            const quote = d.quotations.filter(q=>q.job_id===j.id&&q.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
            const payments = d.payments.filter(p=>p.job_id===j.id);
            const advPay   = payments.filter(p=>p.type==='advance'&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
            const finPay   = payments.filter(p=>p.type==='final'&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
            // Use job ID as key to prevent duplication
            const key = `job-${j.id}`;
            return `
            <div key="${key}" style="border-bottom:1px solid var(--gray-100);padding:14px 16px" onclick="openJobDetail('${j.id}')" style="cursor:pointer">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px">
                <div>
                  <div style="font-weight:600;font-size:14px">${escapeHtml(j.customer_name||'—')}</div>
                  <div style="font-size:12px;color:var(--gray-500)">${escapeHtml(j.location_text||'')} ${j.location_link?`<a href="${j.location_link}" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue-600)">📍 Map</a>`:''}</div>
                </div>
                <span class="job-status ${jobStatusClass(j.status)}">${(j.status||'').replace(/_/g,' ')}</span>
              </div>
              <!-- Mini status pipeline -->
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
              <!-- Actions (wrap properly) -->
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

// Helper to prevent XSS (though data is trusted, good practice)
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
