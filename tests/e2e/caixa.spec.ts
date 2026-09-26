import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const sampleProducts = [
  {
    id: 'prod-burger-1',
    name: 'Hum Burger Clássico',
    category: 'lanche',
    status: 'validado',
    price_balcao: 32.0,
    price_ifood: 38.0,
    is_active: true,
    ncm: '2106.90.90',
    cfop: '5102',
    csosn: '102',
    recipe: [],
  },
  {
    id: 'prod-fries-1',
    name: 'Batata Rústica Especial',
    category: 'porcao',
    status: 'validado',
    price_balcao: 22.0,
    price_ifood: 26.0,
    is_active: true,
    recipe: [],
  },
  {
    id: 'prod-drink-1',
    name: 'Refrigerante Lata 350ml',
    category: 'bebida',
    status: 'validado',
    price_balcao: 7.0,
    price_ifood: 9.0,
    is_active: true,
    recipe: [],
  },
];

const sampleRecipes = [
  { product_id: 'prod-burger-1', ingredient_id: 'ing-1', quantity: 1 },
  { product_id: 'prod-fries-1', ingredient_id: 'ing-2', quantity: 1 },
  { product_id: 'prod-drink-1', ingredient_id: 'ing-3', quantity: 1 },
];

const sampleCashSessions = [
  {
    id: 'sess-open-1',
    status: 'open',
    initial_amount: 150.0,
    opened_by: 'Operador Teste',
    opened_at: new Date().toISOString(),
  },
];

async function mockCaixaApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/bootstrap') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          role: 'caixa',
          userName: 'Operador Caixa',
          scope: 'caixa',
          inventory: [],
          products: sampleProducts,
          recipes: sampleRecipes,
          sales: [],
          saleItems: [],
          cashSessions: sampleCashSessions,
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

test.describe('Caixa / PDV — ergonomia, 3 zonas e acessibilidade', () => {
  test('carrega as 3 zonas estáveis do PDV sem violações críticas de acessibilidade (Axe)', async ({ page }, testInfo) => {
    await mockCaixaApi(page);
    await page.goto('/caixa');

    // Verifica que as 3 zonas funcionais estão renderizadas
    await expect(page.getByRole('heading', { name: 'Catálogo de Produtos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Pedido Atual' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Resumo e Pagamento/i })).toBeVisible();

    // Produtos disponíveis para venda
    await expect(page.getByRole('button', { name: /Hum Burger Clássico/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Batata Rústica Especial/i })).toBeVisible();

    // Auditoria de Acessibilidade com Axe
    const axe = new AxeBuilder({ page }).disableRules(['color-contrast']);
    if (testInfo.project.name.includes('mobile')) {
      axe.disableRules(['color-contrast', 'scrollable-region-focusable']);
    }
    const results = await axe.analyze();
    const criticalViolations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(criticalViolations).toEqual([]);
  });

  test('foca busca de produtos pelo atalho F2 e permite adicionar itens ao pedido', async ({ page }) => {
    await mockCaixaApi(page);
    await page.goto('/caixa');

    await expect(page.getByRole('heading', { name: 'Catálogo de Produtos' })).toBeVisible({ timeout: 10000 });

    // Pressiona F2 para focar na busca
    await page.keyboard.press('F2');
    const searchInput = page.getByPlaceholder(/Buscar produto pelo nome/i);
    await expect(searchInput).toBeFocused();

    // Digita para filtrar produto
    await searchInput.fill('Batata');
    await expect(page.getByRole('button', { name: /Batata Rústica Especial/i })).toBeVisible();

    // Clica no produto da porção para adicionar diretamente ao pedido
    await page.getByRole('button', { name: /Batata Rústica Especial/i }).click();

    // Verifica se o item aparece na Zona 2 (Pedido Atual)
    await expect(page.getByRole('heading', { name: 'Pedido Atual' })).toBeVisible();
    await expect(page.getByTestId('pos-cart-items').getByText('Batata Rústica Especial')).toBeVisible();

    // Verifica cálculo de total na Zona 3
    await expect(page.getByText(/Total a Pagar:/i)).toBeVisible();
  });

  test('abre e fecha o guia de atalhos rápidos com F1 e Esc', async ({ page }) => {
    await mockCaixaApi(page);
    await page.goto('/caixa');

    await expect(page.getByRole('heading', { name: 'Catálogo de Produtos' })).toBeVisible({ timeout: 10000 });

    // Garante foco na janela antes do atalho de teclado
    await page.locator('body').click();
    await page.keyboard.press('F1');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Atalhos de Teclado/i)).toBeVisible();

    // Pressiona Escape para fechar
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('calcula troco dinâmico ao selecionar pagamento em dinheiro', async ({ page }) => {
    await mockCaixaApi(page);
    await page.goto('/caixa');

    await expect(page.getByRole('heading', { name: 'Catálogo de Produtos' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Batata Rústica Especial/i }).click();

    // Seleciona pagamento em Dinheiro (F8)
    await page.keyboard.press('F8');

    // Preenche valor recebido de R$ 50,00
    const cashInput = page.getByPlaceholder(/Valor recebido/i);
    await cashInput.fill('50.00');

    // Troco esperado: 50.00 - 22.00 = 28.00
    await expect(page.getByText(/Devolver de Troco:/i)).toBeVisible();
    await expect(page.getByText(/28/i)).toBeVisible();
  });

  test('alterna canal para iFood, exibe métodos com taxas, card de cupom e recalcula preços', async ({ page }) => {
    await mockCaixaApi(page);
    await page.goto('/caixa', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Catálogo de Produtos' })).toBeVisible({ timeout: 15000 });

    // Adiciona Batata no Balcão (preço balcão: R$ 22.00)
    await page.getByRole('button', { name: /Batata Rústica Especial/i }).click();
    await expect(page.getByTestId('pos-cart-items').getByText(/22/i)).toBeVisible();

    // Alterna para canal iFood
    await page.getByRole('button', { name: '🛵 iFood' }).click();

    // Preço do item no carrinho deve ser recalculado para o preço iFood (R$ 26.00)
    await expect(page.getByTestId('pos-cart-items').getByText(/26/i)).toBeVisible();

    // Métodos iFood visíveis com taxas
    await expect(page.getByRole('button', { name: /iFood Online/i })).toBeVisible();
    await expect(page.getByText(/Taxa 33%/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iFood Entrega/i })).toBeVisible();

    // Card de subsídio de cupom da loja iFood visível
    await expect(page.getByText(/Cupom pago pela Loja/i)).toBeVisible();

    // Ativa checkbox de cupom
    const couponCheckbox = page.getByRole('checkbox');
    await couponCheckbox.check();

    // Input de valor do cupom deve aparecer com valor padrão ou pills
    await expect(page.getByLabel('Valor do cupom da loja')).toBeVisible();
    await expect(page.getByRole('button', { name: 'R$ 10' })).toBeVisible();

    // Resumo financeiro reflete a linha informativa do subsídio da loja
    await expect(page.getByText(/Subsídio Cupom Loja/i)).toBeVisible();
  });

  test('exibe botão de retorno à raiz do sistema e abre janela modal de navegação entre módulos', async ({ page }) => {
    await mockCaixaApi(page);
    await page.goto('/caixa');

    await expect(page.getByRole('heading', { name: 'Catálogo de Produtos' })).toBeVisible({ timeout: 10000 });

    // Botão Voltar à Central visível no cabeçalho
    const returnButton = page.getByRole('link', { name: /Voltar à Central/i });
    await expect(returnButton).toBeVisible();

    // Botão da Janela de Módulos (LayoutGrid)
    const modulesButton = page.getByTitle(/Janela de Módulos do Sistema/i);
    await expect(modulesButton).toBeVisible();

    // Clica para abrir a janela modal de módulos
    await modulesButton.click();

    // Modal aberto e acessível
    await expect(page.getByRole('dialog', { name: /Navegação do Sistema & Central de Módulos/i })).toBeVisible();

    // Tecla Escape fecha a janela modal
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Navegação do Sistema & Central de Módulos/i })).toBeHidden();
  });
});


test('desconto apresenta justificativa obrigatória no caixa', async ({ page }) => {
  await mockCaixaApi(page);
  await page.goto('/caixa');
  await page.getByRole('button', { name: /Batata Rústica Especial/i }).click();
  await page.getByPlaceholder('Ex: 5 ou 10%').fill('5');
  const reason = page.getByRole('textbox', { name: 'Justificativa do desconto' });
  await expect(reason).toBeVisible();
  await reason.fill('Compensação por atraso');
  await expect(reason).toHaveValue('Compensação por atraso');
});
