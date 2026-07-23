---
title: "Documentación de Pantallas"
subtitle: "GCM Tickets — Sistema de Soporte Técnico"
---

<div align="center">

# DOCUMENTACIÓN DE PANTALLAS

## GCM Tickets
### Sistema de Soporte Técnico, Inventario y Préstamos

**Grupo Milcien S.A. de C.V.**

Versión del documento: 1.0
Fecha: Julio 2026

</div>

<div style="page-break-after: always;"></div>

## Tabla de contenido

**Portal de empleados**
1. [Pantalla de inicio de sesión — Portal](#1-pantalla-de-inicio-de-sesión--portal)
2. [Pantalla de solicitud de registro](#2-pantalla-de-solicitud-de-registro)
3. [Pantalla principal del portal — Mis tickets](#3-pantalla-principal-del-portal--mis-tickets)
4. [Modal — Nuevo ticket](#4-modal--nuevo-ticket)
5. [Modal — Subir foto/video desde el celular (QR)](#5-modal--subir-fotovideo-desde-el-celular-qr)
6. [Pantalla de subida móvil (destino del QR)](#6-pantalla-de-subida-móvil-destino-del-qr)

**Panel administrativo**
7. [Pantalla de inicio de sesión — Panel admin](#7-pantalla-de-inicio-de-sesión--panel-admin)
8. [Bandeja de tickets](#8-bandeja-de-tickets)
9. [Panel de detalle de ticket](#9-panel-de-detalle-de-ticket)
10. [Modal — Usuarios administradores](#10-modal--usuarios-administradores)
11. [Inventario — Dashboard](#11-inventario--dashboard)
12. [Inventario — Equipos](#12-inventario--equipos)
13. [Inventario — Préstamos](#13-inventario--préstamos)
14. [Inventario — Responsables](#14-inventario--responsables)
15. [Modal — Nuevo/editar equipo](#15-modal--nuevoeditar-equipo)
16. [Modal — Registrar préstamo](#16-modal--registrar-préstamo)
17. [Modal — Equipos similares](#17-modal--equipos-similares)
18. [Modal — Confirmar devolución / Devolución parcial](#18-modal--confirmar-devolución--devolución-parcial)
19. [Modal — Foto del equipo desde celular (QR)](#19-modal--foto-del-equipo-desde-celular-qr)
20. [Pantalla de gestión de usuarios](#20-pantalla-de-gestión-de-usuarios)
21. [Modal — Detalle de usuario](#21-modal--detalle-de-usuario)
22. [Pantalla de bitácora / auditoría](#22-pantalla-de-bitácora--auditoría)

<div style="page-break-after: always;"></div>

> **Convención:** cada ficha describe la pantalla o modal tal como está implementado en el código (`web/app/...`). El campo "Permisos necesarios" indica el rol/permiso de módulo mínimo requerido, según la lógica de `lib/auth.tsx` y las validaciones del backend.

## 1. Pantalla de inicio de sesión — Portal

| Campo | Detalle |
|---|---|
| **Nombre** | `IdentScreen` |
| **Ruta / archivo** | `/portal` → `web/app/portal/_components/IdentScreen.tsx` |
| **Objetivo** | Autenticar al empleado para acceder al portal |
| **Descripción** | Pantalla de pantalla completa con panel de marca a la izquierda y formulario de acceso a la derecha |
| **Componentes** | Logo de la empresa, título "Bienvenido", enlace "Solicitar acceso" |
| **Campos** | Usuario (texto), Contraseña (password) |
| **Botones** | "Iniciar sesión" |
| **Validaciones** | Ambos campos requeridos en cliente; el servidor valida credenciales y que el rol corresponda al portal de empleados |
| **Flujo de navegación** | Éxito → pantalla principal del portal (`PortalApp`). Error → mensaje de error visible, permanece en la pantalla. Enlace "Solicitar acceso" → `/registro` |
| **Permisos necesarios** | Ninguno (pantalla pública) |
| **Observaciones** | No existe recuperación de contraseña autoservicio desde esta pantalla |

## 2. Pantalla de solicitud de registro

| Campo | Detalle |
|---|---|
| **Nombre** | `RegistroPage` |
| **Ruta / archivo** | `/registro` → `web/app/registro/page.tsx` |
| **Objetivo** | Permitir a un empleado solicitar una cuenta |
| **Descripción** | Formulario de dos columnas (panel de marca + formulario), con pantalla de confirmación tras el envío |
| **Componentes** | Panel de marca, formulario, mensaje de éxito post-envío |
| **Campos** | Nombre* (texto), Apellido, Usuario* (texto, patrón letras/números/`_`/`-`), Correo electrónico* (email), Teléfono, Departamento, Finca* (select con las fincas de la empresa y "No aplica"), Área, Contraseña* (mín. 6), Confirmar contraseña*, Motivo de acceso (textarea) |
| **Botones** | "Enviar solicitud" |
| **Validaciones** | Campos marcados con * son obligatorios; contraseñas deben coincidir y tener mínimo 6 caracteres; el servidor valida además formato de usuario/correo y unicidad |
| **Flujo de navegación** | Éxito → pantalla de confirmación con enlace "Volver al portal". Enlace "Inicia sesión aquí" → `/portal` |
| **Permisos necesarios** | Ninguno (pantalla pública) |
| **Observaciones** | La cuenta queda pendiente de aprobación; no se puede iniciar sesión hasta que un administrador la apruebe |

## 3. Pantalla principal del portal — Mis tickets

| Campo | Detalle |
|---|---|
| **Nombre** | `PortalApp` |
| **Ruta / archivo** | `/portal` → `web/app/portal/page.tsx` |
| **Objetivo** | Que el empleado cree tickets y dé seguimiento a los que ya reportó |
| **Descripción** | Encabezado, banner de bienvenida con botón "Nuevo ticket", filtros por estado con contador, y listado de tarjetas de ticket |
| **Componentes** | `Header`, `Hero`, botones de filtro (Todos/Abiertos/En progreso/Cerrados), lista de `TicketCard` |
| **Campos** | Campo de respuesta de texto libre dentro de cada tarjeta de ticket (visible si el ticket no está cerrado) |
| **Botones** | "Nuevo ticket" (Hero), filtros de estado, "Enviar" (respuesta dentro de cada tarjeta) |
| **Validaciones** | El texto de respuesta no puede estar vacío |
| **Flujo de navegación** | "Nuevo ticket" → abre el modal de creación (ficha 4). Filtro de estado → recalcula la lista visible sin recargar la página |
| **Permisos necesarios** | Sesión de empleado activa |
| **Observaciones** | Los datos se refrescan automáticamente cada 15 segundos (SWR `refreshInterval`) |

## 4. Modal — Nuevo ticket

| Campo | Detalle |
|---|---|
| **Nombre** | `NewTicketModal` |
| **Archivo** | `web/app/portal/_components/NewTicketModal.tsx` |
| **Objetivo** | Capturar los datos de un nuevo ticket de soporte |
| **Descripción** | Modal con formulario y zona de adjunto (arrastrar y soltar o QR) |
| **Componentes** | Campos de formulario, zona de arrastre de archivo, botón "Subir desde celular" |
| **Campos** | Título* (texto), Descripción (textarea), Categoría (select: Hardware/Software/Red/Acceso/Otro), Prioridad (select: Baja/Media/Alta/Crítica), Adjunto (archivo local o desde celular, mutuamente excluyentes) |
| **Botones** | "Cancelar", "Enviar ticket" |
| **Validaciones** | Título obligatorio; adjunto limitado a imágenes/video, máx. 50 MB |
| **Flujo de navegación** | "Subir desde celular" → abre el modal de QR (ficha 5). Al enviar con éxito → se cierra el modal y el ticket aparece en la lista |
| **Permisos necesarios** | Sesión de empleado activa |
| **Observaciones** | Elegir un archivo local descarta cualquier adjunto móvil pendiente, y viceversa |

## 5. Modal — Subir foto/video desde el celular (QR)

| Campo | Detalle |
|---|---|
| **Nombre** | `QRModal` |
| **Archivo** | `web/app/portal/_components/QRModal.tsx` |
| **Objetivo** | Generar un código QR para adjuntar evidencia desde el celular sin iniciar sesión ahí |
| **Descripción** | Modal con estados: generando QR → esperando foto (con cuenta regresiva) → foto recibida → expirado |
| **Componentes** | Imagen QR, instrucciones numeradas, cuenta regresiva, ícono de estado |
| **Campos** | Ninguno (no captura datos directamente) |
| **Botones** | "Cancelar", "Usar esta foto" (solo cuando el archivo ya llegó), "Generar nuevo QR" (si expiró) |
| **Validaciones** | El servidor valida extensión y tamaño (50 MB) del archivo recibido |
| **Flujo de navegación** | Al confirmar, el archivo queda enlazado al formulario de nuevo ticket; el modal se cierra |
| **Permisos necesarios** | Sesión de empleado activa (para abrir el modal); el celular no requiere sesión |
| **Observaciones** | La sesión de subida expira a los 5 minutos; se consulta el estado cada 2 segundos (polling) |

## 6. Pantalla de subida móvil (destino del QR)

| Campo | Detalle |
|---|---|
| **Nombre** | `MobileUploadPage` |
| **Ruta / archivo** | `/mobile-upload?session=<token>&type=<opcional>` → `web/app/mobile-upload/page.tsx` |
| **Objetivo** | Recibir, desde el navegador del celular, la foto o video que se adjuntará al ticket (o al equipo de inventario) |
| **Descripción** | Página optimizada para móvil con selección de cámara/galería y vista previa antes de enviar |
| **Componentes** | Encabezado con logo, tarjetas "Tomar foto" / "Grabar video" (el video no aparece si `type=inventario`), vista previa, pantallas de envío/éxito/error |
| **Campos** | Selector de archivo de imagen o video (`<input type="file">`) |
| **Botones** | "Enviar evidencia", "Elegir otra" |
| **Validaciones** | Los videos se rechazan en cliente si duran más de 15 segundos |
| **Flujo de navegación** | Envío exitoso → pantalla "Evidencia enviada" (el usuario puede cerrar la pestaña). Sesión expirada/inválida → pantalla "Código expirado" |
| **Permisos necesarios** | Ninguno; se identifica solo por el token de sesión en la URL |
| **Observaciones** | No requiere ni permite iniciar sesión; es de un solo uso por sesión (5 minutos) |

## 7. Pantalla de inicio de sesión — Panel admin

| Campo | Detalle |
|---|---|
| **Nombre** | `LoginScreen` |
| **Archivo** | `web/app/admin/_components/LoginScreen.tsx` |
| **Objetivo** | Autenticar al personal de TI para acceder al panel administrativo |
| **Descripción** | Pantalla de pantalla completa con panel de marca (etiqueta "Acceso restringido") y formulario de acceso |
| **Componentes** | Logo, indicador "Acceso restringido", formulario |
| **Campos** | Usuario (texto), Contraseña (password) |
| **Botones** | "Ingresar al sistema" |
| **Validaciones** | El servidor valida credenciales y que el rol corresponda al panel admin (nivel ≥ 2) |
| **Flujo de navegación** | Éxito → bandeja de tickets (`/admin`). Error → mensaje visible en la misma pantalla |
| **Permisos necesarios** | Ninguno (pantalla pública) |
| **Observaciones** | Mismo mensaje de error genérico que el portal, para no revelar si el usuario existe |

## 8. Bandeja de tickets

| Campo | Detalle |
|---|---|
| **Nombre** | `AdminApp` (página `/admin`) |
| **Archivo** | `web/app/admin/page.tsx` |
| **Objetivo** | Vista principal del staff: listar, filtrar y gestionar todos los tickets |
| **Descripción** | Encabezado, pestañas de estado, barra de filtros, estadísticas, gráficos (solo pestaña "Todos") y listado paginado |
| **Componentes** | `Header`, `Tabs`, `FilterBar`, `StatsGrid`, `ChartsSection`, `TicketList`, `DetailDrawer` |
| **Campos** | Búsqueda de texto, prioridad, categoría, técnico asignado, fecha desde/hasta |
| **Botones** | "Excel" (exportar), botón de limpiar filtros, paginación |
| **Validaciones** | Ninguna sobre los filtros (todos opcionales) |
| **Flujo de navegación** | Clic en un ticket → abre el `DetailDrawer` (ficha 9). Deep-link `?ticket=ID` (desde el detalle de usuario) abre automáticamente ese ticket |
| **Permisos necesarios** | Sesión de staff (nivel ≥ 2) |
| **Observaciones** | Se refresca cada 10 segundos; alimenta el centro de notificaciones ante tickets nuevos |

## 9. Panel de detalle de ticket

| Campo | Detalle |
|---|---|
| **Nombre** | `DetailDrawer` |
| **Archivo** | `web/app/admin/_components/DetailDrawer.tsx` |
| **Objetivo** | Gestionar por completo un ticket individual |
| **Descripción** | Panel lateral deslizante con tres pestañas: Info, Notas internas, Historial |
| **Componentes** | `Tabs`, badges de estado/prioridad/SLA, selector de asignación, botones de acción, galería de adjuntos, hilo de comentarios con plantillas |
| **Campos** | Selector "Asignar a", plantilla de respuesta (select), textarea de respuesta/nota |
| **Botones** | "Tomar", "Cerrar", "Reabrir", "Eliminar", "Responder", "Guardar nota" |
| **Validaciones** | El texto de comentario/nota no puede estar vacío; "Eliminar" pide confirmación |
| **Flujo de navegación** | Cambios de estado/asignación se guardan de inmediato y refrescan el listado; "Eliminar" cierra el panel y quita el ticket de la lista |
| **Permisos necesarios** | Sesión de staff (nivel ≥ 2) |
| **Observaciones** | Las notas internas nunca se muestran al empleado; el badge de SLA aparece a partir de 24h sin resolver |

## 10. Modal — Usuarios administradores

| Campo | Detalle |
|---|---|
| **Nombre** | `AdminManagerModal` |
| **Archivo** | `web/app/admin/_components/AdminManagerModal.tsx` |
| **Objetivo** | Gestionar el personal del sistema y sus permisos de módulo |
| **Descripción** | Modal accesible desde cualquier pantalla del panel admin (ícono de la barra superior) |
| **Componentes** | Listado de usuarios con chips de permiso, formulario de alta (solo superadmin) |
| **Campos** | Nombre completo*, Usuario*, Contraseña* (solo en el alta) |
| **Botones** | Chips de permiso (Equipos/Préstamos/Bitácora/Solicitudes/Usuarios), "Eliminar" por usuario, "Crear usuario" |
| **Validaciones** | Usuario 3-20 caracteres; contraseña mínimo 6; usuario único |
| **Flujo de navegación** | Las acciones se aplican de inmediato mediante llamadas a la API, sin cerrar el modal |
| **Permisos necesarios** | Ver el modal: nivel ≥ 2. Crear/eliminar usuarios y cambiar permisos: superadministrador |
| **Observaciones** | No se puede eliminar la propia cuenta ni al único administrador restante |

## 11. Inventario — Dashboard

| Campo | Detalle |
|---|---|
| **Nombre** | `DashboardView` |
| **Archivo** | `web/app/admin/inventario/_components/DashboardView.tsx` |
| **Objetivo** | Ofrecer una vista analítica rápida del estado del inventario |
| **Descripción** | Tres gráficos (estado, tipo, condición) más una lista de últimos ingresos |
| **Componentes** | Gráficos de dona/barras (Chart.js), lista de ítems recientes |
| **Campos** | Ninguno |
| **Botones** | Los segmentos de los gráficos son clicables y navegan a la vista "Equipos" filtrada |
| **Validaciones** | No aplica |
| **Flujo de navegación** | Clic en un segmento del gráfico → cambia a la vista "Equipos" con el filtro correspondiente aplicado |
| **Permisos necesarios** | Permiso de módulo "Inventario" (o superadmin) |
| **Observaciones** | Si no hay equipos registrados, muestra un estado vacío con botón para agregar el primero |

## 12. Inventario — Equipos

| Campo | Detalle |
|---|---|
| **Nombre** | `EquiposView` |
| **Archivo** | `web/app/admin/inventario/_components/EquiposView.tsx` |
| **Objetivo** | Listar y gestionar los equipos/lotes del inventario |
| **Descripción** | Buscador, filtro de estado y grilla de tarjetas de equipo (`InvCard`) |
| **Componentes** | Campo de búsqueda, select de estado, tarjetas de equipo |
| **Campos** | Búsqueda de texto libre, filtro de estado |
| **Botones** | "Nuevo equipo", por tarjeta: "Prestar"/"Devolver", editar, eliminar |
| **Validaciones** | No se puede eliminar un equipo con préstamo activo |
| **Flujo de navegación** | "Nuevo equipo"/editar → abre el modal de inventario (ficha 15). "Prestar" → abre el modal de préstamo (ficha 16). Clic en la tarjeta → abre "Equipos similares" (ficha 17) |
| **Permisos necesarios** | Permiso de módulo "Inventario" (o superadmin) |
| **Observaciones** | Los equipos "por cantidad" muestran un badge "X/Y disponibles" en vez de un estado único |

## 13. Inventario — Préstamos

| Campo | Detalle |
|---|---|
| **Nombre** | `PrestamosView` |
| **Archivo** | `web/app/admin/inventario/_components/PrestamosView.tsx` |
| **Objetivo** | Listar y gestionar los préstamos de equipo |
| **Descripción** | Buscador, filtro de estado y listas separadas de préstamos "Activos" e "Historial" |
| **Componentes** | Campo de búsqueda, select de estado, filas de préstamo |
| **Campos** | Búsqueda de texto libre, filtro de estado (Activos/Devueltos) |
| **Botones** | "Nuevo préstamo", por fila: "Retornado"/"Devolver (N pend.)", "Comprobante" |
| **Validaciones** | No se puede devolver más de lo pendiente |
| **Flujo de navegación** | "Nuevo préstamo" → modal de préstamo (ficha 16). "Devolver" → modal de devolución total o parcial (ficha 18). "Comprobante" → descarga directa de archivo `.doc` |
| **Permisos necesarios** | Permiso de módulo "Préstamos" (o superadmin) |
| **Observaciones** | Las filas con fecha estimada de devolución vencida se resaltan en rojo |

## 14. Inventario — Responsables

| Campo | Detalle |
|---|---|
| **Nombre** | `ResponsablesView` |
| **Archivo** | `web/app/admin/inventario/_components/ResponsablesView.tsx` |
| **Objetivo** | Ver el inventario agrupado por persona responsable o por ubicación física |
| **Descripción** | Buscador y tarjetas agrupadas, cada una con la lista de equipos correspondiente |
| **Componentes** | Campo de búsqueda, tarjetas de grupo (persona o ubicación) |
| **Campos** | Búsqueda de texto libre |
| **Botones** | Ícono de edición por equipo (abre el modal de inventario) |
| **Validaciones** | No aplica |
| **Flujo de navegación** | Clic en el ícono de edición → modal de inventario (ficha 15) |
| **Permisos necesarios** | Permiso de módulo "Préstamos" (o superadmin) |
| **Observaciones** | Los equipos sin responsable se agrupan por ubicación; los sin ubicación quedan bajo "Sin ubicación registrada" |

## 15. Modal — Nuevo/editar equipo

| Campo | Detalle |
|---|---|
| **Nombre** | `InventoryModal` |
| **Archivo** | `web/app/admin/inventario/_components/InventoryModal.tsx` |
| **Objetivo** | Capturar o editar los datos de un equipo/lote de inventario |
| **Descripción** | Formulario extenso con selector de modo, datos del equipo, foto y garantía |
| **Componentes** | Selector de modo de manejo, campos de datos, zona de foto (QR), sección de garantía plegable |
| **Campos** | Modo de manejo* (unidad/cantidad, bloqueado al editar), Tipo*, Marca*, Modelo, Serie* (modo unidad) o Cantidad total* (modo cantidad), Color, Condición, Estado, Ubicación, Responsable (autocompletado), Foto (QR), Notas, Garantía (inicio, vencimiento, proveedor) |
| **Botones** | "Cancelar", "Guardar equipo"/"Guardar cambios", "Tomar foto con el celular" |
| **Validaciones** | Tipo y marca obligatorios; serie obligatoria en modo unidad; cantidad entera ≥ 1 en modo cantidad |
| **Flujo de navegación** | "Tomar foto con el celular" → modal de QR (ficha 19). Al guardar con éxito → se cierra y refresca el listado |
| **Permisos necesarios** | Permiso de módulo "Inventario" (o superadmin) |
| **Observaciones** | El campo "Estado" queda bloqueado (solo lectura) si el equipo está actualmente en préstamo |

## 16. Modal — Registrar préstamo

| Campo | Detalle |
|---|---|
| **Nombre** | `LoanModal` |
| **Archivo** | `web/app/admin/inventario/_components/LoanModal.tsx` |
| **Objetivo** | Registrar el préstamo de un equipo/lote a un empleado |
| **Descripción** | Formulario con autocompletado de equipo y de empleado |
| **Componentes** | Autocompletado de equipo (solo disponibles), campo de cantidad (si aplica), autocompletado de empleado, select de autorizante |
| **Campos** | Equipo a prestar*, Cantidad (si es lote), Empleado/Responsable*, Departamento, Fecha estimada de devolución, Autorizado por, Notas |
| **Botones** | "Cancelar", "Registrar préstamo" |
| **Validaciones** | Equipo y empleado obligatorios; cantidad entera dentro del stock disponible |
| **Flujo de navegación** | Puede abrirse vacío o con un equipo preseleccionado (desde la tarjeta de un equipo). Al registrar, se cierra y refresca inventario/préstamos |
| **Permisos necesarios** | Permiso de módulo "Préstamos" (o superadmin) |
| **Observaciones** | Solo lista equipos con al menos una unidad disponible |

## 17. Modal — Equipos similares

| Campo | Detalle |
|---|---|
| **Nombre** | `SimilarEquiposModal` |
| **Archivo** | `web/app/admin/inventario/_components/SimilarEquiposModal.tsx` |
| **Objetivo** | Mostrar de un vistazo todos los equipos del mismo tipo, marca y modelo |
| **Descripción** | Modal ancho con una grilla de tarjetas de equipo (mismo componente `InvCard` que en "Equipos") |
| **Componentes** | Grilla de tarjetas |
| **Campos** | Ninguno |
| **Botones** | Los mismos de cada tarjeta (prestar/devolver, editar, eliminar) |
| **Validaciones** | Las mismas de las acciones subyacentes |
| **Flujo de navegación** | Se abre al hacer clic en el encabezado de una tarjeta de equipo desde "Equipos" o "Equipos similares" |
| **Permisos necesarios** | Permiso de módulo "Inventario" (o superadmin) |
| **Observaciones** | Útil para verificar cuántas unidades de un mismo modelo existen y su estado individual |

## 18. Modal — Confirmar devolución / Devolución parcial

| Campo | Detalle |
|---|---|
| **Nombre** | `ReturnConfirmModal` y `PartialReturnModal` |
| **Archivo** | `web/app/admin/inventario/_components/ReturnModals.tsx` |
| **Objetivo** | Registrar la devolución de un préstamo, total o parcial |
| **Descripción** | Modal compacto con los datos del préstamo y el equipo, más el formulario de devolución |
| **Componentes** | Resumen del préstamo, select de condición, campo de unidades (solo en la variante parcial), textarea de nota |
| **Campos** | Unidades a devolver (solo devolución parcial), Condición al devolver, Nota (opcional) |
| **Botones** | "Cancelar", "Confirmar devolución" / "Registrar devolución" |
| **Validaciones** | Unidades a devolver entre 1 y lo pendiente |
| **Flujo de navegación** | Al confirmar, se cierra el modal y se actualiza el préstamo (y el estado del equipo si corresponde) |
| **Permisos necesarios** | Permiso de módulo "Préstamos" (o superadmin) |
| **Observaciones** | Si la condición es "Dañado" y el equipo es "por unidad", pasa a "En reparación" en vez de "Disponible" |

## 19. Modal — Foto del equipo desde celular (QR)

| Campo | Detalle |
|---|---|
| **Nombre** | `QRPhotoModal` |
| **Archivo** | `web/app/admin/inventario/_components/QRPhotoModal.tsx` |
| **Objetivo** | Capturar una foto del equipo desde el celular, para asociarla al formulario de inventario |
| **Descripción** | Idéntico en mecánica al modal de QR del portal (ficha 5), con textos/estilos del panel admin |
| **Componentes** | Imagen QR, instrucciones, cuenta regresiva |
| **Campos** | Ninguno |
| **Botones** | "Cancelar", "Usar esta foto", "Generar nuevo QR" |
| **Validaciones** | Solo admite imágenes (no video) para este flujo |
| **Flujo de navegación** | Al confirmar, la foto queda enlazada al formulario de equipo (ficha 15) |
| **Permisos necesarios** | Permiso de módulo "Inventario" (para abrir el modal); el celular no requiere sesión |
| **Observaciones** | Sesión de 5 minutos, igual que el flujo de tickets |

## 20. Pantalla de gestión de usuarios

| Campo | Detalle |
|---|---|
| **Nombre** | `UsuariosApp` (página `/admin/usuarios`) |
| **Archivo** | `web/app/admin/usuarios/page.tsx` |
| **Objetivo** | Administrar cuentas de usuario y solicitudes de registro |
| **Descripción** | Estadísticas, tarjeta de solicitudes con pestañas de estado, y listado de usuarios agrupado |
| **Componentes** | `UsrStatsRow`, `SolicitudesCard`, `UsuariosList`, `UserDetailModal` |
| **Campos** | Búsqueda de texto en el listado de usuarios |
| **Botones** | "Aprobar"/"Rechazar" (solicitudes), "Ver", "Activar"/"Desactivar", "Eliminar" (por usuario) |
| **Validaciones** | No se puede desactivar/eliminar la propia cuenta ni al único administrador |
| **Flujo de navegación** | "Ver" → abre el modal de detalle de usuario (ficha 21) |
| **Permisos necesarios** | Ver solicitudes: permiso "Solicitudes" (o superadmin). Ver listado completo con datos personales: permiso "Usuarios" (o superadmin) |
| **Observaciones** | El listado separa "Usuarios del sistema" (staff) de "Empleados" |

## 21. Modal — Detalle de usuario

| Campo | Detalle |
|---|---|
| **Nombre** | `UserDetailModal` |
| **Archivo** | `web/app/admin/usuarios/_components/UserDetailModal.tsx` |
| **Objetivo** | Ver el perfil completo de un usuario y sus tickets reportados |
| **Descripción** | Modal con pestañas "Perfil" y "Tickets" |
| **Componentes** | Avatar, datos de contacto, sección de cambio de contraseña (solo superadmin), resumen y listado de tickets |
| **Campos** | Nueva contraseña (solo superadmin) |
| **Botones** | "Guardar" (contraseña), fila de ticket clicable ("Ver ticket") |
| **Validaciones** | Contraseña nueva mínimo 6 caracteres |
| **Flujo de navegación** | Clic en un ticket → navega a `/admin?ticket=ID`, abriendo ese ticket en la bandeja principal |
| **Permisos necesarios** | Ver el modal: permiso "Usuarios" (o superadmin). Cambiar contraseña: superadministrador |
| **Observaciones** | La sección de contraseña solo se muestra si quien ve el modal es superadministrador |

## 22. Pantalla de bitácora / auditoría

| Campo | Detalle |
|---|---|
| **Nombre** | `AuditoriaApp` (página `/admin/auditoria`) |
| **Archivo** | `web/app/admin/auditoria/page.tsx` |
| **Objetivo** | Consultar el historial de acciones administrativas del sistema |
| **Descripción** | Tabla con filtros, hasta 300 registros por consulta |
| **Componentes** | Filtros (usuario con autocompletado, área, fechas), tabla de resultados |
| **Campos** | Usuario (texto con sugerencias), Área/entidad (select), Fecha desde, Fecha hasta |
| **Botones** | "Limpiar" (filtros) |
| **Validaciones** | Ninguna sobre los filtros (todos opcionales) |
| **Flujo de navegación** | Los filtros se aplican de inmediato al modificarse, sin botón de "Buscar" adicional |
| **Permisos necesarios** | Permiso de módulo "Bitácora" (o superadmin) |
| **Observaciones** | Cada registro muestra fecha/hora, usuario responsable, área afectada y el detalle de la acción |

<div style="page-break-after: always;"></div>

*Fin de la Documentación de Pantallas — GCM Tickets v1.0*
