# Guia Operacional de Backup, Restauração e Reconciliação — Hum Vício ERP

Atualizado em: 16/09/2026.  
Frente Técnica: **3.3 — Backup e Restauração**.

---

## 1. Inventário de Dados e Criticidade

O banco de dados do Hum Vício ERP está estruturado no PostgreSQL (Supabase). Seus dados são divididos em três níveis de criticidade:

### Nível 1: Dados Críticos e Imutáveis (Perda Zero / Financeiro / Fiscal / Auditoria)
| Tabela | Conteúdo | Frequência de Alteração |
|---|---|---|
| `sales` | Cabeçalhos de pedidos (totais, clientes, forma de pagamento, datas, canais) | Contínua (a cada venda) |
| `sale_items` | Itens comercializados, quantidades, adicionais e preços unitários | Contínua (a cada venda) |
| `payment_events` | Ledger financeiro imutável de recebimentos, quitações e estornos | Contínua (a cada evento de pagamento) |
| `cash_sessions` | Turnos de caixa (abertura, fechamento, quebras, operador e notas) | Por turno (abertura/fechamento) |
| `cash_movements` | Movimentações de gaveta (sangrias e suprimentos) | Por evento de gaveta |
| `inventory_movements` | Ledger imutável de movimentações atômicas de estoque | Contínua (a cada baixa/estorno) |
| `collaborators` | Operadores, perfis de acesso e credenciais criptografadas (`scrypt`) | Ocasional (cadastro/atualização) |
| `audit_logs` | Trilha de auditoria das ações administrativas e gerenciais | Contínua |

### Nível 2: Dados Estruturais e Engenharia de Cardápio
| Tabela | Conteúdo | Frequência de Alteração |
|---|---|---|
| `products` | Cardápio, precificação (balcão e delivery), categorias | Semanal / Mensal |
| `inventory` | Insumos, estações de preparo (chapa/fritadeira), saldo atual e custo | Diária / Semanal |
| `recipes` | Fichas técnicas vinculando hambúrgueres a insumos | Sob demanda |
| `sub_recipes` | Sub-receitas intermediárias (molhos, blends, etc.) | Sob demanda |
| `customers` | Base de clientes, endereços, preferências e recorrência | Contínua |
| `suppliers`, `purchase_records` | Fornecedores e notas de compras | Semanal |
| `waste_records` | Registro de perdas e descartes na cozinha | Diária |
| `daily_checklists` | Checklists de abertura e fechamento operacional | Diária |

### Nível 3: Dados Efêmeros e Cache
| Tabela | Conteúdo | Política de Retenção |
|---|---|---|
| `idempotency_keys` | Chaves de idempotência e cache de checkout | Retenção automática de 48 horas |
| `app_sessions` | Sessões ativas de login HttpOnly | Expiradas por inatividade (30 minutos) |

---

## 2. Metas de Continuidade (SLAs: RPO & RTO)

### RPO (Recovery Point Objective — Tolerância a Perda de Dados):
* **Na Operação da Loja:** **RPO = Zero**.
  * *Mecanismo:* Mesmo no caso improvável de perda do banco de dados central, os navegadores dos terminais (PDV, Balcão, Retirada) mantêm as vendas salvas na fila *outbox* local (`localStorage`). Ao reconectar com o banco restaurado, os pedidos são drenados e gravados com suas chaves de idempotência originais.
* **No Banco Central (Nuvem):** **24 horas** para snapshots diários automáticos, ou até o minuto anterior caso o plano Supabase Pro com PITR (Point-in-Time Recovery) esteja habilitado.

### RTO (Recovery Time Objective — Tempo de Restauração):
* **Na Operação da Loja:** **RTO = Zero**.
  * *Mecanismo:* A loja **não precisa fechar**. O Caixa opera em **Modo de Contingência**, os pedidos são emitidos, as comandas são impressas e a Cozinha prepara os lanches guiando-se pela via impressa ou pelo botão `+ Comanda Manual` do KDS.
* **No Banco de Dados:** **< 15 minutos** para restauração completa via snapshot JSON/SQL.

---

## 3. Políticas de Frequência, Retenção e Segurança

### Frequência de Backups
1. **Diário Automático:** Executado todas as madrugadas (ex: 04:00 AM) após o fechamento do expediente.
2. **Pré-Atualização (Manual):** Antes de executar migrações de banco (`supabase/migrations/`) ou alterações no schema do PostgreSQL.

### Política de Retenção
* **Snapshots Diários:** Mantidos por **7 dias**.
* **Snapshots Semanais:** Mantidos por **4 semanas**.
* **Snapshots Mensais:** Mantidos por **12 meses** (para conciliação contábil, DRE e fiscal).

### Segurança dos Arquivos de Backup
* Os backups contêm hashes `scrypt` dos colaboradores; **nenhuma senha é armazenada em texto puro**.
* Os arquivos são gerados na pasta `backups/` com permissão restrita e acompanhados de assinatura `SHA-256` individual por tabela e global para impedir adulterações imperceptíveis.
* Os arquivos de backup nunca devem ser commitados no repositório público (protegidos pelo `.gitignore`).

---

## 4. Como Executar os Procedimentos

### 4.1 Gerando um Backup Sob Demanda

No terminal do servidor ou da máquina de administração:

```bash
# Executa o backup conectado ao banco real
npm run backup
```

Para apenas simular a geração e conferir a contagem sem gravar em disco:
```bash
node --env-file=.env.local scripts/backup.mjs --dry-run
```

O arquivo será gravado em `backups/backup-YYYY-MM-DDTHH-mm-ss-sssZ.json`.

---

### 4.2 Verificando a Integridade de um Backup

Antes de confiar em um backup ou antes de realizar uma restauração, execute o verificador automatizado:

```bash
# Verifica automaticamente o snapshot mais recente
npm run backup:verify

# Ou verifica um snapshot específico
node scripts/restore-verify.mjs backups/backup-2026-09-16T...json
```

O script audita:
1. **Checksums SHA-256:** Garante que nenhum registro foi adulterado.
2. **Integridade Referencial:** Verifica se todos os itens de venda pertencem a vendas válidas, e se receitas apontam para produtos e insumos existentes.
3. **Credenciais:** Garante que todos os PINs estão no padrão criptográfico seguro `scrypt$`.
4. **Matemática Financeira:** Confere se `subtotal - desconto + entrega == total` em 100% das vendas.

---

### 4.3 Procedimento de Restauração do Banco de Dados

Caso seja necessário restaurar o banco de dados após um desastre ou falha de infraestrutura:

1. **Ative a Janela de Manutenção:**
   * Notifique os operadores para operarem com calma no modo de contingência local.
2. **Verifique o Backup Selecionado:**
   * Execute `node scripts/restore-verify.mjs <arquivo-de-backup>` para garantir que o snapshot está íntegro.
3. **Restauração via Painel do Supabase:**
   * Acesse: **Supabase Dashboard -> Settings -> Database -> Backups**.
   * Selecione o ponto de restauração desejado e confirme.
4. **Restauração Manual via SQL/CLI (caso use snapshot próprio):**
   * Execute as migrações em ordem cronológica a partir da pasta `supabase/migrations/`.
   * Importe os dados do snapshot JSON na ordem definida no inventário (primeiro colaboradores, produtos e insumos; por último itens de venda e eventos de pagamento).
5. **Conferência Pós-Restauração:**
   * Execute `npm run test:security` para certificar que as regras de segurança e RPCs estão operacionais.

---

## 5. Reconciliação das Vendas Pendentes (Pós-Restauração)

Quando o banco de dados for restaurado para um estado anterior (ex: backup da madrugada), é provável que existam vendas realizadas durante o dia que constavam nos navegadores dos operadores mas ainda não no banco restaurado.

### Como funciona a reconciliação automática:
1. Os terminais da loja detectam que o servidor voltou a responder através do endpoint `/api/health`.
2. O indicador visual no topo do PDV/Caixa muda para `🟢 Online (Sincronizando...)`.
3. O script do frontend (`syncOfflineSalesQueue`) envia cada pedido salvo na fila outbox para o endpoint `/api/sales/checkout`.
4. **Proteção Transacional & Idempotência:**
   * Se a venda **não existia** no banco restaurado: O endpoint executa a RPC `process_sale_checkout`, grava a venda, deduz o estoque atômico, insere os eventos de pagamento no ledger e retorna sucesso. O pedido é removido da fila local.
   * Se a venda **já existia** no banco restaurado (ex: o backup já a continha): A chave `idempotencyKey` única identifica a duplicidade e retorna a venda original sem decrementar o estoque duas vezes. O pedido é removido da fila local.
5. **Auditoria pelo Caixa:**
   * O operador clica no botão `<SyncStatusBar />` no topo do Caixa e confirma:
     * *"Fila vazia. Todos os pedidos estão 100% atualizados no servidor."*
   * O caixa pode então ser fechado com conciliação financeira exata.
