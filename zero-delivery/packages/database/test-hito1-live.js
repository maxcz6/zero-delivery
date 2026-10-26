const { AppDataSource, allEntities } = require("./dist/index.js");

async function runHito1LiveTest() {
  console.log("=== INICIANDO PRUEBA LIVE HITO 1: TYPEORM <-> POSTGRESQL 16 ===");
  console.log(`Total de entidades registradas en AppDataSource: ${allEntities.length}`);

  try {
    await AppDataSource.initialize();
    console.log("✔ AppDataSource inicializado correctamente contra PostgreSQL en puerto 5434.");

    // 1. Probar lectura sobre repositorios
    const tablesToTest = [
      { name: "inquilinos", target: "inquilinos" },
      { name: "configuraciones", target: "configuraciones" },
      { name: "usuarios", target: "usuarios" },
      { name: "restaurantes", target: "restaurantes" },
      { name: "sucursales", target: "sucursales" },
      { name: "categorias", target: "categorias" },
      { name: "productos", target: "productos" },
      { name: "cartas", target: "cartas" },
      { name: "clientes", target: "clientes" },
      { name: "repartidores", target: "repartidores" },
      { name: "pedidos", target: "pedidos" },
      { name: "pagos", target: "pagos" },
      { name: "liquidaciones", target: "liquidaciones" },
      { name: "movimientos_billetera", target: "movimientos_billetera" },
      { name: "alertas", target: "alertas" },
      { name: "eventos_salida", target: "eventos_salida" },
      { name: "eventos_entrada", target: "eventos_entrada" },
      { name: "registro_auditoria", target: "registro_auditoria" },
    ];

    console.log("\n--- Comprobando Repositorios de TypeORM ---");
    for (const table of tablesToTest) {
      const repo = AppDataSource.getRepository(table.target);
      const count = await repo.count();
      console.log(`✔ Repositorio '${table.name}': OK (Filas actuales: ${count})`);
    }

    // 2. Probar inserción transaccional de Catálogo vinculada
    console.log("\n--- Probando Inserción de Entidades Relacionadas ---");
    const inquilinoRepo = AppDataSource.getRepository("inquilinos");
    const inquilino = await inquilinoRepo.findOne({ where: { slug: "zero-delivery-demo" } });
    if (!inquilino) {
      throw new Error("No se encontró el inquilino demo");
    }

    const restRepo = AppDataSource.getRepository("restaurantes");
    let restaurante = await restRepo.findOne({ where: { inquilino_id: inquilino.id, nombre: "Burger Zero" } });
    if (!restaurante) {
      restaurante = restRepo.create({
        inquilino_id: inquilino.id,
        nombre: "Burger Zero",
        razon_social: "Burger Zero SAC",
        ruc: "20123456789",
        esta_activo: true,
      });
      await restRepo.save(restaurante);
      console.log(`✔ Restaurante creado: '${restaurante.nombre}' (ID: ${restaurante.id})`);
    } else {
      console.log(`✔ Restaurante existente: '${restaurante.nombre}' (ID: ${restaurante.id})`);
    }

    const catRepo = AppDataSource.getRepository("categorias");
    let categoria = await catRepo.findOne({ where: { restaurante_id: restaurante.id, nombre: "Hamburguesas" } });
    if (!categoria) {
      categoria = catRepo.create({
        inquilino_id: inquilino.id,
        restaurante_id: restaurante.id,
        nombre: "Hamburguesas",
        orden: 1,
      });
      await catRepo.save(categoria);
      console.log(`✔ Categoría creada: '${categoria.nombre}' (ID: ${categoria.id})`);
    } else {
      console.log(`✔ Categoría existente: '${categoria.nombre}' (ID: ${categoria.id})`);
    }

    const prodRepo = AppDataSource.getRepository("productos");
    let producto = await prodRepo.findOne({ where: { restaurante_id: restaurante.id, nombre: "Doble Queso Burger" } });
    if (!producto) {
      producto = prodRepo.create({
        inquilino_id: inquilino.id,
        restaurante_id: restaurante.id,
        categoria_id: categoria.id,
        nombre: "Doble Queso Burger",
        descripcion: "Carne angus con doble queso cheddar y salsa especial",
        es_fragil: false,
        precio_base_centavos: "2500", // S/ 25.00
        empaque_centavos: "150",      // S/ 1.50
        tipo_margen: "FIJO",
        valor_margen: 350,            // S/ 3.50
        esta_activo: true,
      });
      await prodRepo.save(producto);
      console.log(`✔ Producto creado: '${producto.nombre}' - Precio base S/ 25.00 (ID: ${producto.id})`);
    } else {
      console.log(`✔ Producto existente: '${producto.nombre}' (ID: ${producto.id})`);
    }

    console.log("\n=== PRUEBA LIVE HITO 1 COMPLETADA CON ÉXITO TOTAL (100% VERDE) ===");
  } catch (error) {
    console.error("❌ Error en la prueba live del Hito 1:", error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runHito1LiveTest();
