# Walkthrough - Versões V0.1.1 a V0.1.4

Este documento resume a implementação do setup do projeto, layout acessível, o sistema de gestão de pessoas e o ciclo completo de acompanhamento e validação de cadeias de metas promocionais.

## O que foi construído

### 🚀 Setup & Layout Acessível (V0.1.1)
- **Git & Configurações**: Repositório inicializado com arquivo `.gitignore` otimizado para o Google Drive e atalhos de sincronização (`*.gdoc`, `*.gslides`).
- **Layout Mobile-First Acessível**: [index.html](file:///g:/Meu%20Drive/spirit/ssvp/web-app/index.html) e [index.css](file:///g:/Meu%20Drive/spirit/ssvp/web-app/src/styles/index.css) configurados com fontes grandes (mínimo de 18px), áreas de toque grandes (48px por diretriz de acessibilidade) e suporte automático a Tema Escuro (Dark Mode).
- **Ditado por Voz Geral (STT)**: Botões de microfone ao lado dos campos de relato e nova meta, integrando a Web Speech API para transcrever a fala do vicentino direto para a tela.

### 👥 Gestão de Pessoas (V0.1.2)
- **Cadastro & Filtros**: Painel de visualização com busca rápida de pessoas e filtragem dinâmica por abas (*Vicentino | Assistido | Benfeitor | Visitante*).
- **Mudança de Papel (Promoção)**: Formulário que permite alterar historicamente o papel de uma pessoa (ex: de Assistido para Vicentino), exigindo justificativa que fica gravada na linha do tempo daquela pessoa.

### 📊 Cadeias de Metas, Acompanhamento & Justificativa por Voz (V0.1.4)
- **Banco de Dados Local de Visitas & Metas**: Sincronização e persistência no `localStorage` das tabelas de visitas e metas, carregando dados mockados ricos por padrão se a memória estiver vazia.
- **Validação de Metas Ativas (Passo 3)**: Ao selecionar uma família no Passo 2, o Passo 3 agora resgata e lista individualmente todas as metas que estão `'pendentes'`.
- **Botões Sim/Não & Justificativa Condicional**: Cada meta ativa possui botões grandes de validação. Clicar em **Não** (Não Cumprida) faz surgir imediatamente um campo de justificativa obrigatório, acompanhado de um **botão de microfone dedicado** para ditar o motivo do não cumprimento.
- **Destaque Visual para Metas Não Cumpridas**: Metas que não foram cumpridas no passado são exibidas com destaque visual em vermelho (`.meta-past-card.nao-cumprida`) e com sua justificativa em evidência, ajudando o vicentino a rever as dificuldades anteriores com a família.
- **Cadeias de Metas (Dependências)**: 
  * Ao criar uma meta, é possível selecionar se ela depende de outra. Metas dependentes iniciam no estado `'bloqueada'`.
  * Quando a meta-pai é marcada como **Sim (Cumprida)** na visita, o sistema destrava automaticamente a meta dependente subsequente, passando-a para `'pendente'` (pronta para a visita seguinte).
  * Metas bloqueadas são exibidas de forma cinza discreta na seção "Próximos Passos (Aguardando)" para acompanhamento geral.

---

## Como Testar

O servidor de desenvolvimento local está ativo em `http://localhost:3000`.

### Passos de Teste Recomendados para Metas & Cadeias:

1. **Escolher a Família e Ver Histórico**:
   * No menu principal, clique em **Iniciar Nova Visita**.
   * Escolha os vicentinos (Passo 1). O app agora permite prosseguir com apenas 1 vicentino (exibindo uma confirmação de recomendação da SSVP) ou com 2 ou mais, e avance.
   * No Passo 2, selecione a **Família Silva Oliveira** (ela já possui metas padrão gravadas na base) e avance.
   * No Passo 3, observe:
     * **Meta Ativa**: Aparecerá para validação a meta *"Fazer matrícula no curso de Culinária"*.
     * **Histórico Recente**: Exibirá a meta cumprida anteriormente em verde e a meta **Não Cumprida** em vermelho com o respectivo motivo (*"Houve greve de funcionários..."*).
     * **Próximos Passos (Aguardando)**: Exibirá as metas futuras bloqueadas da cadeia (ex: *"Comprar remédios..."* aguardando a consulta).

2. **Testar Gravação de Justificativa por Voz**:
   * No card da meta ativa *"Fazer matrícula..."*, clique em **Não**.
   * O campo de justificativa em vermelho aparecerá abaixo dos botões.
   * Clique em **Falar** ao lado do campo, dê a permissão de microfone e fale o motivo. A justificativa será digitada automaticamente.

3. **Criar Meta na Cadeia**:
   * Preencha o relato da visita.
   * No rodapé, no campo "Definir Nova Meta", escreva: *"Comprar livros do curso"*.
   * No campo "Depende de:", selecione a meta *"Fazer matrícula no curso profissionalizante de Culinária"*.
   * Clique em **Salvar Registro**.

4. **Verificar Desbloqueio e Persistência**:
   * Se você marcou a meta *"Fazer matrícula..."* como **Sim (Cumprida)**, as metas que dependiam dela foram automaticamente destravadas.
   * Inicie uma nova visita para a **Família Silva Oliveira**.
   * No Passo 3, certifique-se de que a meta *"Comprar livros do curso"* agora aparece como **Pendente** (ativa) para validação, e a visita anterior consta salva localmente!
