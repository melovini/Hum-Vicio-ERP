# Plano para comercializar o sistema por assinatura

**Projeto:** Hum Vício ERP  
**Data da avaliação:** 16/09/2026  
**Objetivo:** transformar o sistema da hamburgueria em um produto comercial para
outros estabelecimentos, com site de vendas, contratação online e operação segura.

## 1. Quanto o projeto está pronto?

**Estimativa de prontidão comercial: aproximadamente 20%.**

O cálculo ponderado deste documento resulta em **19,5%**, arredondado para 20%
na comunicação. É uma estimativa técnica baseada no código e na documentação
disponíveis, não uma certificação, uma medição de horas restantes ou uma previsão
de sucesso comercial. A precisão decimal serve apenas para conferir a conta.

O sistema já tem uma base operacional com caixa, cozinha, estoque, clientes,
colaboradores e gestão. A frente de funcionalidades operacionais recebeu **60%**
nesta avaliação. Isso não significa que o produto comercial inteiro esteja 60%
pronto: atender várias empresas exige isolamento de dados, cobrança, implantação,
suporte e validação que ainda não estão demonstrados.

**O site comercial recebeu 0%:** a página inicial encontrada é uma entrada do ERP
autenticado, não uma página pública de vendas com planos e contratação.

### Limites da avaliação

- Foram revisados a estrutura do projeto, dependências, autenticação, permissões,
  documentação de segurança e indícios de funcionalidades comerciais.
- Não foram encontrados modelos de empresas assinantes, vínculos de usuários por
  empresa, integração de assinaturas ou fluxo de contratação no código revisado.
- Existem testes de segurança, mas sua presença não comprova isolamento entre
  clientes nem robustez comercial. Não executei novos testes nesta avaliação.
- A configuração de produção, recuperação de backups, contratos, custos e uso por
  clientes externos não foram verificados.
- O documento `SECURITY-SETUP.md` ainda descreve a ativação da segurança como
  pendente; confirmar o estado real antes de considerar essa entrega concluída.
- Onde não há evidência suficiente, a pontuação foi mantida baixa. Trabalho feito
  fora deste repositório poderá alterar a avaliação quando for demonstrado.

### Como as porcentagens foram calculadas

Cada frente recebe um **peso**, que representa sua importância no escopo de
lançamento definido aqui. Os pesos somam 100%. O **avanço atual** estima quanto
daquela frente já está atendido. A contribuição é calculada assim:

`Contribuição em pontos percentuais = peso × avanço atual ÷ 100`

| ID | Frente necessária | Peso no projeto | Avanço atual estimado | Contribuição atual | Meta para concluir |
|---|---|---:|---:|---:|---:|
| E01 | Público, proposta e modelo comercial | 5% | 20% | 1,0 p.p. | 100% |
| E02 | Produto operacional confiável | 15% | 60% | 9,0 p.p. | 100% |
| E03 | Isolamento entre estabelecimentos | 18% | 0% | 0,0 p.p. | 100% |
| E04 | Identidade, permissões e segurança SaaS | 12% | 50% | 6,0 p.p. | 100% |
| E05 | Cadastro e implantação de novos clientes | 8% | 10% | 0,8 p.p. | 100% |
| E06 | Planos, cobrança e gestão da assinatura | 12% | 0% | 0,0 p.p. | 100% |
| E07 | Site público de vendas | 8% | 0% | 0,0 p.p. | 100% |
| E08 | Infraestrutura, backups e monitoramento | 7% | 20% | 1,4 p.p. | 100% |
| E09 | Administração da plataforma e suporte | 5% | 10% | 0,5 p.p. | 100% |
| E10 | Contratos, privacidade e operação empresarial | 4% | 0% | 0,0 p.p. | 100% |
| E11 | Testes comerciais e pilotos externos | 4% | 20% | 0,8 p.p. | 100% |
| E12 | Lançamento, aquisição e métricas | 2% | 0% | 0,0 p.p. | 100% |
| **Total** | **Escopo inicial de comercialização** | **100%** | **19,5% ponderados** | **19,5 p.p.** | **100%** |

**Faltam aproximadamente 80% do escopo ponderado**, e não necessariamente 80% do
código ou do tempo de desenvolvimento. Não somar diretamente os avanços das
linhas e não interpretar os pesos como orçamento.

Referência de avaliação: 0% = sem entrega demonstrada; 10–25% = base inicial;
30–50% = implementação parcial; 60–75% = implementação relevante com lacunas;
80–95% = validado amplamente, com pendências; 100% = critérios de aceite concluídos.

**A pontuação não autoriza o lançamento:** isolamento, integridade das vendas,
controle de acesso e recuperação de dados são bloqueadores mesmo que a média suba.

## 2. Qual produto será vendido?

### E01 — Público, proposta e modelo comercial: 20%

**Base existente:** experiência da própria hamburgueria e funcionalidades voltadas
à operação de alimentação. Ainda falta comprovar a adequação a outros negócios.

- [ ] Começar por um segmento definido, por exemplo hamburguerias independentes
  com atendimento no balcão, retirada e entrega.
- [ ] Entrevistar proprietários e operadores de outros estabelecimentos sobre
  dificuldades, equipamentos, internet, sistemas atuais e disposição de contratação.
- [ ] Definir o problema principal resolvido e o diferencial demonstrável.
- [ ] Definir o escopo da primeira versão vendável e o que ficará fora dela.
- [ ] Separar o nome comercial do software da identidade da hamburgueria; verificar
  disponibilidade de marca e domínio antes de contratar serviços.
- [ ] Definir quem compra, quem administra e quem opera o sistema.
- [ ] Definir a unidade de cobrança: por estabelecimento, com limites claros de
  unidades adicionais, usuários, terminais e recursos.
- [ ] Definir implantação assistida, prazo de teste, treinamento e suporte incluídos.
- [ ] Validar a proposta com potenciais clientes antes de estabelecer a tabela definitiva.

**Critério para 100%:** proposta, público, escopo e condições comerciais
documentados e validados com interessados reais.

### Estrutura inicial de oferta — hipótese a validar

Começar com um plano simples pode facilitar implantação e suporte. Os nomes abaixo
são sugestões de organização; não representam planos já existentes.

| Oferta | Escopo possível | Decisão necessária |
|---|---|---|
| Plano principal | Caixa, cozinha, cardápio, estoque e relatórios essenciais | Limites e preço mensal |
| Implantação assistida | Importação de cardápio e treinamento inicial | Incluída ou cobrada separadamente |
| Unidade adicional | Outro estabelecimento da mesma empresa | Cobrança e separação operacional |
| Recursos adicionais futuros | Integrações específicas e emissão fiscal real | Custo, suporte e disponibilidade |

Não anunciar emissão fiscal real, integrações, funcionamento offline garantido ou
disponibilidade contínua antes de implementar e validar essas capacidades.

### Formação de preço e orçamento

- [ ] Levantar custos fixos: infraestrutura, ferramentas, administração e manutenção.
- [ ] Levantar custos variáveis por cliente: banco, armazenamento, mensagens,
  suporte, cobrança e integrações.
- [ ] Incluir impostos e obrigações com orientação contábil, além de inadimplência,
  aquisição de clientes e tempo de implantação.
- [ ] Estimar margem e capacidade de suporte para diferentes quantidades de clientes.
- [ ] Simular cenários com 5, 20 e 100 estabelecimentos; esses números são cenários
  de planejamento, não previsões de vendas.
- [ ] Confirmar tarifas e meios de pagamento diretamente com os fornecedores antes
  da escolha; não há estimativa de preços de fornecedores neste documento.

Indicador de planejamento: `contribuição por cliente = receita líquida da assinatura
− custos variáveis de atender esse cliente`. Estimar o ponto de equilíbrio usando
os custos fixos e essa contribuição, explicitando todas as premissas.

## 3. Preparar o sistema para atender outros estabelecimentos

### E02 — Produto operacional confiável: 60%

**Base existente:** módulos e fluxos operacionais relevantes. A avaliação de 60%
reconhece essa implementação, mas ainda exige validação de integridade e uso externo.

- [ ] Registrar venda, itens, pagamentos e estoque em operações transacionais.
- [ ] Recalcular preços e validar descontos no servidor.
- [ ] Garantir que o reenvio de uma operação não duplique venda ou recebimento.
- [ ] Corrigir concorrência de estoque entre terminais.
- [ ] Revisar cancelamentos e triggers para impedir estornos ou baixas duplicados.
- [ ] Separar estados de produção, pagamento e entrega.
- [ ] Validar fechamento, sangria, suprimento, pagamentos parciais e quitações.
- [ ] Definir política offline e mostrar quando um pedido ainda não chegou à cozinha.
- [ ] Retirar dados e pressupostos fixos da Hum Vício: marca, endereço, cardápio,
  custos, impressoras, mensagens e regras específicas.
- [ ] Configurar moeda, fuso, horários, unidades de medida e dados do estabelecimento.
- [ ] Simplificar caixa e cozinha; testar toque, teclado, contraste e legibilidade.
- [ ] Publicar uma matriz de equipamentos e navegadores testados, incluindo impressão.
- [ ] Permitir exportação dos principais dados do estabelecimento.
- [ ] Manter simulações fiscais claramente separadas de qualquer emissão real futura.

**Critério para 100%:** cenários essenciais e de falha testados, com resultados
consistentes e validação em operação piloto externa.

Detalhamento complementar: [próximas melhorias técnicas](PROXIMAS-MELHORIAS-TECNICAS.md).

### E03 — Isolamento entre estabelecimentos: 0%

**Principal bloqueador comercial:** o código revisado foi estruturado para uma
operação. Não foi encontrado isolamento por empresa assinante nas regras atuais.

- [ ] Escolher e documentar a estratégia: banco compartilhado com isolamento por
  empresa ou ambientes separados por cliente. Um ambiente separado por cliente
  também exige provisionamento, atualização, backup e cobrança próprios.
- [ ] Para o modelo compartilhado, criar empresas, unidades e vínculos de usuários.
- [ ] Acrescentar `tenant_id` às entidades de cada empresa e `location_id` quando
  houver distinção por unidade, incluindo vendas, estoque, clientes, fornecedores,
  colaboradores, sessões, auditoria e configurações.
- [ ] Criar relacionamentos e restrições que impeçam ligar registros de empresas diferentes.
- [ ] Associar a empresa à sessão autenticada e verificar o vínculo em cada operação.
- [ ] Não confiar no identificador de empresa recebido do navegador, domínio ou URL
  sem verificar a autorização do usuário.
- [ ] Isolar também arquivos, relatórios, exportações, tarefas em segundo plano,
  eventos, filas offline e caches.
- [ ] Migrar os dados atuais para a primeira empresa com backup e conferência.
- [ ] Testar dois clientes fictícios com usuários de todos os perfis, inclusive
  tentativas de acesso usando identificadores da outra empresa.

**Atenção à arquitetura atual:** o servidor usa uma chave privilegiada do banco.
Não presumir que políticas RLS isolarão consultas feitas com essa credencial.
Definir uma identidade de banco sujeita às políticas para as operações normais,
ou uma camada restrita de operações que imponha o isolamento; reservar acessos
privilegiados a rotinas controladas. Ver referência de [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

**Critério para 100%:** nenhum cliente consegue consultar, alterar, exportar ou
inferir dados de outro pelos caminhos testados, com verificação automatizada no
servidor e no banco. Nenhum dado operacional fica sem empresa atribuída.

### E04 — Identidade, permissões e segurança SaaS: 50%

**Base existente:** hashes de credenciais, sessões revogáveis, limitação de
tentativas e permissões no servidor. Falta adaptar e validar para várias empresas.

- [ ] Confirmar a ativação descrita em [SECURITY-SETUP.md](SECURITY-SETUP.md).
- [ ] Criar cadastro e recuperação segura de conta do proprietário, com verificação
  de contato e convites para a equipe.
- [ ] Separar administrador da plataforma, proprietário da empresa e operador da loja.
- [ ] Associar permissões aos vínculos por empresa; um usuário pode ter funções
  distintas em empresas diferentes.
- [ ] Revisar o login atual por PIN: ele não deve buscar a mesma credencial entre
  colaboradores de todas as empresas. Definir identificação e contexto da loja.
- [ ] Adotar autenticação adicional para contas privilegiadas e recuperação segura.
- [ ] Definir limites de login por identidade e contexto para que uma empresa não
  bloqueie o acesso das demais por esgotar um limite global.
- [ ] Aplicar permissões por ação: desconto, estorno, sangria, exportação e gestão de acesso.
- [ ] Restringir origens permitidas aos domínios controlados; revisar o curinga
  `*.vercel.app` presente na configuração atual antes do lançamento.
- [ ] Revisar segredos de integrações, tratamento de arquivos e endereços de webhooks
  para evitar exposição e requisições indevidas feitas pelo servidor.
- [ ] Estabelecer limpeza de caches em equipamentos compartilhados sem perder
  operações offline legítimas.
- [ ] Fazer revisão independente de segurança antes da venda aberta.

**Critério para 100%:** cadastro, convite, recuperação, revogação e autorizações
validados; privilégios de plataforma nunca são concedidos ao dono de uma loja.

### E05 — Cadastro e implantação de clientes: 10%

**Base existente:** telas de cadastro e importação internas que podem ser
reaproveitadas. Não há fluxo demonstrado de criação de uma empresa assinante.

- [ ] Criar cadastro do responsável e confirmação do contato.
- [ ] Criar empresa e unidade inicial com provisionamento que possa ser repetido
  sem duplicação caso haja falha.
- [ ] Implementar um assistente: dados da loja → cardápio → equipe → impressora → teste.
- [ ] Oferecer dados demonstrativos separados dos dados reais.
- [ ] Importar cadastros com prévia, validação, relatório de erros e confirmação.
- [ ] Registrar progresso para permitir continuar a configuração em outro momento.
- [ ] Oferecer primeira venda de teste sem movimentar o caixa real.
- [ ] Permitir que o usuário configure a loja sem conhecer banco de dados ou chaves.
- [ ] Definir retirada dos dados demonstrativos e início formal da operação.

**Critério para 100%:** um novo cliente consegue chegar à primeira venda válida
sem edição manual de SQL ou intervenção direta no banco.

## 4. Implementar assinaturas e site de vendas

### E06 — Planos, cobrança e assinatura: 0%

- [ ] Selecionar um provedor de cobrança recorrente após confirmar disponibilidade,
  tarifas, suporte, métodos de pagamento e necessidades do negócio.
- [ ] Criar planos e preços versionados; preservar condições contratadas quando a
  tabela pública mudar.
- [ ] Definir mensalidade, anualidade se oferecida, teste gratuito, limites e adicionais.
- [ ] Modelar assinatura, cliente de cobrança, pagamentos e eventos recebidos.
- [ ] Criar checkout no servidor com plano validado; não aceitar preço informado pelo navegador.
- [ ] Preferir coleta de pagamento pelo provedor, sem armazenar dados brutos de cartão no ERP.
- [ ] Associar a assinatura à empresa autenticada, impedindo associação a outra empresa.
- [ ] Validar autenticidade dos webhooks e armazenar o identificador de cada evento.
- [ ] Tratar eventos repetidos, atrasados ou fora de ordem, com reconciliação periódica.
- [ ] Provisionar acesso por confirmação do servidor, nunca só pelo retorno à página de sucesso.
- [ ] Implementar estados de teste, ativo, pagamento pendente, atraso, cancelamento
  programado, cancelado e suspenso conforme o provedor escolhido.
- [ ] Definir regras de renovação, alteração de plano, diferença proporcional de
  valores, reembolso e contestação com suporte contábil/jurídico quando necessário.
- [ ] Enviar avisos de renovação, falha e término do teste conforme as condições definidas.
- [ ] Implementar área para atualizar pagamento, consultar cobranças e cancelar.
- [ ] Separar cancelamento da assinatura de exclusão de dados.
- [ ] Definir aviso e carência operacional para inadimplência, sem interromper
  silenciosamente um atendimento em andamento.
- [ ] Manter exportação e acesso aos dados conforme a política contratada e os
  requisitos aplicáveis, inclusive no encerramento da relação.

Exemplo de referência técnica, sem escolha de fornecedor já feita: a Stripe
documenta o tratamento de eventos assíncronos de assinatura e validação de
webhooks. [Documentação de assinaturas e webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

**Critério para 100%:** contratação, primeira cobrança, renovação, falha,
reativação, troca de plano e cancelamento testados; duplicação de eventos não
duplica contas nem libera acesso indevido.

### E07 — Site público de vendas: 0%

#### Páginas necessárias

| Página | Conteúdo e finalidade |
|---|---|
| Início | Público atendido, problema resolvido, benefícios e convite para conhecer |
| Funcionalidades | Caixa, cozinha, estoque e gestão com exemplos reais |
| Planos | Preço, periodicidade, limites, implantação e condições de contratação |
| Demonstração | Vídeo ou ambiente demonstrativo sem dados pessoais reais |
| Cadastro e contratação | Conta, plano, aceite e acesso ao checkout |
| Confirmação ou pendência | Situação real do pagamento e próximos passos |
| Entrar | Acesso ao sistema dos clientes |
| Ajuda e contato | Suporte, horários e perguntas frequentes |
| Termos e privacidade | Documentos revisados e canal para solicitações |
| Disponibilidade | Informações sobre incidentes e manutenção quando operacionalmente mantidas |

#### Passos para construção e publicação

- [ ] Definir nome, identidade visual e domínio do produto.
- [ ] Separar a área pública da área autenticada, por exemplo `www.seudominio.com.br`
  e `app.seudominio.com.br`; esses endereços são ilustrativos.
- [ ] Definir a estrutura de rotas e implantação, reaproveitando o Next.js existente
  quando adequado, sem acoplar indisponibilidade do checkout ao caixa dos clientes.
- [ ] Redigir textos com benefícios verificáveis, público, limitações e condições claras.
- [ ] Produzir imagens e demonstrações com dados fictícios e marca do produto.
- [ ] Criar layout responsivo e acessível para celular e computador.
- [ ] Implementar planos a partir de uma fonte consistente com os preços do checkout.
- [ ] Criar formulário de contato com proteção contra abuso e política de tratamento de dados.
- [ ] Integrar cadastro, escolha de plano, checkout e implantação inicial.
- [ ] Configurar título, descrição, compartilhamento, sitemap e indexação das páginas públicas.
- [ ] Manter páginas privadas fora da indexação e protegidas por autenticação;
  bloqueio em mecanismos de busca não substitui controle de acesso.
- [ ] Configurar domínio, HTTPS e e-mail do produto com autenticação de envio.
- [ ] Medir visitas e conversões de forma compatível com a política de privacidade.
- [ ] Testar links, formulários, preços, estados de falha, acessibilidade e desempenho.
- [ ] Publicar primeiro para revisão e depois liberar a contratação quando os
  bloqueadores de produto e operação estiverem resolvidos.

**Critério para 100%:** um visitante entende a oferta, escolhe um plano, contrata
e chega à implantação inicial; pagamentos pendentes nunca aparecem como aprovados.

#### Jornada comercial completa

`Visita → demonstração → plano → cadastro → checkout → confirmação no servidor
→ empresa provisionada → configuração da loja → primeira venda → renovação`

O cadastro pode anteceder o pagamento ou usar um período de teste. Definir uma
única regra inicial e documentar quando a conta ganha acesso e quando expira.

## 5. Preparar a operação da empresa de software

### E08 — Infraestrutura, backups e monitoramento: 20%

**Base existente:** projeto compilável, Next.js, Supabase e configuração de
hospedagem no código. Escala, restauração e disponibilidade não foram verificadas.

- [ ] Separar desenvolvimento, homologação e produção, inclusive banco e segredos.
- [ ] Definir capacidade e limites de uso por cliente para evitar que uma loja
  sobrecarregue todas as demais.
- [ ] Automatizar verificações e publicação com possibilidade de recuperação.
- [ ] Executar migrações compatíveis com a versão em uso e ensaiá-las em cópia de teste.
- [ ] Monitorar erros, tempo de resposta, disponibilidade, filas e entrega de webhooks.
- [ ] Medir o custo das consultas periódicas atuais conforme aumenta o número de terminais.
- [ ] Definir metas de recuperação e perda máxima de dados aceitável.
- [ ] Testar restauração, inclusive de um único cliente se o banco for compartilhado.
- [ ] Proteger arquivos exportados e backups com controles de acesso e retenção.
- [ ] Definir alertas de gastos, capacidade e falhas acionáveis.
- [ ] Documentar incidentes, responsáveis e comunicação com os estabelecimentos.

**Critério para 100%:** teste de carga compatível com a primeira carteira de
clientes e restauração comprovada dentro das metas acordadas.

### E09 — Administração da plataforma e suporte: 10%

**Base existente:** documentação técnica e alguns módulos administrativos da loja.
Administrar uma loja não equivale a administrar a plataforma comercial.

- [ ] Criar painel separado para empresas, planos, assinaturas e saúde operacional.
- [ ] Definir acesso de suporte limitado, temporário, justificado e auditado.
- [ ] Evitar acesso automático a vendas e dados pessoais de todos os clientes.
- [ ] Exibir falhas de implantação e cobrança com ações de recuperação.
- [ ] Criar central de ajuda e treinamento por perfil.
- [ ] Definir canais, horários e prazos de atendimento realistas.
- [ ] Registrar solicitações, falhas recorrentes e melhorias pedidas pelos clientes.
- [ ] Preparar saída do cliente: cancelamento, exportação, retenção e eliminação controlada.

**Critério para 100%:** uma pessoa responsável consegue implantar e atender clientes
usando processos documentados, sem correções improvisadas diretamente no banco.

### E10 — Contratos, privacidade e operação empresarial: 0%

**Não houve documentação comercial ou jurídica verificada nesta análise.**

- [ ] Definir a empresa responsável por vender, receber e prestar o serviço.
- [ ] Validar com contador o enquadramento, tributação e emissão de documentos
  relativos à venda da assinatura de software.
- [ ] Distinguir essa emissão da emissão fiscal das vendas de alimentos dos clientes.
- [ ] Preparar termos de uso e contrato: escopo, preço, suporte, cancelamento,
  limitações, responsabilidade, dados e comunicação de alterações.
- [ ] Preparar aviso de privacidade coerente com o que o produto realmente faz.
- [ ] Mapear dados pessoais, finalidades, agentes envolvidos, fornecedores e acessos.
- [ ] Definir retenção, exportação, eliminação e atendimento a solicitações de titulares.
- [ ] Definir contratualmente os papéis da plataforma e do estabelecimento no
  tratamento de dados, conforme a atividade concreta.
- [ ] Revisar transferências de dados, localização dos fornecedores e subcontratações.
- [ ] Definir gestão de incidentes e validar as obrigações aplicáveis.
- [ ] Registrar versões e aceites dos documentos comerciais.
- [ ] Revisar direitos sobre marca, imagens, fontes e licenças das dependências utilizadas.

O roteiro não declara conformidade com a LGPD nem fixa obrigações jurídicas
universais. Usar revisão profissional e a orientação oficial da ANPD como base
para as medidas de segurança e governança. [Guia de segurança da informação da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf).

**Critério para 100%:** documentos revisados, processos operacionais implementados
e responsabilidades definidas, com emissão da assinatura validada pelo responsável contábil.

## 6. Validar antes de abrir as vendas

### E11 — Testes comerciais e pilotos externos: 20%

**Base existente:** testes de segurança e verificações de compilação. Não foram
demonstrados testes completos de contratação, isolamento ou pilotos externos.

- [ ] Testar duas empresas simultaneamente, incluindo tentativas de acesso cruzado.
- [ ] Testar registro, convite, recuperação de conta e troca de empresa.
- [ ] Testar limites de plano no servidor, não apenas na interface.
- [ ] Testar cobrança aprovada, recusada, repetida, atrasada e cancelada.
- [ ] Testar cancelamento e reativação sem perda indevida dos dados.
- [ ] Testar venda simultânea, queda de rede, retorno da conexão e impressão.
- [ ] Testar importação, exportação e restauração de dados.
- [ ] Testar atualização do sistema durante a operação de clientes.
- [ ] Corrigir o teste de bloqueio público para distinguir acesso negado de erro
  de conexão ou tabela vazia; nenhuma dessas situações isoladas comprova isolamento.
- [ ] Executar testes que gravam dados somente em ambientes e contas de teste controlados.
- [ ] Realizar um piloto acompanhado com 2 a 5 estabelecimentos, como proposta inicial.
- [ ] Definir previamente critérios de sucesso e condições do piloto, inclusive eventual cobrança.
- [ ] Registrar problemas, tempo de implantação, necessidade de suporte e intenção de continuidade.

**Critério para 100%:** pilotos concluídos, falhas críticas resolvidas e evidências
de uso, cobrança e recuperação compatíveis com a oferta prometida.

### E12 — Lançamento, aquisição e métricas: 0%

- [ ] Criar demonstração comercial e material de apresentação.
- [ ] Definir canais iniciais de aquisição e acompanhar seu custo.
- [ ] Obter autorização para divulgar depoimentos e casos de uso.
- [ ] Planejar a quantidade de novos clientes conforme a capacidade de implantação e suporte.
- [ ] Instrumentar a jornada do site até a primeira venda do estabelecimento.
- [ ] Medir conversão, ativação, receita recorrente, cancelamentos e custo de atendimento.
- [ ] Fazer revisões regulares de preços, produto, suporte e capacidade.
- [ ] Ampliar a divulgação somente após estabilidade dos primeiros clientes.

**Critério para 100%:** lançamento inicial realizado com métricas confiáveis,
responsáveis definidos e capacidade de atender os clientes adquiridos.

## 7. Modelo técnico de referência

Esta é uma proposta para orientar a implementação, não uma descrição do banco atual.

| Entidade | Responsabilidade |
|---|---|
| `tenants` | Empresa contratante e situação operacional |
| `locations` | Unidades de uma empresa |
| `users` | Identidade global de acesso |
| `memberships` | Vínculo, papel e situação de um usuário em cada empresa |
| `plans` / `plan_prices` | Recursos, limites e versões de preços |
| `subscriptions` | Contrato de assinatura vinculado à empresa e ao provedor |
| `billing_events` | Recebimento e processamento idempotente dos eventos de cobrança |
| `entitlements` | Recursos e limites efetivamente disponíveis à empresa |
| `onboarding_progress` | Etapas de implantação e pendências |
| `platform_audit_logs` | Ações administrativas da plataforma |
| Tabelas operacionais existentes | Dados da loja com isolamento por empresa e unidade |

No modelo compartilhado, relacionamentos, índices, consultas e filas devem
considerar a empresa. Recursos de plano e permissões do usuário são verificações
diferentes: pagar por um recurso não concede autorização administrativa.

## 8. Ordem prática de execução e dependências

| Fase | Etapas | Entrega para revisão | Condição para avançar |
|---|---|---|---|
| A | E01 e confirmação da E04 | Público, oferta inicial e estado real da segurança | Escopo comercial definido |
| B | E03 e E04 | Empresas isoladas e identidade por empresa | Testes de acesso cruzado aprovados |
| C | E02 e E08 | Operação consistente e recuperação | Vendas, concorrência e restauração aprovadas |
| D | E05 e E06 | Cadastro, implantação e assinaturas | Jornada de contratação validada em teste |
| E | E07, E09 e E10 | Site, suporte e documentos | Oferta corresponde às capacidades disponíveis |
| F | E11 | Piloto externo acompanhado | Problemas críticos resolvidos |
| G | E12 | Venda pública gradual | Capacidade de suporte e métricas acompanhadas |

Textos, identidade e protótipo do site podem avançar em paralelo. A venda aberta
depende das etapas de produto, isolamento, cobrança e operação. Uma página de
interesse ou demonstração pode ser publicada antes, sem prometer disponibilidade imediata.

Não foi estimado prazo neste documento: equipe, orçamento, escopo fiscal e
estratégia de isolamento precisam ser definidos antes de uma previsão confiável.

## 9. Bloqueadores para liberar a contratação pública

- [ ] Isolamento entre empresas aprovado em todos os caminhos críticos.
- [ ] Acesso, recuperação e permissões validados no ambiente de destino.
- [ ] Vendas e recebimentos sem duplicação ou registros parciais nos testes.
- [ ] Cobrança e cancelamento reconciliados com o provedor.
- [ ] Cliente consegue configurar e usar a loja com o suporte prometido.
- [ ] Backup restaurado com sucesso e plano de incidentes disponível.
- [ ] Termos, privacidade, preços e suporte coerentes com a operação.
- [ ] Pilotos externos concluídos sem falhas críticas abertas.
- [ ] Funcionalidades fiscais e integrações anunciadas realmente implementadas.

Se qualquer bloqueador continuar aberto, tratar o produto como desenvolvimento
ou piloto controlado, mesmo que outras frentes tenham porcentagens elevadas.

## 10. Como atualizar as porcentagens

1. Manter os pesos enquanto o escopo deste lançamento não mudar.
2. Atualizar o avanço de cada etapa com evidências de implementação e validação.
3. Registrar o que mudou, quais testes passaram e quais limitações continuam abertas.
4. Recalcular a soma de `peso × avanço ÷ 100`.
5. Não aumentar a porcentagem apenas por criar tarefas ou documentos de planejamento.
6. Se o escopo mudar, publicar uma nova versão da avaliação e explicar a mudança de pesos.

Exemplo: concluir E03, hoje em 0%, acrescenta 18 pontos percentuais. Mantendo
todas as demais notas, o total passaria de 19,5% para 37,5%. Isso ainda não
representaria autorização para vender, pois os outros bloqueadores permaneceriam.

**Primeira implementação recomendada:** isolamento por estabelecimento e identidade
por empresa, em conjunto com a validação da segurança atual. Essa base deve existir
antes de conectar a contratação pública ao ERP.

## Referências e documentos de apoio

- [Próximas melhorias técnicas do projeto](PROXIMAS-MELHORIAS-TECNICAS.md).
- [Ativação da segurança existente](SECURITY-SETUP.md).
- [RLS e controle de acesso no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Proteção da API do Supabase](https://supabase.com/docs/guides/api/securing-your-api).
- [Eventos de assinatura e webhooks da Stripe](https://docs.stripe.com/billing/subscriptions/webhooks).
- [Portal de gestão da assinatura da Stripe](https://docs.stripe.com/customer-management).
- [Guia de segurança da informação da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf).

Referências consultadas para orientar o plano. A menção a fornecedores não
representa contratação ou escolha definitiva; confirmar condições no momento da implementação.
