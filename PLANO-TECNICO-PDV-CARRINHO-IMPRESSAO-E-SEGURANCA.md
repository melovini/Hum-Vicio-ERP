# Plano técnico de melhorias — PDV, carrinho, impressão e segurança

Data: 26/09/2026. Status: especificação para implementação; os requisitos abaixo não foram implementados nesta entrega documental.

## 1. Objetivo e diagnóstico

Reduzir etapas da venda, permitir corrigir o item antes da finalização e entregar uma comanda completa e legível. Preservar validação de preços no servidor, justificativas de descontos/brindes, persistência dos pedidos e contagem por composição cadastrada.

Constatações do código revisado:

| Local | Comportamento atual | Ajuste necessário |
|---|---|---|
| `src/app/(modules)/caixa/page.tsx`, `handleProductClick` | Lanches abrem personalização; outros produtos entram diretamente. Agrupamento usa comparação parcial. | Inclusão direta e identidade completa da configuração do item. |
| `src/components/caixa/PosCartZone.tsx` | Permite quantidade, observação, brinde e exclusão; ações e chave visual usam índice. | Editar toda a configuração por identificador estável. |
| `src/components/caixa/PosBurgerCustomizerModal.tsx` | Recebe produto, reinicia escolhas ao abrir e deduz necessidade de ponto pelo nome. | Receber item existente e usar regras cadastradas. |
| `src/components/ReceiptModal.tsx` | Abre prévia, chama impressão nativa e libera botão após 2,5 segundos; RAW copia texto. | Separar prévia, geração e envio; acompanhar trabalho de impressão. |
| `src/lib/thermal-printer.ts` | Usa `window.print()`, largura fixa de 72 mm, `@page size: auto`, espera de 100 ms e bloqueio de 2 segundos. | Perfil físico, ciclo de impressão explícito e testes com bobina. |
| `src/lib/central-config.ts` | Centraliza algumas configurações; visibilidade da montagem ainda usa chave local no modal. | Configuração versionada de comanda e vínculo de impressora por terminal. |

O comentário do motor sobre garantir uma página não constitui garantia real. A causa do corte incompleto ainda precisa ser reproduzida: pode envolver paginação, largura útil, driver, avanço final ou equipamento. Não atribuir a falha exclusivamente ao CSS sem testar.

## 2. Inclusão direta do produto — prioridade P1

### Comportamento esperado

- Um clique no produto adiciona uma unidade da opção selecionada no topo: simples ou combo. Não abrir modal para uma venda padrão válida.
- Manter indicação visível da opção ativa. A mudança da opção superior afeta somente novas inclusões.
- Se o combo exigir uma escolha sem padrão cadastrado, solicitar apenas essa escolha. Não inventar bebida, porção, ponto ou preço.
- Exibir retorno discreto no próprio carrinho, sem confirmação bloqueante.
- Personalizações ficam disponíveis pela ação **Editar** do item.

### Implementação

Criar uma função pura compartilhada para construir a linha do carrinho a partir de produto, canal e opção selecionada. Usar IDs reais do catálogo, `comboId`, quantidades, adicionais e valores vigentes. Manter a conferência autoritativa em `src/lib/checkout-pricing.ts`; não aceitar preço fornecido pelo navegador como prova do valor correto.

Substituir regras por nome por propriedades explícitas e opcionais de venda, por exemplo `requiresMeatPoint` e `defaultMeatPoint`. Definir migração e valores iniciais revisáveis; não marcar todo lanche como bovino. Separar essas propriedades de classificação de estação de produção.

Usar atualizações funcionais de estado (`setCart(previous => ...)`) para não perder inclusões rápidas. Cada clique deliberado acrescenta uma unidade; evitar debounce que descarte vendas legítimas. Não fazer chamadas de rede por clique quando o catálogo já está carregado.

Agrupar somente linhas com a mesma assinatura normalizada: produto, canal/preço aplicável, combo, adicionais com quantidades, retiradas, ponto, observações e condição/motivo de brinde. Ordenar listas antes da comparação. Um item comum nunca deve aumentar a quantidade de um brinde ou de um item personalizado.

### Aceite

Produto simples entra com um clique; opção combo preserva seu ID e composição; três cliques acrescentam três unidades; itens com preparos distintos permanecem separados; produto indisponível não entra; a finalização continua validando preços no servidor.

## 3. Edição completa no carrinho — prioridade P1

Adicionar botão textual **Editar**, acessível por teclado e toque, em cada linha. Reutilizar o personalizador com contrato explícito, por exemplo `mode: create | edit`, `initialItem`, `onSave` e `onCancel`.

Implementar:

1. Identificador estável da linha, preferencialmente UUID, preservado em rascunhos. Usar esse identificador como chave React e alvo das ações; não localizar a edição apenas pelo índice.
2. Estado temporário do formulário, preenchido com combo, adicionais, retiradas, ponto, observação e quantidade existentes. Não alterar o carrinho enquanto o operador edita.
3. Salvar substitui somente a linha editada e recalcula preços/subtotal. Cancelar ou fechar mantém a linha anterior integralmente.
4. Ao editar linha de quantidade maior que um, informar **Alterar todas as unidades** e oferecer **Personalizar uma unidade**. A segunda opção desmembra uma unidade, preservando as demais.
5. Preservar brinde e justificativa; recalcular `originalPrice` quando sua composição mudar. Não converter brinde em venda nem remover sua justificativa silenciosamente.
6. Revalidar desconto após redução do subtotal. Mostrar ajuste necessário em vez de enviar desconto maior que a venda.
7. Invalidar dados derivados de produção da linha modificada. No checkout, reconstruir o snapshot com a receita e configuração válidas; não reutilizar contagem anterior.
8. Persistir a edição no rascunho e restaurá-la após recarregar a página. Migrar rascunhos antigos sem ID estável.

**Limite importante:** editar um carrinho ainda não finalizado é uma operação local. Editar pedido já salvo exige transação no servidor, controle de versão, reconciliação de estoque/financeiro e comanda diferencial. Não reaproveitar a substituição local como atualização direta do banco.

Aceite: editar um de dois lanches iguais com observações diferentes não altera o outro; cancelar não modifica total; trocar combo atualiza preço e produção; edição de uma unidade desmembra corretamente; recarregar preserva o rascunho.

## 4. Comanda incompleta ou cortada — prioridade P0

### Diagnóstico obrigatório antes da correção

Registrar modelo da impressora, conexão, largura da bobina e largura útil, driver, tamanho de papel configurado, escala, margens e ponto exato do corte. Comparar a mesma comanda na prévia, saída do navegador e papel físico. Verificar se falta conteúdo lateral, rodapé, última linha ou se houve corte físico entre páginas.

Reproduzir com comandas curta, média e longa, nomes extensos, várias observações, combos e resumo final. Preservar evidência do resultado sem dados pessoais reais.

### Ajustes no caminho HTML/navegador

- Remover a premissa de uma única página garantida. Bobina contínua depende também do driver; conteúdo longo não pode ser reduzido até ficar ilegível.
- Parametrizar largura útil e margens pelo perfil da impressora. Os atuais 72 mm não servem automaticamente para todos os modelos ou bobinas.
- Aplicar `box-sizing: border-box` ao contêiner, eliminando a soma inesperada de largura com padding. Auditar larguras fixas, altura máxima e overflow em todos os elementos impressos.
- Permitir quebra de palavras e de blocos maiores que uma página; usar `break-inside: avoid` apenas onde couber. Manter nome e primeiros detalhes juntos quando possível.
- Aguardar montagem do documento e disponibilidade das fontes/imagens necessárias; substituir espera fixa de 100 ms por prontidão verificável.
- Isolar o documento de impressão do modal e da tela operacional. Não depender da prévia estar aberta para gerar o conteúdo.
- Encerrar o ciclo pelo evento apropriado e limpeza segura. `afterprint` indica encerramento do diálogo, não confirmação física da impressão. Timeouts servem para recuperação, não para declarar sucesso.

### Caminho de envio direto

Se houver transporte de bytes para a impressora, gerar alimentação de papel e comando de corte de acordo com o perfil/modelo homologado. Enviar corte somente depois do conteúdo completo e avanço final. Não concatenar códigos de corte universais sem verificar suporte. O botão RAW atual copia texto e não comprova envio de comandos ESC/POS ao equipamento.

Aceite físico: nenhum item, observação ou resumo omitido; rodapé completo antes do corte; largura correta; acentos legíveis; pedidos longos legíveis; falha de impressão não cancela nem duplica a venda. Aprovação final exige teste na impressora utilizada pela operação.

## 5. Impressão rápida por um botão — prioridade P1

Após salvar, apresentar **Imprimir cozinha** e ação secundária **Visualizar**. A primeira envia o documento sem exigir abertura e confirmação de uma prévia. Configuração opcional **Imprimir ao finalizar** deve usar o mesmo serviço de impressão e não gerar segunda via involuntária.

Separar duas entregas:

1. **Navegador:** remover confirmações internas redundantes, mantendo o diálogo nativo quando exigido pelo ambiente. A implementação atual não fornece impressão silenciosa; uma página comum não deve prometer suprimi-lo por JavaScript.
2. **Terminal configurado:** usar integração local de impressão ou ambiente gerenciado compatível para envio sem diálogo a uma impressora previamente escolhida. Selecionar a tecnologia após inventariar sistema operacional, conexão e modelo. Homologar instalação, atualização e recuperação de falhas.

Criar uma interface de transporte independente da comanda: `enqueuePrintJob`, `getPrintJobStatus` e `requestReprint`. O adaptador do navegador e o adaptador local consomem o mesmo modelo de documento.

O trabalho deve conter ID, pedido, revisão do pedido, tipo de via, destino, versão do layout, hash/conteúdo renderizado, número da cópia, operador, datas e estado. Estados mínimos: pendente, enviando, aceito pelo transporte, falhou e resultado desconhecido. Somente usar “impresso” se o equipamento realmente disponibilizar confirmação confiável.

Deduplicar a emissão inicial por pedido + revisão + via + destino. Reimpressão é uma intenção explícita, auditada, com novo trabalho e marca **REIMPRESSÃO**. Não repetir automaticamente trabalho de resultado desconhecido: ele pode já ter saído no papel. A trava atual por dois segundos não atende esse requisito.

Se o pedido estiver somente salvo localmente, aplicar política visível: impressão operacional pode ser permitida após persistência durável, marcada **Aguardando sincronização**. A confirmação posterior do servidor não pode imprimir novamente. Venda e impressão têm estados separados.

Integração local deve autenticar solicitações, restringir origens/destinos e aceitar apenas operações de impressão validadas. Não expor execução de comandos, credenciais do Supabase ou acesso arbitrário a arquivos/impressoras. Falha na integração oferece reenvio explícito ou impressão pelo navegador.

Aceite: um clique interno despacha a via; clique repetido não duplica; prévia é opcional; queda do transporte mantém o pedido salvo; reconexão não reimprime trabalho incerto; segunda via fica identificada.

## 6. Configurações de comanda — prioridade P1

Criar **Configurações → Impressão e cozinha**, acessível ao gestor. Operador utiliza configurações publicadas e pode imprimir/testar conforme sua permissão, sem alterar padrões globais.

Separar três entidades lógicas:

| Entidade proposta | Responsabilidade |
|---|---|
| `receipt_template` | Conteúdo e apresentação por via, versão, autor e publicação. |
| `printer_profile` | Papel, largura útil, margens, avanço, corte e capacidades do equipamento. |
| `terminal_print_binding` | Vínculo do terminal com impressora/perfil e destinos de produção. |

Esses nomes são propostas, não tabelas existentes. Avaliar extensão de `central-config` para o layout e persistência própria para trabalhos/vínculos. Definir contrato validado, migração e permissões no servidor antes de criar SQL. Não misturar preferência física de um terminal com padrão de todas as lojas.

Configurações oferecidas ao gestor:

- Cliente, número do pedido, horário e modalidade/mesa.
- Tamanho de fonte dentro de faixa legível, espaçamento e destaque de observações/retiradas.
- Visibilidade dos detalhes de montagem, combo, acompanhamentos e resumo por estação.
- Ordem dos blocos e das estações; nomes exibidos vindos do cadastro.
- Quantidade de vias e destino; impressão automática opcional.
- Perfis separados para cozinha e cliente, evitando dados financeiros na via da cozinha.

Oferecer prévia com pedido de exemplo, **Imprimir teste**, **Salvar rascunho**, **Publicar** e **Restaurar padrão**. Não disponibilizar HTML, JavaScript, CSS ou comandos RAW livres. Usar opções estruturadas, escape de textos e limites de tamanho. Não permitir ocultar identificação, quantidade, retiradas e observações críticas da via de produção.

Versionar configuração com controle de concorrência: salvar exige versão lida, conflito pede revisão. Cache local é fallback validado, não fonte silenciosamente divergente. Registrar alterações e manter versão anterior para restauração. Trabalhos já gerados preservam sua versão e conteúdo; mudar o layout não modifica o que estava na fila.

Migrar `hum_vicio_print_show_montagem` de forma explícita para o novo modelo, evitando que cada terminal sobrescreva o padrão global. Remover identidade comercial/CNPJ fixos do recibo e obter os dados do estabelecimento configurado.

## 7. Produção coerente entre KDS e comanda

Reutilizar o modelo de `src/lib/kitchen-ticket.ts`, `KitchenTicketView.tsx` e os calculadores existentes; não criar uma segunda contagem dentro do editor de layout ou no adaptador de impressora.

Vínculo de estação permanece opcional em ingrediente/sub-receita. Ausência de vínculo não impede salvar receita e não cria linha “estação não definida”. Produtos sem estação continuam visíveis como itens do pedido. Resumo lista somente componentes explicitamente configurados.

Contar pela composição e unidade de produção, nunca por palavras como “duplo”, “costela” ou “batata”. Diferenciar bovino 180 g, bovino recheado de costela e linguiça por identificadores de componente; evitar somar recheio como outro hambúrguer. Separar consumo de estoque em gramas da contagem de unidades/porções produzidas. Quantidades fracionárias válidas dependem da unidade; não arredondar tudo indiscriminadamente.

Combos e adicionais devem expandir exatamente uma vez. Retiradas devem refletir regras explícitas da receita. Pedido salvo usa snapshot de produção para não mudar retroativamente quando o cadastro for editado. Definir tratamento identificado para pedidos antigos sem snapshot, sem regravar histórico automaticamente.

Aceite: Argentina simples/duplo, bovino comum, frango adicional, batata, anéis e combo produzem totais previstos por uma ficha de teste revisada pelo gestor; KDS, prévia e papel mostram os mesmos totais e distinções.

## 8. Pendências de segurança e confiabilidade da entrega anterior

Consultar também `IMPLEMENTACAO-SEGURANCA-USABILIDADE-20260925.md`. As seguintes tarefas continuam abertas:

| Prioridade | Implementação | Evidência de conclusão |
|---|---|---|
| P0 | Migrar edição de pedido salvo para endpoint e função transacional: autenticação, preços, justificativas, controle otimista de versão, bloqueio concorrente, estoque por diferença e reconciliação financeira. Depois bloquear escrita equivalente na API genérica. | Falha intermediária reverte tudo; duas edições concorrentes não se sobrepõem; pagamento já realizado não é apagado. |
| P0 | Auditoria gerada no servidor na mesma transação: operador da sessão, antes/depois, motivo, pedido e correlação. Restringir edição/exclusão dos registros. | Cliente não consegue falsificar operador nem omitir evento financeiro. |
| P0 | Migrar outbox de vendas para IndexedDB, com transações, versão de formato e coordenação entre abas. Importar localStorage, conferir integridade e só então aposentar o legado. | Quota, interrupção, duas abas e reenvio não perdem nem duplicam pedidos. |
| P1 | Revisão assistida de pedidos rejeitados: exibir causa, permitir ajuste autorizado de preço/justificativa e preservar histórico/identidade. Reconciliar antes de mudar payload de envio incerto. | Correção não cria uma segunda venda; pedido confirmado não é silenciosamente substituído. |
| P1 | Integrar `npm run check:schema` ao processo de publicação com credenciais protegidas; ampliar para versão/contrato das funções, não só existência. | Ambiente incompatível impede promoção da versão. |
| P1 | Banco isolado de testes para venda, edição, cancelamento, estoque, desconto, brinde, fila e impressão. | Testes verificam persistência real e rollback, além de mocks. |
| P1 | Medir carregamento por módulo; consultar pedidos ativos independentemente do limite de histórico, paginar encerrados e buscar apenas campos necessários. | Pedido antigo ainda ativo permanece no KDS; registrar p50/p95 antes/depois com volume representativo. |
| P1 | Validar restauração de backup em ambiente isolado, com metas definidas de perda tolerável e tempo de recuperação. | Ensaio documentado comprova recuperação de pedidos, receitas e configurações. |
| P2 antes de SaaS | Isolamento por estabelecimento, autorização no servidor e banco, chaves/índices adequados e configurações/destinos segregados. | Testes cruzados impedem acesso entre empresas, inclusive em fila e impressão. |

## 9. Sequência de execução e testes

1. Reproduzir corte com equipamento real e criar dados de referência de produção.
2. Implementar identidade de linha, inclusão direta e edição local; testar atalhos, toque, rascunhos e preços.
3. Separar geração de comanda e transporte; corrigir largura/paginação e ciclo de impressão.
4. Criar configurações versionadas e impressão de teste; implementar um botão e fila de trabalhos.
5. Homologar envio sem diálogo nos terminais compatíveis, mantendo alternativa pelo navegador.
6. Concluir transações financeiras, auditoria, outbox e validações de publicação. Estas proteções podem ser desenvolvidas em paralelo às melhorias de interface.
7. Liberar progressivamente em um terminal e acompanhar falhas, duplicidades e tempo de atendimento antes de expandir.

Testes unitários: construção/agrupamento de linhas, preços, desmembramento, edição/cancelamento, expansão de combos, contagem por estação, validação do layout e deduplicação de impressão.

Testes de navegador: vender simples com um clique, vender combo, editar item, cancelar edição, restaurar rascunho, justificar desconto/brinde, imprimir sem prévia obrigatória e lidar com transporte indisponível. Incluir navegação por teclado, foco de retorno, rótulos claros e áreas de toque adequadas.

Testes físicos: bobinas/perfis realmente suportados, texto longo, 1/10/30 itens, acentos, rodapé, avanço/corte, desconexão e reimpressão. PDF/prévia não substitui validação no papel.

Registrar tempos antes/depois. Meta inicial de interface: inclusão local visível em até 150 ms no terminal de referência; impressão mede separadamente tempo de despacho e tempo físico, sem confundir aceite do transporte com papel impresso. Ajustar metas de carregamento e impressão após medir hardware e rede.

## 10. Orientação ao implementador

Ler `AGENTS.md` e a documentação local da versão instalada do Next.js antes de alterar rotas/componentes. Preservar o trabalho existente. Entregar alterações por etapas revisáveis, com testes e migrações explícitas quando necessárias. Não executar testes de escrita no banco de produção. Não substituir receitas ou limpar filas para contornar falhas. Documentar configurações do equipamento homologado, procedimento de instalação, recuperação e limitações remanescentes.
