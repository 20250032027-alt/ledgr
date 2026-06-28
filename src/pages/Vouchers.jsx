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

function EntryRow({ entry, onChange, onRemove, onAddBelow, accounts, isLast }) {
  const accountNames = new Set(accounts.map(a => a.name.trim().toLowerCase()))
  const val = (entry.account || '').trim()
  const isInvalid = val.length > 0 && !accountNames.has(val.toLowerCase())

  // Tab on last credit field → add new row
  function handleCreditKeyDown(e) {
    if (e.key === 'Tab' && !e.shiftKey && isLast) {
      e.preventDefault()
      onAddBelow()
    }
  }

  return (
    <tr>
      <td>
        <input
          className="form-input"
          style={{
            fontSize: 12, padding: '5px 8px',
            borderColor: isInvalid ? 'var(--red)' : undefined,
            background: isInvalid ? 'rgba(239,68,68,0.07)' : undefined,
          }}
          list="accounts-list"
          value={entry.account}
          onChange={e => onChange({ ...entry, account: e.target.value })}
          placeholder="Account name"
        />
        {isInvalid && (
          <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2, lineHeight: 1.3 }}>
            ⚠ Not in Chart of Accounts
          </div>
        )}
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
          type="number" min="0" step="0.01" value={entry.debit}
          onChange={e => onChange({ ...entry, debit: e.target.value, credit: e.target.value ? '' : entry.credit })}
          placeholder="0.00"
        />
      </td>
      <td>
        <input
          className="form-input"
          style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}
          type="number" min="0" step="0.01" value={entry.credit}
          onChange={e => onChange({ ...entry, credit: e.target.value, debit: e.target.value ? '' : entry.debit })}
          onKeyDown={handleCreditKeyDown}
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

// ── Accounting Calculator ─────────────────────────────────────────────────
function AccountingCalc({ onUseDebit, onUseCredit, taxRate = 12 }) {
  const [display, setDisplay] = useState('0')
  const [tape, setTape]       = useState([]) // [{expr, result}]
  const [expr, setExpr]       = useState('')  // pending expression string
  const [justEvaled, setJustEvaled] = useState(false)
  const [splitN, setSplitN]   = useState('2')
  const [mode, setMode]       = useState('calc') // 'calc' | 'split' | 'tax'
  const [taxMode, setTaxMode] = useState('excl') // 'excl' (add tax) | 'incl' (strip tax)

  const MAX_TAPE = 8

  function safeEval(str) {
    try {
      // Replace × and ÷ with JS operators
      const clean = str.replace(/×/g,'*').replace(/÷/g,'/')
      // Only allow safe chars
      if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(clean)) return null
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + clean + ')')()
      if (!isFinite(result)) return null
      return Math.round(result * 100) / 100
    } catch { return null }
  }

  function pushTape(expression, result) {
    setTape(t => [{expr: expression, result},...t].slice(0, MAX_TAPE))
  }

  function pressDigit(d) {
    if (justEvaled) { setDisplay(d); setExpr(d); setJustEvaled(false); return }
    const next = display === '0' && d !== '.' ? d : display + d
    setDisplay(next)
    setExpr(e => e + d)
  }

  function pressOp(op) {
    setJustEvaled(false)
    // Evaluate any pending expression first
    const result = safeEval(expr)
    if (result !== null) {
      const numStr = String(result)
      setDisplay(numStr)
      setExpr(numStr + op)
      pushTape(expr, result)
    } else {
      setExpr(e => e + op)
    }
    setDisplay('0')
  }

  function pressEqual() {
    const result = safeEval(expr)
    if (result === null) return
    pushTape(expr + ' =', result)
    setDisplay(String(result))
    setExpr(String(result))
    setJustEvaled(true)
  }

  function pressClear() {
    setDisplay('0'); setExpr(''); setJustEvaled(false)
  }

  function pressBackspace() {
    if (justEvaled) { pressClear(); return }
    const next = display.length > 1 ? display.slice(0, -1) : '0'
    setDisplay(next)
    setExpr(e => e.length > 1 ? e.slice(0, -1) : '')
  }

  function pressPercent() {
    const val = parseFloat(display)
    if (isNaN(val)) return
    const result = Math.round(val / 100 * 100) / 100
    setDisplay(String(result))
    setExpr(String(result))
    setJustEvaled(true)
  }

  function pressDot() {
    if (display.includes('.')) return
    setDisplay(d => d + '.')
    setExpr(e => e + '.')
  }

  function useTape(val) {
    const s = String(val)
    setDisplay(s); setExpr(s); setJustEvaled(true)
  }

  const currentVal = parseFloat(display) || 0

  // Split
  const splitAmt = splitN && parseFloat(splitN) > 0
    ? Math.round(currentVal / parseFloat(splitN) * 100) / 100
    : 0

  // Tax
  const taxDec = taxRate / 100
  const taxExcl = Math.round(currentVal * taxDec * 100) / 100          // tax on top of net
  const netFromGross = Math.round(currentVal / (1 + taxDec) * 100) / 100 // strip tax from gross
  const taxFromGross = Math.round((currentVal - netFromGross) * 100) / 100

  const btnBase = {
    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14,
    transition: 'all 0.1s', padding: '10px 0', userSelect: 'none',
  }
  const btnNum  = { ...btnBase, background: 'var(--surface3)', color: 'var(--text-1)' }
  const btnOp   = { ...btnBase, background: 'var(--surface2)', color: 'var(--accent)', fontSize: 16 }
  const btnEq   = { ...btnBase, background: 'var(--accent)', color: '#fff', fontSize: 16 }
  const btnSpec = { ...btnBase, background: 'var(--surface2)', color: 'var(--text-2)', fontSize: 12 }

  const grid4 = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }

  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
      alignSelf: 'flex-start',
      position: 'sticky', top: 0,
    }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
        {[['calc','Calc'],['split','Split'],['tax','Tax']].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: '4px 0', border: 'none', borderRadius: 'var(--radius-sm)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
            background: mode === m ? 'var(--accent)' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-3)',
          }}>{label}</button>
        ))}
      </div>

      {/* Display */}
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
        padding: '10px 12px', textAlign: 'right', minHeight: 52,
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)', minHeight: 14, wordBreak: 'break-all' }}>
          {expr || ' '}
        </div>
        <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text-1)', letterSpacing: -1 }}>
          {parseFloat(display).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      </div>

      {mode === 'calc' && <>
        {/* Buttons */}
        <div style={grid4}>
          {[
            ['C','spec'], ['⌫','spec'], ['%','spec'], ['÷','op'],
            ['7','num'],  ['8','num'],  ['9','num'],  ['×','op'],
            ['4','num'],  ['5','num'],  ['6','num'],  ['−','op'],
            ['1','num'],  ['2','num'],  ['3','num'],  ['+','op'],
            ['0','num'],  ['.','num'],  ['=','eq'],   ['=','eq'],
          ].map(([k, t], i) => {
            // Skip duplicate '=' (it spans 2 cols)
            if (i === 19) return null
            const isEqSpan = i === 18
            const style = t === 'op' ? btnOp : t === 'eq' ? btnEq : t === 'spec' ? btnSpec : btnNum
            return (
              <button key={i} style={{ ...style, gridColumn: isEqSpan ? 'span 2' : undefined }}
                onClick={() => {
                  if (k === 'C') pressClear()
                  else if (k === '⌫') pressBackspace()
                  else if (k === '%') pressPercent()
                  else if (k === '.') pressDot()
                  else if (k === '=') pressEqual()
                  else if (['+','−','×','÷'].includes(k)) pressOp(k === '−' ? '-' : k)
                  else pressDigit(k)
                }}>
                {k}
              </button>
            )
          })}
        </div>

        {/* Use result buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, justifyContent: 'center' }}
            onClick={() => onUseDebit(currentVal)}>
            → DR
          </button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, justifyContent: 'center' }}
            onClick={() => onUseCredit(currentVal)}>
            → CR
          </button>
        </div>

        {/* Tape */}
        {tape.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>History</div>
            {tape.map((t, i) => (
              <div key={i} onClick={() => useTape(t.result)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{t.expr}</span>
                <span style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{t.result.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
            <button onClick={() => setTape([])} style={{ ...btnSpec, fontSize: 10, width: '100%', marginTop: 5, padding: '4px 0' }}>Clear history</button>
          </div>
        )}
      </>}

      {mode === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Split the displayed amount evenly</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>÷</span>
            <input className="form-input" type="number" min="2" max="99" value={splitN}
              onChange={e => setSplitN(e.target.value)}
              style={{ fontSize: 13, padding: '6px 10px', width: 70, fontFamily: 'var(--mono)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>parts</span>
          </div>
          {splitAmt > 0 && (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Each part</div>
                <div style={{ fontSize: 20, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--green)' }}>
                  {splitAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                  × {splitN} = {(splitAmt * parseFloat(splitN)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  {Math.abs(splitAmt * parseFloat(splitN) - currentVal) > 0.01
                    ? ` (±${(currentVal - splitAmt * parseFloat(splitN)).toFixed(2)} rounding)`
                    : ''}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, justifyContent: 'center' }}
                  onClick={() => onUseDebit(splitAmt)}>→ DR</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, justifyContent: 'center' }}
                  onClick={() => onUseCredit(splitAmt)}>→ CR</button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'tax' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
            {[['excl','Add VAT'],['incl','Strip VAT']].map(([m, label]) => (
              <button key={m} onClick={() => setTaxMode(m)} style={{
                flex: 1, padding: '4px 0', border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: taxMode === m ? 'var(--surface3)' : 'transparent',
                color: taxMode === m ? 'var(--text-1)' : 'var(--text-3)',
              }}>{label}</button>
            ))}
          </div>

          {taxMode === 'excl' ? (
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Row label="Net amount" val={currentVal} />
              <Row label={`VAT (${taxRate}%)`} val={taxExcl} color="var(--amber)" />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <Row label="Gross total" val={currentVal + taxExcl} bold />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, justifyContent: 'center' }}
                  onClick={() => onUseDebit(taxExcl)}>VAT → DR</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, justifyContent: 'center' }}
                  onClick={() => onUseDebit(currentVal + taxExcl)}>Total → DR</button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Row label="Gross (VAT-incl)" val={currentVal} />
              <Row label="Net (excl VAT)" val={netFromGross} color="var(--green)" />
              <Row label={`VAT portion (${taxRate}%)`} val={taxFromGross} color="var(--amber)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, justifyContent: 'center' }}
                  onClick={() => onUseDebit(netFromGross)}>Net → DR</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, justifyContent: 'center' }}
                  onClick={() => onUseDebit(taxFromGross)}>VAT → DR</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, val, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: bold ? 700 : 500, color: color || 'var(--text-1)' }}>
        {val.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}

function VoucherModal({ voucher, onClose, onSave, clients, accounts, templates, onSaveTemplate, onDeleteTemplate, recentMemos }) {
  const blankEntry = () => ({ account: '', description: '', debit: '', credit: '', id: crypto.randomUUID() })
  const [form, setForm] = useState(voucher || {
    type: 'general', date: new Date().toISOString().slice(0, 10),
    reference: '', memo: '', clientId: '', entries: [blankEntry(), blankEntry()],
  })
  const [lastFocused, setLastFocused] = useState({ index: 0, side: 'debit' })

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

  // Push calculator result into the last focused entry row
  function calcUseDebit(val) {
    const i = lastFocused.index < form.entries.length ? lastFocused.index : form.entries.length - 1
    const entries = [...form.entries]
    entries[i] = { ...entries[i], debit: String(val), credit: '' }
    setF('entries', entries)
  }
  function calcUseCredit(val) {
    const i = lastFocused.index < form.entries.length ? lastFocused.index : form.entries.length - 1
    const entries = [...form.entries]
    entries[i] = { ...entries[i], credit: String(val), debit: '' }
    setF('entries', entries)
  }

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
      <div className="modal" style={{ maxWidth: 980 }} onKeyDown={e => e.key === 'Escape' && onClose()}>
        <div className="modal-header">
          <span className="modal-title">{voucher ? 'Edit Voucher' : 'New Voucher'}</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Two-column: form left, calculator right */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

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
            <input autoFocus className="form-input" value={form.memo}
              onChange={e => setF('memo', e.target.value)}
              list="memo-suggestions"
              placeholder="Brief description of this entry" />
            <datalist id="memo-suggestions">
              {recentMemos.map((m, i) => <option key={i} value={m} />)}
            </datalist>
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
                <EntryRow key={e.id} entry={e}
                  onChange={upd => setEntry(i, upd)}
                  onRemove={() => removeEntry(i)}
                  onAddBelow={addEntry}
                  isLast={i === form.entries.length - 1}
                  accounts={accounts}
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

          </div>{/* end left column */}

          {/* Right column: calculator */}
          <AccountingCalc
            onUseDebit={calcUseDebit}
            onUseCredit={calcUseCredit}
            taxRate={12}
          />
        </div>{/* end two-column */}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary"
            disabled={!balanced || form.entries.length === 0 || form.entries.some(e => {
              const v = (e.account || '').trim()
              return v.length > 0 && !accounts.map(a => a.name.trim().toLowerCase()).includes(v.toLowerCase())
            })}
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
  const [copied, setCopied] = useState(null)

  // Last 20 unique non-empty memos for autocomplete
  const recentMemos = [...new Set(
    [...vouchers].reverse().map(v => v.memo).filter(Boolean)
  )].slice(0, 20)

  function copyNumber(num) {
    navigator.clipboard.writeText(num).then(() => {
      setCopied(num)
      setTimeout(() => setCopied(null), 1500)
    })
  }

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
                    <td className="td-mono" style={{ fontWeight: 600 }}>
                      <span
                        title="Click to copy"
                        onClick={() => copyNumber(v.number)}
                        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border2)' }}
                      >
                        {copied === v.number ? '✓ copied' : v.number}
                      </span>
                    </td>
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
          recentMemos={recentMemos}
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
