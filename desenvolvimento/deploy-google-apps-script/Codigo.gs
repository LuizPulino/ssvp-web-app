/**
 * SSVP Web App - Backend Google Apps Script (V0.3.6)
 * Cole este código no Google Apps Script de sua Planilha Google.
 * 
 * Estrutura de Arquivos no Editor de Script:
 * 1. Código.gs (este arquivo)
 * 2. index.html (seu index.html local)
 * 3. styles.html (seu /src/styles/index.css encapsulado por <style>...</style>)
 * 4. javascript.html (seu /src/main.js encapsulado por <script>...</script>)
 */

// Nomes das abas e seus respectivos cabeçalhos (esquema do banco de dados)
const SCHEMAS = {
  pessoas: ['id', 'nome', 'sobrenome', 'endereco', 'bairro', 'cep', 'telefone', 'papelAtual', 'dataCadastro', 'cargo', 'sexo', 'email', 'senha'],
  historico_papeis: ['id', 'pessoaId', 'papel', 'dataInicio', 'dataFim', 'nota'],
  visitas: ['id', 'data', 'vicentinos', 'familiaId', 'relato'],
  metas: ['id', 'familiaId', 'meta', 'prazo', 'status', 'metaDependenciaId', 'justificativa', 'dataResolucao', 'visitaCriacaoId'],
  escalas: ['id', 'familiaId', 'vicentinos', 'dataEscala', 'status', 'visitaId']
};

/**
 * Função executada automaticamente ao abrir a planilha
 */
function onOpen() {
  checkAndInitializeCopy();
}

/**
 * Verifica se a planilha atual é uma nova cópia (com base no ID) ou se precisa de atualização de versão.
 * Se for uma cópia ou versão antiga, limpa e inicializa os dados padrão.
 */
function checkAndInitializeCopy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentId = ss.getId();
  const props = PropertiesService.getDocumentProperties();
  const savedId = props.getProperty('SPREADSHEET_ID');
  const dbVersion = props.getProperty('DATABASE_VERSION');
  
  if (savedId !== currentId || dbVersion !== 'v0.3.9') {
    initializeDefaultData(ss);
    props.setProperty('SPREADSHEET_ID', currentId);
    props.setProperty('DATABASE_VERSION', 'v0.3.9');
  }
}

/**
 * Zera todas as abas e insere os dados padrão da conferência.
 */
function initializeDefaultData(ss) {
  // Limpa ou recria as abas com base no esquema
  for (const sheetName in SCHEMAS) {
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.clear();
      sheet.appendRow(SCHEMAS[sheetName]);
    } else {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(SCHEMAS[sheetName]);
    }
    // Formatação do cabeçalho
    sheet.getRange(1, 1, 1, SCHEMAS[sheetName].length)
      .setFontWeight('bold')
      .setBackground('#1e58c7')
      .setFontColor('#ffffff');
      
    // Exclui linhas extras para manter a planilha limpa
    const maxRows = sheet.getMaxRows();
    if (maxRows > 2) {
      sheet.deleteRows(2, maxRows - 2);
    }
  }

  // 1. Popular Pessoas
  const pessoasSheet = ss.getSheetByName('pessoas');
  const defaultPessoas = [
    [1, 'José', 'Silva', 'Rua Augusta, 500', 'Consolação', '01305-000', '(11) 98888-1111', 'vicentino', '2025-01-10', 'presidente', 'M', 'jose@ssvp.org', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'],
    [2, 'Maria', 'Souza', 'Av. Paulista, 1000', 'Bela Vista', '01310-100', '(11) 98888-2222', 'vicentino', '2025-02-15', 'vice_presidente', 'F', 'maria@ssvp.org', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'],
    [3, 'Pedro', 'Lima', 'Av. Brigadeiro, 2000', 'Bela Vista', '01310-200', '(11) 98888-3333', 'vicentino', '2025-03-20', 'secretario', 'M', 'pedro@ssvp.org', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'],
    [4, 'Marta', 'Oliveira', 'Rua Pamplona, 1200', 'Jardim Paulista', '01405-100', '(11) 98888-4444', 'vicentino', '2025-04-10', 'tesoureiro', 'F', 'marta@ssvp.org', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'],
    [5, 'João', 'Santos', 'Rua das Laranjeiras, 100', 'Bela Vista', '01311-200', '(11) 98888-5555', 'assistido', '2025-04-01', '', 'M', '', ''],
    [6, 'Raquel', 'Ferreira', 'Rua Bela Cintra, 700', 'Consolação', '01415-000', '(11) 98888-6666', 'assistido', '2025-04-20', '', 'F', '', ''],
    [7, 'André', 'Augusto', 'Rua das Flores, 123', 'Centro', '01001-000', '(11) 98888-7777', 'assistido', '2025-04-25', '', 'M', '', ''],
    [8, 'Débora', 'Oliveira', 'Av. Rebouças, 1500', 'Jardins', '05401-150', '(11) 98888-8888', 'assistido', '2025-05-01', '', 'F', '', '']
  ];
  defaultPessoas.forEach(p => pessoasSheet.appendRow(p));

  // 2. Popular Histórico de Papéis
  const historicoSheet = ss.getSheetByName('historico_papeis');
  const defaultHistorico = [
    [1, 1, 'vicentino', '2025-01-10', '', 'Cadastro inicial como Presidente.'],
    [2, 2, 'vicentino', '2025-02-15', '', 'Cadastro inicial como Vice-Presidente.'],
    [3, 3, 'vicentino', '2025-03-20', '', 'Cadastro inicial como Secretário.'],
    [4, 4, 'vicentino', '2025-04-10', '', 'Cadastro inicial como Tesoureira.'],
    [5, 5, 'assistido', '2025-04-01', '', 'Cadastro inicial de referência.'],
    [6, 6, 'assistido', '2025-04-20', '', 'Cadastro inicial de referência.'],
    [7, 7, 'assistido', '2025-04-25', '', 'Cadastro inicial de referência.'],
    [8, 8, 'assistido', '2025-05-01', '', 'Cadastro inicial de referência.']
  ];
  defaultHistorico.forEach(h => historicoSheet.appendRow(h));

  // 3. Popular Metas
  const metasSheet = ss.getSheetByName('metas');
  const defaultMetas = [
    [10, 5, 'Marcar consulta com Clínico Geral', '2025-02-10', 'cumprida', '', 'Consulta realizada no dia 05/02 com sucesso.', '2025-02-05T10:00:00.000Z', ''],
    [11, 5, 'Fazer exames de sangue solicitados', '2025-03-01', 'nao_cumprida', 10, 'Houve greve de funcionários no posto de coleta municipal.', '2025-06-14T15:00:00.000Z', ''],
    [12, 5, 'Retornar ao Clínico com os resultados dos exames', '2025-03-20', 'bloqueada', 11, '', '', ''],
    [13, 5, 'Comprar remédios prescritos', '2025-04-10', 'bloqueada', 12, '', '', ''],
    [14, 5, 'Fazer matrícula no curso profissionalizante de Culinária', '2026-07-15', 'pendente', '', '', '', ''],
    [15, 5, 'Pesquisar preços de cesta básica', '2026-06-19', 'nao_cumprida', '', 'Não sobrou tempo livre no final de semana.', '2026-06-19T14:00:00.000Z', '']
  ];
  defaultMetas.forEach(m => metasSheet.appendRow(m));

  // 4. Popular Escalas
  const escalasSheet = ss.getSheetByName('escalas');
  const defaultEscalas = [
    [1, 5, '1,2', '2026-07-10', 'pendente', ''],
    [2, 6, '1,3', '2026-06-15', 'pendente', ''],
    [3, 7, '2,4', '2026-06-10', 'realizada', 100]
  ];
  defaultEscalas.forEach(e => escalasSheet.appendRow(e));

  // Criar aba de Boas-vindas/Instruções como aba principal (V0.3.9)
  setupWelcomeSheet(ss);
}

/**
 * Cria a aba de Boas-vindas ("Início") e as instruções de uso formatadas (V0.3.9)
 */
function setupWelcomeSheet(ss) {
  let sheet = ss.getSheetByName('Início');
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet('Início', 0); // Insere no início (índice 0)
  }
  
  sheet.setHiddenGridlines(true);
  
  // Título do painel
  sheet.getRange("A1:G2").merge();
  sheet.getRange("A1").setValue("✨ SSVP Gestão - Painel de Controle & Instruções ✨")
    .setFontSize(14)
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#1e58c7")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  // Boas-vindas
  sheet.getRange("A4").setValue("Bem-vindo(a) à Planilha de Gestão da Conferência Local!")
    .setFontSize(12)
    .setFontWeight("bold")
    .setFontColor("#1e58c7");

  sheet.getRange("A5").setValue("Esta planilha funciona como o banco de dados central do aplicativo web no celular. Todos os relatos de visitas, metas e escalas criados pelos vicentinos no aplicativo são salvos aqui de forma automática.")
    .setFontSize(10.5)
    .setFontColor("#2c3e50");

  // Alerta de modificação manual
  sheet.getRange("A7").setValue("⚠️ Avisos Importantes (Leia antes de alterar qualquer célula):")
    .setFontSize(11)
    .setFontWeight("bold")
    .setFontColor("#c0392b");

  const avisos = [
    "1. NÃO altere o nome de nenhuma das outras abas (pessoas, historico_papeis, visitas, metas, escalas). O aplicativo depende desses nomes exatos.",
    "2. NÃO altere ou delete os cabeçalhos azuis (linha 1) das outras abas. Isso corrompe a importação e sincronização dos dados.",
    "3. Se você precisar cadastrar um vicentino ou assistido manualmente por aqui, certifique-se de preencher todas as colunas obrigatórias.",
    "4. A coluna 'senha' na aba 'pessoas' utiliza criptografia SHA-256 para manter as credenciais seguras. Não insira senhas em texto puro diretamente ali.",
    "5. Após qualquer edição direta nesta planilha, lembre-se de clicar em 'Sincronizar Agora' no aplicativo do celular para recarregar as alterações locais."
  ];

  avisos.forEach((aviso, idx) => {
    sheet.getRange(8 + idx, 1).setValue(aviso)
      .setFontSize(10)
      .setFontColor("#34495e");
  });

  // Links e utilitários
  sheet.getRange("A14").setValue("🔗 Links do Sistema:")
    .setFontSize(11)
    .setFontWeight("bold")
    .setFontColor("#1e58c7");

  let appUrl = "";
  try {
    appUrl = ScriptApp.getService().getUrl();
  } catch (err) {}

  if (appUrl && !appUrl.includes('<?=') && appUrl.trim() !== '') {
    sheet.getRange("A15").setValue("Acesse o Aplicativo:")
      .setFontSize(10)
      .setFontWeight("bold");
    sheet.getRange("B15").setFormula(`=HYPERLINK("${appUrl}", "Abrir SSVP Gestão ↗")`)
      .setFontSize(10)
      .setFontColor("#1e58c7")
      .setFontLine("underline");
  } else {
    sheet.getRange("A15").setValue("URL de Produção:")
      .setFontSize(10)
      .setFontWeight("bold");
    sheet.getRange("B15").setValue("Carregada após implantar como Aplicativo da Web.")
      .setFontSize(10)
      .setFontColor("#7f8c8d")
      .setFontStyle("italic");
  }

  // Ajuste de largura da coluna A
  sheet.setColumnWidth(1, 750);
  
  // Formatando a seção inteira
  sheet.getRange("A3:G3").setBackground("#f8f9fa");
  sheet.getRange("A13:G13").setBackground("#f8f9fa");
}

/**
 * Configuração e inicialização das abas na planilha caso não existam
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Garante que a aba de Boas-vindas ("Início") existe e está formatada (V0.3.9)
  let inicioSheet = ss.getSheetByName('Início');
  if (!inicioSheet || inicioSheet.getLastRow() === 0) {
    setupWelcomeSheet(ss);
  }

  for (const sheetName in SCHEMAS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(SCHEMAS[sheetName]);
      sheet.getRange(1, 1, 1, SCHEMAS[sheetName].length)
        .setFontWeight('bold')
        .setBackground('#1e58c7')
        .setFontColor('#ffffff');
    }
  }
}

/**
 * Função utilitária para enviar respostas JSON com cabeçalhos CORS corretos
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Requisição GET: Serve o web app ou retorna JSON da API
 */
function doGet(e) {
  try {
    // Se o parâmetro api=true for passado, trata como API JSON (GET antigo)
    if (e.parameter && e.parameter.api === 'true') {
      return handleGetApi(e);
    }
    
    // Caso contrário, serve o Frontend HTML (Web App Completo)
    checkAndInitializeCopy();
    
    const template = HtmlService.createTemplateFromFile('index');
    template.webAppUrl = ScriptApp.getService().getUrl();
    
    return template.evaluate()
      .setTitle('SSVP Conferência - Gestão de Visitas')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    return ContentService.createTextOutput("Erro ao carregar o aplicativo: " + error.toString());
  }
}

/**
 * Retorna os dados consolidados da Planilha em formato JSON
 */
function handleGetApi(e) {
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  for (const sheetName in SCHEMAS) {
    const sheet = ss.getSheetByName(sheetName);
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const items = [];

    for (let i = 1; i < rows.length; i++) {
      const item = {};
      for (let j = 0; j < headers.length; j++) {
        let val = rows[i][j];
        if (headers[j] === 'id' || headers[j] === 'pessoaId' || headers[j] === 'familiaId' || headers[j] === 'metaDependenciaId' || headers[j] === 'visitaCriacaoId' || headers[j] === 'visitaId') {
          item[headers[j]] = val ? Number(val) : null;
        } else if (val instanceof Date) {
          item[headers[j]] = val.toISOString().split('T')[0];
        } else {
          item[headers[j]] = val;
        }
      }
      items.push(item);
    }
    result[sheetName] = items;
  }

  return jsonResponse({ success: true, data: result });
}

/**
 * Requisição POST: Recebe dados do frontend e faz Upsert na Planilha
 */
function doPost(e) {
  try {
    initSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ success: false, error: 'Dados ausentes na requisição POST.' });
    }

    // Se for ação de login
    if (postData.action === 'login') {
      return handleLogin(ss, postData.email, postData.passwordHash);
    }

    // VALIDAÇÃO DE SEGURANÇA: Somente membros (vicentinos) cadastrados na planilha podem efetuar alterações.
    const pessoasSheet = ss.getSheetByName('pessoas');
    const pessoasRows = pessoasSheet.getDataRange().getValues();
    const pessoasHeaders = pessoasRows[0];
    const papelColIdx = pessoasHeaders.indexOf('papelAtual');
    
    const senderId = postData.senderId ? Number(postData.senderId) : null;
    let isValidVicentino = false;
    
    if (senderId && papelColIdx !== -1) {
      for (let i = 1; i < pessoasRows.length; i++) {
        if (Number(pessoasRows[i][0]) === senderId && pessoasRows[i][papelColIdx] === 'vicentino') {
          isValidVicentino = true;
          break;
        }
      }
    }
    
    if (!isValidVicentino) {
      return jsonResponse({ 
        success: false, 
        error: 'Permissão negada: Somente membros (vicentinos) cadastrados na planilha podem sincronizar dados.' 
      });
    }

    // Processa cada aba presente no pacote de sincronização
    for (const sheetName in SCHEMAS) {
      if (!postData[sheetName] || !Array.isArray(postData[sheetName])) {
        continue;
      }

      const sheet = ss.getSheetByName(sheetName);
      const headers = SCHEMAS[sheetName];
      const itemsToSync = postData[sheetName];

      itemsToSync.forEach(item => {
        const rowData = headers.map(header => {
          let val = item[header];
          return val === undefined || val === null ? '' : val;
        });

        const idToFind = Number(item.id);
        const values = sheet.getDataRange().getValues();
        let existingRowIndex = -1;

        for (let i = 1; i < values.length; i++) {
          if (Number(values[i][0]) === idToFind) {
            existingRowIndex = i + 1;
            break;
          }
        }

        if (existingRowIndex !== -1) {
          sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
      });
    }

    return jsonResponse({ success: true, message: 'Dados sincronizados com sucesso!' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Valida credenciais do usuário contra a planilha "pessoas"
 */
function handleLogin(ss, email, passwordHash) {
  if (!email || !passwordHash) {
    return jsonResponse({ success: false, error: 'E-mail e senha são obrigatórios.' });
  }
  
  const sheet = ss.getSheetByName('pessoas');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  
  const emailColIdx = headers.indexOf('email');
  const senhaColIdx = headers.indexOf('senha');
  
  if (emailColIdx === -1 || senhaColIdx === -1) {
    return jsonResponse({ success: false, error: 'Planilha desatualizada. Por favor, atualize o script para a versão v0.3.9.' });
  }
  
  const normalizedEmail = email.toString().trim().toLowerCase();
  
  for (let i = 1; i < rows.length; i++) {
    const rowEmail = rows[i][emailColIdx].toString().trim().toLowerCase();
    const rowSenha = rows[i][senhaColIdx].toString().trim();
    
    if (rowEmail === normalizedEmail) {
      if (rowSenha === passwordHash) {
        // Constrói objeto do usuário a partir da linha
        const user = {};
        for (let j = 0; j < headers.length; j++) {
          let val = rows[i][j];
          if (headers[j] === 'id') {
            user[headers[j]] = val ? Number(val) : null;
          } else if (val instanceof Date) {
            user[headers[j]] = val.toISOString().split('T')[0];
          } else {
            user[headers[j]] = val;
          }
        }
        return jsonResponse({ success: true, user: user });
      } else {
        return jsonResponse({ success: false, error: 'Senha incorreta.' });
      }
    }
  }
  
  return jsonResponse({ success: false, error: 'E-mail não cadastrado.' });
}

/**
 * Gera o hash SHA-256 de uma senha para colar na coluna 'senha' do cadastro de pessoas.
 * 
 * @param {string} senha A senha em texto puro.
 * @return {string} O hash SHA-256 em formato hexadecimal.
 * @customfunction
 */
function GERAR_HASH_SENHA(senha) {
  if (!senha) return "";
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, senha.toString(), Utilities.Charset.UTF_8);
  let hashHex = "";
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    hashHex += byteString;
  }
  return hashHex;
}
