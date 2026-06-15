import { useEffect, useState, useCallback } from 'react'
import { Users, Search, Download } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { formatCOP, formatDate, objectsToCSV } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

interface Cliente {
  id:             number
  nombre:         string
  email:          string | null
  telefono:       string | null
  dni:            string | null
  total_compras:  number
  total_gastado:  number
  ultima_compra:  string | null
  created_at:     string
}

export default function Clientes() {
  const toast = useToast()

  const [loading,  setLoading]  = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')

  const loadClientes = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.electronAPI.db.query<Cliente>(`
        SELECT
          c.id,
          c.nombre,
          c.email,
          c.telefono,
          c.dni,
          COUNT(v.id)           AS total_compras,
          COALESCE(SUM(v.total), 0) AS total_gastado,
          MAX(v.fecha)          AS ultima_compra,
          c.created_at
        FROM clientes c
        LEFT JOIN ventas v ON v.cliente_id = c.id AND v.estado != 'cancelado'
        GROUP BY c.id
        ORDER BY total_gastado DESC, c.nombre ASC
      `)
      setClientes(rows)
    } catch {
      toast.error('Error cargando clientes')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadClientes() }, [loadClientes])

  const filtrados = clientes.filter(c => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.email    ?? '').toLowerCase().includes(q) ||
      (c.telefono ?? '').toLowerCase().includes(q) ||
      (c.dni      ?? '').toLowerCase().includes(q)
    )
  })

  function handleExportCsv() {
    if (filtrados.length === 0) return
    const data = filtrados.map(c => ({
      'ID':            c.id,
      'Nombre':        c.nombre,
      'Email':         c.email        ?? '',
      'Teléfono':      c.telefono     ?? '',
      'Cédula/DNI':    c.dni          ?? '',
      'Compras':       c.total_compras,
      'Total gastado': c.total_gastado,
      'Última compra': c.ultima_compra ?? '',
    }))
    const csv = objectsToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'clientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                          justify-center text-accent shrink-0">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary">Clientes</h2>
            <p className="text-sm text-primary-muted">{clientes.length} clientes registrados</p>
          </div>
        </div>
        <button onClick={handleExportCsv} disabled={filtrados.length === 0} className="btn-ghost">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-primary-muted">Total clientes</p>
          <p className="text-2xl font-bold text-primary mt-1">{clientes.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-primary-muted">Con email</p>
          <p className="text-2xl font-bold text-primary mt-1">
            {clientes.filter(c => c.email).length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-primary-muted">Con más de 1 compra</p>
          <p className="text-2xl font-bold text-accent mt-1">
            {clientes.filter(c => c.total_compras > 1).length}
          </p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre, email, teléfono o cédula…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="input pl-8"
        />
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin clientes"
          description="Los clientes se crean automáticamente al registrar ventas con datos de contacto."
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[#0B0B16]">
                <th className="th text-left px-4 py-2.5">Nombre</th>
                <th className="th text-left px-4 py-2.5">Email</th>
                <th className="th text-left px-4 py-2.5">Teléfono</th>
                <th className="th text-left px-4 py-2.5">Cédula</th>
                <th className="th text-right px-4 py-2.5">Compras</th>
                <th className="th text-right px-4 py-2.5">Total gastado</th>
                <th className="th text-left px-4 py-2.5">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5 text-sm font-semibold text-primary">{c.nombre}</td>
                  <td className="px-4 py-2.5 text-sm text-primary-muted">{c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-primary-muted">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-primary-muted font-mono">{c.dni ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`badge text-xs ${
                      c.total_compras > 1
                        ? 'bg-accent-light text-accent border-accent/20'
                        : 'bg-white/5 text-primary-muted border-border'
                    }`}>
                      {c.total_compras} {c.total_compras === 1 ? 'compra' : 'compras'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-primary">
                    {formatCOP(c.total_gastado)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-primary-muted">
                    {c.ultima_compra ? formatDate(c.ultima_compra) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
