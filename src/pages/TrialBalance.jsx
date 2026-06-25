import { useStore } from '../store/useStore.jsx'
import { fmt } from '../utils'
import { Scale, CheckCircle, AlertCircle, Download } from 'lucide-react'

function buildTrialBalance(vouchers) {
  const accounts = {}
  vouchers.forEach(v => {
    ;(v.entries || []).forEach(e => {
      if (!e.account) return
      if (!accounts[e.account]) accounts[e.account] = { debit: 0, credit: 0 }
      accounts[e.account].debit += parseFloat(e.debit || 0)
      accounts[e.account].credit += parseFloat(e.credit || 0)
    })
  })
  return Object.entries(accounts).map(([account, { debit, credit }]) => ({
    account, debit, credit,
    balance: debit - credit,
  })).sort((a, b) => a.account.localeCompare(b.account))
}

function categorize(account) {
  const a = account.toLowerCase()
  if (a.includes('cash') || a.includes('bank') || a.includes('receivable') || a.includes('inventory') || a.includes('prepaid') || a.includes('equipment')) return 'Assets'
  if (a.includes('payable') || a.includes('unearned') || a.includes('tax')) return 'Liabilities'
  if (a.includes('capital') || a.includes('retained') || a.includes('equity')) return 'Equity'
  if (a.includes('revenue') || a.includes('sales') || a.includes('income')) return 'Revenue'
  if (a.includes('expense') || a.includes('cost') || a.includes('salaries') || a.includes('rent') || a.includes('utilities') || a.includes('supplies')) return 'Expenses'
  return 'Other'
}

export default function TrialBalance() {
  const { vouchers, settings } = useStore()
  const cur = settings.currency
  const rows = buildTrialBalance(vouchers)
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const grouped = {}
  rows.forEach(r => {
    const cat = categorize(r.account)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(r)
  })
  const order = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses', 'Other']

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Trial Balance</div>
          <div className="page-sub">Aggregated from all posted vouchers</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${balanced ? 'badge-green' : 'badge-red'}`}>
            {balanced ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
            {balanced ? 'Balanced' : 'Unbalanced'}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Scale size={36} color="var(--border2)" />
            <div style={{ fontWeight: 600 }}>No data yet</div>
            <div style={{ fontSize: 13 }}>Post vouchers to generate the trial balance</div>
          </div>
        </div>
      ) : (
        <>
          {order.filter(cat => grouped[cat]).map(cat => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '1px',
                textTransform: 'uppercase', color: 'var(--text-3)',
                padding: '6px 0', marginBottom: 4,
              }}>{cat}</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[cat].map(r => (
                      <tr key={r.account}>
                        <td style={{ fontWeight: 500 }}>{r.account}</td>
                        <td className="td-mono" style={{ textAlign: 'right' }}>
                          {r.debit > 0 ? fmt(r.debit, cur) : '—'}
                        </td>
                        <td className="td-mono" style={{ textAlign: 'right' }}>
                          {r.credit > 0 ? fmt(r.credit, cur) : '—'}
                        </td>
                        <td className="td-mono" style={{
                          textAlign: 'right',
                          color: r.balance > 0 ? 'var(--green)' : r.balance < 0 ? 'var(--red)' : 'var(--text-2)',
                        }}>
                          {fmt(Math.abs(r.balance), cur)}
                          {r.balance > 0 ? ' DR' : r.balance < 0 ? ' CR' : ''}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid var(--border2)' }}>
                      <td style={{ fontWeight: 700, fontSize: 12 }}>Subtotal</td>
                      <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {fmt(grouped[cat].reduce((s, r) => s + r.debit, 0), cur)}
                      </td>
                      <td className="td-mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {fmt(grouped[cat].reduce((s, r) => s + r.credit, 0), cur)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="card" style={{ marginTop: 8 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Grand Totals</div>
              <div style={{ display: 'flex', gap: 32, fontFamily: 'var(--mono)', fontSize: 14 }}>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11, display: 'block', marginBottom: 2 }}>TOTAL DEBIT</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmt(totalDebit, cur)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11, display: 'block', marginBottom: 2 }}>TOTAL CREDIT</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmt(totalCredit, cur)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-3)', fontSize: 11, display: 'block', marginBottom: 2 }}>DIFFERENCE</span>
                  <span style={{ color: balanced ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    {fmt(Math.abs(totalDebit - totalCredit), cur)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
