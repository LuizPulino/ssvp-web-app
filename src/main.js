/**
 * SSVP Web App - Gestão de Conferência & Visitas (Versão 0.1.4)
 * Cadeias de Metas, Acompanhamento, Validações por Voz e Persistência Local.
 */

// Estado Global da Aplicação
const state = {
  currentView: 'flow',       // 'flow' (fluxo de visita) | 'pessoas' (painel de pessoas)
  pessoasSubView: 'list',    // 'list' | 'create' | 'edit'
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
  goalValidations: {}        // Guardar as respostas de validação das metas (metaId -> { status, justificativa })
};

// Banco de Dados em Memória
const data = {
  pessoas: [],
  historicoPapeis: [],
  visitas: [],
  metas: []
};

// Chaves do LocalStorage
const KEYS = {
  PESSOAS: 'ssvp_pessoas',
  HISTORICO: 'ssvp_historico_papeis',
  VISITAS: 'ssvp_visitas',
  METAS: 'ssvp_metas'
};

// Elementos do DOM
const stepLabel = document.getElementById('step-label');
const stepProgress = document.getElementById('step-progress');
const flowTitle = document.getElementById('flow-content-title');
const flowDesc = document.getElementById('flow-content-desc');
const formContainer = document.getElementById('dynamic-form-container');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderApp();
  setupEventListeners();
});

// Carregar dados ou gerar padrões iniciais
function loadData() {
  const localPessoas = localStorage.getItem(KEYS.PESSOAS);
  const localHistorico = localStorage.getItem(KEYS.HISTORICO);
  const localVisitas = localStorage.getItem(KEYS.VISITAS);
  const localMetas = localStorage.getItem(KEYS.METAS);

  if (localPessoas) {
    data.pessoas = JSON.parse(localPessoas);
  } else {
    data.pessoas = [
      { id: 1, nome: 'Antônio Silva', telefone: '(11) 98888-1111', papelAtual: 'vicentino', dataCadastro: '2025-01-10' },
      { id: 2, nome: 'Maria Souza', telefone: '(11) 98888-2222', papelAtual: 'vicentino', dataCadastro: '2025-02-15' },
      { id: 3, nome: 'José Carlos', telefone: '(11) 98888-3333', papelAtual: 'vicentino', dataCadastro: '2025-03-20' },
      { id: 101, nome: 'Família Silva Oliveira', telefone: '(11) 97777-1010', papelAtual: 'assistido', dataCadastro: '2025-01-20' },
      { id: 102, nome: 'Família Nascimento Santos', telefone: '(11) 97777-2020', papelAtual: 'assistido', dataCadastro: '2025-02-10' },
      { id: 103, nome: 'Família Ferreira Lima', telefone: '(11) 97777-3030', papelAtual: 'assistido', dataCadastro: '2025-03-05' }
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
      nota: 'Cadastro inicial de referência.'
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
    // Dados iniciais com uma cadeia de metas mockada para a "Família Silva Oliveira" (ID: 101)
    data.metas = [
      { id: 10, familiaId: 101, meta: 'Marcar consulta com Clínico Geral', prazo: '2025-02-10', status: 'cumprida', metaDependenciaId: null, justificativa: 'Consulta realizada no dia 05/02 com sucesso.' },
      { id: 11, familiaId: 101, meta: 'Fazer exames de sangue solicitados', prazo: '2025-03-01', status: 'nao_cumprida', metaDependenciaId: 10, justificativa: 'Houve greve de funcionários no posto de coleta municipal.' },
      { id: 12, familiaId: 101, meta: 'Retornar ao Clínico com os resultados dos exames', prazo: '2025-03-20', status: 'bloqueada', metaDependenciaId: 11, justificativa: '' },
      { id: 13, familiaId: 101, meta: 'Comprar remédios prescritos', prazo: '2025-04-10', status: 'bloqueada', metaDependenciaId: 12, justificativa: '' },
      { id: 14, familiaId: 101, meta: 'Fazer matrícula no curso profissionalizante de Culinária', prazo: '2026-07-15', status: 'pendente', metaDependenciaId: null, justificativa: '' }
    ];
    saveData();
  }
}

// Salvar no LocalStorage
function saveData() {
  localStorage.setItem(KEYS.PESSOAS, JSON.stringify(data.pessoas));
  localStorage.setItem(KEYS.HISTORICO, JSON.stringify(data.historicoPapeis));
  localStorage.setItem(KEYS.VISITAS, JSON.stringify(data.visitas));
  localStorage.setItem(KEYS.METAS, JSON.stringify(data.metas));
}

// Direcionamento Centralizado de Renderização
function renderApp() {
  if (state.currentView === 'pessoas') {
    renderPessoasView();
  } else {
    renderFlowView();
  }
}

// Eventos de Botões do Footer
function setupEventListeners() {
  btnNext.addEventListener('click', () => {
    if (state.currentView === 'pessoas') {
      handlePessoasNext();
    } else {
      handleFlowNext();
    }
  });

  btnPrev.addEventListener('click', () => {
    if (state.currentView === 'pessoas') {
      handlePessoasPrev();
    } else {
      handleFlowPrev();
    }
  });
}

/* ==========================================================================
   FLUXO DE VISITAS (Flow View)
   ========================================================================== */

function handleFlowNext() {
  if (state.currentStep === 0) {
    state.currentStep = 1;
  } else if (state.currentStep === 1) {
    // Validar seleção de pelo menos 2 vicentinos
    const checkedVicentinos = Array.from(document.querySelectorAll('input[name="vicentino"]:checked'))
      .map(input => parseInt(input.value));
    
    if (checkedVicentinos.length < 2) {
      alert('Por favor, selecione pelo menos 2 vicentinos para a visita (Acessibilidade: Visitas devem ser feitas em dupla/grupo).');
      return;
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

    // 2. Atualizar metas validadas na visita
    pendentes.forEach(m => {
      const val = state.goalValidations[m.id];
      m.status = val.status;
      m.justificativa = val.justificativa;
      
      // Se foi cumprida, desbloquear dependências imediatas
      if (val.status === 'cumprida') {
        data.metas.forEach(child => {
          if (child.metaDependenciaId === m.id && child.status === 'bloqueada') {
            child.status = 'pendente';
          }
        });
      }
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

      data.metas.push({
        id: Date.now() + 5,
        familiaId: state.selectedFamily,
        meta: novaMetaVal,
        prazo: novoPrazoVal || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias padrão
        status: initialStatus,
        metaDependenciaId: depId,
        justificativa: '',
        visitaCriacaoId: visitId
      });
    }

    saveData();
    alert('Visita e metas registradas com sucesso!');
    
    // Reiniciar fluxo
    state.currentStep = 0;
    state.selectedVicentinos = [1];
    state.selectedFamily = null;
  }
  
  renderApp();
}

function handleFlowPrev() {
  if (state.currentStep === 0) {
    state.currentView = 'pessoas';
    state.pessoasSubView = 'list';
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
    btnPrev.style.display = 'block';
    btnPrev.textContent = 'Gerenciar Pessoas';
    btnNext.textContent = 'Iniciar Nova Visita';
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
    welcomeCard.style.cssText = 'background: var(--primary-light); padding: 20px; border-radius: var(--border-radius-md); border-left: 5px solid var(--primary); box-shadow: var(--shadow-sm);';
    welcomeCard.innerHTML = `
      <h3 style="font-size: 1.25rem; color: var(--primary); margin-bottom: 8px; font-family: 'Outfit', sans-serif;">O que este aplicativo faz?</h3>
      <p style="font-size: 1.05rem; color: var(--text-main); margin-bottom: 16px; line-height: 1.5;">
        Auxilia conferências vicentinas a registrar relatos de visitas, acompanhar metas de promoção social para as famílias e sincronizar tudo com o Google Sheets, mesmo trabalhando sem conexão à internet.
      </p>
      <h3 style="font-size: 1.25rem; color: var(--primary); margin-bottom: 8px; font-family: 'Outfit', sans-serif;">Como usar em 3 passos simples:</h3>
      <ol style="margin-left: 20px; font-size: 1.05rem; color: var(--text-main); display: flex; flex-direction: column; gap: 10px; line-height: 1.4;">
        <li><strong>Escolha a Dupla:</strong> Selecione os vicentinos que farão a visita (mínimo de 2).</li>
        <li><strong>Selecione a Família:</strong> Escolha o lar assistido cadastrado.</li>
        <li><strong>Registre a Conversa:</strong> Digite o relato da visita e acompanhe/crie metas.</li>
      </ol>
    `;
    formContainer.appendChild(welcomeCard);

  } else if (state.currentStep === 1) {
    flowTitle.textContent = 'Selecione os Vicentinos';
    flowDesc.textContent = 'Selecione pelo menos 2 vicentinos que farão a visita hoje.';

    const vicentinosAtivos = data.pessoas.filter(p => p.papelAtual === 'vicentino');

    if (vicentinosAtivos.length === 0) {
      formContainer.innerHTML = '<p style="color: var(--danger); font-weight: bold; text-align: center; padding: 24px;">Nenhum Vicentino cadastrado. Vá em "Gerenciar Pessoas" e cadastre no mínimo 2 vicentinos.</p>';
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
        <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${vic.nome}</span>
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
        <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${fam.nome}</span>
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
    const selectedFamName = selectedFam ? selectedFam.nome : 'Família';
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

            <!-- Campo de Justificativa Condicional com Ditado por Voz -->
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
        pastMetasHtml += `
          <div class="meta-past-card ${isNaoCumprida ? 'nao-cumprida' : 'cumprida'}">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
              <span class="meta-status-title">${m.meta}</span>
              <span class="badge ${isNaoCumprida ? 'badge-visitante' : 'badge-benfeitor'}" style="font-size: 0.75rem;">
                ${isNaoCumprida ? 'Não Cumprida' : 'Cumprida'}
              </span>
            </div>
            ${m.justificativa ? `<div style="font-size: 0.95rem; color: var(--text-muted); font-style: italic; margin-top: 4px;">Motivo: "${m.justificativa}"</div>` : ''}
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
    const telVal = document.getElementById('cad-telefone').value.trim();
    const papelVal = document.getElementById('cad-papel').value;

    if (!nomeVal) {
      alert('Por favor, insira o nome da pessoa.');
      return;
    }

    const newId = Date.now();
    const newPerson = {
      id: newId,
      nome: nomeVal,
      telefone: telVal,
      papelAtual: papelVal,
      dataCadastro: new Date().toISOString().split('T')[0]
    };

    data.pessoas.push(newPerson);

    data.historicoPapeis.push({
      id: Date.now() + 1,
      pessoaId: newId,
      papel: papelVal,
      dataInicio: newPerson.dataCadastro,
      dataFim: null,
      nota: 'Cadastro inicial.'
    });

    saveData();
    alert('Pessoa cadastrada com sucesso!');
    state.pessoasSubView = 'list';
    renderApp();
  } else if (state.pessoasSubView === 'edit') {
    const p = data.pessoas.find(person => person.id === state.selectedPessoaId);
    if (!p) return;

    const nomeVal = document.getElementById('edit-nome').value.trim();
    const telVal = document.getElementById('edit-telefone').value.trim();
    const novoPapelVal = document.getElementById('edit-papel').value;
    const justVal = document.getElementById('edit-justificativa').value.trim();

    if (!nomeVal) {
      alert('Por favor, insira o nome.');
      return;
    }

    p.nome = nomeVal;
    p.telefone = telVal;

    if (novoPapelVal !== p.papelAtual) {
      if (!justVal) {
        alert('Por favor, escreva uma justificativa para a mudança de papel.');
        return;
      }

      const hoje = new Date().toISOString().split('T')[0];

      const historicoAtivo = data.historicoPapeis.find(h => h.pessoaId === p.id && h.dataFim === null);
      if (historicoAtivo) {
        historicoAtivo.dataFim = hoje;
      }

      data.historicoPapeis.push({
        id: Date.now(),
        pessoaId: p.id,
        papel: novoPapelVal,
        dataInicio: hoje,
        dataFim: null,
        nota: justVal
      });

      p.papelAtual = novoPapelVal;
    }

    saveData();
    alert('Dados atualizados com sucesso!');
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
  } else {
    btnPrev.textContent = 'Voltar para Listagem';
    btnNext.textContent = 'Salvar';
  }

  formContainer.innerHTML = '';

  if (state.pessoasSubView === 'list') {
    flowTitle.textContent = 'Gerenciar Pessoas';
    flowDesc.textContent = 'Cadastre pessoas e gerencie seus papéis (Vicentino, Assistido, Benfeitor, Visitante).';

    const toolsWrapper = document.createElement('div');
    toolsWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;';
    
    toolsWrapper.innerHTML = `
      <input type="text" id="pessoas-search" placeholder="🔍 Buscar por nome..." value="${state.pessoasSearchQuery}" style="padding: 14px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; box-shadow: var(--shadow-sm);">
      
      <div class="filter-tabs">
        <button type="button" class="tab-btn ${state.pessoasFilterRole === 'all' ? 'active' : ''}" data-role="all">Todos</button>
        <button type="button" class="tab-btn ${state.pessoasFilterRole === 'vicentino' ? 'active' : ''}" data-role="vicentino">Vicentinos</button>
        <button type="button" class="tab-btn ${state.pessoasFilterRole === 'assistido' ? 'active' : ''}" data-role="assistido">Assistidos</button>
        <button type="button" class="tab-btn ${state.pessoasFilterRole === 'benfeitor' ? 'active' : ''}" data-role="benfeitor">Benfeitores</button>
        <button type="button" class="tab-btn ${state.pessoasFilterRole === 'visitante' ? 'active' : ''}" data-role="visitante">Visitantes</button>
      </div>
      
      <div id="list-items-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
    `;

    formContainer.appendChild(toolsWrapper);

    renderPessoasListItems();

  } else if (state.pessoasSubView === 'create') {
    flowTitle.textContent = 'Cadastrar Nova Pessoa';
    flowDesc.textContent = 'Insira os dados básicos da pessoa e escolha o papel inicial.';

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 18px;';
    form.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="cad-nome" style="font-weight: 700; font-size: 1.1rem;">Nome Completo</label>
        <input type="text" id="cad-nome" placeholder="Ex: Maria de Souza Oliveira" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="cad-telefone" style="font-weight: 700; font-size: 1.1rem;">Telefone de Contato</label>
        <input type="tel" id="cad-telefone" placeholder="Ex: (11) 98888-7777" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="cad-papel" style="font-weight: 700; font-size: 1.1rem;">Papel Inicial</label>
        <select id="cad-papel" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%; cursor: pointer;">
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

    flowTitle.textContent = `Editar: ${p.nome}`;
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

    form.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="edit-nome" style="font-weight: 700; font-size: 1.1rem;">Nome Completo</label>
        <input type="text" id="edit-nome" value="${p.nome}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="edit-telefone" style="font-weight: 700; font-size: 1.1rem;">Telefone de Contato</label>
        <input type="tel" id="edit-telefone" value="${p.telefone}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); width: 100%;">
      </div>

      <div style="background: var(--primary-light); padding: 18px; border-radius: var(--border-radius-md); display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--surface-border);">
        <h3 style="font-size: 1.2rem; color: var(--primary); font-family: 'Outfit', sans-serif;">Alterar Papel / Promoção</h3>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label for="edit-papel" style="font-weight: 600; font-size: 1rem;">Papel Ativo</label>
          <select id="edit-papel" style="padding: 10px; font-size: 1.05rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); cursor: pointer; width: 100%;">
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
    filtered = filtered.filter(p => p.nome.toLowerCase().includes(query));
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma pessoa encontrada com os filtros aplicados.</p>';
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'pessoa-card';
    card.innerHTML = `
      <div class="pessoa-info">
        <span class="pessoa-name">${p.nome}</span>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
          <span class="badge badge-${p.papelAtual}">${p.papelAtual}</span>
          <span class="pessoa-phone">${p.telefone || 'Sem telefone'}</span>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-edit-pessoa" data-id="${p.id}" style="width: auto; min-height: auto; padding: 8px 16px; font-size: 0.95rem;">Editar</button>
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

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.pessoasFilterRole = e.target.getAttribute('data-role');
      renderPessoasListItems();
    });
  });

  document.querySelectorAll('.btn-edit-pessoa').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.selectedPessoaId = parseInt(e.target.getAttribute('data-id'));
      state.pessoasSubView = 'edit';
      renderApp();
    });
  });
}
