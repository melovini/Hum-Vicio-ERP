import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const {
  filterCardapioProducts,
  calculateRecipeMetrics,
  findMatchingInventoryItem,
  inferDefaultSubcategory,
  groupProductsBySubcategory,
  DEFAULT_SUBCATEGORIES_BY_CATEGORY,
} = createLoader()('src/lib/recipe-helpers.ts');

const {
  getSubcategoriesForCategory,
  addSubcategory,
  renameSubcategory,
  deleteSubcategory,
  moveSubcategory,
  purgeUnusedSubcategories,
} = createLoader()('src/lib/subcategory-store.ts');

const mockProducts = [
  {
    id: 'prod-1',
    name: 'X-Bacon Artesanal',
    category: 'lanche',
    price: 38.0,
    priceIfood: 45.0,
    isActive: true,
    recipe: [
      { ingredientId: 'inv-1', quantity: 1 },
      { ingredientId: 'inv-2', quantity: 0.15 },
    ],
  },
  {
    id: 'prod-2',
    name: 'Batata Rústica c/ Alecrim',
    category: 'porcao',
    price: 25.0,
    priceIfood: 30.0,
    isActive: true,
    recipe: [{ ingredientId: 'inv-3', quantity: 0.3 }],
  },
  {
    id: 'prod-3',
    name: 'Refrigerante Lata 350ml',
    category: 'bebida',
    price: 7.0,
    priceIfood: 9.0,
    isActive: false,
    recipe: [],
  },
  {
    id: 'prod-4',
    name: 'Smash Salad Duplo',
    category: 'lanche',
    subcategory: 'Smash Burgers',
    price: 32.0,
    priceIfood: 40.0,
    isActive: true,
    recipe: [],
  },
];

const mockInventory = [
  { id: 'inv-1', name: 'Pão de Brioche', category: 'Pães', unit: 'un', cost_per_unit: 2.0 },
  { id: 'inv-2', name: 'Bacon Defumado', category: 'Carnes', unit: 'kg', cost_per_unit: 40.0 },
  { id: 'inv-3', name: 'Batata Especial', category: 'Hortifruti', unit: 'kg', cost_per_unit: 0 },
];

test('filterCardapioProducts filtra por categoria, busca textual e visibilidade de inativos', () => {
  // Filtro por categoria
  const lanches = filterCardapioProducts(mockProducts, { category: 'lanche' });
  assert.equal(lanches.length, 2);
  assert.equal(lanches[0].id, 'prod-1');

  // Filtro por busca com acentuação
  const batatas = filterCardapioProducts(mockProducts, { search: 'rustica' });
  assert.equal(batatas.length, 1);
  assert.equal(batatas[0].id, 'prod-2');

  // Inativo oculto por padrão
  const bebidasAtivas = filterCardapioProducts(mockProducts, { category: 'bebida', showInactive: false });
  assert.equal(bebidasAtivas.length, 0);

  // Inativo exibido quando showInactive = true
  const bebidasComInativas = filterCardapioProducts(mockProducts, { category: 'bebida', showInactive: true });
  assert.equal(bebidasComInativas.length, 1);
});

test('filterCardapioProducts filtra por subcategoria', () => {
  const smashList = filterCardapioProducts(mockProducts, { subcategory: 'Smash Burgers' });
  assert.equal(smashList.length, 1);
  assert.equal(smashList[0].id, 'prod-4');

  const batataList = filterCardapioProducts(mockProducts, { subcategory: 'Batatas Fritas' });
  assert.equal(batataList.length, 1);
  assert.equal(batataList[0].id, 'prod-2');
});

test('inferDefaultSubcategory infere subcategorias corretas ou respeita a definida', () => {
  assert.equal(inferDefaultSubcategory({ name: 'Smash Simples', category: 'lanche' }), 'Smash Burgers');
  assert.equal(inferDefaultSubcategory({ name: 'Argentina Duplo', category: 'lanche' }), 'Linha Duplos');
  assert.equal(inferDefaultSubcategory({ name: 'Costela Especial', category: 'lanche' }), 'Hambúrgueres Especiais');
  assert.equal(inferDefaultSubcategory({ name: 'Hambúrguer Veggie', category: 'lanche' }), 'Vegetarianos');
  assert.equal(inferDefaultSubcategory({ name: 'Batata Cheddar', category: 'porcao' }), 'Batatas Fritas');
  assert.equal(inferDefaultSubcategory({ name: 'Anéis de Cebola 180g', category: 'porcao' }), 'Anéis de Cebola & Petiscos');
  assert.equal(inferDefaultSubcategory({ name: 'Coca Cola Lata', category: 'bebida' }), 'Refrigerantes');
  assert.equal(inferDefaultSubcategory({ name: 'Suco de Laranja', category: 'bebida' }), 'Sucos & Chás');
  // Se já tiver subcategoria definida explicitamente
  assert.equal(inferDefaultSubcategory({ name: 'Burger X', category: 'lanche', subcategory: 'Edição de Verão' }), 'Edição de Verão');
});

test('groupProductsBySubcategory agrupa os produtos em categorias hierárquicas', () => {
  const groups = groupProductsBySubcategory(mockProducts);
  assert.ok(groups.length >= 3);
  const smashGroup = groups.find(g => g.subcategory === 'Smash Burgers');
  assert.ok(smashGroup);
  assert.equal(smashGroup.products.length, 1);
});

test('calculateRecipeMetrics calcula CMV, margens e identifica insumos sem custo', () => {
  const costMap = {
    'inv-1': 2.0, // 1 un * 2.0 = 2.00
    'inv-2': 40.0, // 0.15 kg * 40.0 = 6.00
  };
  const getCost = (id) => costMap[id] || 0;

  const metrics = calculateRecipeMetrics(
    mockProducts[0].recipe,
    getCost,
    38.0, // Balcão
    45.0, // iFood
    30,   // CMV Alvo 30%
  );

  // Custo total: 2.00 + 6.00 = 8.00
  assert.equal(metrics.totalCost, 8.0);

  // CMV Balcão: (8 / 38) * 100 = 21.05% -> 21.1%
  assert.equal(metrics.cmvBalcao, 21.1);

  // CMV iFood: (8 / 45) * 100 = 17.77% -> 17.8%
  assert.equal(metrics.cmvIfood, 17.8);

  // Margem Balcão: 38 - 8 = 30.00
  assert.equal(metrics.marginBalcao, 30.0);

  // Margem iFood: 45 - 8 = 37.00
  assert.equal(metrics.marginIfood, 37.0);

  // Preço sugerido a 30% de CMV: 8 / 0.3 = 26.67
  assert.equal(metrics.suggestedPrice, 26.67);

  // Todos os insumos têm custo definido
  assert.equal(metrics.hasZeroCostIngredient, false);
  assert.equal(metrics.missingCostCount, 0);
});

test('calculateRecipeMetrics sinaliza insumo com custo zerado ou pendente', () => {
  const costMap = {
    'inv-3': 0, // Custo pendente
  };
  const getCost = (id) => costMap[id] || 0;

  const metrics = calculateRecipeMetrics(
    mockProducts[1].recipe,
    getCost,
    25.0,
    30.0,
    30,
  );

  assert.equal(metrics.totalCost, 0);
  assert.equal(metrics.hasZeroCostIngredient, true);
  assert.equal(metrics.missingCostCount, 1);
});

test('findMatchingInventoryItem associa nomes com tolerância a prefixos e sufixos', () => {
  const match = findMatchingInventoryItem('Adicional: Bacon no hambúrguer', undefined, mockInventory);
  assert.ok(match);
  assert.equal(match.id, 'inv-2');
});

test('getSubcategoriesForCategory retorna categorias padrão e respeita customizações', () => {
  const lanches = getSubcategoriesForCategory('lanche');
  assert.ok(lanches.length > 0);
  assert.ok(lanches.includes('Smash Burgers'));

  const comProduto = getSubcategoriesForCategory('lanche', [
    { category: 'lanche', subcategory: 'Edição Especial de Verão' }
  ]);
  assert.ok(comProduto.includes('Edição Especial de Verão'));
});

test('addSubcategory, renameSubcategory, moveSubcategory e deleteSubcategory gerenciam o catálogo', () => {
  // Adicionar
  const added = addSubcategory('lanche', 'Linha Teste Exclusiva');
  assert.ok(added.lanche.includes('Linha Teste Exclusiva'));

  // Renomear
  const renamed = renameSubcategory('lanche', 'Linha Teste Exclusiva', 'Linha Teste Renomeada');
  assert.ok(!renamed.lanche.includes('Linha Teste Exclusiva'));
  assert.ok(renamed.lanche.includes('Linha Teste Renomeada'));

  // Mover
  const idx = renamed.lanche.indexOf('Linha Teste Renomeada');
  assert.ok(idx >= 0);
  if (idx > 0) {
    const moved = moveSubcategory('lanche', idx, 'up');
    assert.equal(moved.lanche[idx - 1], 'Linha Teste Renomeada');
  }

  // Deletar
  const deleted = deleteSubcategory('lanche', 'Linha Teste Renomeada');
  assert.ok(!deleted.lanche.includes('Linha Teste Renomeada'));
});

test('renomeação atômica em produtos e reatribuição de categoria mantêm integridade hierárquica', () => {
  let products = [
    { id: 'p1', name: 'Burger Clássico', category: 'lanche', subcategory: 'Artesanais 180g', priceBalcao: 30, priceIfood: 35, recipe: [] },
    { id: 'p2', name: 'Burger Duplo', category: 'lanche', subcategory: 'Artesanais 180g', priceBalcao: 38, priceIfood: 44, recipe: [] },
  ];

  // 1. Simulação da atualização atômica de renomeação de subcategoria
  const oldSub = 'Artesanais 180g';
  const newSub = 'Artesanais Especiais 200g';
  products = products.map(p => {
    if (p.category === 'lanche' && (p.subcategory === oldSub || inferDefaultSubcategory(p) === oldSub)) {
      return { ...p, subcategory: newSub };
    }
    return p;
  });

  assert.equal(products[0].subcategory, newSub);
  assert.equal(products[1].subcategory, newSub);

  // 2. Agrupamento por subcategoria reflete imediatamente o novo nome
  const groups = groupProductsBySubcategory(products);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].subcategory, newSub);
  assert.equal(groups[0].products.length, 2);

  // 3. Alteração de categoria de um item existente (ex: lanche -> porção) com reset de subcategoria
  const targetProduct = products[0];
  const newCat = 'porcao';
  const porcaoSubs = getSubcategoriesForCategory(newCat);
  const updatedProduct = {
    ...targetProduct,
    category: newCat,
    subcategory: porcaoSubs.includes(targetProduct.subcategory) ? targetProduct.subcategory : porcaoSubs[0]
  };

  products = products.map(p => p.id === targetProduct.id ? updatedProduct : p);
  assert.equal(products[0].category, 'porcao');
  assert.equal(products[0].subcategory, porcaoSubs[0]);
  assert.notEqual(products[0].subcategory, newSub);

  // 4. Filtrar por porcao exibe o produto na subcategoria correta de porção
  const porcaoFiltered = filterCardapioProducts(products, { category: 'porcao' });
  assert.equal(porcaoFiltered.length, 1);
  assert.equal(porcaoFiltered[0].id, 'p1');
  assert.equal(porcaoFiltered[0].category, 'porcao');
});

test('calculateRecipeMetrics calcula corretamente mesmo com preços em formato brasileiro (vírgula)', () => {
  const getCost = () => 10;
  const recipe = [{ ingredientId: 'ing-1', quantity: 1 }];

  // Com ponto
  const mPonto = calculateRecipeMetrics(recipe, getCost, 30.0, 40.0);
  assert.equal(mPonto.totalCost, 10);
  assert.equal(mPonto.cmvBalcao, 33.3);

  // Com parsing de string contendo vírgula
  const rawBalcao = '30,00';
  const rawIfood = '40,00';
  const parsedBalcao = Number(rawBalcao.replace(',', '.'));
  const parsedIfood = Number(rawIfood.replace(',', '.'));
  const mVirgula = calculateRecipeMetrics(recipe, getCost, parsedBalcao, parsedIfood);
  assert.equal(mVirgula.totalCost, 10);
  assert.equal(mVirgula.cmvBalcao, 33.3);
  assert.equal(mVirgula.cmvIfood, 25.0);
});

test('deleteSubcategory com "todas" remove a subcategoria de qualquer categoria', () => {
  addSubcategory('lanche', 'Subcat Fantasma Global');
  addSubcategory('porcao', 'Subcat Fantasma Global');

  const beforeTodas = getSubcategoriesForCategory('todas');
  assert.ok(beforeTodas.includes('Subcat Fantasma Global'));

  deleteSubcategory('todas', 'Subcat Fantasma Global');

  const afterTodas = getSubcategoriesForCategory('todas');
  assert.ok(!afterTodas.includes('Subcat Fantasma Global'));
  assert.ok(!getSubcategoriesForCategory('lanche').includes('Subcat Fantasma Global'));
  assert.ok(!getSubcategoriesForCategory('porcao').includes('Subcat Fantasma Global'));
});

test('purgeUnusedSubcategories remove subcategorias não utilizadas mantendo apenas as ativas', () => {
  addSubcategory('lanche', 'Vazia 1');
  addSubcategory('porcao', 'Vazia 2');
  addSubcategory('lanche', 'Com Produto 1');

  const prods = [
    { category: 'lanche', subcategory: 'Com Produto 1' },
    { category: 'lanche', subcategory: 'Smash Burgers' },
  ];

  const result = purgeUnusedSubcategories(prods);
  assert.ok(result.countPurged >= 2);
  assert.ok(!result.updatedMap.lanche.includes('Vazia 1'));
  assert.ok(!result.updatedMap.porcao.includes('Vazia 2'));
  assert.ok(result.updatedMap.lanche.includes('Com Produto 1'));
});

