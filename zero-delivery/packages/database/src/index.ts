import { AppDataSource } from "./datasource";

export * from "./datasource";
export * from "./entities/inquilino.entity";
export * from "./entities/contador-inquilino.entity";
export * from "./entities/usuario.entity";
export * from "./entities/sesion.entity";
export * from "./entities/restaurante.entity";
export * from "./entities/sucursal.entity";
export * from "./entities/acceso-usuario-sucursal.entity";
export * from "./entities/horario-sucursal.entity";
export * from "./entities/zona-entrega.entity";
export * from "./entities/archivo.entity";
export * from "./entities/categoria.entity";
export * from "./entities/producto.entity";
export * from "./entities/grupo-modificadores.entity";
export * from "./entities/opcion-modificador.entity";
export * from "./entities/producto-grupo-modificadores.entity";
export * from "./entities/carta.entity";
export * from "./entities/item-carta.entity";
export * from "./entities/cliente.entity";
export * from "./entities/direccion-cliente.entity";
export * from "./entities/repartidor.entity";
export * from "./entities/ubicacion-repartidor.entity";
export * from "./entities/intento-entrega.entity";
export * from "./entities/pedido.entity";
export * from "./entities/detalle-pedido.entity";
export * from "./entities/modificador-detalle-pedido.entity";
export * from "./entities/historial-estados-pedido.entity";
export * from "./entities/nota-pedido.entity";
export * from "./entities/incidencia-pedido.entity";
export * from "./entities/pago.entity";
export * from "./entities/evento-pago.entity";
export * from "./entities/pago-restaurante.entity";
export * from "./entities/reembolso.entity";
export * from "./entities/liquidacion.entity";
export * from "./entities/adelanto-repartidor.entity";
export * from "./entities/movimiento-billetera.entity";
export * from "./entities/alerta.entity";
export * from "./entities/configuracion.entity";
export * from "./entities/registro-auditoria.entity";
export * from "./entities/evento-salida.entity";
export * from "./entities/evento-entrada.entity";
export * from "./entities/evento-embudo.entity";
export * from "./entities/calificacion.entity";
export * from "./entities/promocion.entity";
export * from "./entities/regla-promocion.entity";
export * from "./entities/suscripcion-push.entity";

/**
 * Función de verificación de salud de la base de datos PostgreSQL.
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    const result = await AppDataSource.query("SELECT version() as version;");
    const firstRow = (result as Array<{ version: string }>)[0];
    return { ok: true, version: firstRow?.version };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
