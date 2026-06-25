import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { fmt, fmtDate } from '../utils'
import { Plus, X, Trash2, Pencil, Search, Receipt, Circle, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

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

function BillModal({ bill, onClose, onSave, clients, taxRate }) {
  const blankLine = () => ({ id: crypto.randomUUID(), description: '', qty: 1, rate: '' })
  const [form, setForm] = useState(bill || {
    clientId: '', clientName: '',
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    lines: [blankLine()],
    notes: '',
    applyTax: true,
  })

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const subtotal = form.lines.reduce((s, l) => s + parseFloat(l.qty || 0) * parseFloat(l.rate || 0), 0)
  const tax = form.applyTax ? subtotal * (taxRate / 100) : 0
  const total = subtotal + tax

  function setClient(id) {
    const c = clients.find(cl => cl.id === id)
    setForm(f => ({ ...f, clientId: id, clientName: c?.name || '' }))
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <span className="modal-title">{bill ? 'Edit Invoice' : 'New Invoice'}</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select className="form-select" value={form.clientId} onChange={e => setClient(e.target.value)}>
              <option value="">— Select Client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <label htmlFor="applyTax" className="form-label" style={{ marginBottom: 0 }}>
              Apply {taxRate}% VAT
            </label>
          </div>
        </div>

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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 0 }}>
          <div style={{
            background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', padding: '12px 16px',
            minWidth: 220,
          }}>
            {[
              { label: 'Subtotal', val: fmt(subtotal) },
              { label: `VAT (${taxRate}%)`, val: fmt(tax) },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{r.val}</span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid var(--border2)', paddingTop: 8,
              fontWeight: 700, fontSize: 14,
            }}>
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
            onClick={() => onSave({ ...form, subtotal, tax, total })}>
            {bill ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_ICONS = {
  paid: <CheckCircle size={10} />,
  unpaid: <Clock size={10} />,
  overdue: <AlertTriangle size={10} />,
}

export default function Billing() {
  const { bills, addBill, updateBill, deleteBill, clients, settings } = useStore()
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = bills.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = b.number.toLowerCase().includes(q) ||
      (b.clientName || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    return matchSearch && matchStatus
  })

  function markPaid(id) { updateBill(id, { status: 'paid' }) }
  function markOverdue(id) { updateBill(id, { status: 'overdue' }) }

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
                      {b.status !== 'paid' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => markPaid(b.id)}>
                          <CheckCircle size={12} /> Paid
                        </button>
                      )}
                      {b.status === 'unpaid' && (
                        <button className="icon-btn" onClick={() => markOverdue(b.id)} title="Mark overdue">
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
          taxRate={settings.taxRate}
          onClose={() => setModal(null)}
          onSave={form => {
            if (modal === 'new') addBill(form)
            else updateBill(modal.id, form)
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
