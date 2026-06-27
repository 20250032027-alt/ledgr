import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_ACCOUNTS } from './defaultAccounts'

const defaultSettings = {
  company: 'My Company',
  address: '',
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
  const [templates, setTemplates] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refreshRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)

      const results = await Promise.allSettled([
        supabase.from('accounts').select('*'),
        supabase.from('clients').select('*').order('created_at'),
        supabase.from('vouchers').select('*').order('created_at'),
        supabase.from('bills').select('*').order('created_at'),
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('voucher_templates').select('*').order('created_at'),
      ])
      if (cancelled) return

      const [accRes, cliRes, vouRes, billRes, setRes, tplRes] = results
      const loadErrors = []

      // Each table is handled independently — one missing/broken table
      // (e.g. a migration that hasn't been run yet) shouldn't stop the rest
      // of the app's data from loading.
      function unwrap(res, label) {
        if (res.status === 'rejected') { loadErrors.push(`${label}: ${res.reason?.message || 'failed to load'}`); return undefined }
        if (res.value.error) { loadErrors.push(`${label}: ${res.value.error.message}`); return undefined }
        return res.value.data
      }

      const accData = unwrap(accRes, 'Accounts')
      const cliData = unwrap(cliRes, 'Clients')
      const vouData = unwrap(vouRes, 'Vouchers')
      const billData = unwrap(billRes, 'Bills')
      const setData = unwrap(setRes, 'Settings')
      const tplData = unwrap(tplRes, 'Voucher templates')

      if (accData) setAccounts(sortByCode(accData.map(fromDb)))
      if (cliData) setClients(cliData.map(fromDb))
      if (vouData) setVouchers(vouData.map(fromDb))
      if (billData) setBills(billData.map(fromDb))
      if (tplData) setTemplates(tplData.map(fromDb))

      if (setData) {
        setSettings(fromDb(setData))
      } else if (!loadErrors.some(e => e.startsWith('Settings'))) {
        // No settings row yet — first login for this user, create one.
        try {
          const { data, error: insErr } = await supabase
            .from('settings').insert(toDb(defaultSettings)).select().single()
          if (insErr) throw insErr
          if (!cancelled && data) setSettings(fromDb(data))
        } catch (e) {
          loadErrors.push(`Settings: ${e.message || 'failed to create default settings'}`)
        }
      }

      if (!cancelled) {
        if (loadErrors.length) setError(`Some data failed to load — ${loadErrors.join('; ')}`)
        setLoading(false)
      }
    }
    refreshRef.current = loadAll
    loadAll()
    return () => { cancelled = true }
  }, [userId])

  function refresh() { if (refreshRef.current) refreshRef.current() }

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
  // Helper: find a CoA account by name (case-insensitive), return its name or fallback
  function coaName(preferred, fallback) {
    const match = accounts.find(a => a.name.trim().toLowerCase() === preferred.toLowerCase())
    return match ? match.name : (fallback || preferred)
  }

  async function addBill(bill) {
    const num = `INV-${String(bills.length + 1).padStart(4, '0')}`
    const { data, error: e } = await supabase
      .from('bills').insert(toDb({ ...bill, number: num, status: 'unpaid' })).select().single()
    if (e) { fail(e, 'Could not create invoice'); return null }
    const rec = fromDb(data)
    setBills(b => [...b, rec])

    // Auto-post: DR chosen Receivable Account / CR Service Revenue
    const arAccount = bill.receivableAccount || coaName('Accounts Receivable')
    const revAccount = coaName('Service Revenue', 'Sales Revenue')
    const vNum = `JE-INV-${num}`
    await supabase.from('vouchers').insert(toDb({
      number: vNum,
      type: 'general',
      date: bill.date || new Date().toISOString().slice(0, 10),
      memo: `Invoice ${num} — ${bill.clientName || ''}`,
      reference: num,
      entries: [
        { account: arAccount, description: `Receivable from ${bill.clientName || ''}`, debit: bill.total, credit: 0 },
        { account: revAccount, description: `Revenue for ${num}`, debit: 0, credit: bill.total },
      ],
    }))
    // Reload vouchers so the ledger reflects the new entry
    const { data: vd } = await supabase.from('vouchers').select('*').order('created_at')
    if (vd) setVouchers(vd.map(fromDb))

    return rec.id
  }

  async function updateBill(id, patch) {
    const existing = bills.find(b => b.id === id)
    const { data, error: e } = await supabase.from('bills').update(toDb(patch)).eq('id', id).select().single()
    if (e) { fail(e, 'Could not update invoice'); return }
    const updated = fromDb(data)
    setBills(b => b.map(x => x.id === id ? updated : x))

    // Auto-post collection entry when status changes to 'paid'
    if (patch.status === 'paid' && existing?.status !== 'paid') {
      const arAccount = coaName('Accounts Receivable')
      const cashAccount = coaName(patch.cashAccount || 'Cash')
      const inv = updated
      const vNum = `JE-PAY-${inv.number}`
      await supabase.from('vouchers').insert(toDb({
        number: vNum,
        type: 'general',
        date: patch.paidDate || new Date().toISOString().slice(0, 10),
        memo: `Collection for ${inv.number} — ${inv.clientName || ''}`,
        reference: inv.number,
        entries: [
          { account: cashAccount, description: `Cash received from ${inv.clientName || ''}`, debit: inv.total, credit: 0 },
          { account: arAccount, description: `Clear receivable for ${inv.number}`, debit: 0, credit: inv.total },
        ],
      }))
      const { data: vd } = await supabase.from('vouchers').select('*').order('created_at')
      if (vd) setVouchers(vd.map(fromDb))
    }
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

  // ---- Voucher Templates ----
  async function addTemplate(template) {
    const { data, error: e } = await supabase.from('voucher_templates').insert(toDb(template)).select().single()
    if (e) { fail(e, 'Could not save template'); return null }
    const rec = fromDb(data)
    setTemplates(t => [...t, rec])
    return rec.id
  }
  async function deleteTemplate(id) {
    const { error: e } = await supabase.from('voucher_templates').delete().eq('id', id)
    if (e) { fail(e, 'Could not delete template'); return }
    setTemplates(t => t.filter(x => x.id !== id))
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
      clients, vouchers, bills, accounts, templates, settings, loading, error,
      clearError: () => setError(null),
      refresh,
      addClient, updateClient, deleteClient,
      addVoucher, updateVoucher, deleteVoucher,
      addBill, updateBill, deleteBill,
      addAccount, updateAccount, deleteAccount, seedDefaultAccounts,
      addTemplate, deleteTemplate,
      updateSettings, deleteAllData,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
