/**
 * SSVP Web App - Protótipo de Fluxo Guiado (Versão 0.1.1)
 * Lógica simples para demonstrar e testar a interface de acessibilidade.
 */

// Estado da Aplicação
const state = {
  currentStep: 0, // 0: Home/Boas-vindas, 1: Vicentinos, 2: Família, 3: Relato/Metas
  selectedVicentinos: [1],
  selectedFamily: null,
  visitDetails: {
    date: new Date().toISOString().split('T')[0],
    relato: '',
    meta: '',
    metaDate: ''
  }
};

// Dados Mockados
const data = {
  vicentinos: [
    { id: 1, name: 'Antônio Silva (Você)' },
    { id: 2, name: 'Maria Souza' },
    { id: 3, name: 'José Carlos' }
  ],
  familias: [
    { id: 101, name: 'Família Silva Oliveira' },
    { id: 102, name: 'Família Nascimento Santos' },
    { id: 103, name: 'Família Ferreira Lima' }
  ]
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
  renderStep();
  setupEventListeners();
});

// Setup de Eventos Globais
function setupEventListeners() {
  btnNext.addEventListener('click', () => {
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
      // Salvar (Simulação local)
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

      alert('Visita registrada com sucesso! (Fluxo Local Simulado V0.1.1)');
      // Reiniciar fluxo para a página inicial
      state.currentStep = 0;
      state.selectedVicentinos = [1];
      state.selectedFamily = null;
    }
    
    renderStep();
  });

  btnPrev.addEventListener('click', () => {
    if (state.currentStep > 0) {
      state.currentStep--;
      renderStep();
    }
  });
}

// Renderização Dinâmica de Telas
function renderStep() {
  const stepIndicator = document.querySelector('.flow-step-indicator');

  // Atualizar Indicador de Progresso
  if (state.currentStep === 0) {
    if (stepIndicator) stepIndicator.style.display = 'none';
  } else {
    if (stepIndicator) stepIndicator.style.display = 'flex';
    stepLabel.textContent = `Passo ${state.currentStep} de 3`;
    stepProgress.style.width = `${(state.currentStep / 3) * 100}%`;
  }

  // Mostrar/Ocultar botão Voltar
  if (state.currentStep === 0) {
    btnPrev.style.display = 'none';
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

  // Limpar formulário
  formContainer.innerHTML = '';

  // Renderizar de acordo com o passo atual
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

    data.vicentinos.forEach(vic => {
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
        <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${vic.name}</span>
      `;

      // Adicionar toggle visual
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

    data.familias.forEach(fam => {
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
        <span style="font-weight: 600; font-size: 1.2rem; color: var(--text-main);">${fam.name}</span>
      `;

      // Atualizar estilo visual ao mudar rádio
      const radio = label.querySelector('input');
      radio.addEventListener('change', () => {
        // Limpar os outros estilos
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
    const selectedFamName = data.familias.find(f => f.id === state.selectedFamily)?.name || 'Família';
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
        <label for="visit-relato" style="font-weight: 700; font-size: 1.1rem;">Relato da Visita (O que conversaram?)</label>
        <textarea id="visit-relato" rows="4" placeholder="Ex: A família relatou que a consulta de saúde está marcada..." style="padding: 12px; font-size: 1.1rem; border-radius: var(--border-radius-md); border: 2px solid var(--surface-border); font-family: inherit; width: 100%; resize: vertical;"></textarea>
      </div>

      <div style="border-top: 1px solid var(--surface-border); padding-top: 16px; margin-top: 8px;">
        <h3 style="font-size: 1.25rem; margin-bottom: 12px; color: var(--primary);">Definir Nova Meta (Opcional)</h3>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label for="visit-meta" style="font-weight: 700; font-size: 1.1rem;">Meta do Assistido</label>
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
  }
}
