import type {
  EstadoOperativoPedidoDb,
  EstadoPagoDb,
  MetodoPagoDb,
  UserRole,
} from "@zero-delivery/shared-types";

export interface Actor {
  tenantId: string;
  userId: string;
  role: UserRole;
  branchIds: string[];
  riderId?: string;
  requestId: string;
}

export interface LoginResponse {
  ok: boolean;
  usuario: {
    id: string;
    nombre_usuario: string;
    nombre_mostrado: string;
    rol: string;
  };
  inquilino: { id: string; slug: string; nombre: string };
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono_e164: string;
  segmento?: "NUEVO" | "RECURRENTE" | "TOP";
  marca_riesgo?: "NINGUNO" | "PRECAUCION" | "BLOQUEADO";
}

export interface DireccionSnapshot {
  texto_direccion?: string;
  referencia?: string | null;
  latitud?: number | string | null;
  longitud?: number | string | null;
}

export interface Producto {
  id: string;
  nombre: string;
  es_fragil: boolean;
}

export interface ModificadorItem {
  id: string;
  nombre_snapshot: string;
  incremento_precio_centavos: string;
}

export interface ItemPedido {
  id: string;
  nombre_snapshot: string;
  cantidad: number;
  precio_unitario_centavos: string;
  total_linea_centavos: string;
  estado?: string;
  producto?: Producto;
  modificadores?: ModificadorItem[];
}

export interface Sucursal {
  id: string;
  restaurante_id?: string;
  latitud?: number | string | null;
  longitud?: number | string | null;
  nombre: string;
  slug: string;
  direccion: string;
  telefono: string | null;
  apertura_manual: boolean;
  esta_activo: boolean;
  razon_social?: string | null;
  ruc?: string | null;
  foto_url?: string | null;
  encargados?: { id: string; nombre_usuario: string; nombre_mostrado: string }[];
}

export interface Repartidor {
  id: string;
  nombre_completo: string;
  telefono: string;
  tipo_vehiculo: "MOTO" | "AUTO";
  estado: "DISPONIBLE" | "OCUPADO" | "EN_CAMINO" | "DESCONECTADO";
  alta_confianza: boolean;
  esta_activo: boolean;
}

export interface Pedido {
  id: string;
  numero: string;
  sucursal_id: string;
  sucursal?: Sucursal;
  cliente_id: string;
  cliente?: Cliente;
  direccion_snapshot: DireccionSnapshot;
  canal: "MANUAL" | "WEB" | "WHATSAPP" | "CRM";
  estado_operativo: EstadoOperativoPedidoDb;
  estado_pago: EstadoPagoDb;
  metodo_pago: MetodoPagoDb;
  estado_pago_restaurante: "PENDIENTE" | "CONFIRMADO";
  traspaso_en: string | null;
  repartidor_id: string | null;
  repartidor?: Repartidor | null;
  subtotal_items_centavos: string;
  descuento_centavos: string;
  tarifa_entrega_centavos: string;
  total_centavos: string;
  efectivo_por_cobrar_centavos: string;
  notas: string | null;
  version: number;
  items?: ItemPedido[];
  creado_en: string;
  actualizado_en: string;
}

export interface Pago {
  id: string;
  pedido_id: string;
  metodo: MetodoPagoDb;
  monto_centavos: string;
  estado: EstadoPagoDb;
  referencia: string | null;
  creado_en: string;
}

export interface PagoRestaurante {
  id: string;
  pedido_id: string;
  monto_centavos: string;
  estado: "PENDIENTE" | "CONFIRMADO";
  metodo: string | null;
  referencia: string | null;
}

export type TipoMovimiento =
  | "DEPOSITO_GARANTIA"
  | "RETIRO_GARANTIA"
  | "EFECTIVO_COBRADO"
  | "EFECTIVO_LIQUIDADO"
  | "AJUSTE";

export interface MovimientoBilletera {
  id: string;
  tipo: TipoMovimiento;
  monto_centavos: string;
  motivo: string | null;
  pedido_id: string | null;
  creado_en: string;
}

export interface WalletInfo {
  repartidor_id: string;
  saldo_centavos: string;
  saldo_soles: string;
  tiene_deuda: boolean;
  movimientos: MovimientoBilletera[];
}

export interface CategoriaCatalogo {
  id: string;
  restaurante_id: string;
  nombre: string;
  orden?: number;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  restaurante_id: string;
  categoria_id: string;
  categoria?: CategoriaCatalogo;
  es_fragil: boolean;
  precio_base_centavos: string;
  empaque_centavos: string;
  esta_activo: boolean;
  imagen_url?: string | null;
}

export interface UsuarioSistema {
  id: string;
  nombre_usuario: string;
  nombre_mostrado: string;
  rol: string;
  esta_activo: boolean;
  ultimo_acceso_en: string | null;
  creado_en: string;
  sucursales: { id: string; nombre: string }[];
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
}
