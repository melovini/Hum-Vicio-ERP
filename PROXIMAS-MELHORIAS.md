# Hum Vício ERP — próximas melhorias visuais e técnicas

**Atualizado em:** 17/09/2026

**Base analisada:** `main` no commit `2d072fa`

**Objetivo:** transformar a fundação visual já criada em uma interface autoral, coerente e rápida para a operação diária de hamburguerias.

## 1. Direção do produto

O Hum Vício ERP não deve parecer um painel SaaS genérico. A direção recomendada continua sendo:

> **Industrial, preciso, rápido e gastronômico sem ser caricato.**

A autoria deve aparecer tanto na estética quanto no comportamento:

- superfícies carvão e grafite, laranja queimado como ação principal e azul técnico como apoio;
- tipografia direta, números tabulares e hierarquia forte para valores, tempos e quantidades;
- bordas finas, elevação contida e detalhes de blueprint usados com moderação;
- menos efeitos decorativos competindo com o conteúdo;
- estados operacionais inequívocos, sem depender somente de cor;
- ações frequentes sempre próximas do contexto onde o usuário decide;
- respostas rápidas, preservação de dados e mensagens que orientem a próxima ação.

## 2. Estado atual da interface

### Fundação concluída

- tokens semânticos de superfície, texto, borda, ação e estado;
- primitives de botões, campos, seleção, cards, badges, skeleton e estado vazio;
- Dialog, ConfirmDialog e SlidingSheet com foco e operação por teclado;
- notificações globais;
- PageHeader, Toolbar e FilterBar;
- shell persistente de navegação da Gestão;
- tela de Fornecedores migrada para o novo padrão;
- documentação inicial em `DESIGN-SYSTEM.md`;
- Playwright e axe em desktop e mobile;
- CI com typecheck, 22 testes de regras, build e 13 testes de interface aprovados.

### Lacunas atuais

A fundação já é utilizável, mas ainda está concentrada em poucos fluxos. A maior parte do sistema mantém componentes locais, linguagem inconsistente e arquivos monolíticos.

Evidências técnicas da base atual:

| Área | Situação observada | Consequência |
| --- | --- | --- |
| Caixa | `page.tsx` com aproximadamente 386 KB | alto risco ao alterar e dificuldade para evoluir a experiência |
| Cozinha | aproximadamente 108 KB | estados, relógio e ações fortemente acoplados |
| Cardápio | aproximadamente 107 KB | edição e ficha técnica disputam o mesmo contexto |
| Colaboradores | aproximadamente 99 KB | permissões e formulários difíceis de testar isoladamente |
| Dashboard | aproximadamente 83 KB | apresentação, cálculo e consulta misturados |
| Feedback legado | `alert()` ou `confirm()` presentes em pelo menos 16 arquivos | experiência inconsistente e pouca orientação após erros |

O próximo objetivo é **consolidar o design system em fluxos reais**, sem criar primitives abstratas que ainda não tenham uso comprovado.

## 3. P0 restante — consolidar a fundação

### Bloco 2 — robustez de Dialog, Toast e SlidingSheet

Implementar:

- API explícita para impedir fechamento durante salvamento ou exclusão;
- foco inicial configurável por `ref` ou atributo documentado;
- devolução garantida do foco ao acionador;
- política para diálogos empilhados e apenas uma camada interativa por vez;
- ação opcional em toast, como **Tentar novamente** ou **Desfazer**;
- deduplicação, limite de itens e limpeza de notificações na troca de rota;
- mensagens de erro estruturadas, sem exibir detalhes internos do servidor;
- testes para ConfirmDialog, Toast e SlidingSheet em desktop e mobile;
- comportamento validado com `prefers-reduced-motion`.

**Critério de aceite:** os componentes possuem contrato documentado, exemplos de uso e testes de interação; operações em andamento não podem ser descartadas acidentalmente.

### Bloco 3 — ampliar os tokens de autoria visual

Adicionar ao design system:

- escala tipográfica para título de módulo, seção, rótulo, dado operacional e legenda;
- escala única de espaçamento e largura máxima de conteúdo;
- tokens de densidade: confortável, compacta e operação;
- tokens de duração, easing e redução de movimento;
- escala de camadas para header, sheet, dialog, toast e ajuda contextual;
- padrões de ícone, tamanho, espessura e combinação com texto;
- variantes de dados: moeda, percentual, quantidade, horário e duração;
- padrão visual para informação atualizada, desatualizada, offline e pendente;
- inventário de gradientes, sombras, transparências e raios legados a remover.

Regras de autoria:

- usar o dot-grid apenas em áreas de contexto ou canvas, nunca atrás de tabelas extensas;
- reservar laranja para ação principal, foco e destaque operacional;
- usar azul técnico para informação e navegação, não como segunda ação principal concorrente;
- evitar excesso de `glass`, brilhos e fundos desfocados nas telas de trabalho;
- manter uma ação primária clara por região da interface.

**Critério de aceite:** novas telas podem ser construídas sem criar cor, sombra, raio, espaçamento ou padrão tipográfico local.

### Bloco 4 — glossário e microcopy

Criar `GLOSSARIO-PRODUTO.md` e padronizar os conceitos:

| Conceito | Nome recomendado |
| --- | --- |
| Operação de vendas | Caixa / PDV |
| Registro comercial concluído | Venda |
| Solicitação antes da conclusão | Pedido |
| Preparação na cozinha | Produção |
| Composição e quantidades | Ficha técnica |
| Item vendável | Produto |
| Matéria-prima | Insumo |
| Contagem física | Inventário físico |
| Documento fiscal | NFC-e |

Aplicar também:

- botões com verbo e objeto: **Salvar fornecedor**, **Finalizar pedido**, **Fechar caixa**;
- erros com causa compreensível e próxima ação;
- confirmações destrutivas descrevendo exatamente o que será preservado e removido;
- estados vazios que expliquem por que a informação importa e como começar;
- termos iguais na home, navegação, tela, ajuda e documentação.

**Critério de aceite:** o usuário não precisa interpretar se “pedido”, “venda” e “produção” representam a mesma etapa.

## 4. Arquitetura visual e navegação

### Organização principal

Manter três ambientes reconhecíveis:

1. **Operação** — Caixa, Cozinha, Mesas e atendimento;
2. **Gestão** — indicadores, estoque, compras, cardápio, clientes e equipe;
3. **Configurações** — empresa, integrações, fiscal, permissões e auditoria.

Cada ambiente pode ter densidade própria, mas deve compartilhar tokens, componentes, mensagens e estados.

### Melhorias necessárias no shell

- remover botões locais de “voltar” quando a navegação persistente já cumpre essa função;
- destacar módulo, seção e página atual sem depender apenas da cor;
- incluir breadcrumbs somente em fluxos com profundidade real;
- manter ações da página no PageHeader e ações da seleção junto da seleção;
- criar navegação mobile com áreas de toque de no mínimo 44 px;
- persistir preferência de sidebar compacta sem causar mudança visual durante o carregamento;
- preparar busca global futura por produto, cliente, pedido ou função, sem implementá-la antes de definir permissões e escopo.

## 5. Migração progressiva das telas de Gestão

Executar uma tela por bloco, sempre incluindo estados, acessibilidade e testes.

| Ordem | Tela | Melhoria central |
| --- | --- | --- |
| 1 | Insumos | consulta rápida, saldo, custo e alerta de reposição na mesma hierarquia |
| 2 | Compras | fluxo fornecedor → itens → conferência → entrada no estoque |
| 3 | Inventário físico | digitação mobile-first, progresso e revisão de divergências |
| 4 | Clientes | busca tolerante, histórico, segmentação e identificação rápida no PDV |
| 5 | Fichas técnicas | editor em duas colunas com custo e CMV em tempo real |
| 6 | Precificação | comparação por canal, margem e impacto antes de publicar |
| 7 | Colaboradores | papéis, permissões e PINs com exposição mínima de dados |
| 8 | Fiscal e Auditoria | ações sensíveis, rastreabilidade e mensagens rigorosas |

### Contrato mínimo para cada tela migrada

- PageHeader integrado ao shell;
- FilterBar para consulta e filtros persistentes quando fizer sentido;
- estados distintos de skeleton, vazio, falha, sem permissão e dados desatualizados;
- Dialog para tarefa curta e SlidingSheet para detalhe ou edição contextual;
- ConfirmDialog para ação destrutiva;
- preservação do formulário após falha;
- bloqueio de duplo envio;
- feedback somente após confirmação do servidor;
- tabelas responsivas sem esconder informação crítica;
- cards usados para decisão, não apenas como decoração;
- navegação completa por teclado e foco visível;
- teste E2E do caminho principal em desktop e mobile;
- ausência de novos hexadecimais, sombras ou espaçamentos locais.

## 6. P1 — interfaces operacionais

### Caixa / PDV

Antes do redesenho visual, decompor o arquivo por fluxo. A interface recomendada deve manter três zonas estáveis:

`CATÁLOGO → PEDIDO ATUAL → RESUMO E FINALIZAÇÃO`

Melhorias:

- catálogo com categorias fixas, busca rápida e disponibilidade visível;
- personalização do item sem perder o contexto do pedido;
- cliente, canal e tipo de atendimento visíveis no topo do pedido;
- resumo persistente com subtotal, desconto, taxa, pagamento e saldo;
- estados claros para online, contingência, enviando, confirmado e falha;
- fila offline exibindo quantidade, horário e motivo da pendência;
- prevenção visual e técnica de duplo checkout;
- recuperação do pedido após atualização ou falha de rede;
- atalhos de teclado documentados;
- fluxo simples mensurado por quantidade de ações e tempo;
- validação em tablet landscape e no equipamento real da loja.

### Cozinha / KDS

- colunas ou filas claras para novos, em preparo e prontos;
- número, canal, tempo, itens e modificações sempre na mesma ordem;
- atraso indicado por texto, ícone e cor;
- modos confortável e alta densidade;
- botões grandes e ação principal previsível em cada estado;
- última atualização e conexão visíveis sem interromper a leitura;
- manutenção do último estado válido quando a rede cair;
- relógio isolado para não redesenhar todos os pedidos;
- som configurável por estação e evento;
- teste de leitura à distância, toque com luva e alto volume de pedidos.

## 7. P2 — diferenciais autorais de Gestão

### Dashboard orientado a decisões

Organizar a leitura em três perguntas:

1. **O que aconteceu?** — vendas, ticket, CMV, margem e volume;
2. **O que mudou?** — comparação com período equivalente;
3. **Onde agir?** — alertas priorizados com ligação para o módulo responsável.

Requisitos:

- período consistente em todos os indicadores;
- valor, comparação e contexto na mesma unidade visual;
- origem e atualização dos dados visíveis;
- cálculos realizados no servidor, sem depender apenas do recorte da store;
- gráficos somente quando facilitarem comparação ou tendência;
- detalhes sob demanda, evitando grade excessiva de cards.

### Ficha técnica e precificação

Transformar esse fluxo em assinatura do produto:

- ingredientes e sub-receitas à esquerda;
- custo, CMV, margem e preço sugerido à direita;
- cálculo atualizado enquanto o usuário edita;
- origem e data do custo de cada insumo;
- alerta de custo desatualizado ou ingrediente sem preço;
- diferença entre simulação, rascunho e preço publicado;
- taxas e impostos configuráveis por canal;
- comparação do impacto financeiro antes de salvar;
- histórico resumido de alterações relevantes.

## 8. Responsividade, acessibilidade e desempenho

### Responsividade

Validar no mínimo:

- 360 px para operação móvel;
- tablet portrait;
- tablet landscape para PDV;
- desktop de gestão;
- KDS no monitor real da cozinha.

Não reduzir tabelas indiscriminadamente para cards. Definir, por tela, quais colunas são essenciais, quais podem virar detalhe e quando rolagem horizontal controlada é preferível.

### Acessibilidade

- contraste AA em todos os estados, inclusive hover, active e disabled;
- foco visível e ordem de tabulação coerente;
- rótulos persistentes, sem depender de placeholder;
- erros associados ao campo e anunciados por leitor de tela;
- áreas de toque adequadas;
- informação nunca transmitida somente por cor;
- animações respeitando redução de movimento;
- axe no CI e revisão manual dos fluxos críticos.

### Desempenho percebido

- carregar apenas os dados necessários para iniciar cada módulo;
- não bloquear Caixa ou KDS com dados administrativos;
- usar skeleton compatível com o layout final;
- manter conteúdo anterior durante atualização silenciosa quando seguro;
- cancelar pesquisas antigas e aplicar debounce em consultas remotas;
- virtualizar listas somente quando a medição justificar;
- medir renderizações, tamanho de bundle e tempo até primeira ação útil;
- carregar painéis e modais secundários sob demanda.

## 9. Arquitetura frontend necessária

Estrutura recomendada por módulo:

```text
modulo/
  page.tsx
  components/
  hooks/
  services/
  types.ts
  utils.ts
```

Prioridades:

- decompor Caixa, Cozinha, Cardápio, Colaboradores e Dashboard por domínio;
- mover transformações puras e cálculos para arquivos testáveis;
- separar apresentação, estado, regras e acesso a dados;
- usar seletores ou stores por domínio;
- impedir que relógios e polling redesenhem módulos inteiros;
- padronizar resultado de operações em sucesso, erro recuperável e erro definitivo;
- remover `alert()` e `confirm()` das telas e da camada de dados;
- definir política única de atualização otimista e rollback;
- impedir que uma tela observe coleções que não utiliza.

**Critério de aceite:** mudanças em um módulo não provocam renderizações ou regressões em domínios não relacionados.

## 10. Qualidade visual contínua

Expandir a cobertura atual gradualmente:

- screenshots de referência para cada tela migrada;
- projetos Playwright para mobile, tablet e desktop;
- cenários com dados longos, nomes extensos, listas vazias e grande volume;
- verificação de overflow horizontal;
- testes de foco, Escape e devolução ao acionador;
- testes de falha preservando formulário e dados da tela;
- artefatos do Playwright disponíveis no CI por tempo limitado;
- revisão visual obrigatória antes de declarar uma migração concluída.

Evitar snapshots de páginas inteiras altamente dinâmicas. Preferir regiões estáveis e fluxos que representem decisões importantes.

## 11. Sequência recomendada dos próximos commits

| Ordem | Bloco | Resultado esperado |
| --- | --- | --- |
| 1 | Robustez de Dialog, Toast e Sheet | componentes estáveis para expansão |
| 2 | Tokens de autoria, densidade e movimento | identidade visual aplicável sem exceções locais |
| 3 | Glossário e microcopy | linguagem única e ações mais claras |
| 4 | Migração de Insumos | segundo cadastro completo no novo padrão |
| 5 | Migração de Compras | fluxo de entrada de estoque coerente |
| 6 | Inventário mobile-first | contagem rápida e segura no estoque |
| 7 | Clientes e busca no PDV | identificação rápida e histórico consistente |
| 8 | Ficha técnica em duas colunas | principal diferencial visual da Gestão |
| 9 | Precificação integrada | decisão de preço por margem e canal |
| 10 | Decomposição inicial do Caixa | base segura para redesenho operacional |
| 11 | Redesenho incremental do Caixa | venda mais rápida e resiliente |
| 12 | KDS e estados de sincronização | produção legível e confiável |
| 13 | Dashboard orientado a ação | gestão com menos ruído e mais decisão |

## 12. Definição de pronto para cada bloco

Um bloco só está concluído quando:

- escopo, risco e comportamento esperado estão documentados;
- TypeScript, testes de regras e build estão aprovados;
- há teste novo para a interação ou regra introduzida;
- sucesso, vazio, carregamento, falha e falta de permissão estão definidos;
- dados digitados permanecem após erro recuperável;
- teclado, mobile e contraste foram verificados;
- não existem mensagens com dados sensíveis ou detalhes internos;
- documentação e glossário foram atualizados;
- o CI está verde;
- o commit pode ser revertido isoladamente.

## 13. Próximo bloco recomendado

O próximo bloco deve ser **robustez de Dialog, Toast e SlidingSheet**.

A validação real da fundação já está ativa no CI. Estabilizar agora os contratos de interação evita repetir problemas de foco, fechamento acidental, notificações duplicadas e perda de formulário quando Insumos, Compras e Inventário forem migrados.

Depois desse bloco, a prioridade deve ser ampliar os tokens de autoria visual e só então iniciar a migração de Insumos.
