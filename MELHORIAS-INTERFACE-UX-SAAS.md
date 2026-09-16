# Hum Vício ERP — Auditoria de Interface e Roadmap UX/UI para SaaS

**Data:** 16/09/2026  
**Escopo:** interface atual do ERP e preparação para uso por outras hamburguerias.  
**Objetivo:** tornar a experiência mais autoral, consistente, rápida de aprender e eficiente na operação diária, sem priorizar estética sobre clareza operacional.

## 1. Diagnóstico executivo

A interface já tem uma direção visual própria: dark mode, superfícies em camadas, laranja como ação principal, azul como acento técnico, estados semânticos, tipografia numérica tabular e estética industrial. Isso é uma boa base e deve ser preservado.

O principal problema não é falta de estilo. É falta de um **sistema de interface completo e reutilizável**. Muitas telas ainda concentram estrutura, regra, estado e apresentação em arquivos muito grandes. A página de caixa, por exemplo, ultrapassa centenas de KB de código; dashboard, cardápio, colaboradores, cozinha e engenharia também são módulos extensos. Isso dificulta manter consistência visual e evoluir UX sem regressões.

Para virar SaaS, a interface precisa deixar de parecer uma coleção de telas construídas conforme cada necessidade surgiu e passar a funcionar como um produto com linguagem visual, navegação, componentes e padrões previsíveis.

## 2. Princípios de produto

1. **Operação antes de decoração.** No caixa e cozinha, cada segundo e cada toque importam.
2. **Reconhecimento antes de memorização.** O usuário deve enxergar o que fazer sem decorar onde cada função fica.
3. **Uma ação primária por contexto.** Evitar várias ações com o mesmo peso visual.
4. **Estado sempre explícito.** Carregando, salvo, sincronizando, offline, erro, concluído e pendente precisam ser distinguíveis.
5. **Consistência entre módulos.** Botões, filtros, modais, tabelas, badges e formulários devem se comportar igual em todo o ERP.
6. **Progressive disclosure.** Mostrar primeiro o necessário para a tarefa e revelar detalhes quando solicitados.
7. **Dados críticos legíveis à distância.** Especialmente KDS, caixa, totais e alertas.
8. **Marca sem ruído.** A personalidade deve vir da composição, tipografia, iconografia, microinterações e linguagem — não de excesso de efeitos.

## 3. Design system autoral

### 3.1. Consolidar tokens

A base atual em `globals.css` já possui tokens de superfície, marca e estados. Evoluir para tokens semânticos completos:

- `surface/ground`, `surface/card`, `surface/elevated`, `surface/overlay`;
- `text/primary`, `text/secondary`, `text/muted`, `text/inverse`;
- `border/default`, `border/strong`, `border/focus`;
- `action/primary`, `action/secondary`, `action/danger`;
- `status/success`, `warning`, `danger`, `info`, `neutral`;
- escala padronizada de radius, sombra, espaçamento e duração de animação.

Não espalhar hexadecimais e combinações de classes diferentes pelas páginas. Componentes devem consumir tokens.

### 3.2. Criar biblioteca interna de componentes

Hoje `src/components/ui` contém poucos primitives. Criar, no mínimo:

- `Button` com variantes primary, secondary, ghost e danger;
- `IconButton`;
- `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`;
- `FormField` com label, ajuda e erro;
- `Card`, `StatCard`, `SectionCard`;
- `Badge`/`StatusBadge`;
- `Tabs` e `SegmentedControl`;
- `Dialog`, `ConfirmDialog`, `Drawer/Sheet`;
- `Toast`/central de feedback;
- `DataTable` e `EmptyState`;
- `Skeleton`;
- `PageHeader`, `Toolbar`, `FilterBar`;
- `CommandPalette`;
- `Breadcrumb` quando houver profundidade real.

**Critério:** páginas novas não devem reconstruir botões, inputs, modais e cabeçalhos com dezenas de classes Tailwind locais.

### 3.3. Tipografia

Definir uma escala pequena e deliberada: display, page title, section title, body, label, caption e numeric KPI. Valores financeiros devem continuar usando numerais tabulares.

Evitar excesso de `font-bold`/`font-extrabold` para criar hierarquia. Hierarquia deve combinar tamanho, peso, contraste e espaçamento.

### 3.4. Iconografia

O projeto já usa Lucide. Padronizar Lucide como linguagem funcional e reduzir emojis em controles permanentes. Emojis podem existir em comunicação e onboarding, mas não devem ser a base do sistema de ícones do produto.

Isso torna a interface mais coerente e menos dependente da renderização do sistema operacional.

## 4. Nova arquitetura de navegação

A home atual apresenta três grandes áreas — Cozinha, Caixa e Gestão — o que é conceitualmente bom. Porém a área de gestão exibe muitas opções de uma vez.

### Proposta

Manter três contextos principais:

**Operação** — Caixa, pedidos, salão/mesas, cozinha, perdas.  
**Gestão** — Visão geral, vendas, cardápio, estoque, compras, fornecedores, clientes, equipe, fiscal.  
**Configurações** — Empresa, unidades, usuários e permissões, equipamentos, integrações, assinatura e preferências.

No desktop, usar uma sidebar persistente/recolhível na gestão. No caixa e KDS, usar interfaces dedicadas sem sidebar administrativa roubando espaço.

Adicionar busca/comando global (`Ctrl/Cmd + K`) para abrir telas e ações frequentes: “Novo pedido”, “Buscar cliente”, “Abrir estoque”, “Ficha técnica”, “Fechar caixa”.

### Home pós-login

Transformar a home em **central de trabalho**, não catálogo de links. Mostrar:

- contexto da empresa/unidade;
- usuário e função;
- atalhos principais conforme perfil;
- estado da operação: caixa aberto/fechado, pedidos em produção, alertas críticos;
- “Continuar de onde parei” ou última área utilizada;
- alertas de sincronização/serviço somente quando relevantes.

## 5. Personalidade visual do produto

A direção “industrial” é promissora, mas deve ficar sofisticada e não temática demais.

### Assinatura recomendada

- fundo carvão quase preto;
- cards grafite com contraste por camada, evitando glassmorphism excessivo;
- laranja queimado como ação e assinatura;
- azul técnico reservado a informação/sistema;
- grids, linhas e detalhes de blueprint usados apenas em superfícies especiais;
- bordas finas e contraste limpo;
- números grandes e densos nos painéis operacionais;
- microanimações rápidas de 120–180 ms;
- fotografia/branding do restaurante apenas em onboarding e personalização, não na operação crítica.

O produto deve ser reconhecível sem precisar escrever “industrial” na tela.

## 6. Caixa / PDV — prioridade máxima

O caixa é o maior módulo e merece virar um conjunto de componentes e fluxos independentes.

### Layout operacional

Estruturar em três zonas claras:

1. **Catálogo** — busca, categorias e produtos.
2. **Pedido atual** — itens, quantidades, observações e adicionais.
3. **Resumo/Ação** — cliente, canal, desconto, pagamento e finalizar.

Em telas menores, pedido/resumo podem virar painel deslizante sem perder contexto.

### Melhorias

- busca sempre acessível e com foco por atalho;
- categorias horizontais/sticky;
- produtos com área de toque generosa;
- favoritos/mais vendidos configuráveis;
- feedback imediato ao adicionar item;
- edição inline de quantidade quando seguro;
- adicionais agrupados por decisão, não como lista extensa;
- resumo financeiro sticky;
- CTA “Finalizar pedido” sempre previsível;
- impedir duplo envio e mostrar claramente “enviando”, “confirmado” ou “não sincronizado”;
- confirmação forte para cancelamento, exclusão, desconto excepcional e ações irreversíveis;
- atalhos de teclado documentados para operação rápida;
- estados de pagamento e produção separados visualmente;
- pedidos estacionados visíveis sem competir com o pedido atual.

### Pagamento

Transformar pagamento em fluxo curto e explícito:

`Resumo → forma(s) de pagamento → conferência → confirmação`.

Em pagamento dividido, mostrar saldo restante em destaque e impedir combinações incoerentes antes do envio.

## 7. Cozinha / KDS

KDS deve ser desenhado para leitura rápida a distância.

### Cards de pedido

Hierarquia recomendada:

- número do pedido e canal;
- tempo decorrido;
- itens e quantidades;
- modificações/observações;
- estágio e próxima ação.

Usar cor para **estado**, não para decorar cada card. O tempo pode escalar de neutro → atenção → atraso, sempre acompanhado por texto/ícone para não depender apenas de cor.

### Interação

- cards com largura previsível;
- ação principal grande;
- separar pedidos novos, em preparo e prontos;
- som/alerta configurável por terminal;
- “última atualização” e estado de conexão discretos, mas visíveis;
- preservar último estado válido durante falha de rede com aviso claro;
- modo de alta densidade para picos e modo confortável para operação normal.

O relógio e atualizações frequentes devem ser isolados para não redesenhar toda a tela.

## 8. Dashboard e gestão

O dashboard atual concentra cálculos e múltiplos contextos no cliente. Além da correção técnica de dados, a experiência deve responder perguntas, não apenas exibir números.

### Estrutura

Topo:

- período selecionado;
- faturamento;
- lucro/margem quando confiável;
- CMV;
- ticket médio;
- pedidos.

Depois:

- “O que mudou?” — comparação com período equivalente;
- “Onde agir?” — alertas acionáveis;
- canais e horários;
- produtos e margem;
- despesas/caixa;
- detalhes sob demanda.

Evitar dashboard com dezenas de cards de mesmo peso. KPIs primários devem dominar visualmente.

### Filtros

Criar um `PeriodPicker` único para todas as telas de gestão, com Hoje, Ontem, 7 dias, Este mês e Personalizado. O período deve aparecer de forma consistente e, quando possível, permanecer ao navegar entre relatórios.

## 9. Tabelas e cadastros administrativos

Cardápio, insumos, clientes, colaboradores, compras e fornecedores devem compartilhar um padrão.

### Padrão de tela

`PageHeader → busca/filtros → ação primária → tabela/lista → detalhe em drawer`.

Recursos recomendados:

- pesquisa com debounce;
- filtros salvos quando fizer sentido;
- ordenação previsível;
- paginação/virtualização para grandes listas;
- colunas essenciais por padrão;
- ações secundárias em menu contextual;
- seleção em massa apenas onde há caso real;
- estado vazio que ensina o próximo passo;
- importação com preview e validação antes de gravar;
- formulário dividido em seções lógicas;
- autosave somente onde o comportamento for claro; caso contrário botão Salvar explícito.

## 10. Ficha técnica e precificação — diferencial de produto

Essa área pode ser uma das assinaturas do SaaS.

Criar um **editor de receita em duas colunas**:

- esquerda: ingredientes/subreceitas e quantidades;
- direita: custo em tempo real, CMV, margem e preço sugerido.

Ao alterar um ingrediente, destacar o impacto financeiro imediatamente. Mostrar origem do custo e data da última atualização. Subreceitas devem parecer componentes reutilizáveis, não ingredientes comuns indistinguíveis.

Adicionar simulador de preço com sliders/campos para margem, taxa de canal e impostos/configurações aplicáveis, sempre separando simulação de valor efetivamente publicado.

## 11. Feedback, erros e estados de carregamento

Criar uma linguagem única de feedback.

### Nunca usar vazio como sinônimo de erro

Distinguir:

- carregando;
- sem registros;
- falha ao carregar;
- sem permissão;
- dados desatualizados;
- offline;
- sincronizando;
- salvo;
- ação rejeitada.

### Feedback de ações

- sucesso simples: toast curto;
- erro recuperável: mensagem contextual + “Tentar novamente”;
- erro que bloqueia operação: banner persistente;
- ação destrutiva: confirmação contextual;
- operação longa: progresso ou estado intermediário real.

Mensagens devem dizer o que aconteceu e o que o usuário pode fazer. Evitar mensagens técnicas de banco/API.

## 12. Acessibilidade

Tratar acessibilidade como requisito comercial:

- foco visível consistente;
- navegação completa por teclado nas telas administrativas;
- labels reais em inputs;
- `aria-label` em icon buttons;
- dialogs com foco preso e retorno de foco ao fechar;
- contraste WCAG adequado;
- não comunicar estado somente por cor;
- targets de toque adequados;
- respeitar `prefers-reduced-motion`;
- ordem semântica de títulos;
- mensagens de erro associadas ao campo;
- tabelas com cabeçalhos e leitura coerente.

## 13. Responsividade por contexto

Não tentar fazer a mesma interface simplesmente “encolher”.

- **PDV:** desktop/tablet landscape primeiro; mobile pode ser modo auxiliar.
- **KDS:** telas grandes/tablets landscape; alta legibilidade.
- **Gestão:** desktop e mobile responsivo de verdade.
- **Inventário/perdas:** mobile-first pode ser vantajoso por uso no estoque/cozinha.

Criar breakpoints e layouts conforme tarefa, não apenas dispositivo.

## 14. Personalização para SaaS

Separar identidade do software da identidade do cliente.

Configuração por estabelecimento/unidade:

- nome e logo;
- unidade atual;
- fuso e moeda;
- canais de venda;
- horários;
- impressoras/estações;
- preferências operacionais;
- permissões;
- alertas.

Evitar permitir que cada cliente altere todas as cores do produto. Um SaaS consistente deve preservar sua identidade; logo/nome do estabelecimento e pequenos pontos de personalização são suficientes na primeira versão.

## 15. Onboarding

Criar onboarding guiado para um novo estabelecimento:

1. empresa e unidade;
2. horários e canais;
3. importar/criar cardápio;
4. ingredientes e custos;
5. equipe e permissões;
6. caixa/estações;
7. teste de pedido;
8. checklist “pronto para operar”.

Permitir sair e continuar depois. Mostrar progresso real. Não bloquear todo o ERP por configurações secundárias.

## 16. Ajuda contextual

O projeto já possui ajuda rápida e treinamento. Evoluir para ajuda contextual:

- ícone de ajuda apenas onde necessário;
- explicações curtas junto a conceitos como CMV, margem e sangria;
- tours opcionais, nunca obrigatórios em todo login;
- central pesquisável;
- modo treinamento claramente separado da operação real;
- atalhos de teclado em tooltips e central de comandos.

## 17. Arquitetura frontend para sustentar a UX

A melhoria visual depende de reduzir arquivos monolíticos.

### Refatoração sugerida

Separar cada módulo em:

- `page.tsx` — composição/rota;
- `components/` — UI do módulo;
- `hooks/` — estado e efeitos;
- `services/` ou operações de servidor — acesso a dados;
- `types.ts` — contratos locais quando necessários;
- `utils.ts` — transformações puras.

O estado global não deve obrigar todas as telas a observar o ERP inteiro. Criar seletores/contextos ou stores menores por domínio.

Carregar modais e funções secundárias sob demanda quando a medição mostrar benefício.

## 18. Qualidade visual automatizável

Adicionar ao processo de desenvolvimento:

- ESLint e regras de acessibilidade;
- formatter consistente;
- testes de componentes críticos;
- testes E2E dos fluxos de caixa, cozinha e onboarding;
- snapshots visuais/screenshots dos principais estados em viewport definida;
- auditoria Lighthouse nas telas não operacionais;
- orçamento de bundle para evitar crescimento silencioso.

A suíte atual cobre segurança e arquitetura específica, mas ainda não existe uma camada explícita de testes de interface no `package.json`.

## 19. Microcopy e nomenclatura

Criar glossário do produto. A mesma coisa deve ter o mesmo nome em todo lugar.

Exemplos:

- escolher entre “Caixa”, “PDV” ou uma combinação estável, evitando alternância sem necessidade;
- padronizar “Ficha técnica”, “Receita” e “Produto” conforme significado;
- distinguir “Pedido”, “Venda”, “Pagamento” e “Produção”;
- evitar termos internos da Hum Vício quando o conceito for genérico.

Textos de botão devem representar ação: “Salvar ingrediente”, “Finalizar pedido”, “Fechar caixa”, em vez de “OK” ou “Confirmar” sem contexto.

## 20. Roadmap recomendado

### P0 — fundação antes de redesenhar tudo

- criar tokens semânticos completos;
- construir primitives essenciais;
- criar PageHeader/Toolbar/FilterBar/Feedback padrão;
- definir navegação principal e arquitetura de informação;
- definir glossário e estados semânticos;
- documentar padrões de acessibilidade.

### P1 — operação

- decompor e redesenhar Caixa/PDV;
- decompor e otimizar KDS;
- padronizar feedback de sincronização/offline;
- melhorar pagamento e fechamento de caixa;
- testar operação por toque e teclado.

### P2 — gestão

- criar shell administrativo com sidebar;
- padronizar tabelas/cadastros;
- redesenhar dashboard orientado a decisões;
- transformar ficha técnica/precificação em experiência de destaque;
- aplicar carregamento progressivo e estados independentes.

### P3 — produto SaaS

- seletor/contexto de empresa e unidade;
- onboarding de novo cliente;
- configurações do estabelecimento;
- gestão de usuários/permissões;
- assinatura/plano quando a infraestrutura comercial existir;
- central de ajuda e treinamento contextual.

### P4 — polimento

- motion system;
- command palette;
- preferências de densidade;
- atalhos avançados;
- testes visuais e métricas de UX.

## 21. Métricas para saber se ficou melhor

Não medir apenas “ficou bonito”. Medir:

- tempo para registrar pedido simples;
- toques/cliques por pedido;
- tempo para localizar produto;
- erros/correções antes de finalizar;
- tempo para treinar novo operador;
- tempo para concluir inventário;
- tempo para cadastrar ficha técnica;
- taxa de abandono do onboarding;
- frequência de erros de sincronização percebidos pelo usuário;
- tempo de carregamento até a tarefa principal estar utilizável;
- número de tickets de suporte por fluxo.

## 22. Critério de interface pronta para piloto externo

Antes de colocar outra hamburgueria no sistema:

- componentes essenciais padronizados;
- navegação compreensível sem conhecer a Hum Vício;
- Caixa e KDS testados em equipamento real;
- estados de erro/offline/sincronização claros;
- acessibilidade básica validada;
- onboarding capaz de configurar uma loja sem alterar código;
- nenhuma tela essencial depende de conhecimento interno da Hum Vício;
- identidade da loja cliente separada da identidade do produto;
- principais tarefas observadas com usuários que não participaram do desenvolvimento.

## 23. Resultado esperado

A meta não é transformar o ERP em um dashboard genérico de SaaS. É preservar o caráter operacional que nasceu dentro de uma hamburgueria e dar a ele uma linguagem consistente de produto.

O diferencial visual deve ser: **industrial, preciso, rápido e gastronômico sem ser caricato**. O diferencial de UX deve ser ainda mais importante: o sistema entende a sequência real do trabalho de uma hamburgueria e reduz decisões, cliques e ambiguidade durante a operação.
