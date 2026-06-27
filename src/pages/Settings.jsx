import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { supabase } from '../lib/supabase'
import { Save, LogOut, Cloud } from 'lucide-react'

export default function Settings({ userEmail }) {
  const { settings, updateSettings, deleteAllData } = useStore()
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function save() {
    updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page-content" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <div>
          <div className="page-h1">Settings</div>
          <div className="page-sub">Company info and preferences</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Company Details</div>
        </div>
        <div className="form-grid">
          <div className="form-group form-col-full">
            <label className="form-label">Company Name</label>
            <input className="form-input" value={form.company} onChange={e => setF('company', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-select" value={form.currency} onChange={e => setF('currency', e.target.value)}>
              <option value="PHP">PHP — Philippine Peso</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="SGD">SGD — Singapore Dollar</option>
              <option value="JPY">JPY — Japanese Yen</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Default VAT Rate (%)</label>
            <input className="form-input" type="number" min="0" max="100" step="0.5"
              value={form.taxRate} onChange={e => setF('taxRate', parseFloat(e.target.value))} />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={save}>
            <Save size={14} />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Account</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Cloud size={14} /> Signed in as <strong style={{ color: 'var(--text-1)' }}>{userEmail}</strong>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Data</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Your data is synced to your Supabase cloud database, so it's backed up and
          available from any device you sign into.
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => {
          if (confirm('Delete all accounts, clients, vouchers and invoices? This cannot be undone.')) {
            deleteAllData()
          }
        }}>
          Delete All My Data
        </button>
      </div>
    </div>
  )
}
