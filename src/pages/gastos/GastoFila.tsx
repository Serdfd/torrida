import { useState } from 'react'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import { formatCOP, formatDate } from '@/lib/utils'
import { useModal } from '@/store/useAppStore'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

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

interface GastoFilaProps {
  gasto:      Gasto
  onEditar:   () => void
  onEliminar: () => void
}

export default function GastoFila({
  gasto,
  onEditar,
  onEliminar
}: GastoFilaProps) {
  const { openModal, closeModal } = useModal()
  const [deleting, setDeleting]   = useState(false)

  function handleEliminar() {
    openModal(
      <ConfirmDialog
        title="¿Eliminar este gasto?"
        description={`"${gasto.descripcion}" · ${formatCOP(gasto.monto)} — esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onCancel={closeModal}
        onConfirm={() => {
          closeModal()
          setDeleting(true)
          onEliminar()
        }}
      />
    )
  }

  return (
    <tr className={deleting ? 'opacity-40 pointer-events-none' : ''}>

      {/* Fecha */}
      <td className="text-primary-muted text-[13px] whitespace-nowrap">
        {formatDate(gasto.fecha)}
      </td>

      {/* Categoría */}
      <td>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: gasto.categoria_color ?? '#8A8AA8' }}
          />
          <span className="text-[12.5px] font-semibold text-primary-muted">
            {gasto.categoria_nombre}
          </span>
        </div>
      </td>

      {/* Descripción */}
      <td>
        <p className="text-[13.5px] text-primary font-medium">
          {gasto.descripcion}
        </p>
        {gasto.comprobante_url && (
          <a
            href={gasto.comprobante_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px]
                       text-accent hover:underline mt-0.5"
          >
            <ExternalLink size={10} />
            Ver comprobante
          </a>
        )}
      </td>

      {/* Monto */}
      <td className="text-right">
        <span className="font-bold text-[14.5px] text-danger">
          {formatCOP(gasto.monto)}
        </span>
      </td>

      {/* Notas */}
      <td className="max-w-[180px]">
        {gasto.notas
          ? (
            <p className="text-[12px] text-primary-muted truncate" title={gasto.notas}>
              {gasto.notas}
            </p>
          )
          : <span className="text-primary-muted text-[13px]">—</span>
        }
      </td>

      {/* Acciones */}
      <td>
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={onEditar}
            className="p-1.5 rounded-lg text-primary-muted
                       hover:text-primary hover:bg-white/5
                       transition-colors"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleEliminar}
            className="p-1.5 rounded-lg text-primary-muted
                       hover:text-danger hover:bg-danger/10
                       transition-colors"
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}