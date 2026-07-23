---
title: "Manual de Usuario"
subtitle: "GCM Tickets — Sistema de Soporte Técnico"
---

<div align="center">

# MANUAL DE USUARIO

## GCM Tickets
### Sistema de Soporte Técnico, Inventario y Préstamos

**Grupo Milcien S.A. de C.V.**

Versión del documento: 1.0
Fecha: Julio 2026

</div>

<div style="page-break-after: always;"></div>

## Tabla de contenido

1. [Introducción](#1-introducción)
2. [Objetivo](#2-objetivo)
3. [Requisitos para utilizar la aplicación](#3-requisitos-para-utilizar-la-aplicación)
4. [Acceso al sistema](#4-acceso-al-sistema)
5. [Inicio de sesión](#5-inicio-de-sesión)
6. [Recuperación de contraseña](#6-recuperación-de-contraseña)
7. [Descripción de la interfaz](#7-descripción-de-la-interfaz)
8. [Menús](#8-menús)
9. [Panel principal](#9-panel-principal)
10. [Explicación de cada módulo](#10-explicación-de-cada-módulo)
11. [Cómo crear registros](#11-cómo-crear-registros)
12. [Cómo editar registros](#12-cómo-editar-registros)
13. [Cómo eliminar registros](#13-cómo-eliminar-registros)
14. [Cómo realizar búsquedas](#14-cómo-realizar-búsquedas)
15. [Cómo aplicar filtros](#15-cómo-aplicar-filtros)
16. [Cómo generar reportes](#16-cómo-generar-reportes)
17. [Cómo cerrar sesión](#17-cómo-cerrar-sesión)
18. [Mensajes del sistema](#18-mensajes-del-sistema)
19. [Preguntas frecuentes](#19-preguntas-frecuentes)
20. [Solución de problemas comunes](#20-solución-de-problemas-comunes)
21. [Buenas prácticas para el usuario](#21-buenas-prácticas-para-el-usuario)
22. [Glosario](#22-glosario)

<div style="page-break-after: always;"></div>

## 1. Introducción

Este manual explica, en lenguaje sencillo, cómo utilizar **GCM Tickets**, el sistema interno de soporte técnico de Grupo Milcien S.A. de C.V. El sistema tiene dos entradas distintas:

- **Portal de empleados** (`/portal`): para que cualquier colaborador reporte y siga sus propias solicitudes de soporte.
- **Panel administrativo** (`/admin`): para el personal de TI (técnicos, administradores y superadministrador), que gestiona los tickets, el inventario de equipos, los préstamos, los usuarios y la bitácora del sistema.

## 2. Objetivo

Guiar a los empleados y al personal de TI en el uso correcto del sistema: cómo iniciar sesión, crear y dar seguimiento a tickets, y —para el personal de TI— cómo administrar inventario, préstamos, usuarios y la auditoría del sistema.

## 3. Requisitos para utilizar la aplicación

- Contar con una cuenta activa en el sistema (empleado o personal de TI).
- Un navegador web actualizado (Google Chrome, Microsoft Edge o Mozilla Firefox).
- Conexión a la red interna de la empresa.
- Para adjuntar evidencia desde el celular: un teléfono con cámara y navegador web, conectado a la misma red que el equipo desde el que se administra el sistema.

## 4. Acceso al sistema

| Portal | Dirección de acceso | Para quién |
|---|---|---|
| Portal de empleados | `http://<servidor>:<puerto>/portal` | Todos los empleados |
| Panel administrativo | `http://<servidor>:<puerto>/admin` | Técnicos, administradores y superadministrador |

> El puerto y la dirección exactos los proporciona el Departamento de Sistemas / TI (por defecto, puerto `8081`).

Si aún no tienes cuenta, puedes solicitarla desde el enlace **"Solicitar acceso"** visible en la pantalla de inicio de sesión del portal de empleados (ver sección 11.1).

## 5. Inicio de sesión

1. Ingresa a la dirección del portal o del panel administrativo, según corresponda a tu rol.
2. Escribe tu **usuario** y tu **contraseña**.
3. Presiona **"Iniciar sesión"** (portal) o **"Ingresar al sistema"** (panel admin).

**Importante:** cada cuenta está autorizada para un solo portal. Un empleado no puede entrar al panel administrativo, y el personal de TI no debe usar el portal de empleados para reportar tickets propios del área de TI (su acceso corresponde al panel admin). Si intentas entrar por el portal equivocado, el sistema mostrará el mismo mensaje que si la contraseña fuera incorrecta, sin dar más detalle (por seguridad).

La sesión permanece activa hasta 12 horas o hasta que cierres sesión manualmente; después de ese tiempo deberás iniciar sesión nuevamente.

## 6. Recuperación de contraseña

**El sistema no cuenta con un flujo de "olvidé mi contraseña" autoservicio.** Según lo verificado en el código fuente, no existe ningún endpoint ni pantalla de recuperación de contraseña por correo.

Si olvidaste tu contraseña:

- **Empleados:** contacta al Departamento de Sistemas / TI para que un superadministrador te asigne una nueva contraseña desde el panel de administración.
- **Personal de TI (técnico/admin):** solicita al **superadministrador** que restablezca tu contraseña desde el detalle de tu usuario en `/admin/usuarios` (esta acción está reservada exclusivamente al superadministrador, sin importar los permisos que tengas otorgados).

## 7. Descripción de la interfaz

### 7.1 Portal de empleados

La pantalla principal muestra un encabezado con el logo y nombre del sistema, un banner de bienvenida con el botón **"Nuevo ticket"**, filtros por estado (Todos / Abiertos / En progreso / Cerrados) y, debajo, la lista de "Mis tickets" en tarjetas.

### 7.2 Panel administrativo

El panel tiene una barra superior fija con: logo y nombre del sistema, botón de gestión de usuarios admin, campana de notificaciones, enlaces a las secciones habilitadas para tu rol (Tickets, Usuarios, Bitácora, Inventario, Portal empleados), botón de modo oscuro/claro y botón de cerrar sesión. Debajo de la barra superior, cada sección (Tickets, Usuarios, Inventario, Bitácora) tiene su propio contenido.

## 8. Menús

| Elemento del menú (panel admin) | Visible para | Lleva a |
|---|---|---|
| Tickets | Todo el personal de TI | Bandeja principal de tickets (`/admin`) |
| Usuarios | Solo con permiso "Usuarios" otorgado (o superadmin) | Gestión de usuarios y solicitudes (`/admin/usuarios`) |
| Bitácora | Solo con permiso "Bitácora" otorgado (o superadmin) | Auditoría del sistema (`/admin/auditoria`) |
| Inventario | Solo con permiso "Inventario" o "Préstamos" otorgado (o superadmin) | Módulo de inventario (`/admin/inventario`) |
| Portal empleados | Todo el personal de TI | Abre el portal de empleados en la misma pestaña |

> Por defecto, un técnico o administrador **no** ve los menús de Usuarios, Bitácora ni Inventario hasta que el superadministrador le otorgue el permiso correspondiente desde el modal "Usuarios administradores".

## 9. Panel principal

El panel principal del staff es la **bandeja de tickets** (`/admin`). Contiene, de arriba hacia abajo:

1. Pestañas de estado (Todos / Abiertos / En progreso / Cerrados), cada una con un contador.
2. Barra de filtros (búsqueda de texto, prioridad, categoría, técnico asignado, rango de fechas) y el botón "Excel" para exportar.
3. Tarjetas de estadísticas rápidas (total, abiertos, en progreso, cerrados, sin asignar, críticos activos).
4. Gráficos (solo en la pestaña "Todos"): distribución por estado, por técnico y por categoría.
5. Listado de tickets, agrupado en "Mis tickets" y "Otros técnicos" cuando se filtra por un estado específico.

Al hacer clic en un ticket se abre el panel de detalle (ver sección 10.1) desde el lado derecho de la pantalla.

## 10. Explicación de cada módulo

### 10.1 Tickets (panel admin)

Bandeja principal de soporte técnico. Al abrir un ticket se despliega un panel lateral con tres pestañas:

- **Info:** descripción, datos generales, reasignación a otro técnico, botones de acción (Tomar / Cerrar / Reabrir / Eliminar), archivos adjuntos y el hilo de mensajes con el empleado (con plantillas de respuesta rápida).
- **Notas internas:** notas visibles únicamente para el personal de TI, nunca para el empleado.
- **Historial:** registro cronológico de todos los cambios realizados sobre el ticket.

### 10.2 Inventario

Cuatro vistas dentro de `/admin/inventario`:

- **Dashboard:** gráficos de estado, tipo y condición de los equipos, y últimos ingresos.
- **Equipos:** listado de equipos con búsqueda y filtro por estado; cada tarjeta permite prestar, devolver, editar o eliminar.
- **Préstamos:** listado de préstamos activos e historial, con botones de devolución (total o parcial) y generación de comprobante en Word.
- **Responsables:** agrupación de equipos por persona responsable o, si no tienen responsable, por ubicación física.

### 10.3 Usuarios

En `/admin/usuarios`: estadísticas generales, tarjeta de "Solicitudes de acceso" (pendientes/aprobadas/rechazadas) y el listado "Usuarios registrados", separado en "Usuarios del sistema" (staff) y "Empleados". Cada usuario tiene un botón "Ver" que abre su detalle (perfil y tickets reportados).

### 10.4 Bitácora

En `/admin/auditoria`: tabla con todas las acciones administrativas registradas (quién, qué, cuándo), con filtros por usuario, área/entidad y rango de fechas.

### 10.5 Portal de empleados

Creación de tickets propios y seguimiento de su estado, con posibilidad de responder a los mensajes de soporte técnico.

## 11. Cómo crear registros

### 11.1 Crear una cuenta (solicitud de registro)

1. En la pantalla de inicio de sesión del portal, haz clic en **"Solicitar acceso"**.
2. Completa el formulario: nombre, apellido (opcional), usuario, correo, teléfono (opcional), departamento (opcional), **finca** (obligatorio: selecciona la finca donde trabajas o "No aplica" si no corresponde), área (opcional), contraseña (mínimo 6 caracteres) y motivo de acceso (opcional).
3. Envía la solicitud. Quedará **pendiente de aprobación** por un administrador; no podrás iniciar sesión hasta que sea aprobada.

### 11.2 Crear un ticket (portal de empleados)

1. Haz clic en **"Nuevo ticket"**.
2. Escribe el título del problema (obligatorio) y, opcionalmente, una descripción, categoría y prioridad.
3. Adjunta evidencia (opcional): elige un archivo desde tu equipo, o presiona **"Subir desde celular"** para generar un código QR, escanearlo con tu teléfono y tomar la foto/video ahí mismo (máximo 15 segundos de video).
4. Presiona **"Enviar ticket"**.

### 11.3 Registrar un equipo en inventario (panel admin)

1. En Inventario → Equipos, presiona **"Nuevo equipo"**.
2. Elige el modo de manejo: **por unidad** (con número de serie, no se puede cambiar después) o **por cantidad** (lote, ej. cables o mouse).
3. Completa tipo, marca, modelo, serie o cantidad total, color, condición, ubicación y responsable (opcional).
4. Opcionalmente, toma una foto del equipo con el mismo mecanismo de QR + celular.
5. Opcionalmente, registra los datos de garantía.
6. Presiona **"Guardar equipo"**.

### 11.4 Registrar un préstamo

1. En Inventario → Préstamos, presiona **"Nuevo préstamo"** (o el botón "Prestar" de una tarjeta de equipo).
2. Busca y selecciona el equipo (solo aparecen los que tienen disponibilidad).
3. Si es un equipo por cantidad, indica cuántas unidades prestar.
4. Indica el empleado que recibe el equipo, departamento, fecha estimada de devolución y quién autoriza.
5. Presiona **"Registrar préstamo"**.

## 12. Cómo editar registros

- **Ticket:** desde el panel de detalle, cambia el estado, reasigna el técnico o agrega comentarios/notas — los cambios se guardan de inmediato.
- **Equipo de inventario:** presiona el ícono de lápiz en la tarjeta del equipo (o en el listado de Responsables) para abrir el mismo formulario de creación, ya con los datos cargados. El modo de manejo (unidad/cantidad) no se puede cambiar una vez creado el equipo.
- **Permisos de un usuario:** desde el modal "Usuarios administradores" (solo superadmin), activa o desactiva los chips de módulo junto a cada usuario.

## 13. Cómo eliminar registros

- **Ticket:** desde el panel de detalle → botón **"Eliminar"** (requiere confirmación; la acción no se puede deshacer).
- **Equipo de inventario:** botón de papelera en la tarjeta del equipo. No se puede eliminar un equipo con un préstamo activo; primero debe registrarse la devolución.
- **Usuario:** desde su ficha de detalle o el listado de usuarios, botón "Eliminar" (requiere confirmación). No puedes eliminar tu propia cuenta, y no se puede dejar el sistema sin ningún administrador activo.

## 14. Cómo realizar búsquedas

Cada listado del sistema tiene un campo de búsqueda de texto libre en la parte superior:

| Pantalla | Qué busca el campo de texto |
|---|---|
| Bandeja de tickets | Título, descripción, folio y nombre del reportante |
| Equipos de inventario | Tipo, marca, modelo, serie, color, ubicación, responsable, condición, estado |
| Préstamos | Equipo, empleado, departamento, folio de préstamo |
| Responsables | Nombre del responsable/ubicación y datos del equipo |
| Usuarios registrados | Nombre, apellido, usuario y correo |
| Bitácora | Usuario (autocompletado con los que ya tienen registros) |

## 15. Cómo aplicar filtros

- **Tickets:** pestañas de estado, más filtros de prioridad, categoría, técnico asignado y rango de fechas (botón de escoba para limpiar todos los filtros de un clic).
- **Equipos:** selector de estado (Disponible, En uso, En préstamo, En reparación, De baja).
- **Préstamos:** selector de estado (Activos / Devueltos).
- **Bitácora:** filtro por usuario, por área (Tickets, Inventario, Préstamos, Usuarios, Solicitudes) y por rango de fechas (Desde/Hasta).

## 16. Cómo generar reportes

El sistema ofrece dos formas de generar documentos:

1. **Exportar tickets a Excel:** en la bandeja de tickets, botón **"Excel"** (arriba a la derecha de la barra de filtros). Descarga un archivo `.xlsx` con el listado completo de tickets (visibles según los filtros aplicados) y una hoja de resumen con totales por estado, prioridad, categoría y técnico.
2. **Comprobante de préstamo/devolución (Word):** en Inventario → Préstamos, botón **"Comprobante"** de cada préstamo. Genera un documento `.doc` imprimible con los datos del préstamo (o de la devolución, si ya fue devuelto), listo para firma física.

## 17. Cómo cerrar sesión

Presiona el ícono de salida (flecha) en la barra superior, tanto en el portal como en el panel administrativo. Esto elimina la sesión guardada en el navegador; deberás volver a iniciar sesión para continuar usando el sistema.

## 18. Mensajes del sistema

| Mensaje | Significado |
|---|---|
| "Usuario o contraseña incorrectos" | Credenciales inválidas, o intentaste entrar por el portal que no corresponde a tu rol |
| "Demasiados intentos. Espera unos minutos e intenta de nuevo." | Se alcanzó el límite de intentos de inicio de sesión (protección contra fuerza bruta) |
| "El equipo está prestado. Gestiona la devolución desde la sección Préstamos." | Intentaste cambiar el estado de un equipo que tiene un préstamo activo |
| "No se puede eliminar un equipo con préstamo activo. Registra la devolución primero." | — |
| "Solo hay N unidades disponibles de este artículo" | Intentaste prestar más unidades de las que quedan disponibles en un lote |
| "No puedes eliminar tu propia cuenta" / "No puedes desactivar tu propia cuenta" | Protección para no perder tu propio acceso |
| "No se puede eliminar el único administrador" | Protección para que siempre quede al menos un miembro del personal de TI activo |
| "Sesión expirada" (código QR) | El código QR de subida desde celular venció (5 minutos); genera uno nuevo |
| "Error de conexión con el servidor" | El navegador no pudo comunicarse con la API; verifica tu red o que el servidor esté encendido |

## 19. Preguntas frecuentes

**¿Puedo usar la misma cuenta en el portal y en el panel admin?**
No. Cada cuenta pertenece a un solo portal según su rol: los empleados (rol "empleado") usan `/portal`; los técnicos, administradores y superadministrador usan `/admin`.

**¿Por qué no veo el menú de Inventario/Usuarios/Bitácora en el panel admin?**
Porque no tienes el permiso de ese módulo otorgado. Solicita al superadministrador que te lo otorgue desde "Usuarios administradores".

**¿Puedo ver los tickets de otros empleados desde el portal?**
No. El portal solo muestra los tickets que tú mismo reportaste.

**¿Las notas internas de un ticket las puede ver el empleado?**
No. Las notas internas son exclusivas del personal de TI; el empleado solo ve los comentarios públicos.

**¿Qué pasa si mi video de evidencia dura más de 15 segundos?**
La página de subida desde el celular lo rechaza automáticamente y pide grabar uno más corto.

**¿Cómo sé si un equipo de inventario es "por unidad" o "por cantidad"?**
Los equipos por cantidad muestran una etiqueta "X/Y disponibles" en vez de un estado único; además, en el formulario de edición, el modo de manejo aparece bloqueado con una nota indicando que no se puede cambiar.

## 20. Solución de problemas comunes

| Problema | Causa probable | Solución |
|---|---|---|
| No puedo iniciar sesión aunque la contraseña es correcta | Estás entrando por el portal equivocado para tu rol | Verifica que uses `/admin` (staff) o `/portal` (empleado) según corresponda |
| El código QR no funciona | Expiró (5 minutos) o el celular no está en la misma red | Genera un nuevo código QR y verifica la conexión de red del celular |
| No aparece la opción de prestar un equipo | El equipo ya está prestado o no tiene unidades disponibles | Consulta la sección Préstamos para ver quién lo tiene actualmente |
| No puedo eliminar un usuario o desactivarlo | Es tu propia cuenta, o es el único administrador activo | Pide a otro administrador que realice la acción, o primero da de alta a otro administrador |
| El adjunto no se sube | El archivo supera 50 MB o su extensión no está permitida | Usa un archivo más liviano o con una extensión permitida (imágenes o videos comunes) |
| No veo notificaciones por correo | El correo SMTP no está configurado en el servidor | Consulta con el Departamento de Sistemas / TI |

## 21. Buenas prácticas para el usuario

- Cierra sesión cuando termines, especialmente en equipos compartidos.
- Redacta títulos de ticket claros y específicos; agrega evidencia (foto/video) cuando el problema sea visual.
- Antes de solicitar un préstamo, verifica la disponibilidad real del equipo en la sección correspondiente.
- Al recibir un equipo en préstamo, revisa su condición física y repórtala si no coincide con lo indicado en el sistema.
- No compartas tu usuario y contraseña con otras personas: cada acción queda ligada a tu cuenta en la bitácora de auditoría.

## 22. Glosario

| Término | Significado |
|---|---|
| Ticket | Solicitud de soporte técnico registrada en el sistema |
| Folio | Identificador legible de un registro (ej. `TK-001` para tickets, `INV-001` para inventario, `PREST-001` para préstamos) |
| Staff | Personal de TI: técnico, administrador o superadministrador |
| Módulo | Sección del panel admin con acceso restringido (Inventario, Préstamos, Bitácora, Solicitudes, Usuarios) |
| Permiso de módulo | Autorización específica que el superadministrador otorga a un técnico/admin para usar un módulo |
| Nota interna | Mensaje de un ticket visible solo para el personal de TI |
| Bitácora / auditoría | Registro histórico de las acciones administrativas realizadas en el sistema |
| Inventario por unidad | Equipo físico individual, con número de serie, prestable a una sola persona a la vez |
| Inventario por cantidad | Lote de artículos sin serie individual (ej. cables), con varias unidades prestables simultáneamente |
| Finca | Ubicación agrícola de la empresa, seleccionable durante el registro de un empleado |

<div style="page-break-after: always;"></div>

*Fin del Manual de Usuario — GCM Tickets v1.0*
