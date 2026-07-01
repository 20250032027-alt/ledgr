export function toSnakeKey(k) { return k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()) }
export function toCamelKey(k) { return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()) }

const BILL_COLS = new Set([
  'number', 'client_id', 'client_name', 'date', 'due_date', 'lines', 'notes',
  'apply_tax', 'subtotal', 'tax', 'total', 'status',
  'receivable_account', 'revenue_account', 'cash_account', 'paid_date',
  'updated_at',
])

const STRIP_ON_WRITE = new Set(['id', 'userId', 'createdAt', '_dirty', '_deleted'])

export function toBillDb(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_ON_WRITE.has(k)) continue
    const snake = toSnakeKey(k)
    if (BILL_COLS.has(snake)) out[snake] = v === '' ? null : v
  }
  return out
}

export function toDb(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_ON_WRITE.has(k)) continue
    out[toSnakeKey(k)] = v === '' ? null : v
  }
  return out
}

export function fromDb(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue
    out[toCamelKey(k)] = v
  }
  return out
}
