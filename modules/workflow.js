// ─── WORKFLOW ENGINE ─────────────────────────────────────────────
// Single source of truth for all job status transitions
// Status flow:
// site_visit → quotation → pending_approval → active → completed
//                                                    ↘ delayed / rework

const JOB_STAGES = [
  { status: 'site_visit',        label: 'Site Visit',         icon: '📍', role: 'scheduling' },
  { status: 'quotation',         label: 'Quotation',          icon: '📋', role: 'manager' },
  { status: 'pending_approval',  label: 'Awaiting Approval',  icon: '⏳', role: 'scheduling' },
  { status: 'active',            label: 'Work In Progress',   icon: '🔨', role: 'manager' },
  { status: 'completed',         label: 'Completed',          icon: '✅', role: 'scheduling' },
];

// ── What each role sees as their "next action" for a job ──────────
function getJobNextAction(job) {
  const role = STATE.role;
  const d = STATE.data;
  const visit = d.siteVisits.find(v => v.job_id === job.id);
  const quote = d.quotations.find(q => q.job_id === job.id && q.status !== 'rejected');
  const hasApprovedQuote = d.quotations.some(q => q.job_id === job.id && q.status === 'approved');

  if (role === 'scheduling') {
    if (job.status === 'site_visit') {
      if (!visit || visit.status === 'rescheduled')
        return { label: 'Schedule Visit', action: `convertLeadToVisit('${job.lead_id||job.id}')`, style: 'btn-approve' };
      if (visit.status === 'scheduled')
        return { label: 'Mark Visit Done', action: `completeVisitAndAdvance('${visit.id}','${job.id}')`, style: 'btn-approve' };
      if (visit.status === 'completed')
        return { label: 'Request Quotation', action: `advanceJobToQuotation('${job.id}')`, style: 'btn-approve' };
    }
    if (job.status === 'quotation') {
      if (!quote) return { label: 'Waiting for Quote', action: null, style: '' };
      if (quote.status === 'draft') return { label: 'Finalize Quote', action: `openFinalizeModal('${quote.id}')`, style: 'btn-approve' };
      if (quote.status === 'reviewed') return { label: 'Send to Customer', action: `sendQuoteToCustomer('${quote.id}','${job.id}')`, style: 'btn-approve' };
    }
    if (job.status === 'pending_approval') {
      return { label: 'Mark Approved', action: `markJobApproved('${job.id}')`, style: 'btn-approve' };
    }
    if (job.status === 'active') {
      return { label: 'Mark Complete', action: `markJobComplete('${job.id}')`, style: 'btn-verify' };
    }
  }

  if (role === 'manager') {
    if (job.status === 'quotation') {
      if (!quote) return { label: '+ Draft Quotation', action: `openModal('new-quotation')`, style: 'btn-approve' };
      return { label: 'View Quotation', action: `viewQuotationDetail('${quote.id}')`, style: 'btn-verify' };
    }
    if (job.status === 'active') {
      return { label: '+ Daily Report', action: `openModal('daily-report')`, style: 'btn-approve' };
    }
  }

  return null;
}

// ── Scheduling: complete visit and auto-advance job ───────────────
async function completeVisitAndAdvance(visitId, jobId) {
  const { error: ve } = await sb.from('site_visits')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', visitId);
  if (ve) { showToast('Error: ' + ve.message, 'error'); return; }
  showToast('Site visit completed!', 'success');
  loadAllData();
}

// ── Scheduling: move job from site_visit → quotation ─────────────
async function advanceJobToQuotation(jobId) {
  const { error } = await sb.from('jobs').update({ status: 'quotation' }).eq('id', jobId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  // Update linked lead status
  const job = STATE.data.jobs.find(j => j.id === jobId);
  if (job?.lead_id) await sb.from('sales_leads').update({ status: 'contacted' }).eq('id', job.lead_id);
  showToast('Job moved to Quotation stage — manager will be notified', 'success');
  loadAllData();
}

// ── Scheduling: send finalized quote to customer ──────────────────
async function sendQuoteToCustomer(quoteId, jobId) {
  const { error: qe } = await sb.from('quotations').update({ status: 'sent' }).eq('id', quoteId);
  if (qe) { showToast('Error: ' + qe.message, 'error'); return; }
  const { error: je } = await sb.from('jobs').update({ status: 'pending_approval' }).eq('id', jobId);
  if (je) { showToast('Error: ' + je.message, 'error'); return; }
  showToast('Quotation marked as sent to customer!', 'success');
  loadAllData();
}

// ── Scheduling: customer approved → start work ───────────────────
async function markJobApproved(jobId) {
  const job = STATE.data.jobs.find(j => j.id === jobId);
  const quote = STATE.data.quotations.find(q => q.job_id === jobId && q.status === 'sent');

  document.getElementById('modal-title').textContent = 'Customer Approved — Start Work';
  document.getElementById('modal-body').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="background:var(--green-50);border:1px solid var(--green-100);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-weight:600;color:var(--green-700);margin-bottom:4px">✓ Confirming customer approval</div>
        <div style="font-size:13px;color:var(--gray-600)">Job: <strong>${job?.customer_name}</strong></div>
        ${quote ? `<div style="font-size:13px;color:var(--gray-600)">Approved Amount: <strong>₹${fmt(quote.final_amount||0)}</strong></div>` : ''}
      </div>
      <div class="form-row-single form-group">
        <label class="form-label">Confirm start date</label>
        <input class="form-input" type="date" id="f-startdate" value="${new Date().toISOString().split('T')[0]}"/>
      </div>
      <div class="form-row-single form-group">
        <label class="form-label">Note (optional)</label>
        <input class="form-input" id="f-startnote" placeholder="Any special instructions for the manager..."/>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" onclick="confirmStartWork('${jobId}','${quoteId||''}')">✓ Approve & Start Work</button>
    </div>`;
  document.getElementById('modal-backdrop').classList.add('open');
}

async function confirmStartWork(jobId, quoteId) {
  // Mark quote as approved
  if (quoteId) {
    await sb.from('quotations').update({ status: 'approved' }).eq('id', quoteId);
  }
  // Move job to active
  const { error } = await sb.from('jobs').update({ status: 'active' }).eq('id', jobId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  // Update lead to converted
  const job = STATE.data.jobs.find(j => j.id === jobId);
  if (job?.lead_id) await sb.from('sales_leads').update({ status: 'converted' }).eq('id', job.lead_id);
  showToast('Work started! Manager has been assigned.', 'success');
  closeModal(); loadAllData();
}

// ── Scheduling: complete job ──────────────────────────────────────
async function markJobComplete(jobId) {
  if (!confirm('Mark this job as fully completed?')) return;
  const { error } = await sb.from('jobs').update({ status: 'completed' }).eq('id', jobId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  const job = STATE.data.jobs.find(j => j.id === jobId);
  if (job?.lead_id) await sb.from('sales_leads').update({ status: 'converted' }).eq('id', job.lead_id);
  showToast('Job marked as completed!', 'success');
  loadAllData();
}

// ── Pipeline view for scheduling dashboard ────────────────────────
function renderJobPipeline() {
  const d = STATE.data;
  const stages = [
    { key: 'site_visit',       label: 'Site Visit',      color: '#2196F3', bg: '#E3F2FD' },
    { key: 'quotation',        label: 'Quotation',       color: '#FF9800', bg: '#FFF3E0' },
    { key: 'pending_approval', label: 'Pending Approval',color: '#9C27B0', bg: '#F3E5F5' },
    { key: 'active',           label: 'In Progress',     color: '#4CAF50', bg: '#E8F5E9' },
    { key: 'completed',        label: 'Completed',       color: '#607D8B', bg: '#ECEFF1' },
  ];

  return `<div style="overflow-x:auto">
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;min-width:600px;padding:4px">
    ${stages.map(st => {
      const jobs = d.jobs.filter(j => j.status === st.key);
      return `
        <div style="background:${st.bg};border-radius:10px;padding:10px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${st.color};margin-bottom:8px;display:flex;justify-content:space-between">
            <span>${st.label}</span>
            <span style="background:${st.color};color:white;border-radius:10px;padding:1px 7px;font-size:10px">${jobs.length}</span>
          </div>
          ${jobs.length === 0 
            ? `<div style="text-align:center;padding:10px;font-size:12px;color:#94a3b8">Empty</div>`
            : jobs.map(j => {
                const action = getJobNextAction(j);
                const quote = d.quotations.find(q => q.job_id === j.id && q.status !== 'rejected');
                return `
                <div style="background:white;border-radius:8px;padding:10px;margin-bottom:6px;border:1px solid ${st.color}22;cursor:pointer" onclick="openJobDetail('${j.id}')">
                  <div style="font-weight:600;font-size:13px;margin-bottom:3px">${j.customer_name||'—'}</div>
                  <div style="font-size:11px;color:#64748b;margin-bottom:6px">${j.location_text||'—'}</div>
                  ${quote ? `<div style="font-size:11px;color:${st.color};font-weight:600">₹${fmt(quote.final_amount||0)}</div>` : ''}
                  ${action ? `<button class="btn-sm ${action.style}" style="margin-top:6px;width:100%;font-size:11px" 
                    onclick="event.stopPropagation();${action.action}">${action.label}</button>` : ''}
                </div>`;
              }).join('')
          }
        </div>`;
    }).join('')}
    </div>
  </div>`;
}

// ── Job progress bar helper ───────────────────────────────────────
function getJobProgress(job) {
  const map = { site_visit:10, quotation:30, pending_approval:50, active:70, completed:100, delayed:60, rework:65 };
  return map[job?.status] || 0;
}

// ─── JOB START/END DATE & TRACKER ────────────────────────────────
// We store start_date and end_date in Supabase using a simple approach:
// A job gets its start tracked when confirmStartWork is called (stored via description append)
// For proper tracking we use daily_reports count vs plan

function openJobTracker(jobId) {
  const job = STATE.data.jobs.find(j => j.id === jobId);
  if (!job) return;
  const reports = STATE.data.dailyReports.filter(r => r.job_id === jobId).sort((a,b) => new Date(a.date)-new Date(b.date));
  const plans   = STATE.data.dailyPlans.filter(p => p.job_id === jobId);
  const expenses = STATE.data.expenses.filter(e => e.job_id === jobId);
  const quote   = STATE.data.quotations.filter(q => q.job_id === jobId && q.status !== 'rejected').sort((a,b) => b.version - a.version)[0];

  const totalExpApproved = expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
  const totalExpPending  = expenses.filter(e=>e.status==='pending').reduce((s,e)=>s+(e.total_amount||0),0);
  const quoted = quote?.final_amount || 0;

  const firstReport = reports[0]?.date;
  const lastReport  = reports[reports.length-1]?.date;

  document.getElementById('modal-title').textContent = `📊 Job Tracker — ${job.customer_name}`;
  document.getElementById('modal-body').innerHTML = `
  <div style="max-height:70vh;overflow-y:auto">

    <!-- Header info -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--blue-50);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px">Status</div>
        <span class="job-status ${jobStatusClass(job.status)}">${job.status}</span>
      </div>
      <div style="background:var(--gray-50);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px">Work Days</div>
        <div style="font-weight:700;font-size:18px">${reports.length} <span style="font-size:12px;color:var(--gray-500)">days logged</span></div>
      </div>
      <div style="background:var(--green-50);border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px">Start Date</div>
        <div style="font-weight:600">${firstReport ? fmtDate(firstReport) : 'Not started'}</div>
      </div>
      <div style="background:${job.status==='completed'?'var(--green-50)':'var(--amber-50)'};border-radius:8px;padding:12px">
        <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;margin-bottom:4px">Last Activity</div>
        <div style="font-weight:600">${lastReport ? fmtDate(lastReport) : '—'}</div>
      </div>
    </div>

    <!-- Set target end date -->
    ${job.status === 'active' ? `
    <div style="background:var(--amber-50);border:1px solid var(--amber-100);border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:8px;font-size:13px">Set Target Completion Date</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="form-input" type="date" id="f-target-date" style="flex:1;font-size:13px;padding:8px 10px"
          value="${job.target_date||''}" min="${new Date().toISOString().split('T')[0]}"/>
        <button class="btn-sm btn-approve" onclick="setJobTargetDate('${job.id}')">Set Date</button>
      </div>
      ${job.description?.includes('TARGET:') ? `<div style="margin-top:6px;font-size:12px;color:var(--amber-700)">Current target: <strong>${job.description.match(/TARGET:([\d-]+)/)?.[1]||'not set'}</strong></div>` : ''}
    </div>` : ''}

    <!-- Financial tracker -->
    <div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">Financial Tracker</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--blue-50);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Quoted</div>
          <div style="font-weight:700;font-size:16px;color:var(--blue-700)">₹${fmt(quoted)}</div>
        </div>
        <div style="background:var(--green-50);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Expenses Approved</div>
          <div style="font-weight:700;font-size:16px;color:var(--green-700)">₹${fmt(totalExpApproved)}</div>
        </div>
        <div style="background:var(--amber-50);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Expenses Pending</div>
          <div style="font-weight:700;font-size:16px;color:var(--amber-700)">₹${fmt(totalExpPending)}</div>
        </div>
        <div style="background:${quoted-totalExpApproved>=0?'var(--green-50)':'var(--red-50)'};border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Balance</div>
          <div style="font-weight:700;font-size:16px;color:${quoted-totalExpApproved>=0?'var(--green-700)':'var(--red-700)'}">₹${fmt(quoted-totalExpApproved)}</div>
        </div>
      </div>
    </div>

    <!-- Daily reports timeline -->
    <div>
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">Daily Work Log (${reports.length} entries)</div>
      ${reports.length === 0
        ? `<div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px">No reports submitted yet</div>`
        : reports.slice().reverse().map(r => `
          <div style="border:1px solid var(--gray-200);border-radius:8px;padding:10px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong style="font-size:13px">${fmtDate(r.date)}</strong>
              <span style="font-size:12px;color:var(--gray-500)">${r.labor_used||0} workers · ₹${fmt(r.actual_expense||0)}</span>
            </div>
            <div style="font-size:13px;color:var(--gray-700);margin-bottom:2px">${r.actual_tasks||'—'}</div>
            <div style="font-size:12px;color:var(--blue-600)">${r.progress_done||''}</div>
            ${r.issues?`<div style="font-size:12px;color:var(--red-700);margin-top:3px">⚠ ${r.issues}</div>`:''}
          </div>`).join('')
      }
    </div>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Close</button>
    ${STATE.role==='manager'?`<button class="btn-submit" onclick="closeModal();openModal('daily-report')">+ Add Report</button>`:''}
  </div>`;
  document.getElementById('modal-backdrop').classList.add('open');
}

async function setJobTargetDate(jobId) {
  const date = document.getElementById('f-target-date').value;
  if (!date) { showToast('Pick a date', 'error'); return; }
  const job = STATE.data.jobs.find(j => j.id === jobId);
  // Store target date in description field as a tag
  let desc = (job.description || '').replace(/\s*TARGET:[\d-]+/g, '');
  desc = desc + ` TARGET:${date}`;
  const { error } = await sb.from('jobs').update({ description: desc.trim() }).eq('id', jobId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast(`Target date set: ${fmtDate(date)}`, 'success');
  closeModal(); loadAllData();
}
