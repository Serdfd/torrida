import { useState, useEffect } from 'react'
import { Store, Wifi, WifiOff, RefreshCw, ShoppingCart, Package, Boxes } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

const LS_KEY = 'tn_token'

type SyncBtn = 'ordenes' | 'productos' | 'stock' | null

export default function TiendaNube() {
  const toast = useToast()

  const [token,     setToken]     = useState('')
  const [savedToken, setSavedToken] = useState('')
  const [syncing,   setSyncing]   = useState<SyncBtn>(null)
  const [editando,  setEditando]  = useState(false)

  // Cargar token guardado
  useEffect(() => {
    const t = localStorage.getItem(LS_KEY) ?? ''
    setSavedToken(t)
    setToken(t)
  }, [])

  const conectado = savedToken.trim().length > 0

  function handleGuardarToken() {
    const trimmed = token.trim()
    if (!trimmed) {
      toast.warning('Ingresa un token válido')
      return
    }
    localStorage.setItem(LS_KEY, trimmed)
    setSavedToken(trimmed)
    setEditando(false)
    toast.success('Token guardado correctamente')
  }

  function handleDesconectar() {
    localStorage.removeItem(LS_KEY)
    setSavedToken('')
    setToken('')
    toast.info('Conexión removida')
  }

  async function handleSync(tipo: Exclude<SyncBtn, null>) {
    if (!conectado) {
      toast.warning('Primero configura tu token de API')
      return
    }
    setSyncing(tipo)
    await new Promise(r => setTimeout(r, 1200))
    setSyncing(null)
    toast.info('Integración con Tienda Nube próximamente')
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center
                        justify-center text-accent shrink-0">
          <Store size={20} />
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-primary">
            Tienda Nube
          </h2>
          <p className="text-[12.5px] text-primary-muted">
            Integración con tu tienda online
          </p>
        </div>
        {/* Badge de estado */}
        <div className={cn(
          'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
          'text-[12px] font-semibold border',
          conectado
            ? 'bg-success/10 border-success/20 text-success'
            : 'bg-danger/10 border-danger/20 text-danger'
        )}>
          {conectado
            ? <><Wifi size={13} /> Conectado</>
            : <><WifiOff size={13} /> Sin conexión</>
          }
        </div>
      </div>

      {/* Card de conexión */}
      <div className="card flex flex-col gap-4">
        <div>
          <p className="text-[13.5px] font-bold text-primary mb-0.5">
            Token de API
          </p>
          <p className="text-[12.5px] text-primary-muted">
            Encontrás tu token en Tienda Nube → Mi cuenta → Aplicaciones → API.
          </p>
        </div>

        {conectado && !editando ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5
                            rounded-xl border border-success/20 bg-success/5">
              <Wifi size={14} className="text-success shrink-0" />
              <span className="text-[13px] text-primary font-mono">
                {'•'.repeat(12)}{savedToken.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => setEditando(true)}
              className="btn-ghost text-[13px]"
            >
              Cambiar
            </button>
            <button
              onClick={handleDesconectar}
              className="btn-ghost text-[13px] text-danger hover:text-danger"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="password"
              placeholder="Pegar token de API…"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="input flex-1 font-mono text-[13px]"
              onKeyDown={e => e.key === 'Enter' && handleGuardarToken()}
            />
            <button
              onClick={handleGuardarToken}
              className="btn-primary text-[13px]"
            >
              Guardar
            </button>
            {editando && (
              <button
                onClick={() => { setEditando(false); setToken(savedToken) }}
                className="btn-ghost text-[13px]"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sincronización manual */}
      <div className="card flex flex-col gap-4">
        <div>
          <p className="text-[13.5px] font-bold text-primary mb-0.5">
            Sincronización manual
          </p>
          <p className="text-[12.5px] text-primary-muted">
            Importa datos desde tu tienda hacia esta aplicación.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Sincronizar órdenes */}
          <button
            onClick={() => handleSync('ordenes')}
            disabled={syncing !== null}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border',
              'transition-all cursor-pointer',
              conectado
                ? 'border-border hover:border-accent/40 hover:bg-accent-light'
                : 'border-border opacity-50 cursor-not-allowed',
              syncing === 'ordenes' && 'border-accent bg-accent-light'
            )}
          >
            {syncing === 'ordenes'
              ? <Spinner size="sm" />
              : <ShoppingCart size={22} className="text-accent" />
            }
            <span className="text-[13px] font-semibold text-primary">
              Sincronizar órdenes
            </span>
            <span className="text-[11.5px] text-primary-muted text-center leading-tight">
              Importa pedidos nuevos
            </span>
          </button>

          {/* Sincronizar productos */}
          <button
            onClick={() => handleSync('productos')}
            disabled={syncing !== null}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border',
              'transition-all cursor-pointer',
              conectado
                ? 'border-border hover:border-accent/40 hover:bg-accent-light'
                : 'border-border opacity-50 cursor-not-allowed',
              syncing === 'productos' && 'border-accent bg-accent-light'
            )}
          >
            {syncing === 'productos'
              ? <Spinner size="sm" />
              : <Package size={22} className="text-accent" />
            }
            <span className="text-[13px] font-semibold text-primary">
              Sincronizar productos
            </span>
            <span className="text-[11.5px] text-primary-muted text-center leading-tight">
              Actualiza catálogo
            </span>
          </button>

          {/* Sincronizar stock */}
          <button
            onClick={() => handleSync('stock')}
            disabled={syncing !== null}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-xl border',
              'transition-all cursor-pointer',
              conectado
                ? 'border-border hover:border-accent/40 hover:bg-accent-light'
                : 'border-border opacity-50 cursor-not-allowed',
              syncing === 'stock' && 'border-accent bg-accent-light'
            )}
          >
            {syncing === 'stock'
              ? <Spinner size="sm" />
              : <Boxes size={22} className="text-accent" />
            }
            <span className="text-[13px] font-semibold text-primary">
              Sincronizar stock
            </span>
            <span className="text-[11.5px] text-primary-muted text-center leading-tight">
              Envía stock actual
            </span>
          </button>

        </div>

        {!conectado && (
          <p className="text-[12px] text-warning text-center">
            Configura tu token de API para habilitar la sincronización.
          </p>
        )}
      </div>

      {/* Últimas órdenes */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-[13.5px] font-bold text-primary">
            Últimas órdenes sincronizadas
          </h3>
          <button
            onClick={() => handleSync('ordenes')}
            disabled={syncing !== null || !conectado}
            className="btn-ghost h-8 text-[12px]"
          >
            {syncing === 'ordenes'
              ? <Spinner size="sm" />
              : <RefreshCw size={13} />
            }
            Actualizar
          </button>
        </div>
        <div className="py-4">
          <EmptyState
            icon={ShoppingCart}
            title="Sin órdenes sincronizadas"
            description={
              conectado
                ? 'Haz clic en "Sincronizar órdenes" para importar pedidos.'
                : 'Configura tu token de API para comenzar.'
            }
          />
        </div>
      </div>

    </div>
  )
}