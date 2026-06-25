import { useState } from 'react'
import { StoreProvider } from './store/useStore.jsx'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Vouchers from './pages/Vouchers'
import TrialBalance from './pages/TrialBalance'
import CashFlow from './pages/CashFlow'
import FinancialCondition from './pages/FinancialCondition'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import {
  LayoutDashboard, Users, FileText, Scale, Waves,
  BarChart3, Receipt, Settings as SettingsIcon, Menu, X,
  BookOpen,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'vouchers', label: 'Vouchers', icon: FileText },
  { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
  { id: 'cash-flow', label: 'Cash Flow', icon: Waves },
  { id: 'financial', label: 'Financial Reports', icon: BarChart3 },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

const PAGE_TITLES = {
  dashboard: 'Dashboard', clients: 'Clients', vouchers: 'Vouchers',
  'trial-balance': 'Trial Balance', 'cash-flow': 'Cash Flow',
  financial: 'Financial Reports', billing: 'Billing', settings: 'Settings',
}

const PAGES = {
  dashboard: Dashboard, clients: Clients, vouchers: Vouchers,
  'trial-balance': TrialBalance, 'cash-flow': CashFlow,
  financial: FinancialCondition, billing: Billing, settings: Settings,
}

function AppShell() {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const Page = PAGES[page]

  function navigate(id) { setPage(id); setSidebarOpen(false) }

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark"><BookOpen size={16} color="#fff" /></div>
          <div>
            <div className="sidebar-logo-text">Ledgr</div>
            <div className="sidebar-logo-sub">Accounting</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          {NAV.slice(0, 2).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
          <div className="nav-section-label">Accounting</div>
          {NAV.slice(2, 6).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
          <div className="nav-section-label">Finance</div>
          {NAV.slice(6, 7).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
          <div className="nav-section-label">System</div>
          {NAV.slice(7).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Ledgr v1.0</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Data stored locally</div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-title">{PAGE_TITLES[page]}</div>
        </header>
        <main><Page /></main>
      </div>
    </div>
  )
}

export default function App() {
  return <StoreProvider><AppShell /></StoreProvider>
}
