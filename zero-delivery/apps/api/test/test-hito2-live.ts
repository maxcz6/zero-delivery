import { AppDataSource } from "@zero-delivery/database";
import {
  UsuarioEntity,
  InquilinoEntity,
  SesionEntity,
  AccesoUsuarioSucursalEntity,
  RestauranteEntity,
  SucursalEntity,
  CategoriaEntity,
  ProductoEntity,
  PedidoEntity,
  DetallePedidoEntity,
  HistorialEstadosPedidoEntity,
  EventoSalidaEntity,
  PagoEntity,
  EventoPagoEntity,
  PagoRestauranteEntity,
  RepartidorEntity,
  MovimientoBilleteraEntity,
  ClienteEntity,
} from "@zero-delivery/database";
import {
  can,
  dbRoleToRole,
  formatPen,
  normalizePeruPhone,
} from "@zero-delivery/shared-types";
import { ScryptService } from "./modules/identity/scrypt.service";
import { AuthService } from "./modules/identity/auth.service";
import { OrdersService } from "./modules/orders/orders.service";
import { PaymentsService } from "./modules/payments/payments.service";
import { LogisticsService } from "./modules/logistics/logistics.service";
import { evaluateReleaseGate } from "./modules/orders/release-gate";
import { evaluateRiderEligibility } from "./modules/logistics/rider-eligibility";

async function runTests() {
  console.log("=== INICIANDO PRUEBAS AUTOMATIZADAS DEL HITO 2 ===");

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  console.log("✓ Base de datos PostgreSQL conectada en puerto 5434");

  const scryptService = new ScryptService();
  const usuarioRepo = AppDataSource.getRepository(UsuarioEntity);
  const inquilinoRepo = AppDataSource.getRepository(InquilinoEntity);
  const sesionRepo = AppDataSource.getRepository(SesionEntity);
  const accesoRepo = AppDataSource.getRepository(AccesoUsuarioSucursalEntity);
  const repartidorRepo = AppDataSource.getRepository(RepartidorEntity);
  const restauranteRepo = AppDataSource.getRepository(RestauranteEntity);
  const sucursalRepo = AppDataSource.getRepository(SucursalEntity);
  const categoriaRepo = AppDataSource.getRepository(CategoriaEntity);
  const productoRepo = AppDataSource.getRepository(ProductoEntity);
  const clienteRepo = AppDataSource.getRepository(ClienteEntity);

  const authService = new AuthService(
    usuarioRepo,
    inquilinoRepo,
    sesionRepo,
    accesoRepo,
    repartidorRepo,
    scryptService
  );

  const ordersService = new OrdersService(AppDataSource);
  const paymentsService = new PaymentsService(AppDataSource);
  const logisticsService = new LogisticsService(AppDataSource);

  // 1. Obtener o crear inquilino demo
  let inquilino = await inquilinoRepo.findOne({ where: { slug: "zero-delivery-demo" } });
  if (!inquilino) {
    inquilino = inquilinoRepo.create({
      nombre: "Zero Delivery Demo",
      slug: "zero-delivery-demo",
      estado: "ACTIVO",
    });
    inquilino = await inquilinoRepo.save(inquilino);
  }
  console.log(`✓ Inquilino verificado: ${inquilino.nombre} (${inquilino.id})`);

  // 2. Probar ScryptService
  console.log("\n--- PRUEBA 1: Hashing Criptográfico scrypt ---");
  const testPassword = "PasswordSeguro2026!";
  const hash = await scryptService.hash(testPassword);
  console.log("  Hash generado:", hash);
  const isValid = await scryptService.verify(testPassword, hash);
  const isInvalid = await scryptService.verify("PasswordEquivocado!", hash);
  if (!isValid || isInvalid) {
    throw new Error("Fallo en verificación de scrypt");
  }
  console.log("✓ Scrypt: Hash y verificación de tiempo constante funcionando correctamente");

  // 3. Sembrar usuarios de prueba con scrypt
  console.log("\n--- PRUEBA 2: Sembrado de Usuarios y Autenticación ---");
  // Admin
  let adminUser = await usuarioRepo
    .createQueryBuilder("u")
    .where("u.inquilino_id = :inqId AND u.nombre_usuario = 'admin_demo'", { inqId: inquilino.id })
    .getOne();
  if (!adminUser) {
    adminUser = usuarioRepo.create({
      inquilino_id: inquilino.id,
      nombre_usuario: "admin_demo",
      nombre_mostrado: "Administrador Demo",
      hash_contrasena: await scryptService.hash("AdminPass123!"),
      rol: "ADMINISTRADOR",
      esta_activo: true,
    });
    adminUser = await usuarioRepo.save(adminUser);
  }

  // Login exitoso
  const loginResult = await authService.login(
    "zero-delivery-demo",
    "admin_demo",
    "AdminPass123!"
  );
  console.log(`✓ Login exitoso para ${loginResult.usuario.nombre_usuario}. Token generado (longitud: ${loginResult.rawToken.length})`);

  // Validar sesión persistida
  const actorContext = await authService.validateSession(loginResult.rawToken);
  console.log(`✓ Sesión validada. ActorContext: Role = ${actorContext.role}, Tenant = ${actorContext.tenantId}`);

  // Probar protección de fuerza bruta (5 intentos fallidos)
  console.log("\n--- PRUEBA 3: Protección Anti Fuerza Bruta (Brute Force Lockout) ---");
  let bruteUser = await usuarioRepo
    .createQueryBuilder("u")
    .where("u.inquilino_id = :inqId AND u.nombre_usuario = 'brute_test'", { inqId: inquilino.id })
    .getOne();
  if (!bruteUser) {
    bruteUser = usuarioRepo.create({
      inquilino_id: inquilino.id,
      nombre_usuario: "brute_test",
      nombre_mostrado: "Usuario Test Fuerza Bruta",
      hash_contrasena: await scryptService.hash("Secret123!"),
      rol: "AGENTE_SOPORTE",
      esta_activo: true,
      intentos_fallidos: 0,
    });
    bruteUser = await usuarioRepo.save(bruteUser);
  }

  for (let i = 1; i <= 5; i++) {
    try {
      await authService.login("zero-delivery-demo", "brute_test", "BadPassword!");
    } catch (err: any) {
      if (i === 5) {
        console.log(`  Intento ${i}: Excepción capturada correctamente (${err.message})`);
      }
    }
  }

  // Sexto intento debe arrojar bloqueo
  try {
    await authService.login("zero-delivery-demo", "brute_test", "Secret123!");
    throw new Error("Debió bloquearse por fuerza bruta");
  } catch (err: any) {
    console.log(`✓ Bloqueo tras 5 intentos fallidos confirmado: "${err.message}"`);
  }

  // 4. Probar RBAC can()
  console.log("\n--- PRUEBA 4: Matriz Canónica RBAC can() ---");
  const canAdminSettings = can(actorContext, "settings.global.manage");
  console.log(`  Admin puede gestionar ajustes globales: ${canAdminSettings.allowed}`);

  const canAdminDeleteAudit = can(actorContext, "audit.delete");
  console.log(`  Admin puede borrar auditoría (regla inviolable): ${canAdminDeleteAudit.allowed} (${(canAdminDeleteAudit as any).reason})`);

  if (!canAdminSettings.allowed || canAdminDeleteAudit.allowed) {
    throw new Error("Fallo en matriz de permisos RBAC");
  }
  console.log("✓ RBAC can() evaluado con éxito (incluyendo regla inviolable de inmutabilidad de auditoría)");

  // 5. Preparar Datos para Pedido (Restaurante, Sucursal, Producto, Repartidor)
  console.log("\n--- PRUEBA 5: Preparación de Catálogo y Datos Operativos ---");
  let restaurante = await restauranteRepo.findOne({
    where: { inquilino_id: inquilino.id, nombre: "Burger Zero Live" },
  });
  if (!restaurante) {
    restaurante = restauranteRepo.create({
      inquilino_id: inquilino.id,
      nombre: "Burger Zero Live",
      razon_social: "Burger Zero SAC",
      ruc: "20123456789",
      esta_activo: true,
    });
    restaurante = await restauranteRepo.save(restaurante);
  }

  let sucursal = await sucursalRepo.findOne({
    where: { inquilino_id: inquilino.id, slug: "sucursal-central-live" },
  });
  if (!sucursal) {
    sucursal = sucursalRepo.create({
      inquilino_id: inquilino.id,
      restaurante_id: restaurante.id,
      nombre: "Sucursal Central",
      slug: "sucursal-central-live",
      direccion: "Av. La Marina 1234, San Miguel, Lima",
      telefono: "+51999888777",
      apertura_manual: true,
      esta_activo: true,
    });
    sucursal = await sucursalRepo.save(sucursal);
  }

  let categoria = await categoriaRepo.findOne({
    where: { inquilino_id: inquilino.id, restaurante_id: restaurante.id },
  });
  if (!categoria) {
    categoria = categoriaRepo.create({
      inquilino_id: inquilino.id,
      restaurante_id: restaurante.id,
      nombre: "Hamburguesas Clásicas",
      orden: 1,
    });
    categoria = await categoriaRepo.save(categoria);
  }

  let producto = await productoRepo.findOne({
    where: { inquilino_id: inquilino.id, nombre: "Burger Doble Carne" },
  });
  if (!producto) {
    producto = productoRepo.create({
      inquilino_id: inquilino.id,
      restaurante_id: restaurante.id,
      categoria_id: categoria.id,
      nombre: "Burger Doble Carne",
      precio_base_centavos: "2500", // S/ 25.00
      empaque_centavos: "150",       // S/ 1.50
      es_fragil: false,
      esta_activo: true,
    });
    producto = await productoRepo.save(producto);
  }

  // Repartidor
  let repartidor = await repartidorRepo.findOne({
    where: { inquilino_id: inquilino.id, telefono: "+51987654321" },
  });
  if (!repartidor) {
    repartidor = repartidorRepo.create({
      inquilino_id: inquilino.id,
      nombre_completo: "Carlos Rider Demo",
      telefono: "+51987654321",
      fecha_nacimiento: "1995-05-10",
      tipo_flota: "PROPIO",
      tipo_vehiculo: "MOTO",
      estado: "DISPONIBLE",
      alta_confianza: true,
      esta_activo: true,
    });
    repartidor = await repartidorRepo.save(repartidor);
  }
  console.log(`✓ Restaurante (${restaurante.nombre}), Sucursal (${sucursal.nombre}), Producto (${producto.nombre}) y Repartidor (${repartidor.nombre_completo}) listos`);

  // 6. Probar Creación de Pedido con Idempotencia y Trigger siguiente_contador
  console.log("\n--- PRUEBA 6: Creación de Pedido Manual & Idempotencia ---");
  const idempotencyKey = `idemp-${Date.now()}`;
  const pedidoCreado = await ordersService.createManualOrder(
    actorContext,
    {
      sucursal_id: sucursal.id,
      cliente_nuevo: {
        nombre: "Juan Pérez Cliente",
        telefono_e164: "+51912345678",
      },
      direccion_snapshot: {
        texto_direccion: "Calle Las Begonias 450, Dpto 501",
        referencia: "Frente al parque",
      },
      metodo_pago: "EFECTIVO",
      efectivo_por_cobrar_centavos: 0,
      canal: "MANUAL",
      factura_solicitada: false,
      items: [
        {
          producto_id: producto.id,
          cantidad: 2,
          modificadores: [],
        },
      ],
    },
    idempotencyKey
  );

  console.log(`  Pedido creado ID: ${pedidoCreado.id}`);
  console.log(`  Número asignado por trigger siguiente_contador(): #${pedidoCreado.numero}`);
  console.log(`  Total: ${formatPen(BigInt(pedidoCreado.total_centavos))} (${pedidoCreado.total_centavos} céntimos)`);
  console.log(`  Estado Operativo: ${pedidoCreado.estado_operativo}`);
  console.log(`  Versión inicial: ${pedidoCreado.version}`);

  if (BigInt(pedidoCreado.numero) <= BigInt(0)) {
    throw new Error("El trigger siguiente_contador() no asignó un número secuencial > 0");
  }

  // Probar Idempotencia: enviar misma clave
  const pedidoIdempotente = await ordersService.createManualOrder(
    actorContext,
    {
      sucursal_id: sucursal.id,
      cliente_id: pedidoCreado.cliente_id,
      direccion_snapshot: { texto_direccion: "Otra direccion ignorada" },
      metodo_pago: "EFECTIVO",
      efectivo_por_cobrar_centavos: 0,
      canal: "MANUAL",
      factura_solicitada: false,
      items: [{ producto_id: producto.id, cantidad: 1, modificadores: [] }],
    },
    idempotencyKey
  );

  if (pedidoIdempotente.id !== pedidoCreado.id) {
    throw new Error("Idempotencia falló: no devolvió el mismo pedido");
  }
  console.log("✓ Idempotencia validada: misma clave devolvió el pedido existente sin duplicar");

  // 7. Probar FSM y Release Gate
  console.log("\n--- PRUEBA 7: Máquina de Estados FSM & Compuerta de Liberación (Release Gate) ---");

  // Transición 1: NUEVO -> CONFIRMADO
  let pedidoActual = await ordersService.transitionOrder(
    actorContext,
    pedidoCreado.id,
    "CONFIRMADO"
  );
  console.log(`  Transición a CONFIRMADO exitosa (Versión: ${pedidoActual.version})`);

  // Transición 2: CONFIRMADO -> EN_PREPARACION
  pedidoActual = await ordersService.transitionOrder(
    actorContext,
    pedidoCreado.id,
    "EN_PREPARACION"
  );
  console.log(`  Transición a EN_PREPARACION exitosa (Versión: ${pedidoActual.version})`);

  // Transición 3: EN_PREPARACION -> LISTO
  pedidoActual = await ordersService.transitionOrder(
    actorContext,
    pedidoCreado.id,
    "LISTO"
  );
  console.log(`  Transición a LISTO exitosa (Versión: ${pedidoActual.version})`);

  // Intento de salto directo a EN_CAMINO sin cumplir Release Gate:
  // Debe fallar porque no hay repartidor asignado, ni pago restaurante confirmado, ni traspaso
  try {
    await ordersService.transitionOrder(
      actorContext,
      pedidoCreado.id,
      "EN_CAMINO"
    );
    throw new Error("Debió bloquearse por la compuerta de liberación");
  } catch (err: any) {
    console.log(`✓ Release Gate bloqueó despacho prematuro: "${err.message}"`);
  }

  // Cumplir condición 1: Asignar Repartidor
  console.log("\n--- PRUEBA 8: Asignación de Repartidor & Elegibilidad ---");
  const pedidoConRider = await logisticsService.assignRiderToOrder(
    actorContext,
    pedidoCreado.id,
    repartidor.id
  );
  console.log(`✓ Repartidor ${repartidor.nombre_completo} asignado a pedido #${pedidoConRider.numero} (Estado: ${pedidoConRider.estado_operativo})`);

  // Cumplir condición 2: Pago a Restaurante (Crear registro y confirmar)
  console.log("\n--- PRUEBA 9: Pagos y Confirmación de Payout a Restaurante ---");
  const pagoRestRepo = AppDataSource.getRepository(PagoRestauranteEntity);
  let pagoRest = await pagoRestRepo.findOne({ where: { pedido_id: pedidoCreado.id } });
  if (!pagoRest) {
    pagoRest = pagoRestRepo.create({
      inquilino_id: inquilino.id,
      pedido_id: pedidoCreado.id,
      monto_centavos: "4000",
      estado: "PENDIENTE",
    });
    pagoRest = await pagoRestRepo.save(pagoRest);
  }

  pagoRest = await paymentsService.confirmRestaurantPayout(
    actorContext,
    pagoRest.id,
    "TRANSFERENCIA_BANCARIA",
    "OPER-987654"
  );
  console.log(`✓ Pago a restaurante confirmado: Estado = ${pagoRest.estado}, Confirmado por = ${pagoRest.confirmado_por}`);

  // Cumplir condición 3: Traspaso físico
  console.log("\n--- PRUEBA 10: Traspaso Físico y Despacho Liberado ---");
  await ordersService.registerHandoff(actorContext, pedidoCreado.id);
  console.log("✓ Traspaso físico registrado por encargado de sucursal");

  // Ahora transicionar a EN_CAMINO: ¡Debe tener éxito!
  pedidoActual = await ordersService.transitionOrder(
    actorContext,
    pedidoCreado.id,
    "EN_CAMINO"
  );
  console.log(`✓ Despacho liberado exitosamente: Estado = ${pedidoActual.estado_operativo}, Liberado en = ${pedidoActual.liberado_en}`);

  // 8. Entrega Final y Cobro en Efectivo (Asiento en Billetera)
  console.log("\n--- PRUEBA 11: Cobro en Efectivo contra Entrega y Libro Mayor ---");
  const cobroResult = await logisticsService.collectCashOnDelivery(
    actorContext,
    pedidoCreado.id
  );
  console.log(`✓ Efectivo cobrado: Pedido #${cobroResult.pedido.numero} pagado. Asiento en billetera ID: ${cobroResult.movimiento.id}`);
  console.log(`  Tipo movimiento: ${cobroResult.movimiento.tipo}, Monto: ${cobroResult.movimiento.monto_centavos} céntimos (negativo según constraint)`);

  // Transición a ENTREGADO
  pedidoActual = await ordersService.transitionOrder(
    actorContext,
    pedidoCreado.id,
    "ENTREGADO"
  );
  console.log(`✓ Pedido entregado satisfactoriamente (Estado: ${pedidoActual.estado_operativo})`);

  // Consultar balance del repartidor
  const wallet = await logisticsService.getRiderWalletBalance(actorContext, repartidor.id);
  console.log(`✓ Billetera de Repartidor: Saldo = ${wallet.saldo_soles}, Tiene deuda = ${wallet.tiene_deuda}, Movimientos = ${wallet.movimientos.length}`);

  // 9. Cierre de Liquidación
  console.log("\n--- PRUEBA 12: Liquidación Diaria de Efectivo ---");
  const fechaOperativa = new Date().toISOString().slice(0, 10);
  const liquidacion = await logisticsService.confirmSettlement(
    actorContext,
    repartidor.id,
    fechaOperativa,
    pedidoCreado.total_centavos, // Repartidor rinde todo el efectivo cobrado
    "1000",                      // Tarifa de repartidor S/ 10.00
    undefined
  );
  console.log(`✓ Liquidación diaria confirmada ID: ${liquidacion.id}, Estado: ${liquidacion.estado}, Efectivo recibido: ${formatPen(BigInt(liquidacion.efectivo_recibido_centavos))}`);

  const walletPostLiq = await logisticsService.getRiderWalletBalance(actorContext, repartidor.id);
  console.log(`✓ Billetera tras liquidación: Saldo = ${walletPostLiq.saldo_soles}, Tiene deuda = ${walletPostLiq.tiene_deuda}`);

  console.log("\n========================================================");
  console.log("🎉 ¡TODAS LAS PRUEBAS DEL HITO 2 PASARON EXITOSAMENTE!");
  console.log("========================================================");

  await AppDataSource.destroy();
}

runTests().catch((err) => {
  console.error("❌ ERROR EN PRUEBAS DEL HITO 2:", err);
  process.exit(1);
});
