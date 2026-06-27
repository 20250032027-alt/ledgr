import { useStore } from '../store/useStore.jsx'
import { fmt } from '../utils'
import { BarChart3 } from 'lucide-react'

// Map Chart of Accounts `type` -> which section of the reports it belongs to.
// Assets are split into current vs fixed by code range (1000–1499 = current, 1500+ = fixed)
// or by keyword fallback if no code exists.
function coaTypeToSection(account) {
  const type = account.type
  if (type === 'asset') {
    // Use account code to distinguish current vs fixed assets, with keyword fallback.
    const code = parseInt(account.code || '0', 10)
    if (code >= 1500 && code < 2000) return 'fixed-asset'
    if (code >= 1000 && code < 1500) return 'current-asset'
    // Keyword fallback for accounts without codes
    const n = account.name.toLowerCase()
    if (n.includes('equipment') || n.includes('furniture') || n.includes('vehicle')
      || n.includes('building') || n.includes('land') || n.includes('property')) return 'fixed-asset'
    return 'current-asset'
  }
  if (type === 'liability') return 'current-liability'
  if (type === 'equity') return 'equity'
  if (type === 'revenue') return 'revenue'
  if (type === 'expense') return 'expense'
  return null
}

// Normal side: assets & expenses are debit-normal; liabilities, equity, revenue are credit-normal.
function normalBalance(type) {
  return (type === 'asset' || type === 'expense') ? 1 : -1
}

function buildLedger(vouchers) {
  const map = {}
  vouchers.forEach(v => {
    ;(v.entries || []).forEach(e => {
      if (!e.account) return
      const key = e.account.trim().toLowerCase()
      if (!map[key]) map[key] = { debit: 0, credit: 0 }
      map[key].debit += parseFloat(e.debit || 0)
      map[key].credit += parseFloat(e.credit || 0)
    })
  })
  return map
}

function Section({ title, rows, total, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '1px',
        textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8,
      }}>{title}</div>
      {rows.map(r => (
        <div key={r.name} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '5px 0', borderBottom: '1px solid var(--border)',
          fontSize: 13,
        }}>
          <span style={{ color: 'var(--text-2)' }}>{r.name}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(r.amount)}</span>
        </div>
      ))}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '8px 0', fontSize: 13, fontWeight: 700,
        borderTop: '2px solid var(--border2)', marginTop: 4,
      }}>
        <span>Total {title}</span>
        <span style={{ fontFamily: 'var(--mono)', color }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

export default function FinancialCondition() {
  const { vouchers, bills, accounts, settings } = useStore()
  const cur = settings.currency

  // Build ledger totals keyed by lowercase account name
  const ledger = buildLedger(vouchers)

  // Build sections from the Chart of Accounts (respects user-defined types)
  const currentAssets = []
  const fixedAssets = []
  const currentLiabilities = []
  const equity = []
  const revenue = []
  const expenses = []

  accounts.forEach(account => {
    const section = coaTypeToSection(account)
    if (!section) return // skip accounts with unknown type

    const key = account.name.trim().toLowerCase()
    const t = ledger[key] || { debit: 0, credit: 0 }
    const nb = normalBalance(account.type)
    const amount = (t.debit - t.credit) * nb

    // Only include accounts that have activity OR non-zero balance
    // (still include zero-balance accounts that have been posted to)
    const hasActivity = t.debit > 0 || t.credit > 0

    if (!hasActivity) return

    const row = { name: account.name, amount }

    if (section === 'current-asset') currentAssets.push(row)
    else if (section === 'fixed-asset') fixedAssets.push(row)
    else if (section === 'current-liability') currentLiabilities.push(row)
    else if (section === 'equity') equity.push(row)
    else if (section === 'revenue') revenue.push(row)
    else if (section === 'expense') expenses.push(row)
  })

  // Accounts used in vouchers but NOT in Chart of Accounts — classify by heuristic
  // so nothing is silently lost (orphan accounts).
  const accountedFor = new Set(accounts.map(a => a.name.trim().toLowerCase()))
  Object.keys(ledger).forEach(key => {
    if (accountedFor.has(key)) return
    // Try to find the original casing from vouchers
    const originalName = (() => {
      for (const v of vouchers) {
        for (const e of (v.entries || [])) {
          if (e.account && e.account.trim().toLowerCase() === key) return e.account.trim()
        }
      }
      return key
    })()

    const t = ledger[key]
    const n = key
    let amount, row

    // Heuristic fallback for unregistered accounts
    if (n.includes('cash') || n.includes('bank') || n.includes('receivable') || n.includes('prepaid') || n.includes('inventory')) {
      currentAssets.push({ name: originalName + ' ⚠', amount: t.debit - t.credit })
    } else if (n.includes('equipment') || n.includes('furniture') || n.includes('vehicle') || n.includes('building')) {
      fixedAssets.push({ name: originalName + ' ⚠', amount: t.debit - t.credit })
    } else if (n.includes('payable') || n.includes('unearned') || n.includes('tax')) {
      currentLiabilities.push({ name: originalName + ' ⚠', amount: t.credit - t.debit })
    } else if (n.includes('capital') || n.includes('retained') || n.includes('equity')) {
      equity.push({ name: originalName + ' ⚠', amount: t.credit - t.debit })
    } else if (n.includes('revenue') || n.includes('sales') || n.includes('income')) {
      revenue.push({ name: originalName + ' ⚠', amount: t.credit - t.debit })
    } else if (n.includes('expense') || n.includes('cost') || n.includes('salaries') || n.includes('rent') || n.includes('utilities') || n.includes('supplies')) {
      expenses.push({ name: originalName + ' ⚠', amount: t.debit - t.credit })
    } else {
      // Truly unknown — add to current assets with warning so it's visible, not lost
      currentAssets.push({ name: originalName + ' ⚠ (unclassified)', amount: t.debit - t.credit })
    }
  })

  // Bills: add to current assets & revenue
  const paidBillsTotal = bills.filter(b => b.status === 'paid')
    .reduce((s, b) => s + parseFloat(b.total || 0), 0)
  const unpaidBillsTotal = bills.filter(b => b.status !== 'paid')
    .reduce((s, b) => s + parseFloat(b.total || 0), 0)

  if (paidBillsTotal > 0) currentAssets.push({ name: 'Cash from Collections', amount: paidBillsTotal })
  if (unpaidBillsTotal > 0) currentAssets.push({ name: 'Accounts Receivable (Invoices)', amount: unpaidBillsTotal })

  const billRevenue = paidBillsTotal
  if (billRevenue > 0) {
    const existing = revenue.find(r => r.name === 'Service Revenue')
    if (existing) existing.amount += billRevenue
    else revenue.push({ name: 'Billing Revenue', amount: billRevenue })
  }

  const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0)
  const totalFixedAssets = fixedAssets.reduce((s, r) => s + r.amount, 0)
  const totalAssets = totalCurrentAssets + totalFixedAssets
  const totalLiabilities = currentLiabilities.reduce((s, r) => s + r.amount, 0)
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0)
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0)
  const netIncome = totalRevenue - totalExpenses
  const totalLE = totalLiabilities + totalEquity + netIncome

  const hasData = vouchers.length > 0 || bills.length > 0
  const hasOrphans = [...currentAssets, ...fixedAssets, ...currentLiabilities, ...equity, ...revenue, ...expenses]
    .some(r => r.name.includes('⚠'))

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Financial Condition & Operations</div>
          <div className="page-sub">Balance Sheet · Income Statement</div>
        </div>
      </div>

      {!hasData ? (
        <div className="card">
          <div className="empty-state">
            <BarChart3 size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No financial data yet</div>
            <div style={{ fontSize: 13 }}>Post vouchers and invoices to generate reports</div>
          </div>
        </div>
      ) : (
        <>
          {hasOrphans && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--amber, #f59e0b)', padding: '10px 16px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                <strong>⚠ Some accounts</strong> are used in vouchers but not found in your Chart of Accounts — they are marked with ⚠ and classified by keyword. Add them to your Chart of Accounts and assign their type to remove this warning and ensure correct categorisation.
              </div>
            </div>
          )}

          <div className="two-col">
            {/* Balance Sheet */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Balance Sheet</div>
                  <div className="card-sub">Statement of Financial Position</div>
                </div>
              </div>
              <Section title="Current Assets" rows={currentAssets} total={totalCurrentAssets} color="var(--green)" />
              {fixedAssets.length > 0 && (
                <Section title="Fixed Assets" rows={fixedAssets} total={totalFixedAssets} color="var(--accent)" />
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                fontSize: 14, fontWeight: 800, borderTop: '2px solid var(--border2)',
                marginBottom: 20,
              }}>
                <span>Total Assets</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(totalAssets, cur)}</span>
              </div>

              <Section title="Current Liabilities" rows={currentLiabilities} total={totalLiabilities} color="var(--red)" />
              <Section title="Equity" rows={equity} total={totalEquity} color="var(--accent)" />

              {netIncome !== 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text-2)' }}>Net Income (current period)</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: netIncome >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmt(netIncome)}
                  </span>
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                fontSize: 14, fontWeight: 800, borderTop: '2px solid var(--border2)',
              }}>
                <span>Total L + E</span>
                <span style={{
                  fontFamily: 'var(--mono)',
                  color: Math.abs(totalAssets - totalLE) < 0.01 ? 'var(--green)' : 'var(--red)',
                }}>
                  {fmt(totalLE, cur)}
                </span>
              </div>

              {Math.abs(totalAssets - totalLE) >= 0.01 && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6, textAlign: 'right' }}>
                  ⚠ Balance sheet out of balance by {fmt(Math.abs(totalAssets - totalLE), cur)}
                </div>
              )}
            </div>

            {/* Income Statement */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Income Statement</div>
                    <div className="card-sub">Statement of Operations</div>
                  </div>
                </div>
                <Section title="Revenue" rows={revenue} total={totalRevenue} color="var(--green)" />
                <Section title="Expenses" rows={expenses} total={totalExpenses} color="var(--red)" />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                  fontSize: 15, fontWeight: 800,
                }}>
                  <span>Net Income</span>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    color: netIncome >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>{fmt(netIncome, cur)}</span>
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ marginBottom: 14 }}>Key Ratios</div>
                {[
                  {
                    label: 'Current Ratio',
                    value: totalLiabilities > 0 ? (totalCurrentAssets / totalLiabilities).toFixed(2) : 'N/A',
                    note: 'Current Assets / Current Liabilities',
                  },
                  {
                    label: 'Gross Margin',
                    value: totalRevenue > 0 ? `${((netIncome / totalRevenue) * 100).toFixed(1)}%` : 'N/A',
                    note: 'Net Income / Revenue',
                  },
                  {
                    label: 'Debt to Equity',
                    value: totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : 'N/A',
                    note: 'Total Liabilities / Total Equity',
                  },
                ].map(r => (
                  <div key={r.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '10px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{r.note}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15 }}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
