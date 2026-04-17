// ─── QUOTATION SYSTEM ────────────────────────────────────────────
// Holds line items while building a quotation
let QUOTE_ITEMS = [];

// Show customer/location info when job selection changes in the quotation form
function updateQuoteJobInfo() {
  const jobId = document.getElementById('f-qjob')?.value;
  const job = STATE.data.jobs.find(j => j.id === jobId);
  const infoEl = document.getElementById('quote-job-info');
  if (!infoEl) return;
  if (!job) { infoEl.style.display = 'none'; return; }
  infoEl.style.display = 'block';
  infoEl.innerHTML = '<div style="background:var(--blue-50);border-radius:8px;padding:10px 14px;font-size:13px">' +
    '<strong>' + esc(job.customer_name||'') + '</strong>' +
    (job.customer_phone ? ' · ' + esc(job.customer_phone) : '') +
    (job.location_text  ? '<div style="color:var(--gray-500);margin-top:2px">' + esc(job.location_text) + '</div>' : '') +
    '</div>';
}

function newQuotationForm() {
  const role = STATE.role;
  QUOTE_ITEMS = [];
  return `
  <div style="max-height:75vh;overflow-y:auto;padding-right:4px">
    <div class="form-row-single form-group">
      <label class="form-label">Job / Customer</label>
      <select class="form-select" id="f-qjob" onchange="updateQuoteJobInfo()">${jobOptions()}</select>
    </div>
    <div id="quote-job-info" style="display:none;margin-bottom:8px"></div>
    <div class="form-row-single form-group">
      <label class="form-label">Scope of Work / Description</label>
      <textarea class="form-textarea" id="f-qdesc" placeholder="Describe the overall work scope, site conditions, special requirements..."></textarea>
    </div>

    <!-- LINE ITEMS -->
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label class="form-label" style="margin:0">Line Items</label>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn-sm btn-approve" onclick="addQuoteItem('material')">+ Material</button>
          <button type="button" class="btn-sm btn-verify" onclick="addQuoteItem('labour')">+ Labour</button>
          <button type="button" class="btn-sm" style="background:var(--purple-50);color:var(--purple-700);border:1px solid var(--purple-100)" onclick="addQuoteItem('other')">+ Other</button>
        </div>
      </div>
      <div id="quote-items-container">
        <div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px;border:1px dashed var(--gray-200);border-radius:8px">
          Add items using the buttons above
        </div>
      </div>
    </div>

    <!-- SUMMARY BOX -->
    <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.4px">Material</div>
          <div style="font-weight:600;font-size:15px;color:var(--blue-700)" id="q-sum-material">₹0</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.4px">Labour</div>
          <div style="font-weight:600;font-size:15px;color:var(--green-700)" id="q-sum-labour">₹0</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.4px">Other</div>
          <div style="font-weight:600;font-size:15px;color:var(--purple-700)" id="q-sum-other">₹0</div>
        </div>
      </div>
      <div style="border-top:1px solid var(--gray-200);padding-top:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:13px;color:var(--gray-600)">Subtotal</span>
          <span style="font-weight:600" id="q-subtotal">₹0</span>
        </div>
        ${role==='scheduling'?`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:13px;color:var(--gray-600)">Profit Margin (₹)</span>
          <input type="number" id="f-qprofit" style="width:100px;padding:4px 8px;border:1px solid var(--gray-200);border-radius:6px;font-size:13px;text-align:right" placeholder="0" oninput="recalcQuoteTotals()"/>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:13px;color:var(--gray-600)">GST (%)</span>
          <input type="number" id="f-qgst" style="width:100px;padding:4px 8px;border:1px solid var(--gray-200);border-radius:6px;font-size:13px;text-align:right" placeholder="18" oninput="recalcQuoteTotals()"/>
        </div>`:`
        <div style="background:var(--amber-50);border:1px solid var(--amber-100);padding:8px 10px;border-radius:6px;font-size:12px;color:var(--amber-700);margin-bottom:6px">
          Profit &amp; GST will be added by Scheduling after review.
        </div>`}
        <div style="display:flex;justify-content:space-between;border-top:1px solid var(--gray-300);padding-top:8px;margin-top:6px">
          <span style="font-weight:600;font-size:14px">Final Amount</span>
          <span style="font-weight:700;font-size:16px;color:var(--blue-700)" id="q-final">₹0</span>
        </div>
      </div>
    </div>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancel</button>
    <button class="btn-submit" onclick="submitQuotation()">Save Draft</button>
  </div>`;
}

function addQuoteItem(category) {
  const id = 'qi_' + Date.now();
  QUOTE_ITEMS.push({ id, category, item_name:'', description:'', quantity:1, unit_price:0, total_price:0 });
  renderQuoteItems();
}

function removeQuoteItem(id) {
  QUOTE_ITEMS = QUOTE_ITEMS.filter(i => i.id !== id);
  renderQuoteItems();
}

function updateQuoteItem(id, field, value) {
  const item = QUOTE_ITEMS.find(i => i.id === id);
  if (!item) return;
  item[field] = field === 'quantity' || field === 'unit_price' ? parseFloat(value)||0 : value;
  item.total_price = item.quantity * item.unit_price;
  recalcQuoteTotals();
  // Update the total display for this row only
  const totalEl = document.getElementById('qi-total-' + id);
  if (totalEl) totalEl.textContent = '₹' + fmt(item.total_price);
}

const CAT_COLOR = { material: 'var(--blue-700)', labour: 'var(--green-700)', other: 'var(--purple-700)' };
const CAT_BG    = { material: 'var(--blue-50)',  labour: 'var(--green-50)',   other: 'var(--purple-50)'  };

function renderQuoteItems() {
  const container = document.getElementById('quote-items-container');
  if (!container) return;
  if (QUOTE_ITEMS.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px;border:1px dashed var(--gray-200);border-radius:8px">Add items using the buttons above</div>`;
    recalcQuoteTotals();
    return;
  }
  container.innerHTML = QUOTE_ITEMS.map(item => `
    <div style="border:1px solid var(--gray-200);border-radius:8px;padding:10px;margin-bottom:8px;background:white">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:${CAT_BG[item.category]};color:${CAT_COLOR[item.category]}">${item.category.toUpperCase()}</span>
        <button type="button" onclick="removeQuoteItem('${item.id}')" style="background:none;border:none;color:var(--gray-400);cursor:pointer;font-size:16px;line-height:1">×</button>
      </div>
      <div class="form-row" style="margin-bottom:6px">
        <div class="form-group">
          <input class="form-input" style="font-size:13px;padding:6px 10px" placeholder="Item name" value="${item.item_name}"
            oninput="updateQuoteItem('${item.id}','item_name',this.value)"/>
        </div>
        <div class="form-group">
          <input class="form-input" style="font-size:13px;padding:6px 10px" placeholder="Description (optional)" value="${esc(item.description)}"
            oninput="updateQuoteItem('${item.id}','description',this.value)"/>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center">
        <div>
          <div style="font-size:11px;color:var(--gray-500);margin-bottom:3px">Qty</div>
          <input class="form-input" type="number" style="font-size:13px;padding:6px 10px" value="${item.quantity}" min="0"
            oninput="updateQuoteItem('${item.id}','quantity',this.value)"/>
        </div>
        <div>
          <div style="font-size:11px;color:var(--gray-500);margin-bottom:3px">Unit Price (₹)</div>
          <input class="form-input" type="number" style="font-size:13px;padding:6px 10px" value="${item.unit_price}" min="0"
            oninput="updateQuoteItem('${item.id}','unit_price',this.value)"/>
        </div>
        <div>
          <div style="font-size:11px;color:var(--gray-500);margin-bottom:3px">Total</div>
          <div id="qi-total-${item.id}" style="font-weight:600;font-size:14px;color:${CAT_COLOR[item.category]};padding:6px 0">₹${fmt(item.total_price)}</div>
        </div>
      </div>
    </div>`).join('');
  recalcQuoteTotals();
}

function recalcQuoteTotals() {
  const matTotal  = QUOTE_ITEMS.filter(i=>i.category==='material').reduce((s,i)=>s+i.total_price,0);
  const labTotal  = QUOTE_ITEMS.filter(i=>i.category==='labour').reduce((s,i)=>s+i.total_price,0);
  const othTotal  = QUOTE_ITEMS.filter(i=>i.category==='other').reduce((s,i)=>s+i.total_price,0);
  const subtotal  = matTotal + labTotal + othTotal;
  const profit    = parseFloat(document.getElementById('f-qprofit')?.value)||0;
  const gst       = parseFloat(document.getElementById('f-qgst')?.value)||0;
  const finalAmt  = (subtotal + profit) * (1 + gst/100);

  const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('q-sum-material', '₹'+fmt(matTotal));
  set('q-sum-labour',   '₹'+fmt(labTotal));
  set('q-sum-other',    '₹'+fmt(othTotal));
  set('q-subtotal',     '₹'+fmt(subtotal));
  set('q-final',        '₹'+fmt(finalAmt));
}

// Keep old function name as alias
function calcQuoteTotal() { recalcQuoteTotals(); }

async function submitQuotation() {
  const jobId = document.getElementById('f-qjob').value;
  const desc  = document.getElementById('f-qdesc')?.value.trim() || '';
  if (!jobId) { showToast('Please select a job', 'error'); return; }
  if (QUOTE_ITEMS.length === 0) { showToast('Add at least one line item', 'error'); return; }

  const matTotal = QUOTE_ITEMS.filter(i=>i.category==='material').reduce((s,i)=>s+i.total_price,0);
  const labTotal = QUOTE_ITEMS.filter(i=>i.category==='labour').reduce((s,i)=>s+i.total_price,0);
  const othTotal = QUOTE_ITEMS.filter(i=>i.category==='other').reduce((s,i)=>s+i.total_price,0);
  const subtotal = matTotal + labTotal + othTotal;
  const profit   = parseFloat(document.getElementById('f-qprofit')?.value)||0;
  const gst      = parseFloat(document.getElementById('f-qgst')?.value)||0;
  const final    = (subtotal + profit) * (1 + gst/100);
  const existing = STATE.data.quotations.filter(q=>q.job_id===jobId);
  const maxVer = existing.reduce((m,q) => Math.max(m, q.version||0), 0);

  const { data: qData, error } = await sb.from('quotations').insert({
    job_id: jobId,
    version: maxVer + 1,
    subtotal, profit_added: profit, gst,
    final_amount: Math.round(final),
    status: 'draft',
    created_by: STATE.profile?.id,
    document_url: desc  // reuse document_url to store description until schema has a field
  }).select().single();

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Save all line items
  const itemRows = QUOTE_ITEMS.map(i => ({
    quotation_id: qData.id,
    item_name:    i.item_name || '(unnamed)',
    description:  i.description,
    category:     i.category,
    quantity:     i.quantity,
    unit_price:   i.unit_price,
    total_price:  i.total_price
  }));
  if (qData && itemRows.length > 0) {
    const { error: itemErr } = await sb.from('quotation_items').insert(itemRows);
    if (itemErr) { showToast('Items save error: ' + itemErr.message, 'error'); return; }
  }

  QUOTE_ITEMS = [];
  showToast('Quotation saved with ' + itemRows.length + ' items!', 'success');
  closeModal(); loadAllData();
}

function assignManagerForm() {
  const managers = STATE.data.allUsers?.filter(u => u.role === 'manager') || [];
  const managerOptions = managers.length > 0
    ? managers.map(m => `<option value="${m.id}">${m.name}</option>`).join('')
    : `<option value="">No managers found</option>`;
  return `
    <div class="form-row-single form-group"><label class="form-label">Job</label><select class="form-select" id="f-amjob">${jobOptions()}</select></div>
    <div class="form-row-single form-group"><label class="form-label">Assign Manager</label><select class="form-select" id="f-ammanager">${managerOptions}</select></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button><button class="btn-submit" onclick="submitAssignManager()">Assign</button></div>`;
}

async function submitAssignManager() {
  const jobId = document.getElementById('f-amjob').value;
  const managerId = document.getElementById('f-ammanager').value;
  if (!managerId) { showToast('No manager selected', 'error'); return; }
  // Only update the manager assignment — do NOT force status to active.
  // The job must progress through the normal workflow stages.
  const { error } = await sb.from('jobs').update({
    assigned_manager_id: managerId
  }).eq('id', jobId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Manager assigned!', 'success');
  closeModal(); loadAllData();
}

function releaseFundsForm(advanceId) {
  const advances = STATE.data.advances.filter(a => a.status === 'approved');
  const advOptions = advances.length > 0
    ? advances.map(a => `<option value="${a.id}" ${a.id===advanceId?'selected':''}>${esc(a.jobs?.customer_name||'Job')} — ₹${fmt(a.approved_amount||a.total_amount||0)} approved</option>`).join('')
    : `<option value="">No approved advances</option>`;
  return `
    <div class="form-row-single form-group"><label class="form-label">Advance Request</label>
      <select class="form-select" id="f-rfadv">${advOptions}</select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Amount to Release (₹)</label>
        <input class="form-input" id="f-rfamt" type="number" placeholder="0"/></div>
      <div class="form-group"><label class="form-label">Release Method</label>
        <select class="form-select" id="f-rfmethod">
          <option value="cash">Cash</option>
          <option value="bank">Bank Transfer</option>
          <option value="upi">UPI</option>
        </select></div>
    </div>
    <div class="form-row-single form-group"><label class="form-label">Reference / Note</label>
      <input class="form-input" id="f-rfnote" placeholder="Transaction ID, cheque no, or note"/></div>
    <div class="form-actions"><button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" onclick="submitFundRelease()">Release Funds</button></div>`;
}

async function submitFundRelease() {
  const advId  = document.getElementById('f-rfadv').value;
  const amount = parseFloat(document.getElementById('f-rfamt').value);
  const method = document.getElementById('f-rfmethod').value;
  const note   = document.getElementById('f-rfnote').value.trim();
  if (!advId || !amount || amount <= 0) { showToast('Select advance and enter amount', 'error'); return; }
  const adv = STATE.data.advances.find(a => a.id === advId);
  // Insert fund release record
  const { error } = await sb.from('fund_releases').insert({
    job_id: adv?.job_id,
    advance_request_id: advId,
    amount, release_method: method, note,
    released_by: STATE.profile?.id
  });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  // Update advance status to released
  await sb.from('advance_requests').update({
    status: 'released',
    released_amount: amount,
    released_at: new Date().toISOString()
  }).eq('id', advId);
  showToast(`₹${fmt(amount)} released via ${method}!`, 'success');
  closeModal(); loadAllData();
}

async function deleteQuotation(qId) {
  if (!confirm('Delete this quotation draft? This cannot be undone.')) return;
  // Delete items first
  await sb.from('quotation_items').delete().eq('quotation_id', qId);
  const { error } = await sb.from('quotations').delete().eq('id', qId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Quotation deleted', 'success');
  loadAllData();
}
