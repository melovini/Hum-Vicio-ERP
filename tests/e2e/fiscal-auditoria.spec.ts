import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleInvoices = [
  {
    id: 'inv-1',
    saleId: 'sale-1',
    numero: 101,
    serie: 1,
    chaveAcesso: '31260912345678000199650010000001011000001010',
    status: 'autorizada',
    dataEmissao: new Date().toISOString(),
    valorTotal: 58.90,
    destinatarioNome: 'Maria Santos',
    destinatarioCpfCnpj: '123.456.789-00',
    ambiente: 'homologacao',
    itemsSummary: '1x Burger Especial',
    formaPagamento: 'PIX',
  },
  {
    id: 'inv-2',
    saleId: 'sale-2',
    numero: 102,
    serie: 1,
    chaveAcesso: '31260912345678000199650010000001021000001020',
    status: 'simulada',
    dataEmissao: new Date().toISOString(),
    valorTotal: 34.00,
    destinatarioNome: 'Consumidor Final',
    ambiente: 'homologacao',
    itemsSummary: '1x Batata Frita',
    formaPagamento: 'Dinheiro',
  },
];

const sampleAuditLogs = [
  {
    id: 'log-1',
    timestamp: new Date().toISOString(),
    operator: 'Carlos Caixa',
    action: 'CANCELAMENTO_VENDA',
    details: 'Estorno do pedido #101 com senha do gerente',
  },
  {
    id: 'log-2',
    timestamp: new Date().toISOString(),
    operator: 'Admin Vinicius',
    action: 'SANGRIA',
    details: 'Retirada de R$ 250,00 para cofre da tesouraria',
  },
];

async function mockAdminApi(
  page: Page,
  options: {
    bootstrapDelay?: number;
  } = {},
) {
  await page.addInitScript(({ invoices, logs }) => {
    localStorage.setItem('hum_vicio_fiscal_invoices', JSON.stringify(invoices));
    localStorage.setItem('hum_vicio_audit_logs', JSON.stringify(logs));
  }, { invoices: sampleInvoices, logs: sampleAuditLogs });

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
          products: [],
          recipes: [],
          sales: [],
          saleItems: [],
          cashSessions: [],
          cashMovements: [],
          suppliers: [],
          purchaseRecords: [],
          stockAudits: [],
          auditLogs: sampleAuditLogs,
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

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Conformidade Fiscal — design system e acessibilidade', () => {
  test('carrega tela fiscal sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/fiscal');

    await expect(page.getByRole('heading', { name: 'Gestão Fiscal & Emissão de Notas' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/dados cadastrais do emitente/i)).toBeVisible();

    const axe = new AxeBuilder({ page }).disableRules(['color-contrast']);
    if (testInfo.project.name.includes('mobile')) {
      axe.disableRules(['color-contrast', 'scrollable-region-focusable']);
    }
    const results = await axe.analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(criticalViolations).toEqual([]);
  });

  test('navega entre abas e filtra notas fiscais na FilterBar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/fiscal');

    // Clica na aba 4: Notas Fiscais Emitidas
    await page.getByRole('button', { name: /4\. notas fiscais emitidas/i }).click();

    await expect(page.getByRole('table').getByText('Maria Santos')).toBeVisible();
    await expect(page.getByRole('table').getByText('Consumidor Final')).toBeVisible();

    // Filtra pelo termo de busca
    const searchInput = page.getByPlaceholder(/buscar por número, cpf ou chave/i);
    await searchInput.fill('Maria');

    await expect(page.getByRole('table').getByText('Maria Santos')).toBeVisible();
    await expect(page.getByRole('table').getByText('Consumidor Final')).not.toBeVisible();

    // Limpa a busca
    await searchInput.fill('');
    await expect(page.getByRole('table').getByText('Maria Santos')).toBeVisible();
    await expect(page.getByRole('table').getByText('Consumidor Final')).toBeVisible();
  });

  test('abre Dialog de visualização do DANFE e fecha com Escape', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/fiscal');

    // Aba Notas Emitidas
    await page.getByRole('button', { name: /4\. notas fiscais emitidas/i }).click();

    // Clica no botão DANFE da primeira nota
    await page.getByRole('button', { name: 'DANFE' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /danfe nfc-e/i })).toBeVisible();

    // Fecha pressionando Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('abre ConfirmDialog para limpar histórico fiscal e permite cancelar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/fiscal');

    // Aba Notas Emitidas
    await page.getByRole('button', { name: /4\. notas fiscais emitidas/i }).click();

    // Clica no botão Limpar Histórico Fiscal
    await page.getByRole('button', { name: /limpar histórico fiscal/i }).click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('heading', { name: 'Limpar Histórico Fiscal' })).toBeVisible();

    // Clica em Cancelar
    await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirmDialog).not.toBeVisible();

    // As notas continuam visíveis
    await expect(page.getByRole('table').getByText('Maria Santos')).toBeVisible();
  });
});

test.describe('Auditoria & Segurança — design system e acessibilidade', () => {
  test('carrega tela de auditoria sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/auditoria');

    await expect(page.getByRole('heading', { name: 'Central de Auditoria & Conformidade' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Carlos Caixa')).toBeVisible();

    const axe = new AxeBuilder({ page }).disableRules(['color-contrast']);
    if (testInfo.project.name.includes('mobile')) {
      axe.disableRules(['color-contrast', 'scrollable-region-focusable']);
    }
    const results = await axe.analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(criticalViolations).toEqual([]);
  });

  test('filtra eventos de auditoria por categoria e busca na FilterBar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/auditoria');

    await expect(page.getByText('Carlos Caixa')).toBeVisible();
    await expect(page.getByText('Admin Vinicius')).toBeVisible();

    // Filtra digitando "Vinicius"
    const searchInput = page.getByPlaceholder(/buscar ação, operador ou detalhes/i);
    await searchInput.fill('Vinicius');

    await expect(page.getByText('Admin Vinicius')).toBeVisible();
    await expect(page.getByText('Carlos Caixa')).not.toBeVisible();

    // Limpa a busca
    await searchInput.fill('');
    await expect(page.getByText('Carlos Caixa')).toBeVisible();
    await expect(page.getByText('Admin Vinicius')).toBeVisible();

    // Filtra por Categoria no Select
    const catSelect = page.getByLabel(/filtrar por categoria/i);
    await catSelect.selectOption('cancelamento');

    await expect(page.getByText('Carlos Caixa')).toBeVisible();
    await expect(page.getByText('Admin Vinicius')).not.toBeVisible();
  });

  test('navega para a aba de Webhook do Dono', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/auditoria');

    await page.getByRole('button', { name: /webhook do dono/i }).click();

    await expect(page.getByRole('heading', { name: /alertas em tempo real via webhook/i })).toBeVisible();
    await expect(page.getByLabel(/url do webhook/i)).toBeVisible();
  });

  test('exibe skeleton de carregamento na auditoria antes do carregamento', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await mockAdminApi(page, { bootstrapDelay: 600 });
    await page.goto('/admin/auditoria');

    const skeleton = page.locator('[data-testid="auditoria-skeleton"], .animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });
  });
});
