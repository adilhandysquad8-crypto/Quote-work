// ─── PAGE RENDERERS ──────────────────────────────────────────────
function renderLeads() {
  const d = STATE.data;
  const role = STATE.role;
  if (!FILTERS['leads']) FILTERS['leads'] = {};
  const filtered = applyFilters(d.leads, 'leads', { searchFields: ['customer_name','location_text','requirement_summary','customer_phone'] });
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="text-muted text-sm">${filtered.length} of ${d.leads.length} leads</div>
      ${role==='sales'?`<button class="btn-submit" onclick="openModal('new-lead')">+ New Lead</button>`:''}
    </div>
    ${filterBar('leads', {
      searchPlaceholder: 'Search customer, location...',
      statuses: ['new','contacted','site_visit_requested','converted','lost'],
      dateFilter: true
    })}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th>Requirement</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
        ${filtered.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No leads match filters</div></div></td></tr>` :
          filtered.map(l => `<tr>
            <td data-label="Customer"><strong>${l.customer_name||'—'}</strong></td>
            <td data-label="Phone">${esc(l.customer_phone||'—')}</td>
            <td data-label="Location">${l.location_link ? `<a href="${l.location_link}" target="_blank" class="loc-badge">📍 Map</a>` : l.location_text||'—'}</td>
            <td data-label="Requirement" style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.requirement_summary||'—')}</td>
            <td data-label="Status"><span class="job-status ${leadStatusClass(l.status)}">${(l.status||'—').replace(/_/g,' ')}</span></td>
            <td data-label="Created">${fmtDate(l.created_at)}</td>
            <td data-label="Actions">
              ${role==='scheduling'&&(l.status==='new'||l.status==='site_visit_requested')?
                `<button class="btn-sm btn-approve" onclick="convertLeadToVisit('${l.id}')">Schedule Visit</button>`:''
              }
              ${(()=>{
                const sv = STATE.data.siteVisits.find(v=>STATE.data.jobs.find(j=>j.lead_id===l.id)&&v.job_id===STATE.data.jobs.find(j=>j.lead_id===l.id)?.id);
                return sv&&role==='sales'&&sv.status==='scheduled'?
                  `<button class="btn-sm" style="background:var(--red-50);color:var(--red-700);border:1px solid var(--red-100)" onclick="deleteSiteVisit('${sv.id}','${l.id}')">✕ Cancel Visit</button>`:'';
              })()}
              ${!['scheduling'].includes(role)&&role!=='sales'?'—':''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderJobs() {
  if (!FILTERS['jobs']) FILTERS['jobs'] = {};
  const d = STATE.data;
  const role = STATE.role;
  const filtered = applyFilters(d.jobs, 'jobs', { searchFields: ['customer_name','location_text','customer_phone'] });
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="text-muted text-sm">${filtered.length} of ${d.jobs.length} jobs</div>
    </div>
    ${filterBar('jobs', {
      searchPlaceholder: 'Search customer, location...',
      statuses: ['site_visit','quotation','pending_approval','active','completed','delayed','rework'],
      dateFilter: true
    })}
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Customer</th><th>Location</th>${role==='scheduling'?'<th>Manager</th>':''}<th>Status</th>${role==='sales'?'<th>Site Visit</th><th>Quotation</th>':''}${role!=='sales'?'<th>Progress</th>':''}${role!=='sales'?'<th>Quoted</th>':''}<th>Created</th></tr></thead>
        <tbody>
        ${filtered.length === 0 ? `<tr><td colspan="20"><div class="empty-state"><div class="empty-icon">▣</div><div class="empty-text">No jobs match filters</div></div></td></tr>` :
          filtered.map((j,i) => {
            const bestQuote = d.quotations.filter(q=>q.job_id===j.id&&q.status!=='rejected').sort((a,b)=>b.version-a.version)[0];
            const visit = d.siteVisits.find(v=>v.job_id===j.id);
            return `<tr onclick="openJobDetail('${j.id}')" style="cursor:pointer">
              <td data-label="#"><span style="font-size:11px;color:var(--gray-400);font-family:monospace">${j.id?.substring(0,6).toUpperCase()}</span></td>
              <td data-label="Customer"><strong>${esc(j.customer_name||'—')}</strong></td>
              <td data-label="Location">${j.location_link ? `<a href="${j.location_link}" target="_blank" class="loc-badge" onclick="event.stopPropagation()">📍 Map</a>` : j.location_text||'—'}</td>
              ${role==='scheduling'?`<td data-label="Manager">${j.users?.name||'Unassigned'}</td>`:''}
              <td data-label="Status"><span class="job-status ${jobStatusClass(j.status)}">${(j.status||'—').replace(/_/g,' ')}</span></td>
              ${role==='sales'?`<td data-label="Site Visit">${visit?`<span class="job-status ${visitStatusClass(visit.status)}" style="font-size:11px">${visit.status}</span> ${fmtDate(visit.scheduled_date)}`:'<span style="color:var(--gray-400);font-size:12px">Not scheduled</span>'}</td>`:''}
              ${role==='sales'?`<td data-label="Quotation">${bestQuote?`<strong>₹${fmt(bestQuote.final_amount||0)}</strong> <span class="job-status ${quoteStatusClass(bestQuote.status)}" style="font-size:10px">${bestQuote.status}</span>`:'<span style="color:var(--gray-400);font-size:12px">No quote</span>'}</td>`:''}
              ${role!=='sales'?`<td data-label="Progress"><div class="progress-bar"><div class="progress-fill" style="width:${jobProgress(j)}%"></div></div><div class="text-sm text-muted">${jobProgress(j)}%</div></td>`:''}
              ${role!=='sales'?`<td data-label="Quoted"><strong style="color:var(--blue-700)">₹${fmt(bestQuote?.final_amount||0)}</strong></td>`:''}
              <td data-label="Created">${fmtDate(j.created_at)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderQuotations() {
  const d = STATE.data;
  const role = STATE.role;
  // Custom filter: search by customer name via joined jobs
  if (!FILTERS['quotations']) FILTERS['quotations'] = {};
  const f = FILTERS['quotations'] || {};
  let filtered = d.quotations;
  if (f.search) {
    const q = f.search.toLowerCase();
    filtered = filtered.filter(qt => (qt.jobs?.customer_name||'').toLowerCase().includes(q));
  }
  if (f.status) filtered = filtered.filter(qt => qt.status === f.status);
  if (f.dateFrom) filtered = filtered.filter(qt => new Date(qt.created_at) >= new Date(f.dateFrom));
  if (f.dateTo)   filtered = filtered.filter(qt => new Date(qt.created_at) <= new Date(f.dateTo + 'T23:59:59'));

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="text-muted text-sm">${filtered.length} of ${d.quotations.length} quotations</div>
      ${role==='manager'?`<button class="btn-submit" onclick="openModal('new-quotation')">+ Draft Quotation</button>`:''}
    </div>
    ${filterBar('quotations', {
      searchPlaceholder: 'Search customer...',
      statuses: ['draft','reviewed','sent','approved','rejected'],
      dateFilter: true
    })}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Quote #</th><th>Customer</th><th>Ver.</th><th>Items</th><th>Subtotal</th>${role!=='sales'?'<th>Profit</th><th>GST</th>':''}<th>Final</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
        ${filtered.length === 0 ? `<tr><td colspan="20"><div class="empty-state"><div class="empty-icon">◎</div><div class="empty-text">No quotations match filters</div></div></td></tr>` :
          filtered.map(q => `<tr>
            <td data-label="Quote#"><span style="font-family:monospace;font-size:11px;background:var(--gray-100);padding:2px 6px;border-radius:4px">Q-${q.id?.substring(0,6).toUpperCase()}</span></td>
            <td data-label="Customer"><strong>${esc(q.jobs?.customer_name||'—')}</strong></td>
            <td data-label="Ver">v${q.version||1}</td>
            <td data-label="Items"><span style="font-size:11px;background:var(--blue-50);color:var(--blue-700);padding:2px 7px;border-radius:20px">${(q.quotation_items||[]).length} items</span></td>
            <td data-label="Subtotal">₹${fmt(q.subtotal||0)}</td>
            ${role!=='sales'?`<td data-label="Profit">₹${fmt(q.profit_added||0)}</td><td data-label="GST">${q.gst||0}%</td>`:''}
            <td data-label="Final"><strong>₹${fmt(q.final_amount||0)}</strong></td>
            <td data-label="Status"><span class="job-status ${quoteStatusClass(q.status)}">${q.status||'—'}</span></td>
            <td data-label="Date">${fmtDate(q.created_at)}</td>
            <td data-label="Actions" style="white-space:nowrap">
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <button class="btn-sm btn-verify" onclick="viewQuotationDetail('${q.id}')">View</button>
                ${role==='scheduling'&&q.status==='draft'?`<button class="btn-sm btn-approve" onclick="openFinalizeModal('${q.id}')">Finalize</button>`:''}
                ${role==='scheduling'&&q.status==='draft'?`<button class="btn-sm" style="background:var(--red-50);color:var(--red-700);border:1px solid var(--red-100);padding:4px 8px" onclick="deleteQuotation('${q.id}')">🗑</button>`:''}
                ${(role==='scheduling'||role==='accounts')&&q.status!=='draft'?`<button class="btn-sm" style="background:var(--blue-50);color:var(--blue-700);border:1px solid var(--blue-100)" onclick="downloadQuotationPDF('${q.id}')">⬇ PDF</button>`:''}
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function viewQuotationDetail(qId) {
  const q = STATE.data.quotations.find(x => x.id === qId);
  if (!q) return;
  const items = q.quotation_items || [];
  const matItems = items.filter(i=>i.category==='material');
  const labItems = items.filter(i=>i.category==='labour');
  const othItems = items.filter(i=>i.category==='other');
  const itemTable = (list, color) => list.length === 0 ? '' : list.map(i =>
    `<tr><td style="padding:6px 8px">${i.item_name||'—'}</td><td style="padding:6px 8px;color:var(--gray-500)">${esc(i.description||'—')}</td><td style="padding:6px 8px;text-align:right">${i.quantity}</td><td style="padding:6px 8px;text-align:right">₹${fmt(i.unit_price)}</td><td style="padding:6px 8px;text-align:right;font-weight:600;color:${color}">₹${fmt(i.total_price)}</td></tr>`
  ).join('');
  const section = (title, list, color, bg) => list.length === 0 ? '' : `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:${color};background:${bg};padding:6px 10px;border-radius:6px;margin-bottom:4px">${title}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--gray-50)">${['Item','Description','Qty','Unit Price','Total'].map(h=>`<th style="padding:5px 8px;text-align:${h==='Item'||h==='Description'?'left':'right'};font-size:11px;color:var(--gray-500)">${h}</th>`).join('')}</tr></thead>
        <tbody>${itemTable(list,color)}</tbody>
      </table>
    </div>`;

  document.getElementById('modal-title').textContent = `Quotation v${q.version||1} — ${esc(q.jobs?.customer_name||'')}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="max-height:70vh;overflow-y:auto">
      ${q.document_url&&!q.document_url.startsWith('http')?`<div style="background:var(--blue-50);border-left:3px solid var(--blue-500);padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:14px;font-size:13px;color:var(--gray-700)">${q.document_url}</div>`:''}
      ${section('Materials', matItems, 'var(--blue-700)', 'var(--blue-50)')}
      ${section('Labour', labItems, 'var(--green-700)', 'var(--green-50)')}
      ${section('Other', othItems, 'var(--purple-700)', 'var(--purple-50)')}
      <div style="background:var(--gray-50);border-radius:8px;padding:12px;margin-top:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--gray-600)">Material</span><span>₹${fmt(matItems.reduce((s,i)=>s+i.total_price,0))}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--gray-600)">Labour</span><span>₹${fmt(labItems.reduce((s,i)=>s+i.total_price,0))}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--gray-600)">Other</span><span>₹${fmt(othItems.reduce((s,i)=>s+i.total_price,0))}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;padding-top:6px;border-top:1px solid var(--gray-200)"><span style="color:var(--gray-600)">Subtotal</span><span>₹${fmt(q.subtotal||0)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--gray-600)">Profit Added</span><span>₹${fmt(q.profit_added||0)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:var(--gray-600)">GST</span><span>${q.gst||0}%</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:2px solid var(--gray-300);padding-top:8px"><span>Total</span><span style="color:var(--blue-700)">₹${fmt(q.final_amount||0)}</span></div>
      </div>
      <div class="form-actions" style="margin-top:12px">
        <button class="btn-cancel" onclick="closeModal()">Close</button>
        ${STATE.role==='scheduling'||STATE.role==='accounts'?`<button class="btn-submit" onclick="closeModal();downloadQuotationPDF('${q.id}')">⬇ Download PDF</button>`:''}
      </div>
    </div>`;
  document.getElementById('modal-backdrop').classList.add('open');
}

function openFinalizeModal(qId) {
  const q = STATE.data.quotations.find(x => x.id === qId);
  if (!q) return;
  document.getElementById('modal-title').textContent = 'Finalize Quotation';
  document.getElementById('modal-body').innerHTML = `
    <div style="margin-bottom:14px;background:var(--blue-50);padding:10px 14px;border-radius:8px;font-size:13px">
      <strong>${esc(q.jobs?.customer_name)}</strong> · Subtotal: <strong>₹${fmt(q.subtotal||0)}</strong> · ${(q.quotation_items||[]).length} items
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Profit Margin (₹)</label>
        <input class="form-input" type="number" id="f-fin-profit" value="${q.profit_added||0}" oninput="calcFinalizeTotal(${q.subtotal||0})"/></div>
      <div class="form-group"><label class="form-label">GST (%)</label>
        <input class="form-input" type="number" id="f-fin-gst" value="${q.gst||18}" oninput="calcFinalizeTotal(${q.subtotal||0})"/></div>
    </div>
    <div style="display:flex;justify-content:space-between;background:var(--gray-50);padding:12px;border-radius:8px;margin-bottom:14px">
      <span style="font-weight:600">Final Amount</span>
      <span style="font-weight:700;font-size:18px;color:var(--blue-700)" id="f-fin-total">₹${fmt(q.final_amount||0)}</span>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" onclick="submitFinalizeQuotation('${qId}')">Finalize & Mark Reviewed</button>
    </div>`;
  document.getElementById('modal-backdrop').classList.add('open');
  calcFinalizeTotal(q.subtotal||0);
}

function calcFinalizeTotal(subtotal) {
  const profit = parseFloat(document.getElementById('f-fin-profit')?.value)||0;
  const gst    = parseFloat(document.getElementById('f-fin-gst')?.value)||0;
  const final  = (subtotal + profit) * (1 + gst/100);
  const el = document.getElementById('f-fin-total');
  if (el) el.textContent = '₹' + fmt(Math.round(final));
}

async function submitFinalizeQuotation(qId) {
  const q = STATE.data.quotations.find(x => x.id === qId);
  const profit = parseFloat(document.getElementById('f-fin-profit').value)||0;
  const gst    = parseFloat(document.getElementById('f-fin-gst').value)||0;
  const final  = Math.round((( q?.subtotal||0) + profit) * (1 + gst/100));
  const { error } = await sb.from('quotations').update({
    profit_added: profit, gst, final_amount: final,
    status: 'reviewed', reviewed_by: STATE.profile?.id
  }).eq('id', qId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Quotation finalized! Final: ₹' + fmt(final), 'success');
  closeModal(); loadAllData();
}

function downloadQuotationPDF(qId) {
  const q = STATE.data.quotations.find(x => x.id === qId);
  if (!q) return;
  const items = q.quotation_items || [];
  const job = STATE.data.jobs.find(j => j.id === q.job_id);
  const matItems = items.filter(i=>i.category==='material');
  const labItems = items.filter(i=>i.category==='labour');
  const othItems = items.filter(i=>i.category==='other');
  const matTotal = matItems.reduce((s,i)=>s+i.total_price,0);
  const labTotal = labItems.reduce((s,i)=>s+i.total_price,0);
  const othTotal = othItems.reduce((s,i)=>s+i.total_price,0);

  const itemRows = (list) => list.map(i => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #eee">${i.item_name||'—'}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;color:#666">${esc(i.description||'—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right">${i.quantity}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right">₹${(i.unit_price||0).toLocaleString('en-IN')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">₹${(i.total_price||0).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  const sectionBlock = (title, list, total, color) => list.length === 0 ? '' : `
    <tr><td colspan="5" style="background:${color}15;padding:6px 10px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:${color}">${title}</td></tr>
    ${itemRows(list)}
    <tr style="background:#f9f9f9"><td colspan="4" style="padding:6px 10px;text-align:right;font-weight:600">${title} Total</td><td style="padding:6px 10px;text-align:right;font-weight:700;color:${color}">₹${total.toLocaleString('en-IN')}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Quotation - ${esc(q.jobs?.customer_name||'')}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:32px;color:#1e293b;font-size:14px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1976D2}
    .brand{font-size:22px;font-weight:700;color:#1976D2}.brand span{font-size:13px;color:#64748b;font-weight:400;display:block}
    .meta{text-align:right;font-size:12px;color:#64748b}
    .meta strong{font-size:16px;color:#1e293b;display:block;margin-bottom:4px}
    .customer-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#94a3b8;margin-bottom:2px}
    .val{font-weight:600;font-size:14px}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#64748b}
    th:last-child,th:nth-child(3),th:nth-child(4){text-align:right}
    .totals{margin-left:auto;width:300px}
    .totals table{margin:0}
    .totals td{padding:6px 10px;border-bottom:1px solid #eee}
    .totals .grand{font-weight:700;font-size:16px;color:#1976D2;border-top:2px solid #1976D2}
    .desc{background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:20px;font-size:13px;color:#78350f}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
    @media print{body{padding:16px}}
  </style></head><body>
  <div class="header">
    <div><div class="brand">Handy sQuad <span>Field Management System</span></div></div>
    <div class="meta"><strong>QUOTATION</strong>Version ${q.version||1} · ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}<br>Status: ${(q.status||'').toUpperCase()}</div>
  </div>
  <div class="customer-box">
    <div><div class="lbl">Customer</div><div class="val">${esc(q.jobs?.customer_name||'—')}</div></div>
    <div><div class="lbl">Phone</div><div class="val">${esc(job?.customer_phone||'—')}</div></div>
    <div><div class="lbl">Location</div><div class="val">${esc(job?.location_text||'—')}</div></div>
    <div><div class="lbl">Quotation Date</div><div class="val">${new Date(q.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div></div>
  </div>
  ${q.document_url&&!q.document_url.startsWith('http')?`<div class="desc"><strong>Scope of Work:</strong> ${q.document_url}</div>`:''}
  <table>
    <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>
      ${sectionBlock('Materials', matItems, matTotal, '#1976D2')}
      ${sectionBlock('Labour', labItems, labTotal, '#15803d')}
      ${sectionBlock('Other', othItems, othTotal, '#7e22ce')}
    </tbody>
  </table>
  <div class="totals">
    <table>
      <tr><td>Material</td><td style="text-align:right">₹${matTotal.toLocaleString('en-IN')}</td></tr>
      <tr><td>Labour</td><td style="text-align:right">₹${labTotal.toLocaleString('en-IN')}</td></tr>
      <tr><td>Other</td><td style="text-align:right">₹${othTotal.toLocaleString('en-IN')}</td></tr>
      <tr><td>Subtotal</td><td style="text-align:right">₹${(q.subtotal||0).toLocaleString('en-IN')}</td></tr>
      <tr><td>Profit Added</td><td style="text-align:right">₹${(q.profit_added||0).toLocaleString('en-IN')}</td></tr>
      <tr><td>GST (${q.gst||0}%)</td><td style="text-align:right">₹${Math.round(((q.subtotal||0)+(q.profit_added||0))*(q.gst||0)/100).toLocaleString('en-IN')}</td></tr>
      <tr class="grand"><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>₹${(q.final_amount||0).toLocaleString('en-IN')}</strong></td></tr>
    </table>
  </div>
  <div class="footer">This is a computer-generated quotation. Handy sQuad Field Management System · Generated ${new Date().toLocaleString('en-IN')}</div>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => { win.print(); });
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast('PDF opened — use browser Print to save as PDF', 'success');
}

function renderPayments() {
  const d = STATE.data;
  const role = STATE.role;
  if (!FILTERS['payments']) FILTERS['payments'] = {};
  const f = FILTERS['payments'] || {};
  let filtered = d.payments;
  if (f.search) { const q=f.search.toLowerCase(); filtered=filtered.filter(p=>(p.jobs?.customer_name||'').toLowerCase().includes(q)); }
  if (f.status) filtered=filtered.filter(p=>p.status===f.status);
  if (f.dateFrom) filtered=filtered.filter(p=>new Date(p.created_at)>=new Date(f.dateFrom));
  if (f.dateTo)   filtered=filtered.filter(p=>new Date(p.created_at)<=new Date(f.dateTo+'T23:59:59'));

  const total = filtered.reduce((s,p)=>s+(p.amount||0),0);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="text-muted text-sm">${filtered.length} payments · Total: <strong>₹${fmt(total)}</strong></div>
      ${role==='sales'?`<button class="btn-submit" onclick="${STATE.data.jobs.length>0?`openModal('upload-payment')`:`showToast('No jobs found. Leads must be converted to jobs first.','error')`}">↑ Upload Proof</button>`:''}
    </div>
    ${filterBar('payments',{searchPlaceholder:'Search customer...',statuses:['pending','verified','rejected'],dateFilter:true})}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th>${role==='accounts'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${filtered.length===0?`<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">↑</div><div class="empty-text">No payments match filters</div></div></td></tr>`:
          filtered.map(p=>`<tr>
            <td data-label="Customer"><strong>${p.jobs?.customer_name||'—'}</strong></td>
            <td data-label="Type"><span class="pay-type ${p.type==='advance'?'pay-adv':'pay-fin'}">${p.type||'—'}</span></td>
            <td data-label="Amount"><strong style="font-family:'DM Mono',monospace">₹${fmt(p.amount||0)}</strong></td>
            <td data-label="Status"><span class="job-status ${payStatusClass(p.status)}">${p.status||'—'}</span></td>
            <td data-label="Date">${fmtDate(p.created_at)}</td>
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
  if (!FILTERS['expenses']) FILTERS['expenses'] = {};
  const f = FILTERS['expenses'] || {};
  let filtered = d.expenses;
  if (f.search) { const q=f.search.toLowerCase(); filtered=filtered.filter(e=>(e.jobs?.customer_name||e.description||'').toLowerCase().includes(q)); }
  if (f.status) filtered=filtered.filter(e=>e.status===f.status);
  if (f.dateFrom) filtered=filtered.filter(e=>new Date(e.created_at)>=new Date(f.dateFrom));
  if (f.dateTo)   filtered=filtered.filter(e=>new Date(e.created_at)<=new Date(f.dateTo+'T23:59:59'));

  const total = filtered.reduce((s,e)=>s+(e.total_amount||0),0);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="text-muted text-sm">${filtered.length} expenses · Total: <strong>₹${fmt(total)}</strong></div>
      ${role==='manager'?`<button class="btn-submit" onclick="openModal('new-expense')">+ Add Expense</button>`:''}
    </div>
    ${esc(filterBar('expenses',{searchPlaceholder:'Search customer, description...',statuses:['pending','approved','rejected'],dateFilter:true)})}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th>${role==='accounts'?'<th>Actions</th>':''}</tr></thead>
        <tbody>
        ${filtered.length===0?`<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">◈</div><div class="empty-text">No expenses match filters</div></div></td></tr>`:
          filtered.map(e=>`<tr>
            <td data-label="Customer"><strong>${e.jobs?.customer_name||'—'}</strong></td>
            <td data-label="Description">${esc(e.description||'—')}</td>
            <td data-label="Amount"><strong style="font-family:'DM Mono',monospace">₹${fmt(e.total_amount||0)}</strong></td>
            <td data-label="Status"><span class="job-status ${e.status==='approved'?'status-active':e.status==='rejected'?'status-rework':'status-pending'}">${e.status||'pending'}</span></td>
            <td data-label="Date">${fmtDate(e.created_at)}</td>
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
            <td>${esc(r.note||'—')}</td>
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
            <td>${esc(r.reason||'—')}</td>
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
            <td>${esc(v.reschedule_reason||'—')}</td>
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
            <td>${esc(p.planned_tasks||'—')}</td>
            <td>${esc(p.expected_progress||'—')}</td>
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
            <td>${esc(r.actual_tasks||'—')}</td>
            <td>${esc(r.progress_done||'—')}</td>
            <td>${r.labor_used||0} workers</td>
            <td>₹${fmt(r.actual_expense||0)}</td>
            <td style="color:var(--red-700)">${esc(r.issues||'None')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdvanceBalance() {
  const d = STATE.data;
  const uid = STATE.profile?.id;
  // Scope to only this manager's assigned jobs
  const myJobIds = new Set(
    d.jobs.filter(j => j.assigned_manager_id === uid).map(j => j.id)
  );
  const totalReleased = d.advances
    .filter(a => a.status === 'released' && myJobIds.has(a.job_id))
    .reduce((s,a) => s + (a.released_amount||0), 0);
  const totalSpent = d.expenses
    .filter(e => e.status === 'approved' && myJobIds.has(e.job_id))
    .reduce((s,e) => s + (e.total_amount||0), 0);
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
        ${esc(d.jobs.map(j => {
          const q = d.quotations.find(q=>q.job_id===j.id&&(q.status==='approved'||q.status==='sent'));
          const adv = d.advances.filter(a=>a.job_id===j.id);
          const advAppr = adv.filter(a=>a.status!=='rejected').reduce((s,a)=>s+(a.approved_amount||a.total_amount||0),0);
          const advRel = adv.reduce((s,a)=>s+(a.released_amount||0),0);
          const exp = d.expenses.filter(e=>e.job_id===j.id&&e.status==='approved').reduce((s,e)=>s+(e.total_amount||0),0);
          const payin = d.payments.filter(p=>p.job_id===j.id&&p.status==='verified').reduce((s,p)=>s+(p.amount||0),0);
          const balance = advRel - exp;
          return `<tr>
            <td><strong>${j.customer_name||'—')}</strong></td>
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
