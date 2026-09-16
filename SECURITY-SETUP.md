# Ativação da segurança — etapa 1

Esta versão requer uma migração coordenada. Não publique somente o código nem
execute somente o SQL com o caixa aberto. O acesso falha fechado enquanto os
pré-requisitos não estiverem disponíveis.

1. Faça backup do banco e coloque o ERP em manutenção. Confirme que o schema
   `public` é exclusivo deste ERP: a migração revoga os acessos públicos de todas
   as tabelas, views e funções desse schema.
2. Configure no servidor `SUPABASE_SERVICE_ROLE_KEY` (chave privada do projeto),
   `AUTH_SECRET` (novo segredo aleatório de pelo menos 32 caracteres) e
   `APP_ORIGIN` (origem exata, por exemplo `https://erp.exemplo.com`, sem barra final).
   Nunca use prefixo `NEXT_PUBLIC_` nessas variáveis. Preserve a URL pública do banco.
3. Aplique `supabase/migrations/20260916_access_security.sql` após as migrações
   anteriores. Não execute novamente scripts legados que recriem políticas abertas.
4. Se não houver administrador com senha personalizada forte, configure
   temporariamente `SECURITY_ADMIN_PASSWORD` (12 ou mais caracteres).
   Execute `npm run security:setup`. Para recuperação administrativa explícita,
   use `npm run security:setup -- --reset-admin` com essa variável definida.
5. O script converte credenciais existentes em hashes scrypt, desativa credenciais
   padrão/fracas, apaga o antigo arquivo local de credenciais e revoga sessões.
   Remova `SECURITY_ADMIN_PASSWORD`, `ADMIN_PASSWORD`, `CAIXA_PIN` e `COZINHA_PIN`
   após a execução. Backups antigos com credenciais precisam de acesso restrito.
6. Execute `npm run test:security`, `npm run typecheck` e `npm run build`, publique
   a versão, entre com o administrador e redefina as credenciais dos operadores.
7. Verifique com contas reais: caixa não administra colaboradores nem importa
   clientes; cozinha altera somente produção/perdas/checklists/estoque operacional;
   gerente não acessa auditoria ou diárias; administrador gerencia acessos.
   Confirme venda, recebimento, cozinha, impressão e sincronização entre terminais.
8. Teste diretamente o banco com a chave pública: todas as tabelas operacionais
   devem negar leitura e gravação. Teste APIs sem cookie (401), com perfil
   insuficiente (403), origem externa (403) e usuário desativado (401).

## Comportamento

- Sessão máxima de 8 horas, bloqueio após 30 minutos sem interação. Alterações
  cadastrais invalidam as sessões do colaborador. Logout revoga a sessão no banco;
  sem conexão, remove o cookie e o login informa que a revogação remota não foi confirmada.
- Limite compartilhado no banco: 8 tentativas por credencial e 120 por fluxo em
  uma janela de 15 minutos. Falhas no serviço de limitação bloqueiam autenticação.
- O cliente não acessa mais o banco ou Realtime diretamente. Vendas usam a consulta
  periódica autenticada existente (3,5 segundos); clientes são atualizados a cada 15 segundos.
- Simulações fiscais nunca produzem autorização, protocolo ou QR code fiscal.
  Registros legados gerados por este simulador são apresentados como simulações.
- A chave privada permanece no servidor. A API limita tabelas, métodos e campos
  por perfil e bloqueia consultas relacionais que poderiam expor tabelas restritas.

## Limites e recuperação

Esta etapa não substitui as transações e validações comerciais completas da etapa 2.
Operadores de caixa ainda podem realizar operações de caixa e atualizar o estoque
operacional; a migração de autorização não transforma essas operações em transações.
Não reabra políticas públicas para recuperar acesso. Use o procedimento de
recuperação administrativa acima, por um responsável com acesso ao servidor.
Não remova ou reverta a migração sem coordenar uma versão compatível do aplicativo.
