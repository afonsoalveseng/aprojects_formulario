const SUPABASE_URL = 'https://owxfcijomwurgujhjutd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bCwJRONYF73x3dfPIrfJ_Q_tYUrdWe_';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allLeads = [];
let filteredLeads = [];
let monthlyChart = null;
let dailyChart = null;
const PAGE_SIZE = 50;
let currentPage = 1;

const APP_TIMEZONE = 'America/Sao_Paulo'; // UTC-3 (Brasil)

function getTzParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit'
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour
  };
}

function toMonthKey(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const p = getTzParts(dt);
  return `${p.year}-${p.month}`;
}

function toDayKey(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const p = getTzParts(dt);
  return `${p.year}-${p.month}-${p.day}`;
}

const now = new Date();
const currentMonth = toMonthKey(now) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

document.getElementById('monthFilter').value = currentMonth;
document.getElementById('monthFilterTop').value = currentMonth;

document.getElementById('monthFilterTop').addEventListener('change', function () {
  document.getElementById('monthFilter').value = this.value;
  renderDashboard();
  if (getCurrentView() === 'leads') applyFilters();
});

function getCurrentView() {
  return document.body.dataset.view || 'dashboard';
}

function showView(view) {
  document.body.dataset.view = view;

  const panels = document.querySelectorAll('[data-view-panel]');
  panels.forEach(panel => {
    const panelView = panel.getAttribute('data-view-panel');
    panel.hidden = panelView !== view;
  });

  const menuItems = document.querySelectorAll('[data-view]');
  menuItems.forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === view);
  });

  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title) title.textContent = view === 'leads' ? 'Leads' : 'Dashboard';
  if (subtitle) subtitle.textContent = view === 'leads'
    ? 'Lista e filtros de leads'
    : 'Visão geral dos leads recebidos pelo site';

  if (view === 'leads') {
    currentPage = 1;
    applyFilters();
  } else {
    renderDashboard();
  }
}

function setupViews() {
  const menuItems = document.querySelectorAll('[data-view]');
  menuItems.forEach(item => {
    item.addEventListener('click', () => showView(item.getAttribute('data-view')));
  });
  showView('dashboard');
}

// Sidebar responsiva (mobile)
(function setupMobileSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('backdrop');
  if (!toggle || !backdrop) return;

  function close() { document.body.classList.remove('is-mobile-open'); }
  function open() { document.body.classList.add('is-mobile-open'); }
  function isOpen() { return document.body.classList.contains('is-mobile-open'); }

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  backdrop.addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 860) close(); });
})();

async function loadData() {
  const tbody = document.getElementById('leadsTable');
  tbody.innerHTML = `<tr><td colspan="9" class="loading">Carregando dados...</td></tr>`;

  const { data, error } = await client
    .from('fomularios_site_digitalsat')
    .select(`
      id,
      nome,
      whatsapp,
      email,
      razao_social,
      cnpj,
      cidade,
      estado,
      perfil,
      marcas,
      created_at,
      status_lead,
      responsavel,
      data_primeiro_contato,
      data_ultimo_contato,
      observacoes,
      lead_qualificado
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="9" class="loading">Erro ao carregar dados: ${error.message}</td></tr>`;
    return;
  }

  allLeads = data || [];
  fillSelectFilters();
  applyFilters();
  renderDashboard();
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const status = document.getElementById('statusFilter').value;
  const responsavel = document.getElementById('responsavelFilter').value;
  const month = document.getElementById('monthFilter').value;
  document.getElementById('monthFilterTop').value = month;

  filteredLeads = allLeads.filter(lead => {
    const searchText = [
      lead.nome,
      lead.whatsapp,
      lead.email,
      lead.razao_social,
      lead.cnpj
    ].join(' ').toLowerCase();

    const leadMonth = toMonthKey(lead.created_at);

    return (
      (!search || searchText.includes(search)) &&
      (!status || lead.status_lead === status) &&
      (!responsavel || lead.responsavel === responsavel) &&
      (!month || leadMonth === month)
    );
  });

  currentPage = 1;
  renderTable();
}

function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('responsavelFilter').value = '';
  document.getElementById('monthFilter').value = currentMonth;
  document.getElementById('monthFilterTop').value = currentMonth;
  currentPage = 1;
  applyFilters();
}

function fillSelectFilters() {
  const statuses = [...new Set(allLeads.map(l => l.status_lead).filter(Boolean))];
  const responsaveis = [...new Set(allLeads.map(l => l.responsavel).filter(Boolean))];

  const statusSelect = document.getElementById('statusFilter');
  const responsavelSelect = document.getElementById('responsavelFilter');

  statusSelect.innerHTML = '<option value="">Todos os status</option>';
  responsavelSelect.innerHTML = '<option value="">Todos responsáveis</option>';

  statuses.forEach(item => {
    statusSelect.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
  });

  responsaveis.forEach(item => {
    responsavelSelect.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
  });
}

function renderCards() {
  const selectedMonth = document.getElementById('monthFilter').value;

  const monthLeads = allLeads.filter(l => {
    return toMonthKey(l.created_at) === selectedMonth;
  });
  const qualified = allLeads.filter(l => l.lead_qualificado === true);
  const pending = allLeads.filter(l => !l.status_lead || ['novo', 'pendente', 'agendar contato'].includes(String(l.status_lead).toLowerCase()));
  const contacted = allLeads.filter(l => String(l.status_lead || '').toLowerCase().includes('contat'));

  document.getElementById('totalLeads').textContent = allLeads.length;
  document.getElementById('monthLeads').textContent = monthLeads.length;
  document.getElementById('qualifiedLeads').textContent = qualified.length;
  document.getElementById('pendingLeads').textContent = pending.length;
  document.getElementById('contactedLeads').textContent = contacted.length;
}

function renderDashboard() {
  renderCards();
  renderCharts();
}

function renderTable() {
  const tbody = document.getElementById('leadsTable');
  const total = filteredLeads.length;
  document.getElementById('tableCount').textContent = `${total} registros`;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);

  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const indicator = document.getElementById('pageIndicator');

  if (indicator) indicator.textContent = `Página ${currentPage} de ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  if (!filteredLeads.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading">Nenhum lead encontrado.</td></tr>`;
    return;
  }

  const pageLeads = filteredLeads.slice(startIdx, endIdx);

  tbody.innerHTML = pageLeads.map(lead => {
    const whatsappClean = String(lead.whatsapp || '').replace(/\D/g, '');
    const whatsappLink = whatsappClean ? `https://wa.me/55${whatsappClean}` : '#';

    return `
      <tr>
        <td>${escapeHtml(lead.nome)}</td>
        <td><a href="${whatsappLink}" target="_blank">${escapeHtml(lead.whatsapp)}</a></td>
        <td>${escapeHtml(lead.email)}</td>
        <td>${escapeHtml(lead.razao_social)}</td>
        <td>${escapeHtml(lead.cnpj)}</td>
        <td>${escapeHtml(lead.cidade)} / ${escapeHtml(lead.estado)}</td>
        <td>${escapeHtml(lead.perfil)}</td>
        <td>${formatMarcas(lead.marcas)}</td>
        <td>${formatDate(lead.created_at)}</td>
      </tr>
    `;
  }).join('');
}

function setupPagination() {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentPage -= 1; renderTable(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentPage += 1; renderTable(); });
}

function renderCharts() {
  renderMonthlyChart();
  renderDailyChart();
}

function renderMonthlyChart() {
  const grouped = {};

  allLeads.forEach(lead => {
    if (!lead.created_at) return;
    const month = toMonthKey(lead.created_at);
    if (!month) return;
    grouped[month] = (grouped[month] || 0) + 1;
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(label => grouped[label]);

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Leads',
        data: values,
        backgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

function renderDailyChart() {
  const selectedMonth = document.getElementById('monthFilterTop').value || document.getElementById('monthFilter').value;
  if (!selectedMonth) return;

  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const grouped = {};

  for (let day = 1; day <= daysInMonth; day++) {
    grouped[String(day).padStart(2, '0')] = 0;
  }

  allLeads.forEach(lead => {
    if (!lead.created_at) return;
    const keyMonth = toMonthKey(lead.created_at);
    if (keyMonth !== selectedMonth) return;
    const dt = new Date(lead.created_at);
    if (Number.isNaN(dt.getTime())) return;
    const p = getTzParts(dt);
    const day = p.day;
    grouped[day] = (grouped[day] || 0) + 1;
  });

  const title = document.getElementById('dailyChartTitle');
  if (title) title.textContent = `Leads por dia (mês) - ${selectedMonth}`;

  if (dailyChart) dailyChart.destroy();

  dailyChart = new Chart(document.getElementById('dailyChart'), {
    type: 'line',
    data: {
      labels: Object.keys(grouped),
      datasets: [{
        label: 'Leads',
        data: Object.values(grouped),
        borderColor: '#2563eb',
        backgroundColor: '#2563eb',
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

async function markAsContacted(id) {
  const lead = allLeads.find(item => item.id === id);
  if (!lead) return;

  const nowIso = new Date().toISOString();

  const payload = {
    status_lead: 'Contatado',
    data_ultimo_contato: nowIso
  };

  if (!lead.data_primeiro_contato) {
    payload.data_primeiro_contato = nowIso;
  }

  const { error } = await client
    .from('fomularios_site_digitalsat')
    .update(payload)
    .eq('id', id);

  if (error) {
    alert('Erro ao atualizar lead: ' + error.message);
    return;
  }

  await loadData();
}

async function editLead(id) {
  const lead = allLeads.find(item => item.id === id);
  if (!lead) return;

  const status = prompt('Status do lead:', lead.status_lead || 'Novo');
  if (status === null) return;

  const responsavel = prompt('Responsável:', lead.responsavel || '');
  if (responsavel === null) return;

  const observacoes = prompt('Observações:', lead.observacoes || '');
  if (observacoes === null) return;

  const qualificadoTexto = prompt('Lead qualificado? Digite sim ou não:', lead.lead_qualificado ? 'sim' : 'não');
  if (qualificadoTexto === null) return;

  const payload = {
    status_lead: status,
    responsavel,
    observacoes,
    lead_qualificado: qualificadoTexto.toLowerCase().startsWith('s'),
    data_ultimo_contato: new Date().toISOString()
  };

  const { error } = await client
    .from('fomularios_site_digitalsat')
    .update(payload)
    .eq('id', id);

  if (error) {
    alert('Erro ao editar lead: ' + error.message);
    return;
  }

  await loadData();
}

function getStatusClass(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('contat')) return 'contatado';
  if (value.includes('perd')) return 'perdido';
  if (value.includes('pend') || value.includes('agendar')) return 'pendente';
  return '';
}

function formatDate(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(dt);
}

function formatMarcas(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(escapeHtml).join(', ');
  return escapeHtml(String(value));
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadData();
setupViews();
setupPagination();
