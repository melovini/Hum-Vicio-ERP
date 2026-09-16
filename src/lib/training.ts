/**
 * Serviço de Gerenciamento do Ambiente de Treinamento (Sandbox)
 * Frente 4.4 - Treinamento de Operadores
 *
 * Permite que atendentes e chapeiros pratiquem fluxos completos
 * (vendas, troco, adicionais, KDS, cancelamentos e fechamento)
 * sem afetar estoque real, caixa financeiro ou emitir notas fiscais.
 */

import { Sale, CashSession, CashMovement } from './store';

export interface TrainingExercise {
  id: string;
  title: string;
  category: 'caixa' | 'cozinha' | 'fechamento';
  difficulty: 'iniciante' | 'intermediario' | 'avancado';
  description: string;
  objective: string;
  steps: string[];
  expectedOutcome: string;
  completed?: boolean;
}

export const TRAINING_EXERCISES: TrainingExercise[] = [
  {
    id: 'ex-1',
    title: '1. Venda Balcão com Troco em Dinheiro',
    category: 'caixa',
    difficulty: 'iniciante',
    description: 'Aprenda a lançar um hambúrguer simples no balcão, receber cédula de valor maior e calcular o troco correto.',
    objective: 'Registrar uma venda em dinheiro e conferir o troco sem erros.',
    steps: [
      'Selecione 1x "Burger Brasil" na aba de itens.',
      'Avance para a etapa 2 (Atendimento) e confirme a modalidade "Mesa / Balcão".',
      'Avance para a etapa 3 (Pagamento) e selecione o método "Dinheiro".',
      'Na calculadora de troco, clique no atalho "R$ 50" (ou digite 50).',
      'Confira o valor do troco calculado e clique em "Concluir Venda".'
    ],
    expectedOutcome: 'Venda aprovada, modal com comanda #XXXX e exibição clara do troco a devolver.'
  },
  {
    id: 'ex-2',
    title: '2. Pedido Delivery com Taxa e Observação',
    category: 'caixa',
    difficulty: 'intermediario',
    description: 'Registre um pedido de entrega com endereço residencial, taxa de motoboy e observação especial para a chapa.',
    objective: 'Cadastrar endereço correto, taxa de entrega e observação em caixa alta.',
    steps: [
      'Adicione 1x "Burger Argentina" com adicional de "Bacon Extra".',
      'No campo de observação do item, digite: "PONTO BEM PASSADO, SEM CEBOLA".',
      'Na etapa de atendimento, mude para "Delivery".',
      'Digite o nome do cliente "Maria Silva", telefone "11999998888" e endereço.',
      'Selecione a taxa de entrega rápida de "R$ 8,00".',
      'Escolha a forma de pagamento "Cartão de Crédito" e conclua.'
    ],
    expectedOutcome: 'Pedido criado com taxa somada ao total e observação destacada para a cozinha.'
  },
  {
    id: 'ex-3',
    title: '3. Alteração de Pedido em Preparo no KDS',
    category: 'cozinha',
    difficulty: 'avancado',
    description: 'Pratique a correção de um pedido enquanto o lanche já está no fogo e confirme a ciência da equipe na cozinha.',
    objective: 'Identificar o diff de alteração na chapa e dar ciência sem perder o preparo.',
    steps: [
      'Lance um pedido de 1x "Burger Wakanda" e envie para a "Chapa Ativa".',
      'Abra a tela de Cozinha (KDS) e verifique o card na chapa.',
      'Retorne ao Caixa, abra o Histórico, localize o pedido e clique em "Reabrir para Edição".',
      'Adicione mais 1x refrigerante ou altere o item e confirme a alteração.',
      'Volte à Cozinha: observe o badge "⚠️ ALTERAÇÃO NO PEDIDO (DIFF)" e clique em "[✓ CIENTE DA ALTERAÇÃO]".'
    ],
    expectedOutcome: 'A cozinha reconhece o que foi adicionado/removido sem queimar o hambúrguer.'
  },
  {
    id: 'ex-4',
    title: '4. Cancelamento Seguro com Supervisor',
    category: 'caixa',
    difficulty: 'intermediario',
    description: 'Simule a desistência de um cliente antes da produção com justificativa e senha de supervisão.',
    objective: 'Cancelar uma venda registrando motivo formal na auditoria.',
    steps: [
      'No Caixa, acesse a aba "Histórico de Vendas".',
      'Clique no botão vermelho de cancelamento da venda.',
      'Selecione o motivo: "Desistência do cliente antes do preparo".',
      'Digite a senha de supervisor (ou use o ambiente de treino).',
      'Confirme o cancelamento.'
    ],
    expectedOutcome: 'Status da venda muda para "Cancelado" e o item não é enviado para a chapa.'
  },
  {
    id: 'ex-5',
    title: '5. Sangria de Gaveta e Fechamento de Turno',
    category: 'fechamento',
    difficulty: 'avancado',
    description: 'Pratique a retirada periódica de dinheiro (sangria) para segurança e faça o fechamento cego do caixa.',
    objective: 'Retirar excesso de dinheiro da gaveta e conferir valores no encerramento.',
    steps: [
      'No Caixa, acesse a aba "Sangria / Suprimento".',
      'Lance uma sangria de "R$ 150,00" com o motivo "Depósito no cofre de segurança".',
      'Ao final do treino, clique em "Fechar Caixa".',
      'Preencha a contagem das cédulas na calculadora de gaveta.',
      'Revise a conferência cega e confirme o fechamento de turno.'
    ],
    expectedOutcome: 'Relatório de fechamento discriminado gerado com sucesso sem diferenças.'
  }
];

const TRAINING_MODE_KEY = 'hum_vicio_training_mode_active';
const TRAINING_SALES_KEY = 'hum_vicio_training_sales';
const TRAINING_CASH_KEY = 'hum_vicio_training_cash_session';
const TRAINING_MOVEMENTS_KEY = 'hum_vicio_training_movements';
const TRAINING_COMPLETED_EXERCISES_KEY = 'hum_vicio_training_completed_exercises';

/** Verifica se o Modo Treinamento está ativo */
export function isTrainingModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(TRAINING_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Ativa ou desativa o Modo Treinamento */
export function setTrainingModeActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      localStorage.setItem(TRAINING_MODE_KEY, 'true');
      // Se não houver sessão de treino, inicializa uma padrão
      if (!localStorage.getItem(TRAINING_CASH_KEY)) {
        initializeTrainingCashSession();
      }
    } else {
      localStorage.setItem(TRAINING_MODE_KEY, 'false');
    }
    // Dispara evento para sincronizar todos os componentes abertos
    window.dispatchEvent(new CustomEvent('hum_vicio_training_mode_changed', { detail: { active } }));
  } catch (err) {
    console.error('Erro ao alternar modo treinamento:', err);
  }
}

/** Inicializa uma sessão de caixa de treino com R$ 100 de fundo */
export function initializeTrainingCashSession(): CashSession {
  const session: CashSession = {
    id: `training-session-${Date.now()}`,
    openedAt: new Date().toISOString(),
    openedBy: 'Operador em Treinamento',
    initialAmount: 100.0,
    status: 'open'
  };
  try {
    localStorage.setItem(TRAINING_CASH_KEY, JSON.stringify(session));
  } catch {}
  return session;
}

/** Obtém a sessão de caixa de treino */
export function getTrainingCashSession(): CashSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRAINING_CASH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Salva a sessão de caixa de treino */
export function saveTrainingCashSession(session: CashSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      localStorage.setItem(TRAINING_CASH_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(TRAINING_CASH_KEY);
    }
  } catch {}
}

/** Obtém as vendas do ambiente de treino */
export function getTrainingSales(): Sale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRAINING_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Salva vendas do ambiente de treino */
export function saveTrainingSales(sales: Sale[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRAINING_SALES_KEY, JSON.stringify(sales));
  } catch {}
}

/** Obtém movimentos de caixa do ambiente de treino */
export function getTrainingMovements(): CashMovement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRAINING_MOVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Salva movimentos de caixa do ambiente de treino */
export function saveTrainingMovements(movements: CashMovement[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRAINING_MOVEMENTS_KEY, JSON.stringify(movements));
  } catch {}
}

/** Reinicia todos os dados de treinamento para começar do zero */
export function resetTrainingSandbox(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRAINING_SALES_KEY);
    localStorage.removeItem(TRAINING_MOVEMENTS_KEY);
    initializeTrainingCashSession();
    window.dispatchEvent(new CustomEvent('hum_vicio_training_reset'));
  } catch (err) {
    console.error('Erro ao reiniciar sandbox de treinamento:', err);
  }
}

/** Obtém a lista de exercícios com o status de conclusão do operador */
export function getTrainingExercisesWithStatus(): TrainingExercise[] {
  if (typeof window === 'undefined') return TRAINING_EXERCISES;
  try {
    const raw = localStorage.getItem(TRAINING_COMPLETED_EXERCISES_KEY);
    const completedIds: string[] = raw ? JSON.parse(raw) : [];
    return TRAINING_EXERCISES.map(ex => ({
      ...ex,
      completed: completedIds.includes(ex.id)
    }));
  } catch {
    return TRAINING_EXERCISES;
  }
}

/** Marca um exercício como concluído ou pendente */
export function toggleExerciseCompletion(exerciseId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(TRAINING_COMPLETED_EXERCISES_KEY);
    const completedIds: string[] = raw ? JSON.parse(raw) : [];
    const index = completedIds.indexOf(exerciseId);
    if (index >= 0) {
      completedIds.splice(index, 1);
    } else {
      completedIds.push(exerciseId);
    }
    localStorage.setItem(TRAINING_COMPLETED_EXERCISES_KEY, JSON.stringify(completedIds));
    window.dispatchEvent(new CustomEvent('hum_vicio_training_exercises_updated'));
  } catch {}
}
