# Como deixar o ERP mais rápido e fácil de usar

Data da análise: 16/09/2026.

## 1. Conclusão principal

O código atual tem oportunidades concretas para reduzir a espera: cada tela deve buscar apenas o necessário para começar a trabalhar, as atualizações devem trazer menos dados e o navegador deve evitar refazer trabalho desnecessário.

Hoje, abrir a cozinha ou uma tela de gestão aciona um carregamento compartilhado com informações de várias áreas. A resposta só chega depois que todas as consultas desse carregamento terminam. Além disso, o sistema busca itens de vendas sem limitar aos pedidos exibidos e repete essa busca durante o uso.

**Os mais de 6 segundos foram relatados pelo usuário; não foram cronometrados nesta análise.** Os comportamentos descritos abaixo foram encontrados no código. A participação de cada um no tempo total precisa ser medida no ambiente real. Não é possível afirmar, apenas lendo os arquivos, que o banco, a hospedagem ou a internet sejam o principal responsável.

Este documento apresenta um plano de melhoria. Nenhuma alteração no funcionamento do ERP foi realizada nesta etapa.

## 2. O que acontece quando uma tela é aberta

Em linguagem simples, o caminho principal é:

1. O navegador recebe o programa da tela.
2. A tela inicia o carregamento compartilhado de dados.
3. O servidor verifica a sessão e o cadastro do operador.
4. O servidor consulta várias tabelas ao mesmo tempo, conforme as permissões do operador.
5. O servidor espera essas consultas terminarem e devolve um pacote de dados.
6. O navegador organiza os pedidos, produtos e demais informações.
7. A cozinha libera sua tela principal quando o carregamento geral está concluído.
8. Durante o uso, novas consultas de vendas e itens acontecem a cada 3,5 segundos.

Existe uma melhoria já implementada: `/api/bootstrap` reúne o carregamento inicial em uma chamada do navegador e executa consultas em paralelo no servidor. Também há reaproveitamento de dados locais e proteção contra duas cargas iniciais simultâneas. Portanto, a recomendação não é simplesmente “colocar tudo em paralelo”: parte disso já existe.

O problema restante é **o tamanho e a abrangência do trabalho feito antes de liberar cada função**.

## 3. Problemas encontrados e como melhorar

### 3.1. Cada módulo recebe dados além do necessário

**Evidência:** `src/app/api/bootstrap/route.ts`, função `GET`; `src/lib/store.ts`, função `executeParallelLoadData`.

O carregamento inicial pode executar até 14 consultas de dados, dependendo do perfil. A seleção é por permissão, não pela tela aberta. Um administrador que entra na cozinha pode receber também fornecedores, compras, auditorias e outros dados que não são necessários para começar a preparar pedidos.

As consultas são paralelas, mas a resposta única espera a mais demorada. Uma área secundária pode atrasar o conjunto.

**Melhoria proposta:** criar carregamentos separados para caixa, cozinha e gestão. O servidor deve continuar conferindo as permissões; indicar o módulo não concede acesso adicional.

| Tela | Buscar primeiro | Buscar quando necessário |
|---|---|---|
| Vendas/caixa | Turno atual, cardápio, preços e regras necessárias para vender | Histórico, mapa de mesas, rotas, clientes e relatórios conforme a função aberta |
| Cozinha | Turno relevante, pedidos pendentes e respectivos itens | Checklist, perdas, consultas antigas e informações auxiliares |
| Gestão | Resumo do período escolhido | Detalhes, listas extensas, comparações e exportações |

**Resultado esperado:** reduzir o volume transferido e impedir que informações secundárias atrasem a tarefa principal. O ganho em segundos depende da medição.

**Como confirmar:** abrir a cozinha com um administrador e comprovar que consultas de compras, fornecedores e auditorias não fazem parte da carga essencial.

### 3.2. Os itens não são limitados aos pedidos carregados

**Evidência:** `src/app/api/bootstrap/route.ts`, consulta `saleItems`; `src/lib/store.ts`, carregamento alternativo e `startBackgroundPoller`.

As vendas iniciais têm limite de 80 registros. Já os itens são consultados apenas com a condição de pertencerem a alguma venda, sem restringir aos mesmos pedidos. Na atualização periódica, são buscadas até 60 vendas e novamente os itens sem esse recorte.

Isso pode transferir muitos registros desnecessários. Também existe um risco de exatidão: se o serviço de banco limitar a resposta, podem faltar itens dos pedidos que estão na tela. Não foi verificado qual limite está configurado no ambiente real.

**Melhoria proposta:** consultar somente os itens dos pedidos selecionados, usando seus identificadores, ou devolver pedidos e itens juntos por uma consulta controlada no servidor. Selecionar apenas os campos necessários.

Na cozinha, buscar pedidos pelo estado de produção e regra de turno, e não simplesmente os últimos 60 ou 80. Um pedido antigo ainda pendente não pode desaparecer porque entraram pedidos novos. Definir também como tratar pendências que atravessam a troca de turno.

**Como confirmar:** preparar uma base de teste com muitos pedidos antigos e um pedido pendente antigo. A carga operacional deve continuar pequena e exibir esse pedido com todos os seus itens.

### 3.3. A atualização constante repete trabalho demais

**Evidência:** `src/lib/store.ts`, função `startBackgroundPoller`.

A cada 3,5 segundos, o sistema busca vendas e depois itens. Essas duas chamadas são sequenciais. Não há, nessa função, proteção explícita para impedir que o próximo ciclo comece antes do anterior terminar.

Se a rede estiver lenta, ciclos podem se sobrepor e disputar recursos. Respostas antigas também podem chegar depois das novas. O mecanismo é compartilhado por instâncias de `useInventory` na mesma página, o que já evita alguns duplicados, mas outras abas e outros aparelhos continuam fazendo suas próprias consultas.

Como referência matemática, dois pedidos de dados a cada 3,5 segundos representam aproximadamente 34 chamadas por minuto por aba ativa, quando os ciclos conseguem completar. Isso não é uma medição de tráfego real e não inclui as demais chamadas do sistema.

**Melhoria proposta, primeiro passo:**

- Iniciar o próximo ciclo somente depois de concluir o anterior.
- Buscar pedidos e itens relevantes em uma resposta operacional pequena.
- Ignorar respostas ultrapassadas e não atualizar a tela quando nada mudou.
- Reduzir tentativas durante falhas e retomar a atualização ao recuperar a conexão.
- Ajustar a frequência por módulo. A cozinha exige atualização mais rápida do que relatórios.
- Reduzir trabalho em abas ocultas apenas quando isso não prejudicar alertas necessários à operação.

**Evolução posterior:** avaliar notificações de mudança para atualizar somente os pedidos alterados. A solução precisa de autorização, recuperação de eventos perdidos e reconciliação após reconectar. Não basta habilitar uma conexão permanente e presumir que todas as mensagens chegarão.

**Como confirmar:** em rede lenta, manter no máximo um ciclo de atualização em andamento por responsável pela sincronização. Com a tela parada, medir a redução de chamadas e de dados recebidos.

### 3.4. A conferência de acesso se repete em cada chamada

**Evidência:** `src/lib/security/server-session.ts`, função `requireSession`; `src/app/api/data/[table]/route.ts`.

Cada chamada à API genérica consulta primeiro a sessão e depois o colaborador; só então consulta os dados solicitados. São etapas dependentes no caminho da resposta. O carregamento inicial unificado já reduz essa repetição em relação a várias chamadas separadas.

**Melhoria proposta:** manter o controle de acesso e diminuir chamadas fragmentadas. Avaliar uma consulta única para validar sessão e colaborador, preservando bloqueio de usuário, expiração, mudança de perfil e revogação.

Não remover a autenticação para ganhar velocidade. Também não compartilhar dados privados entre operadores por meio de armazenamento intermediário sem separação e controle adequados.

**Como confirmar:** medir separadamente o tempo de validação e o tempo de consulta dos dados. Repetir os testes de acesso revogado após qualquer otimização.

### 3.5. A cozinha fica bloqueada pelo carregamento geral

**Evidência:** `src/app/(modules)/cozinha/page.tsx`, condição `if (!isLoaded)`; `src/lib/store.ts`, atualização final de `isLoaded`.

A cozinha mostra “Carregando Cozinha KDS...” até o estado geral estar pronto, quando não há dados locais suficientes para antecipar a exibição.

**Melhoria proposta:** ter estados independentes para pedidos, checklist e informações auxiliares. Liberar os pedidos assim que o conjunto essencial estiver confirmado. Mostrar a estrutura da tela durante a espera, sem apresentar valores vazios como se fossem reais.

Exemplos de mensagens:

- “Buscando pedidos da cozinha…”
- “Mostrando os últimos dados recebidos. Atualizando…”
- “Não foi possível atualizar. Última atualização às 19h42.”
- “Tentar novamente”.

Uma tela aparecer mais cedo melhora a experiência, mas só conta como pronta quando a tarefa principal pode ser executada com dados suficientes e confiáveis.

### 3.6. O navegador refaz trabalho que poderia ser mais localizado

**Evidência:** `src/lib/store.ts`, `getStoreSnapshot`, `useInventory` e montagem dos itens de cada venda; `src/app/(modules)/cozinha/page.tsx`, relógio que atualiza `now` a cada segundo.

O estado compartilhado é entregue inteiro aos componentes que usam `useInventory`. Alterações nesse objeto notificam todos os seus assinantes, mesmo quando a mudança não interessa a determinada tela. Além disso, a montagem de cada venda percorre a lista de itens para encontrar seus correspondentes.

Na cozinha, o relógio fica no componente principal. Sua atualização a cada segundo solicita uma nova renderização desse componente. O custo real depende do tamanho da tela e das otimizações existentes; não foi medido nesta revisão.

**Melhoria proposta:**

- Separar os dados por responsabilidade e permitir que cada componente acompanhe apenas o que usa.
- Organizar os itens uma vez por identificador de venda, em vez de percorrer a lista inteira para cada pedido.
- Isolar relógios e cartões de pedidos, preservando os componentes que não mudaram.
- Manter referências estáveis para dados inalterados nas sincronizações.
- Medir o tempo gasto com leitura e gravação de dados locais antes de substituir o armazenamento atual.

**Como confirmar:** durante um minuto sem pedidos novos, o restante do painel não deve refazer cálculos pesados por causa do relógio. Digitação, rolagem e botões devem continuar respondendo durante a sincronização.

### 3.7. O caixa reúne muitas funcionalidades no mesmo carregamento

**Evidência:** imports e abas em `src/app/(modules)/caixa/page.tsx`, incluindo recibos, rotas, mapa de mesas, ajuda e treinamento.

Há várias funcionalidades importadas diretamente pela página. Isso é um candidato a aumentar o programa inicial recebido pelo navegador. O tamanho efetivo dos arquivos entregues precisa ser medido; quantidade de linhas de código, sozinha, não prova lentidão.

**Melhoria proposta:** carregar funções secundárias quando forem abertas. Manter imediatas as funções essenciais de venda. Antecipar o carregamento de uma função provável durante períodos ociosos, se a medição mostrar benefício.

Separar arquivos ajuda a manutenção, mas só reduz o carregamento inicial quando a forma de importação e entrega também é alterada. Não adiar componentes essenciais a ponto de criar uma nova demora no primeiro clique.

**Como confirmar:** comparar o volume de código inicial antes e depois, além do tempo para abrir mesas, recibo e demais funções pela primeira vez.

### 3.8. Relatórios precisam de dados próprios e completos

**Evidência:** `src/app/(modules)/admin/dashboard/page.tsx`, filtros de período sobre `sales`; limites de 80 vendas no carregamento inicial e 60 na atualização periódica.

O painel de gestão filtra os dados de vendas disponíveis no estado compartilhado. Uma lista limitada às vendas recentes não garante representar uma semana ou um mês inteiro. Aumentar indiscriminadamente essa lista também tornaria a abertura mais pesada.

**Melhoria proposta:** o servidor deve calcular os totais do período solicitado e devolver um resumo pequeno. Os detalhes devem ser carregados em páginas, quando abertos. Usar o mesmo período, fuso horário e regras de cancelamento nos totais e nos detalhes.

**Como confirmar:** comparar os resultados com uma base de referência que tenha mais de 80 vendas no período. O relatório deve estar correto sem transferir todo o histórico para o navegador.

### 3.9. Falhas podem parecer ausência de dados

**Evidência:** `src/app/api/bootstrap/route.ts`, transformação de resultados sem `data` em listas vazias; `src/lib/store.ts`, tentativa alternativa após falha do carregamento inicial.

Uma consulta com erro pode resultar em lista vazia na resposta inicial. Para o operador, isso pode parecer falta de pedidos ou de produtos. Quando a chamada inicial falha por completo, outra rodada de consultas pode ampliar a espera.

**Melhoria proposta:** informar o resultado de cada parte: carregando, atualizado, desatualizado ou indisponível. Preservar os últimos dados válidos com indicação visível quando apropriado. Distinguir sessão expirada, falta de permissão e falha temporária antes de repetir solicitações.

Definir limites de espera e cancelamento para as chamadas essenciais. Repetir automaticamente apenas falhas recuperáveis, com intervalo crescente. Uma atualização antiga nunca deve apagar dados mais recentes.

**Como confirmar:** provocar uma falha controlada em compras e verificar que a cozinha segue funcionando; provocar falha nos pedidos e verificar que aparece aviso, sem falso “nenhum pedido”.

### 3.10. Banco e hospedagem precisam ser medidos antes de mudanças

As migrações já declaram índices — estruturas que ajudam o banco a encontrar registros — para itens por venda, datas de vendas e estado de produção, entre outros. Não seria correto afirmar que o projeto simplesmente não tem índices.

**Verificar no ambiente real:**

- Se essas migrações foram aplicadas.
- Quanto tempo cada consulta demora e quantos registros percorre.
- Se um índice combinado para o filtro operacional realmente traz benefício.
- Se aplicação e banco estão em regiões próximas.
- Se a demora ocorre só no primeiro acesso após inatividade ou também nas navegações seguintes.
- Se o sistema utilizado está em modo de desenvolvimento ou em uma versão preparada para produção.
- Se o problema aparece em todos os aparelhos ou principalmente nos terminais mais modestos.

Criar índices sem avaliar as consultas pode aumentar armazenamento e custo de gravação sem resolver a causa. Mudar o plano de hospedagem só deve vir depois de identificar uma limitação concreta.

## 4. Plano de execução por prioridade

| Ordem | Entrega | Benefício esperado | Critério de conclusão |
|---|---|---|---|
| 1 | Medir abertura e atualização nas três áreas | Identificar onde os segundos são gastos | Tempos, chamadas e volumes registrados por cenário |
| 2 | Restringir itens aos pedidos relevantes | Menos transferência e pedidos completos | Histórico grande não aumenta indevidamente a carga operacional |
| 3 | Separar carga essencial por módulo | Cozinha e caixa deixam de esperar dados secundários | Pedidos e venda disponíveis independentemente de relatórios |
| 4 | Impedir ciclos de atualização sobrepostos | Menos concorrência e resultados fora de ordem | Nenhuma sobreposição e nenhuma regressão para resposta antiga |
| 5 | Estados claros de carregamento e erro | Operador entende quando pode agir | Sem falso vazio e sem sucesso antes da confirmação necessária |
| 6 | Resumos de gestão calculados no servidor | Relatórios menores e corretos | Totais conferidos com base completa do período |
| 7 | Reduzir renderizações e adiar funções secundárias | Melhor resposta em aparelhos modestos | Digitação e botões responsivos durante atualização |
| 8 | Ajustar consultas, índices e infraestrutura | Resolver gargalos restantes comprovados | Comparação antes/depois com o mesmo cenário |
| 9 | Avaliar atualização por eventos | Menor espera por pedidos e menor tráfego repetitivo | Reconexão e recuperação de eventos perdidos verificadas |

As etapas 2 a 5 são as primeiras candidatas de implementação após a medição. O esforço exato depende das regras de turno, das permissões e do volume real de dados. Não há fundamento nesta análise para prometer uma porcentagem específica de aceleração.

## 5. Como medir se ficou realmente melhor

Realizar a comparação em uma versão preparada para produção, preferencialmente em homologação com dados representativos e sem informações pessoais reais. Usar também um aparelho semelhante ao utilizado pelos operadores.

Registrar pelo menos estes cenários separadamente:

1. Primeiro acesso após entrar no sistema, sem dados locais reutilizáveis.
2. Troca entre módulos durante a mesma sessão.
3. Reabertura com dados locais já disponíveis.
4. Horário de maior movimento, com vários terminais.
5. Internet lenta e recuperação após interrupção.
6. Muitos pedidos históricos e pedidos antigos ainda pendentes.

Para cada cenário, repetir as medições e anotar o tempo típico e o tempo abaixo do qual ficam 95% das tentativas. Com poucas amostras, tratar esse último valor como indicativo, não como estatística estável. Não misturar primeira abertura e navegação com dados já carregados.

| Medida | O que significa | Meta inicial proposta, sujeita à validação |
|---|---|---|
| Tela essencial utilizável | É possível iniciar a tarefa principal com dados confiáveis | Até 2 segundos em 95% das aberturas na condição normal definida |
| Troca de módulo com dados válidos reaproveitados | A função fica disponível após navegar | Até 1 segundo na condição normal definida |
| Resposta visual de botão ou digitação | O sistema mostra que recebeu a ação | Até 100 milissegundos; não significa pagamento confirmado |
| Pedido confirmado no caixa aparece na cozinha | Tempo entre confirmação no servidor e exibição no KDS | Até 2 segundos; provavelmente exige rever o ciclo atual de 3,5 segundos |
| Falha de atualização | O operador entende que os dados podem estar antigos | Aviso com último horário de atualização, sem apagar a tela válida |

Esses números são objetivos de trabalho, não resultados obtidos ou garantias de disponibilidade. A confirmação de uma venda deve ser medida separadamente da resposta visual do botão.

Para a equipe técnica: registrar o tempo de autorização, de cada consulta e da montagem da resposta no servidor; no navegador, medir download, processamento e momento em que a função fica utilizável. Correlacionar as medições por um identificador de solicitação, sem registrar senhas, tokens ou dados pessoais desnecessários.

## 6. Melhorias de usabilidade que acompanham o desempenho

- Manter pedidos visíveis durante atualizações, sem piscar ou perder a posição de rolagem.
- Preservar carrinho, filtros e texto digitado quando uma solicitação falhar.
- Bloquear somente a ação que depende de confirmação, em vez da tela inteira.
- Mostrar “Enviando pedido…”, “Pedido confirmado” ou “Aguardando conexão”, conforme o estado real.
- Evitar cliques duplicados em confirmar venda e concluir pedido, com proteção também no servidor.
- Informar quando os dados exibidos são antigos e oferecer nova tentativa.
- Reaproveitar dados locais com separação por estabelecimento e acesso, invalidando-os quando necessário.
- Não depender apenas de cor para comunicar erro ou sucesso; combinar texto, ícone e contraste adequado.
- Manter navegação por teclado, foco visível e botões confortáveis para toque.
- Na cozinha, preservar a ordem operacional dos pedidos e evitar alertas sonoros repetidos por simples recarregamento.

## 7. Condições para considerar a melhoria concluída

- [ ] Medições antes e depois feitas com o mesmo aparelho, rede e volume de dados.
- [ ] Caixa e cozinha não dependem da carga de relatórios e históricos.
- [ ] Todos os itens dos pedidos exibidos estão presentes.
- [ ] Pedidos pendentes não desaparecem por limite de quantidade.
- [ ] Uma atualização antiga não substitui uma mais recente.
- [ ] Relatórios representam todo o período escolhido.
- [ ] O sistema continua respeitando as permissões e o encerramento de sessões.
- [ ] Quedas de conexão não apagam carrinho nem duplicam vendas.
- [ ] Os operadores conseguem identificar carregamento, desatualização e erro.
- [ ] As metas acordadas foram medidas e as exceções documentadas.

## 8. Limites desta análise

Foi realizada inspeção do código de carregamento, consultas, sessão, estado compartilhado, caixa, cozinha, painel de gestão e índices declarados nas migrações. Não foram executados testes de carga, medições em navegador, consultas ao banco de produção ou alterações de infraestrutura. Não foi validado o tamanho do código entregue em produção.

As causas estruturais apontadas têm evidência no código. Sua contribuição exata para os mais de 6 segundos permanece a confirmar com as medições propostas.
