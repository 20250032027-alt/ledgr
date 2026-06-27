import { useState, useRef } from 'react'
import { useStore } from '../store/useStore.jsx'
import { fmt, fmtDate } from '../utils'
import { Plus, X, Trash2, Pencil, Search, Receipt, CheckCircle, Clock, AlertTriangle, Printer } from 'lucide-react'

// ── Print Invoice ────────────────────────────────────────────────────────────
function printInvoice(bill, settings) {
  const w = window.open('', '_blank', 'width=900,height=700')
  const lines = bill.lines || []
  const subtotal = bill.subtotal ?? lines.reduce((s, l) => s + parseFloat(l.qty || 0) * parseFloat(l.rate || 0), 0)
  const tax = bill.tax ?? 0
  const total = bill.total ?? subtotal + tax
  const taxRate = settings.taxRate ?? 12

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${bill.number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 0; }
    .page { max-width: 780px; margin: 0 auto; padding: 48px 48px 60px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .firm-name { font-size: 24px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
    .firm-details { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.6; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 32px; font-weight: 900; color: #2563eb; letter-spacing: -1px; }
    .invoice-meta { font-size: 11px; color: #64748b; margin-top: 6px; line-height: 1.8; text-align: right; }
    .invoice-meta strong { color: #1a1a2e; }

    /* Divider */
    .divider { border: none; border-top: 2px solid #2563eb; margin: 0 0 32px; }

    /* Bill To */
    .bill-section { display: flex; justify-content: space-between; margin-bottom: 36px; gap: 24px; }
    .bill-to { flex: 1; }
    .bill-to .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; }
    .bill-to .client-name { font-size: 16px; font-weight: 700; color: #1a1a2e; }
    .bill-to .client-detail { font-size: 12px; color: #64748b; margin-top: 2px; }
    .status-badge { padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
    .status-paid { background: #dcfce7; color: #16a34a; }
    .status-unpaid { background: #fef3c7; color: #d97706; }
    .status-overdue { background: #fee2e2; color: #dc2626; }

    /* Line items */
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    thead tr { background: #1e293b; }
    thead th { padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; text-align: left; }
    thead th:last-child, thead th:nth-last-child(2), thead th:nth-last-child(3) { text-align: right; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 11px 14px; font-size: 13px; color: #334155; }
    tbody td:last-child, tbody td:nth-last-child(2), tbody td:nth-last-child(3) { text-align: right; font-family: 'Courier New', monospace; }

    /* Totals */
    .totals { display: flex; justify-content: flex-end; margin-top: 0; }
    .totals-box { width: 280px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 9px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .totals-row:last-child { border-bottom: none; background: #1e293b; color: #fff; font-weight: 800; font-size: 15px; }
    .totals-row span:last-child { font-family: 'Courier New', monospace; }
    .totals-label { color: #64748b; }

    /* Notes */
    .notes-section { margin-top: 36px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #2563eb; }
    .notes-section .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; }
    .notes-section p { font-size: 12px; color: #475569; line-height: 1.6; }

    /* Footer */
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 11px; color: #94a3b8; }
    .footer-right { font-size: 11px; color: #94a3b8; text-align: right; }

    /* Receivable accounts box */
    .ar-box { margin-bottom: 28px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; }
    .ar-box .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #3b82f6; margin-bottom: 6px; }
    .ar-entry { font-size: 12px; color: #1e40af; display: flex; justify-content: space-between; padding: 2px 0; }

    @media print {
      body { padding: 0; }
      .page { padding: 24px 32px; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="firm-name">${settings.company || 'Firm Name'}</div>
      <div class="firm-details">${settings.address ? settings.address.replace(/\n/g, '<br>') : ''}</div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-meta">
        <div>No. <strong>${bill.number}</strong></div>
        <div>Date: <strong>${bill.date || new Date().toISOString().slice(0, 10)}</strong></div>
        ${bill.dueDate ? `<div>Due: <strong>${bill.dueDate}</strong></div>` : ''}
      </div>
    </div>
  </div>

  <hr class="divider">

  <div class="bill-section">
    <div class="bill-to">
      <div class="label">Bill To</div>
      <div class="client-name">${bill.clientName || '—'}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Status</div>
      <span class="status-badge status-${bill.status || 'unpaid'}">${bill.status || 'unpaid'}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th style="width:12%;text-align:right">Qty</th>
        <th style="width:18%;text-align:right">Unit Price</th>
        <th style="width:20%;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map(l => {
        const amt = parseFloat(l.qty || 0) * parseFloat(l.rate || 0)
        return `<tr>
          <td>${l.description || '—'}</td>
          <td style="text-align:right">${l.qty}</td>
          <td style="text-align:right">${fmt(parseFloat(l.rate || 0))}</td>
          <td style="text-align:right">${fmt(amt)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span class="totals-label">Subtotal</span><span>${fmt(subtotal)}</span></div>
      <div class="totals-row"><span class="totals-label">VAT (${taxRate}%)</span><span>${fmt(tax)}</span></div>
      <div class="totals-row"><span>Total</span><span>${fmt(total)}</span></div>
    </div>
  </div>

  ${bill.notes ? `
  <div class="notes-section">
    <div class="label">Notes</div>
    <p>${bill.notes.replace(/\n/g, '<br>')}</p>
  </div>` : ''}

  <div class="footer">
    <div class="footer-left">Generated by Ledgr · ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="footer-right">Thank you for your business.</div>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
  w.document.close()
}

// ── LineRow ──────────────────────────────────────────────────────────────────
function LineRow({ line, onChange, onRemove }) {
  const subtotal = parseFloat(line.qty || 0) * parseFloat(line.rate || 0)
  return (
    <tr>
      <td>
        <input className="form-input" style={{ fontSize: 12, padding: '5px 8px' }}
          value={line.description} onChange={e => onChange({ ...line, description: e.target.value })}
          placeholder="Service / Item description" />
      </td>
      <td>
        <input className="form-input" style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}
          type="number" min="1" value={line.qty}
          onChange={e => onChange({ ...line, qty: e.target.value })} />
      </td>
      <td>
        <input className="form-input" style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}
          type="number" min="0" step="0.01" value={line.rate}
          onChange={e => onChange({ ...line, rate: e.target.value })} />
      </td>
      <td className="td-mono" style={{ textAlign: 'right', fontSize: 12 }}>{fmt(subtotal)}</td>
      <td>
        <button className="icon-btn" onClick={onRemove} style={{ color: 'var(--red)' }}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

// ── MarkPaidModal ────────────────────────────────────────────────────────────
function MarkPaidModal({ bill, onClose, onConfirm, cashAccounts }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cashAccount, setCashAccount] = useState(cashAccounts[0]?.name || 'Cash')

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">Mark as Paid — {bill.number}</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '4px 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          This will post a journal entry:
          <div style={{ margin: '10px 0', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.7 }}>
            DR {cashAccount}<br />
            &nbsp;&nbsp;CR Accounts Receivable<br />
            <span style={{ color: 'var(--text-3)' }}>Amount: {fmt(bill.total)}</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Deposit To (Cash / Bank Account)</label>
          <select className="form-select" value={cashAccount} onChange={e => setCashAccount(e.target.value)}>
            {cashAccounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            {cashAccounts.length === 0 && <option value="Cash">Cash</option>}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Only asset accounts shown.</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm({ paidDate: date, cashAccount })}>
            <CheckCircle size={14} /> Confirm Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ── BillModal ────────────────────────────────────────────────────────────────
function BillModal({ bill, onClose, onSave, clients, bills, accounts, taxRate }) {
  const blankLine = () => ({ id: crypto.randomUUID(), description: '', qty: 1, rate: '' })
  const [form, setForm] = useState(bill || {
    clientId: '', clientName: '',
    date: new Date().toISOString().slice(0, 10),
    dueDate: '', lines: [blankLine()], notes: '', applyTax: true,
    receivableAccount: '',
  })

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const subtotal = form.lines.reduce((s, l) => s + parseFloat(l.qty || 0) * parseFloat(l.rate || 0), 0)
  const tax = form.applyTax ? subtotal * (taxRate / 100) : 0
  const total = subtotal + tax

  function setClient(id) {
    const c = clients.find(cl => cl.id === id)
    setForm(f => ({ ...f, clientId: id, clientName: c?.name || '' }))
  }

  // Receivable accounts from CoA (asset type)
  const receivableAccounts = accounts.filter(a => a.type === 'asset')
  // Default to first account containing 'receivable' in name
  const defaultAR = receivableAccounts.find(a => a.name.toLowerCase().includes('receivable'))

  // Outstanding invoices for selected client
  const clientOutstanding = form.clientId
    ? bills.filter(b => b.clientId === form.clientId && b.status !== 'paid' && b.id !== bill?.id)
    : []
  const outstandingTotal = clientOutstanding.reduce((s, b) => s + parseFloat(b.total || 0), 0)

  // The receivable account that will be used
  const selectedAR = form.receivableAccount || defaultAR?.name || 'Accounts Receivable'

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 740 }}>
        <div className="modal-header">
          <span className="modal-title">{bill ? 'Edit Invoice' : 'New Invoice'}</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Client + dates */}
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select className="form-select" value={form.clientId} onChange={e => setClient(e.target.value)}>
              <option value="">— Select Client —</option>
              {clients.map(c => {
                const unpaid = bills.filter(b => b.clientId === c.id && b.status !== 'paid')
                return (
                  <option key={c.id} value={c.id}>
                    {c.name}{unpaid.length > 0 ? ` (${unpaid.length} unpaid)` : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Invoice Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={e => setF('dueDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
            <input type="checkbox" id="applyTax" checked={form.applyTax}
              onChange={e => setF('applyTax', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <label htmlFor="applyTax" className="form-label" style={{ marginBottom: 0 }}>Apply {taxRate}% VAT</label>
          </div>
        </div>

        {/* Receivable account selector */}
        <div style={{
          marginBottom: 14, padding: '10px 14px',
          background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', marginBottom: 8 }}>
            Accounting Entry Preview
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Debit (Receivable Account)</label>
              <select className="form-select" style={{ fontSize: 12 }}
                value={form.receivableAccount || defaultAR?.name || ''}
                onChange={e => setF('receivableAccount', e.target.value)}>
                {receivableAccounts.map(a => (
                  <option key={a.id} value={a.name}>
                    {a.code ? `${a.code} · ` : ''}{a.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', paddingTop: 18 }}>→</div>
            <div style={{ flex: 1, minWidth: 160, fontSize: 12, paddingTop: 18 }}>
              <div style={{ color: 'var(--text-3)', fontSize: 11 }}>Credit (Revenue)</div>
              <div style={{ fontWeight: 600, color: 'var(--green)' }}>Service Revenue</div>
            </div>
            {total > 0 && (
              <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 700, paddingTop: 18, color: 'var(--accent)' }}>
                {fmt(total)}
              </div>
            )}
          </div>
        </div>

        {/* Outstanding receivables warning */}
        {clientOutstanding.length > 0 && (
          <div style={{ marginBottom: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--amber, #f59e0b)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: 'var(--amber, #f59e0b)', display: 'flex', justifyContent: 'space-between' }}>
              <span>⚠ {form.clientName} has {clientOutstanding.length} unpaid invoice{clientOutstanding.length !== 1 ? 's' : ''}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{fmt(outstandingTotal)} outstanding</span>
            </div>
            <div style={{ padding: '0 12px' }}>
              {clientOutstanding.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{b.number}</span>
                    {b.date && <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{b.date}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>{fmt(b.total)}</span>
                    <span className={`badge ${b.status === 'overdue' ? 'badge-red' : 'badge-amber'}`}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line items */}
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Description</th>
                <th style={{ textAlign: 'right', width: '12%' }}>Qty</th>
                <th style={{ textAlign: 'right', width: '18%' }}>Rate</th>
                <th style={{ textAlign: 'right', width: '20%' }}>Amount</th>
                <th style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <LineRow key={l.id} line={l}
                  onChange={upd => setF('lines', form.lines.map((ll, idx) => idx === i ? upd : ll))}
                  onRemove={() => setF('lines', form.lines.filter((_, idx) => idx !== i))}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={() => setF('lines', [...form.lines, blankLine()])} style={{ marginBottom: 16 }}>
          <Plus size={13} /> Add Line
        </button>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '12px 16px', minWidth: 220 }}>
            {[{ label: 'Subtotal', val: fmt(subtotal) }, { label: `VAT (${taxRate}%)`, val: fmt(tax) }].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border2)', paddingTop: 8, fontWeight: 700, fontSize: 14 }}>
              <span>Total</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes}
            onChange={e => setF('notes', e.target.value)}
            placeholder="Payment terms, bank details, thank you note..." />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary"
            disabled={!form.clientId || form.lines.every(l => !l.rate)}
            onClick={() => onSave({ ...form, subtotal, tax, total, receivableAccount: form.receivableAccount || defaultAR?.name || 'Accounts Receivable' })}>
            {bill ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status icons ─────────────────────────────────────────────────────────────
const STATUS_ICONS = {
  paid: <CheckCircle size={10} />,
  unpaid: <Clock size={10} />,
  overdue: <AlertTriangle size={10} />,
}

// ── Main Billing Page ────────────────────────────────────────────────────────
export default function Billing() {
  const { bills, addBill, updateBill, deleteBill, clients, accounts, settings } = useStore()
  const [modal, setModal] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const cashAccounts = accounts.filter(a => a.type === 'asset')

  const filtered = bills.filter(b => {
    const q = search.toLowerCase()
    return (b.number.toLowerCase().includes(q) || (b.clientName || '').toLowerCase().includes(q))
      && (statusFilter === 'all' || b.status === statusFilter)
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Billing</div>
          <div className="page-sub">{bills.length} invoice{bills.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <Plus size={15} /> New Invoice
        </button>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--text-3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." />
        </div>
        <select className="form-select" style={{ width: 'auto', fontSize: 12 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Receipt size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No invoices found</div>
            <button className="btn btn-primary" onClick={() => setModal('new')}>
              <Plus size={14} /> New Invoice
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(b => (
                <tr key={b.id}>
                  <td className="td-mono" style={{ fontWeight: 600 }}>{b.number}</td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{b.clientName || '—'}</td>
                  <td className="td-mono">{b.date ? fmtDate(b.date + 'T00:00:00') : fmtDate(b.createdAt)}</td>
                  <td className="td-mono" style={{ color: b.status === 'overdue' ? 'var(--red)' : 'var(--text-2)' }}>
                    {b.dueDate ? fmtDate(b.dueDate + 'T00:00:00') : '—'}
                  </td>
                  <td>
                    <span className={`badge ${b.status === 'paid' ? 'badge-green' : b.status === 'overdue' ? 'badge-red' : 'badge-amber'}`}>
                      {STATUS_ICONS[b.status]} {b.status}
                    </span>
                  </td>
                  <td className="td-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                    {fmt(b.total, settings.currency)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title="Print Invoice"
                        onClick={() => printInvoice(b, settings)}>
                        <Printer size={14} />
                      </button>
                      {b.status !== 'paid' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setPayModal(b)}>
                          <CheckCircle size={12} /> Paid
                        </button>
                      )}
                      {b.status === 'unpaid' && (
                        <button className="icon-btn" onClick={() => updateBill(b.id, { status: 'overdue' })} title="Mark overdue">
                          <AlertTriangle size={13} />
                        </button>
                      )}
                      <button className="icon-btn" onClick={() => setModal(b)}><Pencil size={14} /></button>
                      <button className="icon-btn" onClick={() => deleteBill(b.id)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <BillModal
          bill={modal === 'new' ? null : modal}
          clients={clients}
          bills={bills}
          accounts={accounts}
          taxRate={settings.taxRate}
          onClose={() => setModal(null)}
          onSave={form => {
            if (modal === 'new') addBill(form)
            else updateBill(modal.id, form)
            setModal(null)
          }}
        />
      )}

      {payModal && (
        <MarkPaidModal
          bill={payModal}
          cashAccounts={cashAccounts}
          onClose={() => setPayModal(null)}
          onConfirm={({ paidDate, cashAccount }) => {
            updateBill(payModal.id, { status: 'paid', paidDate, cashAccount })
            setPayModal(null)
          }}
        />
      )}
    </div>
  )
}
