import { CashClosingDetails } from './types';

export interface DenominationCounts {
  bill100: number;
  bill50: number;
  bill20: number;
  bill10: number;
  bill5: number;
  bill2: number;
  coin1: number;
  coin050: number;
  coin025: number;
  coin010: number;
  coin005: number;
}

export const INITIAL_DENOMINATIONS: DenominationCounts = {
  bill100: 0,
  bill50: 0,
  bill20: 0,
  bill10: 0,
  bill5: 0,
  bill2: 0,
  coin1: 0,
  coin050: 0,
  coin025: 0,
  coin010: 0,
  coin005: 0,
};

export function calculateDenominationsTotal(counts: DenominationCounts): number {
  const sum = 
    (counts.bill100 || 0) * 100 +
    (counts.bill50 || 0) * 50 +
    (counts.bill20 || 0) * 20 +
    (counts.bill10 || 0) * 10 +
    (counts.bill5 || 0) * 5 +
    (counts.bill2 || 0) * 2 +
    (counts.coin1 || 0) * 1 +
    (counts.coin050 || 0) * 0.50 +
    (counts.coin025 || 0) * 0.25 +
    (counts.coin010 || 0) * 0.10 +
    (counts.coin005 || 0) * 0.05;
  return Number(sum.toFixed(2));
}

export function computeCashClosingVariances(params: {
  countedCash: number;
  expectedCash: number;
  countedDebito: number;
  expectedDebito: number;
  countedCredito: number;
  expectedCredito: number;
  countedPix: number;
  expectedPix: number;
  notes?: string;
}): CashClosingDetails {
  const varianceCash = Number((params.countedCash - params.expectedCash).toFixed(2));
  const varianceDebito = Number((params.countedDebito - params.expectedDebito).toFixed(2));
  const varianceCredito = Number((params.countedCredito - params.expectedCredito).toFixed(2));
  const variancePix = Number((params.countedPix - params.expectedPix).toFixed(2));

  const countedTotal = Number((params.countedCash + params.countedDebito + params.countedCredito + params.countedPix).toFixed(2));
  const expectedTotal = Number((params.expectedCash + params.expectedDebito + params.expectedCredito + params.expectedPix).toFixed(2));
  const varianceTotal = Number((countedTotal - expectedTotal).toFixed(2));

  return {
    countedCash: params.countedCash,
    expectedCash: params.expectedCash,
    varianceCash,
    countedDebito: params.countedDebito,
    expectedDebito: params.expectedDebito,
    varianceDebito,
    countedCredito: params.countedCredito,
    expectedCredito: params.expectedCredito,
    varianceCredito,
    countedPix: params.countedPix,
    expectedPix: params.expectedPix,
    variancePix,
    countedTotal,
    expectedTotal,
    varianceTotal,
    notes: params.notes,
  };
}
