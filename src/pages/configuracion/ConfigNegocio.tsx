import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Store, Save, ImagePlus } from 'lucide-react'
import { useToast } from '@/store/useAppStore'
import Spinner from '@/components/ui/Spinner'

interface NegocioFormData {
  nombre_negocio:   string
  nit:              string
  direccion:        string
  telefono:         string
  email:            string
  instagram:        string
  logo_url:         string
  moneda:           string
  prefijo_factura:  string
}

const CAMPOS: {
  key:         keyof NegocioFormData
  label:       string
  placeholder: string
  type?:       string
}[] = [
  {
    key:         'nombre_negocio',
    label:       'Nombre del negocio',
    placeholder: 'Ej: Torrida Brand'
  },
  {
    key:         'nit',
    label:       'NIT / CC',
    placeholder: 'Ej: 900123456-1'
  },
  {
    key:         'direccion',
    label:       'Dirección',
    placeholder: 'Ej: Cra 45 #12-34, Medellín'
  },
  {
    key:         'telefono',
    label:       'Teléfono / WhatsApp',
    placeholder: 'Ej: +57 300 123 4567'
  },
  {
    key:         'email',
    label:       'Correo electrónico',
    placeholder: 'Ej: hola@torrida.co',
    type:        'email'
  },
  {
    key:         'instagram',
    label:       'Instagram',
    placeholder: '@torrida_brand'
  },
  {
    key:         'prefijo_factura',
    label:       'Prefijo de facturas',
    placeholder: 'Ej: V-  (genera V-202501-0001)'
  }
]

export default function ConfigNegocio() {
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [preview, setPreview] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty }
  } = useForm<NegocioFormData>({
    defaultValues: {
      nombre_negocio:  '',
      nit:             '',
      direccion:       '',
      telefono:        '',
      email:           '',
      instagram:       '',
      logo_url:        '',
      moneda:          'COP',
      prefijo_factura: 'V-'
    }
  })

  const watchLogoUrl = watch('logo_url')

  useEffect(() => {
    async function loadConfig() {
      try {
        const rows = await window.electronAPI.db.query<{
          clave: string; valor: string
        }>(`SELECT clave, valor FROM configuracion_app`)

        const map: Record<string, string> = {}
        rows.forEach(r => { map[r.clave] = r.valor })

        reset({
          nombre_negocio:  map['nombre_negocio']  ?? '',
          nit:             map['nit']              ?? '',
          direccion:       map['direccion']        ?? '',
          telefono:        map['telefono']         ?? '',
          email:           map['email']            ?? '',
          instagram:       map['instagram']        ?? '',
          logo_url:        map['logo_url']         ?? '',
          moneda:          map['moneda']           ?? 'COP',
          prefijo_factura: map['prefijo_factura']  ?? 'V-'
        })
        setPreview(map['logo_url'] ?? '')
      } catch {
        toast.error('Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    setPreview(watchLogoUrl)
  }, [watchLogoUrl])

  async function onSubmit(data: NegocioFormData) {
    setSaving(true)
    try {
      for (const [clave, valor] of Object.entries(data)) {
        await window.electronAPI.db.run(
          `INSERT INTO configuracion_app (clave, valor, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(clave)
           DO UPDATE SET valor = ?, updated_at = datetime('now')`,
          [clave, valor ?? '', valor ?? '']
        )
      }
      toast.success('Configuración guardada')
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Título sección */}
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Store size={16} className="text-accent" />
        <h3 className="text-[15px] font-bold text-primary">
          Datos del negocio
        </h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Logo */}
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="w-20 h-20 rounded-xl border border-border bg-[#0B0B16]
                          flex items-center justify-center shrink-0 overflow-hidden">
            {preview ? (
              <img
                src={preview}
                alt="Logo"
                className="w-full h-full object-contain p-1"
                onError={() => setPreview('')}
              />
            ) : (
              <ImagePlus size={24} className="text-primary-muted" strokeWidth={1.5} />
            )}
          </div>

          {/* URL */}
          <div className="flex-1">
            <label className="input-label">URL del logo</label>
            <input
              type="url"
              placeholder="https://…"
              className="input"
              {...register('logo_url')}
            />
            <p className="text-[11.5px] text-primary-muted mt-1">
              Usa un enlace público (Google Drive, Imgur, etc.)
            </p>
          </div>
        </div>

        {/* Campos de texto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CAMPOS.map(campo => (
            <div key={campo.key}>
              <label className="input-label">{campo.label}</label>
              <input
                type={campo.type ?? 'text'}
                placeholder={campo.placeholder}
                className="input"
                {...register(campo.key)}
              />
            </div>
          ))}
        </div>

        {/* Moneda */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Moneda</label>
            <select className="input" {...register('moneda')}>
              <option value="COP">COP — Peso colombiano</option>
              <option value="USD">USD — Dólar americano</option>
              <option value="EUR">EUR — Euro</option>
              <option value="MXN">MXN — Peso mexicano</option>
              <option value="ARS">ARS — Peso argentino</option>
            </select>
          </div>
        </div>

        {/* Botón guardar */}
        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !isDirty}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Guardando…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={14} />
                Guardar cambios
              </span>
            )}
          </button>
        </div>

      </form>
    </div>
  )
}