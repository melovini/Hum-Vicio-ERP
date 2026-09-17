# Hum Vício ERP — Glossário do Produto e Guia de Microcopy

**Atualizado em:** 17/09/2026  
**Status:** Oficial  

Este documento padroniza os conceitos, termos operacionais, regras de botões e mensagens em todo o Hum Vício ERP. Nenhuma tela ou componente deve inventar sinônimos locais.

---

## 1. Vocabulário Oficial de Conceitos

| Conceito | Termo Oficial | Termos Proibidos / Evitar | Significado / Contexto de Uso |
| --- | --- | --- | --- |
| **Operação de vendas** | **Caixa / PDV** | Balcão (como sinônimo de caixa), Terminal | O módulo e a estação de atendimento ao cliente e recebimento financeiro. |
| **Solicitação antes da conclusão** | **Pedido** | Venda (antes de pagar), Chamado | A intenção de compra ativa, ainda em montagem ou aguardando pagamento. |
| **Registro comercial concluído** | **Venda** | Pedido concluído, Transação | O registro fiscal/financeiro definitivo após pagamento ou liberação a prazo. |
| **Preparação na cozinha** | **Produção** | Cozinha (como ação), Fila de Preparo | O processo físico de montagem de itens na chapa, fritadeiras e montagem. |
| **Item do cardápio vendável** | **Produto** | Lanche (quando genérico), Mercadoria | O produto final comercializado ao cliente (hambúrguer, bebida, porção, combo). |
| **Matéria-prima / Ingrediente** | **Insumo** | Ingrediente bruto, Material, Item | Item de estoque comprado para preparo ou revenda (pão, carne, bacon, óleo). |
| **Composição e proporções** | **Ficha técnica** | Receita técnica, Fórmula | A lista exata de insumos e quantidades necessárias para montar um produto. |
| **Sub-preparo culinário** | **Sub-receita** | Molho base, Preparo prévio | Produção intermediária na cozinha (ex: maionese especial, cebola caramelizada). |
| **Contagem física de estoque** | **Inventário físico** | Balanço, Auditoria física | Contagem real dos insumos nas prateleiras e freezers para apurar divergências. |
| **Documento fiscal eletrônico** | **NFC-e** | Nota, Cupom fiscal | Documento fiscal do consumidor emitido em contingência ou autorizado na SEFAZ. |
| **Registro de desperdício** | **Perda** | Quebra, Descarte | Registro de insumos ou produtos vencidos, queimados ou inutilizados na operação. |

---

## 2. Regras de Microcopy para Botões e Ações

### Regra de Ouro: Verbo + Objeto
Os botões devem declarar exatamente o que acontece quando clicados. Nunca use verbos soltos como *"Salvar"*, *"OK"*, *"Confirmar"* ou *"Enviar"* quando o objeto da ação puder ser especificado.

| Ação | Rótulo Recomendado | Rótulo Proibido |
| --- | --- | --- |
| Salvar novo fornecedor | **Cadastrar fornecedor** | Salvar / Adicionar |
| Salvar novo insumo | **Cadastrar insumo** | Salvar / Novo item |
| Salvar alterações em insumo | **Salvar alterações** | Atualizar / Gravar |
| Exclusão irreversível | **Excluir fornecedor** | Excluir / Apagar |
| Finalizar atendimento | **Finalizar pedido** | Finalizar / Enviar |
| Fechar o turno financeiro | **Fechar caixa** | Fechar / Encerrar |
| Abrir turno financeiro | **Abrir turno de caixa** | Abrir / Iniciar |
| Cancelar modal | **Cancelar** | Voltar (quando fecha modal) |
| Dispensar notificação | **Dispensar** | Fechar |

---

## 3. Mensagens de Feedback e Erro

### Princípios:
1. **Nunca expor detalhes internos do servidor ou SQL** (`violates foreign key constraint`, `PGRST116`, `500 Internal Server Error`).
2. **Explicar o motivo em linguagem humana**.
3. **Indicar imediatamente a próxima ação recomendada**.
4. **Preservar os dados preenchidos no formulário após falhas recuperáveis**.

### Exemplos Padrão:

- **Sucesso**:
  - `[Tone: success] Fornecedor cadastrado`  
    *Descrição: Açougue Central já está disponível para pedidos de compra.*
  - `[Tone: success] Insumo atualizado`  
    *Descrição: O estoque mínimo de Pão Brioche foi atualizado.*

- **Falha Recuperável**:
  - `[Tone: danger] Não foi possível salvar o fornecedor`  
    *Descrição: Verifique a conexão e tente novamente. Os dados digitados foram mantidos.*  
    *Ação: [Tentar novamente]*
  - `[Tone: danger] Conexão instável`  
    *Descrição: O pedido foi salvo em contingência local e será sincronizado assim que a rede retornar.*

- **Ações Destrutivas (ConfirmDialog)**:
  - `Título: Excluir fornecedor?`  
    *Descrição: O fornecedor "Açougue Central" será removido. O histórico de compras anteriores será preservado para relatórios fiscais.*  
    *Botão Destrutivo: [Excluir fornecedor]*  
    *Botão Cancelar: [Cancelar]*

---

## 4. Estados Vazios (EmptyState)

Estados vazios não devem ser telas cinzas abandonadas. Eles devem:
1. Explicar por que aquela lista está vazia.
2. Esclarecer por que a informação importa para o negócio.
3. Oferecer um botão de ação primária para iniciar.

**Exemplo:**
- `Título: Nenhum insumo cadastrado`
- `Descrição: Cadastre os itens que compõem seus lanches para controlar o estoque e calcular o CMV em tempo real.`
- `Ação: [Cadastrar primeiro insumo]`
