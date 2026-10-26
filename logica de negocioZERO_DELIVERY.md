**nombre del sistema Zero Delivery**

**DOCUMENTO DE REQUISITOS FUNCIONALES Y NO FUNCIONALES**

**1\. Requisitos Funcionales (RF)** Los requisitos funcionales describen las funciones que el sistema debe realizar para permitir la gestión de pedidos, clientes, menú, delivery, reportes, promociones, finanzas y comunicación con los clientes.

**RF-01. Autenticación y acceso al sistema** El sistema deberá permitir que los usuarios autorizados puedan iniciar sesión mediante usuario y contraseña. El sistema deberá controlar el acceso según el rol del usuario. Los principales roles podrán ser:

* Administrador.  
* Encargado del restaurante / sucursal. (se encarga entregar el pedido y mandarlo a preparar)  
* Repartidor.  
* empleado (Atención al cliente y mismas opciones que el coordinador pero con menos permisos )  
* / Coordinador. Cada usuario deberá visualizar únicamente las funciones correspondientes a sus permisos.

**RF-02. Panel de control / Dashboard** El sistema deberá proporcionar un panel principal con un resumen de la actividad del restaurante. El Dashboard deberá mostrar:

* Cantidad de pedidos del día.  
* Ventas del día.  
* Ingresos generados.  
* Pedidos en preparación.  
* Pedidos en camino.  
* Pedidos entregados.  
* Pedidos cancelados (anulados) y Entregas fallidas.  
* Pedidos demorados.  
* Tiempo promedio de preparación.  
* Calificación promedio (restaurante y motorizados).  
* Cantidad de clientes nuevos y recurrentes. El usuario deberá poder consultar información mediante diferentes periodos (Hoy, Ayer, Últimos 7 días, Últimos 30 días, Periodo personalizado).

**RF-03. Monitoreo del estado operativo** El sistema deberá mostrar el estado actual del restaurante y sus sucursales. Deberá permitir identificar:

* Restaurante/Sucursal disponible o no disponible.  
* Pedidos demorados, cancelados, rechazados o no entregados.  
* Productos no disponibles.  
* Problemas relacionados con el delivery o motorizados sin saldo de garantía. El sistema deberá generar alertas cuando se detecten situaciones que requieran atención.

**RF-04. Gestión de pedidos** El sistema deberá permitir registrar y administrar los pedidos realizados por los clientes. Cada pedido deberá contener como mínimo:

* Número de pedido, fecha y hora.  
* Cliente, teléfono y dirección de entrega.  
* Productos solicitados, cantidad, precio.  
* Desglose interno de costos: Precio base \+ Costo de envase/taper \+ Costo de delivery (Este desglose interno no se mencionará al cliente, quien verá un precio final o según configuración de la carta).  
* Subtotal y descuentos.  
* Impuestos (aplicables si el cliente solicita factura).  
* Total y Método de pago.  
* Estado del pedido. Los pedidos deberán poder filtrarse por:  
  1. Nuevos.  
  2. En preparación.  
  3. Listos.  
  4. Asignados a delivery.  
  5. En camino.  
  6. Entregados.  
  7. Entrega fallida / No entregado (cuando el cliente no recibe el pedido).  
  8. Cancelados (orden anulada desde el restaurante).

**RF-05. Trazabilidad del pedido y pagos anticipados** El sistema deberá permitir consultar el historial de estados de cada pedido, registrando fecha y hora. La trazabilidad logística deberá contemplar: Pedido recibido → Pedido confirmado → En preparación → Listo → Repartidor asignado → En camino → Entregado (o Entrega fallida).*Pagos anticipados (Yape/Transferencia):* La preparación física del pedido no se detendrá, pero el estado de pago iniciará como "Pendiente". El coordinador o empleado validará el comprobante y cambiará el estado a "Pagado" manualmente antes de despachar, indicando al repartidor que es una entrega sin cobro.

**RF-06. Gestión de repartidores / Delivery** El sistema deberá permitir administrar los repartidores propios y de agencias externas (ej. Turbo Delivery, Wanka Flash, Zero Delivery, modelo tipo Glovo). Para cada repartidor se registrará:

* Nombre, teléfono, estado y tipo de vehículo (moto,carro).  
* Edad y perfil (. Solo repartidores mayores de 35 años o perfiles de alta confianza podrán realizar cobros de pedidos contra entrega en efectivo sin garantía ).(repartidores con menos de 35 años si o si tienen que tener su garantía para repartir pedido contra entrega(solo aplica pedidos contra entrega ) )  
* Calificación del motorizado (sistema de estrellas por comportamiento y buena atención). El estado del repartidor podrá ser: Disponible, Ocupado, En camino, Fuera de servicio.las estrellas del motorizado se aumentan según pedidos que haga , 20 pedidos es 5 estrellas   
* Calificación del cliente (el repartidor puede poner estrellas por comportamiento  de cliente ,las estrellas del cliente se aumentan según pedidos que haga , 10 pedidos es 5 estrellas   )

**RF-07. Seguimiento del delivery y Visibilidad por Roles** El sistema deberá permitir consultar el estado del delivery y la ubicación del pedido, limitando la información y las acciones permitidas según el rol del usuario para garantizar la seguridad y eficiencia operativa. La trazabilidad logística (Rider cerca del punto de retiro → En entrega → Pedido entregado / Entrega fallida) se visualizará de la siguiente manera:

**1\. Administrador**

* **Visibilidad:** Acceso total y global. Puede ver en tiempo real la ubicación de todos los repartidores (geolocalización activa) de todas las sucursales.  
* **Acciones:** Puede auditar el historial de tiempos de entrega, modificar cualquier estado en caso de error del sistema, acceder a los reportes de rendimiento de los motorizados y gestionar anulaciones críticas.

**2\. Coordinador**

* **Visibilidad:** Control total sobre la logística de su sucursal a cargo. Visualiza en el mapa a todos los motorizados activos y el tablero completo de pedidos en curso ("Repartidor asignado", "En camino", "Entregado", "Entrega fallida").  
* **Acciones:** Asigna o reasigna pedidos a los repartidores, valida pagos anticipados (Yape/Transferencias) antes de autorizar la salida del motorizado, y es el encargado de procesar y documentar las "Entregas fallidas" o gestionar adelantos de garantía.

**3\. Encargado del restaurante / sucursal**

* **Visibilidad:** Su enfoque es el despacho. Visualiza la trazabilidad desde "Nuevo" hasta "Listo". Una vez que el pedido sale del local, solo visualiza el estado final ("Entregado" o "Entrega fallida") para fines de cuadre de caja y control de inventario.  
* **Acciones:** Cambia el estado a "En preparación" y "Listo". Es quien registra en el sistema el momento exacto en que el paquete físico es entregado al motorizado (activando la etapa "Rider cerca del punto de retiro / En tránsito"). No necesita ver el mapa de geolocalización en tiempo real.

**4\. Empleado (Atención al cliente)**

* **Visibilidad:** Modo lectura avanzada para soporte. Puede ver exactamente en qué estado logístico se encuentra el pedido ("En preparación", "En camino", "Rider cerca") y la ubicación del repartidor para poder informar al cliente final si este consulta por el chatbot o teléfono.  
* **Acciones:** No puede asignar pedidos, reasignar motorizados ni alterar el estado financiero (pagos/garantías). Solo puede añadir notas al pedido o alertar al Coordinador si el cliente solicita un cambio urgente de dirección o reporta una incidencia.

**5\. Repartidor (Rider)**

* **Visibilidad:** Vista individual y restringida a sus pedidos asignados. Visualiza los detalles del cliente (solo cuando el pedido le es asignado), la dirección exacta, el detalle de cobro (si es efectivo o ya está pagado) y si es un paquete frágil.  
* **Acciones:** Actualiza la trazabilidad desde su aplicativo móvil:  
  * Confirma llegada al local: *"Rider cerca del punto de retiro"*.  
  * Confirma salida: *"En entrega / En camino"*.  
  * Confirma finalización: *"Pedido entregado"* (con registro de pago en efectivo si corresponde, afectando su garantía) o *"Entrega fallida"* (debiendo justificar el motivo). No puede ver la ubicación de otros repartidores ni los ingresos totales del local.

**RF-08. Gestión del menú** El sistema deberá permitir administrar el catálogo de productos. El administrador deberá poder:

* Crear, editar, eliminar, activar y desactivar productos.  
* Configurar nuevas cartas dinámicas con diferentes precios (que puedan incluir el delivery y el IGV en el precio mostrado).  
* Agregar imágenes (con soporte para fotos genéricas de base de datos, sin logo, para marcas blancas).  
* Marcar productos como "Sensibles o Frágiles" (ej. tortas), lo que forzará requerimientos especiales de transporte.  
* Organizar por categorías (Entradas, Platos, Bebidas, etc.).

**RF-09. Gestión de modificadores** El sistema deberá permitir configurar opciones adicionales para los productos (agregar queso, cambiar acompañamiento, tamaño, término de cocción). Actualizará automáticamente el precio según corresponda.

**RF-10. Gestión de horarios y sucursales** El sistema deberá permitir configurar los horarios de atención de forma independiente para cada local o sucursal (ya que cada una tiene diferentes horarios o el mismo coordinador colocar los horarios si el  local no puede ). Se configurarán horarios por día de la semana y turnos dentro de un mismo día.

**RF-11. Gestión de zonas de reparto y tipos de transporte** El sistema deberá establecer:

* Zona de cobertura, radio de delivery, costo de envío y pedido mínimo.  
* Tarifas dinámicas opcionales según la necesidad del cliente y el tipo de vehículo (ej. cobro adicional si requiere entrega en carro para productos frágiles).

**RF-12. Gestión de clientes y validación de seguridad** El sistema deberá registrar y administrar clientes: Nombre, teléfono, dirección, historial, preferencias ("pedidos por gustos") y frecuencia de compra.*Validación (Doxeo/Filtro de seguridad):* El sistema permitirá verificar el estado de los clientes para garantizar entregas en zonas o perfiles seguros.*Categorización:* Identificará clientes nuevos, recurrentes y "Clientes Top", permitiendo ofrecerles servicios exclusivos o adicionales (ej. servicio de taxi confiable asociado al restaurante).

**RF-13. Historial de compras del cliente** El sistema deberá consultar el historial mostrando: pedido, fecha, productos, total, método de pago y estado.

**RF-14. Gestión de reseñas y calificaciones** El sistema registrará opiniones y calificaciones divididas en:

* Calificación del restaurante/comida.  
* Calificación del motorizado (estrellas de comportamiento). Permitirá consultar calificaciones bajas para tomar acciones correctivas inmediatas.

**RF-15 a RF-18. Módulo Analítico y Reportes (Ventas, Operativos, Clientes y Embudo)** El sistema deberá generar reportes detallados para la toma de decisiones, divididos en cuatro áreas clave. El acceso a esta información estará estrictamente controlado por el nivel de permisos de cada usuario.

**Detalle de los Reportes Generados:**

* **RF-15. Reportes de Ventas (Financiero):** Generación de métricas de ingresos e historial de transacciones. Incluye ventas por día, semana y mes; ventas por producto y categoría; cálculo del ticket promedio, y ranking de los productos más vendidos.  
* **RF-16. Reportes Operativos (Logística y Cocina):** Medición de la eficiencia del restaurante y del delivery. Incluye tiempos promedio de preparación, tiempos de entrega, porcentaje de entregas exitosas vs. entregas fallidas, cantidad de pedidos demorados, y motivos de cancelación o rechazo.  
* **RF-17. Reportes de Clientes (Fidelización):** Análisis del comportamiento del consumidor. Permite identificar la proporción de clientes nuevos vs. recurrentes, frecuencia de compra, ticket promedio por usuario, y un ranking de "Clientes Top" (para campañas de exclusividad).  
* **RF-18. Embudo de Conversión (Rendimiento Digital):** Análisis del flujo del usuario en el menú digital interactivo. Medirá el rendimiento mediante las etapas: *Impresiones (visitas al enlace) → Visualización del menú → Inicio del pedido (agregar al carrito) → Compra finalizada*. Esto permitirá detectar en qué punto se abandonan los pedidos.  
  **Visibilidad y Acceso a Reportes según el Rol:**  
  **1\. Administrador**  
* **Visibilidad:** Acceso total, global y sin restricciones.  
* **Alcance:** Puede visualizar y exportar los reportes de ventas, operativos, de clientes y el embudo de conversión de **todas las sucursales** de forma consolidada o individual. Es el único perfil que puede ver las métricas financieras globales y la rentabilidad de las campañas de publicidad.  
  **2\. Encargado del restaurante / sucursal y Coordinador**  
* **Visibilidad:** Acceso intermedio, restringido a su local.  
* **Alcance:** Puede ver los **Reportes Operativos** (tiempos de su cocina y sus motorizados, entregas fallidas de su turno) y los **Reportes de Ventas** diarios/semanales exclusivamente de su sucursal para realizar el cuadre de caja. No tiene acceso al embudo de conversión digital ni a las métricas globales de la franquicia.  
  **3\. Empleado (Atención al cliente)**  
* **Visibilidad:** Acceso micro (por usuario), sin acceso a reportes macro.  
* **Alcance:** No puede ver paneles de ventas totales, ticket promedio general ni embudos de conversión. Su acceso analítico se limita al **RF-17 (Historial del Cliente)** de manera individual; es decir, al atender a un usuario, puede ver su frecuencia de compra y si es un "Cliente Top" para brindarle un servicio personalizado.  
  **4\. Repartidor (Rider)**  
* **Visibilidad:** Acceso estrictamente personal.  
* **Alcance:** No tiene acceso a los reportes del restaurante. Solo cuenta con un panel personal en su aplicativo donde visualiza sus propias métricas operativas (RF-16 adaptado): cantidad de entregas exitosas, entregas fallidas, sus calificaciones/estrellas de comportamiento y el saldo de su garantía.

**RF-19. Gestión de pagos y métodos de cobro logístico** El sistema registrará métodos de pago: Efectivo, Tarjeta, Yape/Transferencia, etc. Estados de pago: Pendiente, Pagado, Reembolsado, Rechazado.*Reglas de cobro en Delivery:* Los pagos mediante Yape van directos al local (sin afectar al motorizado). Los pagos en Efectivo contra entrega requerirán validación del perfil del motorizado y afectarán su saldo de garantía interna.

**RF-20. Gestión de Garantías y Finanzas de Repartidores** El sistema incluirá una billetera o sistema de "Garantía" para motorizados:

* Los repartidores deberán contar con un monto de garantía asociado. Si no tienen saldo suficiente en su garantía, el sistema no les asignará pedidos con pago en efectivo contra entrega.  
* El dinero cobrado en efectivo por el motorizado se descontará automáticamente de su garantía en el sistema.  
* Se permitirá registrar adelantos financieros operativos (ej. adelanto para gasolina del motorizado,siempre y cuando tenga buenas reseñas o sea aprobado por el coordinador ).  
* *Horario de corte:* Las liquidaciones y pagos de los repartidores se procesarán hasta las 11:00 PM.

**RF-21. Gestión de promociones** El sistema permitirá crear promociones (descuentos, cupones, combos). Incluirá capacidad para programar *días de descuento específicos por local* (ej. "Días de descuento de pollo a la brasa en restaurantes específicos" ,el mismo restaurante tiene que poder crear su promocion ) .

**2\. Integración con Vocero CRMRF-23 a RF-27. (CRM, Chatbot, Notificaciones, Captura automática)**

* Integración vía API/webhooks con Vocero CRM para sincronizar clientes y pedidos.  
* Chatbot con menú interactivo (Ver menú, pedir, estado, promociones, asesor).  
* Consulta de estado del pedido mediante chatbot (ej. indicando el número).  
* Notificaciones automáticas de cambio de estado ("Confirmado", "En camino", "Entregado").  
* Captura automática de datos para evitar registros duplicados.

**RF-28. Tablero Kanban de pedidos** Vista operativa con columnas: Nuevo pedido → En preparación → Listo → Delivery asignado → En camino → Entregado / Entrega Fallida.

**RF-29. Alertas operativas** Alertas por nuevos pedidos, demoras en preparación o falta de repartidor, anulaciones, entregas fallidas, o calificaciones bajas.

**RF-30 a RF-32. (Búsqueda, Historial de actividades, Exportación)** Filtros avanzados por cliente/pedido, auditoría de acciones de usuarios en el sistema y exportación de reportes en Excel, CSV o PDF.

**3\. Requisitos No Funcionales (RNF)RNF-01 a RNF-10 (Usabilidad, Rendimiento, Seguridad, Escalabilidad, Integración)** Interfaz sencilla, diseño responsive, carga rápida de datos, alta disponibilidad en horarios operativos. Protección de roles, privacidad de datos de clientes, arquitectura escalable (modelo SaaS para múltiples restaurantes) e integración segura vía API/Webhooks (oficiales para Vocero CRM).

**RNF-11 a RNF-20 (Mantenibilidad, Recuperación, Localización, Accesibilidad)** Código modular, auditoría de registros, manejo seguro de errores, copias de seguridad periódicas, tiempo real en estados logísticos.*Localización peruana:* Moneda en Soles (S/), formatos de fecha locales, validación de números y direcciones, sin almacenar credenciales en código fuente, manteniendo un UI/UX consistente e intuitivo.

**4\. Módulos del sistema**

**1\. Módulo de Autenticación y Usuarios**

* **Funciones:** Gestión de inicio de sesión, control de acceso por roles (Administrador, Coordinador, Encargado, Empleado, Repartidor) y registro de auditoría de actividades.  
* **Requisitos asociados:** RF-01, RF-31.

**2\. Módulo de Dashboard y Monitoreo (Panel de Control)**

* **Funciones:** Visualización de métricas en tiempo real (ventas, pedidos, tiempos), estado de las sucursales y panel de alertas operativas (demoras, falta de repartidores).  
* **Requisitos asociados:** RF-02, RF-03, RF-29.

**3\. Módulo de Gestión de Pedidos**

* **Funciones:** Creación de pedidos, desglose de costos (base \+ taper \+ delivery), gestión de impuestos, trazabilidad logística, tablero Kanban interactivo y proceso de liberación de pedidos.  
* **Requisitos asociados:** RF-04, RF-05, RF-28.

**4\. Módulo de Delivery y Logística**

* **Funciones:** Administración de flota propia y externa (Turbo Delivery, Wanka Flash, etc.), asignación de vehículos (moto/carro para frágiles), seguimiento por geolocalización según el rol, y control de perfiles de motorizados (validación de edad \+35 para cobros sin garantía).  
* **Requisitos asociados:** RF-06, RF-07.

**5\. Módulo de Finanzas y Billetera de Repartidores**

* **Funciones:** Gestión de métodos de pago (Yape directo al local vs. Efectivo), billetera de "Garantías" con descuento automático de cobros en efectivo, aprobación de adelantos (gasolina) y liquidaciones con cierre a las 11:00 PM.  
* **Requisitos asociados:** RF-19, RF-20.

**6\. Módulo de Catálogo y Menú**

* **Funciones:** Creación de cartas dinámicas con precios variables, gestión de productos frágiles/sensibles, modificadores de platos (queso, tamaño) y uso de imágenes genéricas sin logo (marca blanca).  
* **Requisitos asociados:** RF-08, RF-09.

**7\. Módulo de Clientes (CRM Interno)**

* **Funciones:** Base de datos de clientes, historial de compras, categorización ("Clientes Top"), doxeo/validación de zonas seguras y gestión de preferencias ("pedidos por gustos").  
* **Requisitos asociados:** RF-12, RF-13.

**8\. Módulo de Reseñas y Calificaciones (Bidireccional)**

* **Funciones:** Registro de feedback de la comida y sistema de estrellas por comportamiento, donde el cliente califica al motorizado y el motorizado califica al cliente (escalando a 5 estrellas según volumen de pedidos).  
* **Requisitos asociados:** RF-06, RF-14.

**9\. Módulo Analítico y Reportes**

* **Funciones:** Generación de reportes de Ventas, Logística/Operaciones, Fidelización de Clientes y Embudo de Conversión Digital. Visibilidad estrictamente filtrada por el rol del usuario (Administrador ve todo, Encargado solo su local).  
* **Requisitos asociados:** RF-15, RF-16, RF-17, RF-18, RF-32.

**10\. Módulo de Configuración Operativa (Horarios y Zonas)**

* **Funciones:** Configuración independiente de horarios y turnos por cada sucursal, definición de polígonos/zonas de reparto, radios de alcance y tarifas dinámicas de envío.  
* **Requisitos asociados:** RF-10, RF-11.

**11\. Módulo de Marketing (Promociones y Publicidad)**

* **Funciones:** Creación de cupones, combos y campañas publicitarias. Capacidad para que cada sucursal programe sus propios días de descuento específicos.  
* **Requisitos asociados:** RF-21, RF-22.

**12\. Módulo de Integración y Omnicanalidad (Vocero CRM)**

* **Funciones:** Integración vía API/Webhooks con Vocero CRM, despliegue de Chatbot para autoatención (pedidos, estado, menú), captura automática de leads y notificaciones de estado por WhatsApp/SMS.  
* **Requisitos asociados:** RF-23, RF-24, RF-25, RF-26, RF-27.

**—------------------------------------------------------------------------------------------------------------------------**  
**—------------------------------------------------------------------------------------------------------------------------**  
**—------------------------------------------------------------------------------------------------------------------------**

**Matriz de Permisos por Rol de Usuario**

**A continuación se detalla el nivel de acceso (Crear, Leer, Actualizar, Eliminar) y las acciones específicas permitidas para cada rol dentro de los 12 módulos del sistema, garantizando la seguridad, la separación de responsabilidades y la estructura del modelo de negocio (Agencia de Delivery vs. Negocios Independientes).**

**1\. Administrador (Perfil: Pertenece a la Agencia de Delivery \| Acceso Total y Global)**

* Gestión de Usuarios y Configuración: Acceso total. Es el único que puede crear cuentas, asignar roles, configurar zonas de reparto generales y auditar el historial de actividades de todo el personal (RF-31).  
* Menú y Promociones: Control total. Crea, edita y elimina productos, modificadores, cartas dinámicas, campañas publicitarias y promociones globales de la plataforma.  
* Dashboard y Reportes: Visibilidad sin restricciones. Único rol con acceso a las métricas financieras macro (rentabilidad general de la agencia) de todas las sucursales y al Embudo de Conversión Digital (RF-18).  
* Operativa y Logística: Puede intervenir en cualquier sucursal para forzar cambios de estado, anular pedidos críticos o auditar el mapa global de geolocalización.

**2\. Coordinador (Perfil: Pertenece a la Agencia de Delivery \| Gestión Operativa y Logística)**

* Dashboard y Reportes: Visualiza reportes operativos (tiempos, entregas fallidas) y el cuadre de caja diario. Tiene acceso al embudo de conversión y a datos transaccionales/operativos de las sucursales para supervisar el flujo, pero no a la rentabilidad financiera global de la agencia.  
* Pedidos y Logística: Control total sobre la distribución. Asigna o reasigna pedidos a motorizados, visualiza el mapa GPS en tiempo real de su flota, aprueba adelantos financieros (gasolina) y procesa las justificaciones de entregas fallidas.  
* Finanzas y Liberación: Valida capturas de pagos (Yape/Transferencia) cambiando el estado a "Pagado". Es el responsable de ejecutar la "Liberación Manual", lo cual implica obligatoriamente realizar el pago del costo del producto al Encargado del restaurante justo cuando el motorizado llega al local, garantizando que el restaurante cobre antes del despacho (RF-28, RF-29).  
* Menú y Horarios: Puede gestionar los horarios de los locales y activar/desactivar la disponibilidad de productos en el sistema (por quiebre de stock), pero no puede crear productos nuevos.

**3\. Encargado del Restaurante / Sucursal (Perfil: Independiente / No pertenece a la agencia \| Enfoque en Despacho)**

* Pedidos (Recepción y Despacho): Acceso operativo enfocado exclusivamente en la interacción con la plataforma de delivery, sin relación con el control interno de su propia cocina. El encargado utiliza el sistema de forma manual para recibir el pedido ("Nuevo"), aceptar la orden (confirmando que el local la preparará) y marcarla como "Listo" únicamente cuando el paquete ya está empaquetado y a la espera del repartidor.  
* Logística y Liberación: Es el responsable de registrar en el sistema el momento exacto en que entrega el paquete físico (comida o producto) al motorizado. Condición estricta: Solo entregará el producto al motorizado y lo marcará en el sistema DESPUÉS de haber recibido el pago por parte del Coordinador o Empleado. No puede asignar repartidores ni visualizar el mapa GPS de geolocalización en tiempo real una vez que el paquete ha salido de su local.  
* Menú y Configuración Local: Tiene control sobre la oferta y configuración de su local en la app de delivery. Cuenta con acceso total para gestionar los datos de su restaurante, configurar sus horarios de atención, agregar nuevos platos, definir precios, armar sus propias cartas dinámicas y subir las imágenes de cada uno de sus productos.  
* Dashboard y Reportes: Su panel está enfocado en la operación del delivery. Solo visualiza el volumen de pedidos actuales, los pedidos demorados y las métricas operativas correspondientes a su turno. No tiene acceso a reportes financieros globales de la agencia, liquidaciones generales, ni al historial detallado de clientes.

**4\. Empleado (Perfil: Pertenece a la Agencia de Delivery \| Atención al Cliente y Soporte)**

* Pedidos y CRM: Modo de lectura avanzada. Puede ver el estado exacto del pedido y la ubicación del repartidor para informar al cliente (vía Chatbot, WhatsApp o teléfono). Accede al historial del cliente individual (RF-17) para identificar si es un "Cliente Top" y registrar "pedidos por gustos".  
* Operativa Financiera: Si el Coordinador está ocupado, el Empleado asume la responsabilidad operativa: valida comprobantes de pago (Yape/Transferencia) y notifica la liberación manual, lo que incluye gestionar y abonar el pago al Encargado del restaurante para que este libere el producto al motorizado sin demoras (RF-29).  
* Restricciones: No puede asignar pedidos a repartidores, alterar saldos de garantías, modificar precios, crear promociones ni acceder a reportes macro (ventas totales, embudo de conversión).

**5\. Repartidor / Rider (Perfil: Flota Mixta \- Agencia, Independiente o Terceros \| Aplicativo web, Móvil próximamente)**

* Pedidos: Visibilidad individual. Solo ve los pedidos que le han sido asignados explícitamente. Al recibir la asignación, visualiza la dirección, productos frágiles y si debe cobrar en efectivo o si ya está pagado.  
* Logística y Trazabilidad: Solo puede actualizar su propio estado ("Rider cerca del punto de retiro", "En entrega", "Pedido entregado" o "Entrega fallida").  
* Finanzas y Reseñas: Visualiza su propio saldo de garantía (el cual se descuenta automáticamente al marcar un pedido en efectivo como entregado). Puede calificar al cliente mediante el sistema de estrellas (RF-06).  
* Restricciones: No tiene acceso al mapa general de otros repartidores, no puede reasignar pedidos a compañeros, ni visualizar las ventas, inventario o datos del restaurante o de la agencia.

—------------------------------------------------------------------------------------------------------------------------

# **ZERO DELIVERY**

## **Documento integral de especificación funcional, reglas de negocio y propuesta técnica**

**Versión:** 1.1  
**Estado:** Borrador consolidado para revisión y aprobación  
**Tipo de sistema:** Plataforma web progresiva (PWA) para gestión de pedidos, restaurantes, sucursales y delivery  
**Idioma:** Español (Perú)  
**Moneda:** Soles peruanos (S/)  
**Modelo de operación:** Plataforma para múltiples restaurantes y sucursales  
**Tecnologías propuestas:** Next.js, TypeScript y PostgreSQL  
**Documento de referencia:** Documento de Requisitos Funcionales y No Funcionales de Zero Delivery

---

# **1\. Propósito del documento**

Este documento consolida los requisitos funcionales, requisitos no funcionales, reglas de negocio, permisos por rol, decisiones aprobadas y propuesta de implementación de Zero Delivery.

Su objetivo es establecer una referencia común para diseñar, desarrollar, probar y mantener el sistema.

La especificación se construye a partir de dos fuentes:

1. El documento original de requisitos de Zero Delivery.  
2. Las decisiones obtenidas durante las 17 partes de la entrevista de requisitos.

## **1.1. Clasificación de los requisitos**

* **Original:** aparece en el documento de requisitos inicial.  
* **Aprobado:** se decidió expresamente durante la entrevista.  
* **Propuesta técnica:** recomendación para facilitar una implementación segura y mantenible.  
* **Pendiente:** necesita una decisión adicional, un valor concreto o una validación externa.

Las decisiones aprobadas durante la entrevista complementan o modifican el comportamiento previsto inicialmente. Cuando exista una contradicción, deberá registrarse expresamente y resolverse durante la aprobación formal.

## **1.2. Control de versiones**

El responsable del proyecto deberá revisar y aprobar explícitamente cada nueva versión. La presente versión todavía no debe considerarse una aprobación definitiva de todos los detalles técnicos y comerciales.

---

# **2\. Descripción general de Zero Delivery**

Zero Delivery será una plataforma para centralizar la operación de varios restaurantes, sus sucursales, los pedidos de sus clientes, los repartidores y las operaciones financieras relacionadas con el delivery.

El sistema deberá permitir:

* Registrar restaurantes y sucursales.  
* Administrar productos, cartas, precios y promociones.  
* Recibir pedidos desde la plataforma, WhatsApp y otros canales autorizados.  
* Gestionar la preparación, asignación, despacho y entrega.  
* Validar pagos anticipados.  
* Registrar el dinero cobrado por los repartidores.  
* Administrar garantías, adelantos y liquidaciones.  
* Gestionar clientes, calificaciones y reclamos.  
* Generar alertas, reportes y auditorías.  
* Integrarse con Vocero CRM mediante API y webhooks, sujeto a la validación técnica de dicha integración.

## **2.1. Modelo de negocio**

**Decisión aprobada:** Zero Delivery obtiene ingresos mediante un margen configurable por producto, que puede establecerse como importe fijo o porcentaje.

**Pendiente:** definir los acuerdos comerciales que relacionan ese margen con los restaurantes, así como el tratamiento de costos, impuestos, descuentos, envases y tarifas de entrega.

## **2.2. Plataforma**

**Decisión aprobada:** la primera versión se plantea como una PWA, es decir, una aplicación web adaptable a computadoras y teléfonos que puede ofrecer una experiencia similar a una aplicación instalada.

La PWA no implica que todas las funciones del dispositivo, como el GPS permanente en segundo plano, estén garantizadas en todos los navegadores.

---

# **3\. Usuarios y roles**

Zero Delivery tendrá cinco roles principales.

## **3.1. Administrador**

Es el responsable general de la plataforma.

Funciones:

* Crear cuentas de usuarios y asignar roles.  
* Registrar restaurantes y sucursales.  
* Configurar parámetros generales.  
* Definir las reglas de precios, tarifas, garantías y promociones.  
* Crear y administrar productos.  
* Consultar los reportes globales.  
* Supervisar las operaciones de todos los restaurantes.  
* Consultar auditorías.  
* Intervenir en incidencias críticas.  
* Administrar las configuraciones generales y las integraciones.

## **3.2. Coordinador**

Tiene acceso operativo global a las sucursales, de acuerdo con la decisión aprobada durante la entrevista.

Funciones:

* Supervisar pedidos y operaciones de las sucursales.  
* Aceptar o rechazar pedidos dentro de sus permisos.  
* Asignar y reasignar repartidores.  
* Resolver entregas fallidas y reclamos.  
* Validar pagos anticipados.  
* Confirmar la liquidación operativa de pedidos.  
* Gestionar adelantos de combustible mediante autorización humana.  
* Realizar ajustes autorizados de precios y tarifas.  
* Activar o desactivar temporalmente sucursales.  
* Resolver excepciones operativas.  
* Consultar reportes operativos globales.

Restricciones:

* No puede crear usuarios ni asignar roles.  
* No puede modificar las reglas globales reservadas al Administrador.  
* No puede cambiar libremente las configuraciones generales.  
* No puede eliminar definitivamente registros financieros o de auditoría.

## **3.3. Encargado del restaurante o sucursal**

Es responsable de la preparación y despacho físico de los pedidos de su sucursal.

Funciones:

* Aceptar o rechazar pedidos.  
* Iniciar la preparación.  
* Marcar pedidos como listos.  
* Registrar la entrega física al repartidor.  
* Administrar la disponibilidad de los productos de su sucursal.  
* Crear productos y promociones dentro de los permisos establecidos.  
* Gestionar precios de productos de su sucursal según las reglas autorizadas.  
* Confirmar la recepción física de pedidos devueltos.

Restricciones:

* No puede asignar ni reasignar repartidores.  
* No puede acceder al mapa global de repartidores.  
* No puede cambiar reglas generales de la plataforma.  
* Su acceso a información de otras sucursales está restringido.

## **3.4. Empleado de atención al cliente**

Es responsable de la atención, el seguimiento y el soporte al cliente.

Funciones:

* Consultar el estado de los pedidos.  
* Consultar el historial individual de los clientes según permisos.  
* Registrar reclamos y notas.  
* Informar incidencias al Coordinador.  
* Validar comprobantes de Yape y transferencias.  
* Ejecutar el flujo humano autorizado de pago al restaurante y liberación del pedido.  
* Asignar repartidores manualmente dentro de sus permisos.  
* Participar en las comunicaciones de WhatsApp.  
* Gestionar incidencias de atención.

Restricciones:

* No puede modificar las reglas financieras globales.  
* No puede cambiar los saldos de garantía por decisión propia.  
* No puede eliminar registros financieros.  
* No puede acceder a reportes financieros globales.  
* No puede asignar roles ni administrar usuarios.

## **3.5. Repartidor**

Es responsable de retirar y entregar los pedidos que le han sido asignados.

Funciones:

* Consultar sus pedidos asignados.  
* Ver la dirección, productos, instrucciones y datos necesarios para la entrega.  
* Confirmar que se encuentra cerca del restaurante.  
* Confirmar la salida del pedido.  
* Marcar la entrega como exitosa o fallida.  
* Registrar el dinero cobrado en efectivo.  
* Consultar su saldo de garantía y sus liquidaciones.  
* Registrar incidencias de entrega.  
* Calificar al cliente después de la atención, según las reglas del sistema.

Restricciones:

* No puede consultar pedidos de otros repartidores.  
* No puede reasignar pedidos.  
* No puede consultar las ventas globales.  
* No puede modificar precios ni tarifas.  
* No puede modificar sus propios saldos financieros.  
* Solo ve datos personales del cliente cuando son necesarios para sus entregas asignadas.

---

# **4\. Matriz general de permisos**

| Acción | Administrador | Coordinador | Encargado | Empleado | Repartidor |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Crear usuarios y asignar roles | Sí | No | No | No | No |
| Crear restaurantes y sucursales | Sí | No | No | No | No |
| Activar/desactivar temporalmente sucursales | Sí | Sí, según permisos | No | No | No |
| Consultar operaciones de todas las sucursales | Sí | Sí, operativamente | No | Según permisos de soporte | No |
| Crear productos | Sí | Sí | Sí, según permisos | No definido; no autorizado por defecto | No |
| Gestionar disponibilidad de productos | Sí | Sí | Sí, en su sucursal | No | No |
| Crear promociones | Sí | Sí | Sí, según reglas | No | No |
| Aceptar o rechazar pedidos | Sí | Sí | Sí | No definido; no autorizado por defecto | No |
| Iniciar preparación | Intervención autorizada | Supervisión | Sí | No | No |
| Asignar repartidores | Sí | Sí | No | Sí, manualmente y con permisos | No |
| Validar pagos anticipados | Sí | Sí | No por defecto | Sí | No |
| Gestionar excepciones operativas | Sí | Sí, dentro de sus límites | Limitado a su función | Limitado a soporte | No |
| Gestionar devoluciones | Sí | Sí | Confirma recepción física | Registra el caso | Registra el retorno |
| Consultar reportes globales | Sí | Operativos | No | No | No |
| Consultar reportes de sucursal | Sí | Sí | Operativos y de cuadre según permisos | Individuales de soporte | Propios |
| Modificar reglas globales | Sí | No | No | No | No |
| Corregir registros de pago | Sí | Sí, con motivo y auditoría | No | No | No |
| Eliminar definitivamente auditorías | No permitido | No permitido | No permitido | No permitido | No permitido |

**Regla general:** los permisos deberán aplicarse en el servidor, no solamente ocultando botones en la interfaz.

Las acciones sensibles deberán registrarse en auditoría. La autorización específica de cada operación deberá comprobarse antes de ejecutarla.

---

# **5\. Catálogo, productos, precios y sucursales**

## **5.1. Gestión de restaurantes y sucursales**

El sistema permitirá registrar varios restaurantes y sus sucursales.

El Administrador podrá:

* Crear restaurantes.  
* Crear sucursales.  
* Definir datos generales.  
* Configurar horarios.  
* Configurar reglas generales de cobertura.  
* Administrar usuarios autorizados.

El Coordinador podrá activar o desactivar temporalmente una sucursal dentro de sus permisos.

## **5.2. Gestión del catálogo**

El sistema permitirá:

* Crear y editar productos.  
* Activar o desactivar productos.  
* Organizar productos por categorías.  
* Asociar imágenes.  
* Configurar precios.  
* Configurar modificadores.  
* Marcar productos como frágiles o sensibles.  
* Gestionar disponibilidad por sucursal.  
* Crear cartas dinámicas.

**Decisión aprobada:** el Administrador, Coordinador y Encargado pueden crear productos, con permisos diferenciados.

La eliminación definitiva de productos deberá evitarse cuando existan pedidos o registros históricos asociados. Se recomienda desactivar o archivar el producto conservando su historial.

## **5.3. Precios y disponibilidad**

El Administrador define las reglas generales.

El Coordinador puede realizar ajustes autorizados dentro de esas reglas.

El Encargado administra la disponibilidad y puede gestionar precios de su sucursal dentro de sus permisos.

El precio aplicado a un pedido deberá conservarse como una copia histórica del precio vigente al momento de la compra, para evitar que una modificación posterior altere pedidos anteriores.

## **5.4. Modificadores**

El sistema permitirá opciones adicionales como tamaño, acompañamiento, ingredientes y otros modificadores.

El precio final deberá recalcularse según los modificadores seleccionados.

## **5.5. Promociones**

**Decisión aprobada:** Administrador, Coordinador y Encargado podrán crear promociones con permisos diferenciados.

El Administrador establecerá las reglas que determinen los límites de cada rol.

Las promociones podrán incluir descuentos, cupones, combos y programación por fechas o sucursales.

---

# **6\. Gestión de pedidos**

## **6.1. Canales de entrada**

Los pedidos podrán recibirse mediante:

* La plataforma web/PWA.  
* WhatsApp, cuando la integración esté habilitada.  
* Vocero CRM, cuando la integración esté validada.  
* Registro manual por personal autorizado.

Los clientes podrán realizar compras con cuenta, como invitados o mediante los canales de WhatsApp autorizados.

## **6.2. Información mínima del pedido**

Cada pedido deberá registrar:

* Identificador único.  
* Fecha y hora de creación.  
* Restaurante y sucursal.  
* Cliente y datos de contacto necesarios.  
* Dirección de entrega.  
* Productos, cantidades y modificadores.  
* Precios aplicados.  
* Descuentos.  
* Costo de entrega.  
* Importe total.  
* Método de pago.  
* Estado operativo.  
* Estado de pago.  
* Repartidor asignado, cuando corresponda.  
* Historial de cambios.  
* Observaciones e incidencias.

Los costos internos, márgenes y desgloses no deberán mostrarse al cliente salvo que una configuración comercial aprobada lo requiera.

## **6.3. Aceptación del pedido**

**Decisión aprobada:**

* El Encargado y el Coordinador pueden aceptar o rechazar pedidos.  
* El tiempo límite para aceptar un pedido será configurable por el Administrador.  
* Si el restaurante no responde, el sistema alerta al Coordinador.  
* El Coordinador decide cómo proceder; no se cancelará automáticamente solo por falta de respuesta.

## **6.4. Preparación**

El Encargado inicia la preparación después de aceptar el pedido.

En el caso de pagos anticipados, la preparación puede comenzar mientras el pago está pendiente de validación, pero el pedido no podrá salir para entrega hasta cumplir las condiciones de liberación.

## **6.5. Falta de producto o capacidad**

Si falta un producto o el restaurante no puede atender el pedido:

1. El Encargado registra el motivo.  
2. El sistema informa al cliente y al Coordinador.  
3. El cliente decide si acepta un reemplazo o cancela el producto afectado.  
4. Si el cliente acepta el reemplazo, se registra su decisión y cualquier diferencia de precio.  
5. El resto del pedido continúa cuando sea posible.

La cancelación de un producto no implica cancelar automáticamente todo el pedido.

## **6.6. Cambio de dirección**

Si el cliente solicita un cambio de dirección:

1. Se recalcula el costo de entrega.  
2. Se comunica el costo adicional al cliente.  
3. Se espera su aceptación antes de continuar con el nuevo costo.  
4. Si el cliente no acepta, se detiene el cambio de destino.  
5. El Coordinador resuelve la incidencia y determina el retorno o la siguiente acción conforme a las reglas autorizadas.

## **6.7. Estados operativos**

Se propone la siguiente secuencia:

1. Nuevo.  
2. Confirmado.  
3. En preparación.  
4. Listo.  
5. Repartidor asignado.  
6. Repartidor cerca del punto de retiro.  
7. En camino.  
8. Entregado.

Estados alternativos:

* Rechazado.  
* Cancelación solicitada.  
* Cancelado.  
* Entrega fallida.  
* Devolución pendiente.  
* Devuelto al restaurante.  
* Pendiente de resolución.

Los estados deberán tener transiciones permitidas. No todos los roles podrán ejecutar todas las transiciones.

## **6.8. Estado operativo y estado financiero**

El estado operativo y el estado del pago deberán ser independientes.

Ejemplos:

* Un pedido puede estar en preparación y tener un pago anticipado pendiente.  
* Un pedido puede estar listo, pero no estar autorizado para despacho.  
* Un pedido puede estar entregado y tener una liquidación pendiente.  
* Un pedido puede estar cancelado y tener una devolución pendiente.

Esta separación evita que el estado de pago se confunda con la preparación o la entrega.

## **6.9. Tablero Kanban**

El tablero Kanban mostrará los pedidos según su estado operativo.

Deberá permitir visualizar los pedidos nuevos, en preparación, listos, asignados, en camino, entregados, fallidos y cancelados, según los permisos del usuario.

Las transiciones deberán realizarse mediante acciones autorizadas y quedar registradas.

---

# **7\. Pagos y liberación de pedidos**

## **7.1. Métodos de pago de la primera versión**

**Decisión aprobada:** la primera versión contempla:

* Efectivo.  
* Yape.  
* Transferencia bancaria.

Las tarjetas no forman parte de los métodos confirmados para esta primera versión.

## **7.2. Pagos anticipados**

Para Yape y transferencias:

1. El cliente realiza el pago.  
2. El sistema registra el pago como pendiente.  
3. El cliente o el canal correspondiente proporciona el comprobante cuando sea necesario.  
4. El Empleado o Coordinador verifica el comprobante.  
5. El usuario autorizado registra el resultado.  
6. El pedido podrá despacharse cuando el pago esté confirmado y se haya confirmado también el pago correspondiente al restaurante.

El sistema no deberá considerar pagado un pedido solamente porque se haya cargado una imagen de comprobante.

## **7.3. Pedidos contra entrega**

Para efectivo:

1. El pedido se prepara.  
2. El pago al restaurante se confirma antes de la salida del repartidor.  
3. El repartidor recibe la asignación y los datos necesarios.  
4. El repartidor cobra al cliente en el momento de la entrega.  
5. El cobro se registra.  
6. Se aplica la regla de liquidación y garantía correspondiente.

## **7.4. Regla de liberación**

**Decisión aprobada:** la liberación operativa del pedido está separada de la preparación y del pago del cliente.

Antes de salir, deben cumplirse las condiciones correspondientes:

* Para Yape o transferencia: el pago anticipado debe estar validado.  
* Para efectivo: el pedido se entrega al repartidor con el cobro pendiente al cliente.  
* En ambos casos: el pago correspondiente al restaurante debe estar confirmado antes del despacho.  
* El repartidor debe estar asignado y habilitado para el pedido.

El sistema deberá registrar quién autorizó la liberación y cuándo ocurrió.

## **7.5. Corrección de pagos**

El Coordinador o Administrador podrá corregir un registro de pago, siempre que:

* Tenga permisos suficientes.  
* Indique el motivo.  
* Se registre el valor anterior y el nuevo.  
* Se conserve el historial de la operación.

No se permitirá borrar el registro original para ocultar una corrección.

## **7.6. Devoluciones al cliente**

**Decisión aprobada:** el Coordinador autoriza y gestiona las devoluciones manualmente.

El sistema registrará el motivo, el importe, la autorización, la fecha, el responsable y la confirmación de la devolución.

El método concreto de devolución deberá definirse en el procedimiento operativo. No se presume que exista una API de reembolso automatizado para Yape o transferencias.

---

# **8\. Margen, tarifas y reglas comerciales**

## **8.1. Margen de Zero Delivery**

El margen se calculará por producto.

El Administrador configurará si se utiliza:

* Un importe fijo.  
* Un porcentaje.

Los valores exactos no se han establecido.

La fórmula definitiva deberá definir claramente:

* La base sobre la que se aplica el porcentaje.  
* El tratamiento de descuentos.  
* El tratamiento de modificadores.  
* El tratamiento de envases.  
* El tratamiento de impuestos.  
* Si existen excepciones por producto.

No deberá implementarse una fórmula financiera definitiva hasta que estas bases estén aprobadas.

## **8.2. Tarifa de entrega**

La tarifa de entrega se calculará mediante reglas configurables que consideren:

* Distancia.  
* Zona de cobertura.  
* Tipo de vehículo.  
* Condiciones particulares del servicio.

El Administrador define las reglas y el Coordinador puede realizar ajustes autorizados.

## **8.3. Pérdidas e incidencias económicas**

**Decisión aprobada:** la responsabilidad se determina según las evidencias y el motivo de la incidencia.

El sistema registrará:

* Pedido relacionado.  
* Descripción del incidente.  
* Evidencias disponibles.  
* Responsable de la revisión.  
* Decisión adoptada.  
* Importe, si corresponde.  
* Justificación.  
* Historial de cambios.

No se deberá cargar automáticamente una pérdida a un repartidor, restaurante o Coordinador sin registrar y justificar la decisión.

---

# **9\. Repartidores y logística**

## **9.1. Asignación**

La asignación combinará:

* Asignación automática conforme a reglas autorizadas.  
* Asignación manual por el Coordinador.  
* Asignación manual por el Empleado dentro de sus permisos.  
* Participación del bot cuando esté autorizado y la integración lo permita.

El sistema podrá proponer repartidores en función de su confianza y disponibilidad.

La fórmula exacta de selección está pendiente de definición.

## **9.2. Confianza del repartidor**

La puntuación de confianza considerará:

* Entregas completadas.  
* Puntualidad.  
* Calificaciones.  
* Incidentes.  
* Deudas pendientes.

Los pesos de estos factores todavía deben definirse.

La puntuación no deberá convertirse automáticamente en una sanción económica sin una regla explícita.

## **9.3. Geolocalización**

**Decisión aprobada:** la ubicación del repartidor se compartirá manualmente cuando sea necesario.

La primera versión no asumirá que existe seguimiento GPS permanente disponible para todos los roles y dispositivos.

El cliente consultará los estados de su pedido, pero no verá la ubicación GPS del repartidor.

El Administrador y el personal autorizado podrán consultar los datos operativos permitidos, conforme a los permisos establecidos y a las capacidades técnicas disponibles.

## **9.4. Tiempo de espera en el restaurante**

El repartidor esperará hasta 15 minutos en el restaurante.

El sistema podrá registrar la llegada y calcular el tiempo transcurrido.

La regla posterior a esos 15 minutos —alerta, reasignación o tratamiento de compensaciones— requiere definición operativa adicional.

## **9.5. Estados del repartidor**

Estados generales:

* Disponible.  
* Ocupado.  
* En camino.  
* Fuera de servicio.

Estados logísticos asociados a un pedido:

* Repartidor cerca del punto de retiro.  
* En camino.  
* Entregado.  
* Entrega fallida.

Los estados del repartidor y los del pedido no deberán confundirse.

---

# **10\. Garantías, adelantos y liquidaciones**

## **10.1. Configuración de garantía**

El Administrador configurará:

* Monto de garantía.  
* Edad mínima.  
* Nivel de confianza requerido.  
* Condiciones de excepción.  
* Reglas de habilitación para pedidos contra entrega.

Los valores numéricos aún no están definidos.

## **10.2. Pedidos en efectivo**

Si la garantía no alcanza el mínimo requerido, el sistema bloqueará la asignación de nuevos pedidos contra entrega.

El bloqueo deberá distinguirse de la disponibilidad del repartidor para pedidos que no requieren cobro en efectivo.

## **10.3. Excepciones por edad y confianza**

Las excepciones se determinarán mediante reglas configurables por el Administrador.

El sistema deberá registrar qué condición permitió la excepción y qué usuario o regla la autorizó.

## **10.4. Registro del dinero cobrado**

Cuando el repartidor cobra efectivo:

1. Registra la entrega y el importe cobrado.  
2. El sistema registra la obligación de liquidar ese dinero.  
3. Se aplica el ajuste de garantía cuando corresponda.  
4. Se conserva el historial de la operación.

El cobro al cliente no deberá confundirse con un ingreso de Zero Delivery: el dinero puede corresponder al restaurante, a la tarifa de entrega o a otros conceptos comerciales que deben distinguirse.

## **10.5. Liquidaciones**

**Decisión aprobada:** las liquidaciones de repartidores serán diarias.

Se conserva como regla del documento original el corte de las 11:00 p. m., sujeto a confirmar el procedimiento operativo definitivo.

## **10.6. Adelantos de combustible**

Los adelantos:

* Requieren intervención humana del Coordinador o Empleado autorizado.  
* Se registran en el sistema.  
* Pueden basarse en confianza o en autorización del Coordinador.  
* No se pagan automáticamente por el sistema.  
* Se descuentan de la siguiente liquidación diaria.

## **10.7. Deudas**

Si el repartidor tiene una deuda que no puede cubrir con la garantía disponible, se bloquearán nuevos pedidos contra entrega hasta regularizarla.

El sistema mostrará el importe pendiente y el motivo del bloqueo.

La regularización deberá quedar registrada.

---

# **11\. Entregas fallidas, devoluciones y cancelaciones**

## **11.1. Entregas fallidas**

El sistema registrará:

* Motivo de la entrega fallida.  
* Fecha y hora.  
* Observaciones.  
* Evidencias disponibles.  
* Repartidor responsable.  
* Intento de entrega.  
* Resolución del Coordinador.

La fotografía será opcional cuando sea posible obtenerla sin recopilar datos personales innecesarios.

## **11.2. Número de intentos**

**Decisión aprobada:** se permiten hasta dos intentos de entrega.

El segundo intento requiere autorización del Coordinador.

Si el segundo intento también falla, el pedido queda pendiente de resolución. El Coordinador decide el cierre y los pasos posteriores.

No se programará automáticamente un tercer intento.

## **11.3. Retorno al restaurante**

Cuando el repartidor regresa con el pedido:

1. Se registra como devolución pendiente.  
2. El Encargado confirma la recepción física.  
3. El Coordinador revisa el caso.  
4. El Coordinador decide si corresponde un nuevo intento autorizado o el cierre del pedido.  
5. Se registran las consecuencias operativas y financieras aplicables.

## **11.4. Cancelaciones**

El cliente puede solicitar la cancelación conforme al estado del pedido y las reglas autorizadas.

El Coordinador autoriza la cancelación operativa según las reglas aplicables. El Administrador puede intervenir en casos críticos.

Si la preparación ya comenzó, el Coordinador revisará el caso y aplicará las reglas configuradas. Cualquier cobro deberá estar justificado y comunicarse al cliente.

Los permisos exactos para iniciar una cancelación desde cada interfaz deberán definirse en la matriz detallada de transiciones.

---

# **12\. Clientes, historial, calificaciones y reclamos**

## **12.1. Registro de clientes**

El sistema admitirá:

* Clientes registrados.  
* Compras como invitado.  
* Pedidos recibidos por WhatsApp.

Se evitarán registros duplicados mediante mecanismos de identificación y validación adecuados.

## **12.2. Historial**

El historial incluirá:

* Pedidos.  
* Fechas.  
* Productos.  
* Importes.  
* Métodos de pago.  
* Estados.  
* Calificaciones relacionadas.

El acceso estará limitado según el rol y la necesidad operativa.

## **12.3. Calificaciones**

Se permitirá calificar:

* El restaurante o la comida.  
* El repartidor.  
* El cliente, por parte del repartidor, conforme a las reglas del sistema.

La confianza del repartidor utilizará las calificaciones junto con los demás factores definidos.

La conversión exacta de número de pedidos a estrellas del documento original deberá revisarse antes de implementarse como regla definitiva.

## **12.4. Reclamos**

El Coordinador gestiona los reclamos.

El Empleado puede recibirlos, registrarlos y comunicarlos.

El sistema conservará el motivo, la resolución, el responsable y las comunicaciones relevantes.

---

# **13\. Vocero CRM, chatbot, WhatsApp y notificaciones**

## **13.1. Alcance del bot**

El bot podrá:

* Responder preguntas frecuentes.  
* Mostrar el menú.  
* Recopilar pedidos.  
* Consultar estados de pedidos.  
* Enviar notificaciones operativas.  
* Participar en la asignación de repartidores bajo reglas autorizadas.

Las acciones sensibles requerirán autorización humana.

## **13.2. Integración con Vocero CRM**

La integración se plantea mediante API y webhooks para intercambiar, según las capacidades disponibles:

* Clientes.  
* Pedidos.  
* Estados.  
* Notificaciones.  
* Eventos operativos.

**Pendiente:** verificar la documentación real de Vocero CRM, los endpoints, el sistema de autenticación, los eventos disponibles y las limitaciones de uso.

No se considera confirmada ninguna función de la API hasta verificarla.

## **13.3. Fallos de integración**

Cuando la integración falle, Zero Delivery deberá:

1. Mantener las operaciones internas que puedan continuar de forma segura.  
2. Registrar el error.  
3. Alertar al personal correspondiente.  
4. Reintentar los envíos cuando proceda.  
5. Evitar que los reintentos creen pedidos o pagos duplicados.  
6. Permitir revisar los eventos que no se pudieron procesar.

## **13.4. Eventos duplicados**

La integración deberá implementar mecanismos de idempotencia o deduplicación para impedir que un evento repetido genere dos pedidos, dos pagos o cambios de estado duplicados.

## **13.5. WhatsApp**

Se automatizarán mensajes operativos autorizados, respetando las preferencias y los requisitos aplicables.

Los mensajes podrán informar sobre:

* Confirmación del pedido.  
* Cambios de estado.  
* Pago pendiente o validado.  
* Pedido listo.  
* Asignación del repartidor.  
* Retrasos.  
* Cancelaciones.  
* Entregas fallidas.  
* Resoluciones y devoluciones.

La entrega efectiva de mensajes dependerá del proveedor y de las capacidades verificadas de la integración.

---

# **14\. Dashboard, reportes y exportaciones**

## **14.1. Dashboard**

El panel mostrará, según el rol:

* Cantidad de pedidos.  
* Ventas e importes autorizados.  
* Pedidos en preparación.  
* Pedidos listos.  
* Pedidos en camino.  
* Entregas completadas.  
* Entregas fallidas.  
* Cancelaciones.  
* Demoras.  
* Tiempos de preparación.  
* Calificaciones.  
* Clientes nuevos y recurrentes.  
* Alertas operativas.

## **14.2. Reportes**

Se conservarán las cuatro áreas del documento original:

* RF-15: reportes financieros y ventas.  
* RF-16: reportes operativos y logísticos.  
* RF-17: reportes de clientes.  
* RF-18: embudo de conversión digital.

## **14.3. Acceso a reportes**

**Administrador:** reportes globales, finanzas y embudo de conversión.

**Coordinador:** reportes operativos globales, según sus permisos.

**Encargado:** reportes operativos y de su sucursal. El acceso a ventas de su sucursal deberá confirmarse y definirse expresamente, debido a la contradicción existente en el documento original.

**Empleado:** información individual necesaria para atender a un cliente, sin reportes macro.

**Repartidor:** métricas personales de entregas, calificaciones, incidencias y garantía.

## **14.4. Exportación**

Se contemplan exportaciones en:

* CSV.  
* Excel.  
* PDF.

Los permisos de exportación deberán respetar los permisos de lectura del usuario.

---

# **15\. Alertas, auditoría y búsqueda**

## **15.1. Alertas operativas**

El sistema deberá generar alertas para:

* Nuevos pedidos.  
* Pedidos sin respuesta del restaurante.  
* Pedidos demorados.  
* Falta de repartidor.  
* Pagos pendientes.  
* Entregas fallidas.  
* Cancelaciones.  
* Garantía insuficiente.  
* Deudas pendientes.  
* Fallos de integración.  
* Calificaciones bajas.  
* Incidencias relevantes.

Los tiempos de alerta serán configurables cuando corresponda.

## **15.2. Auditoría**

Se registrarán las operaciones importantes, incluyendo:

* Inicios de sesión y eventos relevantes de seguridad.  
* Cambios de permisos.  
* Creación y modificación de productos.  
* Cambios de precios y tarifas.  
* Promociones.  
* Pagos y correcciones.  
* Liberaciones de pedidos.  
* Asignaciones y reasignaciones.  
* Cambios de estado.  
* Liquidaciones.  
* Garantías y adelantos.  
* Cancelaciones y devoluciones.  
* Cambios de configuración.

Los registros deberán permitir identificar al actor, la fecha y hora, la acción y el objeto afectado.

## **15.3. Búsqueda**

Se permitirán filtros por:

* Pedido.  
* Cliente.  
* Sucursal.  
* Estado.  
* Método de pago.  
* Repartidor.  
* Fecha.  
* Incidencia.

Los resultados respetarán las restricciones de acceso.

---

# **16\. Requisitos funcionales RF-01 a RF-32**

La siguiente lista conserva la numeración del documento original y establece el alcance consolidado.

| Código | Requisito consolidado |
| ----- | ----- |
| RF-01 | Autenticación y acceso según roles. |
| RF-02 | Dashboard con métricas según permisos. |
| RF-03 | Monitoreo de sucursales, productos y alertas. |
| RF-04 | Registro, consulta y gestión de pedidos. |
| RF-05 | Trazabilidad con historial y validación de pagos anticipados. |
| RF-06 | Administración de repartidores, vehículos, confianza y calificaciones. |
| RF-07 | Seguimiento logístico y visibilidad por rol; ubicación compartida manualmente en la primera versión. |
| RF-08 | Gestión del catálogo de productos, imágenes, categorías y disponibilidad. |
| RF-09 | Modificadores y recálculo de precios. |
| RF-10 | Horarios y turnos por sucursal. |
| RF-11 | Zonas, cobertura, vehículos y tarifas de entrega. |
| RF-12 | Gestión de clientes, preferencias y controles de seguridad autorizados. |
| RF-13 | Historial de compras. |
| RF-14 | Reseñas y calificaciones de restaurantes, repartidores y clientes. |
| RF-15 | Reportes de ventas y finanzas. |
| RF-16 | Reportes operativos y logísticos. |
| RF-17 | Reportes e historial de clientes. |
| RF-18 | Embudo de conversión digital. |
| RF-19 | Métodos de pago y estados financieros. |
| RF-20 | Garantías, adelantos, deudas y liquidaciones de repartidores. |
| RF-21 | Gestión de promociones, cupones y combos. |
| RF-22 | Requisito original sin descripción independiente suficientemente clara; requiere definición. |
| RF-23 | Integración con Vocero CRM mediante API/webhooks, según disponibilidad verificada. |
| RF-24 | Chatbot y menú interactivo. |
| RF-25 | Consulta del estado del pedido mediante chatbot. |
| RF-26 | Notificaciones automáticas de estados. |
| RF-27 | Captura y sincronización de datos para reducir duplicados. |
| RF-28 | Tablero Kanban de pedidos. |
| RF-29 | Alertas operativas. |
| RF-30 | Búsqueda y filtros avanzados. |
| RF-31 | Historial de actividades y auditoría. |
| RF-32 | Exportación de reportes en CSV, Excel y PDF. |

La descripción detallada y la trazabilidad de cada requisito deberán mantenerse en el catálogo de requisitos del proyecto. La tabla anterior no reemplaza la necesidad de revisar el texto oficial de cada RF.

---

# **17\. Requisitos no funcionales RNF-01 a RNF-20**

El documento original agrupa los RNF por áreas. La siguiente clasificación conserva su intención sin inventar métricas numéricas que todavía no han sido aprobadas.

## **RNF-01 a RNF-03: Usabilidad y experiencia**

* Interfaz sencilla.  
* Navegación comprensible para los distintos roles.  
* Formularios con validaciones y mensajes de error claros.  
* Acciones operativas fáciles de localizar.

## **RNF-04 a RNF-05: Diseño adaptable y rendimiento**

* Interfaz responsive para computadoras y teléfonos.  
* Rendimiento adecuado durante las horas operativas.  
* Consultas y actualizaciones eficientes.  
* Prevención de duplicaciones por envíos repetidos.

Los tiempos concretos de respuesta quedan pendientes de aprobación.

## **RNF-06 a RNF-07: Disponibilidad y seguridad**

* Disponibilidad adecuada durante los horarios operativos.  
* Autenticación.  
* Autorización por rol.  
* Protección de credenciales.  
* Protección de operaciones financieras.

## **RNF-08 a RNF-10: Privacidad, escalabilidad e integración**

* Acceso a datos personales según la función.  
* Arquitectura preparada para varios restaurantes y sucursales.  
* Integración segura mediante API y webhooks cuando estén disponibles.  
* Gestión de errores de integración.

## **RNF-11 a RNF-13: Mantenibilidad y auditoría**

* Código modular.  
* Historial de operaciones importantes.  
* Manejo seguro de errores.  
* Correcciones sin borrar la trazabilidad histórica.

## **RNF-14 a RNF-16: Recuperación y copias de seguridad**

* Copias de seguridad automáticas.  
* Copias manuales autorizadas.  
* Procedimiento de recuperación.  
* Protección de las copias.

La frecuencia, retención y objetivos de recuperación deberán definirse antes de producción.

## **RNF-17 a RNF-18: Localización peruana**

* Interfaz en español.  
* Moneda en soles (S/).  
* Formatos de fecha apropiados para Perú.  
* Validaciones de datos adaptadas al contexto local.

## **RNF-19 a RNF-20: Consistencia y accesibilidad**

* Experiencia coherente entre pantallas.  
* Diseño usable en distintos tamaños de pantalla.  
* Estados operativos claros.  
* Accesibilidad y legibilidad adecuadas.

Los objetivos medibles de rendimiento, disponibilidad, seguridad y recuperación deberán añadirse en una revisión posterior.

---

# **18\. Los 12 módulos del sistema**

## **Módulo 1\. Autenticación y usuarios**

Funciones: inicio de sesión, gestión de permisos, roles y auditoría.

Requisitos asociados: RF-01 y RF-31.

## **Módulo 2\. Dashboard y monitoreo**

Funciones: métricas operativas, disponibilidad, retrasos y alertas.

Requisitos asociados: RF-02, RF-03 y RF-29.

## **Módulo 3\. Gestión de pedidos**

Funciones: creación, modificación autorizada, estados, pagos relacionados, trazabilidad y Kanban.

Requisitos asociados: RF-04, RF-05 y RF-28.

## **Módulo 4\. Delivery y logística**

Funciones: perfiles de repartidores, asignación, seguimiento, entregas y devoluciones.

Requisitos asociados: RF-06 y RF-07.

## **Módulo 5\. Finanzas y garantías**

Funciones: pagos, garantías, adelantos, deudas y liquidaciones.

Requisitos asociados: RF-19 y RF-20.

## **Módulo 6\. Catálogo y menú**

Funciones: productos, precios, modificadores, categorías e imágenes.

Requisitos asociados: RF-08 y RF-09.

## **Módulo 7\. Clientes y CRM interno**

Funciones: perfiles, historial, preferencias y segmentación autorizada.

Requisitos asociados: RF-12 y RF-13.

## **Módulo 8\. Reseñas y calificaciones**

Funciones: calificaciones del restaurante, repartidor y cliente.

Requisitos asociados: RF-06 y RF-14.

## **Módulo 9\. Analítica y reportes**

Funciones: reportes financieros, operativos, de clientes y de conversión.

Requisitos asociados: RF-15, RF-16, RF-17, RF-18 y RF-32.

## **Módulo 10\. Configuración operativa**

Funciones: horarios, sucursales, zonas, cobertura y tarifas.

Requisitos asociados: RF-10 y RF-11.

## **Módulo 11\. Marketing y promociones**

Funciones: promociones, cupones, combos y campañas autorizadas.

Requisitos asociados: RF-21 y RF-22, sujeto a definir RF-22.

## **Módulo 12\. Integración y omnicanalidad**

Funciones: integración con Vocero CRM, chatbot, WhatsApp, notificaciones y sincronización de datos.

Requisitos asociados: RF-23 a RF-27.

---

# **19\. Decisiones aprobadas durante las partes 1–17**

Las siguientes decisiones son parte de la nueva especificación de trabajo. No deben atribuirse al documento original cuando este no las contenía expresamente.

## **19.1. Plataforma y modelo**

* Plataforma inicial: PWA.  
* Modelo: múltiples restaurantes y sucursales.  
* Idioma: español de Perú.  
* Moneda: soles.  
* Tecnología propuesta: Next.js, TypeScript y PostgreSQL.

## **19.2. Roles y operaciones**

* El Coordinador tiene acceso operativo global.  
* El Administrador conserva el control general.  
* Encargado y Coordinador aceptan o rechazan pedidos.  
* El Encargado inicia la preparación.  
* El Empleado puede asignar repartidores manualmente dentro de sus permisos.  
* El bot puede participar en la asignación bajo reglas autorizadas.  
* El tiempo de aceptación del restaurante es configurable.

## **19.3. Pedidos y pagos**

* Métodos de pago iniciales: efectivo, Yape y transferencia.  
* Preparación permitida mientras se valida un pago anticipado.  
* Los pagos anticipados deben validarse antes del despacho.  
* El pago correspondiente al restaurante debe confirmarse antes de la salida.  
* Las incidencias por productos faltantes se comunican al cliente y al Coordinador.  
* El cliente decide si acepta un reemplazo o cancela el producto afectado.  
* Un cambio de dirección requiere aceptar el costo adicional.  
* El segundo intento de entrega requiere autorización del Coordinador.  
* El retorno al restaurante requiere confirmación del Encargado.

## **19.4. Finanzas**

* Margen por producto: importe fijo o porcentaje.  
* Garantía configurable por el Administrador.  
* La confianza incluye entregas, puntualidad, calificaciones, incidentes y deudas.  
* La garantía insuficiente bloquea nuevos pedidos contra entrega.  
* Las liquidaciones son diarias.  
* Los adelantos se descuentan de la siguiente liquidación.  
* Las devoluciones son gestionadas manualmente por el Coordinador.  
* Las pérdidas se asignan según evidencias y motivo.

## **19.5. Integración**

* El bot responde preguntas frecuentes, recopila pedidos y notifica estados.  
* Las acciones sensibles requieren intervención humana.  
* La integración se plantea mediante API y webhooks.  
* Los eventos repetidos no deben duplicar operaciones.  
* Los fallos de integración deben registrarse y generar alertas.  
* La ubicación del repartidor se comparte manualmente.  
* El cliente consulta estados del pedido, no la ubicación GPS.

## **19.6. Seguridad y control**

* Las correcciones de pago requieren motivo y auditoría.  
* Las excepciones operativas deben respetar los permisos.  
* Las reglas globales corresponden al Administrador.  
* Los registros financieros y de auditoría no se borran definitivamente.  
* Cada rol accede solo a los datos personales necesarios.  
* Cada versión de la especificación debe aprobarse explícitamente.

---

# **20\. Contradicciones entre el documento original y la especificación consolidada**

| Tema | Documento original | Decisión consolidada | Acción necesaria |
| ----- | ----- | ----- | ----- |
| Alcance del Coordinador | Se describe como limitado a una sucursal en partes del documento | Acceso operativo global | Actualizar la matriz de permisos consolidada |
| GPS | Seguimiento GPS activo en tiempo real | Ubicación compartida manualmente | Ajustar alcance del RF-07 |
| Pagos del Empleado | RF-07 limita las acciones financieras; la matriz permite validar comprobantes | El Empleado puede validar comprobantes y participar en la liberación autorizada | Definir límites exactos y auditoría |
| Creación de productos | RF-08 atribuye la administración al Administrador; la matriz limita al Coordinador | Administrador, Coordinador y Encargado pueden crear con permisos diferenciados | Revisar RF-08 y matriz |
| Creación de promociones | El documento original menciona la creación por restaurante y el control global | Administrador, Coordinador y Encargado pueden crear dentro de reglas | Definir límites por rol |
| Estados de pedido | RF-04 y RF-05 no usan exactamente la misma lista | Se separan estados operativos, financieros y de devolución | Aprobar catálogo final de estados |
| Reportes del Encargado | RF-15–RF-18 contempla ventas por sucursal; la matriz limita reportes financieros | Se mantiene como pendiente el acceso financiero exacto | Confirmar permisos de reportes |
| Garantía y edad | El original incluye una excepción asociada a mayores de 35 años o alta confianza | Edad, confianza y monto serán configurables | Definir valores y condiciones |
| Margen | No queda definida una fórmula comercial completa | Importe fijo o porcentaje por producto | Definir base de cálculo |
| RF-22 | Se menciona sin descripción independiente clara | No se inventa su contenido | Definir o retirar mediante aprobación |
| Integración | Se contempla API/webhooks oficiales | Depende de validar la API real de Vocero CRM | Revisar documentación técnica |

**Regla de control:** una contradicción no se considera resuelta solo porque se haya redactado una nueva frase. La nueva regla debe ser aprobada y reflejada en la versión consolidada.

---

# **21\. Decisiones pendientes**

Las siguientes cuestiones deberán resolverse antes de considerar completa la especificación para producción.

## **21.1. Finanzas y reglas comerciales**

* Definir el monto mínimo de garantía.  
* Definir la edad mínima y el nivel de confianza exigido.  
* Definir la fórmula y ponderaciones de confianza.  
* Definir la base exacta del margen porcentual.  
* Definir el tratamiento de impuestos, envases, descuentos y tarifas.  
* Definir el procedimiento contable de las pérdidas.  
* Definir el alcance de los acuerdos comerciales por producto.  
* Definir el procedimiento de conciliación del dinero cobrado por repartidores.

## **21.2. Pedidos y permisos**

* Definir el catálogo definitivo de estados.  
* Definir las transiciones permitidas por rol.  
* Definir el acceso del Encargado a reportes financieros de su sucursal.  
* Definir qué acciones puede ejecutar el Empleado sobre pagos y liberaciones.  
* Definir qué ocurre cuando se supera el tiempo de espera de 15 minutos en el restaurante.  
* Definir las condiciones de rechazo definitivo y cierre de pedidos.  
* Definir los límites para correcciones excepcionales de pedidos y estados.

## **21.3. Parámetros y alertas**

* Establecer los tiempos de aceptación.  
* Establecer los umbrales de retraso.  
* Definir las reglas exactas de asignación automática.  
* Definir los umbrales de confianza y bloqueo.  
* Definir los parámetros de las tarifas por zona, distancia y vehículo.

## **21.4. Integración externa**

* Obtener y revisar la documentación de Vocero CRM.  
* Confirmar endpoints y autenticación.  
* Confirmar webhooks y eventos disponibles.  
* Confirmar los límites y condiciones de WhatsApp.  
* Confirmar el mecanismo de reintentos y deduplicación.  
* Definir el tratamiento de fallos prolongados de integración.

## **21.5. Requisitos no funcionales**

* Definir objetivos medibles de rendimiento.  
* Definir disponibilidad esperada.  
* Definir frecuencia y retención de copias de seguridad.  
* Definir objetivos de recuperación.  
* Definir políticas de conservación de datos.  
* Definir las pruebas de seguridad y aceptación.

---

# **22\. Criterios de aceptación propuestos**

Los siguientes criterios sirven como base para probar el sistema. Su alcance definitivo deberá aprobarse junto con los requisitos.

## **CA-01. Acceso por roles**

Un usuario no autorizado no puede ejecutar acciones restringidas modificando la interfaz o enviando solicitudes directamente al servidor.

## **CA-02. Aceptación de pedidos**

Encargado y Coordinador pueden aceptar o rechazar pedidos dentro de sus permisos. La falta de respuesta genera una alerta al Coordinador sin cancelación automática.

## **CA-03. Preparación y pagos**

Un pago anticipado pendiente no impide iniciar la preparación, pero sí impide el despacho hasta su validación.

## **CA-04. Liberación del pedido**

El sistema impide el despacho si no se cumplen las condiciones de pago y asignación aplicables.

## **CA-05. Productos faltantes**

El sistema registra el producto afectado, informa al cliente y al Coordinador y conserva la decisión del cliente.

## **CA-06. Asignación de repartidores**

La asignación automática y manual respeta la disponibilidad, los permisos y las condiciones de garantía aplicables.

## **CA-07. Entrega fallida**

El sistema registra el motivo, la fecha, el intento y la evidencia disponible. El segundo intento requiere autorización del Coordinador.

## **CA-08. Retorno al restaurante**

El Encargado confirma la recepción física y el Coordinador decide si se reintenta o se cierra el pedido.

## **CA-09. Garantías y deudas**

Si la garantía no alcanza, se bloquean nuevos pedidos contra entrega conforme a las reglas aprobadas.

## **CA-10. Adelantos**

Cada adelanto requiere autorización humana, queda registrado y se descuenta de la siguiente liquidación diaria.

## **CA-11. Auditoría financiera**

Toda corrección de pago registra el motivo, el actor y los valores anteriores y nuevos.

## **CA-12. Privacidad**

Cada rol solo puede consultar los datos personales necesarios para sus funciones.

## **CA-13. Integración**

Los eventos duplicados no generan pedidos o pagos duplicados. Los fallos quedan registrados y generan alertas.

## **CA-14. Exportación**

Los archivos CSV, Excel y PDF respetan los permisos de lectura del usuario.

## **CA-15. Copias de seguridad**

Las copias se generan y pueden restaurarse conforme a los objetivos de recuperación que se aprueben.

---

# **23\. Propuesta técnica y plan de implementación por fases**

Esta sección es una propuesta técnica. No constituye una obligación de utilizar una tecnología específica hasta su aprobación.

## **23.1. Arquitectura propuesta**

* **Frontend:** Next.js con TypeScript.  
* **Interfaz:** diseño responsive y PWA.  
* **Base de datos:** PostgreSQL.  
* **Backend:** lógica de negocio y servicios protegidos para pedidos, pagos, usuarios y logística.  
* **Autenticación:** sesiones seguras y control de acceso por roles.  
* **Integración:** adaptadores independientes para Vocero CRM y WhatsApp.  
* **Auditoría:** registros de operaciones sensibles.  
* **Exportación:** generación de CSV, Excel y PDF.  
* **Copias de seguridad:** mecanismos automáticos y procedimientos manuales autorizados.

La arquitectura deberá separar la lógica de negocio de la interfaz y de las integraciones externas.

## **23.2. Fase 1: Diseño y validación**

* Aprobar la especificación.  
* Resolver las contradicciones prioritarias.  
* Definir los estados y permisos.  
* Definir los parámetros financieros.  
* Diseñar el modelo de datos.  
* Preparar los casos de prueba.

**Condición para avanzar:** aprobación de los requisitos mínimos de pedidos, pagos, permisos y garantías.

## **23.3. Fase 2: Núcleo operativo**

* Autenticación y roles.  
* Restaurantes y sucursales.  
* Catálogo y disponibilidad.  
* Registro de pedidos.  
* Estados operativos.  
* Kanban.  
* Aceptación y preparación.

**Condición para avanzar:** pruebas satisfactorias de creación, aceptación, preparación y trazabilidad de pedidos.

## **23.4. Fase 3: Pagos y logística**

* Validación de pagos anticipados.  
* Liberación de pedidos.  
* Asignación de repartidores.  
* Entregas fallidas.  
* Devoluciones.  
* Garantías y deudas.  
* Adelantos y liquidaciones.

**Condición para avanzar:** pruebas de conciliación, autorización, auditoría y bloqueo de operaciones no permitidas.

## **23.5. Fase 4: Clientes y comunicaciones**

* Historial de clientes.  
* Calificaciones.  
* Reclamos.  
* Notificaciones internas.  
* Integración con WhatsApp.  
* Integración con Vocero CRM, si su API lo permite.

**Condición para avanzar:** integración validada, eventos duplicados controlados y manejo de errores probado.

## **23.6. Fase 5: Reportes y administración**

* Dashboard.  
* Reportes.  
* Exportaciones.  
* Alertas.  
* Auditoría.  
* Copias de seguridad.  
* Herramientas de administración.

**Condición para avanzar:** permisos de reportes aprobados y pruebas de exportación y recuperación satisfactorias.

## **23.7. Fase 6: Validación final y despliegue**

* Pruebas funcionales.  
* Pruebas de permisos.  
* Pruebas de concurrencia.  
* Pruebas de seguridad.  
* Pruebas de recuperación.  
* Validación de operaciones financieras.  
* Aprobación formal de la versión.  
* Preparación del despliegue y capacitación de usuarios.

La secuencia puede ajustarse según la disponibilidad de recursos y las prioridades del proyecto, sin eliminar controles de seguridad o financieros.

---

# **24\. Registro de cambios y aprobación**

## **24.1. Registro de cambios**

Cada versión deberá registrar:

* Número de versión.  
* Fecha.  
* Responsable de la modificación.  
* Requisitos afectados.  
* Motivo del cambio.  
* Decisión que autoriza el cambio.  
* Pruebas necesarias.  
* Estado de aprobación.

## **24.2. Procedimiento de aprobación**

1. Se prepara una versión de trabajo.  
2. El responsable revisa el contenido.  
3. Se verifican contradicciones y pendientes.  
4. Se registran los cambios aprobados.  
5. Se actualiza la matriz de permisos y los criterios de aceptación.  
6. El responsable aprueba expresamente la versión.  
7. La versión aprobada pasa a ser la referencia para desarrollo y pruebas.

## **24.3. Estado actual**

La versión 1.1 consolida las decisiones tomadas durante las partes 1–17, pero mantiene pendientes aquellos aspectos que no cuentan con valores exactos o dependen de documentación externa.

La especificación no debe considerarse lista para producción hasta resolver las decisiones críticas, validar la integración externa y aprobar formalmente los requisitos.

---

# **Fin del documento**

**Nombre del sistema:** Zero Delivery  
**Documento:** Especificación integral funcional, reglas de negocio y propuesta técnica  
**Versión:** 1.1  
**Estado:** Borrador consolidado para revisión y aprobación

….

Frontend e Interfaz: Next.js con TypeScript, utilizando un enfoque de aplicación web progresiva (PWA) y diseño responsive para operar tanto en computadoras como en teléfonos móviles.   Base de datos: PostgreSQL como sistema principal para estructurar y almacenar usuarios, sucursales, catálogo, pedidos y operaciones financieras.   Backend: Servicios protegidos y centralizados para manejar la lógica de negocio, las reglas comerciales, el control de acceso por roles y la auditoría de seguridad.   Integraciones y Omnicanalidad: Conexiones mediante API y webhooks para sincronizar clientes y pedidos con Vocero CRM, junto con adaptadores independientes para implementar el chatbot interactivo y notificaciones por WhatsApp.   Exportación de datos: Herramientas para la generación nativa de reportes en formatos CSV, Excel y PDF.   