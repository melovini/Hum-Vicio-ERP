# Verificação das melhorias de cardápio, vendas e KDS

Data: 17/09/2026. Código revisado: `4491ab3`, comparado com `4e6c359`.

## Conclusão

As melhorias foram **parcialmente aplicadas**. Existem avanços úteis na prévia do KDS, na separação de ovos e carnes e na representação dos adicionais. Porém, as seis etapas ainda não podem ser consideradas concluídas: persistência no banco, autoridade do servidor, configurações entre aparelhos e contagens por unidade continuam com lacunas importantes.

O problema original de um ingrediente da chapa ser contado como carne foi reduzido para os casos reconhecidos pelo novo classificador. A solução ainda depende de nomes e pesos presumidos, portanto não elimina a origem dos erros para todos os produtos.

## Verificações executadas

- `npm test`: **136 testes aprovados**, nenhum reprovado.
- `npm run typecheck`: **aprovado**.
- Inspeção do código modificado, rotas de venda, mapeamentos de leitura e migrações relacionadas.
- Execução de exemplos adicionais usando as funções reais através do carregador de testes do projeto, sem acessar banco ou credenciais.
- Não foram executados build, testes de navegador, migrações ou testes no banco de produção. O estado real do banco não foi verificado.

Os testes atuais demonstram funcionamento de cenários isolados. Não comprovam o caminho completo de salvar, recarregar em outro aparelho, editar, cancelar e conferir estoque.

## O que foi bem encaminhado

| Melhoria | Avaliação |
|---|---|
| Cálculo de produção extraído para uma função compartilhada | Boa base para testar e manter a mesma lógica na prévia e no KDS |
| Separação entre ovos e carnes | Corrige casos cobertos pelo reconhecimento atual; falta cadastro explícito |
| Prévia de cozinha no cardápio | Implementada e útil para o gestor perceber divergências |
| Avisos de ingredientes inexistentes e quantidades inválidas | Implementados, mas ainda não garantidos no servidor |
| Adicionais com identificação e quantidade numérica | Estrutura melhorada no PDV; consumo pelo cálculo e pelo banco ainda incompleto |
| Remoção dos adicionais e combos fictícios do modal | Aplicada no modal; ainda há preços de combo fixos em outro caminho |
| Composição confirmada em memória | A função respeita a cópia recebida; falta garantir gravação e recuperação |
| Ampliação de testes | Positiva; precisa incluir falhas de integração e casos fora das estimativas atuais |

## Achados prioritários

### V01 — Alta: conversão de gramas gera contagens absurdas

**Evidência:** `src/lib/production-calculator.ts`, `resolveRecipeUnitQuantity`, aproximadamente linhas 195–240.

O mesmo bloco trata kg e g de batata/onion com os mesmos limites numéricos. Resultado reproduzido com a função real:

| Entrada | Resultado atual |
|---|---:|
| 150 g de batata | 1.000 porções |
| 0,150 kg de batata | 1 porção |
| 0,180 kg de carne | 1 carne, sem saber se são duas porções de 90 g |

Também há divisão fixa por 0,18 kg para carnes e por 0,15 para porções. Isso troca um valor fixo antigo por novas estimativas fixas. `Math.round` ainda pode esconder quantidades fracionárias inválidas.

**Correção necessária:** normalizar a unidade física e usar o peso/quantidade da porção cadastrada. Exigir revisão quando a conversão não estiver definida. Não inferir uma ou duas carnes por faixas de peso.

**Aceite:** 150 g e 0,150 kg produzem o mesmo resultado; 180 g com porção de 90 g produz duas carnes; quantidades incoerentes geram aviso, sem arredondamento silencioso.

### V02 — Alta: composição confirmada não está persistida pelo fluxo SQL do repositório

**Evidências:** `src/lib/store.ts:2563`; `src/app/api/sales/checkout/route.ts`; `supabase/migrations/20260917_atomic_sales_and_idempotency.sql:172`.

O navegador cria `productionSnapshot` e a rota apenas encaminha a venda para `process_sale_checkout`. O SQL versionado não grava `production_snapshot`, `recipe_version`, `combo_id`, `meat_point` ou `removals` nas colunas correspondentes. Não há nova migração dessas etapas no diff revisado.

A leitura inicial procura esses campos, mas isso não faz com que sejam gravados. O fato de o servidor devolver o objeto recebido pode dar a impressão de persistência enquanto os dados ainda estão apenas em memória.

Além disso, o servidor não calcula nem valida a composição contra o catálogo oficial: aceita a informação enviada pelo navegador. A versão efetiva de receita também não é estabelecida nesse fluxo.

**Correção necessária:** criar migrações, calcular a composição no servidor, gravar a versão e os dados necessários para produção/consumo junto com a venda e devolver a linha persistida. Validar permissões, escolhas e preços contra o cadastro.

**Aceite:** vender, fechar o navegador, alterar a receita e abrir o pedido em outro aparelho deve preservar a composição da venda original. Dados adulterados enviados pelo cliente devem ser rejeitados ou recalculados.

### V03 — Alta: atualização periódica e edição descartam os campos novos

**Evidências:** `src/lib/store.ts:979`, mapeamento de `sItems`; `src/lib/store.ts:3370`, construção de `saleItemsPayload` na edição.

A leitura inicial inclui os campos novos, mas a atualização periódica monta os itens sem composição confirmada, versão, identificador de combo, ponto e retiradas. Quando uma alteração de estado ou total faz essa atualização ser aplicada, esses campos podem desaparecer do estado local, mesmo se uma futura migração os gravar.

A edição também volta a embutir combo, adicionais e observações no nome e grava apenas os campos básicos. Não há recálculo e persistência completa da nova composição. A comparação de mudanças da atualização periódica não contempla o conteúdo dos itens, podendo ignorar alterações com total igual.

**Correção necessária:** compartilhar um único mapeamento de leitura; persistir escolhas e composição em todos os caminhos; usar versão de pedido para detectar alterações. Edição deve ter operação única no servidor e registrar diferenças para a cozinha.

**Aceite:** mudar a quantidade ou os adicionais de um pedido mantém dados corretos após atualização, recarga e leitura em outro terminal, inclusive quando o total não muda.

### V04 — Alta: adicionais ainda são calculados pelo nome, não por sua receita

**Evidência:** `src/lib/production-calculator.ts`, tratamento de adicionais, aproximadamente linhas 409–475.

O código recebe identificadores, mas procura `add.id` no mapa de insumos, embora esse identificador possa ser de produto adicional. Não percorre a receita desse produto; classifica seu nome e soma quantidades.

**Reprodução local:** um lanche com uma carne e um adicional chamado “Reforço especial”, cuja receita contém duas carnes, resultou em **uma carne total**, em vez de três. O identificador do adicional e sua receita foram fornecidos ao cálculo.

Combos também seguem identificados por palavras no nome, sem resolver seus componentes completos. O SQL de checkout continua buscando adicionais pelo nome e usa `LIMIT 1` para sua receita.

**Correção necessária:** resolver o produto adicional pelo identificador correto, expandir todos os componentes e multiplicar pela quantidade escolhida e vendida. Fazer o mesmo para combos. Nomes devem ser apenas rótulos; tratamento legado precisa ser explícito.

**Aceite:** renomear um adicional ou combo não muda preparo, preço ou baixa de estoque; adicionais compostos descontam todos os insumos.

### V05 — Alta: cancelamento pós-preparo não está resolvido no banco

**Evidências:** `src/lib/store.ts:3148`; `src/app/api/sales/cancel/route.ts`; funções SQL `cancel_order_transaction` e `estornar_estoque_cancelamento`.

A decisão de devolver estoque ou registrar perda foi acrescentada no navegador, depois que o cancelamento no servidor já aconteceu. A rota não envia uma política de destinação ao banco. A função de estorno versionada continua devolvendo insumos ao mudar para cancelado, sem distinguir preparo; se o trigger estiver instalado conforme esperado pelo projeto, ele continua executando essa devolução.

Não repor visualmente no navegador não impede a reposição no banco. A perda é gravada em outra chamada, com receita e custo atuais, sem conferir o erro retornado pelo cliente. Se essa gravação falhar, o cancelamento permanece confirmado. Repetições também podem tentar registrar a perda novamente.

**Correção necessária:** decidir a destinação no servidor com o estado atual bloqueado para concorrência; cancelar, ajustar estoque e registrar perda numa única operação protegida contra repetição. Basear a reversão nos movimentos originais. Definir tratamento de preparo parcial.

**Aceite:** cancelar antes e depois do preparo e repetir a requisição resulta em estoque e perdas corretos, iguais em todos os terminais. Falha intermediária não deixa metade da operação salva.

### V06 — Alta: configuração central continua sendo local

**Evidência:** `src/lib/central-config.ts`, `publishCentralConfig` e `resolveEffectiveConfig`.

Não há escrita/leitura de configuração remota nesse módulo. A publicação grava `localStorage` e dispara evento na janela. Não foi encontrada integração de `resolveEffectiveConfig` com uma resposta de servidor nem consumidor do evento `hum_vicio_config_updated` no código de aplicação pesquisado.

O armazenamento do navegador não sincroniza computadores. A existência de uma função que escolhe entre dois objetos não demonstra sincronização entre terminais. A escolha por maior versão local ou data também não estabelece quem tem autoridade para publicar.

**Correção necessária:** persistência central autenticada, versão controlada pelo servidor, autorização da gestão e atualização dos terminais. Tratar conflitos de migração sem promover automaticamente uma preferência local a regra oficial.

**Aceite:** mudar uma meta no aparelho A deve aparecer no B após confirmação do servidor; um operador sem permissão não pode publicar regras. Ambos devem mostrar a mesma versão.

### V07 — Alta: rascunhos podem continuar disponíveis para venda

**Evidências:** página do cardápio, `isProductActive = productStatus !== 'inativo'`; `src/components/caixa/PosCatalogZone.tsx:38`; `src/lib/product-validator.ts`.

Rascunho é tratado como ativo no salvamento. O catálogo do caixa filtra por `isActive`, não por publicação validada. A função de validação retorna `isValid: true` para um lanche sem receita e preço positivo — confirmado no exemplo local. A ausência de receita é apenas aviso.

Não há validação equivalente na rota de checkout. As tentativas alternativas de salvar produto removem o campo de status se ocorrer erro, o que pode ocultar a ausência da coluna ou do suporte à publicação.

**Correção necessária:** separar rascunho de versão vendável, filtrar o catálogo e validar no servidor. Permitir salvar cadastro incompleto como rascunho, mas impedir sua publicação enquanto faltarem dados críticos. Não remover silenciosamente campos obrigatórios ao falhar.

**Aceite:** um lanche sem ficha pode ser salvo para edição, porém não aparece como vendável nem é aceito pelo checkout normal.

### V08 — Alta: compensação no navegador não torna a receita atômica

**Evidência:** `src/lib/store.ts:1807–1824` e `1903–1935`.

Houve melhora ao verificar erros. Entretanto, produto, exclusão da receita e nova inserção continuam sendo chamadas separadas. A restauração também pode falhar, e o erro retornado por ela não é verificado antes de afirmar “A receita anterior foi restaurada”. Alterações em preço e nome anteriores à falha não são desfeitas.

O fechamento do navegador ou duas edições simultâneas ainda podem deixar estado parcial. Comentários que dizem “Gravação Atômica” não correspondem a uma transação no banco.

**Correção necessária:** uma operação de servidor que grave produto, ficha e publicação numa transação com controle de versão. Mensagens devem refletir apenas o que foi confirmado.

**Aceite:** provocar falha na inserção da receita preserva integralmente a versão anterior, inclusive nome/preço, e edições concorrentes não se sobrescrevem silenciosamente.

### V09 — Média: valores e inferências fixas ainda permanecem

**Evidências:** `src/lib/pos-financial-helpers.ts`, `recalculateCartPrices`; `src/lib/central-config.ts`; `src/lib/store/types.ts`; `src/lib/production-calculator.ts`.

- A troca de canal ainda usa preços fixos de combo 14/16 e 16/18 quando não encontra o cadastro.
- Custos fixos de exemplo continuam como configuração padrão real.
- Tipos de componentes são inferidos por nomes/categorias; não há tipo e porção explícitos nos dados usados pelo motor.
- Sem receita, permanecem regras por nomes de países e pela palavra duplo.
- “Sem carne” retira apenas uma carne base; não representa claramente retirar todas, uma unidade ou um componente específico.

**Correção necessária:** concluir o cadastro explícito e a política de dados ausentes. Manter sugestões por nome somente na revisão assistida. Validar retiradas por componente e quantidade. Não substituir preços ausentes por valores fixos silenciosos.

## Ordem recomendada para concluir

1. Corrigir a conversão de unidades e interromper contagens presumidas sem porção definida (V01).
2. Resolver adicionais e combos pela composição cadastrada (V04).
3. Implementar persistência e cálculo de composição no servidor, incluindo atualização e edição (V02–V03).
4. Corrigir cancelamento/perdas numa única operação de banco (V05).
5. Garantir publicação de produto e gravação completa de receitas (V07–V08).
6. Implementar configuração remota e remover os valores alternativos restantes (V06–V09).

## Testes que faltam para validar a entrega

- Equivalência de g/kg e múltiplas gramaturas de carnes.
- Adicional com nome neutro e receita de vários componentes.
- Venda real em banco de testes, recarga completa, mudança de receita e conferência em segundo terminal.
- Alteração de pedido sem mudança de total e sem perda de composição.
- Rascunho rejeitado pela API de venda, mesmo enviado diretamente.
- Falha no meio da gravação e concorrência de edição da ficha.
- Cancelamento antes, durante e após preparo, com repetição e falha intermediária.
- Publicação de configuração entre dois contextos independentes de navegador.

Os resultados locais reproduzidos foram: `batata150g = 1000`, `batata0150kg = 1`, `duasCarnes90gTotal018kg = 1`, `simplesComAdicionalDeDuasCarnes = 1` e `lancheSemReceitaValido = true`. São chamadas às funções atuais, não simulações de pedidos no banco de produção.

**Parecer:** há uma boa evolução de estrutura e interface, mas ainda não há evidência de integridade ponta a ponta. As prioridades acima devem ser resolvidas antes de declarar concluídas a imutabilidade do pedido, a sincronização entre terminais e a política de estoque/perdas.
