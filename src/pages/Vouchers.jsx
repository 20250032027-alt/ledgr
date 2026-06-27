import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { fmt, fmtDate, voucherTotals } from '../utils'
import { Plus, X, Trash2, Pencil, Search, CheckCircle, AlertCircle, FileText, Download, BookMarked, ChevronDown } from 'lucide-react'

const TYPES = ['general', 'cash receipt', 'cash disbursement', 'expense', 'adjustment']

const MONEY_FMT = '#,##0.00;(#,##0.00);"-"'

function setColumnMoneyFormat(XLSX, ws, rowCount, colIndexes) {
  colIndexes.forEach(c => {
    for (let r = 0; r < rowCount; r++) {
      const ref = XLSX.utils.encode_cell({ r: r + 1, c }) // +1 to skip header row
      if (ws[ref]) ws[ref].z = MONEY_FMT
    }
  })
}

async function exportVouchersToExcel(vouchers, clients) {
  const XLSX = await import('xlsx')
  const clientName = id => clients.find(c => c.id === id)?.name || ''

  const summaryRows = vouchers.map(v => {
    const { debit, credit, balanced } = voucherTotals(v.entries)
    const entries = v.entries || []
    const debitAccounts = entries.filter(e => parseFloat(e.debit || 0) > 0).map(e => e.account).filter(Boolean).join(', ')
    const creditAccounts = entries.filter(e => parseFloat(e.credit || 0) > 0).map(e => e.account).filter(Boolean).join(', ')
    return {
      'Voucher #': v.number,
      Type: v.type,
      Date: v.date || fmtDate(v.createdAt),
      Reference: v.reference || '',
      Client: clientName(v.clientId),
      Memo: v.memo || '',
      'Debit Account': debitAccounts,
      'Credit Account': creditAccounts,
      'Debit Total': debit,
      'Credit Total': credit,
      Balanced: balanced ? 'Yes' : 'No',
    }
  })

  const entryRows = []
  vouchers.forEach(v => {
    ;(v.entries || []).forEach(e => {
      entryRows.push({
        'Voucher #': v.number,
        Date: v.date || fmtDate(v.createdAt),
        Account: e.account || '',
        Description: e.description || '',
        Debit: parseFloat(e.debit || 0),
        Credit: parseFloat(e.credit || 0),
      })
    })
  })

  const wb = XLSX.utils.book_new()

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  setColumnMoneyFormat(XLSX, wsSummary, summaryRows.length, [8, 9])
  wsSummary['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 24 },
    { wch: 13 }, { wch: 13 }, { wch: 9 },
  ]

  const wsEntries = XLSX.utils.json_to_sheet(entryRows)
  setColumnMoneyFormat(XLSX, wsEntries, entryRows.length, [4, 5])
  wsEntries['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 13 }, { wch: 13 },
  ]

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Vouchers')
  XLSX.utils.book_append_sheet(wb, wsEntries, 'Entries')

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `ledgr-vouchers-${dateStr}.xlsx`)
}

function EntryRow({ entry, onChange, onRemove, index }) {
  return (
    <tr>
      <td>
        <input
          className="form-input"
          style={{ fontSize: 12, padding: '5px 8px' }}
          list="accounts-list"
          value={entry.account}
          onChange={e => onChange({ ...entry, account: e.target.value })}
          placeholder="Account name"
        />
      </td>
      <td>
        <input
          className="form-input"
          style={{ fontSize: 12, padding: '5px 8px' }}
          value={entry.description}
          onChange={e => onChange({ ...entry, description: e.target.value })}
          placeholder="Description"
        />
      </td>
      <td>
        <input
          className="form-input"
          style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}
          type="number"
          min="0"
          step="0.01"
          value={entry.debit}
          onChange={e => onChange({ ...entry, debit: e.target.value, credit: e.target.value ? '' : entry.credit })}
          placeholder="0.00"
        />
      </td>
      <td>
        <input
          className="form-input"
          style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}
          type="number"
          min="0"
          step="0.01"
          value={entry.credit}
          onChange={e => onChange({ ...entry, credit: e.target.value, debit: e.target.value ? '' : entry.debit })}
          placeholder="0.00"
        />
      </td>
      <td>
        <button className="icon-btn" onClick={onRemove} style={{ color: 'var(--red)' }}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}

function VoucherModal({ voucher, onClose, onSave, clients, accounts, templates, onSaveTemplate, onDeleteTemplate }) {
  const blankEntry = () => ({ account: '', description: '', debit: '', credit: '', id: crypto.randomUUID() })
  const [form, setForm] = useState(voucher || {
    type: 'general', date: new Date().toISOString().slice(0, 10),
    reference: '', memo: '', clientId: '', entries: [blankEntry(), blankEntry()],
  })

  // Template UI state
  const [showTemplates, setShowTemplates] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setEntry(i, e) {
    const entries = [...form.entries]
    entries[i] = e
    setF('entries', entries)
  }
  function removeEntry(i) {
    setF('entries', form.entries.filter((_, idx) => idx !== i))
  }
  function addEntry() { setF('entries', [...form.entries, blankEntry()]) }

  function applyTemplate(tpl) {
    setForm(f => ({
      ...f,
      type: tpl.type || f.type,
      memo: tpl.memo || f.memo,
      entries: (tpl.entries || []).map(e => ({ ...e, id: crypto.randomUUID() })),
    }))
    setShowTemplates(false)
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return
    await onSaveTemplate({
      name: templateName.trim(),
      type: form.type,
      memo: form.memo,
      entries: form.entries.map(({ id, ...e }) => e),
    })
    setTemplateName('')
    setSavingTemplate(false)
  }

  const { debit, credit, balanced } = voucherTotals(form.entries)

  // Only show template features for adjustment type
  const isAdjustment = form.type === 'adjustment'
  const adjustmentTemplates = templates.filter(t => t.type === 'adjustment')

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <span className="modal-title">{voucher ? 'Edit Voucher' : 'New Voucher'}</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Voucher Type</label>
            <select className="form-select" value={form.type} onChange={e => setF('type', e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Reference No.</label>
            <input className="form-input" value={form.reference} onChange={e => setF('reference', e.target.value)} placeholder="e.g. OR-001" />
          </div>
          <div className="form-group">
            <label className="form-label">Client (optional)</label>
            <select className="form-select" value={form.clientId} onChange={e => setF('clientId', e.target.value)}>
              <option value="">— None —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group form-col-full">
            <label className="form-label">Memo</label>
            <input className="form-input" value={form.memo} onChange={e => setF('memo', e.target.value)} placeholder="Brief description of this entry" />
          </div>
        </div>

        <datalist id="accounts-list">
          {accounts.map(a => <option key={a.id} value={a.name} />)}
        </datalist>
        {accounts.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
            Tip: set up your Chart of Accounts first so account names autocomplete here.
          </div>
        )}

        {/* Recurring templates — only shown for Adjustment vouchers */}
        {isAdjustment && (
          <div style={{
            marginBottom: 12, border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', overflow: 'hidden',
          }}>
            <div
              onClick={() => setShowTemplates(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--surface2)',
                cursor: 'pointer', userSelect: 'none', fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <BookMarked size={13} color="var(--accent)" />
                Recurring Templates
                {adjustmentTemplates.length > 0 && (
                  <span style={{
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: 99, fontSize: 10, padding: '1px 6px', fontWeight: 700,
                  }}>
                    {adjustmentTemplates.length}
                  </span>
                )}
              </div>
              <ChevronDown size={13} color="var(--text-3)"
                style={{ transform: showTemplates ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              />
            </div>

            {showTemplates && (
              <div style={{ padding: '10px 12px' }}>
                {adjustmentTemplates.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    No saved templates yet. Fill in the entries below and save as a template.
                  </div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    {adjustmentTemplates.map(tpl => (
                      <div key={tpl.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', marginBottom: 6,
                        background: 'var(--bg)',
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{tpl.name}</div>
                          {tpl.memo && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tpl.memo}</div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {(tpl.entries || []).length} line{(tpl.entries || []).length !== 1 ? 's' : ''}
                            {' · '}
                            {(tpl.entries || []).filter(e => parseFloat(e.debit || 0) > 0).map(e => e.account).filter(Boolean).join(', ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => applyTemplate(tpl)}
                          >
                            Use
                          </button>
                          <button
                            className="icon-btn"
                            style={{ color: 'var(--red)' }}
                            onClick={() => onDeleteTemplate(tpl.id)}
                            title="Delete template"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Save current entries as template */}
                {savingTemplate ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      style={{ fontSize: 12, padding: '5px 8px', flex: 1 }}
                      placeholder="Template name (e.g. Monthly Depreciation)"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                      autoFocus
                    />
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }}
                      disabled={!templateName.trim()}
                      onClick={handleSaveTemplate}>
                      Save
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
                      onClick={() => { setSavingTemplate(false); setTemplateName('') }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => setSavingTemplate(true)}
                  >
                    <Plus size={12} /> Save current entries as template
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Account</th>
                <th style={{ width: '34%' }}>Description</th>
                <th style={{ width: '17%', textAlign: 'right' }}>Debit</th>
                <th style={{ width: '17%', textAlign: 'right' }}>Credit</th>
                <th style={{ width: '4%' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.entries.map((e, i) => (
                <EntryRow key={e.id} entry={e} index={i}
                  onChange={upd => setEntry(i, upd)}
                  onRemove={() => removeEntry(i)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={addEntry} style={{ marginBottom: 12 }}>
          <Plus size={13} /> Add Line
        </button>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 14px',
          border: `1px solid ${balanced ? 'var(--green)' : 'var(--red)'}40`,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            {balanced
              ? <><CheckCircle size={14} color="var(--green)" /> <span style={{ color: 'var(--green)' }}>Balanced</span></>
              : <><AlertCircle size={14} color="var(--red)" /> <span style={{ color: 'var(--red)' }}>Unbalanced — difference: {fmt(Math.abs(debit - credit))}</span></>
            }
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12, fontFamily: 'var(--mono)' }}>
            <span>DR: {fmt(debit)}</span>
            <span>CR: {fmt(credit)}</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!balanced || form.entries.length === 0}
            onClick={() => onSave(form)}>
            {voucher ? 'Save Changes' : 'Post Voucher'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Vouchers() {
  const { vouchers, addVoucher, updateVoucher, deleteVoucher, clients, accounts, templates, addTemplate, deleteTemplate, settings } = useStore()
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [exporting, setExporting] = useState(false)

  const filtered = vouchers.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = v.number.toLowerCase().includes(q) ||
      (v.memo || '').toLowerCase().includes(q) ||
      (v.reference || '').toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || v.type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Vouchers</div>
          <div className="page-sub">{vouchers.length} journal entr{vouchers.length !== 1 ? 'ies' : 'y'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost"
            disabled={filtered.length === 0 || exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await exportVouchersToExcel(filtered, clients)
              } finally {
                setExporting(false)
              }
            }}
          >
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
          <button className="btn btn-primary" onClick={() => setModal('new')}>
            <Plus size={15} /> New Voucher
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <Search size={14} color="var(--text-3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vouchers..." />
        </div>
        <select className="form-select" style={{ width: 'auto', fontSize: 12 }}
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileText size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No vouchers found</div>
            <button className="btn btn-primary" onClick={() => setModal('new')}>
              <Plus size={14} /> New Voucher
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Date</th>
                <th>Debit Account</th>
                <th>Credit Account</th>
                <th>Memo</th>
                <th>Reference</th>
                <th style={{ textAlign: 'right' }}>Debit Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().map(v => {
                const { debit } = voucherTotals(v.entries)
                const entries = v.entries || []
                const debitAccounts = entries.filter(e => parseFloat(e.debit || 0) > 0).map(e => e.account).filter(Boolean)
                const creditAccounts = entries.filter(e => parseFloat(e.credit || 0) > 0).map(e => e.account).filter(Boolean)
                const debitLabel = debitAccounts.length > 0 ? debitAccounts.join(', ') : '—'
                const creditLabel = creditAccounts.length > 0 ? creditAccounts.join(', ') : '—'
                return (
                  <tr key={v.id}>
                    <td className="td-mono" style={{ fontWeight: 600 }}>{v.number}</td>
                    <td>
                      <span className="badge badge-blue">{v.type}</span>
                    </td>
                    <td className="td-mono">{v.date || fmtDate(v.createdAt)}</td>
                    <td style={{ fontSize: 12, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={debitLabel}>
                        {debitLabel}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={creditLabel}>
                        {creditLabel}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: 12, maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.memo || '—'}
                      </div>
                    </td>
                    <td className="td-mono">{v.reference || '—'}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmt(debit, settings.currency)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => setModal(v)}><Pencil size={14} /></button>
                        <button className="icon-btn" onClick={() => deleteVoucher(v.id)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <VoucherModal
          voucher={modal === 'new' ? null : modal}
          clients={clients}
          accounts={accounts}
          templates={templates}
          onSaveTemplate={addTemplate}
          onDeleteTemplate={deleteTemplate}
          onClose={() => setModal(null)}
          onSave={form => {
            if (modal === 'new') addVoucher(form)
            else updateVoucher(modal.id, form)
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
