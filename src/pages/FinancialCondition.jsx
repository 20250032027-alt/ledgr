import { useStore } from '../store/useStore.jsx'
import { fmt } from '../utils'
import { BarChart3 } from 'lucide-react'

function categorize(account) {
  const a = account.toLowerCase()
  if (a.includes('cash') || a.includes('bank') || a.includes('petty')) return 'current-asset'
  if (a.includes('receivable') || a.includes('prepaid') || a.includes('inventory')) return 'current-asset'
  if (a.includes('equipment')) return 'fixed-asset'
  if (a.includes('payable') && !a.includes('pre')) return 'current-liability'
  if (a.includes('unearned') || a.includes('tax payable')) return 'current-liability'
  if (a.includes('capital') || a.includes('retained') || a.includes('equity')) return 'equity'
  if (a.includes('revenue') || a.includes('sales') || a.includes('income')) return 'revenue'
  if (a.includes('cost') || a.includes('expense') || a.includes('salaries') || a.includes('rent') || a.includes('utilities') || a.includes('supplies')) return 'expense'
  return null
}

function buildAccounts(vouchers) {
  const acc = {}
  vouchers.forEach(v => {
    ;(v.entries || []).forEach(e => {
      if (!e.account) return
      if (!acc[e.account]) acc[e.account] = { debit: 0, credit: 0 }
      acc[e.account].debit += parseFloat(e.debit || 0)
      acc[e.account].credit += parseFloat(e.credit || 0)
    })
  })
  return acc
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
  const { vouchers, bills, settings } = useStore()
  const cur = settings.currency
  const acc = buildAccounts(vouchers)

  // Bills add to cash/AR
  const paidBillsTotal = bills.filter(b => b.status === 'paid')
    .reduce((s, b) => s + parseFloat(b.total || 0), 0)
  const unpaidBillsTotal = bills.filter(b => b.status !== 'paid')
    .reduce((s, b) => s + parseFloat(b.total || 0), 0)

  const currentAssets = Object.entries(acc)
    .filter(([a]) => categorize(a) === 'current-asset')
    .map(([name, v]) => ({ name, amount: v.debit - v.credit }))
  if (paidBillsTotal > 0) currentAssets.push({ name: 'Cash from Collections', amount: paidBillsTotal })
  if (unpaidBillsTotal > 0) currentAssets.push({ name: 'Accounts Receivable (Invoices)', amount: unpaidBillsTotal })

  const fixedAssets = Object.entries(acc)
    .filter(([a]) => categorize(a) === 'fixed-asset')
    .map(([name, v]) => ({ name, amount: v.debit - v.credit }))

  const currentLiabilities = Object.entries(acc)
    .filter(([a]) => categorize(a) === 'current-liability')
    .map(([name, v]) => ({ name, amount: v.credit - v.debit }))

  const equity = Object.entries(acc)
    .filter(([a]) => categorize(a) === 'equity')
    .map(([name, v]) => ({ name, amount: v.credit - v.debit }))

  const revenue = Object.entries(acc)
    .filter(([a]) => categorize(a) === 'revenue')
    .map(([name, v]) => ({ name, amount: v.credit - v.debit }))
  const billRevenue = bills.filter(b => b.status === 'paid').reduce((s, b) => s + parseFloat(b.total || 0), 0)
  if (billRevenue > 0) {
    const existing = revenue.find(r => r.name === 'Service Revenue')
    if (existing) existing.amount += billRevenue
    else revenue.push({ name: 'Billing Revenue', amount: billRevenue })
  }

  const expenses = Object.entries(acc)
    .filter(([a]) => categorize(a) === 'expense')
    .map(([name, v]) => ({ name, amount: v.debit - v.credit }))

  const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0)
  const totalFixedAssets = fixedAssets.reduce((s, r) => s + r.amount, 0)
  const totalAssets = totalCurrentAssets + totalFixedAssets
  const totalLiabilities = currentLiabilities.reduce((s, r) => s + r.amount, 0)
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0)
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0)
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Financial Condition & Operations</div>
          <div className="page-sub">Balance Sheet · Income Statement</div>
        </div>
      </div>

      {(vouchers.length === 0 && bills.length === 0) ? (
        <div className="card">
          <div className="empty-state">
            <BarChart3 size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No financial data yet</div>
            <div style={{ fontSize: 13 }}>Post vouchers and invoices to generate reports</div>
          </div>
        </div>
      ) : (
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
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '10px 0',
              fontSize: 14, fontWeight: 800, borderTop: '2px solid var(--border2)',
            }}>
              <span>Total L + E</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>{fmt(totalLiabilities + totalEquity, cur)}</span>
            </div>
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
      )}
    </div>
  )
}
