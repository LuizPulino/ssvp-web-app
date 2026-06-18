# Versões do Projeto - SSVP Web App

Este documento define a estratégia de desenvolvimento passo a passo para o web app de gestão de conferências da SSVP, baseando-se nos [Objetivos do Projeto](file:///g:/Meu%20Drive/spirit/ssvp/web-app/desenvolvimento/objetivos%20do%20projeto.md).

O desenvolvimento será dividido em etapas incrementais para garantir que o fluxo principal funcione perfeitamente antes de adicionar recursos avançados (como integração de voz e offline/Google Sheets).

---

## 📋 Sumário das Versões

| Versão | Foco Principal | Subdivisões e Entregas |
| :--- | :--- | :--- |
| **V0.1** | Protótipo Frontend & Fluxo Local | **V0.1.1**: Setup & Design Acessível<br>**V0.1.2**: Cadastro & Histórico de Papéis<br>**V0.1.3**: Fluxo de Visitas & Criação de Metas<br>**V0.1.4**: Validação de Metas & Persistência Local |
| **V0.2** | PWA & Offline-First | **V0.2.1**: Instalação PWA & Cache Estático<br>**V0.2.2**: Fila de Sincronização Local (Queue) |
| **V0.3** | Integração com Google Sheets | **V0.3.1**: Leitura e Escrita Básica via API<br>**V0.3.2**: Sincronização de Fila & Detecção de Rede<br>**V0.3.3**: Otimização de Dados (Delta Sync) |
| **V0.4** | Firebase Auth & Multi-Paróquia | **V0.4.1**: Login do Vicentino (Firebase Auth)<br>**V0.4.2**: Vinculação Dinâmica de Planilhas por Paróquia<br>**V0.4.3**: Deploy em Firebase Hosting |
| **V0.5** | Integração de Voz (STT & TTS) | **V0.5.1**: Transcrição de Relatos (Speech-to-Text)<br>**V0.5.2**: Narração de Histórico (Text-to-Speech) |

---

## 🎨 Diretrizes de Acessibilidade (Foco em Idosos)

Dado que muitos dos vicentinos que utilizarão o app são idosos, o design deve priorizar:
*   **Contraste Alto e Letras Grandes:** Fontes legíveis (tamanho mínimo de 16px para textos gerais e 18px-20px para textos cruciais) e contraste de cores adequado.
*   **Destaque do Próximo Passo:** Botões de ação principal ("Continuar", "Salvar", "Avançar") devem ser proeminentes, com cores de destaque claras e tamanho grande de toque.
*   **Fluxos Simplificados e Guiados:** Reduzir a quantidade de informações por tela. Cada tela deve ter um propósito claro (ex: primeiro escolher os vicentinos, depois escolher a família, depois registrar a visita).
*   **Textos de Apoio Claros:** Evitar ícones sem legenda. Toda ação importante deve conter texto explícito.

---

## 🔍 Detalhamento das Versões

### 🚀 Versão 0.1: Protótipo Frontend & Fluxo Local
*O objetivo desta versão é validar a experiência do usuário (UX) e a interface básica do app sem dependências de servidores, aplicando as diretrizes de acessibilidade desde o início.*

#### V0.1.1: Configuração do Projeto & Estilos Acessíveis (Mobile-First)
*   **Estrutura Inicial:** Configuração do repositório, estrutura de pastas e servidor de desenvolvimento local.
*   **Design System & CSS:** Criação do `index.css` com variáveis de cores de alto contraste, tipografia adaptada para idosos (fontes grandes, mínimo 16px/18px) e transições suaves.
*   **Layout Base:** Template responsivo guiado com cabeçalho e navegação simplificada.

#### V0.1.2: Cadastro e Gestão de Pessoas (Local)
*   **Listagem de Pessoas:** Tela para visualizar e buscar pessoas (Vicentinos, Assistidos, Visitantes, Benfeitores) com alto contraste.
*   **Cadastro:** Formulário simplificado e acessível para cadastrar novas pessoas.
*   **Histórico de Papéis:** Registro interno para suportar a mudança de papéis ao longo do tempo (ex: assistido que vira vicentino).

#### V0.1.3: Fluxo de Visita & Definição de Metas
*   **Registro de Visita:** Tela guiada por etapas (1. Selecionar Vicentinos, 2. Selecionar Família, 3. Registrar Data e Relato).
*   **Criação de Metas:** Adicionar metas com prazo específico para os assistidos durante a visita.

#### V0.1.4: Validação de Metas e Persistência Local
*   **Verificação de Metas:** Na visita seguinte, recuperar metas anteriores daquela família, exibindo a opção simples de Sim/Não para o cumprimento, com campo de relato para justificativas.
*   **Persistência Local:** Armazenamento local temporário dos dados usando `localStorage` ou `IndexedDB`.

---

### 📱 Versão 0.2: PWA (Progressive Web App) & Offline-First
*Esta versão garante que o app possa ser instalado no celular e funcione sem internet para os dados já carregados.*

#### V0.2.1: Configuração PWA & Cache Estático
*   **Manifesto:** Criação do manifesto do app (`manifest.json`) com ícones e cores de tema para instalação na tela inicial.
*   **Service Worker:** Implementação de Service Workers para fazer o cache de arquivos estáticos (HTML, CSS, JS), permitindo o carregamento do app sem conexão.

#### V0.2.2: Fila de Sincronização Local (Queue)
*   **Estrutura de Fila:** Criação de uma tabela no `IndexedDB` / `localStorage` para armazenar as visitas e alterações de metas criadas de forma offline.
*   **Controle de Estado:** Indicação visual na tela de que há dados pendentes de sincronização.

---

### 📊 Versão 0.3: Integração com Google Sheets
*Conexão do app local com o banco de dados principal (Google Sheets).*

#### V0.3.1: Integração Google API & Leitura/Escrita Básica
*   **Configuração de API:** Configuração do acesso à planilha para ler a lista de pessoas, metas e histórico de visitas.
*   **Envio de Dados:** Escrita direta das visitas e metas registradas de volta para a planilha.

#### V0.3.2: Sincronização Inteligente & Rede
*   **Detecção de Status:** Escuta dinâmica do estado de conexão do dispositivo (Online/Offline).
*   **Processamento da Fila:** Sincronização automática em lote dos itens pendentes da fila local assim que a conexão estiver estável.

#### V0.3.3: Otimização de Consumo (Delta Sync)
*   **Sincronização Incremental:** Otimização para trafegar apenas novos registros ou alterações desde a última sincronização, economizando dados móveis.

---

### 🔐 Versão 0.4: Firebase Auth & Multi-Paróquia
*Segurança e separação de dados para diferentes paróquias/conferências.*

#### V0.4.1: Autenticação (Firebase Auth)
*   **Login de Vicentinos:** Autenticação segura via e-mail/senha ou Google no Firebase Auth.

#### V0.4.2: Configuração Multi-Paróquia
*   **Mapeamento Dinâmico:** Associação de cada vicentino/paróquia com o ID correspondente da sua planilha do Google Sheets.
*   **Segurança de Acesso:** Garantia de que cada vicentino lê/escreve somente na planilha autorizada para sua paróquia.

#### V0.4.3: Firebase Hosting & Deploy
*   **Deploy do Web App:** Publicação do frontend no Firebase Hosting para acesso público simples.

---

### 🎙️ Versão 0.5: Recursos de Voz (STT & TTS)
*Adiciona acessibilidade e facilidade de registro em trânsito.*

#### V0.5.1: Speech-to-Text (STT) para Relatos
*   **Transcrição Integrada:** Utilização da Web Speech API para permitir o ditado por voz dos relatos de visitas e das justificativas de metas, preenchendo os campos de texto.

#### V0.5.2: Text-to-Speech (TTS) para Leitura de Histórico
*   **Leitura Falada:** Recurso de áudio para narrar o histórico de visitas e as metas pendentes de uma família enquanto os vicentinos se deslocam para a visita.
