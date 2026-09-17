import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleProducts = [
  {
    id: 'prod-1',
    name: 'Hum Burger Clássico',
    category: 'lanche',
    price_balcao: 36.0,
    price_ifood: 44.0,
    is_active: true,
    ncm: '2106.90.90',
    cfop: '5102',
    csosn: '102',
    recipe: [
      { ingredient_id: 'inv-1', quantity: 1 },
      { ingredient_id: 'inv-2', quantity: 0.16 },
    ],
  },
  {
    id: 'prod-2',
    name: 'Batata Frita Especial',
    category: 'porcao',
    price_balcao: 24.0,
    price_ifood: 30.0,
    is_active: true,
    recipe: [
      { ingredient_id: 'inv-3', quantity: 0.3 },
    ],
  },
];

const sampleInventory = [
  {
    id: 'inv-1',
    name: 'Pão de Brioche Selado',
    category: 'Pães',
    unit: 'un',
    cost_per_unit: 2.2,
    current_stock: 50,
    min_stock: 20,
    is_active: true,
    status: 'ok',
  },
  {
    id: 'inv-2',
    name: 'Blend Bovino 160g',
    category: 'Carnes',
    unit: 'kg',
    cost_per_unit: 38.0,
    current_stock: 15,
    min_stock: 5,
    is_active: true,
    status: 'ok',
  },
  {
    id: 'inv-3',
    name: 'Batata Palito Congelada',
    category: 'Hortifruti',
    unit: 'kg',
    cost_per_unit: 12.0,
    current_stock: 25,
    min_stock: 10,
    is_active: true,
    status: 'ok',
  },
  {
    id: 'prep-1',
    name: 'Maionese Especial Verde',
    category: 'Pré-preparos',
    unit: 'kg',
    cost_per_unit: 14.5,
    current_stock: 5,
    min_stock: 2,
    is_active: true,
    status: 'ok',
  },
];

const sampleSubRecipes = [
  {
    id: 'sub-1',
    parent_ingredient_id: 'prep-1',
    child_ingredient_id: 'inv-3',
    quantity: 0.5,
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
          subRecipes: sampleSubRecipes,
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

test.describe('Cardápio & Fichas Técnicas — design system e acessibilidade', () => {
  test('carrega tela de cardápio sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/cardapio');

    await expect(page.getByRole('heading', { name: /Cardápio/i, exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Hum Burger Clássico')).toBeVisible();

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
    await page.goto('/admin/cardapio');

    await expect(page.getByText('Hum Burger Clássico')).toBeVisible();
    await expect(page.getByText('Batata Frita Especial')).toBeVisible();

    // Filtra digitando "Batata"
    const searchInput = page.getByPlaceholder(/nome ou categoria/i);
    await searchInput.fill('Batata');

    await expect(page.getByText('Batata Frita Especial')).toBeVisible();
    await expect(page.getByText('Hum Burger Clássico')).not.toBeVisible();

    // Limpa a busca
    await searchInput.fill('');
    await expect(page.getByText('Hum Burger Clássico')).toBeVisible();
    await expect(page.getByText('Batata Frita Especial')).toBeVisible();
  });

  test('abre Dialog de Novo Produto e fecha com Escape', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/cardapio');

    await page.getByRole('button', { name: /novo produto/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /novo produto/i })).toBeVisible();

    // Pressiona Escape para fechar
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('abre ConfirmDialog ao solicitar desativação e fecha ao cancelar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/cardapio');

    await expect(page.getByText('Hum Burger Clássico')).toBeVisible();

    // Clica no botão de desativar do card
    const deleteBtn = page.getByRole('button', { name: /desativar/i }).first();
    await deleteBtn.click();

    // ConfirmDialog deve abrir sem alertas nativos
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('button', { name: /desativar/i })).toBeVisible();

    // Clica em Cancelar
    await confirmDialog.getByRole('button', { name: /cancelar/i }).click();
    await expect(confirmDialog).not.toBeVisible();
  });

  test('permite alternar para aba de Sub-Receitas', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/cardapio');

    const subTab = page.getByRole('tab', { name: /sub-receitas/i });
    await expect(subTab).toBeVisible();
    await subTab.click();

    await expect(subTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Maionese Especial Verde' })).toBeVisible();
  });

  test('exibe skeleton de carregamento antes do carregamento completo', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await mockAdminApi(page, { bootstrapDelay: 600 });
    await page.goto('/admin/cardapio');

    const skeleton = page.locator('[data-testid="cardapio-skeleton"], .animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Hum Burger Clássico')).toBeVisible({ timeout: 10000 });
  });
});
