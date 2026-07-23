---
title: "Anexos"
subtitle: "GCM Tickets — Sistema de Soporte Técnico"
---

<div align="center">

# ANEXOS

## GCM Tickets
### Sistema de Soporte Técnico, Inventario y Préstamos

**Grupo Milcien S.A. de C.V.**

Versión del documento: 1.0
Fecha: Julio 2026

</div>

<div style="page-break-after: always;"></div>

## Tabla de contenido

1. [Glosario de términos](#1-glosario-de-términos)
2. [Acrónimos](#2-acrónimos)
3. [Referencias](#3-referencias)
4. [Versionado del documento](#4-versionado-del-documento)
5. [Historial de cambios](#5-historial-de-cambios)

<div style="page-break-after: always;"></div>

## 1. Glosario de términos

| Término | Definición |
|---|---|
| Ticket | Solicitud de soporte técnico registrada por un empleado |
| Folio | Identificador legible de un registro (`TK-001`, `INV-001`, `PREST-001`, `DEV-001`), generado de forma secuencial |
| Staff | Personal de TI: técnico, administrador o superadministrador |
| Rol | Nivel de autorización de una cuenta: empleado, técnico, admin o superadmin |
| Permiso de módulo | Autorización específica e independiente del rol, otorgada por el superadministrador, para usar Inventario, Préstamos, Bitácora, Solicitudes o Usuarios |
| Nota interna | Mensaje de un ticket visible únicamente para el personal de TI |
| Comentario | Mensaje de un ticket visible tanto para el empleado como para el personal de TI |
| Historial de ticket | Registro cronológico de los cambios realizados sobre un ticket (estado, asignación, campos editados) |
| Bitácora / auditoría | Registro histórico de las acciones administrativas del sistema (quién, qué, cuándo) |
| Inventario por unidad | Modalidad de inventario para equipos físicos individuales, identificados por número de serie, prestables a una sola persona a la vez |
| Inventario por cantidad | Modalidad de inventario para lotes de artículos sin serie individual (ej. cables, mouse), con una cantidad total y varias unidades prestables simultáneamente |
| Préstamo activo | Préstamo cuyo equipo/cantidad aún no ha sido devuelto en su totalidad |
| Devolución parcial | Devolución de solo una parte de las unidades prestadas de un lote |
| Solicitud de registro | Petición de alta de cuenta enviada por un futuro empleado, pendiente de aprobación |
| Sesión móvil (QR) | Mecanismo temporal (5 minutos) que permite subir un archivo desde un celular sin iniciar sesión, identificado por un token generado al escanear un código QR |
| Finca | Ubicación agrícola de la empresa, seleccionable durante el registro de un empleado |
| SLA (uso interno del sistema) | Indicador visual de antigüedad de un ticket sin resolver (24h de aviso, 48h de alerta crítica); no corresponde a un acuerdo contractual formal, es una convención de la interfaz |
| Dispositivo (taller) | Equipo externo (de un cliente/área) recibido para diagnóstico o reparación, que genera automáticamente un ticket de soporte asociado |

## 2. Acrónimos

| Acrónimo | Significado |
|---|---|
| API | Application Programming Interface (Interfaz de Programación de Aplicaciones) |
| REST | Representational State Transfer (estilo arquitectónico de servicios web) |
| JWT | JSON Web Token |
| HTTP | HyperText Transfer Protocol |
| HTTPS | HTTP Secure |
| JSON | JavaScript Object Notation |
| SQL | Structured Query Language |
| SP | Stored Procedure (procedimiento almacenado) |
| FK | Foreign Key (clave foránea) |
| PK | Primary Key (clave primaria) |
| ORM | Object-Relational Mapping (no utilizado en este proyecto; el acceso a datos es directo vía `mssql`) |
| CORS | Cross-Origin Resource Sharing |
| SMTP | Simple Mail Transfer Protocol |
| QR | Quick Response (código de respuesta rápida) |
| TI | Tecnologías de la Información |
| SLA | Service Level Agreement (Acuerdo de Nivel de Servicio) — ver nota en el glosario |
| PM2 | Process Manager 2 (gestor de procesos de Node.js) |
| SSR | Server-Side Rendering (renderizado en el servidor) |
| SPA | Single Page Application (aplicación de una sola página) |
| CRUD | Create, Read, Update, Delete (crear, leer, actualizar, eliminar) |
| DTO | Data Transfer Object (objeto de transferencia de datos) |

## 3. Referencias

Documentación oficial de las tecnologías utilizadas en el sistema, citada como referencia técnica:

| Tecnología | Referencia |
|---|---|
| Node.js | https://nodejs.org |
| Express | https://expressjs.com |
| TypeScript | https://www.typescriptlang.org |
| Next.js | https://nextjs.org |
| React | https://react.dev |
| Tailwind CSS | https://tailwindcss.com |
| SWR | https://swr.vercel.app |
| Chart.js | https://www.chartjs.org |
| SQL Server | https://learn.microsoft.com/sql |
| JSON Web Tokens | https://jwt.io |
| bcrypt (npm) | https://www.npmjs.com/package/bcrypt |
| Helmet | https://www.npmjs.com/package/helmet |
| Multer | https://www.npmjs.com/package/multer |
| Nodemailer | https://www.npmjs.com/package/nodemailer |
| PM2 | https://pm2.keymetrics.io |

## 4. Versionado del documento

Este conjunto documental (Manual Técnico, Manual de Usuario, Documento Funcional, Documentación de Pantallas y Anexos) se versiona de forma conjunta.

| Documento | Versión | Fecha |
|---|---|---|
| Manual Técnico | 1.0 | Julio 2026 |
| Manual de Usuario | 1.0 | Julio 2026 |
| Documento Funcional | 1.0 | Julio 2026 |
| Documentación de Pantallas | 1.0 | Julio 2026 |
| Anexos | 1.0 | Julio 2026 |

**Fuente de la documentación:** análisis directo del código fuente del repositorio (`api/`, `web/`) y de los scripts de operación, en la fecha indicada. Cualquier cambio posterior en el código debe reflejarse actualizando esta documentación y registrando el cambio en la sección siguiente.

## 5. Historial de cambios

| Versión | Fecha | Descripción | Autor |
|---|---|---|---|
| 1.0 | Julio 2026 | Primera versión del conjunto documental completo (Manual Técnico, Manual de Usuario, Documento Funcional, Documentación de Pantallas y Anexos), generada a partir del análisis del código fuente vigente a esta fecha | Documentación técnica asistida — Grupo Milcien S.A. de C.V. |

<div style="page-break-after: always;"></div>

*Fin de los Anexos — GCM Tickets v1.0*
