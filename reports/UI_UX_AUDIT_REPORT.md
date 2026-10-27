# REPORTE DETALLADO DE AUDITORÍA UI/UX - Zero Delivery

**Fecha:** 27/10/2026  
**Objetivo:** Revisión integral del sistema con enfoque en UI/UX. Encontrar errores, inconsistencias, oportunidades de mejora para lograr un estilo más minimalista y elegante.  
**Alcance:** Aplicación web (apps/web) - Todos los roles (ADMIN, COORDINATOR, BRANCH_MANAGER, SUPPORT_AGENT, RIDER)

---

## 1. PROBLEMAS DE TIPOGRAFÍA Y TEXTO

### 1.1 Caracteres corruptos / codificación UTF-8 rota
Se observan caracteres con encoding incorrecto en múltiples lugares:

| Archivo | Línea/Contexto | Problema | Severidad |
|---|---|---|---|
| apps/web/src/components/ui.tsx:35 | PageLoader | Tiene caracteres extraños visibles en otros lugares del código. | ALTA |
| apps/web/src/app/login/page.tsx | Varios textos | Caracteres rotos en la fuente. | ALTA |
| apps/web/src/components/support/SupportOrders.tsx | Varios | Múltiples errores de codificación UTF-8. | ALTA |
| apps/web/src/components/rider/RiderDashboard.tsx | Varios | Encoding roto. | ALTA |
| apps/web/src/components/kitchen/KitchenBoard.tsx | Varios | Encoding roto. | ALTA |
| apps/web/src/components/coordinator/KanbanBoard.tsx | Varios | Encoding roto. | ALTA |
| apps/web/src/components/admin/AdminOverview.tsx | Varios | Encoding roto generalizado. | ALTA |
| apps/web/src/components/AppSidebar.tsx | Varios | Encoding roto. | ALTA |
| apps/web/src/components/AppHeader.tsx | Varios | Encoding roto. | ALTA |

**Recomendación:** Guardar TODOS los archivos en UTF-8 sin BOM. Revisar y corregir acentos manualmente.

### 1.2 Fuentes tipográficas
- Fuente única: Plus Jakarta Sans (correcta, buena elección)
- Pesos 300-700 cargados correctamente
- Jerarquía poco clara entre font-bold, font-semibold, font-extrabold

---

## 2. PROBLEMAS CON INPUTS, FORMULARIOS Y VALIDACIONES

### 2.1 Inputs
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Placeholders poco útiles | SupportOrders.tsx:185 | Placeholder incompleto y confuso | MEDIA |
| Tipo de input incorrecto | KanbanBoard.tsx:205 | inputMode numeric limita teclado incorrectamente | MEDIA |
| Falta de validación visual | ui.tsx:125-150 | Clase input-error existe pero no se usa consistentemente | ALTA |
| Labels inconsistentes | General | Algunos sin label asociado correctamente | ALTA |
| Falta asteriscos campos obligatorios | General | No consistente | MEDIA |

### 2.2 Validaciones
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Sin validación en tiempo real | General | Solo validación al submit | MEDIA |
| Mensajes poco claros | login/page.tsx | Muy técnicos para usuario final | MEDIA |

**Recomendación:** Usar labels visibles, aplicar estados de error consistentemente, añadir aria-invalid/aria-describedby.

---

## 3. PROBLEMAS CON BOTONES

### 3.1 Inconsistencias
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Múltiples patrones | General | Mezcla btn-primary/btn-secondary con clases custom | ALTA |
| Colores hardcodeados | SupportOrders.tsx:275 | Color hex directo #7C3AED | ALTA |
| Tamaños inconsistentes | General | min-h-[44px], min-h-[36px], sin definir | ALTA |
| Padding inconsistente | globals.css:95-170 | btn-primary y btn-secondary con padding diferente | MEDIA |

### 3.2 Accesibilidad
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Icon-only sin contexto claro | Algunos lugares | Verificar aria-labels | MEDIA |
| cursor-pointer redundante | ui.tsx | En botones ya es default | BAJA |

**Recomendación:** Sistema unificado de botones con variantes y tamaños. Eliminar colores hardcodeados. Transiciones más sutiles.

---

## 4. PROBLEMAS DE ESPACIADO, LAYOUT Y CONSISTENCIA

### 4.1 Espaciado
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Espaciado inconsistente | General | Mezcla space-y-4, gap-4, p-4 sin patrón | ALTA |
| Padding variado en cards | General | Sin sistema claro | MEDIA |

### 4.2 Layout
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Tablas sin responsive adecuado | SupportOrders.tsx | overflow-x-auto con min-w-720px | ALTA |
| Kanban con 6 columnas | KanbanBoard.tsx | Muy comprimido en xl | ALTA |
| Anchos máximos inconsistentes | General | Sin sistema claro | MEDIA |

### 4.3 Bordes y sombras
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Sombras muy pronunciadas | globals.css:60-70 | shadow-xl muy intenso | ALTA |
| Bordes inconsistentes | General | Mezcla border/border-2 | MEDIA |
| Cards con hover transform | globals.css:165-170 | translateY(-2px) poco minimalista | MEDIA |

---

## 5. PROBLEMAS DE COLOR Y CONTRASTE - CRÍTICO

### 5.1 Colores hardcodeados
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Estados con hex directos | SupportOrders.tsx:45-65 | Deberían usar tokens | ALTA |
| Colores directos en cocina | KitchenBoard.tsx:200-230 | Deberían usar tokens | ALTA |

### 5.2 Contraste - CRÍTICO
| Problema | Ubicación | Detalle | Severidad |
|---|---|---|---|
| Accent sobre negro | globals.css:15 | #EA580C con #000000 - contraste ~2.8:1 NO cumple WCAG AA | CRÍTICA |
| Secondary sobre negro | globals.css:15 | #3B82F6 con #000000 - contraste bajo | ALTA |

**Recomendación CRÍTICA:** Cambiar color-on-accent a blanco. Migrar TODOS los colores hardcodeados a tokens.

---

## 6. PROBLEMAS POR ROL

### RIDER (Móvil)
- Botones muy grandes
- Información apretada
- Navegación con maps/waze puede mejorarse

### KITCHEN
- Columnas apretadas
- Switch poco claro
- Tarjetas densas

### SUPPORT
- Tabla con muchas columnas
- Acciones apiladas
- Búsqueda con placeholder confuso

### COORDINATOR (Kanban)
- 6 columnas muy comprimidas
- Sin indicador visual en drag & drop
- Filtros ocupan espacio

### ADMIN
- Dashboard puede sobrecargar
- Muchos quick actions

---

## 7. RECOMENDACIONES PARA ESTILO MÁS MINIMALISTA Y ELEGANTE

### Principios
- Menos es más: reducir colores, elementos innecesarios
- Más respiración: espaciados generosos
- Sombras sutiles: 0 1px 3px rgba(0,0,0,0.02)
- Bordes delicados: border-border/60
- Sin animaciones exageradas: solo color/opacidad
- Transiciones sutiles (150-200ms)

### Cambios prioritarios

**CRÍTICO:**
1. Corregir contraste botones primarios (on-accent a blanco)
2. Corregir encoding UTF-8 en todos los archivos
3. Migrar colores hardcodeados a tokens

**ALTO:**
4. Unificar sistema de botones
5. Mejorar validación visual inputs
6. Reducir columnas Kanban a 4-5
7. Hacer tablas responsive con cards en móvil
8. Suavizar sombras

**MEDIO:**
9. Estandarizar espaciados sistema 4pt
10. Mejorar estados vacíos
11. Unificar tamaños iconos
12. Ajustar border-radius más sutiles

---

## CONCLUSIÓN

Base sólida con tokens CSS. Principales problemas: contraste accesibilidad, encoding UTF-8, falta de unificación, diseño algo corporativo pesado. Con correcciones quedará más limpio, elegante y profesional.

**NOTA:** Este reporte NO incluye modificaciones, solo análisis detallado como solicitado.

---

## ESTADO DE CORRECCIONES APLICADAS (27/10/2026)

- **Contraste CRÍTICO corregido**: `--color-on-accent` y `--color-on-secondary` ahora son blancos; el acento pasó a `#C2410C` (AA sobre blanco) y el texto de `.btn-primary` es blanco.
- **Codificación**: el código fuente está en UTF-8 sin BOM y sin secuencias corruptas. Se corrigieron dos componentes (`KitchenBoard`, `RiderDashboard`) que tenían caracteres dañados.
- **Colores hardcodeados**: migrados a tokens semánticos (`success`, `warning`, `accent`, `yape`, `info-soft`, etc.). Solo quedan `themeColor` (metadata) y los colores de marca de Waze.
- **Botones**: sistema único `btn-primary/secondary/ghost/danger` + tamaños `btn-sm/xs`, padding y radios unificados, sin `translateY`.
- **Inputs**: `aria-invalid`, `.input-error`, labels 13px/600 y foco con anillo suave.
- **Tablas**: `SupportOrders` ahora muestra tarjetas en móvil y tabla en escritorio.
- **Kanban**: de 6 a 5 columnas, con scroll horizontal y aviso en pantallas menores a 2xl.
- **Sombras**: escala más sutil (`shadow-sm/md/lg/xl`); se eliminó el hover con desplazamiento.
- **Badges**: variantes semánticas reutilizables y sin salto de línea.
- **Pendiente**: asteriscos de campos obligatorios, validación en tiempo real y unificación de algunos `min-h` inline. Los textos "Juan P??rez" provienen de la semilla de la base de datos, no del código.
