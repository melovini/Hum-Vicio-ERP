import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleSales = [
  {
    id: 'sale-1',
    customer_name: 'Carlos Silva - Rua das Flores, 120',
    customer_phone: '11988887777',
    total_amount: 150.0,
    discount_amount: 0,
    delivery_fee: 10.0,
    status: 'completed',
    order_type: 'delivery',
    channel: 'balcao',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'sale-2',
    customer_name: 'Carlos Silva',
    customer_phone: '11988887777',
    total_amount: 180.0,
    discount_amount: 0,
    delivery_fee: 10.0,
    status: 'completed',
    order_type: 'delivery',
    channel: 'balcao',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'sale-3',
    customer_name: 'Ana Oliveira',
    customer_phone: '11977776666',
    total_amount: 60.0,
    discount_amount: 0,
    delivery_fee: 0,
    status: 'completed',
    order_type: 'retirada',
    channel: 'balcao',
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
];

const sampleSaleItems = [
  {
    id: 'item-1',
    sale_id: 'sale-1',
    product_id: 'prod-1',
    quantity: 2,
    unit_price: 35.0,
    total_price: 70.0,
  },
  {
    id: 'item-2',
    sale_id: 'sale-2',
    product_id: 'prod-1',
    quantity: 3,
    unit_price: 35.0,
    total_price: 105.0,
  },
  {
    id: 'item-3',
    sale_id: 'sale-3',
    product_id: 'prod-2',
    quantity: 1,
    unit_price: 60.0,
    total_price: 60.0,
  },
];

const sampleProducts = [
  {
    id: 'prod-1',
    name: 'Burger Smash Especial',
    category: 'Burgers',
    price: 35.0,
    is_active: true,
  },
  {
    id: 'prod-2',
    name: 'Burger Duplo Cheddar',
    category: 'Burgers',
    price: 60.0,
    is_active: true,
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
          inventory: [],
          products: sampleProducts,
          recipes: [],
          sales: sampleSales,
          saleItems: sampleSaleItems,
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

    if (url.pathname === '/api/crm/customers') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, customers: [] }),
      });
    }

    if (url.pathname === '/api/customers/import') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, customers: [] }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Clientes & CRM — design system e acessibilidade', () => {
  test('carrega painel de clientes sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/clientes');

    await expect(page.getByRole('heading', { name: 'Clientes & CRM', exact: false })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Carlos Silva')).toBeVisible();

    const axe = new AxeBuilder({ page }).disableRules(['color-contrast']);
    if (testInfo.project.name.includes('mobile')) {
      axe.disableRules(['color-contrast', 'scrollable-region-focusable']);
    }
    const results = await axe.analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(criticalViolations).toEqual([]);
  });

  test('filtra clientes por busca textual na FilterBar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/clientes');

    await expect(page.getByText('Carlos Silva')).toBeVisible();
    await expect(page.getByText('Ana Oliveira')).toBeVisible();

    // Digita no input de busca da FilterBar
    const searchInput = page.getByPlaceholder(/nome, telefone ou endereço/i);
    await searchInput.fill('Carlos');

    // Carlos deve continuar visível, Ana deve sumir
    await expect(page.getByText('Carlos Silva')).toBeVisible();
    await expect(page.getByText('Ana Oliveira')).not.toBeVisible();

    // Limpa a busca
    await searchInput.fill('');
    await expect(page.getByText('Carlos Silva')).toBeVisible();
    await expect(page.getByText('Ana Oliveira')).toBeVisible();
  });

  test('abre SlidingSheet de detalhes ao clicar no cliente e fecha com Esc', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/clientes');

    await expect(page.getByText('Carlos Silva')).toBeVisible();

    // Clica no botão Ver Perfil para abrir a gaveta SlidingSheet
    await page.getByRole('button', { name: 'Ver Perfil' }).first().click();

    // SlidingSheet deve abrir
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(dialog.getByText(/WhatsApp/i)).toBeVisible();

    // Fecha pressionando Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('exibe skeleton de carregamento antes do carregamento completo', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await mockAdminApi(page, { bootstrapDelay: 600 });
    await page.goto('/admin/clientes');

    // Ao carregar com delay, o skeleton é renderizado
    const skeleton = page.locator('[data-testid="clientes-skeleton"], .animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });

    // Após resolver, a lista aparece
    await expect(page.getByText('Carlos Silva')).toBeVisible({ timeout: 10000 });
  });

  test('permite alternar entre abas analíticas', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/clientes');

    await expect(page.getByRole('tab', { name: /lucratividade/i })).toBeVisible();

    // Clica na aba Radar de Churn
    const churnTab = page.getByRole('tab', { name: /churn|radar/i });
    await churnTab.click();
    await expect(churnTab).toHaveAttribute('aria-selected', 'true');
  });
});
