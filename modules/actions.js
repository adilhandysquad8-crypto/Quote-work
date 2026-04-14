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
  document.getElementById('modal-title').textContent = 'Release Funds';
  document.getElementById('modal-body').innerHTML = releaseFundsForm(advId);
  document.getElementById('modal-backdrop').classList.add('open');
}

async function approveRework(id, status) {
  const { error } = await sb.from('rework_requests').update({ status, reviewed_by: STATE.profile?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(status==='approved'?'Rework approved!':'Rework rejected', status==='approved'?'success':'error');
  loadAllData();
}

async function finalizeQuotation(id) {
  // Legacy shim — redirects to new modal
  openFinalizeModal(id);
}

async function completeVisit(id) {
  const visit = STATE.data.siteVisits.find(v => v.id === id);
  const { error } = await sb.from('site_visits').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Site visit complete! Use "Request Quotation" to move to next stage.', 'success');
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
function jobStatusClass(s) { const m={active:'status-active',completed:'status-done',pending:'status-pending',pending_approval:'status-review',delayed:'status-rework',rework:'status-rework',site_visit:'status-review',quotation:'status-review'}; return m[s]||'status-pending'; }
function leadStatusClass(s) { const m={new:'status-review',contacted:'status-pending',site_visit_requested:'status-review',converted:'status-active',lost:'status-rework'}; return m[s]||'status-pending'; }
function quoteStatusClass(s) { const m={draft:'status-pending',reviewed:'status-review',sent:'status-review',approved:'status-active',rejected:'status-rework'}; return m[s]||'status-pending'; }
function payStatusClass(s) { const m={pending:'status-pending',verified:'status-active',rejected:'status-rework'}; return m[s]||'status-pending'; }
function advStatusClass(s) { const m={pending:'status-pending',approved:'status-review',released:'status-active',rejected:'status-rework'}; return m[s]||'status-pending'; }
function visitStatusClass(s) { const m={scheduled:'status-review',completed:'status-active',rescheduled:'status-pending'}; return m[s]||'status-pending'; }
function reworkStatusClass(s) { const m={pending:'status-pending',approved:'status-active',rejected:'status-rework',completed:'status-done'}; return m[s]||'status-pending'; }
function jobProgress(j) {
  const statMap = { site_visit:10, quotation:30, pending_approval:50, active:70, completed:100, delayed:55, rework:65 };
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

// ─── CONVERT LEAD TO SITE VISIT (Scheduling) ─────────────────────
async function convertLeadToVisit(leadId) {
  const lead = STATE.data.leads.find(l => l.id === leadId);
  if (!lead) return;

  const dateInput = prompt('Schedule visit date & time (YYYY-MM-DDTHH:MM):', 
    new Date(Date.now() + 86400000).toISOString().slice(0,16));
  if (!dateInput) return;

  // Check if a job already exists for this lead
  let job = STATE.data.jobs.find(j => j.lead_id === leadId);

  if (!job) {
    const { data: newJob, error: jobErr } = await sb.from('jobs').insert({
      lead_id: leadId,
      customer_name: lead.customer_name,
      customer_phone: lead.customer_phone,
      location_text: lead.location_text,
      location_link: lead.location_link,
      description: lead.requirement_summary,
      status: 'site_visit',
      created_by: STATE.profile?.id
    }).select().single();
    if (jobErr) { showToast('Error creating job: ' + jobErr.message, 'error'); return; }
    job = newJob;
  }

  // Check if a site visit already exists for this job
  const existingVisit = STATE.data.siteVisits.find(v => v.job_id === job.id);
  if (existingVisit) {
    // Update the date instead
    const { error } = await sb.from('site_visits').update({
      scheduled_date: dateInput,
      status: 'scheduled',
      updated_at: new Date().toISOString()
    }).eq('id', existingVisit.id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
  } else {
    const { error } = await sb.from('site_visits').insert({
      job_id: job.id,
      scheduled_date: dateInput,
      assigned_to: STATE.profile?.id,
      status: 'scheduled'
    });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
  }

  // Update lead status
  await sb.from('sales_leads').update({ status: 'site_visit_requested' }).eq('id', leadId);

  showToast('Site visit scheduled!', 'success');
  loadAllData();
}
