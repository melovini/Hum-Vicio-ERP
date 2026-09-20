# Conferência de componentes na cozinha

## Correção

O resumo não escolhe mais o primeiro hambúrguer do catálogo pelo peso ou pela categoria do insumo. Fichas legadas mantêm a identificação do próprio insumo; fichas configuradas usam o componente selecionado. Queijo não se torna carne apenas por estar na categoria Carnes.

O texto do lanche e o resumo impresso usam o mesmo cálculo. Quantidades fracionárias de unidades de preparo geram conferência, sem arredondamento silencioso. Novas vendas recebem no servidor uma composição versão 3 com base, adicionais, retiradas e combo, por unidade vendida. A impressão multiplica essa composição uma única vez.

## Configuração do Argentina

1. Em Cardápio → Componentes, confira o componente de costela. O nome de impressão pode ser **Bovino recheado de costela 180 g**, tipo Hambúrguer, estação Chapa, unidade Disco e porção 180 g.
2. Na ficha do Argentina, na linha do hambúrguer recheado, escolha esse componente em **Como identificar na cozinha**. Faça o mesmo no Argentina duplo: uma unidade no simples e duas no duplo, respeitando a unidade do estoque.
3. Não vincule queijo, bacon ou recheios ao componente de hambúrguer. Eles não acrescentam discos. Quando exigirem preparo próprio, cadastre um componente separado.
4. Vincule a batata do combo à porção correta. Cadastre frango adicional com sua própria ficha e componente de fritadeira.
5. Confira a prévia e salve. O sistema só informa sucesso do cadastro de componente após confirmação da gravação.

Não há regra baseada no nome Argentina: outras hamburguerias podem usar seus próprios nomes, receitas e componentes.

## Pedidos antigos

Composições antigas sem identificação ou com números inválidos são sinalizadas para conferência. Não são reescritas automaticamente: não é seguro adivinhar a receita vigente na venda. Composições estruturadas válidas preservam nome, porção e quantidade históricos. A versão 2 guardava apenas a base; seus adicionais e combos ainda dependem dos vínculos disponíveis e devem ser conferidos quando o cadastro mudou.

Um vínculo explícito já salvo incorretamente como Bovino comum precisa ser corrigido na ficha pela gestão. O código não sobrescreve escolhas explícitas pelo nome do ingrediente. Não houve atualização de dados do banco de produção nesta entrega.

## Validação

Testes cobrem Argentina simples/duplo, costela separada do bovino, queijo na categoria Carnes, frango adicional, batatas de combo, recarga sem catálogo, alterações posteriores de nome/porção e rejeição de composição falsa enviada pelo navegador. As migrações já existentes de componentes e composição precisam estar aplicadas no ambiente publicado.

Antes de usar durante atendimento, conferir uma venda de teste na cozinha e imprimir no equipamento real. Publicar código no GitHub não confirma migrações, implantação ou impressão física.
