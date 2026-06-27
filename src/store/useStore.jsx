import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_ACCOUNTS } from './defaultAccounts'

const defaultSettings = {
  company: 'My Company',
  currency: 'PHP',
  taxRate: 12,
}

// ---- snake_case <-> camelCase helpers (top-level keys only; jsonb blobs
// like `entries`/`lines` already use single-word keys so they pass through
// untouched). ----
function toSnakeKey(k) { return k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()) }
function toCamelKey(k) { return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()) }

function toDb(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'user_id' || k === 'createdAt') continue
    out[toSnakeKey(k)] = v === '' ? null : v
  }
  return out
}
function fromDb(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue
    out[toCamelKey(k)] = v
  }
  return out
}
function sortByCode(list) {
  return [...list].sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
}

const StoreContext = createContext(null)

export function StoreProvider({ children, userId }) {
  const [clients, setClients] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [bills, setBills] = useState([])
  const [accounts, setAccounts] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)
      try {
        const [accRes, cliRes, vouRes, billRes, setRes] = await Promise.all([
          supabase.from('accounts').select('*'),
          supabase.from('clients').select('*').order('created_at'),
          supabase.from('vouchers').select('*').order('created_at'),
          supabase.from('bills').select('*').order('created_at'),
          supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        ])
        if (cancelled) return
        for (const res of [accRes, cliRes, vouRes, billRes, setRes]) {
          if (res.error) throw res.error
        }

        setAccounts(sortByCode((accRes.data || []).map(fromDb)))
        setClients((cliRes.data || []).map(fromDb))
        setVouchers((vouRes.data || []).map(fromDb))
        setBills((billRes.data || []).map(fromDb))

        if (setRes.data) {
          setSettings(fromDb(setRes.data))
        } else {
          // First login for this user: create their settings row.
          const { data, error: insErr } = await supabase
            .from('settings').insert(toDb(defaultSettings)).select().single()
          if (insErr) throw insErr
          if (!cancelled && data) setSettings(fromDb(data))
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load your data from Supabase.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [userId])

  function fail(e, fallbackMsg) {
    setError(e?.message || fallbackMsg)
  }

  // ---- Clients ----
  async function addClient(client) {
    const { data, error: e } = await supabase.from('clients').insert(toDb(client)).select().single()
    if (e) { fail(e, 'Could not add client'); return null }
    const rec = fromDb(data)
    setClients(c => [...c, rec])
    return rec.id
  }
  async function updateClient(id, patch) {
    const { data, error: e } = await supabase.from('clients').update(toDb(patch)).eq('id', id).select().single()
    if (e) { fail(e, 'Could not update client'); return }
    setClients(c => c.map(x => x.id === id ? fromDb(data) : x))
  }
  async function deleteClient(id) {
    const { error: e } = await supabase.from('clients').delete().eq('id', id)
    if (e) { fail(e, 'Could not delete client'); return }
    setClients(c => c.filter(x => x.id !== id))
  }

  // ---- Vouchers ----
  async function addVoucher(voucher) {
    const num = `V-${String(vouchers.length + 1).padStart(4, '0')}`
    const { data, error: e } = await supabase
      .from('vouchers').insert(toDb({ ...voucher, number: num })).select().single()
    if (e) { fail(e, 'Could not post voucher'); return null }
    const rec = fromDb(data)
    setVouchers(v => [...v, rec])
    return rec.id
  }
  async function updateVoucher(id, patch) {
    const { data, error: e } = await supabase.from('vouchers').update(toDb(patch)).eq('id', id).select().single()
    if (e) { fail(e, 'Could not update voucher'); return }
    setVouchers(v => v.map(x => x.id === id ? fromDb(data) : x))
  }
  async function deleteVoucher(id) {
    const { error: e } = await supabase.from('vouchers').delete().eq('id', id)
    if (e) { fail(e, 'Could not delete voucher'); return }
    setVouchers(v => v.filter(x => x.id !== id))
  }

  // ---- Bills ----
  async function addBill(bill) {
    const num = `INV-${String(bills.length + 1).padStart(4, '0')}`
    const { data, error: e } = await supabase
      .from('bills').insert(toDb({ ...bill, number: num, status: 'unpaid' })).select().single()
    if (e) { fail(e, 'Could not create invoice'); return null }
    const rec = fromDb(data)
    setBills(b => [...b, rec])
    return rec.id
  }
  async function updateBill(id, patch) {
    const { data, error: e } = await supabase.from('bills').update(toDb(patch)).eq('id', id).select().single()
    if (e) { fail(e, 'Could not update invoice'); return }
    setBills(b => b.map(x => x.id === id ? fromDb(data) : x))
  }
  async function deleteBill(id) {
    const { error: e } = await supabase.from('bills').delete().eq('id', id)
    if (e) { fail(e, 'Could not delete invoice'); return }
    setBills(b => b.filter(x => x.id !== id))
  }

  // ---- Accounts (Chart of Accounts) ----
  async function addAccount(account) {
    const { data, error: e } = await supabase.from('accounts').insert(toDb(account)).select().single()
    if (e) { fail(e, 'Could not add account'); return null }
    const rec = fromDb(data)
    setAccounts(a => sortByCode([...a, rec]))
    return rec.id
  }
  async function updateAccount(id, patch) {
    const { data, error: e } = await supabase.from('accounts').update(toDb(patch)).eq('id', id).select().single()
    if (e) { fail(e, 'Could not update account'); return }
    setAccounts(a => sortByCode(a.map(x => x.id === id ? fromDb(data) : x)))
  }
  async function deleteAccount(id) {
    const { error: e } = await supabase.from('accounts').delete().eq('id', id)
    if (e) { fail(e, 'Could not delete account'); return }
    setAccounts(a => a.filter(x => x.id !== id))
  }
  async function seedDefaultAccounts() {
    const { data, error: e } = await supabase
      .from('accounts').insert(DEFAULT_ACCOUNTS.map(toDb)).select()
    if (e) { fail(e, 'Could not seed default accounts'); return }
    setAccounts(a => sortByCode([...a, ...(data || []).map(fromDb)]))
  }

  // ---- Settings ----
  async function updateSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error: e } = await supabase.from('settings').update(toDb(patch)).eq('user_id', userId)
    if (e) fail(e, 'Could not save settings')
  }

  // ---- Danger zone ----
  async function deleteAllData() {
    await Promise.all([
      supabase.from('vouchers').delete().eq('user_id', userId),
      supabase.from('bills').delete().eq('user_id', userId),
      supabase.from('accounts').delete().eq('user_id', userId),
      supabase.from('clients').delete().eq('user_id', userId),
    ])
    setVouchers([]); setBills([]); setAccounts([]); setClients([])
  }

  return (
    <StoreContext.Provider value={{
      clients, vouchers, bills, accounts, settings, loading, error,
      clearError: () => setError(null),
      addClient, updateClient, deleteClient,
      addVoucher, updateVoucher, deleteVoucher,
      addBill, updateBill, deleteBill,
      addAccount, updateAccount, deleteAccount, seedDefaultAccounts,
      updateSettings, deleteAllData,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
