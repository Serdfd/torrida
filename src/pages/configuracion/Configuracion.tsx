import { useState } from 'react'
import {
  Settings, Store, Tag, CreditCard,
  Ruler, Package, Palette, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfigNegocio      from './ConfigNegocio'
import ConfigCanales      from './ConfigCanales'
import ConfigMediosPago   from './ConfigMediosPago'
import ConfigTallas       from './ConfigTallas'
import ConfigCategorias   from './ConfigCategorias'
import ConfigColecciones  from './ConfigColecciones'

type TabId =
  | 'negocio'
  | 'canales'
  | 'medios_pago'
  | 'tallas'
  | 'categorias'
  | 'colecciones'

interface Tab {
  id:          TabId
  label:       string
  description: string
  icon:        React.ElementType
}

const TABS: Tab[] = [
  {
    id:          'negocio',
    label:       'Mi negocio',
    description: 'Nombre, logo y datos generales',
    icon:        Store
  },
  {
    id:          'canales',
    label:       'Canales de venta',
    description: 'Instagram, TikTok, web, tienda…',
    icon:        Tag
  },
  {
    id:          'medios_pago',
    label:       'Medios de pago',
    description: 'Nequi, transferencia, efectivo…',
    icon:        CreditCard
  },
  {
    id:          'tallas',
    label:       'Tallas',
    description: 'XS, S, M, L, XL o tus propias',
    icon:        Ruler
  },
  {
    id:          'categorias',
    label:       'Categorías de gasto',
    description: 'Producción, envíos, marketing…',
    icon:        Package
  },
  {
    id:          'colecciones',
    label:       'Colecciones',
    description: 'Agrupa productos por temporada',
    icon:        Palette
  }
]

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  negocio:      ConfigNegocio,
  canales:      ConfigCanales,
  medios_pago:  ConfigMediosPago,
  tallas:       ConfigTallas,
  categorias:   ConfigCategorias,
  colecciones:  ConfigColecciones
}

export default function Configuracion() {
  const [activeTab, setActiveTab] = useState<TabId>('negocio')

  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="flex gap-5 h-full">

      {/* Sidebar de tabs */}
      <aside className="w-[220px] shrink-0 flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-widest
                      text-primary-muted px-3 mb-2">
          Configuración
        </p>
        {TABS.map(tab => {
          const Icon     = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                'text-left w-full transition-all duration-150 group',
                isActive
                  ? 'bg-accent-light border border-accent/30'
                  : 'hover:bg-white/4 border border-transparent'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                isActive ? 'bg-accent/20' : 'bg-white/5'
              )}>
                <Icon
                  size={14}
                  className={isActive ? 'text-accent' : 'text-primary-muted'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[13px] font-semibold leading-none mb-0.5',
                  isActive ? 'text-accent' : 'text-primary'
                )}>
                  {tab.label}
                </p>
                <p className="text-[11px] text-primary-muted leading-tight truncate">
                  {tab.description}
                </p>
              </div>
              <ChevronRight
                size={12}
                className={cn(
                  'shrink-0 transition-opacity',
                  isActive ? 'text-accent opacity-100' : 'opacity-0'
                )}
              />
            </button>
          )
        })}
      </aside>

      {/* Contenido del tab activo */}
      <div className="flex-1 min-w-0 card overflow-y-auto">
        <ActiveComponent />
      </div>
    </div>
  )
}