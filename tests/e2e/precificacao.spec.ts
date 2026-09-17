import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleProducts = [
  {
    id: 'prod-1',
    name: 'Burger Duplo Cheddar',
    category: 'lanche',
    price_balcao: 40.0,
    price_ifood: 50.0,
    is_active: true,
    recipe: [
      { ingredient_id: 'inv-1', quantity: 2 },
    ],
  },
  {
    id: 'prod-2',
    name: 'Burger Simples Salada',
    category: 'lanche',
    price_balcao: 28.0,
    price_ifood: 35.0,
    is_active: true,
    recipe: [
      { ingredient_id: 'inv-1', quantity: 1 },
    ],
  },
  {
    id: 'prod-3',
    name: 'Batata Rústica Grande',
    category: 'porcao',
    price_balcao: 22.0,
    price_ifood: 28.0,
    is_active: true,
    recipe: [],
  },
];

const sampleInventory = [
  {
    id: 'inv-1',
    name: 'Blend Bovino 160g',
    category: 'Carnes',
    unit: 'kg',
    cost_per_unit: 10.0,
    current_stock: 30,
    min_stock: 10,
    is_active: true,
    status: 'ok',
  },
];

async function mockAdminApi(
  page: Page,
  options: {
    bootstrapDelay?: number;
  } = {},
) {
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
          inventory: sampleInventory,
          products: sampleProducts,
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

    if (url.pathname === '/api/data/products') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleProducts),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Precificação Inteligente do iFood — design system e acessibilidade', () => {
  test('carrega tela de precificação sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/precificacao');

    await expect(page.getByRole('heading', { name: 'Precificação Inteligente do iFood', exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('table').getByText('Burger Duplo Cheddar')).toBeVisible();

    const axe = new AxeBuilder({ page }).disableRules(['color-contrast']);
    if (testInfo.project.name.includes('mobile')) {
      axe.disableRules(['color-contrast', 'scrollable-region-focusable']);
    }
    const results = await axe.analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(criticalViolations).toEqual([]);
  });

  test('filtra produtos por busca textual na FilterBar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/precificacao');

    await expect(page.getByRole('table').getByText('Burger Duplo Cheddar')).toBeVisible();
    await expect(page.getByRole('table').getByText('Batata Rústica Grande')).toBeVisible();

    // Filtra digitando "Batata"
    const searchInput = page.getByPlaceholder(/nome ou categoria/i);
    await searchInput.fill('Batata');

    await expect(page.getByRole('table').getByText('Batata Rústica Grande')).toBeVisible();
    await expect(page.getByRole('table').getByText('Burger Duplo Cheddar')).not.toBeVisible();

    // Limpa a busca
    await searchInput.fill('');
    await expect(page.getByRole('table').getByText('Burger Duplo Cheddar')).toBeVisible();
    await expect(page.getByRole('table').getByText('Batata Rústica Grande')).toBeVisible();
  });

  test('abre Dialog de Ajuste em Lote e fecha com Escape', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/precificacao');

    await page.getByRole('button', { name: /ajuste em lote/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /ajuste de preços em lote/i })).toBeVisible();

    // Fecha pressionando Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('permite alterar preço no iFood e salvar individualmente', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/precificacao');

    await expect(page.getByRole('table').getByText('Burger Duplo Cheddar')).toBeVisible();

    // Localiza input de preço do primeiro produto
    const priceInput = page.getByLabel('Preço iFood de Burger Duplo Cheddar');
    await priceInput.fill('54.90');

    // Botão salvar deve aparecer na linha
    const saveBtn = page.getByRole('button', { name: /^salvar$/i }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Toast de confirmação deve aparecer
    await expect(page.getByText(/preço no ifood salvo/i)).toBeVisible();
  });

  test('exibe Raio-X comparativo Balcão vs iFood', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/precificacao');

    await expect(page.getByRole('heading', { name: /raio-x/i })).toBeVisible();
    await expect(page.getByText(/venda no balcão/i)).toBeVisible();
    await expect(page.getByText(/venda no ifood/i)).toBeVisible();
  });

  test('exibe skeleton de carregamento antes do carregamento completo', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await mockAdminApi(page, { bootstrapDelay: 600 });
    await page.goto('/admin/precificacao');

    const skeleton = page.locator('[data-testid="precificacao-skeleton"], .animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole('table').getByText('Burger Duplo Cheddar')).toBeVisible({ timeout: 10000 });
  });
});
