'use client';
import React from 'react';
import MapaMesasCanvas from '@/components/MapaMesasCanvas';
import { SessaoCaixaSalao, SalaoMesaInstancia } from '@/lib/mesas';

interface PosMesasTabProps {
  floorSession: SessaoCaixaSalao | null;
  onUpdateSession: (session: SessaoCaixaSalao | null) => void;
  onSelectTableForOrder: (mesa: SalaoMesaInstancia) => void;
  operatorName: string;
}

export default function PosMesasTab({
  floorSession,
  onUpdateSession,
  onSelectTableForOrder,
  operatorName,
}: PosMesasTabProps) {
  if (!floorSession) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
        <p className="font-semibold text-sm">Nenhuma sessão de salão ativa no momento.</p>
        <p className="text-xs text-slate-500 mt-1">Abra o turno de caixa informando um layout de salão para interagir com o mapa de mesas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MapaMesasCanvas
        floorSession={floorSession}
        onUpdateSession={onUpdateSession}
        onSelectTableForOrder={onSelectTableForOrder}
        operatorName={operatorName}
      />
    </div>
  );
}
