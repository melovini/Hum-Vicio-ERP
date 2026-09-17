# Testes de interface

O P0 usa Playwright e axe para validar a fundação visual sem acessar o Supabase de produção.

## Execução local

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

Os testes iniciam o Next.js em `127.0.0.1:3100`, assinam uma sessão administrativa exclusiva para o processo de teste e interceptam as APIs no navegador. Nenhuma credencial ou dado real é necessário.

## Cobertura inicial

- Fornecedores em desktop e mobile;
- carregamento, lista vazia e filtro sem resultado;
- falha ao cadastrar e excluir sem perder os dados;
- foco inicial, Escape e devolução do foco no Dialog;
- abertura e fechamento da navegação mobile;
- ausência de overflow horizontal;
- auditoria axe para violações sérias e críticas;
- captura visual anexada ao relatório de cada viewport.

## Artefatos e CI

O workflow `.github/workflows/quality.yml` executa typecheck, testes Node, build e Playwright. Em falhas, o relatório, screenshot, vídeo e trace ficam disponíveis como artefato por 14 dias.

O ambiente E2E não deve receber variáveis ou credenciais de produção. O estado autenticado é temporário, gerado em `test-results/` e ignorado pelo Git.
