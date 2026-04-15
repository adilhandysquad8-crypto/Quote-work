// ─── JOB DETAIL MODAL ────────────────────────────────────────────
function openJobDetail(jobId) {
  const job = STATE.data.jobs.find(j => j.id === jobId);
  if (!job) return;
  const role = STATE.role;
  const quote = STATE.data.quotations.filter(q => q.job_id === jobId && q.status !== 'rejected').sort((a,b) => b.version - a.version)[0];
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

  // Ensure we have a valid profile id before inserting
  if (!STATE.profile?.id) {
    showToast('Session error — please sign out and sign in again.', 'error');
    return;
  }

  const { data: leadData, error } = await sb.from('sales_leads').insert({
    customer_name: name, customer_phone: phone,
    location_text: locText, location_link: locLink,
    requirement_summary: req, status: 'new',
    assigned_to: STATE.profile.id
  }).select().single();
  if (error) {
    console.error('Lead insert error:', error);
    showToast('Error: ' + error.message, 'error');
    return;
  }

  showToast('Lead created! Scheduling will arrange the site visit.', 'success');
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
    proof_url: proof,
    added_by: STATE.profile?.id,   // schema field
    status: 'pending'
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Expense added — pending approval', 'success');
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
