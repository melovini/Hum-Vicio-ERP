# Segurança e usabilidade — entrega de 25/09/2026

## Implementado

- Salvamento de ficha exclusivamente pela função transacional; banco incompatível gera erro sem excluir a receita pelo caminho alternativo.
- Checkout valida preços com o catálogo do servidor (produto, combo e adicionais), subtotal, disponibilidade e valores finitos.
- Caixa pode conceder descontos e brindes com justificativa obrigatória. O motivo do desconto acompanha a composição persistida dos itens. A regra nova de preços e justificativa vale para o checkout; a edição posterior precisa da migração indicada abaixo.
- Reenvio de pedido já confirmado consulta a chave de idempotência antes de conferir preços atuais.
- Combos fictícios com preços fixos foram removidos da seleção; apenas o catálogo é oferecido.
- Criação genérica de vendas, turnos e movimentos financeiros bloqueada. Alteração genérica de turnos pelo caixa bloqueada. Rotas específicas de abertura, fechamento e movimentação continuam disponíveis.
- Respostas da API e bootstrap destinadas à cozinha removem preços, custos e campos financeiros das tabelas de vendas, itens, catálogo e estoque. Filtros por campos restritos também são recusados.
- Pedido gravado localmente antes do envio. Falha de armazenamento lança erro e não apresenta confirmação.
- Sincronização única por contexto e bloqueio entre abas nos navegadores com Web Locks. Navegadores sem Web Locks contam com a idempotência no servidor para impedir duplicação da venda.
- Botão de nova tentativa para pedidos rejeitados, sem gerar outro identificador. O botão não altera valores nem corrige automaticamente dados rejeitados.
- Fallback de carregamento busca itens somente dos pedidos consultados.
- Verificador de compatibilidade disponível em `npm run check:schema`: consulta colunas e presença das duas funções necessárias sem executar vendas. Não comprova a lógica interna de uma função existente.
- Respostas públicas de saúde não expõem mensagens internas do banco.

## Validação

Testes automatizados de permissões, preços, justificativas, proteção da fila e falha transacional. Testes de navegador com APIs simuladas para caixa e cardápio. A leitura de compatibilidade passou no banco configurado; nenhum dado de produção foi modificado para os testes.

## Ainda pendente — não considerar concluído

1. Migrar edição financeira de pedidos existentes para rota e função transacional próprias. Restringir as alterações de vendas/itens na API genérica depois da migração. As permissões de escrita financeira não estão totalmente isoladas nesta entrega.
2. Gerar toda a auditoria financeira dentro das transações no banco. Eventos enviados pelo cliente ainda existem.
3. Migrar a fila para IndexedDB com transações e tratamento de corrupção/concorrência também nas gravações entre abas. A persistência atual continua em localStorage, com verificação de falha.
4. Disponibilizar revisão e correção assistida de cada pedido rejeitado; nesta entrega há diagnóstico e nova tentativa.
5. Integrar a verificação de compatibilidade ao ambiente de publicação, com credenciais protegidas. O comando entregue não está conectado automaticamente ao provedor de deploy.
6. Testar todo o ciclo com banco isolado real, incluindo desconto, brinde, cancelamento, edição, estoque e impressão. Testes de interface com mocks não substituem essa validação.
7. Medir latência real, paginar históricos e evitar que consultas recentes omitam pedidos antigos ainda ativos.
8. Automatizar restauração periódica de backups e validar os dados recuperados.
9. Projetar e testar isolamento por estabelecimento antes de oferecer o ERP como serviço para empresas diferentes.

## Aplicação

Esta entrega não exige novo SQL além das migrações já conferidas. Depois da publicação, pedidos antigos na fila podem exigir revisão quando o preço mudou ou faltar justificativa; não apague a fila nem recrie o pedido para contornar essa revisão.
