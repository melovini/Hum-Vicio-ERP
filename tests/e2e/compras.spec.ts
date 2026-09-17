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
    status: 'acabando',
  },
];

const sampleSuppliers = [
  {
    id: 'sup-1',
    name: 'Distribuidora São Paulo',
    category: 'Carnes',
    contact_name: 'Marcos',
    phone: '11999998888',
  },
];

const samplePurchases = [
  {
    id: 'purch-1',
    ingredient_id: 'inv-2',
    ingredient_name: 'Bacon Fatiado',
    supplier_id: 'sup-1',
    supplier_name: 'Distribuidora São Paulo',
    quantity: 15,
    unit: 'kg',
    cost_per_unit: 34.0,
    total_cost: 510.0,
    created_at: '2026-09-16T15:30:00Z',
  },
];

async function mockAdminApi(
  page: Page,
  options: {
    inventory?: typeof sampleInventory;
    suppliers?: typeof sampleSuppliers;
    purchases?: typeof samplePurchases;
    mutationStatus?: number;
    bootstrapDelay?: number;
  } = {},
) {
  const invRecords = options.inventory ?? sampleInventory;
  const supRecords = options.suppliers ?? sampleSuppliers;
  const purchRecords = options.purchases ?? samplePurchases;

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
          inventory: invRecords,
          products: [],
          recipes: [],
          sales: [
            { id: 'sale-1', total: 100, created_at: '2026-09-17T01:00:00Z' },
            { id: 'sale-2', total: 120, created_at: '2026-09-17T02:00:00Z' },
            { id: 'sale-3', total: 80, created_at: '2026-09-17T03:00:00Z' },
            { id: 'sale-4', total: 150, created_at: '2026-09-17T04:00:00Z' },
            { id: 'sale-5', total: 90, created_at: '2026-09-17T05:00:00Z' },
          ],
          saleItems: [],
          cashSessions: [],
          cashMovements: [],
          suppliers: supRecords,
          purchaseRecords: purchRecords,
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

    if (url.pathname === '/api/data/purchase_records') {
      const status = options.mutationStatus ?? 200;
      if (status >= 400) {
        return route.fulfill({
          status,
          contentType: 'application/json',
          body: '{"message":"Erro ao registrar compra no banco"}',
        });
      }

      if (request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'content-profile': 'public' },
          body: JSON.stringify([{ id: 'purch-new', ...input, created_at: '2026-09-17T12:00:00Z' }]),
        });
      }

      return route.fulfill({ status: 204, body: '' });
    }

    if (url.pathname === '/api/data/inventory') {
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Compras — fluxo guiado e acessibilidade', () => {
  test('carrega, filtra por urgentes e não possui violações críticas de acessibilidade', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/compras');

    await expect(page.getByRole('heading', { name: 'Compras', exact: true })).toBeVisible();
    await expect(page.getByText('Bacon Fatiado').first()).toBeVisible();
    await expect(page.getByText('Pão Australiano')).toBeVisible();

    // Filtro de urgentes
    const urgentButton = page.getByRole('button', { name: /Urgentes/i });
    await urgentButton.click();
    await expect(page.getByText('Bacon Fatiado').first()).toBeVisible();
    await expect(page.getByText('Pão Australiano')).toBeHidden();

    // Desativa filtro de urgentes
    await urgentButton.click();
    await expect(page.getByText('Pão Australiano')).toBeVisible();

    // Acessibilidade Axe
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact || ''))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await testInfo.attach('compras-lista', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  });

  test('dialog mantém foco, fecha por teclado e devolve foco ao acionador', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/compras');

    const opener = page.getByRole('button', { name: 'Registrar compra' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: 'Registrar entrada de compra' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('conclui entrada no estoque com cálculo de conferência em tempo real', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/compras');

    // Clica no botão "Dar entrada" do item Bacon Fatiado
    const darEntradaBtn = page.getByRole('button', { name: 'Dar entrada' }).first();
    await darEntradaBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Registrar entrada de compra' });
    await expect(dialog).toBeVisible();

    // Preenche quantidade comprada: 10 kg
    await page.getByLabel(/Quantidade comprada/i).fill('10');

    // Confere se o preview exibe o novo saldo calculado (2 + 10 = 12 kg)
    await expect(page.getByText('12 kg')).toBeVisible();

    // Submete a entrada
    await page.getByRole('button', { name: 'Confirmar entrada no estoque' }).click();

    // Confirma feedback de sucesso
    await expect(page.getByText('Entrada confirmada no estoque')).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test('alterna para a aba de histórico e exibe compras anteriores', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/compras');

    await page.getByRole('button', { name: 'Histórico de Entradas' }).click();
    await expect(page.getByText('Distribuidora São Paulo')).toBeVisible();
    await expect(page.getByText('+15 kg')).toBeVisible();
    await expect(page.getByText('R$ 510.00')).toBeVisible();
  });

  test('exibe skeleton enquanto os dados estão carregando', async ({ page }) => {
    await mockAdminApi(page, { bootstrapDelay: 700 });
    await page.goto('/admin/compras');

    await expect(page.getByRole('status', { name: 'Carregando compras' })).toBeVisible();
  });
});
