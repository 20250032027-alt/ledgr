import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from './lib/supabase'
import { StoreProvider, useStore } from './store/useStore.jsx'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Vouchers from './pages/Vouchers'
import ChartOfAccounts from './pages/ChartOfAccounts'
import TrialBalance from './pages/TrialBalance'
import CashFlow from './pages/CashFlow'
import FinancialCondition from './pages/FinancialCondition'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import {
  LayoutDashboard, Users, FileText, Scale, Waves,
  BarChart3, Receipt, Settings as SettingsIcon, Menu, X,
  BookOpen, BookText, LogOut, AlertCircle, Loader2,
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'vouchers', label: 'Vouchers', icon: FileText },
  { id: 'accounts', label: 'Chart of Accounts', icon: BookText },
  { id: 'trial-balance', label: 'Trial Balance', icon: Scale },
  { id: 'cash-flow', label: 'Cash Flow', icon: Waves },
  { id: 'financial', label: 'Financial Reports', icon: BarChart3 },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

const PAGE_TITLES = {
  dashboard: 'Dashboard', clients: 'Clients', vouchers: 'Vouchers',
  accounts: 'Chart of Accounts', 'trial-balance': 'Trial Balance', 'cash-flow': 'Cash Flow',
  financial: 'Financial Reports', billing: 'Billing', settings: 'Settings',
}

const PAGES = {
  dashboard: Dashboard, clients: Clients, vouchers: Vouchers,
  accounts: ChartOfAccounts, 'trial-balance': TrialBalance, 'cash-flow': CashFlow,
  financial: FinancialCondition, billing: Billing, settings: Settings,
}

function AppShell({ userEmail }) {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, error, clearError } = useStore()
  const Page = PAGES[page]

  function navigate(id) { setPage(id); setSidebarOpen(false) }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
        <Loader2 size={22} className="spin" />
        <span style={{ fontSize: 13 }}>Loading your data…</span>
      </div>
    )
  }

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
          {NAV.slice(2, 7).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
          <div className="nav-section-label">Finance</div>
          {NAV.slice(7, 8).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
          <div className="nav-section-label">System</div>
          {NAV.slice(8).map(({ id, label, icon: Icon }) => (
            <div key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(v => !v)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="topbar-title">{PAGE_TITLES[page]}</div>
          <span className="topbar-date">{format(new Date(), 'EEEE, MMM d, yyyy')}</span>
        </header>

        {error && (
          <div style={{
            margin: '12px 24px 0', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--red)15', border: '1px solid var(--red)40',
            color: 'var(--red)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={clearError} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        <main><Page userEmail={userEmail} /></main>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = checking, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
        <Loader2 size={22} className="spin" />
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <StoreProvider userId={session.user.id}>
      <AppShell userEmail={session.user.email} />
    </StoreProvider>
  )
}
