/**
 * SSVP Web App - Gestão de Conferência & Visitas (Versão 0.1.4)
 * Cadeias de Metas, Acompanhamento, Validações por Voz e Persistência Local.
 */

// Estado Global da Aplicação
const state = {
  currentView: 'flow',       // 'flow' (fluxo de visita) | 'pessoas' (painel de pessoas)
  pessoasSubView: 'list',    // 'list' | 'create' | 'edit' | 'eleger' (V0.3.5)
  selectedPessoaId: null,    // ID da pessoa selecionada para edição
  pessoasFilterRole: 'all',  // Filtro por papel na listagem
  pessoasSearchQuery: '',    // Termo de busca na listagem

  currentStep: 0,            // Passo do fluxo de visitas (0: Boas-vindas, 1: Vicentinos, 2: Família, 3: Relato/Metas)
  selectedVicentinos: [1],   // IDs dos vicentinos selecionados para a visita
  selectedFamily: null,      // ID da família assistida
  visitDetails: {
    date: new Date().toISOString().split('T')[0],
    relato: '',
    meta: '',
    metaDate: ''
  },
  goalValidations: {},       // Guardar as respostas de validação das metas (metaId -> { status, justificativa })
  webAppUrl: '',             // URL da API do Google Apps Script
  syncQueue: {               // Fila de operações locais pendentes de sincronização
    pessoas: [],
    historicoPapeis: [],
    visitas: [],
    metas: [],
    escalas: []              // (V0.3.5)
  },
  isOnline: navigator.onLine, // Detecção de status de rede
  currentUserId: null,       // (V0.3.5) ID do vicentino logado na sessão ativa
  currentUser: null,         // (V0.3.5) Objeto do vicentino logado na sessão ativa
  escalasSubView: 'list',    // 'list' | 'create' (V0.3.8)
  escalasTab: 'minhas',      // 'minhas' | 'todas' (V0.3.8)
  escalasOcultarRealizadas: false, // Ocultar visitas já realizadas (V0.3.8)
  activeEscalaId: null,      // ID da escala sendo executada (V0.3.8)
  showWelcomeInstructions: true // Exibir/ocultar instruções de uso (V0.3.8)
};

// Banco de Dados em Memória
const data = {
  pessoas: [],
  historicoPapeis: [],
  visitas: [],
  metas: [],
  escalas: []                // (V0.3.5)
};

// Chaves do LocalStorage
const KEYS = {
  PESSOAS: 'ssvp_pessoas',
  HISTORICO: 'ssvp_historico_papeis',
  VISITAS: 'ssvp_visitas',
  METAS: 'ssvp_metas',
  WEB_APP_URL: 'ssvp_web_app_url',
  SYNC_QUEUE: 'ssvp_sync_queue',
  ESCALAS: 'ssvp_escalas',
  SESSION_USER: 'ssvp_session_user', // (V0.3.7)
  SHOW_WELCOME_INSTRUCTIONS: 'ssvp_show_welcome_instructions' // (V0.3.8)
};

// Elementos do DOM
const stepLabel = document.getElementById('step-label');
const stepProgress = document.getElementById('step-progress');
const flowTitle = document.getElementById('flow-content-title');
const flowDesc = document.getElementById('flow-content-desc');
const formContainer = document.getElementById('dynamic-form-container');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnEscalas = document.getElementById('btn-escalas');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  loadData();
  checkAuthAndToggleView();
  renderApp();
  setupEventListeners();
  updateNetworkStatus();
  updateSyncStatusUI();
  // Autossincronização ao carregar se online e configurado
  if (navigator.onLine && state.webAppUrl && state.currentUser) {
    runDataSync(true); // silent sync on start
  }
});

// Carrega a URL do Apps Script do config.json
async function loadConfig() {
  try {
    const response = await fetch('config.json');
    if (response.ok) {
      const config = await response.json();
      if (config.webAppUrl && config.webAppUrl.trim() !== '') {
        state.webAppUrl = config.webAppUrl.trim();
        localStorage.setItem(KEYS.WEB_APP_URL, state.webAppUrl);
      }
    }
  } catch (error) {
    console.warn('config.json não encontrado ou inválido. Usando cache local.');
  }
}


// Helper para verificar se a justificativa de uma meta não cumprida pode ser editada (limite de 1 dia)
function isJustificationEditable(meta) {
  if (!meta || meta.status !== 'nao_cumprida') return false;
  if (!meta.dataResolucao) return false;
  const diffMs = Date.now() - new Date(meta.dataResolucao).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs < oneDayMs;
}

// Helper para formatar cargos
function formatCargo(cargo) {
  switch (cargo) {
    case 'presidente': return 'Presidente';
    case 'vice_presidente': return 'Vice-Presidente';
    case 'secretario': return 'Secretário';
    case 'tesoureiro': return 'Tesoureiro';
    default: return 'Membro';
  }
}

// Helper para formatar cargos e gênero (V0.3.5 - Confrades e Consócias)
function formatCargoAndGenero(cargo, sexo) {
  if (cargo === 'presidente') return 'Presidente';
  if (cargo === 'vice_presidente') return 'Vice-Presidente';
  if (cargo === 'secretario') return sexo === 'F' ? 'Secretária' : 'Secretário';
  if (cargo === 'tesoureiro') return sexo === 'F' ? 'Tesoureira' : 'Tesoureiro';
  return sexo === 'F' ? 'Consócia' : 'Confrade';
}

// Carregar dados ou gerar padrões iniciais
function loadData() {
  // Migração para V0.3.7 (Adicionando login via e-mail e senha)
  if (!localStorage.getItem('ssvp_v037_login_migrated')) {
    localStorage.removeItem(KEYS.PESSOAS);
    localStorage.removeItem(KEYS.HISTORICO);
    localStorage.removeItem(KEYS.VISITAS);
    localStorage.removeItem(KEYS.METAS);
    localStorage.removeItem(KEYS.ESCALAS);
    localStorage.removeItem(KEYS.SESSION_USER);
    localStorage.removeItem('ssvp_v036_confrades_queued');
    localStorage.setItem('ssvp_v037_login_migrated', 'true');
  }

  const localPessoas = localStorage.getItem(KEYS.PESSOAS);
  const localHistorico = localStorage.getItem(KEYS.HISTORICO);
  const localVisitas = localStorage.getItem(KEYS.VISITAS);
  const localMetas = localStorage.getItem(KEYS.METAS);
  const localEscalas = localStorage.getItem(KEYS.ESCALAS);

  const localUrl = localStorage.getItem(KEYS.WEB_APP_URL);
  if (localUrl) {
    state.webAppUrl = localUrl;
  }

  // Auto-configurar URL se estiver executando como Web App no Google Apps Script
  if (window.APPS_SCRIPT_WEB_APP_URL &&
    !window.APPS_SCRIPT_WEB_APP_URL.includes('<?=') &&
    window.APPS_SCRIPT_WEB_APP_URL.trim() !== '') {
    state.webAppUrl = window.APPS_SCRIPT_WEB_APP_URL.trim();
    localStorage.setItem(KEYS.WEB_APP_URL, state.webAppUrl);
  }

  const localQueue = localStorage.getItem(KEYS.SYNC_QUEUE);
  if (localQueue) {
    state.syncQueue = JSON.parse(localQueue);
    if (!state.syncQueue.escalas) {
      state.syncQueue.escalas = [];
    }
  }

  if (localPessoas) {
    data.pessoas = JSON.parse(localPessoas);
  } else {
    data.pessoas = [
      { id: 1, nome: 'José', sobrenome: 'Silva', endereco: 'Rua Augusta, 500', bairro: 'Consolação', cep: '01305-000', telefone: '(11) 98888-1111', papelAtual: 'vicentino', dataCadastro: '2025-01-10', cargo: 'presidente', sexo: 'M', email: 'jose@ssvp.org', senha: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' },
      { id: 2, nome: 'Maria', sobrenome: 'Souza', endereco: 'Av. Paulista, 1000', bairro: 'Bela Vista', cep: '01310-100', telefone: '(11) 98888-2222', papelAtual: 'vicentino', dataCadastro: '2025-02-15', cargo: 'vice_presidente', sexo: 'F', email: 'maria@ssvp.org', senha: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' },
      { id: 3, nome: 'Pedro', sobrenome: 'Lima', endereco: 'Av. Brigadeiro, 2000', bairro: 'Bela Vista', cep: '01310-200', telefone: '(11) 98888-3333', papelAtual: 'vicentino', dataCadastro: '2025-03-20', cargo: 'secretario', sexo: 'M', email: 'pedro@ssvp.org', senha: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' },
      { id: 4, nome: 'Marta', sobrenome: 'Oliveira', endereco: 'Rua Pamplona, 1200', bairro: 'Jardim Paulista', cep: '01405-100', telefone: '(11) 98888-4444', papelAtual: 'vicentino', dataCadastro: '2025-04-10', cargo: 'tesoureiro', sexo: 'F', email: 'marta@ssvp.org', senha: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' },
      { id: 5, nome: 'João', sobrenome: 'Santos', endereco: 'Rua das Laranjeiras, 100', bairro: 'Bela Vista', cep: '01311-200', telefone: '(11) 98888-5555', papelAtual: 'assistido', dataCadastro: '2025-04-01', cargo: null, sexo: 'M', email: '', senha: '' },
      { id: 6, nome: 'Raquel', sobrenome: 'Ferreira', endereco: 'Rua Bela Cintra, 700', bairro: 'Consolação', cep: '01415-000', telefone: '(11) 98888-6666', papelAtual: 'assistido', dataCadastro: '2025-04-20', cargo: null, sexo: 'F', email: '', senha: '' },
      { id: 7, nome: 'André', sobrenome: 'Augusto', endereco: 'Rua das Flores, 123', bairro: 'Centro', cep: '01001-000', telefone: '(11) 98888-7777', papelAtual: 'assistido', dataCadastro: '2025-04-25', cargo: null, sexo: 'M', email: '', senha: '' },
      { id: 8, nome: 'Débora', sobrenome: 'Oliveira', endereco: 'Av. Rebouças, 1500', bairro: 'Jardins', cep: '05401-150', telefone: '(11) 98888-8888', papelAtual: 'assistido', dataCadastro: '2025-05-01', cargo: null, sexo: 'F', email: '', senha: '' }
    ];
    saveData();
  }

  if (localHistorico) {
    data.historicoPapeis = JSON.parse(localHistorico);
  } else {
    data.historicoPapeis = data.pessoas.map((p, idx) => ({
      id: idx + 1,
      pessoaId: p.id,
      papel: p.papelAtual,
      dataInicio: p.dataCadastro,
      dataFim: null,
      nota: p.cargo ? `Cadastro inicial como ${formatCargoAndGenero(p.cargo, p.sexo)}.` : 'Cadastro inicial de referência.'
    }));
    saveData();
  }

  if (localVisitas) {
    data.visitas = JSON.parse(localVisitas);
  } else {
    data.visitas = [];
    saveData();
  }

  if (localMetas) {
    data.metas = JSON.parse(localMetas);
  } else {
    data.metas = [
      { id: 10, familiaId: 5, meta: 'Marcar consulta com Clínico Geral', prazo: '2025-02-10', status: 'cumprida', metaDependenciaId: null, justificativa: 'Consulta realizada no dia 05/02 com sucesso.', dataResolucao: '2025-02-05T10:00:00.000Z' },
      { id: 11, familiaId: 5, meta: 'Fazer exames de sangue solicitados', prazo: '2025-03-01', status: 'nao_cumprida', metaDependenciaId: 10, justificativa: 'Houve greve de funcionários no posto de coleta municipal.', dataResolucao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 12, familiaId: 5, meta: 'Retornar ao Clínico com os resultados dos exames', prazo: '2025-03-20', status: 'bloqueada', metaDependenciaId: 11, justificativa: '' },
      { id: 13, familiaId: 5, meta: 'Comprar remédios prescritos', prazo: '2025-04-10', status: 'bloqueada', metaDependenciaId: 12, justificativa: '' },
      { id: 14, familiaId: 5, meta: 'Fazer matrícula no curso profissionalizante de Culinária', prazo: '2026-07-15', status: 'pendente', metaDependenciaId: null, justificativa: '' },
      { id: 15, familiaId: 5, meta: 'Pesquisar preços de cesta básica', prazo: new Date().toISOString().split('T')[0], status: 'nao_cumprida', metaDependenciaId: null, justificativa: 'Não sobrou tempo livre no final de semana.', dataResolucao: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
    ];
    saveData();
  }

  if (localEscalas) {
    data.escalas = JSON.parse(localEscalas);
  } else {
    data.escalas = [
      { id: 1, familiaId: 5, vicentinos: [1, 2], dataEscala: '2026-07-10', status: 'pendente', visitaId: null },
      { id: 2, familiaId: 6, vicentinos: [1, 3], dataEscala: '2026-06-15', status: 'pendente', visitaId: null },
      { id: 3, familiaId: 7, vicentinos: [2, 4], dataEscala: '2026-06-10', status: 'realizada', visitaId: 100 }
    ];
    saveData();
  }

  // Carregar usuário ativo da sessão (V0.3.7)
  const localSessionUser = localStorage.getItem(KEYS.SESSION_USER);
  if (localSessionUser) {
    state.currentUser = JSON.parse(localSessionUser);
    state.currentUserId = state.currentUser.id;
  } else {
    state.currentUser = null;
    state.currentUserId = null;
  }

  // Carregar preferência de exibição de instruções (V0.3.8)
  const localShowWelcome = localStorage.getItem(KEYS.SHOW_WELCOME_INSTRUCTIONS);
  if (localShowWelcome !== null) {
    state.showWelcomeInstructions = localShowWelcome === 'true';
  } else {
    state.showWelcomeInstructions = true;
  }

  // Migração e fila única de sync para a V0.3.6 (mantido para compatibilidade de fila)
  if (!localStorage.getItem('ssvp_v036_confrades_queued')) {
    state.syncQueue = {
      pessoas: [],
      historicoPapeis: [],
      visitas: [],
      metas: [],
      escalas: []
    };
    data.pessoas.forEach(p => {
      state.syncQueue.pessoas.push(p);
    });
    data.historicoPapeis.forEach(h => {
      state.syncQueue.historicoPapeis.push(h);
    });
    data.metas.forEach(m => {
      state.syncQueue.metas.push(m);
    });
    localStorage.setItem('ssvp_v036_confrades_queued', 'true');
    saveData();
  }
}

// Salvar no LocalStorage
function saveData() {
  localStorage.setItem(KEYS.PESSOAS, JSON.stringify(data.pessoas));
  localStorage.setItem(KEYS.HISTORICO, JSON.stringify(data.historicoPapeis));
  localStorage.setItem(KEYS.VISITAS, JSON.stringify(data.visitas));
  localStorage.setItem(KEYS.METAS, JSON.stringify(data.metas));
  localStorage.setItem(KEYS.ESCALAS, JSON.stringify(data.escalas));
  localStorage.setItem(KEYS.WEB_APP_URL, state.webAppUrl);
  localStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(state.syncQueue));
  localStorage.setItem(KEYS.SHOW_WELCOME_INSTRUCTIONS, state.showWelcomeInstructions ? 'true' : 'false');
  if (state.currentUser) {
    localStorage.setItem(KEYS.SESSION_USER, JSON.stringify(state.currentUser));
  } else {
    localStorage.removeItem(KEYS.SESSION_USER);
  }
}

// Verifica estado de autenticação e alterna exibição de telas (V0.3.7)
function checkAuthAndToggleView() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');
  const loginUrlContainer = document.getElementById('login-url-container');
  const loginApiUrlInput = document.getElementById('login-api-url');

  if (!state.currentUser) {
    appContainer.style.display = 'none';
    loginScreen.style.display = 'flex';

    // Se a URL já estiver configurada (por Apps Script auto, por config.json ou por localStorage), esconde o campo
    const isAuto = window.APPS_SCRIPT_WEB_APP_URL &&
      !window.APPS_SCRIPT_WEB_APP_URL.includes('<?=') &&
      window.APPS_SCRIPT_WEB_APP_URL.trim() !== '';
    
    if (isAuto || (state.webAppUrl && state.webAppUrl.trim() !== '')) {
      loginUrlContainer.style.display = 'none';
      if (isAuto) {
        state.webAppUrl = window.APPS_SCRIPT_WEB_APP_URL.trim();
      }
    } else {
      loginUrlContainer.style.display = 'flex';
      loginApiUrlInput.value = '';
    }
  } else {
    appContainer.style.display = 'block';
    loginScreen.style.display = 'none';
    updateHeaderUserProfile();
  }
}

// Atualiza o display de perfil de usuário logado no cabeçalho (V0.3.7)
function updateHeaderUserProfile() {
  const headerUserInfo = document.getElementById('header-user-info');
  if (headerUserInfo && state.currentUser) {
    const labelText = formatCargoAndGenero(state.currentUser.cargo, state.currentUser.sexo);
    headerUserInfo.textContent = `👤 Trabalhando como: ${state.currentUser.nome} ${state.currentUser.sobrenome || ''} (${labelText})`;
  }
}

// Executa Logout e limpa sessão local (V0.3.7)
function handleLogout() {
  state.currentUser = null;
  state.currentUserId = null;
  localStorage.removeItem(KEYS.SESSION_USER);
  checkAuthAndToggleView();
}

// Criptografa a senha do usuário em hash SHA-256 hexadecimal (V0.3.7)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Trata o envio do formulário de login (V0.3.7)
async function handleLoginSubmit(e) {
  e.preventDefault();

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const loginApiUrlInput = document.getElementById('login-api-url');

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  loginErrorMsg.style.display = 'none';
  loginErrorMsg.textContent = '';

  // Define a URL da API se não auto-configurada
  const isAuto = window.APPS_SCRIPT_WEB_APP_URL &&
    !window.APPS_SCRIPT_WEB_APP_URL.includes('<?=') &&
    window.APPS_SCRIPT_WEB_APP_URL.trim() !== '';
  if (!isAuto && (!state.webAppUrl || state.webAppUrl.trim() === '')) {
    const enteredUrl = loginApiUrlInput.value.trim();
    if (!enteredUrl) {
      loginErrorMsg.textContent = 'Por favor, informe a URL do Apps Script da planilha.';
      loginErrorMsg.style.display = 'block';
      return;
    }
    state.webAppUrl = enteredUrl;
    localStorage.setItem(KEYS.WEB_APP_URL, state.webAppUrl);
  }

  if (!email || !password) {
    loginErrorMsg.textContent = 'Por favor, preencha todos os campos.';
    loginErrorMsg.style.display = 'block';
    return;
  }

  const passwordHash = await hashPassword(password);

  if (navigator.onLine) {
    try {
      const btnSubmit = document.getElementById('btn-login-submit');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Verificando...';

      const response = await fetch(state.webAppUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'login', email, passwordHash })
      });

      const result = await response.json();
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🔑 Entrar no Sistema';

      if (result.success && result.user) {
        state.currentUser = result.user;
        state.currentUserId = result.user.id;

        // Salva perfil e e-mail no cache
        localStorage.setItem(KEYS.SESSION_USER, JSON.stringify(result.user));

        passwordInput.value = '';
        checkAuthAndToggleView();
        renderApp();
        runDataSync(true);
      } else {
        loginErrorMsg.textContent = result.error || 'Erro ao realizar login.';
        loginErrorMsg.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      const btnSubmit = document.getElementById('btn-login-submit');
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🔑 Entrar no Sistema';
      loginErrorMsg.textContent = 'Erro de rede. Verifique a URL do Apps Script ou sua conexão.';
      loginErrorMsg.style.display = 'block';
    }
  } else {
    // Validação offline
    const cachedPessoas = data.pessoas;
    const normalizedEmail = email.toLowerCase();
    const user = cachedPessoas.find(p => p.email && p.email.toLowerCase() === normalizedEmail && p.senha === passwordHash);

    if (user) {
      state.currentUser = user;
      state.currentUserId = user.id;
      localStorage.setItem(KEYS.SESSION_USER, JSON.stringify(user));

      passwordInput.value = '';
      checkAuthAndToggleView();
      renderApp();
    } else {
      loginErrorMsg.textContent = 'Credenciais incorretas ou não disponíveis offline. Conecte-se à internet para o primeiro acesso.';
      loginErrorMsg.style.display = 'block';
    }
  }
}

// Alternar visualização principal
function switchView(view) {
  state.currentView = view;
  state.activeEscalaId = null; // Limpa o contexto da escala ao alternar visualização principal (V0.3.8)
  
  if (view === 'pessoas') {
    state.pessoasSubView = 'list';
  } else if (view === 'flow') {
    state.currentStep = 0;
  } else if (view === 'escalas') {
    state.escalasSubView = 'list';
  }

  // Atualizar botões de navegação no menu visual
  const navBtns = document.querySelectorAll('#main-nav-tabs .tab-btn');
  navBtns.forEach(btn => {
    if (btn.getAttribute('data-view') === view) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderApp();
}

// Atualizar o estado do botão de sincronizar
function updateSyncBtnState() {
  const syncBtn = document.getElementById('btn-sync-now');
  if (syncBtn) {
    const isVicentino = state.currentUser && state.currentUser.papelAtual === 'vicentino';
    if (!isVicentino) {
      syncBtn.disabled = true;
      syncBtn.style.opacity = '0.5';
      syncBtn.style.cursor = 'not-allowed';
    } else {
      syncBtn.disabled = false;
      syncBtn.style.opacity = '1';
      syncBtn.style.cursor = 'pointer';
    }
  }
}

// Lógica de avanço para Escalas
function handleEscalasNext() {
  if (state.escalasSubView === 'list') {
    state.escalasSubView = 'create';
    renderApp();
  } else if (state.escalasSubView === 'create') {
    const famId = parseInt(document.getElementById('escala-familia').value);
    const checkedVics = Array.from(document.querySelectorAll('input[name="escala-vicentino"]:checked'))
      .map(input => parseInt(input.value));
    const dataPlanejada = document.getElementById('escala-data').value;

    if (!famId) {
      alert('Por favor, selecione a família assistida.');
      return;
    }
    if (checkedVics.length === 0) {
      alert('Por favor, selecione pelo menos 1 vicentino para realizar a visita.');
      return;
    }
    if (!dataPlanejada) {
      alert('Por favor, defina a data programada para a visita.');
      return;
    }

    if (checkedVics.length === 1) {
      const prosseguir = confirm('A SSVP recomenda que as visitas sejam feitas em duplas. Deseja registrar a escala com apenas 1 vicentino?');
      if (!prosseguir) return;
    }

    const newEscala = {
      id: Date.now(),
      familiaId: famId,
      vicentinos: checkedVics,
      dataEscala: dataPlanejada,
      status: 'pendente',
      visitaId: null
    };

    data.escalas.push(newEscala);

    // Sincronizar escala com vicentinos serializados como string
    const escalaToSync = { ...newEscala, vicentinos: newEscala.vicentinos.join(',') };
    addToSyncQueue('escalas', escalaToSync);

    saveData();
    alert('Visita designada (escala) com sucesso!');
    state.escalasSubView = 'list';
    renderApp();
  }
}

// Lógica de recuo para Escalas
function handleEscalasPrev() {
  if (state.escalasSubView === 'list') {
    switchView('flow');
  } else {
    state.escalasSubView = 'list';
    renderApp();
  }
}

// Renderização do Painel de Escalas
function renderEscalasView() {
  const stepIndicator = document.querySelector('.flow-step-indicator');
  if (stepIndicator) stepIndicator.style.display = 'none';

  btnPrev.style.display = 'block';

  // Apenas a diretoria (presidente, vice_presidente, secretario, tesoureiro) cria ou exclui escalas (V0.3.8)
  const isDir = state.currentUser && ['presidente', 'vice_presidente', 'secretario', 'tesoureiro'].includes(state.currentUser.cargo);

  if (state.escalasSubView === 'list') {
    btnPrev.textContent = 'Voltar para Início';
    if (isDir) {
      btnNext.style.display = 'block';
      btnNext.textContent = 'Designar Visita';
    } else {
      btnNext.style.display = 'none'; // Membros comuns não criam escalas
    }
  } else {
    btnPrev.textContent = 'Cancelar';
    btnNext.style.display = 'block';
    btnNext.textContent = 'Salvar Escala';
  }

  formContainer.innerHTML = '';

  if (state.escalasSubView === 'list') {
    flowTitle.textContent = 'Escalas de Visitas';
    flowDesc.textContent = 'Consulte as visitas agendadas pela diretoria da conferência.';

    const escalasWrapper = document.createElement('div');
    escalasWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 12px; width: 100%;';

    // Abas de filtro: Minhas Escalas / Todas as Escalas
    const filterTabs = document.createElement('div');
    filterTabs.className = 'filter-tabs';
    filterTabs.style.cssText = 'margin-bottom: 4px;';
    filterTabs.innerHTML = `
      <button class="tab-btn ${state.escalasTab === 'minhas' ? 'active' : ''}" data-tab="minhas">Minhas Escalas</button>
      <button class="tab-btn ${state.escalasTab === 'todas' ? 'active' : ''}" data-tab="todas">Todas as Escalas</button>
    `;

    // Checkbox para ocultar realizadas
    const filterCheckboxLabel = document.createElement('label');
    filterCheckboxLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 10px; font-size: 1.05rem; font-weight: 600; cursor: pointer; padding: 4px 0; color: var(--text-main); margin-bottom: 8px;';
    filterCheckboxLabel.innerHTML = `
      <input type="checkbox" id="escalas-hide-completed" ${state.escalasOcultarRealizadas ? 'checked' : ''} style="width: 22px; height: 22px; cursor: pointer;">
      <span>Ocultar visitas já realizadas</span>
    `;

    const listContainer = document.createElement('div');
    listContainer.id = 'escalas-list-container';
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    escalasWrapper.appendChild(filterTabs);
    escalasWrapper.appendChild(filterCheckboxLabel);
    escalasWrapper.appendChild(listContainer);
    formContainer.appendChild(escalasWrapper);

    // Event listeners para os filtros
    filterTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.escalasTab = e.currentTarget.getAttribute('data-tab');
        renderApp();
      });
    });

    const checkboxInput = filterCheckboxLabel.querySelector('#escalas-hide-completed');
    checkboxInput.addEventListener('change', (e) => {
      state.escalasOcultarRealizadas = e.target.checked;
      renderApp();
    });

    renderEscalasListItems();

  } else if (state.escalasSubView === 'create') {
    flowTitle.textContent = 'Designar Nova Visita';
    flowDesc.textContent = 'Selecione a família, os vicentinos e a data planejada.';

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 18px;';

    // Famílias
    const familias = data.pessoas.filter(p => p.papelAtual === 'assistido');
    let famOptions = familias.map(f => `<option value="${f.id}">${f.nome} ${f.sobrenome || ''} (📍 ${f.bairro || 'Sem bairro'})</option>`).join('');
    if (!famOptions) {
      famOptions = '<option value="">Nenhuma família cadastrada</option>';
    }

    // Vicentinos
    const vicentinos = data.pessoas.filter(p => p.papelAtual === 'vicentino');
    let vicCheckboxes = vicentinos.map(v => `
    <label style="display: flex; align-items: center; gap: 16px; padding: 14px; border: 2px solid var(--surface-border); border-radius: var(--border-radius-md); cursor: pointer; min-height: var(--touch-target); transition: var(--transition-smooth);">
      <input type="checkbox" name="escala-vicentino" value="${v.id}" style="width: 24px; height: 24px; cursor: pointer;">
      <span style="font-weight: 600; font-size: 1.15rem; color: var(--text-main);">${v.nome} ${v.sobrenome || ''}</span>
    </label>
  `).join('');
    if (!vicCheckboxes) {
      vicCheckboxes = '<p style="color: var(--danger); font-weight: bold;">Nenhum vicentino cadastrado.</p>';
    }

    form.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="escala-familia" style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">Família Assistida</label>
      <select id="escala-familia" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer; font-family: inherit; background: var(--surface); color: var(--text-main);">
        ${famOptions}
      </select>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">Vicentinos Designados (Dupla)</label>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${vicCheckboxes}
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="escala-data" style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">Data Planejada</label>
      <input type="date" id="escala-data" value="${new Date().toISOString().split('T')[0]}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; font-family: inherit; background: var(--surface); color: var(--text-main);">
    </div>
  `;

    formContainer.appendChild(form);

    // Adicionar eventos para estilizar checkboxes de escalas dinamicamente ao clicar no label
    document.querySelectorAll('input[name="escala-vicentino"]').forEach(input => {
      const label = input.closest('label');
      input.addEventListener('change', (e) => {
        if (e.target.checked) {
          label.style.borderColor = 'var(--primary)';
          label.style.background = 'var(--primary-light)';
        } else {
          label.style.borderColor = 'var(--surface-border)';
          label.style.background = 'transparent';
        }
      });
    });
  }
}

// Renderizar itens da lista de escalas
function renderEscalasListItems() {
  const container = document.getElementById('escalas-list-container');
  if (!container) return;

  container.innerHTML = '';

  const activeEscalas = data.escalas.filter(e => e.status !== 'cancelada');

  if (activeEscalas.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhuma escala de visita agendada.</p>';
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Filtrar por aba (Minhas vs Todas)
  let filtered = activeEscalas;
  if (state.escalasTab === 'minhas' && state.currentUserId) {
    filtered = filtered.filter(esc => esc.vicentinos.includes(state.currentUserId));
  }

  // 2. Filtrar por realizada (Ocultar Realizadas)
  if (state.escalasOcultarRealizadas) {
    filtered = filtered.filter(esc => esc.status !== 'realizada');
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhuma escala encontrada com os filtros selecionados.</p>';
    return;
  }

  // Ordena por data decrescente
  const sorted = [...filtered].sort((a, b) => new Date(b.dataEscala) - new Date(a.dataEscala));

  sorted.forEach(esc => {
    const fam = data.pessoas.find(p => p.id === esc.familiaId);
    const famName = fam ? `${fam.nome} ${fam.sobrenome || ''}` : 'Família Excluída';
    const famBairro = fam && fam.bairro ? `📍 ${fam.bairro}` : '';

    const vicNames = esc.vicentinos.map(id => {
      const v = data.pessoas.find(p => p.id === id);
      return v ? v.nome : `Vicentino ${id}`;
    }).join(' e ');

    const isUserAssigned = state.currentUserId && esc.vicentinos.includes(state.currentUserId);
    const isPendente = esc.status === 'pendente';
    const isAtrasada = isPendente && esc.dataEscala < todayStr;
    const canExcluir = state.currentUser && ['presidente', 'vice_presidente', 'secretario', 'tesoureiro'].includes(state.currentUser.cargo);

    // Configurar cores e badges de atraso / pendente / realizada
    let badgeHtml = '';
    let cardBorder = 'var(--surface-border)';
    let cardBackground = 'var(--surface)';

    if (isPendente) {
      if (isAtrasada) {
        badgeHtml = `
          <span class="badge" style="background-color: hsla(354, 70%, 45%, 0.15); color: var(--danger); font-size: 0.85rem; text-transform: uppercase; display: inline-flex; align-items: center; gap: 4px;">
            ⚠️ Atrasada
          </span>
        `;
        cardBorder = 'var(--danger)';
        cardBackground = 'hsla(354, 70%, 45%, 0.02)';
      } else {
        badgeHtml = `
          <span class="badge badge-visitante" style="font-size: 0.85rem; text-transform: uppercase;">
            Pendente
          </span>
        `;
        if (isUserAssigned) {
          cardBorder = 'var(--primary)';
        }
      }
    } else {
      badgeHtml = `
        <span class="badge badge-benfeitor" style="font-size: 0.85rem; text-transform: uppercase;">
          Realizada
        </span>
      `;
    }

    // Botão de Iniciar Relato
    let actionBtnHtml = '';
    if (isPendente) {
      if (isUserAssigned) {
        actionBtnHtml = `
        <button type="button" class="btn btn-primary btn-iniciar-escala" data-id="${esc.id}" style="width: auto; min-height: auto; padding: 10px 18px; font-size: 1rem; margin: 0; align-self: flex-start; display: flex; align-items: center; gap: 8px;">
          📝 Registrar Relato
        </button>
      `;
      } else {
        actionBtnHtml = `
        <span style="font-size: 0.95rem; color: var(--text-muted); font-style: italic; font-weight: 600;">Reservado para: ${vicNames}</span>
      `;
      }
    } else {
      actionBtnHtml = `
      <span style="font-size: 0.95rem; color: var(--success); font-weight: bold; display: flex; align-items: center; gap: 4px;">
        ✓ Visita Realizada por ${vicNames}
      </span>
    `;
    }

    let deleteBtnHtml = '';
    if (canExcluir && isPendente) {
      deleteBtnHtml = `
      <button type="button" class="btn btn-secondary btn-excluir-escala" data-id="${esc.id}" style="width: auto; min-height: auto; padding: 8px 16px; font-size: 0.95rem; color: var(--danger); border-color: var(--danger); margin: 0;">
        Excluir
      </button>
    `;
    }

    const card = document.createElement('div');
    card.style.cssText = `
      background: ${cardBackground};
      border: 2px solid ${cardBorder};
      border-radius: var(--border-radius-md);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: var(--shadow-sm);
    `;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px; flex-wrap: wrap;">
        <div>
          <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted);">📅 Data Planejada: ${esc.dataEscala}</span>
          <h4 style="margin: 4px 0; font-size: 1.25rem; font-family: 'Outfit', sans-serif; color: var(--text-main);">${famName} <span style="font-size: 0.95rem; font-weight: normal; color: var(--text-muted);">${famBairro}</span></h4>
          <p style="margin: 0; font-size: 1.05rem; color: var(--text-main);"><strong>Dupla Designada:</strong> ${vicNames}</p>
        </div>
        ${badgeHtml}
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; border-top: 1px solid var(--surface-border); padding-top: 10px;">
        ${actionBtnHtml}
        ${deleteBtnHtml}
      </div>
    `;

    container.appendChild(card);
  });

  // Vincular events dos botões
  document.querySelectorAll('.btn-iniciar-escala').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const escalaId = parseInt(e.currentTarget.getAttribute('data-id'));
      iniciarVisitaPorEscala(escalaId);
    });
  });

  document.querySelectorAll('.btn-excluir-escala').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const escalaId = parseInt(e.currentTarget.getAttribute('data-id'));
      if (confirm('Deseja realmente excluir esta designação de visita?')) {
        excluirEscala(escalaId);
      }
    });
  });
}

// Iniciar fluxo da visita pré-selecionando família e dupla da escala
function iniciarVisitaPorEscala(escalaId) {
  const esc = data.escalas.find(e => e.id === escalaId);
  if (!esc) return;

  state.activeEscalaId = esc.id;
  state.selectedFamily = esc.familiaId;
  state.selectedVicentinos = esc.vicentinos;

  // Mudar para visualização do fluxo, no passo 3 (relato)
  state.currentView = 'flow';
  state.currentStep = 3;

  // Inicializar metas ativas para validação
  state.goalValidations = {};
  const pendentes = data.metas.filter(m => m.familiaId === state.selectedFamily && m.status === 'pendente');
  pendentes.forEach(m => {
    state.goalValidations[m.id] = { status: null, justificativa: '' };
  });

  // Atualizar abas visuais do cabeçalho
  const navBtns = document.querySelectorAll('#main-nav-tabs .tab-btn');
  navBtns.forEach(btn => {
    if (btn.getAttribute('data-view') === 'flow') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderApp();
}

// Cancelar/excluir escala localmente e preparar sincronização
function excluirEscala(escalaId) {
  const esc = data.escalas.find(e => e.id === escalaId);
  if (esc) {
    esc.status = 'cancelada';
    saveData();

    const escalaToSync = { ...esc, vicentinos: esc.vicentinos.join(',') };
    addToSyncQueue('escalas', escalaToSync);

    renderApp();
  }
}

// Direcionamento Centralizado de Renderização
function renderApp() {
  updateHeaderUserProfile();
  updateSyncBtnState();

  if (btnEscalas) {
    btnEscalas.style.display = 'none';
  }

  const isPresident = state.currentUser && state.currentUser.cargo === 'presidente';
  const presidentSection = document.getElementById('president-config-section');
  if (presidentSection) {
    presidentSection.style.display = isPresident ? 'flex' : 'none';
  }

  if (state.currentView === 'pessoas') {
    renderPessoasView();
  } else if (state.currentView === 'escalas') {
    renderEscalasView();
  } else {
    renderFlowView();
  }
}

// Eventos de Botões do Footer
function setupEventListeners() {
  btnNext.addEventListener('click', () => {
    if (state.currentView === 'pessoas') {
      handlePessoasNext();
    } else if (state.currentView === 'escalas') {
      handleEscalasNext();
    } else {
      handleFlowNext();
    }
  });

  btnPrev.addEventListener('click', () => {
    if (state.currentView === 'pessoas') {
      handlePessoasPrev();
    } else if (state.currentView === 'escalas') {
      handleEscalasPrev();
    } else {
      handleFlowPrev();
    }
  });

  // Evento de clique para o botão de Escalas na barra inferior
  if (btnEscalas) {
    btnEscalas.addEventListener('click', () => {
      switchView('escalas');
    });
  }

  // Eventos de rede
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  // Toggle do painel de Configurações
  const settingsHeader = document.getElementById('settings-header');
  const settingsContent = document.getElementById('settings-content');
  const toggleIcon = document.getElementById('settings-toggle-icon');

  if (settingsHeader && settingsContent && toggleIcon) {
    settingsHeader.addEventListener('click', () => {
      const isOpen = settingsContent.style.display !== 'none';
      settingsContent.style.display = isOpen ? 'none' : 'flex';
      toggleIcon.textContent = isOpen ? '▼' : '▲';
    });
    // Fechado por padrão no início
    settingsContent.style.display = 'none';
    toggleIcon.textContent = '▼';
  }

  // Configuração da URL do Apps Script
  const apiUrlInput = document.getElementById('settings-api-url');
  if (apiUrlInput) {
    const isAuto = window.APPS_SCRIPT_WEB_APP_URL &&
      !window.APPS_SCRIPT_WEB_APP_URL.includes('<?=') &&
      window.APPS_SCRIPT_WEB_APP_URL.trim() !== '';
    if (isAuto) {
      apiUrlInput.value = state.webAppUrl;
      apiUrlInput.disabled = true;
      apiUrlInput.style.backgroundColor = 'var(--surface-border)';
      apiUrlInput.style.opacity = '0.7';
      apiUrlInput.placeholder = 'Configuração Automática (Ativa)';
    } else {
      apiUrlInput.value = state.webAppUrl;
      apiUrlInput.addEventListener('input', (e) => {
        state.webAppUrl = e.target.value.trim();
        saveData();
        updateSyncStatusUI();
      });
    }
  }

  // Ação do Botão Sincronizar Agora
  const syncBtn = document.getElementById('btn-sync-now');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => runDataSync());
  }

  // Ação do Botão Restaurar Dados Padrão
  const restoreBtn = document.getElementById('btn-restore-defaults');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      const confirmacao = confirm('Isso apagará todos os dados atuais no seu navegador e restaurará os dados iniciais de demonstração (famílias, vicentinos e metas fictícias). Deseja continuar?');
      if (confirmacao) {
        // Limpa tudo do LocalStorage e reinicia flags de migração
        localStorage.removeItem(KEYS.PESSOAS);
        localStorage.removeItem(KEYS.HISTORICO);
        localStorage.removeItem(KEYS.VISITAS);
        localStorage.removeItem(KEYS.METAS);
        localStorage.removeItem(KEYS.ESCALAS);
        localStorage.removeItem(KEYS.SESSION_USER);
        localStorage.removeItem(KEYS.SYNC_QUEUE);
        localStorage.removeItem('ssvp_v037_login_migrated');

        // Recarrega os dados locais padrão (mock)
        loadData();
        checkAuthAndToggleView();

        renderApp();
        updateSyncStatusUI();
        alert('Dados padrão restaurados e adicionados à fila de sincronização. Clique em "Sincronizar Agora" para enviá-los para sua planilha!');
      }
    });
  }

  // Evento de Login (V0.3.7)
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Evento de Logout (V0.3.7)
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }

  // Evento de Download de Configuração (V0.3.8)
  const downloadConfigBtn = document.getElementById('btn-download-config');
  if (downloadConfigBtn) {
    downloadConfigBtn.addEventListener('click', () => {
      if (!state.webAppUrl || state.webAppUrl.trim() === '') {
        alert('Por favor, configure a URL do Apps Script antes de baixar o arquivo.');
        return;
      }
      const configObj = {
        webAppUrl: state.webAppUrl.trim()
      };
      const jsonString = JSON.stringify(configObj, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'config.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }
}

/* ==========================================================================
   FLUXO DE VISITAS (Flow View)
   ========================================================================== */

function handleFlowNext() {
  if (state.currentStep === 0) {
    state.currentStep = 1;
  } else if (state.currentStep === 1) {
    // Validar seleção de vicentinos
    const checkedVicentinos = Array.from(document.querySelectorAll('input[name="vicentino"]:checked'))
      .map(input => parseInt(input.value));

    if (checkedVicentinos.length === 0) {
      alert('Por favor, selecione pelo menos 1 confrade/consócia que fará a visita hoje.');
      return;
    }

    // Regra: Vicentinos só podem registrar relatos de visitas das quais participaram
    if (state.currentUserId && !checkedVicentinos.includes(state.currentUserId)) {
      alert('Você só pode registrar relatos de visitas das quais participou. Por favor, marque a si mesmo como um dos participantes.');
      return;
    }

    if (checkedVicentinos.length === 1) {
      const prosseguir = confirm('Atenção: A SSVP recomenda fortemente que as visitas sejam feitas por pelo menos 2 confrades/consócias. Deseja prosseguir com apenas 1?');
      if (!prosseguir) {
        return;
      }
    }

    state.selectedVicentinos = checkedVicentinos;
    state.currentStep = 2;
  } else if (state.currentStep === 2) {
    // Validar seleção de família
    const selectedFamRadio = document.querySelector('input[name="familia"]:checked');
    if (!selectedFamRadio) {
      alert('Por favor, selecione a família a ser visitada.');
      return;
    }
    state.selectedFamily = parseInt(selectedFamRadio.value);

    // Se mudou de família em relação à escala ativa, desvincula a escala (V0.3.8)
    if (state.activeEscalaId) {
      const esc = data.escalas.find(e => e.id === state.activeEscalaId);
      if (esc && esc.familiaId !== state.selectedFamily) {
        state.activeEscalaId = null;
      }
    }

    // Inicializar validação das metas pendentes da família selecionada
    state.goalValidations = {};
    const pendentes = data.metas.filter(m => m.familiaId === state.selectedFamily && m.status === 'pendente');
    pendentes.forEach(m => {
      state.goalValidations[m.id] = { status: null, justificativa: '' };
    });

    state.currentStep = 3;
  } else if (state.currentStep === 3) {
    // Validar o relato da visita
    const relatoVal = document.getElementById('visit-relato').value.trim();
    if (!relatoVal) {
      alert('Por favor, registre o relato da visita.');
      return;
    }

    // Validar se todas as metas pendentes foram respondidas (Sim/Não)
    const pendentes = data.metas.filter(m => m.familiaId === state.selectedFamily && m.status === 'pendente');
    for (let m of pendentes) {
      const val = state.goalValidations[m.id];
      if (!val || !val.status) {
        alert(`Por favor, responda se a meta "${m.meta}" foi cumprida.`);
        return;
      }

      // Se foi não cumprida, a justificativa é obrigatória
      if (val.status === 'nao_cumprida') {
        const justInput = document.getElementById(`visit-meta-just-${m.id}`);
        const justText = justInput ? justInput.value.trim() : '';
        if (!justText) {
          alert(`Por favor, insira a justificativa para o não cumprimento da meta: "${m.meta}".`);
          return;
        }
        val.justificativa = justText;
      }
    }

    // 1. Criar e salvar o registro da Visita
    const visitId = Date.now();
    const newVisit = {
      id: visitId,
      data: document.getElementById('visit-date').value,
      vicentinos: state.selectedVicentinos,
      familiaId: state.selectedFamily,
      relato: relatoVal
    };
    data.visitas.push(newVisit);

    // Sincronizar visita (com vicentinos serializados como string)
    const visitToSync = { ...newVisit, vicentinos: newVisit.vicentinos.join(',') };
    addToSyncQueue('visitas', visitToSync);

    // Se a visita foi originada de uma Escala, marca a Escala como realizada
    if (state.activeEscalaId) {
      const esc = data.escalas.find(e => e.id === state.activeEscalaId);
      if (esc) {
        esc.status = 'realizada';
        esc.visitaId = visitId;
        const escalaToSync = { ...esc, vicentinos: esc.vicentinos.join(',') };
        addToSyncQueue('escalas', escalaToSync);
      }
      state.activeEscalaId = null; // reset
    }

    // 2. Atualizar metas validadas na visita
    pendentes.forEach(m => {
      const val = state.goalValidations[m.id];
      m.status = val.status;
      m.justificativa = val.justificativa;
      m.dataResolucao = new Date().toISOString();

      // Se foi cumprida, desbloquear dependências imediatas
      if (val.status === 'cumprida') {
        data.metas.forEach(child => {
          if (child.metaDependenciaId === m.id && child.status === 'bloqueada') {
            child.status = 'pendente';
            addToSyncQueue('metas', child);
          }
        });
      }
      addToSyncQueue('metas', m);
    });

    // 3. Cadastrar nova meta, se fornecida
    const novaMetaVal = document.getElementById('visit-meta').value.trim();
    const novoPrazoVal = document.getElementById('visit-meta-date').value;
    const depVal = document.getElementById('visit-meta-dep').value;

    if (novaMetaVal) {
      const depId = depVal ? parseInt(depVal) : null;
      let initialStatus = 'pendente';

      // Se depender de uma meta que ainda não foi cumprida, ela inicia bloqueada
      if (depId) {
        const parentMeta = data.metas.find(m => m.id === depId);
        if (parentMeta && parentMeta.status !== 'cumprida') {
          initialStatus = 'bloqueada';
        }
      }

      const newMeta = {
        id: Date.now() + 5,
        familiaId: state.selectedFamily,
        meta: novaMetaVal,
        prazo: novoPrazoVal || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias padrão
        status: initialStatus,
        metaDependenciaId: depId,
        justificativa: '',
        visitaCriacaoId: visitId
      };
      data.metas.push(newMeta);
      addToSyncQueue('metas', newMeta);
    }

    saveData();
    alert('Visita e metas registradas com sucesso!');

    // Reiniciar fluxo
    state.currentStep = 0;
    state.selectedVicentinos = state.currentUserId ? [state.currentUserId] : [1];
    state.selectedFamily = null;
  }

  renderApp();
}

function handleFlowPrev() {
  if (state.currentStep === 0) {
    switchView('pessoas');
  } else if (state.currentStep > 0) {
    state.currentStep--;
  }
  renderApp();
}

function renderFlowView() {
  const stepIndicator = document.querySelector('.flow-step-indicator');

  if (state.currentStep === 0) {
    if (stepIndicator) stepIndicator.style.display = 'none';
  } else {
    if (stepIndicator) stepIndicator.style.display = 'flex';
    stepLabel.textContent = `Passo ${state.currentStep} de 3`;
    stepProgress.style.width = `${(state.currentStep / 3) * 100}%`;
  }

  if (state.currentStep === 0) {
    state.activeEscalaId = null; // Garante que a escala ativa é limpa ao retornar para a tela inicial (V0.3.8)
    btnPrev.style.display = 'block';
    btnPrev.textContent = 'Gerenciar Pessoas';
    btnNext.textContent = 'Iniciar Nova Visita';
    if (btnEscalas) {
      btnEscalas.style.display = 'block';
    }
  } else if (state.currentStep === 1) {
    btnPrev.style.display = 'block';
    btnPrev.textContent = 'Voltar para Início';
    btnNext.textContent = 'Continuar para Família';
  } else {
    btnPrev.style.display = 'block';
    btnPrev.textContent = 'Voltar';
    if (state.currentStep === 2) {
      btnNext.textContent = 'Continuar para Relato';
    } else {
      btnNext.textContent = 'Salvar Registro';
    }
  }

  formContainer.innerHTML = '';

  if (state.currentStep === 0) {
    flowTitle.textContent = 'Bem-vindo ao Gestor SSVP';
    flowDesc.textContent = 'Acompanhe e registre visitas vicentinas de forma simples, acessível e totalmente offline.';

    const welcomeCard = document.createElement('div');
    welcomeCard.style.cssText = 'background: var(--surface); border: 2px solid var(--surface-border); border-radius: var(--border-radius-md); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 12px; padding: 20px;';

    const toggleHeader = document.createElement('div');
    toggleHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;';
    toggleHeader.innerHTML = `
      <h3 style="font-size: 1.25rem; color: var(--primary); margin: 0; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 8px;">
        ℹ️ Instruções de Uso
      </h3>
      <span id="instructions-toggle-icon" style="font-size: 1.25rem; color: var(--text-muted); font-weight: bold;">
        ${state.showWelcomeInstructions ? '▲' : '▼'}
      </span>
    `;

    const instructionsContent = document.createElement('div');
    instructionsContent.style.cssText = `display: ${state.showWelcomeInstructions ? 'flex' : 'none'}; flex-direction: column; gap: 16px; border-top: 1px solid var(--surface-border); padding-top: 16px;`;
    instructionsContent.innerHTML = `
      <p style="font-size: 1.05rem; color: var(--text-main); line-height: 1.5; margin: 0;">
        Auxilia conferências vicentinas a registrar relatos de visitas, acompanhar metas de promoção social para as famílias e sincronizar tudo com o Google Sheets, mesmo trabalhando sem conexão à internet.
      </p>
      <div>
        <h4 style="font-size: 1.15rem; color: var(--primary); margin-bottom: 8px; font-family: 'Outfit', sans-serif;">Como usar em 3 passos simples:</h4>
        <ol style="margin-left: 20px; font-size: 1.05rem; color: var(--text-main); display: flex; flex-direction: column; gap: 8px; line-height: 1.4;">
          <li><strong>Escolha a Dupla:</strong> Selecione os confrades e consócias que farão a visita (mínimo de 2).</li>
          <li><strong>Selecione a Família:</strong> Escolha o lar assistido cadastrado.</li>
          <li><strong>Registre a Conversa:</strong> Digite o relato da visita e acompanhe/crie metas.</li>
        </ol>
      </div>
    `;

    welcomeCard.appendChild(toggleHeader);
    welcomeCard.appendChild(instructionsContent);
    formContainer.appendChild(welcomeCard);

    toggleHeader.addEventListener('click', () => {
      state.showWelcomeInstructions = !state.showWelcomeInstructions;
      const isOpen = state.showWelcomeInstructions;
      instructionsContent.style.display = isOpen ? 'flex' : 'none';
      toggleHeader.querySelector('#instructions-toggle-icon').textContent = isOpen ? '▲' : '▼';
      saveData();
    });

  } else if (state.currentStep === 1) {
    flowTitle.textContent = 'Selecione a Dupla (Confrades/Consócias)';
    flowDesc.textContent = 'Selecione a dupla de confrades e consócias que fará a visita hoje.';

    const vicentinosAtivos = data.pessoas.filter(p => p.papelAtual === 'vicentino');

    if (vicentinosAtivos.length === 0) {
      formContainer.innerHTML = '<p style="color: var(--danger); font-weight: bold; text-align: center; padding: 24px;">Nenhum confrade ou consócia cadastrado. Vá em "Gerenciar Pessoas" e cadastre no mínimo 2 membros.</p>';
      return;
    }

    vicentinosAtivos.forEach(vic => {
      const isChecked = state.selectedVicentinos.includes(vic.id);
      const label = document.createElement('label');
      label.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px;
      border: 2px solid ${isChecked ? 'var(--primary)' : 'var(--surface-border)'};
      border-radius: var(--border-radius-md);
      background: ${isChecked ? 'var(--primary-light)' : 'transparent'};
      cursor: pointer;
      min-height: var(--touch-target);
      transition: var(--transition-smooth);
    `;

      label.innerHTML = `
      <input type="checkbox" name="vicentino" value="${vic.id}" ${isChecked ? 'checked' : ''} style="width: 24px; height: 24px; cursor: pointer;">
      <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${vic.nome} ${vic.sobrenome || ''}</span>
    `;

      const checkbox = label.querySelector('input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          label.style.borderColor = 'var(--primary)';
          label.style.background = 'var(--primary-light)';
        } else {
          label.style.borderColor = 'var(--surface-border)';
          label.style.background = 'transparent';
        }
      });

      formContainer.appendChild(label);
    });

  } else if (state.currentStep === 2) {
    flowTitle.textContent = 'Selecione a Família';
    flowDesc.textContent = 'Escolha a família assistida que está sendo visitada.';

    const familiasAtivas = data.pessoas.filter(p => p.papelAtual === 'assistido');

    if (familiasAtivas.length === 0) {
      formContainer.innerHTML = '<p style="color: var(--danger); font-weight: bold; text-align: center; padding: 24px;">Nenhuma Família cadastrada. Vá em "Gerenciar Pessoas" e cadastre uma pessoa com o papel de Assistido.</p>';
      return;
    }

    familiasAtivas.forEach(fam => {
      const isSelected = state.selectedFamily === fam.id;
      const label = document.createElement('label');
      label.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px;
      border: 2px solid ${isSelected ? 'var(--primary)' : 'var(--surface-border)'};
      border-radius: var(--border-radius-md);
      background: ${isSelected ? 'var(--primary-light)' : 'transparent'};
      cursor: pointer;
      min-height: var(--touch-target);
      transition: var(--transition-smooth);
    `;

      label.innerHTML = `
      <input type="radio" name="familia" value="${fam.id}" ${isSelected ? 'checked' : ''} style="width: 24px; height: 24px; cursor: pointer;">
      <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${fam.nome} ${fam.sobrenome || ''}</span>
    `;

      const radio = label.querySelector('input');
      radio.addEventListener('change', () => {
        document.querySelectorAll('input[name="familia"]').forEach(r => {
          const lbl = r.closest('label');
          lbl.style.borderColor = 'var(--surface-border)';
          lbl.style.background = 'transparent';
        });
        label.style.borderColor = 'var(--primary)';
        label.style.background = 'var(--primary-light)';
      });

      formContainer.appendChild(label);
    });

  } else if (state.currentStep === 3) {
    const selectedFam = data.pessoas.find(p => p.id === state.selectedFamily);
    const selectedFamName = selectedFam ? `${selectedFam.nome} ${selectedFam.sobrenome || ''}` : 'Família';
    flowTitle.textContent = `Visita: ${selectedFamName}`;
    flowDesc.textContent = 'Avalie as metas anteriores, registre o relato e combine novos passos.';

    const formWrapper = document.createElement('div');
    formWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

    // A. Filtrar metas da família
    const activeMetas = data.metas.filter(m => m.familiaId === state.selectedFamily && m.status === 'pendente');
    const blockedMetas = data.metas.filter(m => m.familiaId === state.selectedFamily && m.status === 'bloqueada');
    const pastMetas = data.metas.filter(m => m.familiaId === state.selectedFamily && (m.status === 'cumprida' || m.status === 'nao_cumprida'));

    // B. Gerar HTML de Validação de Metas Ativas
    let activeMetasHtml = '';
    if (activeMetas.length > 0) {
      activeMetasHtml += `
      <div style="display: flex; flex-direction: column; gap: 16px; border-bottom: 1px solid var(--surface-border); padding-bottom: 20px;">
        <h3 style="font-size: 1.3rem; color: var(--primary); font-family: 'Outfit', sans-serif;">Acompanhar Metas Ativas</h3>
        <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: -8px;">Verifique com a família se as seguintes metas foram cumpridas:</p>
    `;

      activeMetas.forEach(m => {
        activeMetasHtml += `
        <div style="background: var(--background); padding: 16px; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); display: flex; flex-direction: column; gap: 12px;">
          <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-main); line-height: 1.3;">${m.meta}</div>
          <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">Prazo: ${m.prazo}</div>
          
          <!-- Botões Sim/Não de Validação -->
          <div class="val-btn-group">
            <button type="button" class="val-btn val-btn-sim" id="btn-sim-${m.id}" data-id="${m.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Sim
            </button>
            <button type="button" class="val-btn val-btn-nao" id="btn-nao-${m.id}" data-id="${m.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              Não
            </button>
          </div>

          <!-- Campo de Justificativa Condicional com Ditado por Voz e Botão Inserir -->
          <div id="just-wrapper-${m.id}" style="display: none; flex-direction: column; gap: 8px; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <label for="visit-meta-just-${m.id}" style="font-weight: 700; font-size: 1rem; color: var(--danger);">Motivo / Justificativa (Obrigatório)</label>
              <button type="button" id="btn-voice-just-${m.id}" class="btn-mic" aria-label="Falar justificativa">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="flex-shrink: 0;">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
                <span id="btn-mic-just-text-${m.id}">Falar</span>
              </button>
            </div>
            <textarea id="visit-meta-just-${m.id}" rows="2" placeholder="Ex: Estava chovendo muito e não conseguiu transporte..." style="padding: 10px; font-size: 1.05rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); font-family: inherit; width: 100%; resize: vertical;"></textarea>
            <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
              <button type="button" class="btn btn-primary btn-inserir-new-just" id="btn-inserir-new-just-${m.id}" data-id="${m.id}" style="padding: 6px 16px; font-size: 0.95rem; min-height: 38px; width: auto; margin: 0;">Inserir</button>
              <span id="msg-new-just-${m.id}" style="font-size: 0.9rem; font-weight: 600; color: var(--success); display: none; align-items: center; gap: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Justificativa inserida!
              </span>
            </div>
          </div>
        </div>
      `;
      });
      activeMetasHtml += `</div>`;
    }

    // C. Gerar HTML de Histórico de Metas
    let pastMetasHtml = '';
    if (pastMetas.length > 0) {
      pastMetasHtml += `
      <div style="display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--surface-border); padding-bottom: 20px;">
        <h3 style="font-size: 1.2rem; color: var(--text-main); font-family: 'Outfit', sans-serif;">Histórico Recente de Metas</h3>
    `;
      pastMetas.sort((a, b) => b.id - a.id).forEach(m => {
        const isNaoCumprida = m.status === 'nao_cumprida';
        const editable = isJustificationEditable(m);

        let justSectionHtml = '';
        if (m.justificativa) {
          if (editable) {
            justSectionHtml = `
            <div id="past-just-display-container-${m.id}" style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
              <div style="font-size: 0.95rem; color: var(--text-muted); font-style: italic;">
                Motivo: <span id="past-just-text-${m.id}">"${m.justificativa}"</span>
              </div>
              <button type="button" class="btn-edit-past-just" data-id="${m.id}" style="align-self: flex-start; background: none; border: none; color: var(--primary); font-weight: bold; font-size: 0.95rem; cursor: pointer; padding: 4px 0; display: inline-flex; align-items: center; gap: 6px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Editar Justificativa
              </button>
            </div>
            <div id="past-just-edit-container-${m.id}" style="display: none; flex-direction: column; gap: 8px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <label for="edit-past-just-input-${m.id}" style="font-weight: 700; font-size: 0.95rem; color: var(--danger);">Editar Justificativa (Obrigatório)</label>
                <button type="button" id="btn-voice-past-just-${m.id}" class="btn-mic" style="padding: 4px 12px; min-height: 32px;" aria-label="Falar justificativa">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style="flex-shrink: 0;">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                  <span id="btn-mic-past-just-text-${m.id}">Falar</span>
                </button>
              </div>
              <textarea id="edit-past-just-input-${m.id}" rows="2" style="padding: 8px; font-size: 1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); font-family: inherit; width: 100%; resize: vertical;">${m.justificativa}</textarea>
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button type="button" class="btn btn-primary btn-save-past-just" data-id="${m.id}" style="padding: 6px 14px; font-size: 0.95rem; min-height: 36px; width: auto; margin: 0;">Inserir</button>
                <button type="button" class="btn btn-secondary btn-cancel-past-just" data-id="${m.id}" style="padding: 6px 14px; font-size: 0.95rem; min-height: 36px; width: auto; margin: 0;">Cancelar</button>
              </div>
            </div>
          `;
          } else {
            justSectionHtml = `<div style="font-size: 0.95rem; color: var(--text-muted); font-style: italic; margin-top: 4px;">Motivo: "${m.justificativa}"</div>`;
          }
        }

        pastMetasHtml += `
        <div class="meta-past-card ${isNaoCumprida ? 'nao-cumprida' : 'cumprida'}">
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
            <span class="meta-status-title">${m.meta}</span>
            <span class="badge ${isNaoCumprida ? 'badge-visitante' : 'badge-benfeitor'}" style="font-size: 0.75rem;">
              ${isNaoCumprida ? 'Não Cumprida' : 'Cumprida'}
            </span>
          </div>
          ${justSectionHtml}
        </div>
      `;
      });
      pastMetasHtml += `</div>`;
    }

    // D. Gerar HTML de Metas Futuras/Bloqueadas
    let blockedMetasHtml = '';
    if (blockedMetas.length > 0) {
      blockedMetasHtml += `
      <div style="display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--surface-border); padding-bottom: 20px;">
        <h3 style="font-size: 1.25rem; color: var(--text-muted); font-family: 'Outfit', sans-serif;">Próximos Passos (Aguardando)</h3>
    `;
      blockedMetas.forEach(m => {
        const parentName = data.metas.find(p => p.id === m.metaDependenciaId)?.meta || 'meta anterior';
        blockedMetasHtml += `
        <div class="meta-past-card bloqueada">
          <span style="font-weight: 700; color: var(--text-muted); font-size: 1.05rem;">🔒 ${m.meta}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Aguardando a conclusão de: <strong>"${parentName}"</strong></span>
        </div>
      `;
      });
      blockedMetasHtml += `</div>`;
    }

    // E. Dropdown de dependências para a nova meta
    // Lista todas as metas que não estão cumpridas para servir de dependência
    const depCandidates = data.metas.filter(m => m.familiaId === state.selectedFamily && m.status !== 'cumprida');
    let depOptions = '<option value="">Sem dependência (Iniciar imediatamente)</option>';
    depCandidates.forEach(m => {
      depOptions += `<option value="${m.id}">Aguardar término de: "${m.meta}"</option>`;
    });

    formWrapper.innerHTML = `
    <!-- Dados da Visita -->
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="visit-date" style="font-weight: 700; font-size: 1.15rem;">Data da Visita</label>
      <input type="date" id="visit-date" value="${state.visitDetails.date}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); min-height: var(--touch-target); width: 100%;">
    </div>

    <!-- Validação de Metas Ativas -->
    ${activeMetasHtml}

    <!-- Histórico Recente -->
    ${pastMetasHtml}

    <!-- Cadeia de Metas Aguardando -->
    ${blockedMetasHtml}

    <!-- Relato Descritivo -->
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
        <label for="visit-relato" style="font-weight: 700; font-size: 1.15rem;">Relato da Visita (O que conversaram?)</label>
        <button type="button" id="btn-voice-relato" class="btn-mic" aria-label="Falar relato">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="flex-shrink: 0;">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
          <span id="btn-mic-text">Falar</span>
        </button>
      </div>
      <textarea id="visit-relato" rows="4" placeholder="Ex: A família relatou que as coisas melhoraram, o João conseguiu..." style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); font-family: inherit; width: 100%; resize: vertical;"></textarea>
    </div>

    <!-- Definir Nova Meta -->
    <div style="border-top: 1px solid var(--surface-border); padding-top: 16px; margin-top: 8px;">
      <h3 style="font-size: 1.3rem; color: var(--primary); font-family: 'Outfit', sans-serif; margin-bottom: 12px;">Definir Nova Meta</h3>
      
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
            <label for="visit-meta" style="font-weight: 700; font-size: 1.1rem;">O que foi combinado? (Meta)</label>
            <button type="button" id="btn-voice-meta" class="btn-mic" aria-label="Falar meta">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="flex-shrink: 0;">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
              <span id="btn-mic-meta-text">Falar</span>
            </button>
          </div>
          <input type="text" id="visit-meta" placeholder="Ex: Matricular no curso profissionalizante" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); min-height: var(--touch-target); width: 100%;">
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="visit-meta-dep" style="font-weight: 700; font-size: 1.1rem;">Depende de alguma meta existente? (Cadeia)</label>
          <select id="visit-meta-dep" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer;">
            ${depOptions}
          </select>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="visit-meta-date" style="font-weight: 700; font-size: 1.1rem;">Prazo de Vencimento</label>
          <input type="date" id="visit-meta-date" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); min-height: var(--touch-target); width: 100%;">
        </div>
      </div>
    </div>
  `;

    formContainer.appendChild(formWrapper);

    // F. Vincular a Lógica de Sim/Não e Microfone condicional das metas ativas
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const setupMic = (btnId, textId, inputId) => {
      const btn = document.getElementById(btnId);
      const txt = document.getElementById(textId);
      const inp = document.getElementById(inputId);
      if (!btn || !txt || !inp) return;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => {
          btn.classList.add('recording');
          txt.textContent = 'Ouvindo...';
        };

        recognition.onend = () => {
          btn.classList.remove('recording');
          txt.textContent = 'Falar';
        };

        recognition.onerror = (e) => {
          console.error(e);
          btn.classList.remove('recording');
          txt.textContent = 'Erro';
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (inp.value.trim() === '') {
            inp.value = transcript;
          } else {
            inp.value += ' ' + transcript;
          }
          // Disparar evento input para atualizar botões
          inp.dispatchEvent(new Event('input'));
        };

        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-mic.recording').forEach(activeBtn => {
            if (activeBtn !== btn) {
              activeBtn.classList.remove('recording');
            }
          });

          if (btn.classList.contains('recording')) {
            recognition.stop();
          } else {
            recognition.start();
          }
        });
      } else {
        btn.style.opacity = '0.6';
      }
    };

    activeMetas.forEach(m => {
      const btnSim = document.getElementById(`btn-sim-${m.id}`);
      const btnNao = document.getElementById(`btn-nao-${m.id}`);
      const justWrapper = document.getElementById(`just-wrapper-${m.id}`);

      btnSim.addEventListener('click', () => {
        btnSim.classList.add('active');
        btnNao.classList.remove('active');
        justWrapper.style.display = 'none';
        state.goalValidations[m.id].status = 'cumprida';
      });

      btnNao.addEventListener('click', () => {
        btnNao.classList.add('active');
        btnSim.classList.remove('active');
        justWrapper.style.display = 'flex';
        state.goalValidations[m.id].status = 'nao_cumprida';
        // Iniciar o microfone da justificativa
        setupMic(`btn-voice-just-${m.id}`, `btn-mic-just-text-${m.id}`, `visit-meta-just-${m.id}`);
      });

      const btnInserir = document.getElementById(`btn-inserir-new-just-${m.id}`);
      const msgInserted = document.getElementById(`msg-new-just-${m.id}`);
      const justInput = document.getElementById(`visit-meta-just-${m.id}`);

      btnInserir.addEventListener('click', () => {
        const text = justInput.value.trim();
        if (!text) {
          alert('Por favor, digite ou fale a justificativa antes de inserir.');
          return;
        }
        state.goalValidations[m.id].justificativa = text;
        msgInserted.style.display = 'inline-flex';
        btnInserir.textContent = 'Alterar';
        btnInserir.classList.remove('btn-primary');
        btnInserir.classList.add('btn-secondary');
      });

      justInput.addEventListener('input', () => {
        msgInserted.style.display = 'none';
        btnInserir.textContent = 'Inserir';
        btnInserir.classList.remove('btn-secondary');
        btnInserir.classList.add('btn-primary');
      });
    });

    // Vincular a lógica de edição de justificativas passadas
    pastMetas.forEach(m => {
      if (!isJustificationEditable(m)) return;

      const btnEdit = document.querySelector(`.btn-edit-past-just[data-id="${m.id}"]`);
      const btnCancel = document.querySelector(`.btn-cancel-past-just[data-id="${m.id}"]`);
      const btnSave = document.querySelector(`.btn-save-past-just[data-id="${m.id}"]`);

      const displayContainer = document.getElementById(`past-just-display-container-${m.id}`);
      const editContainer = document.getElementById(`past-just-edit-container-${m.id}`);
      const editInput = document.getElementById(`edit-past-just-input-${m.id}`);

      // Inicializar microfone de voz
      setupMic(`btn-voice-past-just-${m.id}`, `btn-mic-past-just-text-${m.id}`, `edit-past-just-input-${m.id}`);

      if (btnEdit && btnCancel && btnSave) {
        btnEdit.addEventListener('click', () => {
          displayContainer.style.display = 'none';
          editContainer.style.display = 'flex';
        });

        btnCancel.addEventListener('click', () => {
          displayContainer.style.display = 'flex';
          editContainer.style.display = 'none';
        });

        btnSave.addEventListener('click', () => {
          const newText = editInput.value.trim();
          if (!newText) {
            alert('A justificativa não pode ser vazia.');
            return;
          }

          // Encontrar meta no banco de dados local e atualizar
          const metaToUpdate = data.metas.find(meta => meta.id === m.id);
          if (metaToUpdate) {
            metaToUpdate.justificativa = newText;
            saveData();
            addToSyncQueue('metas', metaToUpdate);
            alert('Justificativa atualizada com sucesso!');
            renderApp(); // Re-renderizar a tela para mostrar a justificativa atualizada
          }
        });
      }
    });

    // Inicializar os microfones gerais
    setupMic('btn-voice-relato', 'btn-mic-text', 'visit-relato');
    setupMic('btn-voice-meta', 'btn-mic-meta-text', 'visit-meta');
  }
}

/* ==========================================================================
   PAINEL DE GESTÃO DE PESSOAS (Pessoas View)
   ========================================================================== */

function handlePessoasNext() {
  if (state.pessoasSubView === 'list') {
    state.pessoasSubView = 'create';
    renderApp();
  } else if (state.pessoasSubView === 'create') {
    const nomeVal = document.getElementById('cad-nome').value.trim();
    const sobrenomeVal = document.getElementById('cad-sobrenome').value.trim();
    const enderecoVal = document.getElementById('cad-endereco').value.trim();
    const bairroVal = document.getElementById('cad-bairro').value.trim();
    const cepVal = document.getElementById('cad-cep').value.trim();
    const telVal = document.getElementById('cad-telefone').value.trim();
    const papelVal = document.getElementById('cad-papel').value;
    const sexoVal = document.getElementById('cad-sexo').value;

    if (!nomeVal) {
      alert('Por favor, insira o nome da pessoa.');
      return;
    }

    const newId = Date.now();
    const newPerson = {
      id: newId,
      nome: nomeVal,
      sobrenome: sobrenomeVal,
      endereco: enderecoVal,
      bairro: bairroVal,
      cep: cepVal,
      telefone: telVal,
      papelAtual: papelVal,
      dataCadastro: new Date().toISOString().split('T')[0],
      cargo: null,
      sexo: sexoVal
    };

    data.pessoas.push(newPerson);
    addToSyncQueue('pessoas', newPerson);

    const initHistory = {
      id: Date.now() + 1,
      pessoaId: newId,
      papel: papelVal,
      dataInicio: newPerson.dataCadastro,
      dataFim: null,
      nota: 'Cadastro inicial.'
    };
    data.historicoPapeis.push(initHistory);
    addToSyncQueue('historicoPapeis', initHistory);

    saveData();
    alert('Pessoa cadastrada com sucesso!');
    state.pessoasSubView = 'list';
    renderApp();
  } else if (state.pessoasSubView === 'edit') {
    const p = data.pessoas.find(person => person.id === state.selectedPessoaId);
    if (!p) return;

    const nomeVal = document.getElementById('edit-nome').value.trim();
    const sobrenomeVal = document.getElementById('edit-sobrenome').value.trim();
    const enderecoVal = document.getElementById('edit-endereco').value.trim();
    const bairroVal = document.getElementById('edit-bairro').value.trim();
    const cepVal = document.getElementById('edit-cep').value.trim();
    const telVal = document.getElementById('edit-telefone').value.trim();
    const novoPapelVal = document.getElementById('edit-papel').value;
    const justVal = document.getElementById('edit-justificativa') ? document.getElementById('edit-justificativa').value.trim() : '';
    const sexoVal = document.getElementById('edit-sexo').value;

    if (!nomeVal) {
      alert('Por favor, insira o nome.');
      return;
    }

    p.nome = nomeVal;
    p.sobrenome = sobrenomeVal;
    p.endereco = enderecoVal;
    p.bairro = bairroVal;
    p.cep = cepVal;
    p.telefone = telVal;
    p.sexo = sexoVal;
    addToSyncQueue('pessoas', p);

    if (novoPapelVal !== p.papelAtual) {
      if (!justVal) {
        alert('Por favor, escreva uma justificativa para a mudança de papel.');
        return;
      }

      const hoje = new Date().toISOString().split('T')[0];

      const historicoAtivo = data.historicoPapeis.find(h => h.pessoaId === p.id && h.dataFim === null);
      if (historicoAtivo) {
        historicoAtivo.dataFim = hoje;
        addToSyncQueue('historicoPapeis', historicoAtivo);
      }

      const newHistory = {
        id: Date.now(),
        pessoaId: p.id,
        papel: novoPapelVal,
        dataInicio: hoje,
        dataFim: null,
        nota: justVal
      };
      data.historicoPapeis.push(newHistory);
      addToSyncQueue('historicoPapeis', newHistory);

      p.papelAtual = novoPapelVal;
    }

    // Processar cargo de diretoria se o seletor existir (para Presidente editando outro vicentino)
    const cargoSelect = document.getElementById('edit-cargo');
    if (cargoSelect) {
      const novoCargoVal = cargoSelect.value || null;
      if (novoCargoVal !== p.cargo) {
        const antigoCargo = p.cargo;

        // Se outro membro já tinha esse cargo, remove dele
        if (novoCargoVal) {
          data.pessoas.forEach(other => {
            if (other.cargo === novoCargoVal && other.id !== p.id) {
              other.cargo = null;
              addToSyncQueue('pessoas', other);
            }
          });
        }

        p.cargo = novoCargoVal;

        // Registrar alteração histórica de cargo
        const hoje = new Date().toISOString().split('T')[0];

        const activeHistory = data.historicoPapeis.find(h => h.pessoaId === p.id && h.dataFim === null);
        if (activeHistory) {
          activeHistory.dataFim = hoje;
          addToSyncQueue('historicoPapeis', activeHistory);
        }

        const verb = p.sexo === 'F' ? 'Nomeada' : 'Nomeado';
        const verbRem = p.sexo === 'F' ? 'Removida' : 'Removido';
        const cargoHistEntry = {
          id: Date.now() + 3,
          pessoaId: p.id,
          papel: p.papelAtual,
          dataInicio: hoje,
          dataFim: null,
          nota: novoCargoVal ? `${verb} ${formatCargoAndGenero(novoCargoVal, p.sexo)} pelo Presidente.` : `${verbRem} do cargo de diretoria (${formatCargoAndGenero(antigoCargo, p.sexo)}).`
        };
        data.historicoPapeis.push(cargoHistEntry);
        addToSyncQueue('historicoPapeis', cargoHistEntry);
      }
    }

    saveData();
    alert('Dados atualizados com sucesso!');
    state.pessoasSubView = 'list';
    renderApp();
  } else if (state.pessoasSubView === 'eleger') {
    const selectedRadio = document.querySelector('input[name="novo-presidente"]:checked');
    if (!selectedRadio) {
      alert('Por favor, selecione um confrade/consócia para ser o novo Presidente.');
      return;
    }
    const novoPresId = parseInt(selectedRadio.value);
    const novoPres = data.pessoas.find(p => p.id === novoPresId);
    if (!novoPres) return;

    const confirmacao = confirm(`Confirmar a eleição de ${novoPres.nome} ${novoPres.sobrenome || ''} como novo Presidente? Todos os outros cargos de diretoria (Vice, Secretário e Tesoureiro) serão anulados.`);
    if (!confirmacao) return;

    const hoje = new Date().toISOString().split('T')[0];

    // Limpar cargos anteriores e registrar histórico
    data.pessoas.forEach(p => {
      if (p.cargo) {
        const antigoCargo = p.cargo;
        p.cargo = null;
        addToSyncQueue('pessoas', p);

        const activeHistory = data.historicoPapeis.find(h => h.pessoaId === p.id && h.dataFim === null);
        if (activeHistory) {
          activeHistory.dataFim = hoje;
          addToSyncQueue('historicoPapeis', activeHistory);
        }

        const newHistory = {
          id: Date.now() + Math.random(),
          pessoaId: p.id,
          papel: p.papelAtual,
          dataInicio: hoje,
          dataFim: null,
          nota: antigoCargo === 'presidente' ? 'Mandato de Presidente concluído.' : `Cargo de ${formatCargoAndGenero(antigoCargo, p.sexo)} destituído devido a nova eleição presidencial.`
        };
        data.historicoPapeis.push(newHistory);
        addToSyncQueue('historicoPapeis', newHistory);
      }
    });

    // Definir novo presidente
    novoPres.cargo = 'presidente';
    addToSyncQueue('pessoas', novoPres);

    const activeHistory = data.historicoPapeis.find(h => h.pessoaId === novoPres.id && h.dataFim === null);
    if (activeHistory) {
      activeHistory.dataFim = hoje;
      addToSyncQueue('historicoPapeis', activeHistory);
    }
    const newPresHistory = {
      id: Date.now() + Math.random(),
      pessoaId: novoPres.id,
      papel: novoPres.papelAtual,
      dataInicio: hoje,
      dataFim: null,
      nota: novoPres.sexo === 'F' ? 'Eleita Presidente da Conferência para um novo mandato.' : 'Eleito Presidente da Conferência para um novo mandato.'
    };
    data.historicoPapeis.push(newPresHistory);
    addToSyncQueue('historicoPapeis', newPresHistory);

    // Recarregar sessões se necessário
    if (state.currentUserId === novoPres.id) {
      state.currentUser = novoPres;
    } else {
      const activeUser = data.pessoas.find(p => p.id === state.currentUserId);
      if (activeUser) {
        state.currentUser = activeUser;
      }
    }

    saveData();
    alert(`Eleição concluída! ${novoPres.nome} é o novo Presidente da conferência.`);
    state.pessoasSubView = 'list';
    renderApp();
  }
}

function handlePessoasPrev() {
  if (state.pessoasSubView === 'list') {
    state.currentView = 'flow';
    state.currentStep = 0;
  } else {
    state.pessoasSubView = 'list';
  }
  renderApp();
}

function renderPessoasView() {
  const stepIndicator = document.querySelector('.flow-step-indicator');
  if (stepIndicator) stepIndicator.style.display = 'none';

  btnPrev.style.display = 'block';
  if (state.pessoasSubView === 'list') {
    btnPrev.textContent = 'Voltar para Início';
    btnNext.textContent = 'Cadastrar Pessoa';
  } else if (state.pessoasSubView === 'eleger') {
    btnPrev.textContent = 'Cancelar';
    btnNext.textContent = 'Confirmar Eleição';
  } else {
    btnPrev.textContent = 'Voltar para Listagem';
    btnNext.textContent = 'Salvar';
  }

  formContainer.innerHTML = '';

  if (state.pessoasSubView === 'list') {
    flowTitle.textContent = 'Gerenciar Pessoas';
    flowDesc.textContent = 'Cadastre pessoas e gerencie seus papéis (Confrade/Consócia, Assistido, Benfeitor, Visitante).';

    const toolsWrapper = document.createElement('div');
    toolsWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;';

    // Buscar Presidente atual para exibir no Card de Eleição
    const president = data.pessoas.find(p => p.cargo === 'presidente');
    const presidentName = president ? `${president.nome} ${president.sobrenome || ''}` : 'Nenhum';

    // Regra: Transmissão presencial. Somente o presidente atual pode passar o cargo.
    const isCurrentUserPresident = state.currentUser && state.currentUser.cargo === 'presidente';

    toolsWrapper.innerHTML = `
    <!-- Card de Informações de Diretoria e Eleição -->
    <div style="background: var(--primary-light); padding: 18px; border-radius: var(--border-radius-md); border: 2px solid var(--primary); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
      <div>
        <h4 style="margin: 0; font-size: 0.95rem; color: var(--primary); font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">👑 Presidente Atual</h4>
        <span style="font-weight: 700; font-size: 1.2rem; color: var(--text-main);">${presidentName}</span>
      </div>
      ${isCurrentUserPresident ? `
        <button type="button" class="btn btn-primary" id="btn-eleger-presidente" style="width: auto; min-height: 42px; padding: 8px 16px; font-size: 0.95rem; margin: 0; display: flex; align-items: center; gap: 8px;">
          🗳️ Transmitir Cargo
        </button>
      ` : `
        <span style="font-size: 0.95rem; color: var(--text-muted); font-style: italic; font-weight: 600; max-width: 250px; text-align: right;">
          Somente o Presidente pode transmitir o cargo em eleição presencial.
        </span>
      `}
    </div>

    <input type="text" id="pessoas-search" placeholder="🔍 Buscar por nome..." value="${state.pessoasSearchQuery}" style="padding: 14px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; box-shadow: var(--shadow-sm);">
    
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="filtro-papel" style="font-weight: 700; font-size: 1rem; color: var(--text-muted);">Filtrar por Papel</label>
      <select id="filtro-papel" style="padding: 12px; font-size: 1.15rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer; background-color: var(--surface); color: var(--text-main); font-family: inherit; box-shadow: var(--shadow-sm);">
        <option value="all" ${state.pessoasFilterRole === 'all' ? 'selected' : ''}>Todos os Papéis</option>
        <option value="vicentino" ${state.pessoasFilterRole === 'vicentino' ? 'selected' : ''}>Confrades e Consócias</option>
        <option value="assistido" ${state.pessoasFilterRole === 'assistido' ? 'selected' : ''}>Assistidos (Famílias)</option>
        <option value="benfeitor" ${state.pessoasFilterRole === 'benfeitor' ? 'selected' : ''}>Benfeitores</option>
        <option value="visitante" ${state.pessoasFilterRole === 'visitante' ? 'selected' : ''}>Visitantes</option>
      </select>
    </div>
    
    <div id="list-items-container" style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;"></div>
  `;

    formContainer.appendChild(toolsWrapper);

    // Adicionar evento para o botão de eleição se ele existir
    const elegerBtn = document.getElementById('btn-eleger-presidente');
    if (elegerBtn) {
      elegerBtn.addEventListener('click', () => {
        state.pessoasSubView = 'eleger';
        renderApp();
      });
    }

    renderPessoasListItems();

  } else if (state.pessoasSubView === 'create') {
    flowTitle.textContent = 'Cadastrar Nova Pessoa';
    flowDesc.textContent = 'Insira os dados básicos da pessoa e escolha o papel inicial.';

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 18px;';
    form.innerHTML = `
    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px;">
        <label for="cad-nome" style="font-weight: 700; font-size: 1.1rem;">Nome</label>
        <input type="text" id="cad-nome" placeholder="Ex: Maria" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px;">
        <label for="cad-sobrenome" style="font-weight: 700; font-size: 1.1rem;">Sobrenome</label>
        <input type="text" id="cad-sobrenome" placeholder="Ex: de Souza Oliveira" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="cad-endereco" style="font-weight: 700; font-size: 1.1rem;">Endereço</label>
      <input type="text" id="cad-endereco" placeholder="Ex: Rua das Palmeiras, 450 - Ap 21" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
    </div>

    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 150px;">
        <label for="cad-bairro" style="font-weight: 700; font-size: 1.1rem;">Bairro</label>
        <input type="text" id="cad-bairro" placeholder="Ex: Centro" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 150px;">
        <label for="cad-cep" style="font-weight: 700; font-size: 1.1rem;">CEP</label>
        <input type="text" id="cad-cep" placeholder="Ex: 01001-000" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="cad-telefone" style="font-weight: 700; font-size: 1.1rem;">Telefone de Contato</label>
      <input type="tel" id="cad-telefone" placeholder="Ex: (11) 98888-7777" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="cad-sexo" style="font-weight: 700; font-size: 1.1rem;">Gênero / Sexo</label>
      <select id="cad-sexo" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer; background: var(--surface); color: var(--text-main); font-family: inherit;">
        <option value="M">Masculino (Confrade se Vicentino)</option>
        <option value="F">Feminino (Consócia se Vicentina)</option>
      </select>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="cad-papel" style="font-weight: 700; font-size: 1.1rem;">Papel Inicial</label>
      <select id="cad-papel" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer; background: var(--surface); color: var(--text-main); font-family: inherit;">
        <option value="assistido">Assistido (Família)</option>
        <option value="vicentino">Vicentino (Membro)</option>
        <option value="benfeitor">Benfeitor</option>
        <option value="visitante">Visitante</option>
      </select>
    </div>
  `;

    formContainer.appendChild(form);

  } else if (state.pessoasSubView === 'edit') {
    const p = data.pessoas.find(person => person.id === state.selectedPessoaId);
    if (!p) {
      state.pessoasSubView = 'list';
      renderApp();
      return;
    }

    // Verificar segurança de acesso de escrita
    const canEdit = (state.currentUser && state.currentUser.cargo === 'presidente') ||
      (state.currentUser && p.id === state.currentUser.id) ||
      (p.papelAtual === 'assistido');

    if (!canEdit) {
      alert('Você não tem permissão para editar esta pessoa.');
      state.pessoasSubView = 'list';
      renderApp();
      return;
    }

    flowTitle.textContent = `Editar: ${p.nome} ${p.sobrenome || ''}`;
    flowDesc.textContent = 'Atualize as informações de contato ou mude o papel histórico da pessoa.';

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

    const histList = data.historicoPapeis
      .filter(h => h.pessoaId === p.id)
      .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));

    let timelineHtml = '';
    histList.forEach(h => {
      const dataFimTexto = h.dataFim ? `até ${h.dataFim}` : '(Atual)';
      timelineHtml += `
      <div class="timeline-item">
        <div class="timeline-date">${h.dataInicio} ${dataFimTexto}</div>
        <div class="timeline-title" style="text-transform: capitalize;">${h.papel}</div>
        <div class="timeline-desc">"${h.nota}"</div>
      </div>
    `;
    });

    const isPapelEditable = (state.currentUser && state.currentUser.cargo === 'presidente') ||
      (p.papelAtual === 'assistido');

    // Dropdown de cargo se o Presidente estiver editando outro Vicentino
    let nominationHtml = '';
    if (state.currentUser && state.currentUser.cargo === 'presidente' && p.papelAtual === 'vicentino' && p.id !== state.currentUser.id) {
      const optSec = p.sexo === 'F' ? 'Secretária' : 'Secretário';
      const optTes = p.sexo === 'F' ? 'Tesoureira' : 'Tesoureiro';
      const optMembro = p.sexo === 'F' ? 'Consócia Comum' : 'Confrade Comum';
      nominationHtml = `
      <div style="background: var(--primary-light); padding: 18px; border-radius: var(--border-radius-md); display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--surface-border); margin-top: 16px;">
        <h3 style="font-size: 1.25rem; color: var(--primary); font-family: 'Outfit', sans-serif;">Nomear Cargo de Diretoria</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="edit-cargo" style="font-weight: 600; font-size: 1rem; color: var(--text-main);">Cargo</label>
          <select id="edit-cargo" style="padding: 10px; font-size: 1.05rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); cursor: pointer; width: 100%; font-family: inherit;">
            <option value="" ${!p.cargo ? 'selected' : ''}>Nenhuma / Nenhum (${optMembro})</option>
            <option value="vice_presidente" ${p.cargo === 'vice_presidente' ? 'selected' : ''}>Vice-Presidente</option>
            <option value="secretario" ${p.cargo === 'secretario' ? 'selected' : ''}>${optSec}</option>
            <option value="tesoureiro" ${p.cargo === 'tesoureiro' ? 'selected' : ''}>${optTes}</option>
          </select>
        </div>
      </div>
    `;
    }

    form.innerHTML = `
    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px;">
        <label for="edit-nome" style="font-weight: 700; font-size: 1.1rem;">Nome</label>
        <input type="text" id="edit-nome" value="${p.nome || ''}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px;">
        <label for="edit-sobrenome" style="font-weight: 700; font-size: 1.1rem;">Sobrenome</label>
        <input type="text" id="edit-sobrenome" value="${p.sobrenome || ''}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="edit-endereco" style="font-weight: 700; font-size: 1.1rem;">Endereço</label>
      <input type="text" id="edit-endereco" value="${p.endereco || ''}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
    </div>

    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 150px;">
        <label for="edit-bairro" style="font-weight: 700; font-size: 1.1rem;">Bairro</label>
        <input type="text" id="edit-bairro" value="${p.bairro || ''}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 150px;">
        <label for="edit-cep" style="font-weight: 700; font-size: 1.1rem;">CEP</label>
        <input type="text" id="edit-cep" value="${p.cep || ''}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="edit-telefone" style="font-weight: 700; font-size: 1.1rem;">Telefone de Contato</label>
      <input type="tel" id="edit-telefone" value="${p.telefone || ''}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label for="edit-sexo" style="font-weight: 700; font-size: 1.1rem;">Gênero / Sexo</label>
      <select id="edit-sexo" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer; background: var(--surface); color: var(--text-main); font-family: inherit;">
        <option value="M" ${p.sexo === 'M' ? 'selected' : ''}>Masculino (Confrade se Vicentino)</option>
        <option value="F" ${p.sexo === 'F' ? 'selected' : ''}>Feminino (Consócia se Vicentina)</option>
      </select>
    </div>

    <div style="background: var(--primary-light); padding: 18px; border-radius: var(--border-radius-md); display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--surface-border);">
      <h3 style="font-size: 1.2rem; color: var(--primary); font-family: 'Outfit', sans-serif;">Alterar Papel / Promoção</h3>
      
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="edit-papel" style="font-weight: 600; font-size: 1rem;">Papel Ativo</label>
        <select id="edit-papel" ${isPapelEditable ? '' : 'disabled style="opacity: 0.7; cursor: not-allowed;"'} style="padding: 10px; font-size: 1.05rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); cursor: pointer; width: 100%; font-family: inherit;">
          <option value="assistido" ${p.papelAtual === 'assistido' ? 'selected' : ''}>Assistido</option>
          <option value="vicentino" ${p.papelAtual === 'vicentino' ? 'selected' : ''}>Vicentino</option>
          <option value="benfeitor" ${p.papelAtual === 'benfeitor' ? 'selected' : ''}>Benfeitor</option>
          <option value="visitante" ${p.papelAtual === 'visitante' ? 'selected' : ''}>Visitante</option>
        </select>
      </div>

      <div id="justificativa-wrapper" style="display: none; flex-direction: column; gap: 8px;">
        <label for="edit-justificativa" style="font-weight: 600; font-size: 1rem; color: var(--danger);">Justificativa da Mudança (Obrigatório)</label>
        <textarea id="edit-justificativa" rows="2" placeholder="Ex: Atingiu autonomia financeira e foi convidado para a conferência." style="padding: 10px; font-size: 1.05rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); font-family: inherit; width: 100%;"></textarea>
      </div>
    </div>

    ${nominationHtml}

    <div>
      <h3 style="font-size: 1.25rem; font-family: 'Outfit', sans-serif; border-bottom: 2px solid var(--surface-border); padding-bottom: 6px; margin-top: 10px;">Linha do Tempo de Papéis</h3>
      <div class="timeline">
        ${timelineHtml}
      </div>
    </div>
  `;

    formContainer.appendChild(form);

    const selectPapel = document.getElementById('edit-papel');
    const justWrapper = document.getElementById('justificativa-wrapper');
    selectPapel.addEventListener('change', (e) => {
      if (e.target.value !== p.papelAtual) {
        justWrapper.style.display = 'flex';
      } else {
        justWrapper.style.display = 'none';
      }
    });

  } else if (state.pessoasSubView === 'eleger') {
    flowTitle.textContent = 'Eleger Novo Presidente';
    flowDesc.textContent = 'Selecione o novo Presidente para governar a conferência. A confirmação anulará a diretoria atual.';

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 18px;';

    const vicentinos = data.pessoas.filter(p => p.papelAtual === 'vicentino');

    if (vicentinos.length === 0) {
      form.innerHTML = '<p style="color: var(--danger); font-weight: bold; text-align: center; padding: 24px;">Nenhum vicentino cadastrado para ser eleito.</p>';
    } else {
      vicentinos.forEach(vic => {
        const isPres = vic.cargo === 'presidente';
        const label = document.createElement('label');
        label.style.cssText = `
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 18px;
        border: 2px solid ${isPres ? 'var(--primary)' : 'var(--surface-border)'};
        border-radius: var(--border-radius-md);
        background: ${isPres ? 'var(--primary-light)' : 'transparent'};
        cursor: pointer;
        min-height: var(--touch-target);
        transition: var(--transition-smooth);
      `;

        label.innerHTML = `
        <input type="radio" name="novo-presidente" value="${vic.id}" ${isPres ? 'checked' : ''} style="width: 24px; height: 24px; cursor: pointer;">
        <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${vic.nome} ${vic.sobrenome || ''} ${vic.cargo ? `(${formatCargo(vic.cargo)})` : ''}</span>
      `;

        const radio = label.querySelector('input');
        radio.addEventListener('change', () => {
          document.querySelectorAll('input[name="novo-presidente"]').forEach(r => {
            const lbl = r.closest('label');
            lbl.style.borderColor = 'var(--surface-border)';
            lbl.style.background = 'transparent';
          });
          label.style.borderColor = 'var(--primary)';
          label.style.background = 'var(--primary-light)';
        });

        form.appendChild(label);
      });
    }

    formContainer.appendChild(form);
  }
}

// Renderiza os cartões de pessoas baseado em filtros e busca
function renderPessoasListItems() {
  const listContainer = document.getElementById('list-items-container');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  let filtered = data.pessoas;

  if (state.pessoasFilterRole !== 'all') {
    filtered = filtered.filter(p => p.papelAtual === state.pessoasFilterRole);
  }

  if (state.pessoasSearchQuery.trim()) {
    const query = state.pessoasSearchQuery.toLowerCase();
    filtered = filtered.filter(p => `${p.nome} ${p.sobrenome || ''}`.toLowerCase().includes(query));
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma pessoa encontrada com os filtros aplicados.</p>';
    return;
  }

  filtered.forEach(p => {
    // Verificar se o usuário ativo pode editar esta pessoa
    const canEdit = (state.currentUser && state.currentUser.cargo === 'presidente') ||
      (state.currentUser && p.id === state.currentUser.id) ||
      (p.papelAtual === 'assistido');

    const cargoText = p.cargo ? formatCargoAndGenero(p.cargo, p.sexo) : '';
    const cargoBadge = cargoText ? `<span class="badge" style="background-color: var(--primary); color: white; font-size: 0.8rem; padding: 2px 6px;">${cargoText}</span>` : '';

    let papelLabel = p.papelAtual;
    if (p.papelAtual === 'vicentino') {
      papelLabel = p.sexo === 'F' ? 'Consócia' : 'Confrade';
    } else if (p.papelAtual === 'assistido') {
      papelLabel = 'Assistido';
    } else if (p.papelAtual === 'benfeitor') {
      papelLabel = 'Benfeitor';
    } else if (p.papelAtual === 'visitante') {
      papelLabel = 'Visitante';
    }

    const card = document.createElement('div');
    card.className = 'pessoa-card';
    card.innerHTML = `
    <div class="pessoa-info">
      <span class="pessoa-name">${p.nome} ${p.sobrenome || ''} ${cargoBadge}</span>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
        <span class="badge badge-${p.papelAtual}">${papelLabel}</span>
        <span class="pessoa-phone">${p.telefone || 'Sem telefone'}</span>
        ${p.bairro ? `<span style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">📍 ${p.bairro}</span>` : ''}
      </div>
    </div>
    <button type="button" class="btn btn-secondary btn-edit-pessoa" data-id="${p.id}" ${canEdit ? '' : 'disabled style="opacity: 0.5; cursor: not-allowed;"'} style="width: auto; min-height: auto; padding: 8px 16px; font-size: 0.95rem;">Editar</button>
  `;

    listContainer.appendChild(card);
  });

  // Vincular eventos locais após renderizar a lista

  const searchInput = document.getElementById('pessoas-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.pessoasSearchQuery = e.target.value;
      renderPessoasListItems();
    });
  }

  const filterSelect = document.getElementById('filtro-papel');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      state.pessoasFilterRole = e.target.value;
      renderPessoasListItems();
    });
  }

  document.querySelectorAll('.btn-edit-pessoa').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.selectedPessoaId = parseInt(e.target.getAttribute('data-id'));
      state.pessoasSubView = 'edit';
      renderApp();
    });
  });
}

// ==========================================================================
// FUNÇÕES DE SINCRONIZAÇÃO E REDE (Google Sheets Integration V0.3)
// ==========================================================================

// Adiciona um item na fila de sincronização
function addToSyncQueue(type, item) {
  // Remove duplicados antes de adicionar o item atualizado
  state.syncQueue[type] = state.syncQueue[type].filter(existing => Number(existing.id) !== Number(item.id));
  state.syncQueue[type].push(item);
  saveData();
  updateSyncStatusUI();
}

// Atualiza o indicador de rede na tela
function updateNetworkStatus() {
  state.isOnline = navigator.onLine;
  const badge = document.getElementById('network-badge');
  if (badge) {
    if (state.isOnline) {
      badge.textContent = 'Online';
      badge.style.backgroundColor = 'var(--success)';
    } else {
      badge.textContent = 'Offline';
      badge.style.backgroundColor = 'var(--danger)';
    }
  }
}

// Retorna se existem itens pendentes de sincronização
function getPendingCount() {
  return state.syncQueue.pessoas.length +
    state.syncQueue.historicoPapeis.length +
    state.syncQueue.visitas.length +
    state.syncQueue.metas.length +
    (state.syncQueue.escalas ? state.syncQueue.escalas.length : 0);
}

// Atualiza a mensagem e o indicador visual da sincronização
function updateSyncStatusUI() {
  const msg = document.getElementById('sync-status-msg');
  const badgeContainer = document.querySelector('.status-indicator-container');

  if (!state.webAppUrl) {
    if (msg) msg.textContent = 'Aguardando URL do Apps Script...';
    return;
  }

  const count = getPendingCount();
  if (msg) {
    if (count > 0) {
      msg.textContent = `${count} alteração(ões) pendente(s) localmente`;
      msg.style.color = 'var(--danger)';
    } else {
      msg.textContent = 'Tudo sincronizado!';
      msg.style.color = 'var(--success)';
    }
  }

  // Adicionar ou remover um badge de itens pendentes no cabeçalho
  let pendingBadge = document.getElementById('pending-sync-badge');
  if (count > 0) {
    if (!pendingBadge && badgeContainer) {
      pendingBadge = document.createElement('span');
      pendingBadge.id = 'pending-sync-badge';
      pendingBadge.className = 'step-badge';
      pendingBadge.style.cssText = 'background-color: var(--danger); color: white; margin-left: 8px; font-weight: bold;';
      badgeContainer.appendChild(pendingBadge);
    }
    if (pendingBadge) {
      pendingBadge.textContent = `${count} Pendente(s)`;
    }
  } else {
    if (pendingBadge) {
      pendingBadge.remove();
    }
  }
}

// Executa a Sincronização Completa (POST e depois GET)
function runDataSync(isSilent = false) {
  if (!state.webAppUrl) {
    if (!isSilent) alert('Por favor, configure a URL do Apps Script nas configurações primeiro!');
    return;
  }

  if (!navigator.onLine) {
    if (!isSilent) alert('Você está offline. Conecte-se à internet para sincronizar.');
    return;
  }

  const isPresident = state.currentUser && state.currentUser.cargo === 'presidente';
  const getUrl = state.webAppUrl.includes('?') ? `${state.webAppUrl}&api=true` : `${state.webAppUrl}?api=true`;

  const syncBtn = document.getElementById('btn-sync-now');
  const msg = document.getElementById('sync-status-msg');

  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = '🔄 Sincronizando...';
  }

  // Se não for Presidente, faz apenas a leitura (Pull) dos dados da planilha para atualizar o cache local
  if (!isPresident) {
    if (msg) msg.textContent = 'Atualizando banco de dados local...';

    fetch(getUrl, {
      method: 'GET',
      mode: 'cors'
    })
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          const serverData = result.data;

          if (serverData.pessoas && serverData.pessoas.length > 0) {
            data.pessoas = serverData.pessoas;
          }
          if (serverData.historico_papeis && serverData.historico_papeis.length > 0) {
            data.historicoPapeis = serverData.historico_papeis;
          }
          if (serverData.visitas && serverData.visitas.length > 0) {
            data.visitas = serverData.visitas.map(v => {
              if (typeof v.vicentinos === 'string') {
                v.vicentinos = v.vicentinos.split(',').map(Number);
              }
              return v;
            });
          }
          if (serverData.metas && serverData.metas.length > 0) {
            data.metas = serverData.metas;
          }
          if (serverData.escalas && serverData.escalas.length > 0) {
            data.escalas = serverData.escalas.map(e => {
              if (typeof e.vicentinos === 'string') {
                e.vicentinos = e.vicentinos.split(',').map(Number);
              }
              return e;
            });
          }

          saveData();
          renderApp();
          updateSyncStatusUI();
          if (msg) msg.textContent = 'Dados atualizados com sucesso!';
          if (!isSilent) alert('Atualização concluída com sucesso!');
        } else {
          throw new Error(result.error || 'Erro ao obter dados da planilha.');
        }
      })
      .catch(error => {
        console.error(error);
        if (msg) {
          msg.textContent = 'Falha ao atualizar dados.';
          msg.style.color = 'var(--danger)';
        }
        if (!isSilent) alert('Falha ao obter atualizações: ' + error.message);
      })
      .finally(() => {
        if (syncBtn) {
          syncBtn.disabled = false;
          syncBtn.textContent = '🔄 Sincronizar Agora';
        }
        updateSyncStatusUI();
      });
    return;
  }

  // A partir daqui, fluxo completo de Sincronização (Presidente)
  if (msg) msg.textContent = 'Verificando dados da planilha...';

  // 1. Verificar primeiro se a planilha está vazia (GET)
  fetch(getUrl, {
    method: 'GET',
    mode: 'cors'
  })
    .then(response => response.json())
    .then(result => {
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Erro ao obter dados da planilha.');
      }

      const serverData = result.data;
      const serverPessoasCount = serverData.pessoas ? serverData.pessoas.length : 0;
      const localPessoasCount = data.pessoas.length;

      // Conflito / Inicialização: se a planilha está vazia de pessoas mas temos pessoas locais,
      // nós enfileiramos TODOS os dados locais atuais no syncQueue para que eles subam para a planilha vazia
      // em vez de o GET final apagar nossos dados locais.
      if (serverPessoasCount === 0 && localPessoasCount > 0 && getPendingCount() === 0) {
        if (msg) msg.textContent = 'Populando planilha em branco com seus dados locais...';

        data.pessoas.forEach(p => {
          state.syncQueue.pessoas.push(p);
        });
        data.historicoPapeis.forEach(h => {
          state.syncQueue.historicoPapeis.push(h);
        });
        data.visitas.forEach(v => {
          const visitToSync = { ...v, vicentinos: v.vicentinos.join(',') };
          state.syncQueue.visitas.push(visitToSync);
        });
        data.metas.forEach(m => {
          state.syncQueue.metas.push(m);
        });
        data.escalas.forEach(e => {
          const escalaToSync = { ...e, vicentinos: e.vicentinos.join(',') };
          state.syncQueue.escalas.push(escalaToSync);
        });
        saveData();
        updateSyncStatusUI();
      }

      // 2. Enviar fila local se houver pendências (POST)
      const hasPendencies = getPendingCount() > 0;
      let postPromise = Promise.resolve();

      if (hasPendencies) {
        if (msg) msg.textContent = 'Enviando dados locais para a planilha...';

        // Adicionar senderId ao payload do POST para o Apps Script validar segurança
        const payload = {
          ...state.syncQueue,
          senderId: state.currentUserId
        };

        postPromise = fetch(state.webAppUrl, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: JSON.stringify(payload)
        })
          .then(response => response.json())
          .then(postResult => {
            if (postResult.success) {
              // Limpa a fila sincronizada com sucesso
              state.syncQueue = {
                pessoas: [],
                historicoPapeis: [],
                visitas: [],
                metas: [],
                escalas: []
              };
              saveData();
              updateSyncStatusUI();
            } else {
              throw new Error(postResult.error || 'Erro desconhecido no envio.');
            }
          });
      }
      return postPromise;
    })
    // 3. Baixar dados consolidados finais da planilha e atualizar o localStorage (GET)
    .then(() => {
      if (msg) msg.textContent = 'Atualizando banco de dados local...';
      return fetch(getUrl, {
        method: 'GET',
        mode: 'cors'
      });
    })
    .then(response => response.json())
    .then(result => {
      if (result.success && result.data) {
        const serverData = result.data;

        // Só atualiza localmente se de fato houver dados na planilha
        if (serverData.pessoas && serverData.pessoas.length > 0) {
          data.pessoas = serverData.pessoas;
        }
        if (serverData.historico_papeis && serverData.historico_papeis.length > 0) {
          data.historicoPapeis = serverData.historico_papeis;
        }
        if (serverData.visitas && serverData.visitas.length > 0) {
          data.visitas = serverData.visitas.map(v => {
            if (typeof v.vicentinos === 'string') {
              v.vicentinos = v.vicentinos.split(',').map(Number);
            }
            return v;
          });
        }
        if (serverData.metas && serverData.metas.length > 0) {
          data.metas = serverData.metas;
        }
        if (serverData.escalas && serverData.escalas.length > 0) {
          data.escalas = serverData.escalas.map(e => {
            if (typeof e.vicentinos === 'string') {
              e.vicentinos = e.vicentinos.split(',').map(Number);
            }
            return e;
          });
        }

        saveData();
        renderApp();
        updateSyncStatusUI();
        if (msg) msg.textContent = 'Sincronizado com o Google Sheets!';
        if (!isSilent) alert('Sincronização concluída com sucesso!');
      } else {
        throw new Error(result.error || 'Erro ao obter dados consolidados.');
      }
    })
    .catch(error => {
      console.error(error);
      if (msg) {
        msg.textContent = 'Falha na sincronização.';
        msg.style.color = 'var(--danger)';
      }
      if (!isSilent) alert('Falha na sincronização: ' + error.message);
    })
    .finally(() => {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sincronizar Agora';
      }
      updateSyncStatusUI();
    });
}
