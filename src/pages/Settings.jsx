import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { Settings as SettingsIcon, Save } from 'lucide-react'

export default function Settings() {
  const { settings, updateSettings } = useStore()
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
        <div className="card-title" style={{ marginBottom: 12 }}>Data</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          All data is stored locally in your browser. No data is sent to any server.
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => {
          if (confirm('Clear all data? This cannot be undone.')) {
            localStorage.removeItem('ledgr_data')
            location.reload()
          }
        }}>
          Clear All Data
        </button>
      </div>
    </div>
  )
}
