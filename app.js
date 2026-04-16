const CONFIG = {
  gasUrl: 'PUT_YOUR_GAS_WEBAPP_URL_HERE',
  nodeUrl: 'PUT_YOUR_NODE_RUNTIME_URL_HERE',
  companionDownloadUrl: 'PUT_YOUR_COMPANION_DOWNLOAD_URL_HERE'
};

const state = {
  sessionToken: localStorage.getItem('rustyid_session') || '',
  user: null,
  servers: []
};

const qs = new URLSearchParams(location.search);
const sessionFromQuery = qs.get('session');
if (sessionFromQuery) {
  state.sessionToken = sessionFromQuery;
  localStorage.setItem('rustyid_session', sessionFromQuery);
  const clean = new URL(location.href);
  clean.searchParams.delete('session');
  history.replaceState({}, '', clean.toString());
}

async function jsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = '__cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set('callback', cb);

    const done = () => {
      delete window[cb];
      script.remove();
    };

    window[cb] = (data) => {
      done();
      resolve(data);
    };

    script.onerror = () => {
      done();
      reject(new Error('Request failed.'));
    };

    script.src = u.toString();
    document.body.appendChild(script);
  });
}

async function gas(action, params = {}) {
  const data = await jsonp(CONFIG.gasUrl, { action, session: state.sessionToken, ...params });
  if (!data || data.ok === false) throw new Error((data && data.error) || 'Unknown GAS error');
  return data;
}

async function refreshDashboard() {
  const accountBox = document.getElementById('accountBox');
  const serversList = document.getElementById('serversList');
  const signInBtn = document.getElementById('signInBtn');
  const signOutBtn = document.getElementById('signOutBtn');

  if (!state.sessionToken) {
    state.user = null;
    state.servers = [];
    accountBox.textContent = 'Not signed in.';
    serversList.innerHTML = '<div class="muted">No servers yet.</div>';
    signInBtn.hidden = false;
    signOutBtn.hidden = true;
    return;
  }

  try {
    const me = await gas('getUser');
    const servers = await gas('getServers');
    state.user = me.user;
    state.servers = servers.servers || [];

    accountBox.innerHTML = `
      <div><strong>${escapeHtml(state.user.displayName || 'Steam User')}</strong></div>
      <div class="muted">SteamID: ${escapeHtml(state.user.steamId || '')}</div>
    `;

    if (!state.servers.length) {
      serversList.innerHTML = '<div class="muted">No paired servers yet.</div>';
    } else {
      serversList.innerHTML = state.servers.map(s => `
        <div class="server">
          <div>
            <div><strong>${escapeHtml(s.serverName || s.serverId)}</strong></div>
            <small>${escapeHtml(s.host || '')}:${escapeHtml(String(s.appPort || ''))}</small>
          </div>
          <div>
            <label>
              <input type="checkbox" ${String(s.enabled).toLowerCase() === 'true' ? 'checked' : ''}
                onchange="toggleServer('${escapeHtml(s.pairingId)}', this.checked)">
              Enabled
            </label>
          </div>
        </div>
      `).join('');
    }

    signInBtn.hidden = true;
    signOutBtn.hidden = false;
  } catch (err) {
    accountBox.textContent = err.message;
  }
}

async function toggleServer(pairingId, enabled) {
  await gas('toggleServer', { pairingId, enabled: enabled ? 'true' : 'false' });
  await refreshDashboard();
}

function startSteamSignIn() {
  location.href = `${CONFIG.gasUrl}?action=authStart&returnTo=${encodeURIComponent(location.origin + location.pathname)}`;
}

function signOut() {
  localStorage.removeItem('rustyid_session');
  state.sessionToken = '';
  refreshDashboard();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

document.getElementById('signInBtn').addEventListener('click', startSteamSignIn);
document.getElementById('signOutBtn').addEventListener('click', signOut);
document.getElementById('refreshBtn').addEventListener('click', refreshDashboard);
document.getElementById('downloadCompanionBtn').addEventListener('click', () => {
  if (CONFIG.companionDownloadUrl.startsWith('PUT_')) return alert('Set companion download URL first.');
  location.href = CONFIG.companionDownloadUrl;
});

refreshDashboard();
