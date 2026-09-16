# Revisão técnica atualizada do ERP

**Data:** 16/09/2026  
**Referência do código:** commit `127b97b`, sem alterações locais no início da revisão.  
**Objetivo:** identificar as melhorias ainda necessárias na versão atual, reconhecendo
o trabalho já implementado e priorizando os riscos operacionais.

## 1. Escopo e resultado da verificação

Foram examinados código de autenticação e autorização, rotas de vendas e caixa,
migrações SQL, sincronização, treinamento, backup, componentes e testes.

| Verificação executada | Resultado |
|---|---|
| `npm test` | **19 testes aprovados** |
| `npm run typecheck` | **Aprovado** |
| Política de permissão para caixa alterar `sales.total` | **Permitiu**, em chamada local da função de autorização |
| Política de permissão para caixa alterar venda para `cancelled` | **Permitiu**, em chamada local da função de autorização |
| Verificador de backup recebendo `{ tables: {} }` | **Aprovou**, sem tabelas ou checksums |
| Comparação das migrações e operações SQL | Encontrada divergência `old_value` / `previous_value` |

**Limites:** não houve acesso ao banco de produção, aplicação de migrações,
execução de vendas reais, teste de impressão, teste visual no navegador ou nova
compilação de produção. Os testes automatizados usam substitutos do banco; não
executam as funções SQL em PostgreSQL real. Os scripts de auditoria contra a
base configurada e de backup real não foram executados.

As datas nos nomes das migrações `20260917` e `20260918` são identificadores dos
arquivos encontrados; não comprovam aplicação ou validação dessas migrações.

**Conclusão:** a base evoluiu, mas passar nos testes atuais ainda não garante
integridade financeira, isolamento do treinamento ou recuperação de dados.

## 2. O que já existe e deve ser aproveitado

| Frente | Situação encontrada | Trabalho restante |
|---|---|---|
| Segurança de acesso | Hashes, sessões revogáveis, limitação no login e autorização no servidor | Fechar caminhos alternativos e verificar configuração real |
| Venda transacional | Rota de checkout e função SQL com chave de idempotência | Corrigir validação comercial, persistência e compatibilidade do esquema |
| Caixa e pagamentos | Rotas e funções SQL para fechamento, movimentação, quitação e cancelamento | Consolidar conciliação, estados e concorrência |
| Atendimento simultâneo | Rascunhos de pedidos e testes específicos | Validar persistência e separação de contexto |
| Produção | Regras de transição e testes locais | Impor regras também no servidor |
| Treinamento | Banner, exercícios e armazenamento separado para parte dos fluxos | Garantir isolamento de todas as operações |
| Sincronização | Fila, indicadores de conexão e reenvio pelo checkout | Diferenciar rejeição, autenticação e indisponibilidade |
| Backup | Exportador JSON e verificador de integridade | Garantir completude, consistência e restauração efetiva |
| Arquitetura | Tipos e algumas regras extraídos do armazenamento central | Continuar a separação e remover duplicações |

Este relatório substitui a ideia de que essas frentes precisam começar do zero.
O foco agora é concluir e validar as implementações existentes.

## 3. Prioridades

**P0:** corrigir antes de confiar na proteção ou recuperação operacional.  
**P1:** corrigir antes de ampliar o uso e a carteira de clientes.  
**P2:** melhorias de manutenção, experiência e preparação comercial.

| ID | Prioridade | Melhoria necessária | Evidência |
|---|---|---|---|
| R01 | P0 | Bloquear alterações financeiras pela API genérica | Confirmada no código e na política executada localmente |
| R02 | P0 | Compatibilizar funções SQL com o esquema versionado | Divergência confirmada entre arquivos |
| R03 | P0 | Impedir aprovação de backup incompleto | Confirmada no código e em verificação local |
| R04 | P1 | Validar preços e descontos a partir do cadastro oficial | Confirmada no fluxo de checkout |
| R05 | P1 | Persistir todos os estados de pagamento e vínculo ao turno | Lacunas confirmadas no INSERT do checkout |
| R06 | P1 | Unificar quitações e validar caixa aberto | Lacunas confirmadas nas funções de pagamento |
| R07 | P1 | Recalcular fechamento e confirmar sucesso no servidor | Confirmada na rota, SQL e interface |
| R08 | P1 | Diferenciar falha de rede de operação rejeitada | Confirmada no checkout do navegador |
| R09 | P1 | Estornar a movimentação original, inclusive adicionais | Confirmada no SQL de estoque |
| R10 | P1 | Tornar a edição de pedidos transacional | Confirmada no fluxo de reabertura |
| R11 | P1 | Completar o isolamento do treinamento | Proteção parcial confirmada; impacto real não testado |
| R12 | P1 | Associar idempotência ao conteúdo e ao contexto | Lacuna confirmada na tabela e na função SQL |
| R13 | P1 | Limitar tentativas de autorização do supervisor | Ausência confirmada na rota de cancelamento |
| R14 | P1 | Testar migrações, concorrência e permissões no banco real | Suíte atual usa banco simulado |
| R15 | P2 | Restringir origens e exposição de erros e segredos | Confirmada nas configurações e armazenamento local |
| R16 | P2 | Impor estados de produção no servidor e reconciliar telas | Regras locais e escrita genérica coexistem |
| R17 | P2 | Completar acessibilidade e padronizar mensagens | Confirmada no componente de gaveta; avaliação visual pendente |
| R18 | P2 | Reduzir módulos grandes e consultas repetidas | Confirmada na estrutura atual |
| R19 | P1 para comercialização | Isolar empresas antes de atender outros estabelecimentos | Não encontrado modelo de isolamento no código revisado |

## 4. Correções críticas

### R01 — Fechar os caminhos alternativos de gravação

**Evidências:** `src/lib/security/data-policy.mjs`,
`src/app/api/data/[table]/route.ts` e `src/app/api/sales/cancel/route.ts`.

A rota específica de cancelamento exige supervisor quando o usuário é caixa.
Entretanto, a política da API genérica permite que esse mesmo perfil faça PATCH
em `sales`, incluindo `status: 'cancelled'` e `total: 0`. Também permite gravações
em itens, sessões de caixa e movimentos fora das operações específicas.

Isso oferece um caminho que não passa pelas verificações e transações novas.
O comportamento da política foi reproduzido localmente; não foi enviado PATCH
ao banco real.

- [ ] Retirar da API genérica as mutações financeiras já atendidas por operações específicas.
- [ ] Criar operações explícitas para os fluxos restantes, como edição e abertura de caixa.
- [ ] Manter listas restritas de campos nas atualizações operacionais permitidas.
- [ ] Garantir auditoria na mesma transação da ação, sem depender do navegador.
- [ ] Testar o bloqueio do caminho alternativo para todos os perfis pertinentes.

**Aceite:** nenhuma chamada direta à API genérica altera total, pagamento,
cancelamento ou fechamento contornando a operação autorizada.

### R02 — Corrigir incompatibilidades do esquema SQL

**Evidências:** `supabase/migrations/20260903_database_audit_hardening.sql:51`,
`supabase/migrations/20260917_atomic_sales_and_idempotency.sql:271` e
`supabase/migrations/20260918_cash_closure_and_action_authorization.sql:88`.

O esquema versionado de `audit_logs` define `old_value`. As novas funções de
venda, fechamento, movimentação, quitação e cancelamento inserem `previous_value`.
Não foi encontrada uma migração correspondente criando ou renomeando essa coluna.

Se o banco seguir esse esquema, a execução das funções poderá falhar na auditoria
e desfazer a transação. Os testes com banco simulado não detectam essa incompatibilidade.

- [ ] Padronizar o nome da coluna em esquema, funções e consultas.
- [ ] Ensaiar a sequência completa de scripts, inclusive os arquivos SQL da raiz.
- [ ] Verificar todas as colunas, tipos, funções e triggers exigidos pelas novas operações.
- [ ] Validar instalação em banco vazio e atualização de uma versão anterior.

**Aceite:** executar checkout, fechamento, movimentação, quitação e cancelamento
em PostgreSQL de teste sem colunas ausentes, preservando a auditoria.

### R03 — Garantir backup completo e recuperação comprovada

**Evidências:** `scripts/backup.mjs:11`, `scripts/backup.mjs:58`,
`scripts/restore-verify.mjs:24` e `scripts/restore-verify.mjs:126`.

Problemas encontrados:

- A exportação faz uma consulta por tabela sem paginação, ficando sujeita ao limite
  de linhas configurado na API do banco.
- A lista inclui `customers` e `daily_checklists`, enquanto o ERP usa
  `imported_customers` e `kitchen_checklists`.
- Não cobre todo o estado operacional: faltam, por exemplo, tabelas de salão,
  diárias e chaves de idempotência. Definir explicitamente o tratamento de sessões.
- Falhas de leitura viram tabelas vazias e não necessariamente impedem a geração.
- Consultas independentes não representam, por si, um retrato consistente durante vendas.
- O verificador aceita `{ tables: {} }`, não exige todos os checksums nem verifica
  o checksum global gerado pelo exportador.
- `backup:verify` inspeciona JSON; não restaura um banco nem valida funções e triggers.

- [ ] Corrigir o inventário de tabelas e exigir um manifesto com versão e contagens.
- [ ] Paginar com ordem estável ou adotar backup consistente do banco.
- [ ] Reprovar exportações parciais, falhas de leitura e ausência de tabelas obrigatórias.
- [ ] Verificar checksums, estrutura, referências e consistência financeira.
- [ ] Proteger os arquivos exportados, que contêm dados pessoais e hashes de credenciais.
- [ ] Criar e testar restauração em ambiente separado, incluindo esquema e permissões.
- [ ] Medir tempo de recuperação e perda máxima de dados tolerável.

**Aceite:** base com mais registros que o limite de resposta exportada integralmente;
falha de uma tabela reprova o backup; restauração permite operar o ERP de teste.

## 5. Integridade financeira e operacional

### R04 — Recalcular preços e controlar concessões no servidor

**Evidências:** `src/app/api/sales/checkout/route.ts` e função
`process_sale_checkout` na migração `20260917`.

A validação compara total com subtotal, desconto e taxa enviados pelo navegador.
Não comprova que o subtotal corresponde aos itens nem consulta o preço oficial
para definir o valor gravado. O SQL usa `unitPrice` e `total` recebidos; o parâmetro
de perfil não estabelece, na função revisada, uma política de desconto.

- [ ] Buscar preço, disponibilidade e composição pelo identificador do produto.
- [ ] Calcular adicionais, brindes, descontos, taxas e total no servidor.
- [ ] Validar valores finitos, limites de itens e formas de pagamento permitidas.
- [ ] Definir limites e autorização para descontos e brindes.
- [ ] Usar precisão monetária e arredondamento padronizados.

**Aceite:** adulterar preço ou subtotal mantendo a conta matematicamente coerente
não produz uma venda indevida.

### R05 — Completar a persistência do checkout

**Evidência:** INSERT de `sales` em `20260917_atomic_sales_and_idempotency.sql:139`.

O cliente envia campos como `paymentStatus`, `paidAt`, `paidMethod`, `creditStatus`
e dados de fiado/colaborador. O INSERT revisado não persiste vários desses campos;
a resposta, porém, devolve o objeto recebido acrescido de outros valores. Isso pode
fazer a interface parecer correta até recarregar ou consultar em outro terminal.
O checkout também não valida nem associa explicitamente o turno de caixa ativo.

- [ ] Definir um contrato único entre requisição, persistência e resposta.
- [ ] Persistir dados de pagamento e crédito necessários ao negócio.
- [ ] Vincular venda e eventos financeiros ao turno correto, validando que esteja aberto.
- [ ] Retornar o estado efetivamente persistido.
- [ ] Registrar o pagamento inicial no histórico financeiro quando aplicável.

**Aceite:** venda paga, retirada pendente e fiado conservam o mesmo estado após
recarregamento e consulta por outro terminal.

### R06 — Evitar quitações incompatíveis e movimentos fora de turno

**Evidências:** `src/app/api/sales/settle/route.ts`,
`src/app/api/cash/movement/route.ts` e migração `20260918`.

Fiado e retirada verificam campos distintos de quitação, sem validar completamente
se a venda pertence à modalidade solicitada. Alternar o tipo pode permitir novo
recebimento de uma venda já liquidada por outra modalidade. A quitação não valida
o estado aberto da sessão; a movimentação aceita sessão ausente. A consulta da
sessão na movimentação não usa o mesmo bloqueio de concorrência do fechamento.

- [ ] Criar uma regra única de saldo devido e recebimentos já realizados.
- [ ] Validar modalidade, forma de pagamento, saldo e turno dentro da transação.
- [ ] Coordenar os bloqueios de quitação, movimento e fechamento.
- [ ] Exigir identificador de operação para evitar duplicação de sangrias e suprimentos.
- [ ] Distinguir registro de estorno de uma eventual devolução efetiva pelo provedor.

**Aceite:** não quitar duas vezes alternando modalidade; não movimentar caixa
encerrado; reenvio não duplica dinheiro em caixa.

### R07 — Fechamento autoritativo e confirmação confiável

**Evidências:** `src/app/api/cash/close/route.ts`, função
`close_cash_session_transaction` e `src/lib/store.ts:1668`.

O fechamento aceita valor esperado e diferença calculados pelo navegador. O SQL
os grava sem conciliá-los com as operações registradas. Na interface, uma resposta
de erro é registrada no console, mas o fluxo continua atualizando o turno como
fechado e limpando a sessão local.

- [ ] Calcular valores esperados no servidor a partir das operações oficiais.
- [ ] Aceitar do operador apenas a contagem e as justificativas apropriadas.
- [ ] Confirmar o encerramento local somente após sucesso no servidor.
- [ ] Preservar os dados preenchidos e apresentar erro acionável em caso de falha.

**Aceite:** erro de rede ou rejeição do fechamento mantém o turno e a contagem
disponíveis; valores esperados adulterados não alteram a conciliação oficial.

### R08 — Tratar rejeição de venda separadamente de modo offline

**Evidências:** `src/lib/store.ts`, funções `addSale` e `syncOfflineSalesQueue`.

O envio inicial transforma qualquer resposta HTTP sem sucesso em `null` e segue
como operação offline. Isso mistura falta de conexão com rejeição por dados
inválidos, acesso negado ou sessão expirada. A fila continua em `localStorage`;
falhas de gravação são registradas, sem garantia de que o usuário saiba que o
pedido não foi preservado. O reenvio utiliza a sessão que estiver ativa naquele momento.

- [ ] Separar estados de erro de validação, autenticação, autorização e rede.
- [ ] Só enfileirar situações com política de contingência definida.
- [ ] Confirmar persistência durável antes de informar que o pedido foi salvo.
- [ ] Vincular pendências ao operador e ao turno de origem.
- [ ] Reconciliar respostas tardias de pedidos já concluídos no servidor.
- [ ] Corrigir o contrato de erro: a API retorna `message`, enquanto há leitura de `error`.

**Aceite:** uma venda rejeitada não aparece como aceita offline; troca de usuário
não altera silenciosamente a autoria das operações pendentes.

### R09 — Estorno baseado no consumo original

**Evidências:** `20260917_atomic_sales_and_idempotency.sql:43` e baixa de adicionais
na mesma migração.

O checkout baixa adicionais, mas o trigger de cancelamento percorre a receita
básica atual. Ele seleciona `additionals`, porém não os processa no estorno.
Uma ficha técnica alterada após a venda também muda a quantidade devolvida.
A busca de adicionais ainda usa nomes e `LIMIT 1`, podendo ignorar componentes.

- [ ] Vincular adicionais por identificador e composição completa.
- [ ] Estornar as movimentações originais registradas para a venda.
- [ ] Definir a regra para produtos já preparados e perdas em cancelamentos.
- [ ] Evitar que alterações posteriores da receita modifiquem o histórico.

**Aceite:** cancelar pedido com adicionais repõe exatamente o consumo autorizado
pela política, mesmo após uma mudança na ficha técnica.

### R10 — Editar pedidos com transação e ajuste de estoque

**Evidência:** `src/lib/store.ts`, função `updateReopenedOrder`.

A edição ainda atualiza cabeçalho e itens em chamadas separadas, modifica a tela
antes da confirmação e não realiza uma reconciliação transacional do consumo.
A tentativa de desvincular itens com `sale_id: null` é negada aos perfis não
administradores pela política atual, podendo deixar tela e banco divergentes.

- [ ] Criar operação de edição com versão do pedido e detecção de conflito.
- [ ] Recalcular total, diferença de estoque e eventual saldo de pagamento.
- [ ] Guardar histórico e notificar a cozinha da alteração persistida.
- [ ] Tratar remoção de todos os itens e pedidos já pagos ou em preparo.

**Aceite:** inclusão, remoção e alteração de quantidades atualizam pedido, estoque,
pagamento e cozinha de forma consistente.

## 6. Segurança, treinamento e testes

### R11 — Isolar integralmente o treinamento

**Evidências:** `src/lib/training.ts` e `src/lib/store.ts`.

Há desvios específicos para treino em venda, caixa e outros fluxos, mas o modo
é controlado por armazenamento local. Ativá-lo mescla vendas de treinamento ao
estado existente. Funções como registro de perdas e mudanças de produção ainda
possuem caminhos de gravação sem uma proteção de treinamento correspondente.

- [ ] Separar completamente os dados apresentados em treino e produção.
- [ ] Usar ambiente ou camada de dados de treinamento que não escreva em produção.
- [ ] Cobrir perdas, estoque, edição, produção, mesas, fiscal e sincronização.
- [ ] Definir o que ocorre com pedidos abertos ao entrar e sair do treino.

**Aceite:** executar todos os exercícios e ações acessíveis em treinamento não
modifica nenhuma tabela operacional real. Esse teste ainda precisa ser feito.

### R12 — Fortalecer idempotência

**Evidência:** `idempotency_keys` e `process_sale_checkout` na migração `20260917`.

A função reutiliza uma resposta por chave, sem comparar o conteúdo do pedido nem
associar a chave ao contexto do operador/empresa. A estrutura já reduz duplicação,
mas não resolve reutilização da mesma chave para requisições diferentes.

- [ ] Armazenar assinatura do conteúdo e contexto da operação.
- [ ] Rejeitar a mesma chave com payload diferente.
- [ ] Definir retenção compatível com o tempo máximo de reenvio offline.
- [ ] Testar requisições concorrentes contra o banco real.

**Aceite:** repetição legítima retorna o resultado original; mudança do pedido
com a mesma chave é identificada como conflito.

### R13 — Limitar tentativas de senha de supervisor

**Evidência:** `src/app/api/sales/cancel/route.ts:35`.

A rota verifica hashes de supervisores, mas não chama o limitador de tentativas
usado no login. Um usuário de caixa autenticado pode fazer tentativas repetidas.

- [ ] Aplicar limite por operador, contexto e autorização solicitada.
- [ ] Registrar tentativas sem armazenar ou expor a senha.
- [ ] Vincular a autorização ao pedido e à ação executada.

**Aceite:** sucessivas tentativas incorretas são limitadas sem bloquear
indiscriminadamente toda a operação.

### R14 — Ampliar os testes para os riscos reais

**Evidências:** `tests/security.test.mjs`, `tests/parked-orders-and-architecture.test.mjs`
e `tests/audit-public-lockdown.mjs`.

Os 19 testes passaram, mas os testes de checkout, pagamento e backup usam dados
simulados. O script de acesso público considera erros genéricos e resultados
vazios como evidência de bloqueio; também tenta inserir um administrador na base
configurada. Ele não foi executado nesta revisão.

- [ ] Criar banco descartável para testar migrações e transações de verdade.
- [ ] Cobrir os cenários de R01 a R13, incluindo falhas e concorrência.
- [ ] Distinguir negação de acesso de erro de rede, tabela inexistente e base vazia.
- [ ] Exigir ambiente de teste explícito para auditorias que tentam gravar registros.
- [ ] Adicionar testes de ponta a ponta para caixa, cozinha e recuperação de falhas.
- [ ] Automatizar verificações antes de publicar novas versões.

**Aceite:** testes detectam os caminhos alternativos, a divergência SQL e o
backup vazio encontrados nesta revisão.

### R15 — Reduzir exposição de origens, erros e segredos

**Evidências:** `next.config.ts`, `src/app/api/health/route.ts`, `src/lib/logger.ts`,
`src/lib/fiscal.ts` e `src/lib/notifications.ts`.

- [ ] Revisar o curinga `*.vercel.app` e permitir apenas origens controladas necessárias.
- [ ] Evitar retornar mensagens internas do banco no endpoint público de saúde.
- [ ] Padronizar respostas de erro sem expor detalhes SQL ao operador.
- [ ] Aplicar sanitização também a mensagens de exceção, não só aos campos estruturados.
- [ ] Retirar tokens fiscais e segredos de integrações do armazenamento do navegador.
- [ ] Definir proteção e rotação das URLs de webhook que funcionem como credenciais.

**Aceite:** diagnóstico público não expõe detalhes internos; dados sensíveis não
aparecem em logs, respostas ou armazenamento acessível aos operadores.

## 7. Experiência de uso e manutenção

### R16 — Validar estados de produção no servidor

**Evidências:** `src/lib/store/production-rules.ts`, `src/lib/store.ts` e API genérica.

A validação de transições aparece no cliente, inclusive com uma implementação
local que duplica a função extraída. A API permite alterar campos de produção
sem validar a transição contra o estado persistido.

- [ ] Criar operação de transição no servidor com controle de concorrência.
- [ ] Usar uma regra única e retornar o estado confirmado.
- [ ] Reconciliar falhas de gravação antes de mostrar o pedido como concluído.

**Aceite:** uma chamada direta não reabre ou conclui pedidos em estados proibidos.

### R17 — Completar acessibilidade e comunicação operacional

**Evidência:** `src/components/ui/SlidingSheet.tsx`.

- [ ] Implementar semântica de diálogo, foco inicial, contenção de foco e devolução
  ao elemento que abriu a gaveta.
- [ ] Avisar antes de descartar formulários alterados.
- [ ] Revisar textos pequenos, contraste, toque e atalhos nos dispositivos reais.
- [ ] Padronizar erro, salvamento pendente e confirmação nas telas.

**Aceite:** operadores usam os fluxos principais com teclado e toque e distinguem
claramente operação confirmada de operação pendente ou rejeitada.

### R18 — Continuar a separação de módulos e medir desempenho

**Evidências:** `src/lib/store.ts` com aproximadamente **2.918 linhas** e
`src/app/(modules)/caixa/page.tsx` com aproximadamente **6.880 linhas** nesta revisão.

- [ ] Extrair serviços de venda, caixa, produção, estoque e sincronização.
- [ ] Remover duplicações entre regras extraídas e implementações locais.
- [ ] Dividir a tela de caixa por responsabilidades sem reescrever todos os fluxos de uma vez.
- [ ] Paginar históricos e carregar somente os dados necessários a cada perfil.
- [ ] Evitar sobreposição de consultas periódicas e medir carga com vários terminais.
- [ ] Adotar identificador da operação para rastrear erro entre interface, API e banco.

**Aceite:** regras podem ser testadas sem montar a tela inteira; consultas e
latência atendem metas definidas após medição no equipamento utilizado.

### R19 — Preparação para outros estabelecimentos

Não foi encontrado isolamento por empresa nas tabelas e autorizações revisadas.
As novas transações não substituem essa necessidade.

- [ ] Definir empresa, unidades e vínculos de usuários.
- [ ] Isolar dados, filas, arquivos, sessões e auditoria por estabelecimento.
- [ ] Testar acessos cruzados e impedir relacionamentos entre empresas diferentes.
- [ ] Só depois integrar contratação pública, planos e cobrança ao ERP.

**Aceite:** dois estabelecimentos operam simultaneamente sem acesso aos dados
um do outro. Detalhamento comercial: [plano SaaS](PLANO-COMERCIAL-SAAS.md).

## 8. Ordem recomendada de execução

1. **Eliminar caminhos alternativos:** R01 e R13.
2. **Validar o banco versionado:** R02 e testes reais da R14.
3. **Garantir recuperação:** R03.
4. **Consolidar venda, pagamento e fechamento:** R04 a R07.
5. **Consolidar contingência, estoque e edição:** R08 a R12.
6. **Completar segurança operacional, produção e uso:** R15 a R17.
7. **Evoluir arquitetura e comercialização:** R18 e R19.

A cada correção, acrescentar o teste que reproduz o problema e registrar o
resultado no ambiente de homologação. Não marcar uma frente como concluída
apenas porque existe uma rota, uma função SQL ou um teste com banco simulado.

## 9. O que permanece dependente de verificação externa

- Aplicação efetiva das migrações e esquema real do banco.
- Permissões, funções e triggers efetivamente ativos em produção.
- Configuração de segredos, origens e hospedagem.
- Restauração de backup real e atendimento às metas de recuperação.
- Impressão térmica, conexão instável e uso simultâneo nos equipamentos do estabelecimento.
- Usabilidade com operadores e eventual operação comercial com clientes externos.

**Entrega desta revisão:** diagnóstico e lista de trabalho. Nenhum código
operacional, configuração de produção ou dado real foi alterado.
