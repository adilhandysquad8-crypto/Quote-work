// ═══════════════════════════════════════════════════════════════
// FINANCE MODULE — Accounts, Payment Requests, Job Analysis
// ═══════════════════════════════════════════════════════════════

// ── ACCOUNTS DASHBOARD ──────────────────────────────────────────
function renderAccountsDashboard() {
  const d = STATE.data;
  const ongoing   = d.jobs.filter(j => j.status !== 'completed' && j.status !== 'site_visit');
  const completed = d.jobs.filter(j => j.status === 'completed');
  const totalCollected  = d.payments.filter(p=>p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
  const pendingPayments = d.payments.filter(p=>p.status==='pending');
  const pendingAdvances = d.advances.filter(a=>a.status==='pending');
  const pendingExpenses = d.expenses.filter(e=>e.status==='pending');
  const totalQuoted     = d.quotations.filter(q=>q.status==='approved'||q.status==='sent').reduce((s,q)=>s+(q.final_amount||0),0);
  const totalExpenses   = d.expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);

  return `
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
    ${statCard('Ongoing Jobs', ongoing.length, '#1976D2', 'badge-info', ongoing.length+' active')}
    ${statCard('Completed', completed.length, '#15803D', 'badge-up', 'Finished')}
    ${statCard('Total Collected', '₹'+fmt(totalCollected), '#0D47A1', 'badge-up', 'Verified payments')}
    ${statCard('Pending Actions', pendingPayments.length+pendingAdvances.length+pendingExpenses.length, '#EF5350', 'badge-danger', 'Need attention')}
  </div>

  <!-- PENDING ACTIONS ROW -->
  <div class="two-col" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Payment Requests from Manager</span>
        <span class="nav-badge" style="background:var(--amber-700)">${pendingAdvances.length}</span>
      </div>
      ${pendingAdvances.length === 0
        ? `<div class="card-body"><div class="empty-state"><div class="empty-icon">◑</div><div class="empty-text">No pending requests</div></div></div>`
        : `<div style="padding:0 4px">${pendingAdvances.slice(0,4).map(a => {
            const job = d.jobs.find(j=>j.id===a.job_id);
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100)">
              <div>
                <div style="font-weight:600;font-size:13px">${job?.customer_name||'—'}</div>
                <div style="font-size:11px;color:var(--gray-500)">Mat: ₹${fmt(a.material_amount||0)} · Lab: ₹${fmt(a.labour_amount||0)} · Other: ₹${fmt(a.other_amount||0)}</div>
                <div style="font-size:12px;font-weight:600;color:var(--blue-700)">Total: ₹${fmt(a.total_amount||0)}</div>
                ${a.note?`<div style="font-size:11px;color:var(--gray-500)">${a.note}</div>`:''}
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <button class="btn-sm btn-approve" onclick="approveAdvance('${a.id}','approved')">Approve</button>
                <button class="btn-sm btn-reject" onclick="openRejectAdvanceModal('${a.id}')">Reject</button>
              </div>
            </div>`;
          }).join('')}</div>`
      }
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Customer Payments to Verify</span>
        <span class="nav-badge">${pendingPayments.length}</span>
      </div>
      ${pendingPayments.length === 0
        ? `<div class="card-body"><div class="empty-state"><div class="empty-icon">↑</div><div class="empty-text">No pending payments</div></div></div>`
        : `<div style="padding:0 4px">${pendingPayments.slice(0,4).map(p => {
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--gray-100)">
              <div>
                <div style="font-weight:600;font-size:13px">${p.jobs?.customer_name||'—'}</div>
                <div style="font-size:11px"><span class="pay-type ${p.type==='advance'?'pay-adv':'pay-fin'}">${p.type}</span></div>
                <div style="font-size:14px;font-weight:700;color:var(--blue-700)">₹${fmt(p.amount||0)}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <button class="btn-sm btn-verify" onclick="verifyPayment('${p.id}','verified')">Verify</button>
                <button class="btn-sm btn-reject" onclick="verifyPayment('${p.id}','rejected')">Reject</button>
              </div>
            </div>`;
          }).join('')}</div>`
      }
    </div>
  </div>

  <!-- ONGOING JOBS -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <span class="card-title">Ongoing Jobs — Financial Status</span>
      <span class="card-link" onclick="renderPage('job-financials')">Full report</span>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>Job</th><th>Status</th><th>Quoted</th><th>Material Req</th><th>Labour Req</th><th>Released</th><th>Expenses</th><th>Received</th><th></th></tr></thead>
        <tbody>
        ${ongoing.length===0?`<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No ongoing jobs</div></div></td></tr>`:
          ongoing.map(j => {
            const q = d.quotations.filter(qt=>qt.job_id===j.id&&qt.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
            const adv = d.advances.filter(a=>a.job_id===j.id);
            const released = adv.reduce((s,a)=>s+(a.released_amount||0),0);
            const matReq = adv.filter(a=>a.status!=='rejected').reduce((s,a)=>s+(a.material_amount||0),0);
            const labReq = adv.filter(a=>a.status!=='rejected').reduce((s,a)=>s+(a.labour_amount||0),0);
            const exp = d.expenses.filter(e=>e.job_id===j.id&&e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
            const recv = d.payments.filter(p=>p.job_id===j.id&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
            return `<tr onclick="openJobFinanceDetail('${j.id}')" style="cursor:pointer">
              <td><strong>${esc(j.customer_name||'—')}</strong></td>
              <td><span class="job-status ${jobStatusClass(j.status)}">${(j.status||'').replace(/_/g,' ')}</span></td>
              <td>₹${fmt(q?.final_amount||0)}</td>
              <td style="color:var(--blue-700)">₹${fmt(matReq)}</td>
              <td style="color:var(--green-700)">₹${fmt(labReq)}</td>
              <td>₹${fmt(released)}</td>
              <td style="color:var(--red-700)">₹${fmt(exp)}</td>
              <td style="color:var(--green-700)">₹${fmt(recv)}</td>
              <td><button class="btn-sm btn-verify" onclick="event.stopPropagation();openJobFinanceDetail('${j.id}')">Detail</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- COMPLETED JOBS SUMMARY -->
  ${completed.length > 0 ? `
  <div class="card">
    <div class="card-header"><span class="card-title">Completed Jobs — P&L Summary</span></div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>Job</th><th>Quoted</th><th>Expenses</th><th>Received</th><th>Profit</th><th>Margin</th></tr></thead>
        <tbody>
        ${completed.map(j => {
          const q = d.quotations.filter(qt=>qt.job_id===j.id&&qt.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
          const exp = d.expenses.filter(e=>e.job_id===j.id&&e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
          const recv = d.payments.filter(p=>p.job_id===j.id&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
          const quoted = q?.final_amount||0;
          const profit = quoted - exp;
          const margin = quoted > 0 ? ((profit/quoted)*100).toFixed(1) : 0;
          return `<tr onclick="openJobFinanceDetail('${j.id}')" style="cursor:pointer">
            <td><strong>${esc(j.customer_name)}</strong></td>
            <td>₹${fmt(quoted)}</td>
            <td style="color:var(--red-700)">₹${fmt(exp)}</td>
            <td style="color:var(--green-700)">₹${fmt(recv)}</td>
            <td style="color:${profit>=0?'var(--green-700)':'var(--red-700)'}"><strong>₹${fmt(profit)}</strong></td>
            <td style="color:${profit>=0?'var(--green-700)':'var(--red-700)'}">${margin}%</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}`;
}

// ── JOB FINANCE DETAIL MODAL ────────────────────────────────────
function openJobFinanceDetail(jobId) {
  const d   = STATE.data;
  const job = d.jobs.find(j=>j.id===jobId);
  if (!job) return;

  const quote    = d.quotations.filter(q=>q.job_id===jobId&&q.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
  const items    = quote?.quotation_items || [];
  const matQ     = items.filter(i=>i.category==='material').reduce((s,i)=>s+i.total_price,0);
  const labQ     = items.filter(i=>i.category==='labour').reduce((s,i)=>s+i.total_price,0);
  const othQ     = items.filter(i=>i.category==='other').reduce((s,i)=>s+i.total_price,0);
  const profit   = (quote?.profit_added||0);
  const gst      = (quote?.gst||0);
  const finalQ   = quote?.final_amount||0;
  const subtotalQ = matQ + labQ + othQ;
  const margin   = subtotalQ > 0 ? ((profit / subtotalQ) * 100).toFixed(1) : 0;

  const advances = d.advances.filter(a=>a.job_id===jobId);
  const matRel   = advances.filter(a=>a.status==='released').reduce((s,a)=>s+(a.material_amount||0),0);
  const labRel   = advances.filter(a=>a.status==='released').reduce((s,a)=>s+(a.labour_amount||0),0);
  const othRel   = advances.filter(a=>a.status==='released').reduce((s,a)=>s+(a.other_amount||0),0);
  const totalRel = advances.reduce((s,a)=>s+(a.released_amount||0),0);

  const expenses    = d.expenses.filter(e=>e.job_id===jobId);
  const expApproved = expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
  const expPending  = expenses.filter(e=>e.status==='pending').reduce((s,e)=>s+(e.total_amount||0),0);

  const payments  = d.payments.filter(p=>p.job_id===jobId);
  const received  = payments.filter(p=>p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
  const reports   = d.dailyReports.filter(r=>r.job_id===jobId).sort((a,b)=>new Date(a.date)-new Date(b.date));

  document.getElementById('modal-title').textContent = `Financial Detail — ${esc(job.customer_name)}`;
  document.getElementById('modal-body').innerHTML = `
  <div style="max-height:72vh;overflow-y:auto">

    <!-- Status bar -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
      <span class="job-status ${jobStatusClass(job.status)}">${(job.status||'').replace(/_/g,' ')}</span>
      <span style="font-size:12px;color:var(--gray-500)">${esc(job.location_text||'')}</span>
      ${(job.target_date||job.description?.includes('TARGET:'))?`<span style="font-size:12px;color:var(--amber-700)">🗓 Target: ${job.target_date||job.description?.match(/TARGET:([\d-]+)/)?.[1]||''}</span>`:''}
    </div>

    <!-- Quotation breakdown -->
    <div style="background:var(--blue-50);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-weight:700;margin-bottom:10px;font-size:13px">📋 Quotation Breakdown</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        <div style="background:white;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase">Material</div>
          <div style="font-weight:700;color:var(--blue-700)">₹${fmt(matQ)}</div>
        </div>
        <div style="background:white;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase">Labour</div>
          <div style="font-weight:700;color:var(--green-700)">₹${fmt(labQ)}</div>
        </div>
        <div style="background:white;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase">Other</div>
          <div style="font-weight:700;color:var(--purple-700)">₹${fmt(othQ)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-600);margin-bottom:2px"><span>Subtotal</span><span>₹${fmt(matQ+labQ+othQ)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-600);margin-bottom:2px"><span>Profit Margin Added</span><span>₹${fmt(profit)} (${margin}%)</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-600);margin-bottom:6px"><span>GST (${gst}%)</span><span>₹${fmt(Math.round(((matQ+labQ+othQ)+profit)*gst/100))}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;border-top:1px solid var(--blue-200);padding-top:8px"><span>Final Quoted</span><span style="color:var(--blue-700)">₹${fmt(finalQ)}</span></div>
    </div>

    <!-- Fund releases by category -->
    <div style="background:var(--green-50);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-weight:700;margin-bottom:10px;font-size:13px">💸 Funds Released to Manager</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <div style="background:white;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase">Material</div>
          <div style="font-weight:700;color:var(--blue-700)">₹${fmt(matRel)}</div>
          ${matQ>0?`<div style="font-size:10px;color:var(--gray-400)">${fmt(matQ-matRel)} remaining</div>`:''}
        </div>
        <div style="background:white;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase">Labour</div>
          <div style="font-weight:700;color:var(--green-700)">₹${fmt(labRel)}</div>
          ${labQ>0?`<div style="font-size:10px;color:var(--gray-400)">${fmt(labQ-labRel)} remaining</div>`:''}
        </div>
        <div style="background:white;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:10px;color:var(--gray-500);text-transform:uppercase">Other</div>
          <div style="font-weight:700;color:var(--purple-700)">₹${fmt(othRel)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:600;font-size:14px"><span>Total Released</span><span>₹${fmt(totalRel)}</span></div>
    </div>

    <!-- Expenses vs Received -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--red-50);border-radius:10px;padding:12px">
        <div style="font-weight:700;font-size:12px;margin-bottom:6px">🧾 Expenses</div>
        <div style="font-size:13px;margin-bottom:2px">Approved: <strong style="color:var(--red-700)">₹${fmt(expApproved)}</strong></div>
        <div style="font-size:13px">Pending: <strong style="color:var(--amber-700)">₹${fmt(expPending)}</strong></div>
      </div>
      <div style="background:var(--green-50);border-radius:10px;padding:12px">
        <div style="font-weight:700;font-size:12px;margin-bottom:6px">💰 Customer Payments</div>
        ${payments.map(p=>`<div style="font-size:12px;display:flex;justify-content:space-between"><span><span class="pay-type ${p.type==='advance'?'pay-adv':'pay-fin'}" style="font-size:10px">${p.type}</span> ${fmtDate(p.created_at)}</span><span style="color:${p.status==='verified'?'var(--green-700)':'var(--amber-700)'}">₹${fmt(p.amount)}</span></div>`).join('')||'<div style="font-size:12px;color:var(--gray-400)">None yet</div>'}
        <div style="border-top:1px solid var(--green-200);margin-top:6px;padding-top:6px;font-weight:700">Total: ₹${fmt(received)}</div>
      </div>
    </div>

    <!-- Advance requests history -->
    ${advances.length > 0 ? `
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:13px;margin-bottom:8px">Payment Requests (Advances)</div>
      ${advances.map(a=>`
        <div style="border:1px solid var(--gray-200);border-radius:8px;padding:10px;margin-bottom:6px;background:${a.status==='released'?'var(--green-50)':a.status==='rejected'?'var(--red-50)':'white'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span class="job-status ${advStatusClass(a.status)}">${a.status}</span>
              <span style="font-size:12px;color:var(--gray-500);margin-left:6px">${fmtDate(a.created_at)}</span>
            </div>
            <strong>₹${fmt(a.total_amount||0)}</strong>
          </div>
          <div style="font-size:11px;color:var(--gray-500);margin-top:4px">Mat: ₹${fmt(a.material_amount||0)} · Lab: ₹${fmt(a.labour_amount||0)} · Other: ₹${fmt(a.other_amount||0)}</div>
          ${a.note?`<div style="font-size:11px;color:var(--gray-600);margin-top:2px">${a.note}</div>`:''}
          ${a.status==='released'?`<div style="font-size:11px;color:var(--green-700);margin-top:2px">Released: ₹${fmt(a.released_amount||0)}</div>`:''}
        </div>`).join('')}
    </div>` : ''}

    <!-- Daily reports timeline -->
    ${reports.length > 0 ? `
    <div>
      <div style="font-weight:700;font-size:13px;margin-bottom:8px">Work Log (${reports.length} days)</div>
      ${reports.slice(-5).reverse().map(r=>`
        <div style="border-left:3px solid var(--blue-300);padding:8px 12px;margin-bottom:6px;background:var(--gray-50);border-radius:0 6px 6px 0">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
            <strong>${fmtDate(r.date)}</strong>
            <span style="color:var(--gray-500)">${r.labor_used||0} workers · ₹${fmt(r.actual_expense||0)}</span>
          </div>
          <div style="font-size:12px">${esc(r.actual_tasks||'—')}</div>
          ${r.progress_done?`<div style="font-size:11px;color:var(--blue-600)">${r.progress_done}</div>`:''}
          ${r.issues?`<div style="font-size:11px;color:var(--red-700)">⚠ ${r.issues}</div>`:''}
        </div>`).join('')}
    </div>` : ''}

  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Close</button>
    <button class="btn-submit" onclick="downloadJobFinancePDF('${jobId}')">⬇ PDF Report</button>
  </div>`;
  document.getElementById('modal-backdrop').classList.add('open');
}

// ── Reject Advance with reason ───────────────────────────────────
function openRejectAdvanceModal(advId) {
  const adv = STATE.data.advances.find(a=>a.id===advId);
  document.getElementById('modal-title').textContent = 'Reject Advance Request';
  document.getElementById('modal-body').innerHTML = `
    <div style="background:var(--red-50);border-radius:8px;padding:12px;margin-bottom:14px">
      <div style="font-weight:600">${esc(STATE.data.jobs.find(j=>j.id===adv?.job_id)?.customer_name||'—')}</div>
      <div style="font-size:13px">Requested: <strong>₹${fmt(adv?.total_amount||0)}</strong></div>
    </div>
    <div class="form-row-single form-group">
      <label class="form-label">Reason for Rejection *</label>
      <textarea class="form-textarea" id="f-rej-reason" placeholder="Explain why this request is being rejected..."></textarea>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" style="background:var(--red-700)" onclick="submitRejectAdvance('${advId}')">Reject Request</button>
    </div>`;
  document.getElementById('modal-backdrop').classList.add('open');
}

async function submitRejectAdvance(advId) {
  const reason = document.getElementById('f-rej-reason').value.trim();
  if (!reason) { showToast('Please provide a reason', 'error'); return; }
  const { error } = await sb.from('advance_requests').update({
    status: 'rejected',
    approved_by: STATE.profile?.id,
    note: `REJECTED: ${esc(reason)}`
  }).eq('id', advId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Request rejected with reason noted', 'success');
  closeModal(); loadAllData();
}

// ── Download Job Finance PDF ─────────────────────────────────────
function downloadJobFinancePDF(jobId) {
  const d   = STATE.data;
  const job = d.jobs.find(j=>j.id===jobId);
  const quote = d.quotations.filter(q=>q.job_id===jobId&&q.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
  const items = quote?.quotation_items||[];
  const advances = d.advances.filter(a=>a.job_id===jobId);
  const expenses = d.expenses.filter(e=>e.job_id===jobId&&e.status==='approved');
  const payments = d.payments.filter(p=>p.job_id===jobId&&p.status==='verified');
  const reports  = d.dailyReports.filter(r=>r.job_id===jobId).sort((a,b)=>new Date(a.date)-new Date(b.date));

  const matQ = items.filter(i=>i.category==='material').reduce((s,i)=>s+i.total_price,0);
  const labQ = items.filter(i=>i.category==='labour').reduce((s,i)=>s+i.total_price,0);
  const othQ = items.filter(i=>i.category==='other').reduce((s,i)=>s+i.total_price,0);
  const totalExp = expenses.reduce((s,e)=>s+(e.total_amount||0),0);
  const totalRec = payments.reduce((s,p)=>s+(p.amount||0),0);
  const totalRel = advances.reduce((s,a)=>s+(a.released_amount||0),0);
  const profit   = (quote?.final_amount||0) - totalExp;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Financial Report — ${esc(job?.customer_name)}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:24px;color:#1e293b;font-size:13px}
    h1{font-size:20px;margin:0}.header{display:flex;justify-content:space-between;padding-bottom:16px;border-bottom:3px solid #1976D2;margin-bottom:20px}
    .brand{color:#1976D2;font-weight:700;font-size:18px}.meta{text-align:right;color:#64748b;font-size:12px}
    .section{margin-bottom:20px}.section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#1976D2;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .box{background:#f8fafc;border-radius:6px;padding:10px;text-align:center}.box-label{font-size:10px;color:#94a3b8;text-transform:uppercase;margin-bottom:2px}.box-val{font-weight:700;font-size:15px}
    table{width:100%;border-collapse:collapse;font-size:12px}.th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:11px;color:#64748b;font-weight:600}
    td{padding:6px 8px;border-bottom:1px solid #f1f5f9}.total-row td{font-weight:700;background:#f8fafc;border-top:2px solid #e2e8f0}
    .green{color:#15803d}.red{color:#be123c}.blue{color:#1976D2}
    .footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    @media print{body{padding:12px}}
  </style></head><body>
  <div class="header">
    <div><div class="brand">Handy sQuad</div><div style="color:#64748b;font-size:12px">Field Management System</div></div>
    <div class="meta"><strong style="font-size:15px;color:#1e293b">${esc(job?.customer_name)}</strong><br>${esc(job?.location_text||'')}<br>Report: ${new Date().toLocaleDateString('en-IN')}<br>Status: ${(job?.status||'').toUpperCase()}</div>
  </div>

  <div class="section">
    <div class="section-title">Quotation Breakdown</div>
    <div class="grid3" style="margin-bottom:10px">
      <div class="box"><div class="box-label">Material</div><div class="box-val blue">₹${matQ.toLocaleString('en-IN')}</div></div>
      <div class="box"><div class="box-label">Labour</div><div class="box-val green">₹${labQ.toLocaleString('en-IN')}</div></div>
      <div class="box"><div class="box-label">Other</div><div class="box-val" style="color:#7e22ce">₹${othQ.toLocaleString('en-IN')}</div></div>
    </div>
    <table><thead><tr><th class="th">Category</th><th class="th">Amount</th></tr></thead><tbody>
      <tr><td>Subtotal (Mat+Lab+Other)</td><td>₹${(matQ+labQ+othQ).toLocaleString('en-IN')}</td></tr>
      <tr><td>Profit Margin Added</td><td>₹${(quote?.profit_added||0).toLocaleString('en-IN')}</td></tr>
      <tr><td>GST (${quote?.gst||0}%)</td><td>₹${Math.round(((matQ+labQ+othQ)+(quote?.profit_added||0))*(quote?.gst||0)/100).toLocaleString('en-IN')}</td></tr>
      <tr class="total-row"><td>Final Quoted Amount</td><td class="blue">₹${(quote?.final_amount||0).toLocaleString('en-IN')}</td></tr>
    </tbody></table>
  </div>

  <div class="section">
    <div class="section-title">Payment Requests & Fund Releases</div>
    <table><thead><tr><th class="th">Date</th><th class="th">Material</th><th class="th">Labour</th><th class="th">Other</th><th class="th">Total Req.</th><th class="th">Released</th><th class="th">Status</th></tr></thead>
    <tbody>${advances.map(a=>`<tr><td>${new Date(a.created_at).toLocaleDateString('en-IN')}</td><td>₹${(a.material_amount||0).toLocaleString('en-IN')}</td><td>₹${(a.labour_amount||0).toLocaleString('en-IN')}</td><td>₹${(a.other_amount||0).toLocaleString('en-IN')}</td><td><strong>₹${(a.total_amount||0).toLocaleString('en-IN')}</strong></td><td class="green">₹${(a.released_amount||0).toLocaleString('en-IN')}</td><td>${a.status}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="5">Total Released</td><td class="green">₹${totalRel.toLocaleString('en-IN')}</td><td></td></tr></tbody></table>
  </div>

  <div class="section">
    <div class="section-title">Approved Expenses</div>
    <table><thead><tr><th class="th">Description</th><th class="th">Amount</th><th class="th">Date</th></tr></thead>
    <tbody>${esc(expenses.map(e=>`<tr><td>${e.description||'—')}</td><td>₹${(e.total_amount||0).toLocaleString('en-IN')}</td><td>${new Date(e.created_at).toLocaleDateString('en-IN')}</td></tr>`).join('')}
    <tr class="total-row"><td>Total Expenses</td><td class="red">₹${totalExp.toLocaleString('en-IN')}</td><td></td></tr></tbody></table>
  </div>

  <div class="grid2 section">
    <div>
      <div class="section-title">Customer Payments Received</div>
      <table><thead><tr><th class="th">Type</th><th class="th">Amount</th><th class="th">Date</th></tr></thead>
      <tbody>${payments.map(p=>`<tr><td>${p.type}</td><td class="green">₹${(p.amount||0).toLocaleString('en-IN')}</td><td>${new Date(p.created_at).toLocaleDateString('en-IN')}</td></tr>`).join('')}
      <tr class="total-row"><td>Total</td><td class="green">₹${totalRec.toLocaleString('en-IN')}</td><td></td></tr></tbody></table>
    </div>
    <div>
      <div class="section-title">P&L Summary</div>
      <table><tbody>
        <tr><td>Quoted Amount</td><td class="blue">₹${(quote?.final_amount||0).toLocaleString('en-IN')}</td></tr>
        <tr><td>Total Expenses</td><td class="red">₹${totalExp.toLocaleString('en-IN')}</td></tr>
        <tr><td>Customer Received</td><td class="green">₹${totalRec.toLocaleString('en-IN')}</td></tr>
        <tr class="total-row"><td>Gross Profit</td><td class="${profit>=0?'green':'red'}">₹${profit.toLocaleString('en-IN')}</td></tr>
        <tr><td>Actual Margin</td><td class="${profit>=0?'green':'red'}">${(quote?.final_amount||0)>0?(((profit/(quote?.final_amount||1))*100).toFixed(1)):'0'}%</td></tr>
      </tbody></table>
    </div>
  </div>

  ${reports.length>0?`<div class="section"><div class="section-title">Work Log Summary (${reports.length} days)</div>
  <table><thead><tr><th class="th">Date</th><th class="th">Tasks</th><th class="th">Progress</th><th class="th">Workers</th><th class="th">Expense</th></tr></thead>
  <tbody>${reports.map(r=>`<tr><td>${new Date(r.date).toLocaleDateString('en-IN')}</td><td>${esc(r.actual_tasks||'—')}</td><td>${esc(r.progress_done||'—')}</td><td>${r.labor_used||0}</td><td>₹${(r.actual_expense||0).toLocaleString('en-IN')}</td></tr>`).join('')}</tbody></table></div>`:''}

  <div class="footer">Handy sQuad Field Management · Generated ${new Date().toLocaleString('en-IN')} · Confidential</div>
  </body></html>`;

  const blob = new Blob([html],{type:'text/html'});
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url,'_blank');
  if (win) win.addEventListener('load', ()=>win.print());
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  showToast('PDF report opened — use Print to save', 'success');
}

// renderJobFinancials is defined in pages.js — do NOT override it here.
// (Previously this stub caused the Job Financials page to show the accounts dashboard instead.)
