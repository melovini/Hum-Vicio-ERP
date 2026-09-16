# Hum Vício ERP — padrões de interface

## Adoção incremental

Primitives: src/components/ui. Preferir imports diretos para deixar explícitas as fronteiras cliente/servidor. A biblioteca não significa que as telas já foram migradas. SlidingSheet mantém sua API e atende seus consumidores existentes.

## Estados e feedback

| Estado | Padrão |
| --- | --- |
| Carregando | Skeleton com texto acessível no contêiner |
| Sem registros | EmptyState com próximo passo |
| Erro de campo | FormField com mensagem associada |
| Falha recuperável | Feedback danger próximo à tarefa, com Tentar novamente |
| Offline / dados antigos | Feedback persistente explicando a limitação |
| Sucesso confirmado | Toast somente após confirmação do servidor |
| Ação sensível | ConfirmDialog com verbo específico e consequências |

ToastProvider está instalado no layout. Em componente cliente, importar useToast de @/components/ui/Toast e chamar notify({ title: 'Ingrediente salvo', tone: 'success' }) após a confirmação.

Até três notificações aparecem; as seguintes aguardam. Erros permanecem até dispensados. Demais mensagens duram pelo menos seis segundos, reiniciados após hover/foco. duration: 0 mantém qualquer mensagem. dismiss(id) remove uma mensagem. Não expor erros SQL, credenciais ou dados pessoais. Não usar toast como único feedback dentro de modal nativo, pois o restante da página fica inerte.

## Formulários

- Uma ação primária por contexto; botões destrutivos com verbo específico.
- Button usa type button por padrão. Informar type submit em formulários.
- Associar labels a Input, Select e Textarea; erros precisam de instruções de recuperação.
- required visual não substitui validação nativa nem validação no servidor.
- Bloquear envio duplicado e preservar valores quando ocorrer falha.
- Checkbox seleciona opções; Switch liga/desliga configurações.
- Estados precisam de texto, não apenas cor.

## Painel lateral

SlidingSheet usa dialog.showModal: contenção de foco e fundo inerte nativos, Esc controlado, retorno do foco e bloqueio de rolagem. Primeiro controle: Fechar. Conteúdo selecionável, região rolável e rodapé separados.

Não sobrepor Dialog customizado/portais à gaveta nativa: ficam atrás da top layer. Fechar a gaveta ou colocar confirmação e feedback dentro dela. Não pressupor que z-index resolve. Testar os consumidores antes de migrar confirmações existentes.

## Checklist de validação

- Tab, Shift+Tab, Esc, foco inicial e retorno.
- Leitor de tela: títulos, labels, erros e anúncios.
- Mobile: rolagem interna, zoom 200%, ações alcançáveis.
- Contraste e movimento reduzido.
- Sucesso, falha, carregamento e duplo envio sem usar banco de produção.
- Typecheck, testes e build; validação visual e de interação é separada.

## Pendências

Este bloco não conclui P0: faltam adoção de toasts nos módulos, FilterBar, navegação, glossário completo e testes de interface automatizados. Testes de negócio e build não certificam aparência ou acessibilidade.
