import { useStore } from '../store/useStore.jsx'
import { fmt, fmtDate } from '../utils'
import { ArrowUpRight, ArrowDownRight, Waves } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-2)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontFamily: 'var(--mono)' }}>
          {p.name}: ₱{p.value.toLocaleString()}
        </div>
      ))}
    </div>
  )
}

export default function CashFlow() {
  const { vouchers, bills, settings } = useStore()
  const cur = settings.currency

  // Operating: bills paid = inflow, expense vouchers = outflow
  const operatingIn = bills.filter(b => b.status === 'paid')
    .reduce((s, b) => s + parseFloat(b.total || 0), 0)
  const operatingOut = vouchers.filter(v => v.type === 'expense' || v.type === 'cash disbursement')
    .reduce((s, v) => s + (v.entries || []).reduce((a, e) => a + parseFloat(e.debit || 0), 0), 0)

  // Investing: vouchers with equipment accounts
  const investingOut = vouchers
    .filter(v => (v.entries || []).some(e => e.account?.toLowerCase().includes('equipment')))
    .reduce((s, v) => s + (v.entries || []).filter(e => e.account?.toLowerCase().includes('equipment'))
      .reduce((a, e) => a + parseFloat(e.debit || 0), 0), 0)

  // Financing: capital entries
  const financingIn = vouchers
    .filter(v => (v.entries || []).some(e => e.account?.toLowerCase().includes('capital')))
    .reduce((s, v) => s + (v.entries || []).filter(e => e.account?.toLowerCase().includes('capital'))
      .reduce((a, e) => a + parseFloat(e.credit || 0), 0), 0)

  const netCash = (operatingIn - operatingOut) + (-investingOut) + financingIn

  // Monthly data
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString('en', { month: 'short' })
    const yr = d.getFullYear(), mo = d.getMonth()
    const inflow = bills.filter(b => {
      const bd = new Date(b.createdAt)
      return bd.getMonth() === mo && bd.getFullYear() === yr && b.status === 'paid'
    }).reduce((s, b) => s + parseFloat(b.total || 0), 0)
    const outflow = vouchers.filter(v => {
      const vd = new Date(v.createdAt)
      return vd.getMonth() === mo && vd.getFullYear() === yr &&
        (v.type === 'expense' || v.type === 'cash disbursement')
    }).reduce((s, v) => s + (v.entries || []).reduce((a, e) => a + parseFloat(e.debit || 0), 0), 0)
    months.push({ label, inflow, outflow, net: inflow - outflow })
  }

  // Recent transactions
  const transactions = [
    ...bills.filter(b => b.status === 'paid').map(b => ({
      id: b.id, date: b.createdAt, label: `Invoice ${b.number}`,
      amount: parseFloat(b.total || 0), type: 'inflow',
    })),
    ...vouchers.filter(v => v.type === 'expense' || v.type === 'cash disbursement').map(v => ({
      id: v.id, date: v.createdAt, label: `${v.number} — ${v.memo || v.type}`,
      amount: (v.entries || []).reduce((a, e) => a + parseFloat(e.debit || 0), 0), type: 'outflow',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-h1">Cash Flow</div>
          <div className="page-sub">Cash position and movement</div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: 'Operating Inflows', val: operatingIn, color: 'var(--green)', icon: ArrowUpRight },
          { label: 'Operating Outflows', val: operatingOut, color: 'var(--red)', icon: ArrowDownRight },
          { label: 'Investing Activities', val: -investingOut, color: 'var(--amber)', icon: ArrowDownRight },
          { label: 'Financing Activities', val: financingIn, color: 'var(--accent)', icon: ArrowUpRight },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="stat-label">{s.label}</span>
              <s.icon size={14} color={s.color} />
            </div>
            <div className="stat-value" style={{ fontSize: 20, color: s.color }}>{fmt(s.val, cur)}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 16,
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Net Cash Position</div>
          <div style={{
            fontSize: 28, fontWeight: 800, fontFamily: 'var(--mono)',
            color: netCash >= 0 ? 'var(--green)' : 'var(--red)',
            letterSpacing: '-1px',
          }}>
            {fmt(netCash, cur)}
          </div>
        </div>

        <div className="card-title" style={{ marginBottom: 12 }}>6-Month Overview</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3347" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
            <Bar dataKey="inflow" name="Inflow" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Cash Movements</div>
        </div>
        {transactions.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <Waves size={24} />
            <span style={{ fontSize: 13 }}>No cash transactions yet</span>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Flow</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td className="td-mono">{fmtDate(t.date)}</td>
                    <td style={{ fontSize: 13 }}>{t.label}</td>
                    <td>
                      <span className={`badge ${t.type === 'inflow' ? 'badge-green' : 'badge-red'}`}>
                        {t.type === 'inflow' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {t.type}
                      </span>
                    </td>
                    <td className="td-mono" style={{
                      textAlign: 'right',
                      color: t.type === 'inflow' ? 'var(--green)' : 'var(--red)',
                    }}>
                      {t.type === 'inflow' ? '+' : '-'}{fmt(t.amount, cur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
