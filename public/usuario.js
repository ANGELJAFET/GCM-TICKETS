const AUTH_KEY  = 'gcm_auth_session';
const TOKEN_KEY = 'gcm_auth_token';
const DARK_KEY  = 'gcm_dark';

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

const authSession = (() => {
  const s = sessionStorage.getItem(AUTH_KEY);
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
})();
let myUser   = authSession?.nombre || '';
let myUserId = authSession?.id || null;
let ticketCache   = [];
let currentFilter = 'todos';

// ── API ───────────────────────────────────────────────────────────────────────
function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...authHeaders() } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { changeIdentity(); throw new Error('Sesión expirada'); }
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

async function refreshTickets() {
  try {
    ticketCache = await api('/api/tickets');
    renderMyTickets();
  } catch {
    showToast('No se pudo conectar al servidor');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function statusLabel(s) {
  return { abierto:'Abierto', en_progreso:'En progreso', cerrado:'Cerrado' }[s] || s;
}
function statusIcon(s) {
  return { abierto:'ti-circle-dot', en_progreso:'ti-loader', cerrado:'ti-circle-check' }[s] || 'ti-circle';
}
function commentHtml(c) {
  const isUser = c.rolNivel < 2;
  const icon   = isUser
    ? '<i class="ti ti-user-circle" style="font-size:12px;color:var(--blue);vertical-align:-1px" aria-hidden="true"></i>'
    : '<i class="ti ti-headset" style="font-size:12px;color:var(--gray);vertical-align:-1px" aria-hidden="true"></i>';
  const autor = isUser ? escapeHtml(c.user || '—') : 'Soporte Técnico';
  return `<div class="comment-item ${isUser ? 'user-msg' : 'admin-msg'}">${icon} <strong>${autor}</strong> (${escapeHtml(c.ts)}): ${escapeHtml(c.text)}</div>`;
}

// ── Adjuntos ──────────────────────────────────────────────────────────────────
function tcAttachmentHtml(a) {
  const name  = escapeHtml(a.name);
  const path  = escapeHtml(a.path);
  const isImg   = /\.(jpg|jpeg|png|gif|webp)$/i.test(a.name);
  const isVideo = /\.(mp4|mov|avi|webm|3gp)$/i.test(a.name);

  if (isImg) {
    return `
      <a class="tc-attach-img-wrap" href="${path}" target="_blank" title="${name}">
        <img src="${path}" alt="${name}" class="tc-attach-img">
        <span class="tc-attach-img-name"><i class="ti ti-photo" style="font-size:10px"></i> ${name}</span>
      </a>`;
  }
  if (isVideo) {
    return `
      <div class="tc-attach-img-wrap" style="max-width:220px">
        <video class="tc-attach-img" src="${path}" controls preload="metadata" style="max-height:140px;background:#000"></video>
        <span class="tc-attach-img-name"><i class="ti ti-video" style="font-size:10px"></i> ${name}</span>
      </div>`;
  }
  return `<a class="tc-attachment-chip" href="${path}" target="_blank"><i class="ti ti-paperclip" style="font-size:11px"></i>${name}</a>`;
}

// ── Filtros de estado ─────────────────────────────────────────────────────────
function setUserFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.uft-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMyTickets();
}


// ── Render ────────────────────────────────────────────────────────────────────
function renderMyTickets() {
  const mine   = myUserId ? ticketCache.filter(t => t.reporterId === myUserId) : [];
  const el     = document.getElementById('myTickets');
  const count  = document.getElementById('myCount');
  count.textContent = mine.length || '';

  const byStatus = { abierto: 0, en_progreso: 0, cerrado: 0 };
  mine.forEach(t => { if (t.status in byStatus) byStatus[t.status]++; });
  const setBadge = (id, n) => { const b = document.getElementById(id); if (b) b.textContent = n || ''; };
  setBadge('uft-todos',      mine.length);
  setBadge('uft-abierto',    byStatus.abierto);
  setBadge('uft-en_progreso',byStatus.en_progreso);
  setBadge('uft-cerrado',    byStatus.cerrado);

  const visible = currentFilter === 'todos' ? mine : mine.filter(t => t.status === currentFilter);

  if (!myUser || mine.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <i class="ti ti-ticket-off" aria-hidden="true"></i>
        <h3>${myUser ? 'Aún no tienes tickets' : 'Crea tu primer ticket'}</h3>
        <p>Haz clic en <strong>Nuevo ticket</strong> para reportar un problema.</p>
      </div>`;
    return;
  }

  if (visible.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <i class="ti ti-filter-off" aria-hidden="true"></i>
        <h3>Sin tickets en este estado</h3>
        <p>No tienes tickets con ese estado en este momento.</p>
      </div>`;
    return;
  }

  el.innerHTML = visible.map(t => {
    const progressLabel = t.status === 'cerrado' ? 'Resuelto ✓' : t.status === 'en_progreso' ? 'En atención' : 'En espera';
    const commentsHtml  = t.comments.length
      ? t.comments.map(commentHtml).join('')
      : '<p style="font-size:12px;color:var(--gray)">Sin actualizaciones aún.</p>';

    const assigneeHtml = t.asignado && t.asignado !== 'Sin asignar'
      ? `<span style="font-size:11px;color:var(--text-sec);display:flex;align-items:center;gap:3px"><i class="ti ti-user-check" style="font-size:12px" aria-hidden="true"></i> Equipo de Soporte</span>`
      : `<span style="font-size:11px;color:var(--red);font-weight:600;display:flex;align-items:center;gap:3px"><i class="ti ti-user-off" style="font-size:12px" aria-hidden="true"></i> Sin asignar</span>`;


    const replySection = t.status !== 'cerrado'
      ? `<div class="reply-section">
           <div class="reply-label"><i class="ti ti-message-reply" aria-hidden="true"></i> Tu respuesta</div>
           <textarea class="reply-box" id="reply-${t.id}" rows="2" placeholder="Escribe tu mensaje al equipo de soporte..."></textarea>
           <div class="reply-footer">
             <button class="btn-reply" onclick="addUserComment('${t.id}')">
               <i class="ti ti-send" aria-hidden="true"></i> Enviar
             </button>
           </div>
         </div>`
      : `<div class="closed-notice"><i class="ti ti-circle-check" aria-hidden="true"></i> Ticket cerrado — El problema fue resuelto</div>`;

    return `
      <div class="ticket-card">
        <div class="tc-top">
          <div>
            <div class="tc-id">${escapeHtml(t.id)} · ${escapeHtml(t.categoria)}</div>
            <div class="tc-title">${escapeHtml(t.title)}</div>
          </div>
          <span class="badge s-${escapeHtml(t.status)}">
            <i class="ti ${statusIcon(t.status)}" style="font-size:11px" aria-hidden="true"></i>
            ${statusLabel(t.status)}
          </span>
        </div>
        <div class="tc-desc">${escapeHtml(t.desc||'')}</div>
        ${(t.attachments||[]).length ? `
        <div class="tc-attachments">
          ${t.attachments.map(tcAttachmentHtml).join('')}
        </div>` : ''}
        <div class="tc-footer">
          <div class="tc-meta">
            <span class="badge p-${escapeHtml(t.prioridad)}" style="font-size:10px">${escapeHtml(t.prioridad)}</span>
            ${assigneeHtml}
          </div>
          <span class="tc-date"><i class="ti ti-calendar" aria-hidden="true"></i> ${escapeHtml(t.fecha)}</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-label"><span>Progreso</span><span>${progressLabel}</span></div>
          <div class="progress-bar"><div class="progress-fill fill-${t.status}"></div></div>
        </div>
        <div class="comments-section">
          <div class="comments-label">
            <i class="ti ti-messages" aria-hidden="true"></i>
            Historial · ${t.comments.length} ${t.comments.length === 1 ? 'mensaje' : 'mensajes'}
          </div>
          ${commentsHtml}
        </div>
        ${replySection}
      </div>`;
  }).join('');
}

// ── Respuesta del usuario ─────────────────────────────────────────────────────
async function addUserComment(id) {
  const textarea = document.getElementById('reply-' + id);
  if (!textarea) return;
  const txt = textarea.value.trim();
  if (!txt) { textarea.style.borderColor = 'var(--red)'; textarea.focus(); return; }
  textarea.style.borderColor = '';
  try {
    await api(`/api/tickets/${id}/comments`, 'POST', { text: txt });
    await refreshTickets();
    showToast('Respuesta enviada ✓');
  } catch { showToast('Error al enviar respuesta'); }
}

// ── Archivo adjunto ───────────────────────────────────────────────────────────
let selectedFile = null;

function fileSelected(input) {
  selectedFile = input.files[0] || null;
  mobileToken  = null;
  mobileFile   = null;
  updateFileLabel();
}

function fileDragOver(e) {
  e.preventDefault();
  document.getElementById('fileDropZone').classList.add('drag-over');
}

function fileDragLeave(e) {
  document.getElementById('fileDropZone').classList.remove('drag-over');
}

function fileDrop(e) {
  e.preventDefault();
  document.getElementById('fileDropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  selectedFile = file;
  mobileToken  = null;
  mobileFile   = null;
  updateFileLabel();
}

function updateFileLabel() {
  const label = document.getElementById('fileLabel');
  const zone  = document.getElementById('fileDropZone');
  if (selectedFile) {
    const kb = (selectedFile.size / 1024).toFixed(0);
    label.innerHTML = `<i class="ti ti-file-check" style="color:var(--green)"></i> ${escapeHtml(selectedFile.name)} (${kb} KB) <span class="file-remove" onclick="removeFile(event)">✕ Quitar</span>`;
    zone.classList.add('has-file');
  } else {
    label.innerHTML = 'Haz clic o arrastra un archivo aquí';
    zone.classList.remove('has-file');
  }
}

function removeFile(e) {
  e.stopPropagation();
  selectedFile = null;
  document.getElementById('f-file').value = '';
  updateFileLabel();
}


// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  document.getElementById('modalBackdrop').classList.add('open');
  selectedFile = null;
  mobileToken  = null;
  mobileFile   = null;
  document.getElementById('f-file').value = '';
  updateFileLabel();
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

async function createTicket() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').style.borderColor = 'var(--red)'; document.getElementById('f-title').focus(); return; }
  document.getElementById('f-title').style.borderColor = '';

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader"></i> Enviando…';

  try {
    const ticket = await api('/api/tickets', 'POST', {
      title,
      desc:      document.getElementById('f-desc').value || 'Sin descripción.',
      status:    'abierto',
      prioridad: document.getElementById('f-prio').value,
      categoria: document.getElementById('f-cat').value,
      asignado:  'Sin asignar',
      fecha:     new Date().toLocaleDateString('es-HN', { day:'numeric', month:'short', year:'numeric' })
    });

    // Subir archivo adjunto
    if (mobileToken && mobileFile) {
      await api(`/api/tickets/${ticket.id}/attachments/from-mobile`, 'POST', { token: mobileToken });
      mobileToken = null;
      mobileFile  = null;
    } else if (selectedFile) {
      const form = new FormData();
      form.append('file', selectedFile);
      await fetch(`/api/tickets/${ticket.id}/attachments`, { method: 'POST', headers: authHeaders(), body: form });
    }

    closeModal();
    await refreshTickets();
    showToast('Ticket enviado correctamente ✓');
  } catch {
    showToast('Error al crear el ticket');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send"></i> Enviar ticket';
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Mobile QR upload ──────────────────────────────────────────────────────────
let mobileToken    = null;
let mobileFile     = null;
let qrPollInterval = null;
let qrCountTimer   = null;
let qrExpiresAt    = 0;

function qrSetState(id) {
  ['qrStateLoading','qrStatePending','qrStateReady','qrStateExpired'].forEach(s => {
    document.getElementById(s).style.display = s === id ? '' : 'none';
  });
  document.getElementById('qrUseBtn').style.display = id === 'qrStateReady' ? '' : 'none';
}

async function openQRModal() {
  cancelQRPolling();
  mobileToken = null;
  mobileFile  = null;

  document.getElementById('qrBackdrop').classList.add('open');
  qrSetState('qrStateLoading');

  try {
    const { token } = await api('/api/mobile-upload/session', 'POST', {});
    mobileToken = token;
    qrExpiresAt = Date.now() + 5 * 60 * 1000;

    const img = document.getElementById('qrImg');
    img.src = `/api/mobile-upload/qr/${token}?t=${Date.now()}`;
    img.onload = () => qrSetState('qrStatePending');

    startQRPolling();
    startQRCountdown();
  } catch {
    closeQRModal();
    showToast('No se pudo generar el código QR');
  }
}

function closeQRModal() {
  document.getElementById('qrBackdrop').classList.remove('open');
  cancelQRPolling();
}

function confirmMobileFile() {
  closeQRModal();
  if (!mobileFile) return;

  const kb    = (mobileFile.size / 1024).toFixed(0);
  const zone  = document.getElementById('fileDropZone');
  const label = document.getElementById('fileLabel');
  const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(mobileFile.name);

  // Desactivar clic-para-abrir-picker mientras hay foto del celular
  zone._origOnclick = zone.onclick;
  zone.onclick = null;
  zone.style.cursor = 'default';
  zone.classList.add('has-file', 'has-mobile-preview');

  const icon = zone.querySelector('.ti-upload');
  if (icon) icon.style.display = 'none';

  label.innerHTML = `
    ${isImg ? `<img src="${escapeHtml(mobileFile.path)}" class="mobile-preview-thumb" onclick="event.stopPropagation()">` : ''}
    <span class="mobile-file-info">
      <i class="ti ti-device-mobile" style="color:var(--blue)"></i>
      <strong>${escapeHtml(mobileFile.name)}</strong>
      <span style="color:var(--gray);font-weight:400">${kb} KB · desde celular</span>
      <span class="file-remove" onclick="removeMobileFile(event)">✕ Quitar</span>
    </span>`;

  selectedFile = null;
  document.getElementById('f-file').value = '';
  showToast('Foto del celular lista para adjuntar ✓');
}

function removeMobileFile(e) {
  e.stopPropagation();
  mobileToken = null;
  mobileFile  = null;

  const zone = document.getElementById('fileDropZone');
  zone.onclick = zone._origOnclick || (() => document.getElementById('f-file').click());
  zone.style.cursor = '';
  zone.classList.remove('has-mobile-preview');

  const icon = zone.querySelector('.ti-upload');
  if (icon) icon.style.display = '';

  updateFileLabel();
}

function startQRPolling() {
  qrPollInterval = setInterval(async () => {
    if (!mobileToken) { cancelQRPolling(); return; }
    try {
      const data = await api(`/api/mobile-upload/status/${mobileToken}`);
      if (data.status === 'ready') {
        cancelQRPolling();
        mobileFile = data.file;
        document.getElementById('qrFileName').textContent = data.file.name;
        qrSetState('qrStateReady');
      }
    } catch (err) {
      if (err.message.includes('410') || err.message.includes('404')) {
        cancelQRPolling();
        qrSetState('qrStateExpired');
      }
    }
  }, 2000);
}

function startQRCountdown() {
  function tick() {
    const left = Math.max(0, Math.round((qrExpiresAt - Date.now()) / 1000));
    const m = Math.floor(left / 60).toString().padStart(1, '0');
    const s = (left % 60).toString().padStart(2, '0');
    const el = document.getElementById('qrCountdown');
    if (el) el.textContent = `${m}:${s}`;
    if (left <= 0) {
      clearInterval(qrCountTimer);
      cancelQRPolling();
      qrSetState('qrStateExpired');
    }
  }
  tick();
  qrCountTimer = setInterval(tick, 1000);
}

function cancelQRPolling() {
  clearInterval(qrPollInterval);
  clearInterval(qrCountTimer);
  qrPollInterval = null;
  qrCountTimer   = null;
}

// ── Autenticación ─────────────────────────────────────────────────────────────
function showIdentScreen() {
  document.getElementById('identScreen').style.display = 'flex';
  setTimeout(() => document.getElementById('loginUsername').focus(), 120);
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('identError');
  const btn      = document.getElementById('loginBtn');

  errEl.innerHTML = '';
  errEl.classList.remove('show');

  if (!username || !password) {
    errEl.textContent = 'Ingresa usuario y contraseña.';
    errEl.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader" aria-hidden="true"></i> Verificando…';

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, portal: 'empleado' })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Error al iniciar sesión.';
      errEl.classList.add('show');
      return;
    }

    myUser   = data.nombre;
    myUserId = data.id;
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ id: data.id, nombre: data.nombre, rol: data.rol, rol_nivel: data.rol_nivel }));
    sessionStorage.setItem(TOKEN_KEY, data.token);
    document.getElementById('nombreUsuario').textContent = myUser;
    document.getElementById('logoutBtn').style.display = '';
    document.getElementById('identScreen').style.display = 'none';
    refreshTickets();

  } catch {
    errEl.textContent = 'No se pudo conectar al servidor.';
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-login" aria-hidden="true"></i> Iniciar sesión';
  }
}

function changeIdentity() {
  myUser   = '';
  myUserId = null;
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('identError').innerHTML = '';
  document.getElementById('identError').classList.remove('show');
  document.getElementById('nombreUsuario').textContent = '—';
  document.getElementById('logoutBtn').style.display = 'none';
  showIdentScreen();
  showToast('Sesión cerrada');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeQRModal(); } });

if (myUser && sessionStorage.getItem(TOKEN_KEY)) {
  document.getElementById('nombreUsuario').textContent = myUser;
  document.getElementById('logoutBtn').style.display = '';
  document.getElementById('identScreen').style.display = 'none';
  refreshTickets();
} else {
  showIdentScreen();
}
setInterval(() => { if (myUser) refreshTickets(); }, 15000);
