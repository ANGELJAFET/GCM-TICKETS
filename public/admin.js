const SESSION_KEY   = 'soporte_admin_session';
const NOMBRE_KEY    = 'soporte_admin_nombre';
const USERNAME_KEY  = 'soporte_admin_username';
const DARK_KEY      = 'gcm_dark';

function toggleDarkMode() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem(DARK_KEY, dark ? '1' : '0');
  const icon = document.querySelector('#darkModeBtn i');
  if (icon) icon.className = dark ? 'ti ti-sun' : 'ti ti-moon';
}

(function() {
  const icon = document.querySelector('#darkModeBtn i');
  if (icon && localStorage.getItem(DARK_KEY) === '1') icon.className = 'ti ti-sun';
})();

let currentTab    = 'todos';
let currentPage   = 1;
const PAGE_SIZE   = 10;
let selectedId    = null;
let ticketCache   = [];
let adminNombre   = sessionStorage.getItem(NOMBRE_KEY) || 'Admin';
let prevTicketIds = null;
let chartStatus   = null;
let chartTech     = null;
let chartCat      = null;
let currentDetailTab = 'info';
let inventoryCache  = [];
let loansCache      = [];
let currentInvView  = 'dashboard';
let editingInvId    = null;
let invCharts       = {};
let usuariosCache   = [];
let solicitudesCache = [];
let usrSolFilter    = 'pendiente';
let usrSearch       = '';
let adminsCache     = [];

const TEMPLATES = [
  { label: 'Acuse de recibo',    text: 'Hemos recibido su solicitud y la estamos atendiendo. Le mantendremos informado del avance.' },
  { label: 'Solicitar más info', text: 'Para continuar con la atención, necesitamos información adicional. ¿Podría darnos más detalles sobre el problema?' },
  { label: 'En proceso',         text: 'Su ticket está siendo atendido. Estimamos resolverlo en las próximas 24 horas.' },
  { label: 'Solución aplicada',  text: 'Hemos aplicado una solución. Por favor verifique si el inconveniente fue resuelto y confírmenos.' },
  { label: 'Cierre',             text: 'Damos por resuelto su ticket. Gracias por comunicarse con soporte técnico. Cualquier problema adicional, no dude en crear un nuevo ticket.' }
];


// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.rol_nivel < 2) {
        const el = document.getElementById('loginError');
        el.innerHTML = '<i class="ti ti-ban"></i> Sin permisos para acceder al panel administrativo';
        el.classList.add('show');
        document.getElementById('loginPass').value = '';
        return;
      }
      adminNombre = data.nombre || u;
      sessionStorage.setItem(SESSION_KEY, '1');
      sessionStorage.setItem(NOMBRE_KEY, adminNombre);
      sessionStorage.setItem(USERNAME_KEY, u);
      document.getElementById('adminBadge').textContent = adminNombre.toUpperCase();
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainApp').classList.add('visible');
      await initNotifications();
      await loadAdmins();
      await refreshTickets();
      await loadDevices();
      await loadUsersData();

      if (currentTab === 'inventario') renderInventorySection();
      else if (currentTab === 'usuarios') renderUsersSection();
      else if (currentTab === 'auditoria') loadAuditData();
    } else {
      document.getElementById('loginError').classList.add('show');
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }
  } catch {
    const el = document.getElementById('loginError');
    el.textContent = 'No se pudo conectar al servidor.';
    el.classList.add('show');
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(NOMBRE_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
  location.reload();
}

document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPass').focus(); });

// ── Notifications ─────────────────────────────────────────────────────────────
let notifList   = [];
let notifUnread = 0;
let notifOpen   = false;

async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}

function pushNotif(icon, title, body, color) {
  const time = new Date().toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  notifList.unshift({ icon, title, body, color, ts: Date.now(), time });
  if (notifList.length > 50) notifList.length = 50;
  notifUnread++;
  const dot = document.getElementById('notifDot');
  if (dot) { dot.style.display = 'block'; dot.textContent = notifUnread > 9 ? '9+' : notifUnread; }
  if (!notifOpen) return;
  renderNotifPanel();
}

function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  notifOpen = !panel.classList.contains('open');
  if (notifOpen) {
    notifUnread = 0;
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';
    renderNotifPanel();
  }
  panel.classList.toggle('open', notifOpen);
}

function closeNotifPanel() {
  notifOpen = false;
  document.getElementById('notifPanel')?.classList.remove('open');
}

function renderNotifPanel() {
  const body = document.getElementById('notifPanelBody');
  if (!body) return;
  if (!notifList.length) {
    body.innerHTML = `
<div class="np-empty">
  <i class="ti ti-bell-off"></i>
  <p>Sin notificaciones</p>
</div>`;
    return;
  }
  body.innerHTML = notifList.map(n => `
<div class="np-item">
  <div class="np-icon" style="background:${n.color}22;color:${n.color}">
    <i class="ti ${n.icon}"></i>
  </div>
  <div class="np-content">
    <div class="np-title">${n.title}</div>
    <div class="np-body-text">${n.body}</div>
    <div class="np-time">${n.time}</div>
  </div>
</div>`).join('');
}

function clearNotifs() {
  notifList = [];
  notifUnread = 0;
  const dot = document.getElementById('notifDot');
  if (dot) dot.style.display = 'none';
  renderNotifPanel();
}

document.addEventListener('click', e => {
  if (!notifOpen) return;
  const panel = document.getElementById('notifPanel');
  const btn   = document.getElementById('notifBtn');
  if (panel && !panel.contains(e.target) && !btn.contains(e.target)) closeNotifPanel();
});

function checkNewTickets(tickets) {
  const ids = new Set(tickets.map(t => t.id));
  if (prevTicketIds === null) { prevTicketIds = ids; return; }
  const newIds = [...ids].filter(id => !prevTicketIds.has(id));
  newIds.forEach(id => {
    const t = tickets.find(t => t.id === id);
    if (!t) return;
    pushNotif('ti-ticket', `Nuevo ticket — ${t.title}`,
      `${t.reporter} · ${t.categoria} · ${t.prioridad}`, '#3b82f6');
    if (Notification.permission === 'granted') {
      new Notification(`Nuevo ticket — ${t.title}`, {
        body: `${t.reporter} · ${t.categoria} · ${t.prioridad}`
      });
    }
  });
  prevTicketIds = ids;
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

async function loadAdmins() {
  try {
    adminsCache = await api('/api/admins');
  } catch { adminsCache = []; }
  const sel = document.getElementById('filterAsignado');
  if (sel) {
    sel.innerHTML = '<option value="">Técnico</option>'
      + adminsCache.map(a => `<option value="${a.nombre}">${a.nombre}</option>`).join('')
      + '<option value="Sin asignar">Sin asignar</option>';
  }
}

async function refreshTickets() {
  if (!sessionStorage.getItem(SESSION_KEY)) return;
  try {
    const tickets = await api('/api/tickets');
    checkNewTickets(tickets);
    ticketCache = tickets;
    renderList();
  } catch {
    showToast('Error al conectar con el servidor');
  }
}

// ── SLA ───────────────────────────────────────────────────────────────────────
function slaHtml(t) {
  if (t.status === 'cerrado' || !t.fechaTs) return '';
  const h = (Date.now() - t.fechaTs) / 3600000;
  if (h >= 48) return `<span class="sla-badge sla-critical"><i class="ti ti-alarm" style="font-size:10px"></i> SLA +${Math.floor(h)}h</span>`;
  if (h >= 24) return `<span class="sla-badge sla-warn"><i class="ti ti-clock" style="font-size:10px"></i> SLA ${Math.floor(h)}h</span>`;
  return '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBadge(s) {
  const map = {
    abierto:     '<span class="badge badge-open"><i class="ti ti-circle-dot" style="font-size:11px"></i> Abierto</span>',
    en_progreso: '<span class="badge badge-progress"><i class="ti ti-loader" style="font-size:11px"></i> En progreso</span>',
    cerrado:     '<span class="badge badge-closed"><i class="ti ti-circle-check" style="font-size:11px"></i> Cerrado</span>'
  };
  return map[s] || '';
}

function prioBadge(p) {
  const cls  = { 'Crítica':'badge-critical','Alta':'badge-high','Media':'badge-medium','Baja':'badge-low' };
  const icon = { 'Crítica':'ti-alert-triangle','Alta':'ti-arrow-up','Media':'ti-minus','Baja':'ti-arrow-down' };
  return `<span class="badge ${cls[p]||'badge-low'}"><i class="ti ${icon[p]||'ti-minus'}" style="font-size:11px"></i> ${p}</span>`;
}

function avatarHtml(name) {
  const cls = name === 'Sin asignar' ? 'av-gray' : 'av-blue';
  const initials = name === 'Sin asignar' ? '?' : (name||'?').substring(0,2).toUpperCase();
  return `<span class="avatar ${cls}">${initials}</span>`;
}

function commentHtml(c) {
  const isUser = c.startsWith('[U]');
  const text   = isUser ? c.slice(3).trim() : c;
  const icon   = isUser
    ? '<i class="ti ti-user-circle" style="font-size:12px;color:var(--blue);vertical-align:-1px"></i>'
    : '<i class="ti ti-headset" style="font-size:12px;color:var(--gray);vertical-align:-1px"></i>';
  return `<div class="comment-item ${isUser ? 'user-msg' : 'admin-msg'}">${icon} ${text}</div>`;
}

function nowHM() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function isImage(filePath) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filePath);
}
function isVideo(filePath) {
  return /\.(mp4|mov|avi|webm|3gp)$/i.test(filePath);
}

function attachmentHtml(a) {
  if (isImage(a.path)) {
    return `
      <div class="attachment-item attachment-image-item">
        <a href="${a.path}" target="_blank" class="attachment-img-link">
          <img src="${a.path}" alt="${a.name}" class="attachment-preview">
          <div class="attachment-img-overlay"><i class="ti ti-zoom-in"></i></div>
        </a>
        <div class="attachment-img-info">
          <span class="attachment-img-name"><i class="ti ti-photo" style="font-size:12px"></i> ${a.name}</span>
          <span class="attachment-size">${fmtSize(a.size)} · ${a.ts}</span>
        </div>
      </div>`;
  }
  if (isVideo(a.path)) {
    return `
      <div class="attachment-item attachment-video-item">
        <video class="attachment-video" src="${a.path}" controls playsinline preload="metadata"></video>
        <div class="attachment-img-info">
          <span class="attachment-img-name"><i class="ti ti-video" style="font-size:12px"></i> ${a.name}</span>
          <span class="attachment-size">${fmtSize(a.size)} · ${a.ts}</span>
        </div>
      </div>`;
  }
  const iconMap = { pdf:'ti-file-type-pdf', docx:'ti-file-type-doc', xlsx:'ti-file-spreadsheet', txt:'ti-file-text', zip:'ti-file-zip', log:'ti-file-code' };
  const ext  = (a.name.split('.').pop() || '').toLowerCase();
  const icon = iconMap[ext] || 'ti-paperclip';
  return `
    <div class="attachment-item">
      <i class="ti ${icon}" style="color:var(--blue);font-size:18px"></i>
      <a href="${a.path}" target="_blank">${a.name}</a>
      <span class="attachment-size">${fmtSize(a.size)}</span>
    </div>`;
}

function clearFilters() {
  document.getElementById('searchInput').value   = '';
  document.getElementById('prioridad').value     = '';
  document.getElementById('categoria').value     = '';
  document.getElementById('filterAsignado').value = '';
  document.getElementById('dateFrom').value      = '';
  document.getElementById('dateTo').value        = '';
  currentPage = 1;
  renderList();
}

function ticketCardHtml(t) {
  return `
    <div class="ticket-card${t.id === selectedId ? ' selected' : ''} prio-${t.prioridad}" onclick="openDetail('${t.id}')">
      <div class="ticket-top">
        <div>
          <div class="ticket-id">${t.id} · ${t.categoria} · <i class="ti ti-user" style="font-size:11px;vertical-align:-1px"></i> ${t.reporter||'—'}</div>
          <div class="ticket-title">${t.title}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${prioBadge(t.prioridad)}
          ${slaHtml(t)}
        </div>
      </div>
      <div class="ticket-desc">${(t.desc||'').length > 100 ? (t.desc||'').substring(0,100) + '...' : (t.desc||'')}</div>
      <div class="ticket-meta">
        ${statusBadge(t.status)}
        <span style="font-size:11px;color:var(--gray)"><i class="ti ti-message" style="font-size:12px;vertical-align:-1px"></i> ${t.comments.length}</span>
        ${(t.attachments||[]).length ? `<span style="font-size:11px;color:var(--gray)"><i class="ti ti-paperclip" style="font-size:12px;vertical-align:-1px"></i> ${t.attachments.length}</span>` : ''}
        ${t.asignado === 'Sin asignar' ? '<span style="font-size:11px;color:var(--red);font-weight:600"><i class="ti ti-alert-circle" style="font-size:11px"></i> Sin asignar</span>' : ''}
      </div>
      <div class="ticket-footer">
        <div class="assignee">${avatarHtml(t.asignado)}<span>${t.asignado}</span></div>
        <span class="ticket-date"><i class="ti ti-calendar" style="font-size:12px"></i> ${t.fecha}</span>
      </div>
    </div>`;
}

function groupHeaderHtml(title, icon, cls, count) {
  return `<div class="group-header ${cls}"><span class="group-header-label"><i class="ti ${icon}"></i> ${title}</span><span class="group-count">${count}</span></div>`;
}

// ── Tabs / Filtros ────────────────────────────────────────────────────────────
function setTab(tab, btn) {
  currentTab  = tab;
  currentPage = 1;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const isInv   = tab === 'inventario';
  const isUsr   = tab === 'usuarios';
  const isAudit = tab === 'auditoria';
  const isSpecial = isInv || isUsr || isAudit;

  document.getElementById('receptionSection').style.display = (isSpecial && !isAudit) ? '' : 'none';
  document.getElementById('auditSection').style.display     = isAudit ? '' : 'none';
  document.getElementById('statsGrid').style.display        = isSpecial ? 'none' : '';
  document.getElementById('ticketsList').style.display      = isSpecial ? 'none' : '';
  document.getElementById('pagination').style.display       = isSpecial ? 'none' : '';
  document.getElementById('filterRow').style.display        = isSpecial ? 'none' : '';
  const toolbar = document.querySelector('.ion-toolbar');
  if (toolbar) toolbar.style.display = isSpecial ? 'none' : '';
  if (isSpecial) document.getElementById('chartsSection').style.display = 'none';

  const invBtn   = document.getElementById('inventarioHeaderBtn');
  const usrBtn   = document.getElementById('usuariosHeaderBtn');
  const audBtn   = document.getElementById('auditoriaHeaderBtn');
  if (invBtn) invBtn.classList.toggle('inv-header-active', isInv);
  if (usrBtn) usrBtn.classList.toggle('inv-header-active', isUsr);
  if (audBtn) audBtn.classList.toggle('inv-header-active', isAudit);

  if (isInv)   renderInventorySection();
  else if (isUsr)   loadUsersData();
  else if (isAudit) loadAuditData();
  else          renderList();
}

function toggleInventario() {
  if (currentTab === 'inventario') {
    setTab('todos', document.querySelector('.tab-btn'));
  } else {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    setTab('inventario', null);
  }
}

function toggleUsuarios() {
  if (currentTab === 'usuarios') {
    setTab('todos', document.querySelector('.tab-btn'));
  } else {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    setTab('usuarios', null);
  }
}

function toggleAuditoria() {
  if (currentTab === 'auditoria') {
    setTab('todos', document.querySelector('.tab-btn'));
  } else {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    setTab('auditoria', null);
  }
}

async function loadUsersData() {
  try {
    const [usersRes, solsRes] = await Promise.all([
      fetch('/api/usuarios'),
      fetch('/api/solicitudes')
    ]);
    usuariosCache    = usersRes.ok  ? await usersRes.json()  : [];
    solicitudesCache = solsRes.ok   ? await solsRes.json()   : [];
    const pendientes = solicitudesCache.filter(s => s.estado === 'pendiente').length;
    const el = document.getElementById('cnt-usuarios');
    if (el) el.textContent = pendientes || '';
    if (currentTab === 'usuarios') renderUsersSection();
  } catch (e) {
    console.error('loadUsersData:', e);
  }
}

function getFiltered() {
  const q        = document.getElementById('searchInput').value.toLowerCase();
  const prio     = document.getElementById('prioridad').value;
  const cat      = document.getElementById('categoria').value;
  const asignado = document.getElementById('filterAsignado').value;
  const dateFrom = document.getElementById('dateFrom').value ? new Date(document.getElementById('dateFrom').value).getTime() : null;
  const dateTo   = document.getElementById('dateTo').value   ? new Date(document.getElementById('dateTo').value).getTime() + 86399999 : null;

  return ticketCache.filter(t => {
    if (currentTab !== 'todos' && t.status !== currentTab) return false;
    if (prio     && t.prioridad !== prio)     return false;
    if (cat      && t.categoria !== cat)      return false;
    if (asignado && t.asignado  !== asignado) return false;
    if (dateFrom && t.fechaTs   < dateFrom)   return false;
    if (dateTo   && t.fechaTs   > dateTo)     return false;
    if (q && !t.title.toLowerCase().includes(q)
          && !(t.desc||'').toLowerCase().includes(q)
          && !t.id.toLowerCase().includes(q)
          && !(t.reporter||'').toLowerCase().includes(q)) return false;
    return true;
  });
}

// ── Charts ────────────────────────────────────────────────────────────────────
function renderCharts(all) {
  const section = document.getElementById('chartsSection');
  if (currentTab !== 'todos' || all.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const statusCounts = { 'Abierto': 0, 'En progreso': 0, 'Cerrado': 0 };
  const techCounts   = {};
  const catCounts    = {};

  all.forEach(t => {
    const sLabel = { abierto:'Abierto', en_progreso:'En progreso', cerrado:'Cerrado' }[t.status] || t.status;
    statusCounts[sLabel] = (statusCounts[sLabel] || 0) + 1;
    const tech = t.asignado || 'Sin asignar';
    techCounts[tech] = (techCounts[tech] || 0) + 1;
    const cat = t.categoria || 'Otro';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const ctxS = document.getElementById('chartStatus').getContext('2d');
  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(ctxS, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#3b82f6','#f59e0b','#10b981'], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });

  const ctxT = document.getElementById('chartTech').getContext('2d');
  if (chartTech) chartTech.destroy();
  chartTech = new Chart(ctxT, {
    type: 'bar',
    data: {
      labels: Object.keys(techCounts),
      datasets: [{ label: 'Tickets', data: Object.values(techCounts), backgroundColor: '#3b82f6', borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });

  const ctxC = document.getElementById('chartCat').getContext('2d');
  if (chartCat) chartCat.destroy();
  chartCat = new Chart(ctxC, {
    type: 'pie',
    data: {
      labels: Object.keys(catCounts),
      datasets: [{ data: Object.values(catCounts), backgroundColor: ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444'], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
  });
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderList() {
  if (!sessionStorage.getItem(SESSION_KEY)) return;
  if (currentTab === 'inventario') return;

  const all    = ticketCache;
  const list   = getFiltered();
  const counts = { todos: all.length, abierto: 0, en_progreso: 0, cerrado: 0 };
  all.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  ['todos','abierto','en_progreso','cerrado'].forEach(k => {
    const el = document.getElementById('cnt-' + k);
    if (el) el.textContent = counts[k];
  });

  const sinAsignar = all.filter(t => t.asignado === 'Sin asignar').length;
  const criticos   = all.filter(t => t.prioridad === 'Crítica' && t.status !== 'cerrado').length;
  const slaAlert   = all.filter(t => t.status !== 'cerrado' && t.fechaTs && (Date.now() - t.fechaTs) >= 86400000).length;

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card blue">  <div class="icon"><i class="ti ti-ticket"          style="color:var(--blue)"></i></div><div class="val">${counts.todos}</div>     <div class="lbl">Total tickets</div></div>
    <div class="stat-card amber"> <div class="icon"><i class="ti ti-circle-dot"       style="color:var(--amber)"></i></div><div class="val">${counts.abierto}</div>   <div class="lbl">Abiertos</div></div>
    <div class="stat-card red">   <div class="icon"><i class="ti ti-loader"           style="color:var(--red)"></i></div><div class="val">${counts.en_progreso}</div> <div class="lbl">En progreso</div></div>
    <div class="stat-card green"> <div class="icon"><i class="ti ti-circle-check"     style="color:var(--green)"></i></div><div class="val">${counts.cerrado}</div>   <div class="lbl">Cerrados</div></div>
    <div class="stat-card purple"><div class="icon"><i class="ti ti-user-off"         style="color:var(--purple)"></i></div><div class="val">${sinAsignar}</div>      <div class="lbl">Sin asignar</div></div>
    <div class="stat-card orange"><div class="icon"><i class="ti ti-alert-triangle"   style="color:var(--orange)"></i></div><div class="val">${criticos}</div>       <div class="lbl">Críticos activos</div></div>
  `;
  if (slaAlert > 0) {
    document.getElementById('notifDot').style.display = 'block';
  }

  renderCharts(all);

  const total      = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const el = document.getElementById('ticketsList');
  if (!list.length) {
    el.innerHTML = '<div class="empty"><i class="ti ti-search-off"></i><p>No se encontraron tickets</p></div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  if (currentTab !== 'todos') {
    const myAll    = list.filter(t => t.asignado === adminNombre);
    const otherAll = list.filter(t => t.asignado !== adminNombre);
    const myPage    = pageList.filter(t => t.asignado === adminNombre);
    const otherPage = pageList.filter(t => t.asignado !== adminNombre);
    let html = '';
    if (myPage.length) {
      html += groupHeaderHtml('Mis tickets', 'ti-user-check', 'mine', myAll.length);
      html += myPage.map(ticketCardHtml).join('');
    }
    if (otherPage.length) {
      html += groupHeaderHtml('Otros técnicos', 'ti-users', 'others', otherAll.length);
      html += otherPage.map(ticketCardHtml).join('');
    }
    el.innerHTML = html;
  } else {
    el.innerHTML = pageList.map(ticketCardHtml).join('');
  }

  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let btns = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}><i class="ti ti-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) btns += `<span class="page-info">…</span>`;
      continue;
    }
    btns += `<button class="page-btn${i===currentPage?' active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  btns += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}><i class="ti ti-chevron-right"></i></button>`;
  btns += `<span class="page-info">${(currentPage-1)*PAGE_SIZE+1}–${Math.min(currentPage*PAGE_SIZE,total)} de ${total}</span>`;
  pag.innerHTML = btns;
}

function goPage(n) {
  currentPage = n;
  renderList();
  document.querySelector('.ion-content').scrollTop = 0;
}

// ── Panel detalle ─────────────────────────────────────────────────────────────
function openDetail(id) {
  const t = ticketCache.find(x => x.id === id);
  if (!t) return;
  selectedId = id;
  currentDetailTab = 'info';
  renderList();

  document.getElementById('detailTitle').textContent = t.id + ' — ' + t.title.substring(0,30) + (t.title.length>30?'…':'');
  document.getElementById('detailBadge').innerHTML   = statusBadge(t.status);
  document.querySelectorAll('.dtab').forEach((b,i) => b.classList.toggle('active', i===0));

  renderDetailTab(t);
  document.getElementById('detailPanel').classList.add('open');
  document.getElementById('dim').classList.add('open');
}

function switchDetailTab(tab, btn) {
  currentDetailTab = tab;
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const t = ticketCache.find(x => x.id === selectedId);
  if (t) renderDetailTab(t);
}

function renderDetailTab(t) {
  const body = document.getElementById('detailBody');

  if (currentDetailTab === 'info') {
    const userReplies = t.comments.filter(c => c.startsWith('[U]')).length;
    const attachHtml  = (t.attachments||[]).length
      ? (t.attachments||[]).map(attachmentHtml).join('')
      : '<p style="font-size:12px;color:var(--gray)">Sin archivos adjuntos.</p>';

    body.innerHTML = `
      <div class="detail-section">
        <h3>Descripción</h3>
        <div class="detail-desc">${t.desc||'Sin descripción.'}</div>
      </div>
      <div class="detail-section">
        <h3>Información</h3>
        <div class="detail-row"><span class="key">Estado</span>   <span class="val">${statusBadge(t.status)}</span></div>
        <div class="detail-row"><span class="key">Prioridad</span><span class="val">${prioBadge(t.prioridad)}</span></div>
        <div class="detail-row"><span class="key">Categoría</span><span class="val">${t.categoria}</span></div>
        <div class="detail-row"><span class="key">Reportado por</span><span class="val">${t.reporter||'—'}</span></div>
        <div class="detail-row"><span class="key">Fecha</span>    <span class="val">${t.fecha}</span></div>
        ${slaHtml(t) ? `<div class="detail-row"><span class="key">SLA</span><span class="val">${slaHtml(t)}</span></div>` : ''}
      </div>
      <div class="detail-section">
        <h3>Asignar a</h3>
        <select class="assign-select" onchange="reassign('${t.id}',this.value)">
          <option value="Sin asignar" ${!t.asignado||t.asignado==='Sin asignar'?'selected':''}>Sin asignar</option>
          ${adminsCache.map(a => `<option value="${a.nombre}" ${t.asignado===a.nombre?'selected':''}>${a.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="detail-section">
        <h3>Acciones</h3>
        <div class="actions-row">
          ${t.status !== 'en_progreso' && t.status !== 'cerrado'
            ? `<button class="btn-action btn-primary" onclick="changeStatus('${t.id}','en_progreso')"><i class="ti ti-player-play"></i> Tomar</button>` : ''}
          ${t.status !== 'cerrado'
            ? `<button class="btn-action btn-success" onclick="changeStatus('${t.id}','cerrado')"><i class="ti ti-check"></i> Cerrar</button>` : ''}
          ${t.status === 'cerrado'
            ? `<button class="btn-action btn-primary" onclick="changeStatus('${t.id}','abierto')"><i class="ti ti-refresh"></i> Reabrir</button>` : ''}
          <button class="btn-action btn-danger" onclick="deleteTicket('${t.id}')"><i class="ti ti-trash"></i> Eliminar</button>
        </div>
      </div>
      <div class="detail-section">
        <h3>Archivos adjuntos</h3>
        ${attachHtml}
      </div>
      <div class="detail-section">
        <h3>Historial de mensajes · ${t.comments.length} (${userReplies} del usuario)</h3>
        ${t.comments.length
          ? t.comments.map(commentHtml).join('')
          : '<p style="font-size:12px;color:var(--gray);margin-bottom:10px">Sin mensajes aún.</p>'}
        <div style="margin-bottom:8px">
          <select class="assign-select" id="templateSel" onchange="applyTemplate()" style="margin-top:0">
            <option value="">Plantilla de respuesta…</option>
            ${TEMPLATES.map((tp,i) => `<option value="${i}">${tp.label}</option>`).join('')}
          </select>
        </div>
        <textarea class="comment-box" id="newComment" rows="2" placeholder="Escribir respuesta al usuario..."></textarea>
        <div class="actions-row">
          <button class="btn-action btn-primary" onclick="addComment('${t.id}')"><i class="ti ti-send"></i> Responder</button>
        </div>
      </div>
    `;
  } else if (currentDetailTab === 'notes') {
    const notes = t.notes || [];
    body.innerHTML = `
      <div class="detail-section">
        <h3>Notas internas <span style="font-size:10px;font-weight:400;color:var(--gray)">(solo el equipo de soporte puede ver esto)</span></h3>
        ${notes.length
          ? notes.map(n => `
              <div class="note-item">
                <div class="note-meta"><i class="ti ti-lock" style="font-size:10px"></i> ${n.user} · ${n.ts}</div>
                ${n.text}
              </div>`).join('')
          : '<p style="font-size:12px;color:var(--gray);margin-bottom:12px">Sin notas internas.</p>'}
        <textarea class="comment-box" id="newNote" rows="2" placeholder="Agregar nota interna (no visible al usuario)..."></textarea>
        <div class="actions-row">
          <button class="btn-action btn-primary" onclick="addNote('${t.id}')"><i class="ti ti-lock"></i> Guardar nota</button>
        </div>
      </div>
    `;
  } else if (currentDetailTab === 'history') {
    const history = t.history || [];
    body.innerHTML = `
      <div class="detail-section">
        <h3>Historial de cambios · ${history.length} eventos</h3>
        ${history.length
          ? [...history].reverse().map(h => `
              <div class="history-item">
                <div class="history-dot"></div>
                <div class="history-info">
                  <div><strong>${h.user}</strong> — ${h.accion}</div>
                  <div class="history-ts"><i class="ti ti-clock" style="font-size:10px"></i> ${h.ts}</div>
                </div>
              </div>`).join('')
          : '<p style="font-size:12px;color:var(--gray)">Sin historial.</p>'}
      </div>
    `;
  }
}

function applyTemplate() {
  const sel = document.getElementById('templateSel');
  const idx = parseInt(sel.value);
  if (isNaN(idx)) return;
  const box = document.getElementById('newComment');
  if (box) box.value = TEMPLATES[idx].text;
  sel.value = '';
}

function closeDetail() {
  selectedId = null;
  document.getElementById('detailPanel').classList.remove('open');
  document.getElementById('dim').classList.remove('open');
  renderList();
}

// ── Acciones sobre tickets ────────────────────────────────────────────────────
async function reassign(id, val) {
  try {
    await api(`/api/tickets/${id}`, 'PATCH', { asignado: val, adminUser: adminNombre });
    showToast('Asignado a ' + val);
    await refreshTickets();
    openDetail(id);
  } catch { showToast('Error al asignar'); }
}

async function changeStatus(id, status) {
  try {
    await api(`/api/tickets/${id}`, 'PATCH', { status, adminUser: adminNombre });
    showToast('Estado actualizado ✓');
    await refreshTickets();
    openDetail(id);
  } catch { showToast('Error al actualizar estado'); }
}

async function deleteTicket(id) {
  if (!confirm('¿Eliminar este ticket permanentemente?')) return;
  try {
    await api(`/api/tickets/${id}`, 'DELETE', { adminUser: adminNombre });
    closeDetail();
    showToast('Ticket eliminado');
    await refreshTickets();
  } catch { showToast('Error al eliminar'); }
}

async function addComment(id) {
  const txt = document.getElementById('newComment').value.trim();
  if (!txt) return;
  try {
    await api(`/api/tickets/${id}/comments`, 'POST', {
      text: `Soporte (${nowHM()}): ${txt}`,
      adminUser: adminNombre
    });
    showToast('Respuesta enviada ✓');
    await refreshTickets();
    openDetail(id);
  } catch { showToast('Error al enviar respuesta'); }
}

async function addNote(id) {
  const txt = document.getElementById('newNote').value.trim();
  if (!txt) return;
  try {
    await api(`/api/tickets/${id}/notes`, 'POST', { text: txt, user: adminNombre });
    showToast('Nota guardada ✓');
    await refreshTickets();
    openDetail(id);
    switchDetailTab('notes', document.querySelectorAll('.dtab')[1]);
  } catch { showToast('Error al guardar nota'); }
}

// ── Export Excel ──────────────────────────────────────────────────────────────
function exportToExcel() {
  if (typeof XLSX === 'undefined') { showToast('Librería Excel no cargada'); return; }
  const all = ticketCache;
  if (!all.length) { showToast('No hay tickets para exportar'); return; }

  const wb        = XLSX.utils.book_new();
  const statusMap = { abierto: 'Abierto', en_progreso: 'En progreso', cerrado: 'Cerrado' };

  const headers = ['ID','Título','Descripción','Estado','Prioridad','Categoría','Asignado a','Reportado por','Fecha','# Comentarios','# Notas internas','# Archivos','Último mensaje'];
  const rows = all.map(t => [
    t.id, t.title, t.desc, statusMap[t.status]||t.status,
    t.prioridad, t.categoria, t.asignado||'Sin asignar', t.reporter||'—',
    t.fecha, t.comments.length, (t.notes||[]).length, (t.attachments||[]).length,
    t.comments.length ? t.comments[t.comments.length-1].replace(/^\[U\]\s*/,'') : ''
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws1['!cols'] = [{wch:9},{wch:40},{wch:50},{wch:14},{wch:10},{wch:12},{wch:14},{wch:18},{wch:16},{wch:14},{wch:14},{wch:10},{wch:50}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Tickets');

  const cnts={abierto:0,en_progreso:0,cerrado:0}, byPrio={'Crítica':0,'Alta':0,'Media':0,'Baja':0};
  const byCat={'Hardware':0,'Software':0,'Red':0,'Acceso':0,'Otro':0}, byAsig={};
  all.forEach(t=>{
    if(cnts[t.status]!==undefined) cnts[t.status]++;
    if(byPrio[t.prioridad]!==undefined) byPrio[t.prioridad]++;
    if(byCat[t.categoria]!==undefined) byCat[t.categoria]++;
    const k=t.asignado||'Sin asignar'; byAsig[k]=(byAsig[k]||0)+1;
  });
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['RESUMEN — SISTEMA DE SOPORTE TÉCNICO',''],
    ['Generado el:', new Date().toLocaleString('es-HN')],
    ['Total de tickets:', all.length],['',''],
    ['POR ESTADO','Cantidad'],
    ['Abiertos',cnts.abierto],['En progreso',cnts.en_progreso],['Cerrados',cnts.cerrado],['',''],
    ['POR PRIORIDAD','Cantidad'],
    ['Crítica',byPrio['Crítica']],['Alta',byPrio['Alta']],['Media',byPrio['Media']],['Baja',byPrio['Baja']],['',''],
    ['POR CATEGORÍA','Cantidad'],
    ['Hardware',byCat['Hardware']],['Software',byCat['Software']],['Red',byCat['Red']],['Acceso',byCat['Acceso']],['Otro',byCat['Otro']],['',''],
    ['POR TÉCNICO ASIGNADO','Tickets'],
    ...Object.entries(byAsig).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v])
  ]);
  ws2['!cols']=[{wch:32},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  XLSX.writeFile(wb, `tickets_soporte_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel exportado correctamente ✓');
}

// ── Gestión de usuarios admin ─────────────────────────────────────────────────
async function openAdminManager() {
  const loggedUser = sessionStorage.getItem(USERNAME_KEY) || '';
  const isSuperAdmin = loggedUser === 'admin';

  document.getElementById('adminManagerBackdrop').classList.add('open');
  document.getElementById('amError').classList.remove('show');
  document.getElementById('am-nombre').value = '';
  document.getElementById('am-user').value   = '';
  document.getElementById('am-pass').value   = '';

  const createSection = document.getElementById('amCreateSection');
  if (createSection) createSection.style.display = isSuperAdmin ? '' : 'none';
  const createBtn = document.getElementById('amCreateBtn');
  if (createBtn) createBtn.style.display = isSuperAdmin ? '' : 'none';

  await loadAdminList();
}

function closeAdminManager() {
  document.getElementById('adminManagerBackdrop').classList.remove('open');
}

async function loadAdminList() {
  try {
    const admins = await api('/api/admins');
    const list        = document.getElementById('adminList');
    if (!admins.length) { list.innerHTML = '<p style="font-size:13px;color:var(--gray)">Sin usuarios.</p>'; return; }

    const loggedUser  = sessionStorage.getItem(USERNAME_KEY) || '';
    const isOnly      = admins.length === 1;
    const isSuperAdmin = loggedUser === 'admin';

    const ROL_COLORS = { superadmin: '#7c3aed', admin: '#2563eb', tecnico: '#059669', empleado: '#64748b' };
    list.innerHTML = admins.map(a => {
      const isMe      = a.username === loggedUser;
      const initials  = a.nombre.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
      const canDelete = isSuperAdmin && !isMe && !isOnly;
      const rolColor  = ROL_COLORS[a.rol] || '#64748b';
      return `
        <div class="admin-row">
          <div class="admin-row-avatar ${isMe ? 'is-me' : ''}">${initials}</div>
          <div class="admin-row-info">
            <div class="admin-row-nombre">${a.nombre}</div>
            <div class="admin-row-user" style="display:flex;align-items:center;gap:6px">
              @${a.username}
              <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;
                           background:${rolColor}22;color:${rolColor};letter-spacing:0.3px">
                ${a.rol}
              </span>
            </div>
          </div>
          ${isMe ? '<span class="admin-row-me">Tú</span>' : ''}
          <button class="btn-del-admin" onclick="deleteAdmin('${a.username}','${a.nombre}')"
            title="${isMe ? 'No puedes eliminarte a ti mismo' : !isSuperAdmin ? 'Solo el administrador principal puede eliminar usuarios' : isOnly ? 'Debe haber al menos un administrador' : 'Eliminar usuario'}"
            ${canDelete ? '' : 'disabled'}>
            <i class="ti ti-trash"></i>
          </button>
        </div>`;
    }).join('');
  } catch {
    document.getElementById('adminList').innerHTML = '<p style="font-size:13px;color:var(--red)">Error al cargar usuarios.</p>';
  }
}

async function createAdmin() {
  const loggedUser = sessionStorage.getItem(USERNAME_KEY) || '';
  if (loggedUser !== 'admin') { showToast('Solo el administrador principal puede crear usuarios'); return; }

  const nombre = document.getElementById('am-nombre').value.trim();
  const user   = document.getElementById('am-user').value.trim().toLowerCase().replace(/\s+/g,'');
  const pass   = document.getElementById('am-pass').value;
  const errEl  = document.getElementById('amError');

  errEl.classList.remove('show');

  if (!nombre || !user || !pass) {
    errEl.textContent = 'Todos los campos son obligatorios.';
    errEl.classList.add('show'); return;
  }
  if (pass.length < 6) {
    errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errEl.classList.add('show'); return;
  }

  try {
    await api('/api/admins', 'POST', { username: user, password: pass, nombre, requestedBy: loggedUser });
    document.getElementById('am-nombre').value = '';
    document.getElementById('am-user').value   = '';
    document.getElementById('am-pass').value   = '';
    await loadAdminList();
    showToast(`Usuario @${user} creado correctamente ✓`);
  } catch (e) {
    errEl.textContent = e.message.includes('409') ? 'Ese nombre de usuario ya existe.' : 'Error al crear usuario.';
    errEl.classList.add('show');
  }
}

async function deleteAdmin(username, nombre) {
  const loggedUser = sessionStorage.getItem(USERNAME_KEY) || '';
  if (loggedUser !== 'admin') { showToast('Solo el administrador principal puede eliminar usuarios'); return; }
  if (!confirm(`¿Eliminar al usuario "${nombre}" (@${username})?\nEsta acción no se puede deshacer.`)) return;
  try {
    const res = await fetch(`/api/admins/${username}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: loggedUser })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || 'No se pudo eliminar el usuario');
      return;
    }
    await loadAdminList();
    showToast(`Usuario @${username} eliminado ✓`);
  } catch {
    showToast('Error de conexión al eliminar usuario');
  }
}


// ── Inventario / Stock control ────────────────────────────────────────────────
const ESTADO_MAP = {
  excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular',
  danado: 'Dañado', muy_deteriorado: 'Deteriorado'
};
const INV_ESTADO_LABEL = {
  disponible: 'Disponible', en_uso: 'En uso', en_prestamo: 'En préstamo',
  en_reparacion: 'En reparación', de_baja: 'De baja'
};
const INV_ESTADO_CLS = {
  disponible: 'inv-est-green', en_uso: 'inv-est-blue', en_prestamo: 'inv-est-amber',
  en_reparacion: 'inv-est-red', de_baja: 'inv-est-gray'
};

function estadoLabel(e) { return ESTADO_MAP[e] || e; }

async function loadDevices() {
  try {
    [inventoryCache, loansCache] = await Promise.all([
      api('/api/inventory'),
      api('/api/loans')
    ]);
    const el = document.getElementById('cnt-inventario');
    if (el) el.textContent = inventoryCache.length;
  } catch { inventoryCache = []; loansCache = []; }
}

function destroyInvCharts() {
  Object.values(invCharts).forEach(c => { try { c.destroy(); } catch {} });
  invCharts = {};
}

function switchInvView(view) {
  if (view !== 'dashboard') destroyInvCharts();
  currentInvView = view;
  renderInventorySection();
}

function renderInventorySection() {
  const section = document.getElementById('receptionSection');
  if (!section) return;

  const total      = inventoryCache.length;
  const disponibles = inventoryCache.filter(i => i.estado === 'disponible').length;
  const prestados  = inventoryCache.filter(i => i.estado === 'en_prestamo').length;
  const reparacion = inventoryCache.filter(i => i.estado === 'en_reparacion').length;
  const baja       = inventoryCache.filter(i => i.estado === 'de_baja').length;
  const activos    = loansCache.filter(l => l.estado === 'activo').length;

  section.innerHTML = `
<div class="inv-layout">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
    <button onclick="setTab('todos',document.querySelector('.tab-btn'))"
            style="display:flex;align-items:center;gap:6px;padding:7px 16px;border:1.5px solid var(--border);border-radius:8px;background:var(--light);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;transition:background .15s"
            onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--light)'">
      <i class="ti ti-arrow-left"></i> Volver a tickets
    </button>
    <span style="font-size:15px;font-weight:700;color:var(--text)"><i class="ti ti-package" style="margin-right:5px"></i>Inventario</span>
  </div>

  <div class="inv-stats-row">
    <div class="inv-stat-card blue">
      <div class="inv-stat-icon"><i class="ti ti-package"></i></div>
      <div><div class="inv-stat-val">${total}</div><div class="inv-stat-lbl">Total equipos</div></div>
    </div>
    <div class="inv-stat-card green">
      <div class="inv-stat-icon"><i class="ti ti-circle-check"></i></div>
      <div><div class="inv-stat-val">${disponibles}</div><div class="inv-stat-lbl">Disponibles</div></div>
    </div>
    <div class="inv-stat-card amber">
      <div class="inv-stat-icon"><i class="ti ti-exchange"></i></div>
      <div><div class="inv-stat-val">${prestados}</div><div class="inv-stat-lbl">Prestados</div></div>
    </div>
    <div class="inv-stat-card red">
      <div class="inv-stat-icon"><i class="ti ti-tool"></i></div>
      <div><div class="inv-stat-val">${reparacion}</div><div class="inv-stat-lbl">En reparación</div></div>
    </div>
    <div class="inv-stat-card gray">
      <div class="inv-stat-icon"><i class="ti ti-archive"></i></div>
      <div><div class="inv-stat-val">${baja}</div><div class="inv-stat-lbl">De baja</div></div>
    </div>
  </div>

  <div class="inv-toolbar">
    <div class="inv-subtabs">
      <button class="inv-subtab${currentInvView==='dashboard'?' active':''}" onclick="switchInvView('dashboard')">
        <i class="ti ti-chart-bar"></i> Dashboard
      </button>
      <button class="inv-subtab${currentInvView==='equipos'?' active':''}" onclick="switchInvView('equipos')">
        <i class="ti ti-package"></i> Equipos
      </button>
      <button class="inv-subtab${currentInvView==='prestamos'?' active':''}" onclick="switchInvView('prestamos')">
        <i class="ti ti-exchange"></i> Préstamos
        ${activos > 0 ? `<span class="inv-badge">${activos}</span>` : ''}
      </button>
    </div>
    ${currentInvView === 'equipos' ? `
    <button class="inv-add-btn" onclick="openInventoryModal()">
      <i class="ti ti-plus"></i> Nuevo equipo
    </button>` : currentInvView === 'prestamos' ? `
    <button class="inv-add-btn" onclick="openLoanModal(null)">
      <i class="ti ti-exchange"></i> Nuevo préstamo
    </button>` : ''}
  </div>

  <div id="invContent">
    ${currentInvView === 'dashboard' ? renderDashboardHtml() : currentInvView === 'equipos' ? renderEquiposHtml() : renderPrestamosHtml()}
  </div>
</div>`;

  if (currentInvView === 'dashboard') renderInvCharts();
}

// ── Dashboard view ────────────────────────────────────────────────────────────
function renderDashboardHtml() {
  if (!inventoryCache.length) return `
<div class="inv-empty">
  <i class="ti ti-chart-bar-off"></i>
  <p>No hay equipos registrados aún. Agrega el primer equipo para ver estadísticas.</p>
  <button class="inv-add-btn" onclick="switchInvView('equipos');openInventoryModal()">
    <i class="ti ti-plus"></i> Agregar primer equipo
  </button>
</div>`;

  const recent = [...inventoryCache]
    .sort((a,b) => (b.fechaTs||0) - (a.fechaTs||0))
    .slice(0, 8);

  const recentHtml = recent.map(i => {
    const estCls = INV_ESTADO_CLS[i.estado] || 'inv-est-gray';
    const estLbl = INV_ESTADO_LABEL[i.estado] || i.estado;
    return `<div class="inv-dash-recent-row">
  <div class="inv-dash-recent-icon"><i class="ti ti-package"></i></div>
  <div class="inv-dash-recent-info">
    <div class="inv-dash-recent-name">${i.marca} ${i.modelo||''}</div>
    <div class="inv-dash-recent-sub">${i.id} · ${i.fechaIngreso||''}</div>
  </div>
  <span class="inv-estado-badge ${estCls}">${estLbl}</span>
</div>`;
  }).join('');

  return `
<div class="inv-dashboard">

  <div class="inv-dash-charts-row">
    <div class="inv-dash-chart-card">
      <div class="inv-dash-chart-title"><i class="ti ti-chart-donut"></i> Estado de equipos</div>
      <div class="inv-dash-canvas-wrap"><canvas id="invChartEstado"></canvas></div>
    </div>
    <div class="inv-dash-chart-card">
      <div class="inv-dash-chart-title"><i class="ti ti-chart-bar"></i> Por tipo</div>
      <div class="inv-dash-canvas-wrap"><canvas id="invChartTipo"></canvas></div>
    </div>
    <div class="inv-dash-chart-card">
      <div class="inv-dash-chart-title"><i class="ti ti-chart-pie"></i> Condición general</div>
      <div class="inv-dash-canvas-wrap"><canvas id="invChartCond"></canvas></div>
    </div>
  </div>

  <div>
    <div class="inv-dash-section-title">Últimos ingresos</div>
    <div class="inv-dash-recent-list">
      ${recentHtml || '<div class="inv-dash-recent-empty">Sin registros</div>'}
    </div>
  </div>

</div>`;
}

function renderInvCharts() {
  destroyInvCharts();

  const byEstado = { disponible:0, en_uso:0, en_prestamo:0, en_reparacion:0, de_baja:0 };
  const byTipo   = {};
  const byCond   = { excelente:0, bueno:0, regular:0, danado:0 };
  inventoryCache.forEach(i => {
    if (i.estado   in byEstado) byEstado[i.estado]++;
    byTipo[i.tipo] = (byTipo[i.tipo] || 0) + 1;
    if (i.condicion in byCond) byCond[i.condicion]++;
  });

  const chartDefaults = {
    plugins: { legend: { position: 'bottom', labels: { font:{size:11}, padding:12, usePointStyle:true } } },
    animation: { duration: 500 }
  };

  const ctxE = document.getElementById('invChartEstado');
  if (ctxE) invCharts.estado = new Chart(ctxE, {
    type: 'doughnut',
    data: {
      labels: ['Disponible','En uso','En préstamo','En reparación','De baja'],
      datasets: [{ data: Object.values(byEstado),
        backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ef4444','#9ca3af'],
        borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }]
    },
    options: { ...chartDefaults, cutout: '68%' }
  });

  const tipoKeys = Object.keys(byTipo);
  const ctxT = document.getElementById('invChartTipo');
  if (ctxT && tipoKeys.length) {
    const palette = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981'];
    invCharts.tipo = new Chart(ctxT, {
      type: 'bar',
      data: {
        labels: tipoKeys,
        datasets: [{ data: tipoKeys.map(k => byTipo[k]),
          backgroundColor: tipoKeys.map((_,i) => palette[i % palette.length]),
          borderRadius: 6, borderWidth: 0 }]
      },
      options: {
        ...chartDefaults,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid:{display:false}, ticks:{precision:0,font:{size:11}} },
          y: { grid:{display:false}, ticks:{font:{size:11}} }
        }
      }
    });
  }

  const ctxC = document.getElementById('invChartCond');
  if (ctxC) invCharts.cond = new Chart(ctxC, {
    type: 'doughnut',
    data: {
      labels: ['Excelente','Bueno','Regular','Dañado'],
      datasets: [{ data: Object.values(byCond),
        backgroundColor: ['#22c55e','#3b82f6','#f59e0b','#ef4444'],
        borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }]
    },
    options: { ...chartDefaults, cutout: '68%' }
  });
}

// ── Equipos view ──────────────────────────────────────────────────────────────
function renderEquiposHtml() {
  const items = filteredInventory();
  return `
<div class="inv-filter-bar">
  <div class="inv-search-wrap">
    <i class="ti ti-search"></i>
    <input class="inv-search" id="invQ" type="text" placeholder="Buscar por marca, modelo, serie…"
           oninput="refreshInvContent()">
  </div>
  <select class="inv-filter-sel" id="invFEstado" onchange="refreshInvContent()">
    <option value="">Estado</option>
    <option value="disponible">Disponible</option>
    <option value="en_uso">En uso</option>
    <option value="en_prestamo">En préstamo</option>
    <option value="en_reparacion">En reparación</option>
    <option value="de_baja">De baja</option>
  </select>
</div>
${!items.length ? `
<div class="inv-empty">
  <i class="ti ti-package-off"></i>
  <p>${inventoryCache.length ? 'No hay equipos que coincidan con los filtros.' : 'No hay equipos registrados aún.'}</p>
  ${!inventoryCache.length ? `<button class="inv-add-btn" onclick="openInventoryModal()"><i class="ti ti-plus"></i> Agregar primer equipo</button>` : ''}
</div>` : `
<div class="inv-grid">
  ${items.map(invCardHtml).join('')}
</div>`}`;
}

function filteredInventory() {
  const q      = (document.getElementById('invQ')?.value || '').toLowerCase();
  const estado = document.getElementById('invFEstado')?.value || '';
  return inventoryCache.filter(i => {
    if (estado && i.estado !== estado) return false;
    if (q && !`${i.tipo} ${i.marca} ${i.modelo} ${i.serie} ${i.ubicacion}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function refreshInvContent() {
  const el = document.getElementById('invContent');
  if (!el) return;
  el.innerHTML = renderEquiposHtml();
}

function garantiaBadgeHtml(garantia) {
  if (!garantia) return '';
  if (!garantia.vence) {
    const prov = garantia.proveedor ? ` · ${garantia.proveedor}` : '';
    return `<div class="inv-detail-row"><i class="ti ti-shield"></i><span><span class="gnt-badge gnt-gray">Con garantía</span>${prov}</span></div>`;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const vence = new Date(garantia.vence);
  const dias  = Math.round((vence - today) / 86400000);
  const prov  = garantia.proveedor ? ` · ${garantia.proveedor}` : '';
  if (dias < 0) {
    return `<div class="inv-detail-row"><i class="ti ti-shield-off"></i><span><span class="gnt-badge gnt-red">Garantía vencida</span>${prov}</span></div>`;
  }
  if (dias <= 30) {
    return `<div class="inv-detail-row"><i class="ti ti-shield-exclamation"></i><span><span class="gnt-badge gnt-amber">Garantía: ${dias} días</span>${prov}</span></div>`;
  }
  return `<div class="inv-detail-row"><i class="ti ti-shield-check"></i><span><span class="gnt-badge gnt-green">Garantía activa</span>${prov}</span></div>`;
}

function invCardHtml(item) {
  const tipLbl  = item.tipo;
  const estLbl  = INV_ESTADO_LABEL[item.estado] || item.estado;
  const estCls  = INV_ESTADO_CLS[item.estado]   || 'inv-est-gray';
  const condCls = { excelente:'cond-green', bueno:'cond-blue', regular:'cond-amber', danado:'cond-red' }[item.condicion] || '';
  const condLbl = { excelente:'Excelente', bueno:'Bueno', regular:'Regular', danado:'Dañado' }[item.condicion] || item.condicion;
  return `
<div class="inv-card">
  <div class="inv-card-head">
    <div class="inv-card-icon-wrap">
      <i class="ti ti-package"></i>
    </div>
    <div class="inv-card-meta">
      <div class="inv-card-name">${item.marca}${item.modelo ? ' ' + item.modelo : ''}</div>
      <div class="inv-card-sub">${item.id} · ${tipLbl}${item.color ? ' · ' + item.color : ''}</div>
    </div>
    <span class="inv-estado-badge ${estCls}">${estLbl}</span>
  </div>
  <div class="inv-card-details">
    ${item.serie       ? `<div class="inv-detail-row"><i class="ti ti-barcode"></i><span>Serie: <strong>${item.serie}</strong></span></div>` : ''}
    ${item.ubicacion   ? `<div class="inv-detail-row"><i class="ti ti-map-pin"></i><span>Ubicación: ${item.ubicacion}</span></div>` : ''}
    ${item.responsable ? `<div class="inv-detail-row"><i class="ti ti-user"></i><span>Responsable: ${item.responsable}</span></div>` : ''}
    <div class="inv-detail-row">
      <i class="ti ti-sparkles"></i>
      <span>Condición: <span class="cond-tag ${condCls}">${condLbl}</span></span>
    </div>
    <div class="inv-detail-row muted"><i class="ti ti-calendar-plus"></i><span>Ingreso: ${item.fechaIngreso}</span></div>
    ${garantiaBadgeHtml(item.garantia)}
    ${item.notas ? `<div class="inv-card-notes">${item.notas}</div>` : ''}
  </div>
  <div class="inv-card-actions">
    ${item.estado === 'disponible' ? `
    <button class="inv-btn inv-btn-primary" onclick="openLoanModal('${item.id}')">
      <i class="ti ti-exchange"></i> Prestar
    </button>` : item.estado === 'en_prestamo' ? `
    <button class="inv-btn inv-btn-green" onclick="returnLoanByItem('${item.id}')">
      <i class="ti ti-check"></i> Devolver
    </button>` : ''}
    <button class="inv-btn inv-btn-outline" onclick="openEditInventoryModal('${item.id}')" title="Editar">
      <i class="ti ti-edit"></i>
    </button>
    <button class="inv-btn inv-btn-danger" onclick="deleteInventoryItem('${item.id}')" title="Eliminar">
      <i class="ti ti-trash"></i>
    </button>
  </div>
</div>`;
}

// ── Préstamos view ────────────────────────────────────────────────────────────
function renderPrestamosHtml() {
  if (!loansCache.length) return `
<div class="inv-empty">
  <i class="ti ti-exchange-off"></i>
  <p>No hay préstamos registrados aún.</p>
</div>`;

  const activos   = loansCache.filter(l => l.estado === 'activo');
  const devueltos = loansCache.filter(l => l.estado === 'devuelto');

  const loanRowHtml = loan => {
    const item   = inventoryCache.find(i => i.id === loan.inventoryId);
    const today  = new Date(); today.setHours(0,0,0,0);
    const devEst = loan.fechaDevolucionEstimada ? new Date(loan.fechaDevolucionEstimada) : null;
    const vencido = loan.estado === 'activo' && devEst && devEst < today;
    return `
<div class="loan-row${vencido ? ' loan-vencido' : ''}">
  <div class="loan-device-icon"><i class="ti ti-package"></i></div>
  <div class="loan-device-info">
    <div class="loan-device-name">${loan.equipoDesc || loan.inventoryId}</div>
    <div class="loan-device-id">${loan.inventoryId} · <span class="loan-id-badge">${loan.id}</span></div>
  </div>
  <div class="loan-person-col">
    <div class="loan-person-name"><i class="ti ti-user" style="font-size:11px"></i> ${loan.empleado}</div>
    ${loan.departamento ? `<div class="loan-dept">${loan.departamento}</div>` : ''}
    ${loan.autorizadoPor ? `<div class="loan-dept">Auth: ${loan.autorizadoPor}</div>` : ''}
  </div>
  <div class="loan-dates-col">
    <div class="loan-date-row"><i class="ti ti-calendar-plus"></i> ${loan.fechaPrestamo}</div>
    ${loan.fechaDevolucionEstimada ? `
    <div class="loan-date-row${vencido?' loan-date-red':''}">
      <i class="ti ti-calendar-minus"></i> Est. ${loan.fechaDevolucionEstimada}
    </div>` : ''}
    ${loan.fechaDevolucionReal ? `
    <div class="loan-date-row loan-date-green">
      <i class="ti ti-check"></i> Devuelto: ${loan.fechaDevolucionReal}
    </div>` : ''}
  </div>
  <div class="loan-status-col">
    ${vencido ? `<span class="inv-estado-badge inv-est-red">Vencido</span>` :
      loan.estado === 'activo' ? `<span class="inv-estado-badge inv-est-amber">Activo</span>` :
      `<span class="inv-estado-badge inv-est-green">Devuelto</span>`}
  </div>
  <div style="display:flex;flex-direction:column;gap:6px">
    ${loan.estado === 'activo' ? `
    <button class="inv-btn inv-btn-green" onclick="returnLoan('${loan.id}')">
      <i class="ti ti-check"></i> Retornado
    </button>` : ''}
    <button class="inv-btn inv-btn-outline" onclick="generateLoanWord('${loan.id}')" title="Generar comprobante Word">
      <i class="ti ti-file-type-doc"></i> Comprobante
    </button>
  </div>
</div>`;
  };

  return `
<div style="display:flex;flex-direction:column;gap:20px">
  ${activos.length ? `
  <div>
    <div class="inv-section-title"><i class="ti ti-clock"></i> Activos — ${activos.length}</div>
    <div class="loans-list">${activos.map(loanRowHtml).join('')}</div>
  </div>` : ''}
  ${devueltos.length ? `
  <div>
    <div class="inv-section-title"><i class="ti ti-history"></i> Historial — ${devueltos.length}</div>
    <div class="loans-list">${devueltos.map(loanRowHtml).join('')}</div>
  </div>` : ''}
</div>`;
}


// ── Inventory modal (add / edit) ──────────────────────────────────────────────

function openInventoryModal() {
  editingInvId = null;
  document.getElementById('invModalTitle').innerHTML = '<i class="ti ti-package"></i> Nuevo equipo';
  document.getElementById('invModalSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> Guardar equipo';
  renderInventoryModalBody(null);
  document.getElementById('inventoryModalBackdrop').classList.add('open');
}

function openEditInventoryModal(id) {
  const item = inventoryCache.find(i => i.id === id);
  if (!item) return;
  editingInvId = id;
  document.getElementById('invModalTitle').innerHTML = `<i class="ti ti-edit"></i> Editar — ${item.id}`;
  document.getElementById('invModalSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> Guardar cambios';
  renderInventoryModalBody(item);
  document.getElementById('inventoryModalBackdrop').classList.add('open');
}

function renderInventoryModalBody(item) {
  const v = f => item ? (item[f] || '') : '';
  document.getElementById('inventoryModalBody').innerHTML = `
<div style="display:flex;flex-direction:column;gap:14px">
  <div class="rform-group">
    <label class="rform-label">Tipo de equipo *</label>
    <input id="inv-tipo" type="text" value="${v('tipo')}" placeholder="Laptop, Impresora, Router, UPS…" style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:var(--font);background:var(--light);color:var(--text);outline:none">
  </div>
  <div class="field-row">
    <div class="field-group">
      <label>Marca *</label>
      <input id="inv-marca" type="text" value="${v('marca')}" placeholder="Dell, HP, Apple…">
    </div>
    <div class="field-group">
      <label>Modelo</label>
      <input id="inv-modelo" type="text" value="${v('modelo')}" placeholder="Latitude 5540…">
    </div>
  </div>
  <div class="field-row">
    <div class="field-group">
      <label>N° de serie</label>
      <input id="inv-serie" type="text" value="${v('serie')}" placeholder="SN123456">
    </div>
    <div class="field-group">
      <label>Color</label>
      <input id="inv-color" type="text" value="${v('color')}" placeholder="Negro, Gris…">
    </div>
  </div>
  <div class="field-row">
    <div class="field-group">
      <label>Condición física</label>
      <select id="inv-condicion">
        ${[['excelente','Excelente'],['bueno','Bueno'],['regular','Regular'],['danado','Dañado']].map(
          ([val, lbl]) => `<option value="${val}"${v('condicion')===val?' selected':''}>${lbl}</option>`).join('')}
      </select>
    </div>
    <div class="field-group">
      <label>Estado</label>
      ${item?.estado === 'en_prestamo'
        ? `<div class="inv-locked-state" style="padding:9px 14px;border-radius:10px;background:var(--light);font-size:13px;color:var(--gray)">
             <i class="ti ti-lock" style="font-size:12px"></i> En préstamo — gestionar desde <strong>Préstamos</strong>
           </div>`
        : `<select id="inv-estado">
             ${Object.entries(INV_ESTADO_LABEL).filter(([val]) => val !== 'en_prestamo').map(
               ([val, lbl]) => `<option value="${val}"${v('estado')===val?' selected':''}>${lbl}</option>`).join('')}
           </select>`}
    </div>
  </div>
  <div class="field-row">
    <div class="field-group">
      <label>Ubicación</label>
      <input id="inv-ubicacion" type="text" value="${v('ubicacion')}" placeholder="Bodega, Piso 2…">
    </div>
    <div class="field-group">
      <label>Responsable</label>
      <input id="inv-responsable" type="text" value="${v('responsable')}" placeholder="Nombre del responsable">
    </div>
  </div>
  <div class="field-group">
    <label>Notas</label>
    <textarea id="inv-notas" rows="2" style="border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;font-family:var(--font);resize:vertical;outline:none;background:var(--light);color:var(--text)"
              placeholder="Observaciones adicionales…">${v('notas')}</textarea>
  </div>

  <hr class="rform-divider">
  <div class="rform-section-title"><i class="ti ti-shield-check"></i> Garantía</div>
  <label class="accesorio-check" style="width:fit-content;align-self:flex-start">
    <input type="checkbox" id="inv-tiene-garantia" onchange="invToggleGarantia()"
           ${item?.garantia ? 'checked' : ''}>
    <span class="check-box"></span>
    <span class="check-label">Este equipo tiene garantía</span>
  </label>
  <div id="inv-garantia-fields" style="display:${item?.garantia ? 'flex' : 'none'};flex-direction:column;gap:12px">
    <div class="field-row">
      <div class="field-group">
        <label>Fecha de inicio</label>
        <input id="inv-garantia-inicio" type="date" value="${item?.garantia?.inicio || ''}">
      </div>
      <div class="field-group">
        <label>Fecha de vencimiento *</label>
        <input id="inv-garantia-vence" type="date" value="${item?.garantia?.vence || ''}">
      </div>
    </div>
    <div class="field-group">
      <label>Proveedor / N° de garantía</label>
      <input id="inv-garantia-proveedor" type="text" value="${item?.garantia?.proveedor || ''}"
             placeholder="HP Inc., caso #12345…">
    </div>
  </div>

  <div id="inv-modal-err" class="rec-error" style="display:none"></div>
</div>`;
}

function closeInventoryModal() {
  document.getElementById('inventoryModalBackdrop').classList.remove('open');
  editingInvId = null;
}

function invToggleGarantia() {
  const checked = document.getElementById('inv-tiene-garantia')?.checked;
  const fields  = document.getElementById('inv-garantia-fields');
  if (fields) fields.style.display = checked ? 'flex' : 'none';
}

async function saveInventoryItem() {
  const tipo       = document.getElementById('inv-tipo')?.value.trim() || '';
  const marca      = document.getElementById('inv-marca')?.value.trim()      || '';
  const modelo     = document.getElementById('inv-modelo')?.value.trim()     || '';
  const serie      = document.getElementById('inv-serie')?.value.trim()      || '';
  const color      = document.getElementById('inv-color')?.value.trim()      || '';
  const condicion  = document.getElementById('inv-condicion')?.value         || 'bueno';
  const estado     = document.getElementById('inv-estado')?.value            || 'disponible';
  const ubicacion  = document.getElementById('inv-ubicacion')?.value.trim()  || '';
  const responsable= document.getElementById('inv-responsable')?.value.trim()|| '';
  const notas      = document.getElementById('inv-notas')?.value.trim()      || '';
  const tieneGarantia = document.getElementById('inv-tiene-garantia')?.checked || false;
  const garantia = tieneGarantia ? {
    inicio:    document.getElementById('inv-garantia-inicio')?.value    || '',
    vence:     document.getElementById('inv-garantia-vence')?.value     || '',
    proveedor: document.getElementById('inv-garantia-proveedor')?.value.trim() || ''
  } : null;
  const errEl      = document.getElementById('inv-modal-err');
  const showErr    = msg => { errEl.textContent = msg; errEl.style.display = ''; };
  errEl.style.display = 'none';
  if (!tipo)  return showErr('El tipo de equipo es requerido.');
  if (!marca) return showErr('La marca es requerida.');
  const btn = document.getElementById('invModalSaveBtn');
  btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Guardando…';
  try {
    if (editingInvId) {
      await api(`/api/inventory/${editingInvId}`, 'PATCH', { tipo, marca, modelo, serie, color, condicion, estado, ubicacion, responsable, notas, garantia, adminUser: adminNombre });
      showToast('Equipo actualizado ✓');
    } else {
      await api('/api/inventory', 'POST', { tipo, marca, modelo, serie, color, condicion, ubicacion, responsable, notas, garantia, adminUser: adminNombre });
      showToast('Equipo agregado al inventario ✓');
    }
    closeInventoryModal();
    await loadDevices();
    renderInventorySection();
  } catch {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar equipo';
    showErr('Error al guardar. Verifica la conexión.');
  }
}

async function deleteInventoryItem(id) {
  const item = inventoryCache.find(i => i.id === id);
  if (!confirm(`¿Eliminar "${item?.marca} ${item?.modelo || ''}" (${id}) del inventario?\nEsta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/inventory/${id}`, 'DELETE', { adminUser: adminNombre });
    showToast('Equipo eliminado del inventario');
    await loadDevices();
    renderInventorySection();
  } catch { showToast('Error al eliminar'); }
}

// ── Loan modal ────────────────────────────────────────────────────────────────
let loanForItemId = null;

async function openLoanModal(itemId) {
  loanForItemId = itemId;
  const availableItems = inventoryCache.filter(i => i.estado === 'disponible');

  let adminOptions = '<option value="">Sin especificar</option>';
  try {
    const admins = await api('/api/admins');
    adminOptions += admins.map(a =>
      `<option value="${a.nombre}">${a.nombre} (${a.rol})</option>`
    ).join('');
  } catch {}

  document.getElementById('loanModalBody').innerHTML = `
<div style="display:flex;flex-direction:column;gap:14px">
  <div class="field-group">
    <label>Equipo a prestar *</label>
    <select id="loan-item">
      <option value="">— Seleccionar equipo —</option>
      ${availableItems.map(i => `
        <option value="${i.id}" ${i.id === itemId ? 'selected' : ''}>
          ${i.id} — ${i.marca} ${i.modelo || i.tipo}
        </option>`).join('')}
    </select>
  </div>
  <div class="field-row">
    <div class="field-group">
      <label>Empleado / Responsable *</label>
      <input id="loan-empleado" type="text" placeholder="Nombre completo">
    </div>
    <div class="field-group">
      <label>Departamento</label>
      <input id="loan-dept" type="text" placeholder="Contabilidad, Ventas…">
    </div>
  </div>
  <div class="field-row">
    <div class="field-group">
      <label>Fecha estimada de devolución</label>
      <input id="loan-devolucion" type="date">
    </div>
    <div class="field-group">
      <label>Autorizado por</label>
      <select id="loan-auth">${adminOptions}</select>
    </div>
  </div>
  <div class="field-group">
    <label>Notas</label>
    <textarea id="loan-notas" rows="2" style="border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;font-family:var(--font);resize:vertical;outline:none;background:var(--light);color:var(--text)"
              placeholder="Condiciones, observaciones…"></textarea>
  </div>
  ${!availableItems.length ? `<div class="rec-error" style="display:block">No hay equipos disponibles para préstamo.</div>` : ''}
  <div id="loan-modal-err" class="rec-error" style="display:none"></div>
</div>`;
  document.getElementById('loanModalBackdrop').classList.add('open');
}

function closeLoanModal() {
  document.getElementById('loanModalBackdrop').classList.remove('open');
  loanForItemId = null;
}

async function saveLoan() {
  const inventoryId = document.getElementById('loan-item')?.value || '';
  const empleado    = (document.getElementById('loan-empleado')?.value || '').trim();
  const departamento= (document.getElementById('loan-dept')?.value     || '').trim();
  const fechaDev    = document.getElementById('loan-devolucion')?.value || '';
  const autorizadoPor = document.getElementById('loan-auth')?.value    || '';
  const notas       = (document.getElementById('loan-notas')?.value    || '').trim();
  const errEl = document.getElementById('loan-modal-err');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = ''; };
  errEl.style.display = 'none';
  if (!inventoryId) return showErr('Selecciona un equipo.');
  if (!empleado)    return showErr('El nombre del empleado es requerido.');
  try {
    await api('/api/loans', 'POST', { inventoryId, empleado, departamento, fechaDevolucion: fechaDev, autorizadoPor, notas, adminUser: adminNombre });
    showToast('Préstamo registrado ✓');
    closeLoanModal();
    await loadDevices();
    renderInventorySection();
  } catch (e) {
    showErr(e.message.includes('409') ? 'El equipo ya está prestado.' : 'Error al registrar préstamo.');
  }
}

function generateLoanWord(loanId) {
  try {
  const loan = loansCache.find(l => l.id === loanId);
  if (!loan) return showToast('Préstamo no encontrado');
  const item = inventoryCache.find(i => i.id === loan.inventoryId) || {};

  const now     = new Date();
  const dia     = now.getDate();
  const mes     = now.toLocaleDateString('es-HN', { month: 'long' }).toUpperCase();
  const anio    = now.getFullYear();
  const hoy     = now.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' });

  const condMap  = { excelente:'Excelente', bueno:'Bueno', regular:'Regular', danado:'Dañado' };
  const condicion = condMap[item.condicion] || item.condicion || '';
  const tipoDesc  = [item.tipo, item.marca, item.modelo].filter(Boolean).join(' ');
  const logoUrl   = window.location.origin + '/gcm.jpg';

  const S  = 'font-family:Arial,sans-serif;font-size:11pt;color:#000;';
  const SB = 'font-family:Arial,sans-serif;font-size:11pt;color:#000;font-weight:bold;';
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Prestamo ${loan.id}</title>
<style>
body{${S}margin:1.5cm 2cm;line-height:1.3;}
table{${S}border-collapse:collapse;}
p{margin:0 0 7px;padding:0;}
</style>
</head>
<body>

<table border="0" width="100%" cellspacing="0" cellpadding="0" style="height:70px;">
<tr style="height:70px;">
<td style="width:75px;padding:0;" valign="middle">
  <img src="${logoUrl}" width="65" height="65"
       style="width:65px;height:65px;mso-width-source:userset;mso-height-source:userset;display:block;">
</td>
<td align="center" valign="middle" style="${S}font-size:14pt;font-weight:bold;text-decoration:underline;">
GRUPO CAMARONERO MILCIEN S.A. de C.V.
</td>
</tr>
</table>

<hr style="border:0;border-top:2px solid #000;margin:6px 0 10px;">

<p><b>ASUNTO:</b>&nbsp;&nbsp;PRESTAMO DE EQUIPO TECNOLOGICO.&nbsp;&nbsp;&nbsp;&nbsp;No.&nbsp;${loan.id}</p>

<p><b>FECHA:</b>&nbsp;&nbsp;__${dia}__de__${mes}__${anio}__.</p>

<p style="text-align:justify;line-height:1.5;margin-bottom:8px;">
POR ESTE MEDIO HACEMOS CONSTAR, QUE SE ENTREGO EN CALIDAD DE PRESTAMO
LA CANTIDAD DE: __1__ ${tipoDesc.toUpperCase()} CON LAS SIGUIENTES CARACTERISTICAS:
</p>

<table border="0" cellpadding="2" cellspacing="0" style="margin-left:18px;margin-bottom:10px;line-height:1.5;">
<tr><td style="${SB}">MARCA:</td><td style="${S}">&nbsp;${(item.marca || '').toUpperCase()}${item.modelo ? ' ' + item.modelo.toUpperCase() : ''}</td></tr>
${item.serie     ? `<tr><td style="${SB}">S/N:</td><td style="${S}">&nbsp;${item.serie.toUpperCase()}</td></tr>` : ''}
${item.color     ? `<tr><td style="${SB}">COLOR:</td><td style="${S}">&nbsp;${item.color.toUpperCase()}</td></tr>` : ''}
${condicion      ? `<tr><td style="${SB}">CONDICION:</td><td style="${S}">&nbsp;${condicion.toUpperCase()}</td></tr>` : ''}
${item.ubicacion ? `<tr><td style="${SB}">UBICACION HABITUAL:</td><td style="${S}">&nbsp;${item.ubicacion.toUpperCase()}</td></tr>` : ''}
</table>

<p><b>FECHA DE DEVOLUCION ESTIMADA:</b>&nbsp;${loan.fechaDevolucionEstimada ? loan.fechaDevolucionEstimada : '__________________________'}</p>

${loan.notas ? `<p><b>NOTA:</b>&nbsp;${String(loan.notas).toUpperCase()}</p>` : ''}

<table border="0" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
<tr>
<td width="20%">&nbsp;</td>
<td width="60%" align="center" style="${S}font-weight:bold;border-top:1px solid #000;padding-top:6px;">
${String(loan.empleado || '').toUpperCase()}${loan.departamento ? `<br><span style="${S}font-weight:normal;">${String(loan.departamento).toUpperCase()}</span>` : ''}
</td>
<td width="20%">&nbsp;</td>
</tr>
</table>

<table border="0" width="100%" cellspacing="0" cellpadding="3" style="margin-top:28px;">
<tr>
<td width="50%" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Entregado por:</b><br>${String(adminNombre || 'Depto. Sistemas / TI').toUpperCase()}
</td>
<td width="50%" align="right" valign="top" style="${S}border-top:2px solid #000;padding-top:6px;">
<b>Recibi Conforme:</b><br>${String(loan.empleado || '').toUpperCase()}
</td>
</tr>
</table>

</body>
</html>`;

  const blob = new Blob(['﻿' + html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `prestamo_${loan.id}_${loan.inventoryId}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast('Comprobante generado ✓');
  } catch (err) {
    console.error('generateLoanWord:', err);
    showToast('Error al generar comprobante: ' + err.message);
  }
}

async function returnLoan(loanId) {
  if (!confirm('¿Registrar la devolución de este equipo?')) return;
  try {
    await api(`/api/loans/${loanId}`, 'PATCH', { estado: 'devuelto', adminUser: adminNombre });
    showToast('Devolución registrada ✓');
    await loadDevices();
    renderInventorySection();
  } catch { showToast('Error al registrar devolución'); }
}

async function returnLoanByItem(itemId) {
  const loan = loansCache.find(l => l.inventoryId === itemId && l.estado === 'activo');
  if (!loan) return showToast('No se encontró préstamo activo');
  await returnLoan(loan.id);
}

// ── Gestión de usuarios ───────────────────────────────────────────────────────
function usrInitials(nombre, apellido) {
  const n = (nombre || '').trim();
  const a = (apellido || '').trim();
  if (!n) return '?';
  return (n[0] + (a ? a[0] : n[1] || '')).toUpperCase();
}

function usrAvatarCls(nivel) {
  return ['', 'av-gray', 'av-blue', 'av-green', 'av-coral'][nivel] || 'av-gray';
}

function usrRolBadge(rol) {
  const cls = { empleado: 'gray', tecnico: 'blue', admin: 'green', superadmin: 'amber' }[rol] || 'gray';
  return `<span class="usr-badge usr-badge-${cls}">${rol || 'empleado'}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

function renderUsersSection() {
  const activos   = usuariosCache.filter(u => u.activo);
  const inactivos = usuariosCache.filter(u => !u.activo);
  const pendientes = solicitudesCache.filter(s => s.estado === 'pendiente');

  const statsHtml = `
    <div class="inv-stats-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="inv-stat-card blue">
        <div class="inv-stat-icon"><i class="ti ti-users"></i></div>
        <div><div class="inv-stat-val">${usuariosCache.length}</div><div class="inv-stat-lbl">Total usuarios</div></div>
      </div>
      <div class="inv-stat-card green">
        <div class="inv-stat-icon"><i class="ti ti-user-check"></i></div>
        <div><div class="inv-stat-val">${activos.length}</div><div class="inv-stat-lbl">Activos</div></div>
      </div>
      <div class="inv-stat-card red">
        <div class="inv-stat-icon"><i class="ti ti-user-off"></i></div>
        <div><div class="inv-stat-val">${inactivos.length}</div><div class="inv-stat-lbl">Inactivos</div></div>
      </div>
      <div class="inv-stat-card amber">
        <div class="inv-stat-icon"><i class="ti ti-mail-opened"></i></div>
        <div><div class="inv-stat-val">${pendientes.length}</div><div class="inv-stat-lbl">Solicitudes pendientes</div></div>
      </div>
    </div>`;

  const solsHtml = renderSolicitudesHtml();
  const usrsHtml = renderUsrListHtml();

  document.getElementById('receptionSection').innerHTML = `
    <div class="usr-section">
      <div class="inv-section-header">
        <h2 class="inv-section-title"><i class="ti ti-users" style="color:#6366f1"></i> Gestión de usuarios</h2>
      </div>
      ${statsHtml}
      <div class="usr-card">
        <div class="usr-card-header">
          <span class="usr-card-title"><i class="ti ti-clipboard-list"></i> Solicitudes de acceso</span>
          <div class="usr-filter-tabs">
            <button class="usr-ftab${usrSolFilter==='pendiente'?' active':''}" onclick="setUsrSolFilter('pendiente')">Pendientes <span class="usr-ftab-cnt">${pendientes.length}</span></button>
            <button class="usr-ftab${usrSolFilter==='aprobado'?' active':''}" onclick="setUsrSolFilter('aprobado')">Aprobadas</button>
            <button class="usr-ftab${usrSolFilter==='rechazado'?' active':''}" onclick="setUsrSolFilter('rechazado')">Rechazadas</button>
          </div>
        </div>
        <div id="solsList">${solsHtml}</div>
      </div>
      <div class="usr-card">
        <div class="usr-card-header">
          <span class="usr-card-title"><i class="ti ti-address-book"></i> Usuarios registrados</span>
          <input class="usr-search" id="usrSearchInput" type="search" placeholder="Buscar por nombre, usuario o correo…"
                 value="${usrSearch}" oninput="usrSearch=this.value;document.getElementById('usrList').innerHTML=renderUsrListHtml()">
        </div>
        <div id="usrList">${usrsHtml}</div>
      </div>
    </div>`;
}

function setUsrSolFilter(f) {
  usrSolFilter = f;
  renderUsersSection();
}

function renderSolicitudesHtml() {
  const filtered = solicitudesCache.filter(s => s.estado === usrSolFilter);
  if (!filtered.length) {
    return `<div class="usr-empty"><i class="ti ti-inbox"></i><br>No hay solicitudes ${usrSolFilter === 'pendiente' ? 'pendientes' : usrSolFilter === 'aprobado' ? 'aprobadas' : 'rechazadas'}</div>`;
  }
  return filtered.map(s => {
    const estadoBadge = s.estado === 'pendiente'
      ? `<span class="usr-badge usr-badge-amber">Pendiente</span>`
      : s.estado === 'aprobado'
      ? `<span class="usr-badge usr-badge-green">Aprobada</span>`
      : `<span class="usr-badge usr-badge-red">Rechazada</span>`;
    const actions = s.estado === 'pendiente' ? `
      <button class="usr-btn usr-btn-approve" onclick="aprobarSolicitud(${s.id})"><i class="ti ti-check"></i> Aprobar</button>
      <button class="usr-btn usr-btn-reject"  onclick="rechazarSolicitud(${s.id})"><i class="ti ti-x"></i> Rechazar</button>` : '';
    const meta = [
      s.email        ? `<i class="ti ti-mail"></i> ${s.email}` : '',
      s.departamento ? `<i class="ti ti-building"></i> ${s.departamento}` : '',
      `<i class="ti ti-calendar"></i> ${fmtDate(s.created_at)}`
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    return `
      <div class="usr-sol-row">
        <div class="usr-sol-avatar ${usrAvatarCls(1)}">${usrInitials(s.nombre, s.apellido)}</div>
        <div class="usr-sol-info">
          <div class="usr-sol-name">${s.nombre || ''} ${s.apellido || ''} <span class="usr-sol-username">@${s.username}</span></div>
          <div class="usr-sol-meta">${meta}</div>
          ${s.mensaje ? `<div class="usr-sol-msg">"${s.mensaje}"</div>` : ''}
          <div class="usr-sol-badges">${estadoBadge}</div>
        </div>
        <div class="usr-sol-actions">${actions}</div>
      </div>`;
  }).join('');
}

function renderUsrListHtml() {
  const q = usrSearch.toLowerCase();
  const allFiltered = usuariosCache.filter(u => {
    if (!q) return true;
    return (u.nombre||'').toLowerCase().includes(q)
      || (u.apellido||'').toLowerCase().includes(q)
      || (u.username||'').toLowerCase().includes(q)
      || (u.email||'').toLowerCase().includes(q);
  });
  if (!allFiltered.length) {
    return `<div class="usr-empty"><i class="ti ti-users-minus"></i><br>No se encontraron usuarios</div>`;
  }
  const currentUsername = sessionStorage.getItem(USERNAME_KEY) || '';

  function renderUsrRow(u) {
    const actBadge = u.activo
      ? `<span class="usr-badge usr-badge-green"><i class="ti ti-circle-check"></i> Activo</span>`
      : `<span class="usr-badge usr-badge-gray"><i class="ti ti-circle-minus"></i> Inactivo</span>`;
    const isSelf = u.username === currentUsername;
    const detailBtn = `<button class="usr-btn usr-btn-detail" onclick="openUsrDetail(${u.id})"><i class="ti ti-eye"></i> Ver</button>`;
    const toggleBtn = isSelf ? '' : u.activo
      ? `<button class="usr-btn usr-btn-deactivate" onclick="toggleUserActivo(${u.id},false)"><i class="ti ti-user-off"></i> Desactivar</button>`
      : `<button class="usr-btn usr-btn-activate"   onclick="toggleUserActivo(${u.id},true)"><i class="ti ti-user-check"></i> Activar</button>`;
    const deleteBtn = isSelf ? '' : `<button class="usr-btn usr-btn-delete" onclick="deleteUser(${u.id},'${(u.nombre+' '+(u.apellido||'')).trim().replace(/'/g,"\\'")}')"><i class="ti ti-trash"></i> Eliminar</button>`;
    const meta = [
      u.email        ? `<i class="ti ti-mail"></i> ${u.email}` : '',
      u.departamento ? `<i class="ti ti-building"></i> ${u.departamento}` : '',
      u.ultimo_login ? `<i class="ti ti-login"></i> ${fmtDate(u.ultimo_login)}` : '<i class="ti ti-login"></i> Nunca'
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    return `
      <div class="usr-row${u.activo ? '' : ' usr-row-inactive'}">
        <div class="usr-avatar ${usrAvatarCls(u.nivel)}">${usrInitials(u.nombre, u.apellido)}</div>
        <div class="usr-info">
          <div class="usr-name">${u.nombre || ''} ${u.apellido || ''} <span class="usr-username">@${u.username}</span>${isSelf ? ' <span class="usr-badge usr-badge-blue">Tú</span>' : ''}</div>
          <div class="usr-meta">${meta}</div>
          <div class="usr-row-badges">${usrRolBadge(u.rol)} ${actBadge}</div>
        </div>
        <div class="usr-actions">${detailBtn}${toggleBtn}${deleteBtn}</div>
      </div>`;
  }

  const sysUsers  = allFiltered.filter(u => u.nivel >= 2);
  const empleados = allFiltered.filter(u => u.nivel  < 2);
  let html = '';

  if (sysUsers.length) {
    html += `<div class="usr-group-sep"><i class="ti ti-shield-check"></i> Usuarios del sistema <span class="usr-group-cnt">${sysUsers.length}</span></div>`;
    html += sysUsers.map(renderUsrRow).join('');
  }
  if (empleados.length) {
    html += `<div class="usr-group-sep"><i class="ti ti-users"></i> Empleados <span class="usr-group-cnt">${empleados.length}</span></div>`;
    html += empleados.map(renderUsrRow).join('');
  }
  return html;
}

function openUsrDetail(id) {
  const u = usuariosCache.find(x => x.id === id);
  if (!u) return;
  document.getElementById('usrDetailTitle').innerHTML = `<i class="ti ti-user-circle"></i> ${u.nombre} ${u.apellido || ''}`;
  document.getElementById('usrDetailBody').innerHTML = `
<div class="usd-tabs">
  <button class="usd-tab active" id="usdTabPerfil"  onclick="switchUsrTab('perfil',${u.id})"><i class="ti ti-user"></i> Perfil</button>
  <button class="usd-tab"        id="usdTabTickets" onclick="switchUsrTab('tickets',${u.id})"><i class="ti ti-ticket"></i> Tickets</button>
</div>
<div id="usdTabContent">${renderUsrDetailHtml(u)}</div>`;
  document.getElementById('usrDetailBackdrop').classList.add('open');
}

function switchUsrTab(tab, userId) {
  document.getElementById('usdTabPerfil').classList.toggle('active',  tab === 'perfil');
  document.getElementById('usdTabTickets').classList.toggle('active', tab === 'tickets');
  if (tab === 'perfil') {
    const u = usuariosCache.find(x => x.id === userId);
    document.getElementById('usdTabContent').innerHTML = renderUsrDetailHtml(u);
  } else {
    loadUsrTickets(userId);
  }
}

async function loadUsrTickets(userId) {
  const content = document.getElementById('usdTabContent');
  content.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-sec)"><i class="ti ti-loader-2" style="font-size:24px"></i><br>Cargando tickets…</div>';
  try {
    const res = await fetch(`/api/usuarios/${userId}/tickets`);
    const { nombre, tickets } = await res.json();

    if (!tickets.length) {
      content.innerHTML = `<div style="padding:36px;text-align:center;color:var(--text-sec)">
        <i class="ti ti-ticket" style="font-size:36px;opacity:.3"></i><br>
        <span style="font-size:13px;margin-top:8px;display:block">${nombre} no tiene tickets registrados</span>
      </div>`;
      return;
    }

    const stLabel = { abierto:'Abierto', en_progreso:'En progreso', cerrado:'Cerrado' };
    const stColor = { abierto:'#3b82f6', en_progreso:'#f59e0b', cerrado:'#10b981' };
    const prioColor = { Crítica:'#ef4444', Alta:'#f97316', Media:'#f59e0b', Baja:'#94a3b8' };

    const total     = tickets.length;
    const abiertos  = tickets.filter(t => t.status === 'abierto').length;
    const progreso  = tickets.filter(t => t.status === 'en_progreso').length;
    const cerrados  = tickets.filter(t => t.status === 'cerrado').length;

    content.innerHTML = `
<div style="padding:4px 0 0">
  <div class="usd-tkt-stats">
    <div class="usd-tkt-stat"><span class="usd-tkt-stat-n">${total}</span><span>Total</span></div>
    <div class="usd-tkt-stat"><span class="usd-tkt-stat-n" style="color:#3b82f6">${abiertos}</span><span>Abiertos</span></div>
    <div class="usd-tkt-stat"><span class="usd-tkt-stat-n" style="color:#f59e0b">${progreso}</span><span>En progreso</span></div>
    <div class="usd-tkt-stat"><span class="usd-tkt-stat-n" style="color:#10b981">${cerrados}</span><span>Cerrados</span></div>
  </div>
  <div class="usd-tkt-list">
    ${tickets.map(t => `
    <div class="usd-tkt-row" onclick="openDetailFromUser('${t.id}')" title="Ver ticket">
      <div class="usd-tkt-main">
        <span class="usd-tkt-id">${t.id}</span>
        <span class="usd-tkt-title">${t.titulo}</span>
      </div>
      <div class="usd-tkt-meta">
        <span class="usd-tkt-badge" style="background:${stColor[t.status]}20;color:${stColor[t.status]}">${stLabel[t.status] || t.status}</span>
        <span class="usd-tkt-badge" style="background:${prioColor[t.prioridad]}20;color:${prioColor[t.prioridad]}">${t.prioridad}</span>
        <span style="font-size:11px;color:var(--text-sec)">${fmtDate(t.created_at)}</span>
      </div>
    </div>`).join('')}
  </div>
</div>`;

    // Actualizar badge en tab
    document.getElementById('usdTabTickets').innerHTML = `<i class="ti ti-ticket"></i> Tickets <span style="background:var(--blue);color:white;border-radius:20px;padding:1px 7px;font-size:11px;margin-left:2px">${total}</span>`;
  } catch {
    content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-sec)">Error al cargar tickets</div>';
  }
}

function openDetailFromUser(ticketId) {
  closeUsrDetail();
  const t = ticketCache.find(x => x.id === ticketId);
  if (t) openDetail(t);
}

function closeUsrDetail() {
  document.getElementById('usrDetailBackdrop').classList.remove('open');
}

function toggleUsdPass() {
  const inp  = document.getElementById('usdNewPass');
  const icon = document.getElementById('usdEyeIcon');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  icon.className = show ? 'ti ti-eye-off' : 'ti ti-eye';
}

function copyUsdVal(el) {
  const text = el.childNodes[0].textContent.trim();
  navigator.clipboard.writeText(text).then(() => showToast('Copiado al portapapeles'));
}

function renderUsrDetailHtml(u) {
  const row = (icon, label, val) => val
    ? `<div class="usd-row"><span class="usd-label"><i class="ti ${icon}"></i> ${label}</span><span class="usd-val">${val}</span></div>`
    : '';
  const rolCls = { empleado:'gray', tecnico:'blue', admin:'green', superadmin:'amber' }[u.rol] || 'gray';

  return `
<div style="display:flex;flex-direction:column;gap:0">
  <div class="usd-avatar-row">
    <div class="usr-avatar ${usrAvatarCls(u.nivel)} usd-avatar">${usrInitials(u.nombre, u.apellido)}</div>
    <div>
      <div class="usd-name">${u.nombre} ${u.apellido || ''}</div>
      <div class="usd-username">@${u.username}</div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="usr-badge usr-badge-${rolCls}">${u.rol || 'empleado'}</span>
        ${u.activo ? '<span class="usr-badge usr-badge-green"><i class="ti ti-circle-check"></i> Activo</span>' : '<span class="usr-badge usr-badge-gray"><i class="ti ti-circle-minus"></i> Inactivo</span>'}
      </div>
    </div>
  </div>

  <div class="usd-section">
    <div class="usd-row">
      <span class="usd-label"><i class="ti ti-user"></i> Usuario</span>
      <span class="usd-val usd-copyable" onclick="copyUsdVal(this)" title="Clic para copiar">
        ${u.username} <i class="ti ti-copy" style="font-size:.75rem;opacity:.5"></i>
      </span>
    </div>
    ${row('ti-mail',     'Correo',       u.email)}
    ${row('ti-phone',    'Teléfono',     u.telefono)}
    ${row('ti-building', 'Departamento', u.departamento)}
    ${row('ti-login',    'Último acceso',u.ultimo_login ? fmtDate(u.ultimo_login) : 'Nunca')}
    ${row('ti-calendar', 'Registrado',   fmtDate(u.created_at))}
  </div>

  <div class="usd-section">
    <div class="usd-section-title"><i class="ti ti-lock"></i> Contraseña</div>
    <div style="display:flex;gap:8px;align-items:center">
      <div style="position:relative;flex:1">
        <input id="usdNewPass" type="password" placeholder="Escribir nueva contraseña…"
               class="usd-pass-input" autocomplete="new-password" style="width:100%;padding-right:38px">
        <button onclick="toggleUsdPass()" title="Mostrar / ocultar"
                style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:0;font-size:1rem">
          <i class="ti ti-eye" id="usdEyeIcon"></i>
        </button>
      </div>
      <button class="usr-btn usr-btn-approve" onclick="changeUsrPassword(${u.id})">
        <i class="ti ti-device-floppy"></i> Guardar
      </button>
    </div>
    <div id="usdPassMsg" style="font-size:.78rem;margin-top:6px"></div>
  </div>
</div>`;
}

async function changeUsrPassword(id) {
  const pass = document.getElementById('usdNewPass')?.value || '';
  const msg  = document.getElementById('usdPassMsg');
  if (pass.length < 6) { msg.style.color = '#dc2626'; msg.textContent = 'Mínimo 6 caracteres.'; return; }
  const username = sessionStorage.getItem(USERNAME_KEY) || '';
  try {
    const res  = await fetch(`/api/usuarios/${id}/password`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: username, newPassword: pass })
    });
    const json = await res.json();
    if (res.ok) {
      msg.style.color = '#059669';
      msg.textContent = 'Contraseña actualizada correctamente.';
      document.getElementById('usdNewPass').value = '';
    } else {
      msg.style.color = '#dc2626';
      msg.textContent = json.error || 'Error al cambiar contraseña.';
    }
  } catch { msg.style.color = '#dc2626'; msg.textContent = 'Error de conexión.'; }
}

async function aprobarSolicitud(id) {
  if (!confirm('¿Aprobar esta solicitud y crear la cuenta de usuario?')) return;
  const username = sessionStorage.getItem(USERNAME_KEY) || '';
  try {
    const res = await fetch(`/api/solicitudes/${id}/aprobar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: username })
    });
    const json = await res.json();
    if (res.ok) { showToast('Solicitud aprobada y cuenta creada'); await loadUsersData(); }
    else         showToast('Error: ' + (json.error || 'No se pudo aprobar'));
  } catch { showToast('Error de conexión'); }
}

async function rechazarSolicitud(id) {
  const motivo = prompt('Motivo de rechazo (opcional):');
  if (motivo === null) return;
  const username = sessionStorage.getItem(USERNAME_KEY) || '';
  try {
    const res = await fetch(`/api/solicitudes/${id}/rechazar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: username, motivo })
    });
    const json = await res.json();
    if (res.ok) { showToast('Solicitud rechazada'); await loadUsersData(); }
    else         showToast('Error: ' + (json.error || 'No se pudo rechazar'));
  } catch { showToast('Error de conexión'); }
}

async function deleteUser(id, nombre) {
  if (!confirm(`¿Eliminar permanentemente a "${nombre}"?\n\nEsta acción no se puede deshacer. Los tickets asignados quedarán sin asignar.`)) return;
  const username = sessionStorage.getItem(USERNAME_KEY) || '';
  try {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: username })
    });
    const json = await res.json();
    if (res.ok) { showToast('Usuario eliminado'); await loadUsersData(); }
    else         showToast('Error: ' + (json.error || 'No se pudo eliminar'));
  } catch { showToast('Error de conexión'); }
}

async function toggleUserActivo(id, activo) {
  const username = sessionStorage.getItem(USERNAME_KEY) || '';
  const label = activo ? 'activar' : 'desactivar';
  if (!confirm(`¿Deseas ${label} este usuario?`)) return;
  try {
    const res = await fetch(`/api/usuarios/${id}/activo`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedBy: username, activo })
    });
    const json = await res.json();
    if (res.ok) { showToast(`Usuario ${activo ? 'activado' : 'desactivado'}`); await loadUsersData(); }
    else         showToast('Error: ' + (json.error || 'No se pudo actualizar'));
  } catch { showToast('Error de conexión'); }
}

// ── Auditoría ─────────────────────────────────────────────────────────────────
let auditCache = [];

async function loadAuditData() {
  const section = document.getElementById('auditSection');
  section.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-sec)"><i class="ti ti-loader-2" style="font-size:28px"></i><br>Cargando bitácora…</div>';

  const actor   = document.getElementById('audit-filter-actor')?.value   || '';
  const entidad = document.getElementById('audit-filter-entidad')?.value || '';
  const desde   = document.getElementById('audit-filter-desde')?.value   || '';
  const hasta   = document.getElementById('audit-filter-hasta')?.value   || '';

  const params = new URLSearchParams({ limit: 300 });
  if (actor)   params.set('actor',   actor);
  if (entidad) params.set('entidad', entidad);
  if (desde)   params.set('desde',   desde);
  if (hasta)   params.set('hasta',   hasta);

  try {
    const res = await fetch(`/api/auditoria?${params}`);
    auditCache = res.ok ? await res.json() : [];
  } catch { auditCache = []; }

  renderAuditSection();
}

const AUDIT_ENTIDAD_ICON = {
  ticket:     'ti-ticket',
  inventario: 'ti-package',
  prestamo:   'ti-hand-move',
  usuario:    'ti-user',
  solicitud:  'ti-user-check',
};
const AUDIT_ENTIDAD_COLOR = {
  ticket:     '#3b82f6',
  inventario: '#8b5cf6',
  prestamo:   '#f59e0b',
  usuario:    '#10b981',
  solicitud:  '#06b6d4',
};

function renderAuditSection() {
  const section = document.getElementById('auditSection');

  // Obtener actores únicos para el filtro
  const actores = [...new Set(auditCache.map(r => r.actor).filter(Boolean))].sort();

  section.innerHTML = `
<div class="audit-wrap">
  <div class="audit-header">
    <div class="audit-title"><i class="ti ti-history"></i> Bitácora del Sistema</div>
    <div class="audit-filters">
      <input class="audit-input" id="audit-filter-actor" type="text"
             placeholder="Filtrar por usuario…" list="audit-actors-list"
             value="${document.getElementById('audit-filter-actor')?.value || ''}"
             onchange="loadAuditData()" oninput="if(!this.value)loadAuditData()">
      <datalist id="audit-actors-list">${actores.map(a => `<option value="${a}">`).join('')}</datalist>
      <select class="audit-sel" id="audit-filter-entidad" onchange="loadAuditData()">
        <option value="">Todas las áreas</option>
        <option value="ticket"     ${document.getElementById('audit-filter-entidad')?.value==='ticket'     ?'selected':''}>Tickets</option>
        <option value="inventario" ${document.getElementById('audit-filter-entidad')?.value==='inventario' ?'selected':''}>Inventario</option>
        <option value="prestamo"   ${document.getElementById('audit-filter-entidad')?.value==='prestamo'   ?'selected':''}>Préstamos</option>
        <option value="usuario"    ${document.getElementById('audit-filter-entidad')?.value==='usuario'    ?'selected':''}>Usuarios</option>
        <option value="solicitud"  ${document.getElementById('audit-filter-entidad')?.value==='solicitud'  ?'selected':''}>Solicitudes</option>
      </select>
      <input class="audit-input" id="audit-filter-desde" type="date"
             value="${document.getElementById('audit-filter-desde')?.value || ''}"
             onchange="loadAuditData()">
      <input class="audit-input" id="audit-filter-hasta" type="date"
             value="${document.getElementById('audit-filter-hasta')?.value || ''}"
             onchange="loadAuditData()">
      <button class="audit-clear-btn" onclick="clearAuditFilters()" title="Limpiar filtros">
        <i class="ti ti-x"></i> Limpiar
      </button>
    </div>
  </div>

  <div class="audit-count">${auditCache.length} registro${auditCache.length !== 1 ? 's' : ''}</div>

  ${auditCache.length === 0
    ? `<div class="audit-empty"><i class="ti ti-history" style="font-size:40px;opacity:.3"></i><br>No hay registros en la bitácora</div>`
    : `<div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Fecha / Hora</th>
              <th>Usuario</th>
              <th>Área</th>
              <th>Acción / Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${auditCache.map(r => {
              const icon  = AUDIT_ENTIDAD_ICON[r.entidad]  || 'ti-dot';
              const color = AUDIT_ENTIDAD_COLOR[r.entidad] || '#64748b';
              const fecha = new Date(r.fecha);
              const fechaStr = fecha.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
              const horaStr  = fecha.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
              return `<tr class="audit-row">
                <td class="audit-fecha"><span>${fechaStr}</span><span class="audit-hora">${horaStr}</span></td>
                <td class="audit-actor">${r.actor ? `<i class="ti ti-user-circle" style="color:var(--text-sec)"></i> ${r.actor}` : '<span style="color:var(--text-sec)">—</span>'}</td>
                <td><span class="audit-badge" style="background:${color}20;color:${color}"><i class="ti ${icon}"></i> ${r.entidad || '—'}</span></td>
                <td class="audit-accion">
                  <span class="audit-accion-text">${r.accion}</span>
                  ${r.detalle ? `<span class="audit-detalle">${r.detalle}</span>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`
  }
</div>`;
}

function clearAuditFilters() {
  document.getElementById('audit-filter-actor').value   = '';
  document.getElementById('audit-filter-entidad').value = '';
  document.getElementById('audit-filter-desde').value   = '';
  document.getElementById('audit-filter-hasta').value   = '';
  loadAuditData();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetail();
    closeAdminManager();
    closeInventoryModal();
    closeLoanModal();
    closeUsrDetail();
  }
});

if (sessionStorage.getItem(SESSION_KEY)) {
  adminNombre = sessionStorage.getItem(NOMBRE_KEY) || 'Admin';
  document.getElementById('adminBadge').textContent = adminNombre.toUpperCase();
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').classList.add('visible');
  initNotifications();
  loadAdmins();
  refreshTickets();
  loadDevices();
  loadUsersData();
}

setInterval(() => {
  if (sessionStorage.getItem(SESSION_KEY)) refreshTickets();
}, 10000);
