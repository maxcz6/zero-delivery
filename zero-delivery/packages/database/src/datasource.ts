import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";

import { InquilinoEntity } from "./entities/inquilino.entity";
import { ContadorInquilinoEntity } from "./entities/contador-inquilino.entity";
import { UsuarioEntity } from "./entities/usuario.entity";
import { SesionEntity } from "./entities/sesion.entity";
import { RestauranteEntity } from "./entities/restaurante.entity";
import { SucursalEntity } from "./entities/sucursal.entity";
import { AccesoUsuarioSucursalEntity } from "./entities/acceso-usuario-sucursal.entity";
import { HorarioSucursalEntity } from "./entities/horario-sucursal.entity";
import { ZonaEntregaEntity } from "./entities/zona-entrega.entity";
import { ArchivoEntity } from "./entities/archivo.entity";
import { CategoriaEntity } from "./entities/categoria.entity";
import { ProductoEntity } from "./entities/producto.entity";
import { GrupoModificadoresEntity } from "./entities/grupo-modificadores.entity";
import { OpcionModificadorEntity } from "./entities/opcion-modificador.entity";
import { ProductoGrupoModificadoresEntity } from "./entities/producto-grupo-modificadores.entity";
import { CartaEntity } from "./entities/carta.entity";
import { ItemCartaEntity } from "./entities/item-carta.entity";
import { ClienteEntity } from "./entities/cliente.entity";
import { DireccionClienteEntity } from "./entities/direccion-cliente.entity";
import { RepartidorEntity } from "./entities/repartidor.entity";
import { UbicacionRepartidorEntity } from "./entities/ubicacion-repartidor.entity";
import { IntentoEntregaEntity } from "./entities/intento-entrega.entity";
import { PedidoEntity } from "./entities/pedido.entity";
import { DetallePedidoEntity } from "./entities/detalle-pedido.entity";
import { ModificadorDetallePedidoEntity } from "./entities/modificador-detalle-pedido.entity";
import { HistorialEstadosPedidoEntity } from "./entities/historial-estados-pedido.entity";
import { NotaPedidoEntity } from "./entities/nota-pedido.entity";
import { IncidenciaPedidoEntity } from "./entities/incidencia-pedido.entity";
import { PagoEntity } from "./entities/pago.entity";
import { EventoPagoEntity } from "./entities/evento-pago.entity";
import { PagoRestauranteEntity } from "./entities/pago-restaurante.entity";
import { ReembolsoEntity } from "./entities/reembolso.entity";
import { LiquidacionEntity } from "./entities/liquidacion.entity";
import { AdelantoRepartidorEntity } from "./entities/adelanto-repartidor.entity";
import { MovimientoBilleteraEntity } from "./entities/movimiento-billetera.entity";
import { AlertaEntity } from "./entities/alerta.entity";
import { ConfiguracionEntity } from "./entities/configuracion.entity";
import { RegistroAuditoriaEntity } from "./entities/registro-auditoria.entity";
import { EventoSalidaEntity } from "./entities/evento-salida.entity";
import { EventoEntradaEntity } from "./entities/evento-entrada.entity";
import { EventoEmbudoEntity } from "./entities/evento-embudo.entity";
import { CalificacionEntity } from "./entities/calificacion.entity";
import { PromocionEntity } from "./entities/promocion.entity";
import { ReglaPromocionEntity } from "./entities/regla-promocion.entity";
import { SuscripcionPushEntity } from "./entities/suscripcion-push.entity";

export const allEntities = [
  InquilinoEntity,
  ContadorInquilinoEntity,
  UsuarioEntity,
  SesionEntity,
  RestauranteEntity,
  SucursalEntity,
  AccesoUsuarioSucursalEntity,
  HorarioSucursalEntity,
  ZonaEntregaEntity,
  ArchivoEntity,
  CategoriaEntity,
  ProductoEntity,
  GrupoModificadoresEntity,
  OpcionModificadorEntity,
  ProductoGrupoModificadoresEntity,
  CartaEntity,
  ItemCartaEntity,
  ClienteEntity,
  DireccionClienteEntity,
  RepartidorEntity,
  UbicacionRepartidorEntity,
  IntentoEntregaEntity,
  PedidoEntity,
  DetallePedidoEntity,
  ModificadorDetallePedidoEntity,
  HistorialEstadosPedidoEntity,
  NotaPedidoEntity,
  IncidenciaPedidoEntity,
  PagoEntity,
  EventoPagoEntity,
  PagoRestauranteEntity,
  ReembolsoEntity,
  LiquidacionEntity,
  AdelantoRepartidorEntity,
  MovimientoBilleteraEntity,
  AlertaEntity,
  ConfiguracionEntity,
  RegistroAuditoriaEntity,
  EventoSalidaEntity,
  EventoEntradaEntity,
  EventoEmbudoEntity,
  CalificacionEntity,
  PromocionEntity,
  ReglaPromocionEntity,
  SuscripcionPushEntity,
];

export function getDataSourceOptions(): DataSourceOptions {
  return {
    type: "postgres",
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5434),
    username: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "zero_delivery",
    synchronize: false, // ¡NUNCA true! El esquema SQL canónico 0001_esquema_zero_delivery_es.sql es la autoridad.
    logging: process.env.TYPEORM_LOGGING === "true",
    entities: allEntities,
    migrations: [],
    subscribers: [],
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };
}

export const AppDataSource = new DataSource(getDataSourceOptions());
