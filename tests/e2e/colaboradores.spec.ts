import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleCollaborators = [
  {
    id: 'collab-1',
    name: 'Carlos Silva',
    role: 'caixa',
    pin: '',
    phone: '11988887777',
    shift: 'tarde',
    payType: 'mensalista',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'collab-2',
    name: 'Ana Chapeira',
    role: 'cozinha',
    pin: '',
    phone: '11977776666',
    shift: 'noite',
    payType: 'diarista',
    dailyRate: 120,
    weeklySchedule: ['2026-09-15', '2026-09-16'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'collab-3',
    name: 'Marcos Gerente',
    role: 'gerente',
    pin: '',
    phone: '11966665555',
    shift: 'integral',
    payType: 'mensalista',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

async function mockAdminApi(
  page: Page,
  options: {
    bootstrapDelay?: number;
  } = {},
) {
  await page.addInitScript((collabs) => {
    localStorage.setItem('hum_vicio_collaborators', JSON.stringify(collabs));
  }, sampleCollaborators);

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

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('Equipe & Colaboradores — design system e acessibilidade', () => {
  test('carrega tela de colaboradores sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockAdminApi(page);
    await page.goto('/admin/colaboradores');

    await expect(page.getByRole('heading', { name: 'Equipe & Colaboradores' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('table').getByText('Carlos Silva')).toBeVisible();

    const axe = new AxeBuilder({ page }).disableRules(['color-contrast']);
    if (testInfo.project.name.includes('mobile')) {
      axe.disableRules(['color-contrast', 'scrollable-region-focusable']);
    }
    const results = await axe.analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(criticalViolations).toEqual([]);
  });

  test('filtra colaboradores por busca textual e cargo na FilterBar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/colaboradores');

    await expect(page.getByRole('table').getByText('Carlos Silva')).toBeVisible();
    await expect(page.getByRole('table').getByText('Ana Chapeira')).toBeVisible();

    // Filtra digitando "Ana"
    const searchInput = page.getByPlaceholder(/nome ou telefone/i);
    await searchInput.fill('Ana');

    await expect(page.getByRole('table').getByText('Ana Chapeira')).toBeVisible();
    await expect(page.getByRole('table').getByText('Carlos Silva')).not.toBeVisible();

    // Limpa a busca
    await searchInput.fill('');
    await expect(page.getByRole('table').getByText('Carlos Silva')).toBeVisible();
    await expect(page.getByRole('table').getByText('Ana Chapeira')).toBeVisible();

    // Filtra por Cargo no Select
    const roleSelect = page.getByLabel(/filtrar por cargo/i);
    await roleSelect.selectOption('caixa');

    await expect(page.getByRole('table').getByText('Carlos Silva')).toBeVisible();
    await expect(page.getByRole('table').getByText('Ana Chapeira')).not.toBeVisible();
  });

  test('abre SlidingSheet para Novo Colaborador e fecha com Escape', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/colaboradores');

    await page.getByRole('button', { name: /novo colaborador/i }).click();

    const sheetDialog = page.getByRole('dialog');
    await expect(sheetDialog).toBeVisible();
    await expect(sheetDialog.getByRole('heading', { name: /cadastrar colaborador/i })).toBeVisible();

    // Fecha pressionando Escape
    await page.keyboard.press('Escape');
    await expect(sheetDialog).not.toBeVisible();
  });

  test('alterna para a sub-aba de Escala Quinzenal & Diárias', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/colaboradores');

    await page.getByRole('button', { name: /escala quinzenal/i }).click();

    await expect(page.getByRole('heading', { name: /painel de acerto de diárias/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /matriz de escala quinzenal/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ana Chapeira' })).toBeVisible();
  });

  test('abre ConfirmDialog ao solicitar exclusão e permite cancelar', async ({ page }) => {
    await mockAdminApi(page);
    await page.goto('/admin/colaboradores');

    await expect(page.getByRole('table').getByText('Carlos Silva')).toBeVisible();

    // Clica no botão excluir de Carlos Silva
    await page.getByLabel('Excluir cadastro de Carlos Silva').click();

    // Confirmação via ConfirmDialog
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByRole('heading', { name: 'Excluir Colaborador' })).toBeVisible();

    // Clica em Cancelar
    await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirmDialog).not.toBeVisible();

    // Carlos Silva continua na lista
    await expect(page.getByRole('table').getByText('Carlos Silva')).toBeVisible();
  });

  test('exibe skeleton de carregamento quando não há cache local', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await mockAdminApi(page, { bootstrapDelay: 600 });
    await page.goto('/admin/colaboradores');

    const skeleton = page.locator('[data-testid="colaboradores-skeleton"], .animate-pulse').first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });
  });
});
