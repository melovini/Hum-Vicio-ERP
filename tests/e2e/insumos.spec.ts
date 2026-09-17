import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleInventory = [
  {
    id: 'inv-1',
    name: 'Pão Australiano',
    category: 'Pães',
    unit: 'un',
    cost_per_unit: 1.5,
    current_stock: 40,
    min_stock: 20,
    station: 'nenhuma',
    is_active: true,
    status: 'ok',
  },
  {
    id: 'inv-2',
    name: 'Bacon Fatiado',
    category: 'Carnes',
    unit: 'kg',
    cost_per_unit: 35.0,
    current_stock: 2,
    min_stock: 10,
    station: 'chapa',
    is_active: true,
    status: 'ok',
  },
  {
    id: 'inv-3',
    name: 'Cebola Roxa',
    category: 'Hortifruti',
    unit: 'kg',
    cost_per_unit: 8.0,
    current_stock: 0,
    min_stock: 5,
    station: 'nenhuma',
    is_active: false,
    status: 'ok',
  },
];

async function mockAdminApi(
  page: Page,
  options: {
    inventory?: typeof sampleInventory;
    mutationStatus?: number;
    bootstrapDelay?: number;
  } = {},
) {
  const records = options.inventory ?? sampleInventory;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/bootstrap') {
      if (options.bootstrapDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.bootstrapDelay));
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          role: 'admin',
          userName: 'Gestor de teste',
          scope: 'admin',
          inventory: records,
          products: [],
          recipes: [],
          sales: [],
          saleItems: [],
          cashSessions: [],
          cashMovements: [],
          suppliers: [],
          purchaseRecords: [],
          stockAudits: [],
          auditLogs: [],
          subRecipes: [],
        }),
      });
    }

    if (url.pathname === '/api/session/activity') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"success":true}',
      });
    }

    if (url.pathname === '/api/data/inventory') {
      const status = options.mutationStatus ?? 200;
      if (status >= 400) {
        return route.fulfill({
          status,
          contentType: 'application/json',
          body: '{"message":"Falha de teste"}',
        });
      }

      if (request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'content-profile': 'public' },
          body: JSON.stringify([{ id: 'inv-new', ...input }]),
        });
      }

      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Insumos — fundação visual e acessibilidade', () => {
  test('carrega, filtra e não possui violações críticas de acessibilidade', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/insumos');

    await expect(page.getByRole('heading', { name: 'Insumos', exact: true })).toBeVisible();
    await expect(page.getByText('Pão Australiano')).toBeVisible();
    await expect(page.getByText('Bacon Fatiado')).toBeVisible();

    // Filtro por reposição
    const repoButton = page.getByRole('button', { name: /Ponto de reposição/i });
    await repoButton.click();
    await expect(page.getByText('Bacon Fatiado')).toBeVisible();
    await expect(page.getByText('Pão Australiano')).toBeHidden();

    // Desativa filtro de reposição
    await repoButton.click();
    await expect(page.getByText('Pão Australiano')).toBeVisible();

    // Busca inexistente
    await page.getByRole('searchbox', { name: 'Buscar insumos' }).fill('inexistente');
    await expect(page.getByRole('heading', { name: 'Nenhum insumo encontrado' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).last().click();
    await expect(page.getByText('Pão Australiano')).toBeVisible();

    // Acessibilidade com Axe
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact || ''))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await testInfo.attach('insumos-lista', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  });

  test('dialog mantém foco, fecha por teclado e devolve foco ao acionador', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/insumos');

    const opener = page.getByRole('button', { name: 'Cadastrar insumo' }).first();
    await opener.click();

    const dialog = page.getByRole('dialog', { name: 'Novo insumo' });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Nome do insumo')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('preserva o formulário e informa erro quando o servidor rejeita o cadastro', async ({ page }) => {
    await mockAdminApi(page, { mutationStatus: 503 });
    await page.goto('/admin/insumos');

    await page.getByRole('button', { name: 'Cadastrar insumo' }).first().click();
    await page.getByLabel('Nome do insumo').fill('Queijo Prato Especial');
    await page.getByRole('button', { name: 'Cadastrar insumo' }).last().click();

    await expect(page.getByText('Não foi possível salvar o insumo')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Novo insumo' })).toBeVisible();
    await expect(page.getByLabel('Nome do insumo')).toHaveValue('Queijo Prato Especial');
  });

  test('orienta o primeiro cadastro quando a lista está vazia', async ({ page }) => {
    await mockAdminApi(page, { inventory: [] });
    await page.goto('/admin/insumos');

    await expect(page.getByRole('heading', { name: 'Nenhum insumo cadastrado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar primeiro insumo' })).toBeVisible();
  });

  test('exibe skeleton enquanto os dados ainda estão carregando', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await mockAdminApi(page, { bootstrapDelay: 700 });
    await page.goto('/admin/insumos');

    await expect(page.getByRole('status', { name: 'Carregando insumos' })).toBeVisible();
  });
});
