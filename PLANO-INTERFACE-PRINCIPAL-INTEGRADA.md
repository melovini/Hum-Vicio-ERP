# Interface principal: Central da operação Hum Vício

Data: 18/09/2026.

## 1. Direção proposta

Transformar a tela principal em uma **Central da operação**: um lugar para identificar o estado do turno, perceber o que precisa de atenção e chegar rapidamente à tarefa correta.

A personalidade deve vir da identidade da hamburgueria e das informações úteis à operação: pedidos aguardando preparo, retiradas prontas, fichas de produtos para revisar e insumos abaixo do mínimo. Não preencher a página com gráficos decorativos, frases de marketing ou números sem uma ação correspondente.

O valor percebido deve ser concreto: menos procura por funções, menos pedidos esquecidos, mais clareza sobre o turno e continuidade ao trocar de módulo.

Este documento propõe melhorias; não altera a interface. A análise foi feita no código, sem inspeção visual no navegador ou teste com operadores. Há alterações em andamento no repositório, que foram preservadas.

## 2. Diagnóstico da implementação atual

| Evidência | Oportunidade |
|---|---|
| `src/app/page.tsx` apresenta três cartões: cozinha, caixa e gestão | Organiza acessos, mas não informa a situação operacional nem as prioridades |
| A gestão concentra muitos links pequenos em duas colunas dentro de um único cartão | O peso visual é desigual e encontrar uma tarefa exige leitura extensa |
| Título “Operação & Gestão Industrial” e termos como DRE, BCG, CRM e PDV | Substituir a linguagem de apresentação por tarefas reconhecíveis pelo operador |
| Ponto verde animado no topo é exibido sem consulta de estado nessa página | Evitar que decoração seja interpretada como conexão ou funcionamento confirmado |
| O botão “Sair” tem descrição “Encerrar turno ou trocar de perfil”, mas executa logout | Separar sair da sessão, trocar operador e fechar caixa; são ações diferentes |
| `src/components/admin/AdminShell.tsx` já possui grupos, indicação da página ativa e navegação adaptada ao celular | Reutilizar essa base e aproximar sua linguagem da central |
| `src/components/caixa/PosNavigationModal.tsx` já prevê salvar rascunho ao navegar | Preservar esse cuidado e unificar o seletor de módulos |
| `src/components/ui/PageHeader.tsx` e componentes de interface já existem | Evoluir o padrão atual em vez de criar outro conjunto paralelo |
| `src/app/globals.css` já define cores, superfícies, foco, estados e espaçamento visual | Aplicar esses padrões de forma consistente às áreas principais |
| `src/proxy.ts` encaminha caixa e cozinha diretamente aos seus módulos | Manter o caminho curto: central completa voltada inicialmente a gerente e administrador |

A tela principal usa classes como `surface-borderHover`, enquanto o tema declara `surface-border-hover`. Revisar essas referências durante a implementação para que as variações visuais usem nomes efetivamente definidos.

## 3. Estrutura sugerida para a tela principal

### Faixa superior: contexto confiável

Mostrar marca, estabelecimento, operador, perfil e situação do turno. Exemplo de conteúdo, sem representar dados reais:

> Hum Vício · Central da operação  
> Turno aberto às 18h · Operadora Ana · Atualizado às 19h42

Separar “turno aberto” de “conexão atualizada”. Não usar um único ponto verde para representar condições diferentes. Se o sistema ainda estiver buscando o estado, apresentar “Consultando turno…”.

Disponibilizar troca entre **Central, Vendas, Cozinha e Gestão**, conforme permissão. Deixar ajuda e menu do operador em posição estável. Não ocupar o topo com todos os cadastros da gestão.

### Ação principal: continuar o trabalho

Mostrar uma ação dominante de acordo com o contexto:

| Situação | Ação principal | Apoio |
|---|---|---|
| Turno fechado | Abrir caixa | Ver último fechamento, se autorizado |
| Turno aberto | Ir para vendas | Abrir cozinha |
| Rascunho recuperável no terminal | Retomar pedido | Mostrar horário e identificação curta, sem sobrescrever outros rascunhos |
| Dados essenciais indisponíveis | Tentar atualizar | Explicar o que ainda pode ser consultado |

O botão deve levar ao fluxo existente, sem duplicar a abertura de caixa ou a venda na central. Não transformar “retomar pedido” em uma promessa de sincronização entre aparelhos enquanto o rascunho existir apenas localmente.

### Resumo curto do turno

Exibir no máximo quatro informações de leitura rápida, cada uma com destino útil:

- Aguardando preparo → cozinha na fila correspondente.
- Em preparo → pedidos em produção.
- Prontos para entregar → vendas na lista de retirada/entrega correspondente.
- Vendas do turno → resumo financeiro, somente para perfis autorizados.

Usar rótulos explícitos: “Pedidos em preparo”, e não apenas “Produção”. Exibir o período nos valores financeiros. Não chamar faturamento de lucro nem misturar vendas confirmadas com valores já recebidos.

Se não houver dados suficientes, mostrar “Indisponível” ou “Atualizando”, sem substituir por zero. Os números ilustrativos de protótipos não devem aparecer como dados reais na implementação.

### Área “Precisa de atenção”

Uma lista compacta, ordenada pela consequência operacional, por exemplo:

| Pendência | Texto sugerido | Ação |
|---|---|---|
| Pedidos aguardando envio local | “Há pedidos aguardando conexão neste terminal” | Ver fila local |
| Atrasos de produção | “Pedidos passaram do prazo de preparo” | Ver pedidos atrasados |
| Cadastro incompleto | “Produtos precisam de revisão da ficha” | Revisar produtos |
| Estoque crítico | “Insumos estão abaixo do mínimo cadastrado” | Conferir estoque |

Mostrar até três pendências prioritárias e um acesso às demais. Agrupar ocorrências semelhantes; não abrir uma notificação para cada item a cada atualização.

Cada alerta precisa ter origem, critério e destino. “Estoque abaixo do mínimo” não deve ser anunciado como “produto indisponível” sem uma regra validada que relacione estoque e ficha técnica. A fila sem conexão é local até existir consolidação entre terminais.

### Acessos de gestão organizados por tarefa

Substituir a grade extensa dentro do cartão de gestão por grupos curtos:

- **Cardápio e preços:** produtos, fichas, preços e análise de vendas por produto.
- **Estoque e compras:** insumos, entrada de compras, fornecedores e contagem física.
- **Resultados:** resumo financeiro, clientes e documentos fiscais.
- **Equipe e controle:** colaboradores, checklists e histórico de alterações, conforme acesso.

Usar os mesmos grupos e nomes na navegação lateral. Fixar até quatro atalhos escolhidos pelo usuário como melhoria posterior, sem alterar a ordem do menu a cada acesso. Não criar uma busca global antes de tornar a navegação básica clara.

## 4. Esboço de organização

```text
Hum Vício   Central | Vendas | Cozinha | Gestão       Operador
Turno aberto às …                         Atualizado às …

Sua operação agora                 [ Ir para vendas ]
                                   [ Abrir cozinha ]

Aguardando preparo | Em preparo | Prontos | Vendas do turno*

Precisa de atenção                 Acessos frequentes
Pendência + contexto + ação        Cardápio e preços
Pendência + contexto + ação        Estoque e compras
                                  Resultados*
                                  Equipe e controle*

* Conteúdo apresentado somente a quem tem permissão.
```

Esse esboço define hierarquia, não um desenho final. Em telas menores, as áreas passam para uma coluna e a ação principal permanece próxima ao início.

## 5. Identidade moderna, específica e prática

Preservar a base escura e o laranja da marca já existentes. Usar o laranja principalmente para ação e seleção, reservando vermelho para problemas, amarelo para atenção e verde para estados confirmados.

| Elemento | Diretriz |
|---|---|
| Título | “Central da operação”; estabelecimento como identidade e contexto |
| Tipografia | Texto operacional confortável; reduzir o uso de letras muito pequenas e maiúsculas extensas |
| Cartões | Borda discreta, título claro, poucos números e ação evidente |
| Ícones | Mesma família já utilizada no projeto, acompanhada por texto; reduzir mistura de emojis com ícones |
| Números | Alinhamento estável e formatação brasileira; indicar período e unidade |
| Animações | Curtas e funcionais; evitar pulsação contínua em indicadores sem urgência |
| Marca | Usar o nome e, se disponível, a marca gráfica oficial; não inventar uma identidade diferente por módulo |
| Densidade | Central com respiro para decisão; caixa e cozinha com densidade adequada ao trabalho contínuo |

Não adicionar fotografias de hambúrgueres como fundo das áreas operacionais. Imagens podem ajudar a identificação dos produtos no caixa, quando disponíveis e leves; na central, a prioridade é leitura e ação.

Uniformidade não significa tornar todas as telas iguais: a cozinha precisa destacar tempo e preparo; o caixa, catálogo e pedido; a gestão, comparação e edição. Compartilhar cabeçalho, linguagem, controles e estados, mantendo a organização própria de cada tarefa.

## 6. Integração real entre as interfaces

### Navegação compartilhada

Criar uma definição única de módulos, grupos, rótulos, rotas, ícones e visibilidade. Usá-la na central, no `AdminShell` e no seletor de módulos do caixa. As permissões do servidor continuam sendo a autoridade; esconder um link não concede nem revoga acesso.

Evitar obrigar o gerente a voltar à central para passar da gestão à cozinha. Um seletor compacto deve permitir essa troca diretamente. Na cozinha, oferecer modo de foco para maximizar a fila sem perder uma saída clara.

### Links que chegam ao problema

Um cartão “Pedidos atrasados” deve abrir a lista já filtrada, não apenas a página inicial da cozinha. “Produtos para revisar” deve abrir os cadastros com pendência.

As rotas atuais existem, mas filtros por URL precisam ser implementados e validados onde não houver suporte. Definir parâmetros aceitos, inicializar a aba/filtro de destino e fornecer “Limpar filtro”. Não publicar atalhos que aparentem filtrar sem fazê-lo.

### Continuidade do trabalho

- Preservar rascunho, filtros e seleção de período ao trocar de área.
- Avisar sobre edição não salva somente quando existir risco real de perda.
- Informar falha ao guardar rascunho antes de navegar; não afirmar que salvou sem confirmação.
- Separar troca de módulo de troca de usuário. Autorização gerencial pontual deve indicar se troca a sessão ou autoriza apenas uma ação.
- Manter “Sair da conta”, “Trocar operador” e “Fechar caixa” como ações distintas, com efeitos claros.

## 7. Informações e regras necessárias

| Informação | Origem proposta | Cuidados |
|---|---|---|
| Operador/perfil | Sessão validada no servidor | Não presumir gerente quando o perfil estiver indisponível |
| Turno atual | Sessão de caixa autorizada | Definir como tratar turno que atravessa meia-noite |
| Fila de produção | Pedidos e estados operacionais | Usar o mesmo critério do KDS; excluir cancelados conforme regra |
| Prontos para entregar | Produção concluída + entrega/retirada pendente | “Concluído na cozinha” não significa entregue ao cliente |
| Vendas/recebimentos | Resumo financeiro do período | Totais completos, distintos e sujeitos a permissão |
| Pendências de cadastro | Resultado do validador de produtos | Mostrar apenas regras efetivamente implementadas |
| Estoque abaixo do mínimo | Saldo e mínimo cadastrado | Indicar falta de configuração sem inventar um limite |
| Sincronização local | Fila e último sucesso deste terminal | Identificar o alcance local do indicador |

As contagens precisam ser calculadas no servidor sobre o conjunto correto, não sobre uma lista limitada às últimas vendas já presentes no navegador. A central não deve criar outra versão das regras do KDS ou do financeiro.

## 8. Implementação técnica sugerida

### Componentes e responsabilidades

Os nomes abaixo são propostas, não arquivos já existentes:

- `ModuleSwitcher`: troca compacta entre áreas permitidas.
- `OperationHeader`: marca, turno, operador e atualização.
- `ShiftOverview`: resumo operacional com destinos filtrados.
- `OperationalAttentionList`: pendências com prioridade e ação.
- `ManagementShortcuts`: grupos de acesso coerentes com a gestão.

Reutilizar botões, diálogos, mensagens, `PageHeader`, `SlidingSheet` e estilos existentes. Evitar criar uma segunda biblioteca de controles só para a central.

### Contrato de dados enxuto

Propor um resumo autenticado específico da central, por exemplo `/api/operations/summary`, com contexto do turno, contagens autorizadas, pendências e horário de atualização. Essa rota ainda precisa ser criada; o nome é uma sugestão.

Separar falha de cada seção de falha geral: uma indisponibilidade financeira não deve impedir o gerente de abrir a cozinha. Nunca devolver informação financeira restrita e confiar apenas em ocultá-la no navegador.

Dados sem fonte disponível devem ficar indisponíveis com explicação. Não adicionar números fixos para preencher o desenho.

### Desempenho

- Entregar navegação e estrutura sem aguardar todos os indicadores.
- Buscar resumos, não histórico completo, para montar quatro cartões.
- Atualizar dados operacionais sem remontar a tela ou deslocar botões.
- Impedir consultas sobrepostas e reduzir atualização em aba oculta quando apropriado.
- Manter o último resultado válido com horário e aviso se a atualização falhar.
- Carregar detalhes apenas ao abrir o módulo correspondente.
- Medir primeira abertura e navegação recorrente separadamente em aparelho semelhante ao da operação.

Meta inicial proposta: navegação disponível em até 1 segundo e resumo utilizável em até 2 segundos na condição normal de rede e aparelho acordada. São metas para validação, não resultados já obtidos.

## 9. Uso por perfil e dispositivo

| Contexto | Comportamento |
|---|---|
| Administrador | Central completa, inclusive resultados e controles autorizados |
| Gerente | Operação, gestão permitida e pendências relevantes; sem acessos exclusivos do administrador |
| Caixa | Entrada direta em vendas; seletor e mensagens coerentes com a identidade comum |
| Cozinha | Entrada direta no KDS; produção em destaque, com modo de foco |
| Computador | Resumo compacto e áreas lado a lado quando houver espaço |
| Tablet | Botões confortáveis para toque e navegação recolhível |
| Celular | Uma coluna, prioridade às ações e pendências, sem tabelas espremidas |

Não ampliar permissões apenas para fazer todos passarem pela nova central. Se houver necessidade futura de central para caixa/cozinha, criar uma versão restrita e revisar conjuntamente as regras de entrada e autorização.

## 10. Linguagem que ajuda o operador

| Texto atual ou técnico | Alternativa sugerida |
|---|---|
| Operação & Gestão Industrial | Central da operação |
| Frente de Caixa & PDV | Vendas e caixa |
| KDS Chapa Digital | Cozinha — pedidos em preparo |
| DRE & Dashboard | Resultados financeiros |
| BCG Cardápio | Desempenho dos produtos |
| Clientes & CRM | Clientes |
| Auditoria Físico | Conferir estoque |
| Transite livremente entre a raiz do sistema… | Escolha a área que deseja abrir |

Manter termos técnicos dentro de relatórios quando necessários, com explicação curta. O botão deve dizer o que acontece: “Ver pedidos”, “Revisar ficha”, “Conferir estoque”.

## 11. Acessibilidade e prevenção de erros

- Combinar texto e ícone com a cor dos estados.
- Garantir foco visível, navegação por teclado e acesso para pular ao conteúdo.
- Usar alvos de toque de pelo menos 44 × 44 px como objetivo de projeto.
- Evitar truncar o nome da ação principal; informação essencial não pode depender de passar o mouse.
- Respeitar preferência de movimento reduzido e evitar alarmes animados permanentes.
- Manter a posição do foco após fechar menus e diálogos.
- Não reorganizar atalhos automaticamente enquanto o operador tenta clicar.
- Mostrar carregamento, ausência de dados, indisponibilidade e falta de permissão como estados diferentes.
- Confirmar apenas ações com consequência importante; navegar e consultar não devem exigir confirmações repetidas.

## 12. Plano de entrega

| Etapa | Entrega | Critério de aceite |
|---|---|---|
| 1 — Base comum | Nomes, estilos, seletor e grupos compartilhados; corrigir significado de Sair | Mesma função tem o mesmo nome e destino nas áreas principais |
| 2 — Central prática | Cabeçalho, ação principal e acessos reorganizados | Abrir vendas/cozinha em uma ação a partir da central |
| 3 — Resumo confiável | Dados do turno, estados de carregamento e permissões | Números conferidos com as telas de origem; sem zeros falsos |
| 4 — Pendências acionáveis | Alertas relevantes e filtros de destino | Cada pendência abre a lista certa, com contexto preservado |
| 5 — Continuidade | Rascunho, volta ao módulo, tablet e celular | Trocar de módulo não perde o pedido nem edições sem aviso |
| 6 — Ajuste com operadores | Testes de tarefas e medição de tempo | Operadores concluem tarefas sem procurar orientação externa |

Primeira entrega deve conter apenas a base comum, navegação e resumo mínimo cuja fonte já seja confiável. Adicionar os demais indicadores conforme os dados e regras forem validados. Não é necessário desenvolver um painel de gráficos ou personalização extensa para obter esse ganho.

## 13. Validação com tarefas reais

Testar com gerente, operador de caixa e responsável pela cozinha:

1. Abrir o turno e iniciar uma venda.
2. Localizar pedidos atrasados pela central.
3. Consultar uma ficha técnica e retornar ao pedido em andamento.
4. Identificar um insumo abaixo do mínimo e abrir seu cadastro.
5. Distinguir sair da conta de fechar o caixa.
6. Recuperar uma falha de conexão sem perder o contexto.

Registrar tempo, cliques, dúvidas e erros antes e depois. Não medir apenas aparência ou preferência de cor.

Checklist de conclusão:

- [ ] Acesso a vendas e cozinha em uma ação para perfis autorizados.
- [ ] Caixa e cozinha continuam com entrada direta no trabalho.
- [ ] Nenhum dado fictício é apresentado como estado real.
- [ ] Cada número informa seu contexto e corresponde à tela de origem.
- [ ] Alertas levam ao filtro correto e não expõem dados restritos.
- [ ] A navegação preserva rascunhos e informa falhas ao salvá-los.
- [ ] Controles e nomes são consistentes entre central, gestão e vendas.
- [ ] Funciona com teclado, toque e ampliação do texto.
- [ ] Não há aumento injustificado do tempo de carregamento.
- [ ] Operadores reconhecem a próxima ação sem precisar conhecer siglas.

## 14. Relação com os planos anteriores

Esta proposta complementa `ANALISE-DESEMPENHO-E-USABILIDADE.md` e `VERIFICACAO-MELHORIAS-CARDAPIO-KDS.md`. A interface deve refletir os dados e capacidades efetivamente disponíveis: aparência moderna não substitui correção de contagens, persistência de pedidos ou sincronização entre aparelhos.

O resultado desejado é uma central com identidade Hum Vício que responda rapidamente a três perguntas: **como está o turno, o que precisa de atenção e qual é a próxima ação**.
