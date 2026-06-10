import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Download, Receipt } from 'lucide-react'
import { useAppStore, useToast, useModal } from '@/store/useAppStore'
import { getGastos, getTotalGastos } from '@/lib/queries'
import { formatCOP, formatDate, objectsToCSV } from '@/lib/utils'
import { FullPageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import GastoForm from './GastoForm'
import GastoFila from './GastoFila'

interface Gasto {
  id:               number
  descripcion:      string
  monto:            number
  fecha:            string
  categoria_id:     number
  categoria_nombre: string
  categoria_color:  string
  comprobante_url:  string | null
  notas:            string | null
}

export default function Gastos() {
  const { filtroAnio, filtroMes } = useAppStore()
  const toast  = useToast()
  const { openModal, closeModal } = useModal()

  const [loading,     setLoading]     = useState(true)
  const [gastos,      setGastos]      = useState<Gasto[]>([])
  const [totalGastos, setTotalGastos] = useState(0)
  const [busqueda,    setBusqueda]    = useState('')
  const [catFiltro,   setCatFiltro]   = useState<number | null>(null)

  const loadGastos = useCallback(async () => {
    setLoading(true)
    try {
      const [data, total] = await Promise.all([
        getGastos(filtroAnio, filtroMes) as unknown as Promise<Gasto[]>,
        getTotalGastos(filtroAnio, filtroMes)
      ])
      setGastos(data)
      setTotalGastos(total)
    } catch {
      toast.error('Error al cargar gastos')
    } finally {
      setLoading(false)
    }
  }, [filtroAnio, filtroMes])

  useEffect(() => { loadGastos() }, [loadGastos])

  // Categorías únicas para filtro
  const categorias = Array.from(
    new Map(gastos.map(g => [g.categoria_id, {
      id:     g.categoria_id,
      nombre: g.categoria_nombre,
      color:  g.categoria_color
    }])).values()
  )

  // Filtrado local
  const gastosFiltrados = gastos.filter(g => {
    const matchBusqueda = !busqueda ||
      g.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      g.categoria_nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = catFiltro === null || g.categoria_id === catFiltro
    return matchBusqueda && matchCat
  })

  // Total filtrado
  const totalFiltrado = gastosFiltrados.reduce((s, g) => s + g.monto, 0)

  // Gastos por categoría para resumen
  const porCategoria = categorias.map(cat => ({
    ...cat,
    total: gastos
      .filter(g => g.categoria_id === cat.id)
      .reduce((s, g) => s + g.monto, 0)
  })).sort((a, b) => b.total - a.total)

  function handleNuevoGasto() {
    openModal(
      <GastoForm
        onSuccess={() => { closeModal(); loadGastos() }}
        onCancel={closeModal}
      />
    )
  }

  function handleEditarGasto(gasto: Gasto) {
    openModal(
      <GastoForm
        gasto={gasto}
        onSuccess={() => { closeModal(); loadGastos() }}
        onCancel={closeModal}
      />
    )
  }

  async function handleEliminarGasto(id: number) {
    try {
      await window.electronAPI.db.run(
        `DELETE FROM gastos WHERE id = ?`, [id]
      )
      toast.success('Gasto eliminado')
      loadGastos()
    } catch {
      toast.error('Error al eliminar gasto')
    }
  }

  function handleExportar() {
    if (gastosFiltrados.length === 0) {
      toast.warning('No hay gastos para exportar')
      return
    }
    const data = gastosFiltrados.map(g => ({
      Fecha:      formatDate(g.fecha),
      Categoria:  g.categoria_nombre,
      Descripcion: g.descripcion,
      Monto:      g.monto,
      Notas:      g.notas ?? ''
    }))
    const csv  = objectsToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `gastos_${filtroAnio}_${filtroMes}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Gastos exportados')
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Barra de acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-muted"
          />
          <input
            type="text"
            placeholder="Buscar por descripción o categoría…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input pl-8 h-9 text-[13.5px]"
          />
        </div>

        <button onClick={handleExportar} className="btn-ghost h-9 text-[13px]">
          <Download size={14} />
          CSV
        </button>

        <button onClick={handleNuevoGasto} className="btn-primary h-9 text-[13px]">
          <Plus size={14} />
          Nuevo gasto
        </button>
      </div>

      {/* Resumen por categoría */}
      {porCategoria.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCatFiltro(null)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border
                        text-[12.5px] font-semibold transition-all
                        ${catFiltro === null
                          ? 'bg-accent-light border-accent/40 text-accent'
                          : 'border-border text-primary-muted hover:border-accent/30'
                        }`}
          >
            Todos
            <span className="font-bold">{formatCOP(totalGastos)}</span>
          </button>
          {porCategoria.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCatFiltro(catFiltro === cat.id ? null : cat.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border
                          text-[12.5px] font-semibold transition-all
                          ${catFiltro === cat.id
                            ? 'bg-accent-light border-accent/40 text-accent'
                            : 'border-border text-primary-muted hover:border-accent/30'
                          }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color ?? '#8A8AA8' }}
              />
              {cat.nombre}
              <span className="font-bold">{formatCOP(cat.total)}</span>
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Total gastos</p>
          <p className="text-[20px] font-bold text-danger">
            {formatCOP(totalFiltrado)}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Registros</p>
          <p className="text-[20px] font-bold text-primary">
            {gastosFiltrados.length}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Promedio</p>
          <p className="text-[20px] font-bold text-primary">
            {gastosFiltrados.length > 0
              ? formatCOP(totalFiltrado / gastosFiltrados.length)
              : '$0'
            }
          </p>
        </div>
        <div className="card py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider
                        text-primary-muted mb-1">Categorías</p>
          <p className="text-[20px] font-bold text-primary">
            {categorias.length}
          </p>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <FullPageSpinner />
      ) : gastosFiltrados.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos"
          description={
            busqueda || catFiltro
              ? 'No se encontraron gastos con ese filtro.'
              : 'No hay gastos registrados en este período.'
          }
          action={
            !busqueda && !catFiltro && (
              <button onClick={handleNuevoGasto} className="btn-primary">
                <Plus size={14} /> Nuevo gasto
              </button>
            )
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th className="text-right">Monto</th>
                  <th>Notas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map(gasto => (
                  <GastoFila
                    key={gasto.id}
                    gasto={gasto}
                    onEditar={() => handleEditarGasto(gasto)}
                    onEliminar={() => handleEliminarGasto(gasto.id)}
                  />
                ))}
              </tbody>

              {/* Totales */}
              <tfoot>
                <tr className="border-t border-border bg-[#0B0B16]">
                  <td colSpan={3} className="px-4 py-3 text-[13px]
                                             font-bold text-primary-muted">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold
                                 text-[15px] text-danger">
                    {formatCOP(totalFiltrado)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}