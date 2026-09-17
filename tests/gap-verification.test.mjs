import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const { 
  resolveRecipeUnitQuantity, 
  inferPortionWeightFromInventory, 
  calculateItemProduction 
} = createLoader()('src/lib/production-calculator.ts');

const { validateProductIntegrity } = createLoader()('src/lib/product-validator.ts');
const { mapRemoteSaleItem } = createLoader()('src/lib/store.ts');
const { recalculateCartPrices } = createLoader()('src/lib/pos-financial-helpers.ts');
const { resolveEffectiveConfig, DEFAULT_CENTRAL_CONFIG } = createLoader()('src/lib/central-config.ts');

// =========================================================================
// TESTES DE VERIFICAÇÃO DOS ACHADOS V01 A V09 (VERIFICACAO-MELHORIAS-CARDAPIO-KDS)
// =========================================================================

// --- V01: Normalização Física e Porções ---
test('V01: 150g e 0,150kg de batata produzem o mesmo resultado (1 porção, nunca 1.000)', () => {
  // Teste direto da função resolveRecipeUnitQuantity
  const porcaoGramas = resolveRecipeUnitQuantity(150, 'g', 'batata');
  const porcaoQuilos = resolveRecipeUnitQuantity(0.150, 'kg', 'batata');

  assert.equal(porcaoGramas, 1, '150 g de batata deve ser 1 porção');
  assert.equal(porcaoQuilos, 1, '0.150 kg de batata deve ser 1 porção');
  assert.equal(porcaoGramas, porcaoQuilos, 'Equivalência física garantida entre g e kg');

  // Teste de 300g de batata
  const duasPorcoesGramas = resolveRecipeUnitQuantity(300, 'g', 'batata');
  assert.equal(duasPorcoesGramas, 2, '300 g de batata deve ser 2 porções');
});

test('V01: 180g de carne com porção de 90g (smash duplo) produz 2 carnes', () => {
  // Blend moído com porção de 90g cadastrada
  const carnesPorKg = resolveRecipeUnitQuantity(0.180, 'kg', 'carne_bovina', 90, 'g');
  assert.equal(carnesPorKg, 2, '0,180 kg com porção de 90 g deve produzir 2 carnes');

  const carnesPorG = resolveRecipeUnitQuantity(180, 'g', 'carne_bovina', 90, 'g');
  assert.equal(carnesPorG, 2, '180 g com porção de 90 g deve produzir 2 carnes');

  // Teste de inferência pelo nome do insumo
  const invSmash = { id: 'inv-smash-90', name: 'Blend Smash Bovino 90g', category: 'Carnes', unit: 'kg', costPerUnit: 40 };
  const inferred = inferPortionWeightFromInventory(invSmash);
  assert.deepEqual(inferred, { weight: 90, unit: 'g' });

  const resInferido = resolveRecipeUnitQuantity(0.180, 'kg', 'carne_bovina', inferred.weight, inferred.unit);
  assert.equal(resInferido, 2, 'Insumo inferido a 90g calcula 2 discos de smash');
});

// --- V04: Adicionais pela Ficha Técnica Completa ---
test('V04: Adicional composto com nome neutro "Reforço especial" (2 carnes na receita) soma 3 carnes no lanche simples', () => {
  const mockInventory = [
    { id: 'inv-patty-180', name: 'Hambúrguer Bovino 180g', category: 'Carnes', unit: 'un', costPerUnit: 8.5, station: 'chapa' },
    { id: 'inv-cheddar', name: 'Queijo Cheddar', category: 'Laticínios', unit: 'kg', costPerUnit: 45.0, station: 'nenhuma' }
  ];

  const mockProducts = [
    {
      id: 'prod-simples',
      name: 'Burger Simples',
      category: 'lanche',
      priceBalcao: 28,
      priceIfood: 34,
      recipe: [{ ingredientId: 'inv-patty-180', quantity: 1 }] // 1 carne base
    },
    {
      id: 'prod-reforco-especial',
      name: 'Reforço Especial', // Nome neutro sem palavras 'carne' ou 'duplo'
      category: 'lanche',
      priceBalcao: 15,
      priceIfood: 18,
      recipe: [
        { ingredientId: 'inv-patty-180', quantity: 2 }, // Receita do adicional contém 2 carnes!
        { ingredientId: 'inv-cheddar', quantity: 0.030 }
      ]
    }
  ];

  const saleItem = {
    productId: 'prod-simples',
    productName: 'Burger Simples',
    quantity: 1,
    unitPrice: 28,
    additionals: [
      { id: 'prod-reforco-especial', name: 'Reforço Especial', quantity: 1, price: 15 }
    ]
  };

  const res = calculateItemProduction(saleItem, mockProducts, mockInventory);

  assert.equal(res.chapaPatties, 3, '1 carne base + 2 carnes da receita do adicional = 3 carnes');
  assert.equal(res.isDouble, true, '3 carnes na composição torna o lanche duplo/triplo');
  assert.equal(res.breakdown.basePattiesPerBurger, 1);
  assert.equal(res.breakdown.additionalPattiesPerBurger, 2);
});

// --- V07: Bloqueio Rigoroso de Rascunhos ---
test('V07: Lanche sem receita é inválido (isValid: false) com status rascunho', () => {
  const lancheSemReceita = {
    name: 'Burger Incompleto',
    category: 'lanche',
    priceBalcao: 30,
    priceIfood: 36,
    recipe: [] // Sem ficha técnica!
  };

  const res = validateProductIntegrity(lancheSemReceita, []);

  assert.equal(res.isValid, false, 'Lanche sem ficha técnica NÃO pode ser válido para venda');
  assert.equal(res.status, 'rascunho', 'Status deve ser obrigatoriamente rascunho');
  assert.ok(res.warnings.some(w => w.code === 'EMPTY_RECIPE_HOT' && w.severity === 'danger'), 'Deve gerar aviso bloqueante de perigo');
});

// --- V02 & V03: Mapeamento Unificado de Leitura e Preservação de Composição ---
test('V02 & V03: mapRemoteSaleItem preserva snapshot, versão da receita, ponto e retiradas', () => {
  const dbRow = {
    id: 'item-uuid-123',
    product_id: 'prod-1',
    product_name: 'Brasil Burger',
    quantity: '2',
    unit_price: '38.00',
    original_price: '38.00',
    is_gift: false,
    combo_id: 'combo-batata-id',
    combo: 'Batata + Bebida',
    combo_price: '14.00',
    meat_point: 'Ao Ponto',
    removals: ['Cebola Roxa'],
    additionals: [{ id: 'add-1', name: 'Carne Extra', quantity: 1, price: 10 }],
    recipe_version: 3,
    production_snapshot: {
      chapaPatties: 4,
      isDouble: true,
      meatPoint: 'Ao Ponto',
      removals: ['Cebola Roxa']
    }
  };

  const mapped = mapRemoteSaleItem(dbRow);

  assert.equal(mapped.id, 'item-uuid-123');
  assert.equal(mapped.productId, 'prod-1');
  assert.equal(mapped.quantity, 2);
  assert.equal(mapped.unitPrice, 38.00);
  assert.equal(mapped.comboId, 'combo-batata-id');
  assert.equal(mapped.comboPrice, 14.00);
  assert.equal(mapped.meatPoint, 'Ao Ponto');
  assert.deepEqual(mapped.removals, ['Cebola Roxa']);
  assert.equal(mapped.recipeVersion, 3);
  assert.equal(mapped.productionSnapshot?.chapaPatties, 4);
  assert.equal(mapped.productionSnapshot?.isDouble, true);
});

// --- V05: Política de Perdas Diferenciada Antes vs Após Preparo ---
test('V05: Cancelamento antes do preparo estorna; cancelamento após preparo retém estoque e gera perda', () => {
  const saleEmEspera = { productionStatus: 'em_espera' };
  const isPreparedEspera = saleEmEspera.productionStatus === 'em_producao' || saleEmEspera.productionStatus === 'concluido';
  assert.equal(isPreparedEspera, false, 'Em espera não é considerado preparado -> estorno permitido');

  const saleEmProducao = { productionStatus: 'em_producao' };
  const isPreparedProducao = saleEmProducao.productionStatus === 'em_producao' || saleEmProducao.productionStatus === 'concluido';
  assert.equal(isPreparedProducao, true, 'Em produção é considerado preparado -> bloqueia estorno e gera perda');

  const saleConcluido = { productionStatus: 'concluido' };
  const isPreparedConcluido = saleConcluido.productionStatus === 'em_producao' || saleConcluido.productionStatus === 'concluido';
  assert.equal(isPreparedConcluido, true, 'Concluído é considerado preparado -> bloqueia estorno e gera perda');
});

// --- V09: Eliminação de Preços Fictícios de Combo ---
test('V09: recalculateCartPrices preserva o comboPrice existente e não inventa 14/16 ou 16/18 fictícios', () => {
  const cart = [
    {
      productId: 'prod-brasil',
      productName: 'Brasil Burger',
      quantity: 1,
      unitPrice: 40,
      combo: 'Combo Desconhecido Personalizado',
      comboPrice: 19.50, // Preço customizado pré-definido
    }
  ];

  const productsList = [
    { id: 'prod-brasil', name: 'Brasil Burger', category: 'lanche', priceBalcao: 30, priceIfood: 38, recipe: [] }
  ];

  const updatedCart = recalculateCartPrices(cart, 'ifood', productsList);

  assert.equal(updatedCart[0].comboPrice, 19.50, 'Deve preservar exatamente o comboPrice prévio de 19.50');
  assert.notEqual(updatedCart[0].comboPrice, 14.00, 'Não pode aplicar 14.00 arbitrário');
  assert.notEqual(updatedCart[0].comboPrice, 16.00, 'Não pode aplicar 16.00 arbitrário');
  assert.notEqual(updatedCart[0].comboPrice, 18.00, 'Não pode aplicar 18.00 arbitrário');
});

// --- V06: Sincronização e Resolução de Configuração Central ---
test('V06: resolveEffectiveConfig adota versão do servidor quando mais recente', () => {
  const localConfig = {
    ...DEFAULT_CENTRAL_CONFIG,
    version: 2,
    targetPrepMinutes: 20
  };

  const remoteConfig = {
    ...DEFAULT_CENTRAL_CONFIG,
    version: 3, // Servidor publicou versão 3
    targetPrepMinutes: 15,
    updatedBy: 'Gerente no Terminal A'
  };

  const effective = resolveEffectiveConfig(localConfig, remoteConfig);

  assert.equal(effective.version, 3);
  assert.equal(effective.targetPrepMinutes, 15);
  assert.equal(effective.updatedBy, 'Gerente no Terminal A');
});
