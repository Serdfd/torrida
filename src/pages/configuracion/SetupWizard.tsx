import { useState } from 'react'
import {
  Store, Wifi, WifiOff, ChevronRight, ChevronLeft,
  CheckCircle2, Sparkles, Instagram, Globe, Phone,
  Hash, FileText, Plus, Trash2
} from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface SetupWizardProps {
  onComplete: () => void
}

interface NegocioData {
  nombre_negocio:  string
  nit:             string
  instagram:       string
  facebook:        string
  tiktok:          string
  sitio_web:       string
  telefono:        string
  prefijo_factura: string
}

interface TiendaNubeData {
  storeId: string
  token:   string
}

interface Canal {
  nombre:       string
  comision_pct: number
}

interface MedioPago {
  nombre: string
}

const STEPS = [
  { id: 1, label: 'Tu negocio'   },
  { id: 2, label: 'Tienda Nube'  },
  { id: 3, label: 'Canales'      },
  { id: 4, label: '¡Listo!'      },
]

const CANALES_DEFAULT: Canal[] = [
  { nombre: 'Instagram',     comision_pct: 0   },
  { nombre: 'WhatsApp',      comision_pct: 0   },
  { nombre: 'Tienda física', comision_pct: 0   },
  { nombre: 'Tienda Nube',   comision_pct: 0   },
]

const MEDIOS_DEFAULT: MedioPago[] = [
  { nombre: 'Nequi'                   },
  { nombre: 'Daviplata'               },
  { nombre: 'Transferencia bancaria'  },
  { nombre: 'Efectivo'                },
]

// ── Componente principal ───────────────────────────────────────────────────

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const toast = useToast()

  const [step,    setStep]    = useState(1)
  const [saving,  setSaving]  = useState(false)

  // Paso 1
  const [negocio, setNegocio] = useState<NegocioData>({
    nombre_negocio:  '',
    nit:             '',
    instagram:       '',
    facebook:        '',
    tiktok:          '',
    sitio_web:       '',
    telefono:        '',
    prefijo_factura: 'V-',
  })

  // Paso 2
  const [tn,          setTn]          = useState<TiendaNubeData>({ storeId: '', token: '' })
  const [tnTestando,  setTnTestando]  = useState(false)
  const [tnConectado, setTnConectado] = useState(false)
  const [tnNombre,    setTnNombre]    = useState<string | null>(null)
  const [tnImportando, setTnImportando] = useState(false)
  const [tnImportado,  setTnImportado]  = useState(false)

  // Paso 3
  const [canales, setCanales] = useState<Canal[]>([...CANALES_DEFAULT])
  const [medios,  setMedios]  = useState<MedioPago[]>([...MEDIOS_DEFAULT])
  const [nuevoCanal, setNuevoCanal] = useState('')
  const [nuevoMedio, setNuevoMedio] = useState('')

  // ── Paso 2: probar conexión TN ───────────────────────────────────────────
  async function handleTestTN() {
    if (!tn.storeId.trim() || !tn.token.trim()) {
      toast.warning('Completá el Store ID y el token')
      return
    }
    setTnTestando(true); setTnConectado(false); setTnNombre(null)
    const res = await window.electronAPI.tn.fetch({
      storeId:  tn.storeId.trim(),
      token:    tn.token.trim(),
      endpoint: '',
    })
    setTnTestando(false)
    if (res.ok && res.data && typeof res.data === 'object') {
      const d = res.data as any
      setTnConectado(true)
      setTnNombre(d.name?.es ?? d.name ?? 'Tienda conectada')
      toast.success('Conexión exitosa')
    } else {
      toast.error(`Error (${res.status}). Verificá el Store ID y el token.`)
    }
  }

  // ── Paso 2: importar productos desde TN ─────────────────────────────────
  async function handleImportarTN() {
    setTnImportando(true)
    try {
      // Traer todos los productos paginado
      const results: any[] = []
      let page = 1
      while (true) {
        const res = await window.electronAPI.tn.fetch({
          storeId:  tn.storeId.trim(),
          token:    tn.token.trim(),
          endpoint: `products?page=${page}&per_page=50`,
        })
        if (!res.ok || !Array.isArray(res.data) || (res.data as any[]).length === 0) break
        results.push(...(res.data as any[]))
        if ((res.data as any[]).length < 50) break
        page++
      }

      for (const tp of results) {
        const nombre = (tp.name?.es ?? tp.name ?? String(tp.id)).trim()
        const precio = parseFloat(tp.variants?.[0]?.price ?? tp.price ?? '0')
        const tnId   = String(tp.id)

        const existing = await window.electronAPI.db.query<{ id: number }>(
          `SELECT id FROM productos WHERE tn_product_id = ?`, [tnId]
        )
        let productoId: number
        if (existing.length > 0) {
          productoId = existing[0].id
          await window.electronAPI.db.run(
            `UPDATE productos SET nombre=?, precio_venta=?, updated_at=datetime('now') WHERE id=?`,
            [nombre, precio, productoId]
          )
        } else {
          const r = await window.electronAPI.db.run(
            `INSERT INTO productos (nombre, precio_venta, tn_product_id, activo, created_at, updated_at)
             VALUES (?,?,?,1,datetime('now'),datetime('now'))`,
            [nombre, precio, tnId]
          )
          productoId = r.lastInsertRowid as number
        }

        for (const v of tp.variants ?? []) {
          const varId      = String(v.id)
          const tallaNombre = (v.values?.[0]?.es ?? v.values?.[0] ?? 'Única').trim()
          const stockTotal  = v.stock?.total ?? 0

          let [tallaRow] = await window.electronAPI.db.query<{ id: number }>(
            `SELECT id FROM tallas WHERE nombre = ?`, [tallaNombre]
          )
          let tallaId: number
          if (tallaRow) {
            tallaId = tallaRow.id
          } else {
            const tr = await window.electronAPI.db.run(
              `INSERT OR IGNORE INTO tallas (nombre, orden, activo) VALUES (?,99,1)`,
              [tallaNombre]
            )
            tallaId = tr.lastInsertRowid as number ||
              (await window.electronAPI.db.query<{ id: number }>(
                `SELECT id FROM tallas WHERE nombre = ?`, [tallaNombre]
              ))[0].id
          }

          await window.electronAPI.db.run(
            `INSERT INTO producto_tallas (producto_id, talla_id, activa, tn_variant_id)
             VALUES (?,?,1,?)
             ON CONFLICT(producto_id, talla_id)
             DO UPDATE SET tn_variant_id=excluded.tn_variant_id, activa=1`,
            [productoId, tallaId, varId]
          )
          await window.electronAPI.db.run(
            `INSERT INTO inventario_productos (producto_id, talla_id, stock, updated_at)
             VALUES (?,?,?,datetime('now'))
             ON CONFLICT(producto_id, talla_id)
             DO UPDATE SET stock=excluded.stock, updated_at=datetime('now')`,
            [productoId, tallaId, stockTotal]
          )
        }
      }

      setTnImportado(true)
      toast.success(`${results.length} productos importados desde Tienda Nube`)
    } catch (err) {
      console.error(err)
      toast.error('Error al importar productos')
    } finally {
      setTnImportando(false)
    }
  }

  // ── Guardar todo y completar ─────────────────────────────────────────────
  async function handleFinalizar() {
    setSaving(true)
    try {
      // Paso 1: datos del negocio
      const campos: [string, string][] = [
        ['nombre_negocio',  negocio.nombre_negocio],
        ['nit',             negocio.nit],
        ['instagram',       negocio.instagram],
        ['facebook',        negocio.facebook],
        ['tiktok',          negocio.tiktok],
        ['sitio_web',       negocio.sitio_web],
        ['telefono',        negocio.telefono],
        ['prefijo_factura', negocio.prefijo_factura || 'V-'],
      ]
      for (const [clave, valor] of campos) {
        await window.electronAPI.db.run(
          `UPDATE configuracion_app SET valor=?, updated_at=datetime('now') WHERE clave=?`,
          [valor, clave]
        )
      }

      // Paso 2: guardar credenciales TN si se configuró
      if (tn.storeId.trim() && tn.token.trim()) {
        await window.electronAPI.db.run(
          `UPDATE configuracion_app SET valor=?, updated_at=datetime('now') WHERE clave='tn_store_id'`,
          [tn.storeId.trim()]
        )
        await window.electronAPI.db.run(
          `UPDATE configuracion_app SET valor=?, updated_at=datetime('now') WHERE clave='tn_access_token'`,
          [tn.token.trim()]
        )
      }

      // Paso 3: canales (limpiar defaults y reinsertar)
      await window.electronAPI.db.run(`DELETE FROM canales_venta`)
      for (const c of canales) {
        if (!c.nombre.trim()) continue
        await window.electronAPI.db.run(
          `INSERT INTO canales_venta (nombre, comision_pct, activo, created_at, updated_at)
           VALUES (?,?,1,datetime('now'),datetime('now'))`,
          [c.nombre.trim(), c.comision_pct ?? 0]
        )
      }

      // Paso 3: medios de pago (limpiar defaults y reinsertar)
      await window.electronAPI.db.run(`DELETE FROM medios_pago`)
      for (const m of medios) {
        if (!m.nombre.trim()) continue
        await window.electronAPI.db.run(
          `INSERT INTO medios_pago (nombre, activo, created_at, updated_at)
           VALUES (?,1,datetime('now'),datetime('now'))`,
          [m.nombre.trim()]
        )
      }

      // Marcar setup como completado
      await window.electronAPI.db.run(
        `INSERT OR REPLACE INTO configuracion_app (clave, valor, updated_at)
         VALUES ('setup_completado', '1', datetime('now'))`
      )

      onComplete()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo / marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                          bg-accent-light border border-accent/20 mb-4">
            <Store size={18} className="text-accent" />
            <span className="text-[15px] font-bold text-accent tracking-wide uppercase">
              Torrida
            </span>
          </div>
          <h1 className="text-[24px] font-bold text-primary">
            Configuración inicial
          </h1>
          <p className="text-[13.5px] text-primary-muted mt-1">
            Configuremos tu app en 4 pasos rápidos
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'text-[13px] font-bold border-2 transition-all',
                  step > s.id
                    ? 'bg-success border-success text-white'
                    : step === s.id
                      ? 'bg-accent border-accent text-white'
                      : 'bg-card border-border text-primary-muted'
                )}>
                  {step > s.id ? <CheckCircle2 size={16} /> : s.id}
                </div>
                <span className={cn(
                  'text-[11px] font-semibold whitespace-nowrap',
                  step === s.id ? 'text-accent' : 'text-primary-muted'
                )}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'w-16 h-0.5 mx-1 mb-5 transition-all',
                  step > s.id ? 'bg-success' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Card del paso activo */}
        <div className="card">

          {/* ── Paso 1: Datos del negocio ─────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Store size={16} className="text-accent" />
                <h2 className="text-[16px] font-bold text-primary">Tu negocio</h2>
              </div>

              <div>
                <label className="input-label">Nombre del negocio *</label>
                <input
                  type="text" placeholder="Ej: Torrida Brand"
                  className="input"
                  value={negocio.nombre_negocio}
                  onChange={e => setNegocio(p => ({ ...p, nombre_negocio: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">NIT / CC</label>
                  <input
                    type="text" placeholder="900123456-1"
                    className="input"
                    value={negocio.nit}
                    onChange={e => setNegocio(p => ({ ...p, nit: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="input-label">Teléfono / WhatsApp</label>
                  <input
                    type="text" placeholder="+57 300 123 4567"
                    className="input"
                    value={negocio.telefono}
                    onChange={e => setNegocio(p => ({ ...p, telefono: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Sitio web</label>
                <input
                  type="url" placeholder="https://torrida.co"
                  className="input"
                  value={negocio.sitio_web}
                  onChange={e => setNegocio(p => ({ ...p, sitio_web: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="input-label">Instagram</label>
                  <input
                    type="text" placeholder="@torrida_brand"
                    className="input"
                    value={negocio.instagram}
                    onChange={e => setNegocio(p => ({ ...p, instagram: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="input-label">Facebook</label>
                  <input
                    type="text" placeholder="/torrida.brand"
                    className="input"
                    value={negocio.facebook}
                    onChange={e => setNegocio(p => ({ ...p, facebook: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="input-label">TikTok</label>
                  <input
                    type="text" placeholder="@torrida"
                    className="input"
                    value={negocio.tiktok}
                    onChange={e => setNegocio(p => ({ ...p, tiktok: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Prefijo de facturas</label>
                <input
                  type="text" placeholder="V-"
                  className="input"
                  value={negocio.prefijo_factura}
                  onChange={e => setNegocio(p => ({ ...p, prefijo_factura: e.target.value }))}
                />
                <p className="text-[11px] text-primary-muted mt-0.5">
                  Ej: V- genera V-202506-0001
                </p>
              </div>
            </div>
          )}

          {/* ── Paso 2: Tienda Nube ───────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={16} className="text-accent" />
                <h2 className="text-[16px] font-bold text-primary">Tienda Nube</h2>
                <span className="ml-auto text-[11.5px] text-primary-muted bg-card
                                 border border-border px-2 py-0.5 rounded-lg">
                  Opcional
                </span>
              </div>
              <p className="text-[12.5px] text-primary-muted -mt-2">
                Si tenés tienda online en Tienda Nube, conectala para importar
                productos y sincronizar stock. Podés saltear este paso.
              </p>

              <div>
                <label className="input-label">Store ID</label>
                <input
                  type="text" placeholder="Ej: 123456"
                  className="input font-mono text-[13px]"
                  value={tn.storeId}
                  onChange={e => { setTn(p => ({ ...p, storeId: e.target.value })); setTnConectado(false) }}
                />
              </div>
              <div>
                <label className="input-label">Access Token</label>
                <input
                  type="password" placeholder="Pegá el token de tu app"
                  className="input font-mono text-[13px]"
                  value={tn.token}
                  onChange={e => { setTn(p => ({ ...p, token: e.target.value })); setTnConectado(false) }}
                />
              </div>

              {/* Botón probar */}
              {!tnConectado && (
                <button
                  onClick={handleTestTN}
                  disabled={tnTestando || !tn.storeId.trim() || !tn.token.trim()}
                  className="btn-ghost self-start"
                >
                  {tnTestando ? <Spinner size="sm" /> : <Wifi size={13} />}
                  Probar conexión
                </button>
              )}

              {/* Conectado */}
              {tnConectado && (
                <div className="flex flex-col gap-3 p-4 rounded-xl
                                bg-success/5 border border-success/20">
                  <div className="flex items-center gap-2">
                    <Wifi size={14} className="text-success" />
                    <span className="text-[13px] font-semibold text-success">
                      Conectado: {tnNombre}
                    </span>
                  </div>
                  {!tnImportado ? (
                    <button
                      onClick={handleImportarTN}
                      disabled={tnImportando}
                      className="btn-primary self-start"
                    >
                      {tnImportando
                        ? <><Spinner size="sm" /> Importando…</>
                        : '↓ Importar productos y stock'
                      }
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-[13px] text-success font-semibold">
                      <CheckCircle2 size={14} />
                      Productos importados correctamente
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Paso 3: Canales y medios de pago ─────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 mb-1">
                <Hash size={16} className="text-accent" />
                <h2 className="text-[16px] font-bold text-primary">Canales y medios de pago</h2>
              </div>
              <p className="text-[12.5px] text-primary-muted -mt-3">
                Editá los defaults o agregá los tuyos. Todo es editable después.
              </p>

              {/* Canales */}
              <div>
                <p className="text-[12px] font-bold text-primary-muted uppercase
                               tracking-wider mb-2">Canales de venta</p>
                <div className="flex flex-col gap-2">
                  {canales.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c.nombre}
                        onChange={e => setCanales(prev => prev.map((x, j) =>
                          j === i ? { ...x, nombre: e.target.value } : x
                        ))}
                        className="input h-8 text-[13px] flex-1"
                        placeholder="Nombre del canal"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number" min={0} max={100} step={0.5}
                          value={c.comision_pct}
                          onChange={e => setCanales(prev => prev.map((x, j) =>
                            j === i ? { ...x, comision_pct: Number(e.target.value) } : x
                          ))}
                          className="input h-8 text-[13px] w-[72px]"
                          title="Comisión %"
                        />
                        <span className="text-[12px] text-primary-muted">%</span>
                      </div>
                      <button
                        onClick={() => setCanales(prev => prev.filter((_, j) => j !== i))}
                        disabled={canales.length <= 1}
                        className="p-1.5 text-danger hover:bg-danger/10 rounded-lg
                                   transition-colors disabled:opacity-20"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={nuevoCanal}
                      onChange={e => setNuevoCanal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && nuevoCanal.trim()) {
                          setCanales(p => [...p, { nombre: nuevoCanal.trim(), comision_pct: 0 }])
                          setNuevoCanal('')
                        }
                      }}
                      className="input h-8 text-[13px] flex-1"
                      placeholder="Agregar canal…"
                    />
                    <button
                      onClick={() => {
                        if (!nuevoCanal.trim()) return
                        setCanales(p => [...p, { nombre: nuevoCanal.trim(), comision_pct: 0 }])
                        setNuevoCanal('')
                      }}
                      className="btn-ghost px-2 shrink-0"
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Medios de pago */}
              <div>
                <p className="text-[12px] font-bold text-primary-muted uppercase
                               tracking-wider mb-2">Medios de pago</p>
                <div className="flex flex-col gap-2">
                  {medios.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={m.nombre}
                        onChange={e => setMedios(prev => prev.map((x, j) =>
                          j === i ? { nombre: e.target.value } : x
                        ))}
                        className="input h-8 text-[13px] flex-1"
                        placeholder="Nombre del medio de pago"
                      />
                      <button
                        onClick={() => setMedios(prev => prev.filter((_, j) => j !== i))}
                        disabled={medios.length <= 1}
                        className="p-1.5 text-danger hover:bg-danger/10 rounded-lg
                                   transition-colors disabled:opacity-20"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={nuevoMedio}
                      onChange={e => setNuevoMedio(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && nuevoMedio.trim()) {
                          setMedios(p => [...p, { nombre: nuevoMedio.trim() }])
                          setNuevoMedio('')
                        }
                      }}
                      className="input h-8 text-[13px] flex-1"
                      placeholder="Agregar medio de pago…"
                    />
                    <button
                      onClick={() => {
                        if (!nuevoMedio.trim()) return
                        setMedios(p => [...p, { nombre: nuevoMedio.trim() }])
                        setNuevoMedio('')
                      }}
                      className="btn-ghost px-2 shrink-0"
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 4: Listo ─────────────────────────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center
                              justify-center">
                <Sparkles size={32} className="text-success" />
              </div>
              <h2 className="text-[20px] font-bold text-primary">
                ¡Todo listo!
              </h2>
              <p className="text-[13.5px] text-primary-muted max-w-sm leading-relaxed">
                Tu app está configurada. Podés empezar a registrar ventas,
                productos e inventario. Todo lo configurado se puede editar
                en cualquier momento desde los módulos correspondientes.
              </p>

              {/* Resumen */}
              <div className="w-full bg-[#0B0B16] border border-border rounded-xl
                              p-4 flex flex-col gap-2 text-left">
                <ResumenItem
                  label="Negocio"
                  value={negocio.nombre_negocio || '(sin nombre)'}
                />
                <ResumenItem
                  label="Tienda Nube"
                  value={tnConectado
                    ? `Conectado — ${tnNombre}${tnImportado ? ' · productos importados' : ''}`
                    : 'No configurado'}
                />
                <ResumenItem
                  label="Canales"
                  value={`${canales.filter(c => c.nombre.trim()).length} configurados`}
                />
                <ResumenItem
                  label="Medios de pago"
                  value={`${medios.filter(m => m.nombre.trim()).length} configurados`}
                />
              </div>
            </div>
          )}

          {/* ── Navegación ───────────────────────────────────────────── */}
          <div className={cn(
            'flex mt-6',
            step > 1 ? 'justify-between' : 'justify-end'
          )}>
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={saving}
                className="btn-ghost"
              >
                <ChevronLeft size={15} /> Atrás
              </button>
            )}

            {step < 4 && (
              <button
                onClick={() => {
                  if (step === 1 && !negocio.nombre_negocio.trim()) {
                    toast.warning('Ingresá el nombre del negocio para continuar')
                    return
                  }
                  setStep(s => s + 1)
                }}
                className="btn-primary"
              >
                {step === 2 && !tnConectado && !tn.storeId
                  ? 'Saltear este paso'
                  : 'Continuar'
                }
                <ChevronRight size={15} />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handleFinalizar}
                disabled={saving}
                className="btn-primary"
              >
                {saving
                  ? <><Spinner size="sm" /> Guardando…</>
                  : <><Sparkles size={14} /> Ir al dashboard</>
                }
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Sub-componente ─────────────────────────────────────────────────────────

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-primary-muted">{label}</span>
      <span className="font-semibold text-primary text-right max-w-[220px] truncate">
        {value}
      </span>
    </div>
  )
}
