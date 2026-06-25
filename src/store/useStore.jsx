import { useState, useEffect, createContext, useContext } from 'react'

const defaultState = {
  clients: [],
  vouchers: [],
  bills: [],
  settings: {
    company: 'My Company',
    currency: 'PHP',
    taxRate: 12,
  },
}

const STORAGE_KEY = 'ledgr_data'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    return { ...defaultState, ...JSON.parse(raw) }
  } catch {
    return defaultState
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)

  useEffect(() => { save(state) }, [state])

  function update(partial) {
    setState(s => ({ ...s, ...partial }))
  }

  // Clients
  function addClient(client) {
    const id = crypto.randomUUID()
    const rec = { ...client, id, createdAt: new Date().toISOString() }
    update({ clients: [...state.clients, rec] })
    return id
  }
  function updateClient(id, patch) {
    update({ clients: state.clients.map(c => c.id === id ? { ...c, ...patch } : c) })
  }
  function deleteClient(id) {
    update({ clients: state.clients.filter(c => c.id !== id) })
  }

  // Vouchers
  function addVoucher(voucher) {
    const id = crypto.randomUUID()
    const num = `V-${String(state.vouchers.length + 1).padStart(4, '0')}`
    const rec = { ...voucher, id, number: num, createdAt: new Date().toISOString() }
    update({ vouchers: [...state.vouchers, rec] })
    return id
  }
  function updateVoucher(id, patch) {
    update({ vouchers: state.vouchers.map(v => v.id === id ? { ...v, ...patch } : v) })
  }
  function deleteVoucher(id) {
    update({ vouchers: state.vouchers.filter(v => v.id !== id) })
  }

  // Bills
  function addBill(bill) {
    const id = crypto.randomUUID()
    const num = `INV-${String(state.bills.length + 1).padStart(4, '0')}`
    const rec = { ...bill, id, number: num, status: 'unpaid', createdAt: new Date().toISOString() }
    update({ bills: [...state.bills, rec] })
    return id
  }
  function updateBill(id, patch) {
    update({ bills: state.bills.map(b => b.id === id ? { ...b, ...patch } : b) })
  }
  function deleteBill(id) {
    update({ bills: state.bills.filter(b => b.id !== id) })
  }

  function updateSettings(patch) {
    update({ settings: { ...state.settings, ...patch } })
  }

  return (
    <StoreContext.Provider value={{
      ...state,
      addClient, updateClient, deleteClient,
      addVoucher, updateVoucher, deleteVoucher,
      addBill, updateBill, deleteBill,
      updateSettings,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
