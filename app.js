const SUPABASE_URL = 'COLE_AQUI_SUA_PROJECT_URL';
const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_ANON_PUBLIC_KEY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allLeads = [];
let filteredLeads = [];
let monthlyChart = null;
let dailyChart = null;

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

document.getElementById('monthFilter').value = currentMonth;
document.getElementById('monthFilterTop').value = currentMonth;

document.getElementById('monthFilterTop').addEventListener('change', function () {
  document.getElementById('monthFilter').value = this.value;
  applyFilters();
});

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
  tbody.innerHTML = `<tr><td colspan="13" class="loading">Carregando dados...</td></tr>`;

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
      data_cadastro,
      status_lead,
      responsavel,
      data_primeiro_contato,
      data_ultimo_contato,
      observacoes,
      lead_qualificado
    `)
    .order('data_cadastro', { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="13" class="loading">Erro ao carregar dados: ${error.message}</td></tr>`;
    return;
  }

  allLeads = data || [];
  fillSelectFilters();
  applyFilters();
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

    const leadMonth = lead.data_cadastro ? lead.data_cadastro.slice(0, 7) : '';

    return (
      (!search || searchText.includes(search)) &&
      (!status || lead.status_lead === status) &&
      (!responsavel || lead.responsavel === responsavel) &&
      (!month || leadMonth === month)
    );
  });

  renderCards();
  renderTable();
  renderCharts();
}

function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('responsavelFilter').value = '';
  document.getElementById('monthFilter').value = currentMonth;
  document.getElementById('monthFilterTop').value = currentMonth;
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

  const monthLeads = allLeads.filter(l => l.data_cadastro && l.data_cadastro.slice(0, 7) === selectedMonth);
  const qualified = allLeads.filter(l => l.lead_qualificado === true);
  const pending = allLeads.filter(l => !l.status_lead || ['novo', 'pendente', 'agendar contato'].includes(String(l.status_lead).toLowerCase()));
  const contacted = allLeads.filter(l => String(l.status_lead || '').toLowerCase().includes('contat'));

  document.getElementById('totalLeads').textContent = allLeads.length;
  document.getElementById('monthLeads').textContent = monthLeads.length;
  document.getElementById('qualifiedLeads').textContent = qualified.length;
  document.getElementById('pendingLeads').textContent = pending.length;
  document.getElementById('contactedLeads').textContent = contacted.length;
}

function renderTable() {
  const tbody = document.getElementById('leadsTable');
  document.getElementById('tableCount').textContent = `${filteredLeads.length} registros`;

  if (!filteredLeads.length) {
    tbody.innerHTML = `<tr><td colspan="13" class="loading">Nenhum lead encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredLeads.map(lead => {
    const statusClass = getStatusClass(lead.status_lead);
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
        <td>${formatDate(lead.data_cadastro)}</td>
        <td><span class="badge ${statusClass}">${escapeHtml(lead.status_lead || 'Novo')}</span></td>
        <td>${escapeHtml(lead.responsavel)}</td>
        <td>${lead.lead_qualificado ? 'Sim' : 'Não'}</td>
        <td>
          <div class="actions">
            <button class="small-btn success" onclick="markAsContacted('${lead.id}')">Contatado</button>
            <button class="small-btn" onclick="editLead('${lead.id}')">Editar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCharts() {
  renderMonthlyChart();
  renderDailyChart();
}

function renderMonthlyChart() {
  const grouped = {};

  allLeads.forEach(lead => {
    if (!lead.data_cadastro) return;
    const month = lead.data_cadastro.slice(0, 7);
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
  const selectedMonth = document.getElementById('monthFilter').value;
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const grouped = {};

  for (let day = 1; day <= daysInMonth; day++) {
    grouped[String(day).padStart(2, '0')] = 0;
  }

  allLeads.forEach(lead => {
    if (!lead.data_cadastro) return;
    if (lead.data_cadastro.slice(0, 7) === selectedMonth) {
      const day = lead.data_cadastro.slice(8, 10);
      grouped[day] = (grouped[day] || 0) + 1;
    }
  });

  document.getElementById('dailyChartTitle').textContent = `Leads por dia - ${selectedMonth}`;

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
  return new Date(value).toLocaleString('pt-BR');
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
