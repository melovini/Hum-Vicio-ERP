# Hum Vício ERP — próximas melhorias necessárias

**Atualizado em:** 16/09/2026  
**Base analisada:** `main` no commit `bcb8a7f`  
**Objetivo:** orientar os próximos blocos de implementação após a criação do design system, feedback global, primeira tela administrativa migrada e shell de navegação da Gestão.

## 1. Estado atual

### Concluído na fundação de interface

- tokens semânticos de superfície, texto, borda, ação e estado;
- primitives de botão, formulário, cards, badges, skeleton e estado vazio;
- Dialog, ConfirmDialog e SlidingSheet com requisitos básicos de foco;
- sistema global de notificações;
- PageHeader, Toolbar e FilterBar;
- navegação persistente das rotas administrativas;
- primeira migração completa na tela de Fornecedores;
- documentação inicial em `DESIGN-SYSTEM.md`;
- 22 testes automatizados e build de produção funcional.

### Leitura de maturidade

A fundação do P0 está avançada, mas ainda não está consolidada no produto inteiro. Os componentes existem; a maioria das telas ainda usa padrões locais, `alert()`, `confirm()`, inputs, modais, cabeçalhos e estados de carregamento próprios.

O próximo objetivo não deve ser criar mais primitives sem uso real. Deve ser **adotar, testar e estabilizar o sistema existente nos fluxos mais importantes**.

## 2. Prioridade imediata — estabilização do P0

### Bloco 1 — validação visual e testes de interface

**Situação:** infraestrutura implementada no bloco seguinte ao commit `7cb623c`, com Playwright, axe, sessão isolada, viewports desktop/mobile, cenários de Fornecedores e workflow de qualidade. A ampliação para tablet e mais telas continua incremental.

**Motivo:** typecheck, testes de negócio e build não confirmam foco, contraste, corte de conteúdo, comportamento mobile ou aparência.

Implementar:

- ambiente de testes E2E com Playwright;
- fluxo autenticado de teste sem usar produção;
- testes de teclado para Dialog, ConfirmDialog, SlidingSheet e sidebar;
- screenshots de Fornecedores em desktop e mobile;
- estados testados: carregando, vazio, com resultados, filtro sem resultado, erro ao salvar e erro ao excluir;
- validação em 360 px, tablet e desktop;
- auditoria inicial com axe ou biblioteca equivalente;
- CI executando typecheck, testes, build e E2E crítico.

**Critério de aceite:** navegação completa por teclado, ausência de corte horizontal, screenshots estáveis e fluxo de Fornecedores passando sem banco de produção.

### Bloco 2 — estabilizar os componentes recém-criados

Implementar:

- impedir fechamento de Dialog durante operação assíncrona por API explícita, não apenas por callback local;
- padronizar foco inicial configurável;
- tratar diálogos empilhados e confirmar a estratégia entre portal e `dialog.showModal()`;
- adicionar limite, deduplicação e limpeza de notificações na troca de rota;
- permitir ação opcional no toast, como “Tentar novamente”;
- documentar quais componentes são client components;
- testes unitários para fila e duração das notificações;
- testar `prefers-reduced-motion` em animações reais.

**Critério de aceite:** componentes críticos possuem contrato estável, exemplos documentados e testes de interação.

### Bloco 3 — glossário e microcopy

Criar `GLOSSARIO-PRODUTO.md` e padronizar:

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

Revisar botões genéricos como “OK”, “Confirmar” e “Salvar” para verbos específicos: “Salvar fornecedor”, “Finalizar pedido”, “Fechar caixa” e “Excluir lançamento”.

**Critério de aceite:** o mesmo conceito possui o mesmo nome na home, sidebar, tela, ajuda e mensagens.

## 3. Padronização das telas administrativas

Executar uma tela por bloco, evitando uma alteração gigantesca.

### Ordem recomendada

1. **Insumos** — alto uso e relação direta com estoque e ficha técnica.
2. **Compras** — conecta fornecedores, custos e atualização de estoque.
3. **Inventário físico** — beneficia-se de experiência mobile-first.
4. **Fichas técnicas** — futuro diferencial comercial do SaaS.
5. **Precificação** — deve compartilhar cálculos e linguagem com ficha técnica.
6. **Clientes** — pesquisa, filtros, segmentação e histórico.
7. **Colaboradores** — permissões, PINs e dados sensíveis.
8. **Fiscal e Auditoria** — ações sensíveis e mensagens de erro rigorosas.

### Padrão mínimo por tela

- PageHeader integrado ao shell, sem botão duplicado de voltar;
- FilterBar quando houver consulta;
- Skeleton, EmptyState, erro, sem permissão e dados desatualizados distintos;
- Dialog/SlidingSheet para cadastro e detalhe;
- ConfirmDialog para ações destrutivas;
- feedback somente após confirmação do servidor;
- bloqueio contra envio duplicado;
- preservação de formulário após falha;
- cards e tabelas com tokens, sem novos hexadecimais locais;
- navegação por teclado e targets de toque adequados;
- teste automatizado da transformação/filtro principal.

## 4. Arquitetura frontend necessária

### Reduzir arquivos monolíticos

Prioridade técnica:

- decompor `caixa/page.tsx` por domínio e fluxo;
- decompor Cozinha/KDS, Cardápio, Colaboradores e Dashboard;
- mover transformações puras para arquivos testáveis;
- separar componentes, hooks, tipos e acesso a dados;
- carregar modais secundários sob demanda quando medição justificar;
- impedir que relógios e polling redesenhem módulos inteiros.

Estrutura sugerida por módulo:

```text
modulo/
  page.tsx
  components/
  hooks/
  services/
  types.ts
  utils.ts
```

### Diminuir dependência da store global

- criar seletores ou stores por domínio;
- evitar que uma tela observe dados que não utiliza;
- manter regras financeiras e de estoque fora dos componentes React;
- fazer operações retornarem sucesso/erro estruturado ou lançarem erro de forma consistente;
- remover `alert()` e `confirm()` das funções de dados;
- usar atualização funcional de estado para evitar closures antigas;
- definir política única de rollback otimista.

**Critério de aceite:** alterações em um domínio não provocam renderizações ou regressões em módulos não relacionados.

## 5. P1 — operação: Caixa e Cozinha

Esta fase só deve começar depois dos testes básicos do design system.

### Caixa / PDV

- separar catálogo, pedido atual e resumo/finalização;
- preservar pedido durante falha de rede;
- distinguir pagamento, venda e produção;
- substituir confirmações nativas por fluxos contextuais;
- impedir duplo checkout visual e no servidor;
- melhorar pagamento dividido e saldo restante;
- documentar atalhos de teclado;
- medir tempo e quantidade de ações para pedido simples;
- validar em tablet landscape e equipamentos reais da loja.

### Cozinha / KDS

- separar visualmente novos, em preparo e prontos;
- priorizar número, canal, tempo, itens e modificações;
- manter último estado válido durante perda de conexão;
- exibir última atualização e estado de sincronização;
- isolar relógio e polling para reduzir renderizações;
- criar modos confortável e alta densidade;
- testar leitura à distância, toque e som por estação.

## 6. P2 — diferenciais de gestão

### Dashboard orientado a decisões

- usar período consistente em todos os relatórios;
- responder “o que aconteceu?”, “o que mudou?” e “onde agir?”;
- calcular indicadores confiáveis no servidor;
- não limitar análise ao recorte carregado pela store;
- exibir origem, período e confiabilidade dos dados.

### Ficha técnica e precificação

- editor em duas colunas;
- ingredientes e sub-receitas à esquerda;
- custo, CMV, margem e preço sugerido em tempo real à direita;
- indicar origem e data do custo;
- separar simulação do valor publicado;
- incluir taxas por canal e impostos configuráveis;
- mostrar impacto financeiro de cada alteração.

## 7. Preparação obrigatória para SaaS

Estas frentes continuam sendo os maiores bloqueadores para um piloto externo:

1. isolamento multiempresa e por unidade;
2. escopo `tenant_id` em todas as tabelas e operações;
3. usuários, papéis e permissões configuráveis;
4. onboarding de uma nova hamburgueria sem alteração de código;
5. configurações de moeda, fuso, canais, horários e estações;
6. logs de auditoria por empresa e usuário;
7. backup, restauração e retenção por cliente;
8. LGPD: finalidade, acesso, exportação e exclusão;
9. observabilidade e suporte sem exposição de dados;
10. assinatura e cobrança somente após isolamento e segurança.

**Regra arquitetural:** a Hum Vício deve continuar como cliente zero. Qualquer regra nova precisa ser classificada como regra do produto, configuração do estabelecimento ou particularidade da Hum Vício.

## 8. Sequência recomendada dos próximos commits

| Ordem | Bloco | Resultado esperado |
| --- | --- | --- |
| 1 | Playwright + acessibilidade básica | Fundação validável no navegador |
| 2 | Robustez de Dialog/Toast/Sheet | Contratos estáveis para migração |
| 3 | Glossário e microcopy | Linguagem única do produto |
| 4 | Migração de Insumos | Segundo cadastro padronizado |
| 5 | Migração de Compras | Fluxo fornecedor → compra → custo |
| 6 | Inventário mobile-first | Uso prático no estoque/cozinha |
| 7 | Ficha técnica e precificação | Diferencial comercial do SaaS |
| 8 | Decomposição inicial do Caixa | Preparação segura para redesenho |
| 9 | Redesenho incremental do Caixa | Operação mais rápida e confiável |
| 10 | KDS e sincronização | Produção legível e resiliente |

## 9. Definição de pronto para cada bloco

Um bloco só deve ser considerado concluído quando:

- escopo e risco estiverem documentados;
- TypeScript estiver aprovado;
- testes existentes permanecerem aprovados;
- houver teste novo para a regra introduzida;
- build de produção estiver aprovado;
- comportamento de sucesso, vazio, falha e carregamento estiver definido;
- teclado e mobile tiverem sido verificados;
- não houver dados sensíveis em mensagens;
- documentação e glossário forem atualizados;
- o commit puder ser revertido isoladamente.

## 10. Próximo bloco recomendado

O próximo bloco deve ser **Playwright e validação real da fundação de interface**.

Já há componentes e uma tela migrada suficientes para testar o sistema em condições reais. Continuar migrando telas sem essa camada aumentaria o custo de corrigir um problema de foco, modal, responsividade ou tokens caso ele esteja repetido em toda a aplicação.
