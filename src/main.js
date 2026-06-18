/**
 * SSVP Web App - Gestão de Conferência & Visitas (Versão 0.1.2)
 * Painel de Pessoas, Histórico de Transição de Papéis e Persistência Local.
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
  }
};

// Banco de Dados em Memória
const data = {
  pessoas: [],
  historicoPapeis: []
};

// Chaves do LocalStorage
const KEYS = {
  PESSOAS: 'ssvp_pessoas',
  HISTORICO: 'ssvp_historico_papeis'
};

// Elementos do DOM compartilhados
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

// Carregar dados salvos ou inicializar padrões
function loadData() {
  const localPessoas = localStorage.getItem(KEYS.PESSOAS);
  const localHistorico = localStorage.getItem(KEYS.HISTORICO);

  if (localPessoas) {
    data.pessoas = JSON.parse(localPessoas);
  } else {
    // Dados padrão iniciais (Compatibilidade total com o mockup anterior)
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
    // Criar histórico retrospectivo
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
}

// Salvar no LocalStorage
function saveData() {
  localStorage.setItem(KEYS.PESSOAS, JSON.stringify(data.pessoas));
  localStorage.setItem(KEYS.HISTORICO, JSON.stringify(data.historicoPapeis));
}

// Direcionamento Centralizado de Renderização
function renderApp() {
  if (state.currentView === 'pessoas') {
    renderPessoasView();
  } else {
    renderFlowView();
  }
}

// Eventos Globais de Navegação
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
    state.currentStep = 3;
  } else if (state.currentStep === 3) {
    // Salvar relato e metas localmente
    const relatoVal = document.getElementById('visit-relato').value;
    const metaVal = document.getElementById('visit-meta').value;
    const metaDateVal = document.getElementById('visit-meta-date').value;

    if (!relatoVal.trim()) {
      alert('Por favor, registre um breve relato da conversa com a família.');
      return;
    }

    state.visitDetails.relato = relatoVal;
    state.visitDetails.meta = metaVal;
    state.visitDetails.metaDate = metaDateVal;

    alert('Visita registrada com sucesso! (Fluxo Local Simulado V0.1.2)');
    
    // Reiniciar para a tela de boas-vindas
    state.currentStep = 0;
    state.selectedVicentinos = [1];
    state.selectedFamily = null;
  }
  
  renderApp();
}

function handleFlowPrev() {
  if (state.currentStep === 0) {
    // Entrar na Gestão de Pessoas
    state.currentView = 'pessoas';
    state.pessoasSubView = 'list';
  } else if (state.currentStep > 0) {
    state.currentStep--;
  }
  renderApp();
}

function renderFlowView() {
  const stepIndicator = document.querySelector('.flow-step-indicator');

  // Atualizar Barra de Progresso
  if (state.currentStep === 0) {
    if (stepIndicator) stepIndicator.style.display = 'none';
  } else {
    if (stepIndicator) stepIndicator.style.display = 'flex';
    stepLabel.textContent = `Passo ${state.currentStep} de 3`;
    stepProgress.style.width = `${(state.currentStep / 3) * 100}%`;
  }

  // Mostrar/Ocultar e renomear botões de controle
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

    // Filtrar dinamicamente os vicentinos ativos do cadastro unificado
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

    // Filtrar dinamicamente as famílias/assistidos cadastrados
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
    const selectedFamName = data.pessoas.find(p => p.id === state.selectedFamily)?.nome || 'Família';
    flowTitle.textContent = `Visita: ${selectedFamName}`;
    flowDesc.textContent = 'Preencha o relato da visita e, se necessário, adicione uma meta.';

    const formWrapper = document.createElement('div');
    formWrapper.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

    formWrapper.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="visit-date" style="font-weight: 700; font-size: 1.1rem;">Data da Visita</label>
        <input type="date" id="visit-date" value="${state.visitDetails.date}" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); min-height: var(--touch-target); width: 100%;">
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <label for="visit-relato" style="font-weight: 700; font-size: 1.1rem;">Relato da Visita (O que conversaram?)</label>
          <button type="button" id="btn-voice-relato" class="btn-mic" aria-label="Falar relato">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="flex-shrink: 0;">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
            <span id="btn-mic-text">Falar</span>
          </button>
        </div>
        <textarea id="visit-relato" rows="4" placeholder="Ex: A família relatou que a consulta de saúde está marcada..." style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); font-family: inherit; width: 100%; resize: vertical;"></textarea>
      </div>

      <div style="border-top: 1px solid var(--surface-border); padding-top: 16px; margin-top: 8px;">
        <h3 style="font-size: 1.25rem; margin-bottom: 12px; color: var(--primary);">Definir Nova Meta (Opcional)</h3>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <label for="visit-meta" style="font-weight: 700; font-size: 1.1rem;">Meta do Assistido</label>
              <button type="button" id="btn-voice-meta" class="btn-mic" aria-label="Falar meta">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="flex-shrink: 0;">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
                <span id="btn-mic-meta-text">Falar</span>
              </button>
            </div>
            <input type="text" id="visit-meta" placeholder="Ex: Caminhar 20 minutos todos os dias" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); min-height: var(--touch-target); width: 100%;">
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label for="visit-meta-date" style="font-weight: 700; font-size: 1.1rem;">Prazo da Meta</label>
            <input type="date" id="visit-meta-date" style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); min-height: var(--touch-target); width: 100%;">
          </div>
        </div>
      </div>
    `;

    formContainer.appendChild(formWrapper);

    // Configuração do ditado de áudio
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const setupMic = (btnId, textId, inputId) => {
      const btn = document.getElementById(btnId);
      const txt = document.getElementById(textId);
      const inp = document.getElementById(inputId);

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
          alert('Não foi possível reconhecer a voz. Verifique as permissões de microfone.');
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
        btn.addEventListener('click', () => {
          alert('O ditado por voz não é suportado pelo seu navegador atual. Use o Google Chrome ou Safari.');
        });
      }
    };

    setupMic('btn-voice-relato', 'btn-mic-text', 'visit-relato');
    setupMic('btn-voice-meta', 'btn-mic-meta-text', 'visit-meta');
  }
}

/* ==========================================================================
   PAINEL DE GESTÃO DE PESSOAS (Pessoas View)
   ========================================================================== */

function handlePessoasNext() {
  if (state.pessoasSubView === 'list') {
    // Ir para cadastro
    state.pessoasSubView = 'create';
    renderApp();
  } else if (state.pessoasSubView === 'create') {
    // Salvar cadastro
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

    // Gravar primeiro histórico
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
    // Salvar edição e mudança de papel
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

    // Verificar se houve mudança de papel
    if (novoPapelVal !== p.papelAtual) {
      if (!justVal) {
        alert('Por favor, escreva uma justificativa para a mudança de papel.');
        return;
      }

      const hoje = new Date().toISOString().split('T')[0];

      // Finalizar papel anterior no histórico
      const historicoAtivo = data.historicoPapeis.find(h => h.pessoaId === p.id && h.dataFim === null);
      if (historicoAtivo) {
        historicoAtivo.dataFim = hoje;
      }

      // Iniciar novo registro histórico
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
    // Voltar para Home de visitas
    state.currentView = 'flow';
    state.currentStep = 0;
  } else {
    // Voltar para listagem
    state.pessoasSubView = 'list';
  }
  renderApp();
}

function renderPessoasView() {
  const stepIndicator = document.querySelector('.flow-step-indicator');
  if (stepIndicator) stepIndicator.style.display = 'none';

  // Configurar botões do footer
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

    // Criação dos filtros e da barra de busca
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

    // Renderizar os itens de forma dinâmica
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

    // Obter histórico de papéis
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

    // Lógica para exibir justificativa apenas se o papel for alterado
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

// Renderiza apenas os cartões de pessoas baseado em filtros e busca
function renderPessoasListItems() {
  const listContainer = document.getElementById('list-items-container');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  // Filtrar
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
  
  // Input de Busca
  const searchInput = document.getElementById('pessoas-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.pessoasSearchQuery = e.target.value;
      renderPessoasListItems();
    });
  }

  // Abas de Filtros
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.pessoasFilterRole = e.target.getAttribute('data-role');
      renderPessoasListItems();
    });
  });

  // Botões de Edição
  document.querySelectorAll('.btn-edit-pessoa').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.selectedPessoaId = parseInt(e.target.getAttribute('data-id'));
      state.pessoasSubView = 'edit';
      renderApp();
    });
  });
}
