import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore.jsx'
import { fmt, fmtDate } from '../utils'
import { BookOpen, ChevronDown, ChevronUp, Download } from 'lucide-react'

function normalSide(type) {
  return (type === 'asset' || type === 'expense') ? 1 : -1
}

async function exportToExcel(accountSections, currency) {
  const XLSX = await import('xlsx')
  const MONEY_FMT = '#,##0.00;(#,##0.00);"-"'

  const rows = []
  accountSections.forEach(({ account, entries, openingBalance, closingBalance }) => {
    rows.push({
      Account: account.name,
      Code: account.code || '',
      Type: account.type,
      Date: '',
      'Voucher #': '',
      Memo: '',
      Debit: '',
      Credit: '',
      Balance: '',
    })
    let running = openingBalance
    entries.forEach(e => {
      running += e.debit - e.credit
      rows.push({
        Account: '',
        Code: '',
        Type: '',
        Date: e.date,
        'Voucher #': e.voucherNumber,
        Memo: e.memo || e.description || '',
        Debit: e.debit || '',
        Credit: e.credit || '',
        Balance: running,
      })
    })
    rows.push({
      Account: 'Closing Balance',
      Code: '',
      Type: '',
      Date: '',
      'Voucher #': '',
      Memo: '',
      Debit: '',
      Credit: '',
      Balance: closingBalance,
    })
    rows.push({})
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 32 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Account Listing')
  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `ledgr-account-listing-${dateStr}.xlsx`)
}

function AccountSection({ account, entries, openingBalance, closingBalance, currency }) {
  const [open, setOpen] = useState(true)

  let running = 0
  const rows = entries.map(e => {
    running += e.debit - e.credit
    return { ...e, running }
  })

  const nb = normalSide(account.type)
  const displayBalance = closingBalance * nb

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Account header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {open ? <ChevronUp size={15} color="var(--text-3)" /> : <ChevronDown size={15} color="var(--text-3)" />}
          <div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{account.name}</span>
            {account.code && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                {account.code}
              </span>
            )}
            <span style={{
              marginLeft: 8, fontSize: 11, textTransform: 'uppercase',
              color: 'var(--text-3)', letterSpacing: '0.5px',
            }}>
              {account.type}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14,
            color: displayBalance < 0 ? 'var(--red)' : 'var(--text-1)',
          }}>
            {fmt(Math.abs(displayBalance), currency)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {displayBalance >= 0
              ? (account.type === 'asset' || account.type === 'expense' ? 'DR balance' : 'CR balance')
              : (account.type === 'asset' || account.type === 'expense' ? 'CR balance' : 'DR balance')
            }
            {' · '}{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
          </div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Date</th>
                  <th style={{ width: 90 }}>Voucher #</th>
                  <th>Memo / Description</th>
                  <th style={{ textAlign: 'right', width: 110 }}>Debit</th>
                  <th style={{ textAlign: 'right', width: 110 }}>Credit</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={i}>
                    <td className="td-mono">{e.date || '—'}</td>
                    <td className="td-mono" style={{ fontWeight: 600 }}>{e.voucherNumber}</td>
                    <td style={{ color: 'var(--text-2)', maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.memo || e.description || '—'}
                      </div>
                    </td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>
                      {e.debit > 0 ? fmt(e.debit, currency) : '—'}
                    </td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>
                      {e.credit > 0 ? fmt(e.credit, currency) : '—'}
                    </td>
                    <td className="td-mono" style={{
                      textAlign: 'right',
                      color: e.running * nb < 0 ? 'var(--red)' : 'var(--text-1)',
                    }}>
                      {fmt(Math.abs(e.running), currency)}
                      <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 3 }}>
                        {e.running * nb >= 0 ? 'DR' : 'CR'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border2)' }}>
                  <td colSpan={3} style={{ fontWeight: 700, fontSize: 12, paddingTop: 8 }}>Closing Balance</td>
                  <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmt(entries.reduce((s, e) => s + e.debit, 0), currency)}
                  </td>
                  <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmt(entries.reduce((s, e) => s + e.credit, 0), currency)}
                  </td>
                  <td className="td-mono" style={{
                    textAlign: 'right', fontWeight: 700,
                    color: displayBalance < 0 ? 'var(--red)' : 'var(--green)',
                  }}>
                    {fmt(Math.abs(displayBalance), currency)}
                    <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 3 }}>
                      {displayBalance >= 0 ? 'DR' : 'CR'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountListing() {
  const { accounts, vouchers, settings } = useStore()
  const cur = settings.currency
  const [typeFilter, setTypeFilter] = useState('all')
  const [exporting, setExporting] = useState(false)

  // Build per-account entry lists from vouchers
  const accountSections = useMemo(() => {
    // Map account name (lowercase) -> account object
    const accountMap = {}
    accounts.forEach(a => { accountMap[a.name.trim().toLowerCase()] = a })

    // Collect entries per account
    const entryMap = {}
    vouchers.forEach(v => {
      ;(v.entries || []).forEach(e => {
        if (!e.account) return
        const key = e.account.trim().toLowerCase()
        if (!entryMap[key]) entryMap[key] = []
        entryMap[key].push({
          date: v.date || fmtDate(v.createdAt),
          voucherNumber: v.number,
          memo: v.memo,
          description: e.description,
          debit: parseFloat(e.debit || 0),
          credit: parseFloat(e.credit || 0),
        })
      })
    })

    // Build sections for registered accounts that have activity
    const sections = accounts
      .filter(a => entryMap[a.name.trim().toLowerCase()]?.length > 0)
      .map(a => {
        const entries = entryMap[a.name.trim().toLowerCase()] || []
        // Sort entries by date then voucher number
        entries.sort((x, y) => {
          if (x.date < y.date) return -1
          if (x.date > y.date) return 1
          return x.voucherNumber.localeCompare(y.voucherNumber)
        })
        const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
        return {
          account: a,
          entries,
          openingBalance: 0,
          closingBalance: totalDebit - totalCredit,
        }
      })

    // Also include orphan accounts (in vouchers but not in Chart of Accounts)
    const registered = new Set(accounts.map(a => a.name.trim().toLowerCase()))
    Object.entries(entryMap).forEach(([key, entries]) => {
      if (registered.has(key)) return
      const originalName = entries[0] ? (() => {
        for (const v of vouchers) {
          for (const e of (v.entries || [])) {
            if (e.account?.trim().toLowerCase() === key) return e.account.trim()
          }
        }
        return key
      })() : key

      entries.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0)
      const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
      const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
      sections.push({
        account: { name: originalName + ' ⚠', code: '', type: 'asset' },
        entries,
        openingBalance: 0,
        closingBalance: totalDebit - totalCredit,
      })
    })

    return sections
  }, [accounts, vouchers])

  const filtered = typeFilter === 'all'
    ? accountSections
    : accountSections.filter(s => s.account.type === typeFilter)

  const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Account Listing</div>
          <div className="page-sub">Transaction history per account with running balances</div>
        </div>
        <button
          className="btn btn-ghost"
          disabled={filtered.length === 0 || exporting}
          onClick={async () => {
            setExporting(true)
            try { await exportToExcel(filtered, cur) }
            finally { setExporting(false) }
          }}
        >
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <select
          className="form-select"
          style={{ width: 'auto', fontSize: 12 }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Account Types</option>
          {TYPES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}s</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {filtered.length} account{filtered.length !== 1 ? 's' : ''} with activity
        </span>
      </div>

      {accountSections.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No transactions yet</div>
            <div style={{ fontSize: 13 }}>Post vouchers to see the account listing</div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No accounts of this type have activity</div>
          </div>
        </div>
      ) : (
        filtered.map((section, i) => (
          <AccountSection
            key={section.account.name + i}
            {...section}
            currency={cur}
          />
        ))
      )}
    </div>
  )
}
