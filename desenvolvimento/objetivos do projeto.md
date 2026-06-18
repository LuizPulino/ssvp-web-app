# Objetivos do Projeto - SSVP Web App
  Web app para gestão de conferências. Toda conferência tem o objetivo de promover assistidos. Toda conferência é formada por pessoas.
  Uma pessoa pode ser assistida, vicentina, visitante ou benfeitora.
  Uma pessoa pode ser assistida e depois se tornar vicentina ou benfeitora. Uma mesma pessoa pode mudar de papel ao longo do tempo.
  O pilar do trabalho vicentino é a visita à casa do assistido.
  Nessas visitas podem ir 2 ou mais vicentinos.
  Nas visitas os vicentinos conversam com a família assistida.
  Com o tempo, cria-se uma relação de amizade e confiança.
  Os assistidos passam a compartilhar detalhes de suas vidas.
  Os vicentinos ajudam a pensar, decidir e agir para melhorar de vida.
  As decisões podem ser simples ou muito complexas.
  Elas podem envolver necessidades materiais, saúde, educação, trabalho, etc.
  Nessas conversas é comumm definir metas. exs: ir ao posto de saúde marcar consulta com nutricionista. Caminhar 20 minutos todos os dias. Fazer um curso de culinária. etc.
  Cada meta tem uma data para ser cumprida. O assistido pode não cumprir a mmeta por diversos motivos. O vicentino pode ajudar a remover obstáculos. Ex: meta - ir ao posto de saúde marcar consulta com nutricionista esta semana. na próxima visita o webapp deve recuperar as metas do assistido. O vicentino pergunta: foi ao posto de saúde marcar consulta com nutricionista? o assistido responde sim/não e o vicentino atualiza a meta no webapp. Se sim, então o vicentino e o assistido definem um prazo e uma meta para comparecer ao posto de saúde. Se não, o vicentino conversa com o assistido para entender por que ele não cumpriu a meta e se é preciso ajustar o prazo, a meta ou o que for preciso. Essa atualização da meta deve ser registrada no histórico da visitas. O histórico das visitas deve ser recuperado pelo webapp para que o vicentino possa acompanhar a evolução do assistido. O objetivo final é ajudar o assistido a melhorar de vida, seja por meios materiais, saúde, educação, trabalho, etc. O webapp deve ajudar o vicentino a acompanhar a evolução do assistido ao longo do tempo. 

  O banco de dados deve ser um google sheets. o webapp deve funcionar offline e sincronizar com o google sheets quando tiver conexão wifi do celular com a rede de internet. O webapp deve ser responsivo. O app deve ser um pwa, leve e que rode em qualquer smartphone. O app deve usar o minimo de dados possivel na sincronização. Os relatos de visitas, registros de metas, justificativas, etc deven poder ser feitos por voz. o vicentino fala, o app transforma em texto e coloca na planilha. O contrário também é necessário: à caminho da casa de uma família, os vicentinos devem poder ouvir o histórico das metas recentes e das visitas registrados na planilha, para se atualizarem. 

  As principais funcionalidades serão transformar voz em texto e texto em voz.o webapp deve ser capaz de escrever e ler no google sheets.

  O vicentino deve poder baixar um histórico do assistido.

  O webapp deve estar hospedadp no firebase. Cada paróquia deve ter sua planilha no google sheets. O webapp deve ser capaz de acessar a planilha da paróquia do vicentino. O webapp deve ter um login para autenticar o vicentino.
  
  





## Gestão de pessoas

