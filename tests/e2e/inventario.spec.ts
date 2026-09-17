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
    current_stock: 10,
    min_stock: 5,
    station: 'chapa',
    is_active: true,
    status: 'ok',
  },
];

const sampleAudits = [
  {
    id: 'audit-1',
    audited_by: 'Rafael Gestor',
    items: [
      {
        id: 'inv-1',
        name: 'Pão Australiano',
        category: 'Pães',
        unit: 'un',
        costPerUnit: 1.5,
        systemStock: 40,
        countedStock: 35,
        diff: -5,
        varianceCost: -7.5,
      },
    ],
    total_variance_cost: -7.5,
    created_at: '2026-09-15T10:00:00Z',
  },
];

async function mockAdminApi(
  page: Page,
  options: {
    inventory?: typeof sampleInventory;
    audits?: typeof sampleAudits;
    mutationStatus?: number;
    bootstrapDelay?: number;
  } = {},
) {
  const invRecords = options.inventory ?? sampleInventory;
  const auditRecords = options.audits ?? sampleAudits;

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
          sales: [],
          saleItems: [],
          cashSessions: [],
          cashMovements: [],
          suppliers: [],
          purchaseRecords: [],
          stockAudits: auditRecords,
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

    if (url.pathname === '/api/data/stock_audits') {
      const status = options.mutationStatus ?? 200;
      if (status >= 400) {
        return route.fulfill({
          status,
          contentType: 'application/json',
          body: '{"message":"Falha ao gravar auditoria"}',
        });
      }

      if (request.method() === 'POST') {
        const input = JSON.parse(request.postData() || '{}');
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'content-profile': 'public' },
          body: JSON.stringify([{ id: 'audit-new', ...input, created_at: '2026-09-17T12:00:00Z' }]),
        });
      }

      return route.fulfill({ status: 204, body: '' });
    }

    if (url.pathname === '/api/data/inventory') {
      return route.fulfill({ status: 204, body: '' });
    }

    if (url.pathname === '/api/data/audit_logs') {
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Inventário Físico — contagem mobile-first e divergências', () => {
  test('carrega e não possui violações críticas de acessibilidade', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/inventario');

    await expect(page.getByRole('heading', { name: 'Inventário Físico', exact: true })).toBeVisible();
    await expect(page.getByText('Pão Australiano')).toBeVisible();
    await expect(page.getByText('Bacon Fatiado')).toBeVisible();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ['critical', 'serious'].includes(item.impact || ''))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await testInfo.attach('inventario-lista', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    });
  });

  test('digitação mobile-first atualiza progresso e apura divergências', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/inventario');

    // Inicialmente 0 de 2 insumos contados (0%)
    await expect(page.getByText('0 de 2 insumos (0%)')).toBeVisible();

    // Digita contagem física de Pão Australiano: 35 un (estoque do sistema é 40 -> falta de 5 un = -R$ 7.50)
    const paoInput = page.getByLabel('Contagem física de Pão Australiano');
    await paoInput.fill('35');

    // Progresso sobe para 1 de 2 insumos (50%)
    await expect(page.getByText('1 de 2 insumos (50%)')).toBeVisible();

    // KPI de Faltas exibe - R$ 7.50
    await expect(page.getByText('- R$ 7.50').first()).toBeVisible();

    // Badge de diferença exibe "-5 un"
    await expect(page.getByText('-5 un')).toBeVisible();
  });

  test('preencher com saldo atual preenche todos os itens com 100% de progresso', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/inventario');

    await page.getByRole('button', { name: 'Preencher com saldo atual' }).click();
    await expect(page.getByText('Saldos teóricos preenchidos')).toBeVisible();
    await expect(page.getByText('2 de 2 insumos (100%)')).toBeVisible();
    await expect(page.getByText('Sem desvio').first()).toBeVisible();
  });

  test('confirmDialog valida auditor, abre confirmação e cancela por teclado', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/inventario');

    // Preenche contagem
    await page.getByLabel('Contagem física de Pão Australiano').fill('38');

    // Tenta salvar sem preencher auditor
    const saveBtn = page.getByRole('button', { name: 'Efetivar ajuste de inventário' });
    await saveBtn.click();
    await expect(page.getByText('Nome do auditor obrigatório')).toBeVisible();

    // Preenche auditor
    await page.getByLabel('Auditor Responsável').fill('Carlos Supervisor');
    await saveBtn.click();

    // Modal de confirmação aberto
    const dialog = page.getByRole('dialog', { name: 'Efetivar ajuste de inventário?' });
    await expect(dialog).toBeVisible();

    // Cancela com Escape
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('conclui ajuste e sincroniza com toast de sucesso', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/inventario');

    await page.getByLabel('Auditor Responsável').fill('Mariana Estoquista');
    await page.getByLabel('Contagem física de Pão Australiano').fill('42'); // Sobra de 2 un

    await page.getByRole('button', { name: 'Efetivar ajuste de inventário' }).click();

    const dialog = page.getByRole('dialog', { name: 'Efetivar ajuste de inventário?' });
    await expect(dialog).toBeVisible();

    // Confirma efetivação
    await page.getByRole('button', { name: 'Efetivar ajuste', exact: true }).click();

    // Toast de sucesso
    await expect(page.getByText('Inventário físico auditado com sucesso')).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test('alterna para o histórico e exibe auditorias anteriores', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/inventario');

    await page.getByRole('button', { name: 'Histórico de Auditorias' }).click();
    await expect(page.getByText('Auditor: Rafael Gestor')).toBeVisible();
    await expect(page.getByText('- R$ 7.50').first()).toBeVisible();
    await expect(page.getByText(/Pão Australiano:\s+-5 un/)).toBeVisible();
  });

  test('exibe skeleton enquanto os dados estão carregando', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await mockAdminApi(page, { bootstrapDelay: 700 });
    await page.goto('/admin/inventario');

    await expect(page.getByRole('status', { name: 'Carregando inventário' })).toBeVisible();
  });
});
