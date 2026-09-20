# Correção da ficha técnica e contagem por operação

Data: 20/09/2026.

## 1. Objetivo

Salvar a ficha técnica com segurança e tornar o cadastro simples: o operador informa o insumo, quanto o produto consome, onde será preparado e como deve ser contado. Gestão, venda, KDS e impressão devem usar a mesma composição confirmada.

A imagem apresenta: “Falha ao gravar a nova ficha técnica: Não foi possível concluir a operação no banco. A receita anterior foi restaurada.” Essa mensagem não identifica a causa original e não comprova que a restauração aconteceu.

Esta análise combina a imagem com o código atual. Não houve consulta ao banco de produção, reprodução da gravação real ou alteração do sistema. A causa específica da rejeição do banco precisa ser confirmada pelos registros técnicos.

## 2. Diagnóstico confirmado no código

### A chamada transacional não passa pelo cliente usado no navegador

`src/lib/store.ts`, nas funções `addProduct` e `updateProduct`, tenta executar `supabase.rpc('save_product_transaction', ...)`.

Porém, `src/lib/supabase.ts` aceita somente caminhos no formato `/rest/v1/nome_da_tabela`. Uma chamada RPC utiliza `/rest/v1/rpc/nome_da_funcao`, que não corresponde à expressão aceita. O adaptador devolve 403 antes de encaminhar a operação ao banco.

**Consequência:** a tentativa de salvar tudo numa transação falha nesse caminho, mesmo que a função já exista no banco. O programa segue para o caminho alternativo de gravações separadas.

**Ajuste:** criar uma rota específica e autenticada de cadastro de produto. Essa rota valida o perfil e os dados, obtém o operador da sessão e chama a função de banco usando o cliente exclusivo do servidor. Não liberar qualquer RPC pelo navegador nem enviar chave privada ao cliente.

### A edição apaga a ficha antes de confirmar a nova

Em `src/lib/store.ts`, aproximadamente linhas 2030–2060, o caminho alternativo:

1. Exclui as linhas da receita existente.
2. Tenta inserir a receita nova.
3. Se falhar, tenta reinserir a receita anterior.
4. Exibe “A receita anterior foi restaurada”.

A reinserção não verifica o erro retornado pelo cliente. Assim, a mensagem pode afirmar uma recuperação que não ocorreu. Uma queda de conexão entre as etapas também pode deixar a receita vazia. Nome e preço podem já ter sido alterados antes da falha.

**Ajuste:** remover esse caminho destrutivo de recuperação no navegador. Produto, receita e classificação devem ser gravados dentro de uma única transação no servidor/banco. Se qualquer etapa falhar, a versão anterior inteira permanece válida.

Na criação, revisar também a inserção de produto anterior à tentativa transacional: não criar primeiro e depois tentar salvar tudo novamente. Usar um único fluxo de criação/edição.

### A mensagem esconde a causa necessária para diagnóstico

`src/app/api/data/[table]/route.ts` troca erros do banco pela mensagem genérica “Não foi possível concluir a operação no banco”. Isso explica por que a imagem não informa coluna, vínculo ou validação que falhou.

**Ajuste:** manter mensagens simples para o operador, mas registrar no servidor um código de atendimento, a etapa, o código de erro do banco e informações técnicas sanitizadas. Não expor SQL, credenciais ou dados pessoais desnecessários na tela.

### Há uma inconsistência entre tipos e validação SQL

Em `src/lib/store/types.ts`, o comentário de `productionKind = 'none'` permite enviar à estação sem contar como proteína/porção. Já `20260919_recipe_production_classification.sql` rejeita estação diferente de `none` com tipo `none`.

**Ajuste:** definir uma regra única para “preparar sem contar como carne”. Por exemplo, queijo na chapa pode ser classificado como outro componente de chapa, com unidade própria, sem aumentar o número de hambúrgueres. Interface, tipos e banco devem aceitar exatamente as mesmas combinações.

## 3. O que conferir no banco antes de corrigir o ambiente

| Verificação | Por que importa |
|---|---|
| Migração `20260919_recipe_production_classification.sql` aplicada | O código já envia `production_station` e `production_kind`; colunas ausentes podem rejeitar a inserção |
| Valores aceitos nas restrições de estação e tipo | Valores diferentes entre tela e banco causam falha de gravação |
| Identificadores de produto e insumos realmente existentes | Há vínculos obrigatórios de receita com produto e estoque |
| Quantidades e unidades válidas | Nulos, valores inválidos e conversões incoerentes precisam ser recusados antes da gravação |
| Definição efetiva de `save_product_transaction` | Conferir assinatura, permissões, campos gravados e compatibilidade com a aplicação |
| Coluna de auditoria | A migração antiga cria `old_value`, mas a função nova insere `previous_value`; não foi localizada migração correspondente na pesquisa feita |

A divergência da auditoria pode fazer a transação falhar quando a rota de servidor for corrigida, caso o banco siga essas definições. Não é prova de que ela causou a mensagem atual: a chamada RPC do navegador já é bloqueada antes.

Consultar estrutura e registros de erro primeiro. Não apagar receitas, desativar restrições ou retirar campos novos do envio para fazer o erro desaparecer. Se houver ficha perdida, comparar cópia anterior, registros e backup e pedir revisão da gestão antes de republicá-la.

## 4. Fluxo seguro de salvamento

1. Operador edita a ficha sem alterar a versão publicada.
2. Tela valida os campos e destaca problemas na linha correspondente.
3. Uma requisição envia produto, ficha completa, versão esperada e identificador da tentativa à rota específica.
4. Servidor confirma acesso e valida estrutura, ingredientes, unidades e combinações operacionais.
5. Banco verifica concorrência e grava produto, receita, classificação e auditoria numa transação.
6. Servidor devolve os dados efetivamente persistidos e a nova versão.
7. Tela atualiza o cadastro e apresenta “Ficha salva”.

Se houver falha, preservar o formulário preenchido e oferecer nova tentativa. Se a conexão cair depois do envio, consultar o resultado pelo identificador da tentativa antes de repetir: ausência de resposta não significa que o banco não salvou.

Se outra pessoa tiver alterado a mesma ficha, informar “Este produto foi atualizado em outro terminal. Confira a versão mais recente antes de salvar.” Não sobrescrever silenciosamente nem descartar o rascunho local.

A operação deve preservar também subcategoria, regras de adicionais e demais campos do cadastro. Uma função que salva apenas nome, preço e receita não pode apagar ou ignorar os outros dados editados.

## 5. Cadastro simples para o operador

Apresentar uma tabela por produto:

| Insumo | Consumo por produto | Onde preparar | O que contar | Quantidade de preparo |
|---|---|---|---|---|
| Hambúrguer bovino 180 g | 1 unidade | Chapa | Carne bovina | 1 disco |
| Ovo | 1 unidade | Chapa | Ovo | 1 unidade |
| Batata pequena | 150 g | Fritadeira | Batata | 1 porção de 150 g |
| Queijo fatiado | 1 fatia | Montagem | Queijo | 1 fatia |
| Embalagem | 1 unidade | Não vai à cozinha | Não contar | — |

Os dados da tabela são exemplos de apresentação, não padrões a aplicar automaticamente a todos os produtos.

Oferecer destinos: **Chapa, Fritadeira, Forno, Preparo frio, Montagem, Outra operação e Não vai à cozinha**. Usar esses rótulos em português; os códigos internos ficam invisíveis ao operador.

Mostrar campos adicionais somente quando necessários. Um insumo controlado por peso exige porção definida para virar quantidade de unidades; um comprado por unidade pode reutilizar diretamente essa unidade. Permitir herdar uma classificação já revisada do insumo, com exceção explícita por ficha quando seu uso variar.

Não duplicar dois números editáveis sem vínculo: a quantidade de preparo deve ser derivada do consumo e da porção cadastrada ou exigir validação de equivalência. Mostrar “180 g consumidos = 2 discos de 90 g” para facilitar a conferência.

## 6. Regras para contagem correta

### Destino e tipo são informações diferentes

Estação define **onde preparar**. Tipo define **o que está sendo preparado**. Chapa pode receber carne, ovo e queijo; somar tudo como hambúrguer é incorreto.

Fritadeira deve separar porções de batata/anéis de unidades de frango/queijo. Forno e montagem também precisam aparecer quando houver trabalho nessas estações, mesmo sem contribuir para os totais de chapa/fritadeira.

### Converter unidades sem adivinhar

- 150 g e 0,150 kg são a mesma quantidade.
- 180 g com porção cadastrada de 90 g equivalem a duas unidades.
- 180 g com porção de 180 g equivalem a uma unidade.
- Sem porção definida, mostrar “Defina a porção para calcular”, sem presumir uma carne ou uma porção padrão.
- Validar números finitos e positivos; não arredondar automaticamente uma fração incoerente para esconder erro de cadastro.

O código atual já possui campos de porção e classificação explícita, mas `production-calculator.ts` ainda contém alternativas por nomes e porções fixas. Aproveitar os campos novos e limitar essas alternativas à revisão assistida de registros antigos.

### Quantidade vendida, adicionais e combos

Total de cada componente = quantidade vendida × composição final por produto, após adicionais e retiradas.

Resolver componentes por identificador e versão da ficha, nunca pela palavra “duplo” ou pelo nome do país do lanche. Um adicional pode conter vários ingredientes; todos devem ser considerados. Um acompanhamento de combo entra uma vez, sem segunda soma pela descrição textual.

Dois lanches simples representam duas carnes totais e continuam sendo dois lanches simples. Um lanche duplo tem duas carnes por unidade vendida.

Preservar a composição dos pedidos já confirmados ao alterar o cadastro. O KDS e a impressão devem usar o mesmo resultado numérico, sem refazer a classificação pelo nome atual do ingrediente.

## 7. Prévia antes de publicar

No final da ficha, exibir **“Para vender 1 unidade, a cozinha preparará:”**:

- Chapa: 1 carne bovina de 180 g e 1 ovo.
- Fritadeira: 1 porção de batata de 150 g.
- Montagem: componentes aplicáveis.

Permitir simular duas unidades e adicionais, sem criar venda ou descontar estoque. Mostrar pendências junto ao ingrediente: “Escolha onde preparar”, “Defina o tipo de item” ou “Informe o peso da porção”.

Salvar rascunho deve ser possível para completar depois. Publicar para venda exige ficha consistente. Produtos prontos, como bebida fechada, podem dispensar preparo mediante classificação explícita, sem serem confundidos com ficha faltante.

## 8. Mensagens curtas e verdadeiras

| Situação | Mensagem sugerida |
|---|---|
| Campo incorreto | “Revise a quantidade de Batata pequena.” |
| Sem classificação | “Escolha onde este ingrediente será preparado.” |
| Transação rejeitada com versão anterior preservada | “Não foi possível salvar. A ficha publicada não foi alterada. Seus ajustes continuam nesta tela.” |
| Resultado ainda desconhecido após queda de conexão | “Não conseguimos confirmar o salvamento. Verificando…” |
| Banco desatualizado | “O cadastro precisa de uma atualização do sistema. Seus ajustes foram mantidos. Código: …” |
| Conflito de edição | “Outra pessoa atualizou esta ficha. Compare as versões antes de continuar.” |
| Gravação confirmada | “Ficha salva e disponível para uso.” |

Não afirmar “restaurada” quando houve somente uma tentativa de restauração. A explicação técnica fica acessível ao suporte pelo código de atendimento, sem sobrecarregar o operador.

## 9. Plano de correção

| Prioridade | Entrega | Critério de conclusão |
|---|---|---|
| Imediata | Identificar rejeição real e conferir integridade da receita anterior | Causa registrada e produto afetado revisado |
| Alta | Rota de servidor para a transação e compatibilidade das migrações | Chamada não passa pelo adaptador que bloqueia RPC |
| Alta | Retirar exclusão/reinserção e restauração pelo navegador | Falha preserva produto e receita anteriores integralmente |
| Alta | Unificar valores de classificação na interface, servidor e banco | Mesmas combinações aceitas e mesmos erros por campo |
| Alta | Porções e conversões explícitas | Contagem correta sem pesos presumidos |
| Média | Prévia, rascunho/publicação e mensagens | Operador entende o que falta e não perde a edição |
| Alta para liberar | Testes reais em banco isolado e comparação KDS/impressão | Fluxo completo aprovado, inclusive falhas e concorrência |

## 10. Testes obrigatórios

- Salvar uma ficha válida e recarregar em outro terminal: composição idêntica.
- Falhar durante inserção ou auditoria: ficha, nome e preço anteriores permanecem completos.
- Desconectar após confirmação do banco: nova tentativa não duplica produto nem receita.
- Ingrediente inexistente ou unidade inválida: erro específico antes de publicação.
- Duas pessoas editando: conflito detectado sem sobrescrita silenciosa.
- Carne com ovo na chapa: uma carne e um ovo, não duas carnes.
- Duas carnes de 90 g versus uma de 180 g: contagens distintas e consumo equivalente em peso.
- Batata em g/kg: equivalência, respeitando a porção cadastrada.
- Queijo enviado à chapa sem ser carne: destino correto, contador de carnes inalterado.
- Forno, preparo frio, montagem e outra operação: orientação aparece no destino correto.
- Combo e adicional composto: todos os componentes contados uma única vez.
- Alteração de ficha após venda: pedido anterior conserva sua composição.
- Usuário sem permissão: servidor recusa gravação, mesmo fora da interface.

Não basta passar em testes que simulam o banco. É necessário executar as migrações e a transação em ambiente isolado para verificar colunas, restrições, permissões e recuperação de falhas.

## 11. Resultado esperado

O operador deve conseguir responder, em cada linha, “quanto usa”, “onde prepara” e “o que conta”, com uma prévia clara. O sistema deve impedir publicação incoerente e garantir que uma falha não destrua a ficha anterior. Isso reduz erros silenciosos e dá uma base única para estoque, KDS e comanda impressa.
