# Próximas melhorias técnicas — Hum Vício ERP

Atualizado em: 16/09/2026.

## Objetivo

Tornar a operação de caixa, cozinha e gestão mais intuitiva, segura e confiável,
inclusive durante períodos de movimento intenso ou instabilidade de conexão.

Este documento organiza o trabalho restante após as correções de segurança da
etapa 1. É um plano de implementação: os itens pendentes não devem ser tratados
como funcionalidades já disponíveis ou verificadas em produção.

## Situação atual

- As correções da etapa 1 foram implementadas no código: autorização no servidor,
  proteção de credenciais, limitação de tentativas, sessões revogáveis e
  identificação das simulações fiscais como documentos sem valor fiscal.
- A validação registrada dessa implementação incluiu 12 testes de segurança,
  verificação de tipos e compilação. Isso não comprova a configuração do banco real.
- A ativação em produção permanece pendente: configurar a chave privada do
  Supabase, aplicar a migração e preparar as credenciais.
- A comunicação operacional usa consultas autenticadas periódicas. O suporte
  offline existente ainda precisa das garantias de integridade descritas abaixo.
- Transações comerciais completas, autorização por ação e testes de uso com
  operadores continuam sendo prioridades.

## Prioridades e sequência

| Ordem | Frente | Prioridade | Resultado esperado |
|---|---|---|---|
| 1 | Ativar e validar a segurança no ambiente real | P0 — bloqueador | Banco protegido e operadores com acesso validado |
| 2 | Integridade de vendas, estoque e pagamentos | P1 — alta | Nenhuma operação parcial ou duplicada |
| 3 | Sincronização, contingência e recuperação | P1 — alta | Quedas de conexão com tratamento previsível |
| 4 | Usabilidade de caixa e cozinha | P1 — alta | Menos erros e menos necessidade de ajuda |
| 5 | Arquitetura, desempenho e observabilidade | P2 — média | Evolução e diagnóstico mais simples |
| 6 | Integração fiscal real | P1 se necessária à operação | Emissão comprovada por integração validada |

A frente fiscal deve avançar em paralelo se a operação depender dela. A função de
simulação atual não atende ao requisito de emissão real.

## 1. Concluir a ativação da segurança

**Referência:** [procedimento de ativação](SECURITY-SETUP.md).

- [ ] Fazer backup e definir uma janela de manutenção.
- [ ] Confirmar que o schema afetado pela migração é exclusivo deste ERP.
- [ ] Configurar os segredos somente no servidor, sem registrá-los no repositório.
- [ ] Aplicar a migração de segurança e executar a preparação das credenciais.
- [ ] Redefinir os acessos fracos desativados pelo procedimento.
- [ ] Testar os perfis administrador, gerente, caixa e cozinha em um ambiente de homologação.
- [ ] Verificar que chamadas diretas com a chave pública do banco não leem nem alteram dados operacionais.
- [ ] Verificar revogação de sessão, expiração por inatividade e recuperação administrativa.
- [ ] Validar o fluxo completo de venda, cozinha e fechamento antes de liberar a operação.

**Critério de aceite:** acesso anônimo e operações incompatíveis com o perfil
devem ser negados; os fluxos autorizados devem continuar funcionando. Registrar
os resultados dos testes no ambiente real.

## 2. Garantir a integridade das operações

### 2.1 Venda em uma única transação

**Problema:** o fluxo atual realiza gravações separadas para venda, itens e estoque.
Uma falha intermediária pode deixar dados inconsistentes.

- [x] Criar uma operação de negócio no servidor para registrar a venda completa (`/api/sales/checkout`).
- [x] Recalcular preços, adicionais, descontos e total a partir de dados confiáveis.
- [x] Validar produtos ativos, quantidades, formas de pagamento e caixa aberto.
- [x] Executar as gravações relacionadas em uma transação no banco (RPC `process_sale_checkout`).
- [x] Garantir que falhas interrompam toda a operação, sem confirmar sucesso parcial.
- [x] Usar representação monetária precisa e regras explícitas de arredondamento.

**Critério de aceite:** uma falha provocada em qualquer etapa não deixa uma venda
parcial; valores adulterados pelo navegador são rejeitados ou recalculados. *(Validado nos testes automatizados).*

### 2.2 Estoque consistente entre terminais

- [x] Substituir a sobrescrita de saldo calculado no navegador por movimentações
  atômicas no banco (`UPDATE inventory SET current_stock = current_stock - qtd`).
- [x] Revisar as baixas e estornos existentes no código e nos triggers para impedir
  que o mesmo evento movimente o estoque duas vezes (removido trigger duplicado legado, baixa unificada na RPC e tabela `inventory_movements`).
- [x] Vincular adicionais a insumos por identificador e quantidade, em vez de
  identificar ingredientes por semelhança de nome.
- [ ] Registrar a composição efetivamente utilizada na venda, preservando o
  histórico quando uma ficha técnica for alterada.
- [ ] Definir a política para estoque insuficiente e para o estorno de produtos
  que já entraram em preparo.

**Critério de aceite:** vendas simultâneas em dois terminais produzem o saldo
esperado; cancelamentos repetidos não repetem o estorno.

### 2.3 Pagamentos e fechamento de caixa

- [ ] Separar os estados de venda, produção, entrega e pagamento.
- [ ] Modelar recebimentos, pagamentos parciais, quitações e estornos como eventos
  identificados, vinculados ao pedido e ao turno.
- [ ] Impedir recebimento duplicado, pagamento com valor inválido e fechamento
  concorrente do mesmo caixa.
- [ ] Registrar as diferenças de fechamento com motivo e responsável.
- [ ] Preservar os dados históricos de um turno encerrado; correções posteriores
  devem gerar ajustes rastreáveis.

**Critério de aceite:** totais por forma de pagamento, movimentos e fechamento
conciliam; repetir uma quitação não gera uma segunda entrada financeira.

### 2.4 Autorização por ação e auditoria

**Problema:** a autorização atual limita tabelas e operações, mas algumas regras
comerciais ainda dependem de lógica e confirmações da interface.

- [ ] Criar operações específicas para cancelar pedido, conceder desconto,
  registrar sangria, ajustar estoque e excluir dados de teste.
- [ ] Definir uma matriz de permissões por ação, incluindo limites de desconto e
  situações que exigem autorização gerencial.
- [ ] Associar a autorização à operação concreta, ao valor e ao pedido; uma
  confirmação no navegador não deve conceder permissão reutilizável.
- [ ] Gerar a auditoria no servidor, na mesma transação da operação, com autor,
  horário, motivo, valores anteriores e posteriores.
- [ ] Impedir alterações e exclusões de eventos de auditoria pelos operadores.
- [ ] Restringir também os campos retornados por perfil, evitando expor dados
  financeiros ou pessoais que não sejam necessários ao trabalho.

**Critério de aceite:** alterar uma requisição manualmente não contorna uma
autorização; toda ação sensível deixa um registro vinculado ao usuário autenticado.

## 3. Tornar a sincronização e a recuperação previsíveis

### 3.1 Reenvio sem duplicação

- [x] Atribuir um identificador único a cada operação antes do envio (`clientGeneratedId` UUID e `idempotencyKey`).
- [x] Implementar idempotência no servidor: reenviar a mesma operação retorna o
  resultado original, sem repetir gravações ou movimentos de estoque (tabela `idempotency_keys` e cache transacional).
- [ ] Persistir a fila offline em armazenamento apropriado, com versão do formato
  e tratamento explícito de falhas de gravação.
- [x] Tratar o caso em que o servidor conclui a operação, mas a resposta não chega
  ao navegador antes do tempo limite (idempotência garante que o reenvio retorne a venda sem duplicar baixa de estoque).
- [ ] Usar tentativas com intervalos progressivos e oferecer reenvio manual.
- [ ] Definir como tratar conflitos, turno encerrado, alteração de preço e perda
  de permissão durante o período offline.
- [ ] Não sincronizar automaticamente operações de um usuário anterior usando a
  identidade de outro operador.

**Critério de aceite:** desligar a conexão, recarregar a tela e reenviar o pedido
não perde nem duplica a operação. Validar também queda de energia e fechamento
do navegador com itens pendentes.

### 3.2 Estado visível e contingência

- [ ] Mostrar por pedido: salvo neste aparelho, aguardando envio, confirmado ou
  com falha.
- [ ] Exibir quantidade de pendências e horário da última confirmação do servidor.
- [ ] Diferenciar conexão com a internet de comunicação efetiva com o sistema.
- [ ] Definir quais ações podem ocorrer offline; alterações de acesso e
  autorizações sensíveis devem continuar dependendo do servidor.
- [ ] Definir um procedimento operacional quando a cozinha não receber o pedido,
  com identificação que permita reconciliar o atendimento posteriormente.

**Critério de aceite:** o operador identifica se a cozinha recebeu o pedido e
qual providência tomar em caso de falha, sem depender de mensagens técnicas.

### 3.3 Backup e restauração

- [ ] Inventariar os dados necessários para recuperar a operação.
- [ ] Definir frequência, retenção, acesso aos backups e responsáveis pela recuperação.
- [ ] Definir a perda máxima de dados e o tempo máximo de recuperação aceitáveis.
- [ ] Executar uma restauração em ambiente separado e conferir vendas, estoque,
  usuários e auditoria.
- [ ] Documentar como reconciliar operações locais pendentes após a restauração.

**Critério de aceite:** demonstrar uma restauração utilizável dentro das metas
acordadas. A existência de um arquivo de backup, sozinha, não conclui esta tarefa.

## 4. Simplificar as telas para os operadores

### 4.1 Caixa

- [ ] Organizar a venda em seleção de produtos, revisão e pagamento.
- [ ] Manter itens, total e ação principal visíveis durante o atendimento.
- [ ] Apresentar campos conforme o tipo de pedido: mesa, retirada ou entrega.
- [ ] Destacar pagamento pendente, troco e confirmação de recebimento.
- [ ] Bloquear cliques repetidos durante o processamento e preservar o pedido
  quando ocorrer uma falha.
- [ ] Substituir alertas genéricos por confirmações com número do pedido, valor e
  consequência da ação.
- [ ] Permitir troca rápida de operador sem perder a atribuição das operações.

**Critério de aceite:** operadores representativos conseguem vender, corrigir um
item, receber e fechar o caixa sem orientação constante.

### 4.2 Cozinha

- [ ] Destacar número do pedido, tempo de espera, quantidades e observações.
- [ ] Padronizar as transições de produção e impedir mudanças incompatíveis.
- [ ] Destacar alterações recebidas após o início do preparo, indicando o que
  mudou e registrando a ciência da equipe.
- [ ] Combinar avisos visuais e sonoros, com controle de volume e sem depender
  exclusivamente de cores.
- [ ] Revisar atalhos para evitar conclusão acidental de pedidos.

**Critério de aceite:** testar vários pedidos simultâneos, incluindo alteração,
atraso e cancelamento; a equipe consegue reconhecer as prioridades e mudanças.

### 4.3 Acessibilidade e linguagem

- [ ] Ampliar textos e alvos de toque importantes nos equipamentos reais.
- [ ] Revisar contraste, foco visível, rótulos e identificação de botões por ícone.
- [ ] Completar a navegação por teclado e o controle de foco em modais e gavetas.
- [ ] Padronizar nomes, posições de botões e mensagens entre módulos.
- [ ] Evitar termos internos em mensagens destinadas ao operador.
- [ ] Preservar rascunhos e avisar antes de descartar dados preenchidos.

**Critério de aceite:** fluxos principais utilizáveis por teclado e toque, com
mensagens compreensíveis e sem depender apenas de cor, som ou ícones.

### 4.4 Treinamento

- [ ] Criar ambiente de treinamento com dados separados da operação real.
- [ ] Preparar exercícios de venda, alteração, cancelamento, contingência e fechamento.
- [ ] Disponibilizar ajuda curta, contextual e específica de cada função.

**Critério de aceite:** um operador consegue praticar sem movimentar estoque,
caixa, pedidos ou documentos fiscais reais.

## 5. Melhorar arquitetura, desempenho e diagnóstico

### 5.1 Separar responsabilidades

- [ ] Dividir `src/lib/store.ts` em módulos de vendas, estoque, caixa, produção e
  sincronização, migrando gradualmente com testes de comportamento.
- [ ] Dividir a tela de caixa em componentes e fluxos independentes.
- [ ] Centralizar contratos e validações de entrada das operações no servidor.
- [ ] Substituir gradualmente a API genérica de dados por operações de negócio
  com parâmetros e respostas explícitos.
- [ ] Reduzir usos de `any` nos limites entre interface, servidor e banco.
- [ ] Consultar a documentação local da versão instalada do Next.js antes de
  alterar convenções ou APIs do framework, conforme `AGENTS.md`.

**Critério de aceite:** regras comerciais não dependem da tela e podem ser
verificadas isoladamente; a reorganização preserva os fluxos existentes.

### 5.2 Consultas e atualização entre terminais

- [ ] Medir o tempo das operações e o volume de consultas com múltiplos terminais.
- [ ] Consultar somente campos e períodos necessários; paginar históricos e listas.
- [ ] Evitar recarregar todos os módulos ao abrir uma tela operacional.
- [ ] Revisar índices com base nas consultas efetivamente utilizadas.
- [ ] Controlar consultas simultâneas e evitar requisições periódicas sobrepostas.
- [ ] Avaliar atualizações incrementais ou eventos autenticados após medir os
  gargalos, preservando as restrições de acesso ao banco.

**Critério de aceite:** atender às metas de tempo de resposta definidas a partir
da medição inicial, sem reduzir a segurança para ganhar desempenho.

### 5.3 Migrações, testes e entrega

- [ ] Consolidar a sequência de migrações e documentar os pré-requisitos.
- [ ] Remover a dependência de adaptações silenciosas para colunas inexistentes.
- [ ] Testar instalação em banco vazio e atualização de uma cópia da versão anterior.
- [ ] Ampliar os testes para transações, concorrência, idempotência e regras de permissão.
- [ ] Criar testes de ponta a ponta dos fluxos essenciais de caixa e cozinha.
- [ ] Automatizar testes, verificação de tipos e compilação antes da publicação.
- [ ] Definir um procedimento de reversão compatível com as mudanças do banco.
- [ ] Revisar dependências e vulnerabilidades como parte da manutenção periódica.

**Critério de aceite:** uma alteração que quebre um fluxo crítico impede a entrega;
o processo de atualização é reproduzível e tem recuperação documentada.

### 5.4 Observabilidade e dados locais

- [ ] Registrar erros com identificador da operação, sem senhas, tokens ou dados
  pessoais desnecessários.
- [ ] Monitorar falhas de venda, importação, sincronização e fechamento.
- [ ] Alertar responsáveis quando houver falha acionável ou acúmulo de pendências.
- [ ] Definir retenção e limpeza de sessões, tentativas de acesso e registros técnicos.
- [ ] Revisar os caches do navegador por usuário e finalidade, especialmente em
  aparelhos compartilhados; preservar filas legítimas sem expor dados de outro perfil.
- [ ] Documentar os procedimentos de suporte para as falhas mais frequentes.

**Critério de aceite:** localizar a causa de uma falha a partir da operação
informada pelo usuário, sem solicitar credenciais ou expor informações sensíveis.

## 6. Implementar emissão fiscal real quando necessária

- [ ] Definir os requisitos da integração e selecionar o provedor após avaliação técnica.
- [ ] Manter tokens e certificados no servidor.
- [ ] Separar simulação, homologação e produção de forma explícita na interface.
- [ ] Validar respostas, notificações e autenticidade da comunicação com o provedor.
- [ ] Registrar autorização somente a partir de uma resposta comprovada da integração.
- [ ] Persistir os documentos e resultados necessários para consulta e conciliação.
- [ ] Tratar rejeição, repetição de envio, cancelamento e indisponibilidade.
- [ ] Validar as exigências fiscais aplicáveis com os responsáveis pela operação
  antes da ativação; este roteiro não define regras fiscais ou prazos legais.

**Critério de aceite:** cada emissão possui resultado verificável e consistente;
nenhum documento gerado localmente é apresentado como autorização real.

## Indicadores para acompanhar a evolução

Levantar uma linha de base antes de estabelecer metas numéricas.

| Indicador | Como avaliar |
|---|---|
| Tempo de atendimento | Tempo entre iniciar e confirmar um pedido |
| Erros operacionais | Correções e cancelamentos por erro de operação |
| Facilidade de aprendizado | Tarefas concluídas sem ajuda por operadores em treinamento |
| Integridade | Pedidos parciais, duplicados e divergências de estoque |
| Sincronização | Quantidade e idade das operações pendentes |
| Conciliação | Diferença entre recebimentos, movimentos e fechamento |
| Disponibilidade | Falhas que interrompem o atendimento e tempo de recuperação |

## Próxima entrega recomendada

Depois de concluir a ativação da segurança, implementar **registro transacional
de venda com idempotência**, acompanhado dos testes de falha, reenvio e
concorrência. Essa entrega deve preceder mudanças amplas na interface, pois
estabelece uma base confiável para os fluxos de caixa e cozinha.

Cada item só deve ser marcado como concluído após implementação, validação dos
critérios de aceite e registro de eventuais limitações.
