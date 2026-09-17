# Melhorias operacionais: cardápio, vendas, cozinha e configurações

Data: 17/09/2026. Referência do código analisado: `4e6c359`.

## 1. Objetivo e conclusão

Fazer com que o produto cadastrado na gestão, o produto vendido, os insumos descontados e a orientação recebida pela cozinha representem a mesma composição, sem exigir que o operador interprete ou corrija o sistema durante o atendimento.

A prioridade é substituir decisões baseadas no nome dos produtos por informações explícitas do cadastro. O nome deve servir para identificação visual. Quantidade de carnes, peso, estação de preparo, adicionais, composição de combos e preços devem ter campos próprios e uma origem confiável.

Há regras concretas no código que podem gerar contagens incorretas no KDS. Porém, não foram consultados os produtos reais do banco nem reproduzido o pedido relatado. Portanto, os mecanismos abaixo estão confirmados no código, mas a causa específica daquele hambúrguer ainda precisa ser vinculada ao seu cadastro e pedido.

Este documento é uma análise e um plano de implementação. As melhorias não foram aplicadas nesta etapa.

## 2. Por que um hambúrguer simples pode aparecer com duas carnes

### Comportamentos encontrados

Em `src/app/(modules)/cozinha/page.tsx`, na montagem dos detalhes de produção, aproximadamente linhas 600–699:

1. O marcador de duplo vem de `baseLower.includes('duplo')`, independentemente da composição efetiva.
2. Cada ingrediente cuja estação seja `chapa` acrescenta `quantidade da receita × quantidade vendida` ao contador de carnes.
3. Essa soma não verifica se o ingrediente é uma carne, um ovo, um queijo ou outro item preparado na chapa.
4. A quantidade da receita não é convertida de peso para unidades de produção. Uma quantidade em kg pode ser tratada como número de carnes.
5. Se não encontrar uma estação quente na receita, o sistema tenta deduzir o preparo por nomes como Argentina, Brasil, Israel, burger e duplo.
6. Os adicionais são reunidos a partir do campo de adicionais e também de trechos do nome entre colchetes. Se a mesma escolha existir nas duas representações, pode ser contada novamente.
7. Um adicional gravado como `2x Hambúrguer...` é percorrido como um único adicional: o código soma a quantidade de lanches, sem interpretar explicitamente as duas unidades.
8. Combos podem contribuir pela receita e novamente por palavras como batata no nome ou no campo de combo.

**Exemplo de mecanismo, não reprodução do caso real:** se uma receita tiver uma carne e um ovo, ambos com quantidade 1 e estação chapa, o contador atual pode apresentar duas carnes. Outro cenário é o nome conter “duplo” e a receita não resolver a produção, acionando o multiplicador de duas carnes.

A indicação “duplo” e o total de carnes são problemas relacionados, mas distintos: dois lanches simples precisam de duas carnes no total sem que nenhum deles seja um lanche duplo.

### Como investigar o produto relatado

- Registrar o identificador do produto e do item vendido, nome, quantidade, receita e unidades dos insumos.
- Conferir a estação de cada ingrediente e quais deles realmente são carnes em disco.
- Comparar os adicionais estruturados com os adicionais presentes no nome.
- Conferir se o pedido tem combo e se sua composição está sendo somada duas vezes.
- Comparar o cadastro atual com o vigente na venda. Hoje o KDS consulta o cadastro disponível, o que pode ter mudado.
- Exibir, numa ferramenta de diagnóstico para a gestão, a origem de cada parcela: base, adicional, retirada e multiplicação pela quantidade vendida.

Não corrigir apenas retirando a palavra “duplo” de um nome: isso pode esconder uma das causas e deixar as demais ativas.

## 3. Cadastro mínimo para uma produção confiável

### Separar três informações

| Informação | Exemplo | Para que serve |
|---|---|---|
| Consumo de estoque | 0,180 kg de blend por lanche | Baixa de estoque e custo |
| Unidade de produção | 1 disco bovino de 180 g por lanche | Orientação da cozinha |
| Local de preparo | Chapa | Distribuição do trabalho |

“Vai para a chapa” não significa “é uma carne”. O sistema deve distinguir o tipo de componente da estação que o prepara.

Para um produto que usa hambúrguer comprado por unidade, registrar uma unidade do insumo e uma unidade de produção. Para carne controlada por peso, cadastrar a porção e sua conversão. Não assumir que toda carne pesa 180 g.

### Modelo proposto, a adaptar ao banco existente

| Cadastro | Dados mínimos |
|---|---|
| Produto | Identificador, nome, ativo, categoria, versão publicada e preços por canal |
| Componente da receita | Insumo, quantidade, unidade, tipo de componente, porção quando aplicável e estação |
| Porção de produção | Identificador, descrição, peso/medida e unidade consumida no estoque |
| Adicional | Identificador do produto adicional, quantidade selecionável, preço, composição e compatibilidade |
| Combo | Componentes identificados, quantidades, escolhas permitidas e definição de preço completo ou acréscimo |
| Personalização | Identificador da escolha, ação de adicionar/remover/substituir, componente afetado e quantidade |
| Item vendido | Quantidade, preço confirmado, escolhas e cópia da composição de produção vigente na venda |

Evitar dois cadastros independentes de quantidade de carne que possam divergir. A orientação da cozinha deve ser derivada dos componentes tipados e porções da ficha aprovada. Se for necessário permitir uma exceção, ela deve ter motivo, responsável e validação de consistência.

Para o operador, os rótulos podem ser simples: “Tipo: carne bovina”, “Quantidade por lanche: 1”, “Peso por unidade: 180 g”, “Preparo: chapa”. Não expor nomes de tabelas ou detalhes internos.

### Regra de contagem

Para cada tipo de componente:

**Total a preparar = quantidade de lanches × (unidades da receita + unidades adicionais − unidades retiradas).**

Validar que o resultado não seja negativo e que componentes contáveis tenham quantidades coerentes. Peso e volume devem permanecer em suas unidades. Uma configuração fracionária inválida deve gerar revisão, e não ser arredondada silenciosamente.

Exemplo: dois lanches simples, cada um com uma carne base e duas carnes adicionais, exigem seis carnes. Um lanche duplo com quantidade vendida 1 exige duas. Agrupar por tipo e porção: duas carnes de 90 g não são equivalentes a uma de 180 g para orientação de preparo.

## 4. Verificador de cadastro e prévia do KDS

Criar a seção **“Como este produto aparece na cozinha”** no cadastro do cardápio. Ao editar, apresentar uma prévia para uma unidade:

> Lanche bovino — 1 unidade vendida  
> Chapa: 1 carne bovina de 180 g  
> Montagem: pão, queijo e molho  
> Estoque: consumo conforme a ficha técnica

Permitir simular quantidade vendida, adicional, retirada e combo com o mesmo cálculo usado na operação. Essa prévia não deve criar vendas nem descontar estoque.

### Validações obrigatórias antes de disponibilizar para venda

- Produto preparado tem ficha de produção suficiente ou uma classificação explícita que explique sua dispensa, como bebida pronta.
- Ingredientes referenciados existem e estão disponíveis para uso.
- Quantidades são positivas e unidades compatíveis; conversões necessárias estão cadastradas.
- Estação e tipo de componente estão definidos quando necessários.
- Adicionais têm identificação, quantidade e composição; não dependem de interpretar seu nome.
- Combo distingue o preço total do preço de acréscimo e não replica componentes já incluídos.
- Receita não contém ciclos de pré-preparos nem referências inexistentes.
- Há preço válido para o canal habilitado; cortesia segue regra própria e não surge de preço ausente.
- A publicação só é confirmada depois que produto, receita e regras forem gravados com sucesso.

### Avisos que pedem revisão, sem adivinhar a resposta

- Nome contém “duplo”, mas a composição declara uma carne.
- Nome menciona um peso diferente da porção cadastrada.
- Receita possui ingredientes repetidos ou uma mudança expressiva na quantidade de carnes.
- Custo de ingrediente não informado: apresentar custo incompleto, não margem aparentemente confiável.

O nome pode ajudar a detectar contradições; nunca deve determinar automaticamente a quantidade produzida.

Criar também uma lista **“Produtos para revisar”**, com motivo e botão para abrir o cadastro. Não tentar normalizar todos os cadastros antigos automaticamente durante o atendimento.

## 5. Valores e regras que devem sair do código

“Volátil”, neste contexto, significa informação que pode mudar na operação e deve ser persistida como configuração, e não uma variável temporária.

| Situação encontrada | Evidência | Destino recomendado | Prioridade |
|---|---|---|---|
| 19 adicionais com nomes e preços fixos | `src/components/caixa/PosBurgerCustomizerModal.tsx`, `FALLBACK_ADDITIONALS` | Catálogo de adicionais aprovado pela gestão | Alta |
| Combos de batata e anéis com preços fixos: 14/16 e 16/18 por canal | Mesmo arquivo, alternativa de `availableCombos` | Cadastro de composição e preço por canal | Alta |
| Quantidade e tipo de preparo deduzidos por nomes de lanches | `src/app/(modules)/cozinha/page.tsx` | Componentes de produção identificados | Crítica |
| Estação deduzida por nomes de ingredientes e pesos conhecidos | `src/lib/store/production-rules.ts`, `DEFAULT_INGREDIENT_STATIONS` | Estação explícita do componente; sugestão inicial exige confirmação | Alta |
| Adicionais e porções inferidos por palavras como extra/adicional | `PosBurgerCustomizerModal.tsx` e página do cardápio | Papel explícito do produto e lista de compatibilidade | Alta |
| Categorias padrão como Artesanais 180g e Linha Duplos | `src/lib/subcategory-store.ts` e `src/lib/recipe-helpers.ts` | Cadastro central; modelos iniciais opcionais | Média |
| Custos fixos exemplificados, como aluguel 2500 e folha 4500 | `src/lib/store/types.ts`, `DEFAULT_FIXED_EXPENSES` | Configuração real com período de vigência; vazio enquanto não informado | Alta |
| Meta de preparo de 20 minutos em múltiplos pontos | `src/lib/store.ts` e página da cozinha | Meta do estabelecimento, com eventual exceção por produto e cópia no pedido | Média |
| Meta de custo da receita de 30% | `src/lib/recipe-helpers.ts`, `calculateRecipeMetrics` | Meta configurável e explicitamente apresentada como objetivo | Média |
| Tarefas padrão da cozinha | `src/lib/store.ts`, `defaultChecklistTasks` | Modelo de checklist editável pela gestão | Média |
| Opções e instruções rápidas de preparo | `PosBurgerCustomizerModal.tsx`, `quickNotes` | Opções cadastradas por tipo de produto, com escolha estruturada | Média |

Quando o catálogo estiver vazio ou falhar, não oferecer automaticamente adicionais e preços inventados pelo programa. Distinguir “não há opções cadastradas” de “não foi possível carregar”. Um catálogo local previamente confirmado pode apoiar contingência, com versão, validade e indicação de desatualização.

Não é necessário transformar tudo em configuração: conversão de kg para g, regras de integridade, validações de acesso e prevenção de duplicação devem continuar controladas pelo sistema. Preferências de aparência e volume podem permanecer por aparelho. Receita, preço, quantidade, compatibilidade e meta operacional precisam de origem central.

## 6. Gestão do cardápio: gravação completa e publicação

**Evidências:** `src/lib/store.ts`, funções `addProduct` e `updateProduct`.

Produto e receita são gravados em etapas separadas. A edição apaga a receita anterior antes de inserir a nova. Parte dessas chamadas não verifica explicitamente o erro retornado pelo cliente de banco. Isso cria risco de cadastro parcialmente salvo e mensagem de sucesso sem ficha completa.

Implementar uma operação de servidor que grave o conjunto como uma unidade: ou todas as mudanças são confirmadas ou a versão anterior continua válida. Adicionar controle de versão para que dois gestores não sobrescrevam alterações sem aviso.

Usar estados simples: **Rascunho → Validado → Disponível para venda → Inativo**. Uma edição pode ficar em rascunho enquanto a versão publicada continua vendável. Inativação não apaga o histórico.

O reconhecimento aproximado de ingredientes em `findMatchingInventoryItem`, de `src/lib/recipe-helpers.ts`, pode sugerir vínculos, mas não deve decidir silenciosamente a receita: usa primeiro ingrediente, semelhança de nomes e palavras em comum. Mostrar a sugestão para confirmação e persistir o identificador selecionado.

## 7. Venda: preservar escolhas sem convertê-las em texto

**Evidências:** `src/lib/store/types.ts`, `SaleItem`; `PosBurgerCustomizerModal.tsx`, `handleSave`.

Hoje os adicionais têm essencialmente nome e preço. A quantidade é colocada dentro do nome, por exemplo “2x ...”. O combo também é representado por texto. Essa representação perde a ligação confiável com o cadastro.

Implementar:

- Adicionais com identificador, quantidade numérica, preço unitário confirmado e composição correspondente.
- Combo com identificador, componentes e opções escolhidas.
- Ponto da carne e retiradas como escolhas próprias; observação livre permanece para instruções complementares.
- Validação de compatibilidade, produto ativo, limites de escolhas e preço no servidor.
- Resumo antes de confirmar: “1 lanche · 1 carne base + 1 extra · sem cebola”.
- Separação de itens do mesmo produto quando as escolhas forem diferentes.
- Política explícita para preço alterado enquanto o carrinho está aberto: atualizar com aviso ou preservar por prazo definido e validado no servidor.

Remoções precisam distinguir componente físico de item de montagem. “Sem cebola” não remove um hambúrguer cuja receita interna usa cebola. Também não se deve reduzir retrospectivamente consumo de pré-preparo já produzido; registrar a regra de consumo no estágio adequado.

## 8. Uma composição confirmada para cozinha e estoque

Ao confirmar a venda, o servidor deve calcular e guardar a composição resolvida daquele item, incluindo a versão da receita, escolhas e consumos. O KDS exibe essa composição; não a reconstrói pelo nome ou pelo cadastro atual.

**Benefício:** se o gestor alterar amanhã a receita de um lanche de uma para duas carnes, um pedido já enviado mantém a orientação original. Alterações de pedidos ativos devem ser explícitas, mostrar diferenças e pedir ciência da cozinha quando necessário.

**Evidência adicional:** a migração `supabase/migrations/20260917_atomic_sales_and_idempotency.sql` procura adicionais por nome e utiliza `LIMIT 1` ao buscar sua receita. Isso pode deixar de representar adicionais compostos por vários insumos. A rotina de reversão também consulta a receita atual. A aplicação efetiva dessa migração no banco não foi verificada nesta análise.

Evoluir para:

- Desconto de todos os componentes efetivamente consumidos, com conversões de unidade.
- Registro dos movimentos vinculados ao item vendido e sua composição confirmada.
- Cancelamento que reverta os movimentos originais quando houver devolução ao estoque.
- Tratamento distinto de cancelamento antes do preparo e perda após preparo; comida já produzida não volta automaticamente ao estoque utilizável.
- Alteração de pedido que aplique apenas diferenças e preserve o que já foi preparado.
- Proteção contra repetição da mesma venda ou alteração em reconexão.

A regra compartilhada deve ser determinística e testada. O servidor é a autoridade; a prévia do cadastro usa a mesma definição para não existir um cálculo diferente em cada tela.

## 9. Configurações iguais em todos os terminais

**Evidências:** `src/lib/subcategory-store.ts` grava categorias no armazenamento local; `src/lib/store.ts` mantém mapas locais de adicionais, estações e subcategorias, além de custos e meta de preparo. Há persistência de alguns campos no banco e alternativas locais; é necessário eliminar a ambiguidade de qual valor vale.

Centralizar configurações operacionais por estabelecimento, com versão, autor e data de alteração. O navegador pode guardar uma cópia para acelerar o uso, mas deve identificar sua versão e atualizar após publicação.

Não remover todas as cópias locais antes de migrar: elas podem conter informações existentes só em um terminal. Comparar os aparelhos, apresentar conflitos à gestão e publicar a configuração aprovada. Nunca escolher automaticamente a versão mais recente sem verificar sua origem.

Preços, fichas e regras de adicionais: gestão autorizada. Operadores: uso e sinalização de erro. Mudanças sensíveis devem manter histórico; não disponibilizar parâmetros internos indiscriminadamente ao caixa.

## 10. Matriz mínima de testes operacionais

| Caso | Resultado esperado |
|---|---|
| 1 lanche com 1 carne bovina | 1 carne na chapa |
| 2 lanches simples iguais | 2 carnes totais, sem classificar cada lanche como duplo |
| 1 lanche com 2 carnes cadastradas | 2 carnes, independentemente do nome |
| 1 carne + 1 ovo, ambos na chapa | 1 carne e 1 ovo separados |
| 0,180 kg de blend com porção de 180 g | 1 carne, consumo de 0,180 kg |
| Nome duplo com receita simples | Aviso na validação; cálculo não altera a receita |
| 1 simples + 2 carnes extras | 3 carnes e consumo/preço de 2 adicionais |
| 2 lanches com 2 extras por lanche | 6 carnes no total |
| Adicional no texto legado e no campo estruturado | Não duplicar; migrar a representação com confirmação quando ambígua |
| Combo com 1 batata | 1 porção, sem somar duas vezes por receita e nome |
| Adicional com vários ingredientes | Todos os componentes considerados |
| Receita alterada depois da venda | Pedido anterior mantém composição confirmada |
| Produto renomeado | Contagem e estação permanecem iguais |
| Dois terminais com o mesmo pedido | Mesma composição e totais |
| Falha ao gravar parte da receita | Publicação falha e versão anterior permanece íntegra |
| Pedido enviado novamente após queda | Sem segunda venda nem segunda baixa |
| Cancelamento após preparo | Aplicar política de perda/devolução, sem repor insumos automaticamente |
| Produto sem definição de produção | Aviso e fluxo controlado, sem estimativa silenciosa |

Criar testes do cálculo e da integração real com o banco em ambiente isolado. Complementar com uma conferência do operador: cadastro → prévia → venda → KDS → consumo de estoque. A matriz acima é proposta; não foi executada nesta revisão.

## 11. Ordem de implementação dentro da necessidade da operação

| Etapa | Entrega | Critério de conclusão |
|---|---|---|
| 1 — Conter erros de produção | Revisar produtos bovinos e separar tipo, unidade e estação no cálculo | Casos simples, duplos, ovo e extras conferidos; sem dedução automática silenciosa |
| 2 — Cadastro confiável | Validador, prévia, rascunho/publicação e gravação completa | Cadastro incompleto não é disponibilizado inadvertidamente |
| 3 — Escolhas identificadas | Adicionais, combos e personalizações estruturados | Quantidades e vínculos sobrevivem à gravação e recarga |
| 4 — Pedido consistente | Composição confirmada por versão, compartilhada por KDS e estoque | Alterar o cardápio não muda pedidos enviados |
| 5 — Configuração central | Preços alternativos, metas, custos e categorias fora do código | Alteração pela gestão aparece igualmente nos terminais |
| 6 — Robustez operacional | Edição, cancelamento, perdas, reconexão e testes completos | Matriz operacional aprovada em homologação e piloto |

Começar com os tipos e estações realmente usados pela hamburgueria. Não é necessário construir um editor genérico de regras, uma plataforma de automações ou dezenas de telas de configuração para resolver esses problemas.

## 12. Migração sem interromper o atendimento

1. Inventariar produtos ativos, receitas, unidades, adicionais, combos e configurações locais. Preservar uma cópia verificável antes das alterações.
2. Gerar relatório de inconsistências, priorizando produtos mais vendidos e os citados pelos operadores.
3. Preparar os novos campos de forma compatível com o funcionamento atual.
4. Converter automaticamente apenas dados inequívocos. Nomes e quantidades ambíguas exigem conferência da gestão.
5. Comparar o cálculo antigo e o novo fora da orientação operacional; divergências vão para revisão, não para duas contagens conflitantes na tela da cozinha.
6. Validar a matriz de testes e pedidos representativos, sem movimentar o estoque real.
7. Publicar os cadastros aprovados e ativar o fluxo novo num período de menor movimento, com responsáveis definidos.
8. Preservar pedidos em andamento e identificar registros legados. Não inventar retrospectivamente composição histórica ausente.
9. Monitorar divergências, produtos sem vínculo, falhas de gravação e intervenções manuais. Manter retorno à versão anterior compatível, sem apagar vendas novas.

Para pedidos legados sem composição verificável, mostrar “Conferir composição” e permitir confirmação autorizada registrada. Não exibir um número suposto como se fosse exato.

## 13. Resultado esperado e limites

O operador deve enxergar uma instrução direta: quantos lanches, quais componentes preparar, quantas unidades, quais adicionais e quais retiradas. A gestão deve conseguir alterar preço, porção e composição sem editar código, com prévia do impacto antes de publicar.

Nenhum sistema elimina toda possibilidade de erro humano. O objetivo verificável é impedir erros silenciosos, reduzir escolhas ambíguas e tornar divergências visíveis antes de chegarem à chapa.

Esta revisão examinou o código atual de cardápio, personalização de vendas, tipos de dados, regras do KDS, persistência de receitas, configurações locais e rotinas SQL relacionadas. Não incluiu consulta ao banco de produção, auditoria fiscal, teste de hardware ou reprodução do produto específico relatado. As referências são pontos de investigação e implementação; mudanças posteriores no código podem deslocar as linhas.
