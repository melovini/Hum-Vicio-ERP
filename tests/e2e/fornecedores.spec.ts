import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const suppliers = [
  { id: 'supplier-1', name: 'Açougue Central', contact_name: 'Rafael', phone: '34999990000', category: 'Carnes', notes: 'Entrega às terças', created_at: '2026-09-16T12:00:00Z' },
  { id: 'supplier-2', name: 'Horta Mineira', contact_name: 'Ana', phone: '', category: 'Hortifruti', notes: '', created_at: '2026-09-15T12:00:00Z' },
];

async function mockAdminApi(page: Page, options: { suppliers?: typeof suppliers; mutationStatus?: number; bootstrapDelay?: number } = {}) {
  const records = options.suppliers ?? suppliers;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/bootstrap') {
      if (options.bootstrapDelay) await new Promise((resolve) => setTimeout(resolve, options.bootstrapDelay));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        role: 'admin', userName: 'Gestor de teste', scope: 'admin', inventory: [], products: [], recipes: [], sales: [], saleItems: [],
        cashSessions: [], cashMovements: [], suppliers: records, purchaseRecords: [], stockAudits: [], auditLogs: [], subRecipes: [],
      }) });
    }
    if (url.pathname === '/api/session/activity') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    if (url.pathname === '/api/data/suppliers') {
      const status = options.mutationStatus ?? 200;
      if (status >= 400) return route.fulfill({ status, contentType: 'application/json', body: '{"message":"Falha de teste"}' });
      if (request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'content-profile': 'public' }, body: JSON.stringify([{ id: 'supplier-new', ...input, created_at: '2026-09-17T12:00:00Z' }]) });
      }
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Fornecedores — fundação visual', () => {
  test('carrega, filtra e não possui violações críticas de acessibilidade', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/fornecedores');
    await expect(page.getByRole('heading', { name: 'Fornecedores', exact: true })).toBeVisible();
    await expect(page.getByText('Açougue Central')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar fornecedores' }).fill('inexistente');
    await expect(page.getByRole('heading', { name: 'Nenhum fornecedor encontrado' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact || ''))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await testInfo.attach('fornecedores-lista', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
  });

  test('dialog mantém foco, fecha por teclado e devolve foco ao acionador', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/fornecedores');
    const opener = page.getByRole('button', { name: 'Cadastrar fornecedor' }).first();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Novo fornecedor' });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Nome da empresa ou fornecedor')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('preserva o formulário e informa erro quando o servidor rejeita o cadastro', async ({ page }) => {
    await mockAdminApi(page, { mutationStatus: 503 });
    await page.goto('/admin/fornecedores');
    await page.getByRole('button', { name: 'Cadastrar fornecedor' }).first().click();
    await page.getByLabel('Nome da empresa ou fornecedor').fill('Fornecedor preservado');
    await page.getByRole('button', { name: 'Salvar fornecedor' }).click();
    await expect(page.getByText('Não foi possível cadastrar')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Novo fornecedor' })).toBeVisible();
    await expect(page.getByLabel('Nome da empresa ou fornecedor')).toHaveValue('Fornecedor preservado');
  });

  test('mantém o fornecedor quando o servidor rejeita a exclusão', async ({ page }) => {
    await mockAdminApi(page, { mutationStatus: 503 });
    await page.goto('/admin/fornecedores');
    await page.getByRole('button', { name: 'Excluir fornecedor Açougue Central' }).click();
    await expect(page.getByRole('dialog', { name: 'Excluir fornecedor?' })).toBeVisible();
    await page.getByRole('button', { name: 'Excluir fornecedor', exact: true }).click();
    await expect(page.getByText('Não foi possível excluir')).toBeVisible();
    await expect(page.getByText('Açougue Central')).toBeVisible();
  });

  test('orienta o primeiro cadastro quando a lista está vazia', async ({ page }) => {
    await mockAdminApi(page, { suppliers: [] });
    await page.goto('/admin/fornecedores');
    await expect(page.getByRole('heading', { name: 'Seu primeiro fornecedor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar fornecedor' })).toBeVisible();
  });

  test('exibe skeleton enquanto os dados ainda estão carregando', async ({ page }) => {
    await mockAdminApi(page, { bootstrapDelay: 700 });
    await page.goto('/admin/fornecedores');
    await expect(page.getByRole('status', { name: 'Carregando fornecedores' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fornecedores', exact: true })).toBeVisible();
  });
});

test('navegação mobile abre como painel e fecha com Escape', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'Cenário exclusivo do viewport mobile.');
  await mockAdminApi(page);
  await page.goto('/admin/fornecedores');
  const opener = page.getByRole('button', { name: 'Abrir navegação da gestão' });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Navegação da gestão' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
