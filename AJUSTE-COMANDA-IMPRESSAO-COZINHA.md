# Ajuste técnico da comanda de produção da cozinha

Data: 20/09/2026.

## 1. Objetivo

Deixar a comanda curta e fácil de conferir: identificar o cliente, saber quais lanches e acompanhamentos preparar, visualizar suas alterações e conferir no rodapé a quantidade total de carnes na chapa e de preparos na fritadeira.

O ajuste se aplica à **via da cozinha**. A via do cliente mantém as informações comerciais necessárias. A impressão de alterações deve continuar identificada como alteração, para não provocar preparo duplicado.

Este documento especifica a implementação. Nenhum código de impressão foi alterado, e não houve teste em impressora física nesta análise.

## 2. O que precisa mudar no código atual

**Arquivos analisados:**

- `src/components/ReceiptModal.tsx`: prévia, impressão de cozinha, cliente, alterações e geração de texto.
- `src/lib/production-calculator.ts`: `getBurgerPrintDetails` e informações calculadas de produção.
- `src/lib/thermal-printer.ts`: isolamento do conteúdo impresso e estilos térmicos.

Na via da cozinha atual, há informações de cobrança, repetição de descrições de chapa/fritadeira dentro dos combos e muitos destaques em fundo preto. O texto gerado também começa com identificação empresarial e CNPJ, independentemente da via. Isso aumenta o papel e disputa atenção com o preparo.

O componente já separa os tipos de via e usa um cálculo compartilhado de produção. Aproveitar essa estrutura, evitando alterar o comprovante do cliente ao simplificar a cozinha.

## 3. Conteúdo da nova comanda

### Cabeçalho compacto

Manter:

- Nome do cliente em destaque.
- Identificação curta do pedido e horário, para distinguir pedidos de clientes com o mesmo nome.
- Mesa ou modalidade de entrega somente quando ajudar na montagem ou expedição e houver informação real disponível.

Sem nome informado, usar “Cliente não informado” e destacar o pedido. Não inventar mesa ou identificação do cliente.

Retirar da via da cozinha:

- CNPJ, endereço da empresa, telefone e textos institucionais.
- Preços, total, descontos, forma de pagamento e instruções de cobrança.
- Frases promocionais ou de incentivo no rodapé.
- Campos vazios e títulos repetidos a cada bloco.

A cobrança na retirada deve permanecer visível no caixa/expedição e na via apropriada. Sua remoção da cozinha não pode apagar o controle financeiro do pedido.

### Corpo por item vendido

Cada bloco apresenta:

1. Quantidade e nome limpo do lanche ou porção.
2. Composição de carnes por lanche, quando aplicável: “1 carne de 180 g” ou “2 carnes de 90 g”, somente com dados confirmados.
3. Combo e seus acompanhamentos, sem repetir o acompanhamento em outro bloco equivalente.
4. Ponto da carne, adicionais, retiradas e observações relevantes.

Usar quantidade numérica dos adicionais; não imprimir apenas seu nome. Se forem duas unidades do lanche, deixar claro quando o adicional é **por lanche**. Itens com pontos ou alterações diferentes devem ficar separados.

Exibir “Combo: 1 batata pequena + 1 bebida” quando a composição estiver confirmada. Bebida é informação de montagem/expedição e não entra nos totais de chapa ou fritadeira. Porções avulsas aparecem como itens próprios; acompanhamentos de combo ficam vinculados ao lanche correspondente.

A ficha completa com todos os ingredientes permanece opcional para treinamento ou necessidade de montagem. No padrão enxuto, imprimir os detalhes que mudam o preparo. Retiradas e instruções importantes nunca podem ser ocultadas pela opção de esconder a ficha completa.

### Rodapé de produção

Adicionar um único resumo para **os itens desta comanda**:

- **Chapa — carnes: quantidade total de discos de hambúrguer.**
- Detalhamento por tipo/gramatura quando houver mais de uma composição.
- Outros preparos de chapa, como ovos, em linha separada, sem somá-los como carnes.
- **Fritadeira — quantidade por tipo de preparo:** batata, anéis, frango, queijo empanado e outros componentes cadastrados.

Preferir “Fritadeira: 2 porções de batata + 1 frango” a um número isolado. Um total geral pode ser apresentado como “3 preparos” quando a unidade de contagem estiver definida, nunca como se três porções fossem três unidades físicas de batata.

Se não houver carnes ou frituras e o cálculo estiver completo, mostrar “Chapa: sem carnes” ou “Fritadeira: sem itens”. Se faltarem dados, mostrar “Quantidade a conferir”, sem transformar ausência de informação em zero.

## 4. Exemplo de impressão

Exemplo ilustrativo: um lanche simples e um duplo, ambos com carne bovina de 180 g; duas porções de batata de tamanhos diferentes. Os nomes e quantidades abaixo não são dados reais de pedido.

```text
CLIENTE: MARIA
Pedido #A12B34 | 19:42 | Retirada
--------------------------------
1x BURGER DA CASA
   1 carne bovina de 180 g
   Combo: 1 batata pequena + bebida
   Ponto: ao ponto
   RETIRAR: cebola

1x BURGER DUPLO
   2 carnes bovinas de 180 g
   Ponto: bem passado
   ADICIONAR: 1 ovo
   OBS: cortar ao meio

1x BATATA GRANDE
   Molho à parte
--------------------------------
RESUMO DE PRODUÇÃO
CHAPA: 3 CARNES
  Bovino 180 g: 3 unidades
  Outros: 1 ovo
FRITADEIRA: 2 PORÇÕES
  Batata pequena: 1
  Batata grande: 1
```

O resumo não substitui as instruções de cada lanche: o operador ainda precisa saber qual carne pertence ao pedido com retirada ou ponto diferente.

## 5. Regras para o cálculo do rodapé

### Uma origem de dados para KDS e impressão

Usar a composição confirmada do item vendido, quando disponível e validada. A impressão e o KDS devem apresentar os mesmos totais para os mesmos itens e a mesma versão do pedido.

Não extrair quantidades das frases geradas por `getBurgerPrintDetails`, como “2x Carnes”. Gerar o resumo a partir dos campos numéricos e componentes de produção. O texto é somente a apresentação final.

Verificar se os campos usados pelo cálculo já representam o total da linha vendida. Se `chapaPatties` já inclui `item.quantity`, somá-lo uma vez; multiplicar novamente dobraria ou triplicaria o resultado indevidamente.

### Quantidade e composição

- Um lanche simples com uma carne contribui com uma carne.
- Dois lanches simples contribuem com duas carnes; isso não transforma cada lanche em duplo.
- Um lanche duplo contribui com duas carnes.
- Um lanche simples com duas carnes extras contribui com três carnes.
- Ovo, bacon e queijo na chapa não são discos de hambúrguer.
- Batata incluída no combo entra uma vez; não somar novamente pela descrição ou pelo nome do produto.
- Adicional ou retirada deve afetar o componente correto, pela quantidade cadastrada.
- Peso precisa de conversão explícita para unidade de produção; não presumir 180 g por carne ou 150 g por porção.
- Não misturar tipos e gramaturas diferentes no detalhamento, mesmo que exista um total geral de carnes.

Para registros antigos incompletos, usar uma indicação de conferência e um fluxo de revisão. Não inventar detalhes de carne, bebida ou acompanhamento a partir de nomes conhecidos.

## 6. Organização técnica proposta

### Separar dados de apresentação

Criar uma função pura, por exemplo `buildKitchenTicket`, que receba o pedido confirmado e devolva:

- Cabeçalho: cliente, identificação, horário e contexto operacional.
- Linhas: produto, quantidade, composição, combo, adicionais, retiradas e observações.
- Resumo: carnes, outros preparos de chapa e frituras agrupadas com unidade.
- Estado de integridade: completo ou com itens a conferir.
- Tipo e versão da via: completa, reimpressão ou alteração.

O nome é uma proposta; essa função ainda precisa ser implementada. Deve ser testável sem abrir navegador nem consultar o banco.

### Uma representação compartilhada

Usar o mesmo resultado para o HTML da prévia e para o texto copiável. Hoje há dois blocos extensos de montagem de conteúdo em `ReceiptModal.tsx`, o que facilita diferenças entre o que aparece e o que é copiado.

Não chamar texto simples de comandos ESC/POS completos: o gerador atual produz principalmente texto e separadores. Se houver integração direta com impressora, a codificação e os comandos do equipamento devem ficar em uma camada própria.

### Layout de cozinha independente

Extrair a apresentação da cozinha para um componente próprio, preservando as vias de cliente e de alteração. Não aplicar a simplificação por mudanças globais que removam valores de todos os comprovantes.

Eliminar duplicações entre `fryerItems`, `comboDetails` e adicionais. Se uma informação já foi apresentada como acompanhamento do combo, não imprimi-la novamente como uma segunda ordem de fritura.

## 7. Legibilidade na impressora térmica

- Preto sobre branco, sem depender de cores ou emojis.
- Nome do cliente e quantidade/nome do produto com maior destaque.
- Detalhes com recuo discreto e texto legível; não deixar tudo em negrito máximo.
- Separadores simples entre itens e antes do rodapé.
- Retiradas e avisos com rótulo forte, evitando grandes áreas pretas.
- Quebra de linha para nomes longos; nunca truncar observações de preparo.
- Ajuste de largura por perfil da impressora, com teste para o equipamento real.

O motor atual fixa a área em 72 mm e o texto usa separadores de 40 colunas. Esses valores devem ser compatibilizados com a área imprimível do equipamento, especialmente para bobinas de 58 e 80 mm. Não presumir que a largura nominal do papel equivale à área útil.

O rodapé deve ficar **no fluxo do documento**, logo após o último item; não usar posicionamento fixo que possa repetir ou sobrepor totais. Evitar quebra dentro de um item curto e dentro do resumo, permitindo continuação para pedidos extensos. Não reduzir a fonte ou cortar conteúdo para forçar uma única página.

O navegador abrir a impressão não confirma saída física do papel. Usar “Impressão solicitada”, salvo se houver confirmação real do equipamento. Reimpressões devem ficar claramente marcadas como “REIMPRESSÃO — MESMO PEDIDO”.

## 8. Alterações e cancelamentos

A via diferencial existente precisa continuar distinta da comanda completa:

- Cabeçalho “ALTERAÇÃO DO PEDIDO”, identificação e horário da alteração.
- Separar adicionar, retirar/cancelar e modificar.
- Não mostrar o total completo do pedido como se fosse uma nova quantidade a preparar.
- Quando houver composição anterior e nova confiáveis, mostrar diferenças por estação: “Adicionar: 1 carne”, “Retirar da fila: 1 batata”.
- Se só houver alteração de observação e não for possível calcular uma diferença confiável, mostrar “Alteração de detalhes — conferir item”, sem inventar totais adicionais.

Cancelamento de item já preparado exige conferência operacional; um número negativo na comanda não equivale a devolver alimento ao estoque. A impressão não deve criar vendas, alterar produção ou movimentar estoque.

## 9. Plano de implementação

| Ordem | Ajuste | Conclusão verificável |
|---|---|---|
| 1 | Definir o conjunto de dados da via da cozinha | Cliente, itens, escolhas e composição disponíveis com significado claro |
| 2 | Criar função compartilhada de montagem e resumo | Totais numéricos conferidos, sem interpretar frases |
| 3 | Simplificar a apresentação da cozinha | Sem preços/CNPJ/cobrança; detalhes essenciais preservados |
| 4 | Integrar o rodapé nas saídas HTML e texto | Mesmos itens e totais na prévia e no texto |
| 5 | Ajustar reimpressão e via diferencial | Nenhuma indicação ambígua de novo preparo |
| 6 | Validar largura e impressão física | Sem cortes, sobreposições ou perda de legibilidade |

## 10. Testes de aceite

| Cenário | Resultado esperado |
|---|---|
| 1 simples com 1 ovo | Chapa: 1 carne; outros: 1 ovo |
| 2 simples | Chapa: 2 carnes, sem multiplicação duplicada |
| 1 duplo + 1 simples | Chapa: 3 carnes |
| 1 simples + 2 carnes extras | Chapa: 3 carnes; adicional identifica 2 unidades |
| Combo com batata + porção avulsa | Duas porções, cada tamanho identificado e sem duplicação |
| Frango, queijo empanado e batata | Cada tipo separado na fritadeira, com unidade correta |
| Mesmo produto com pontos diferentes | Blocos separados e resumo coerente |
| Receita alterada após a venda | Reimpressão preserva composição confirmada do pedido |
| Composição ausente | “Quantidade a conferir”, sem zero ou número estimado |
| Pedido com pagamento pendente | Via de cozinha sem cobrança; controle de cobrança preservado no fluxo próprio |
| Nome longo, acentos e observações extensas | Conteúdo completo, com quebra de linha legível |
| Pedido grande | Continuação sem corte; resumo após todos os itens |
| Reimpressão | Identificada, sem criar novo pedido ou nova baixa |
| Alteração de um item | Via diferencial não induz preparo de todo o pedido novamente |
| HTML e texto | Mesmos dados, quantidades e instruções |

Conferir primeiro com dados de teste e depois imprimir exemplos no equipamento da cozinha. O operador deve conseguir localizar o cliente, o preparo de cada item e os totais finais sem procurar informações comerciais no papel.
