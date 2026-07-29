'use client';
import { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sistema simples de senhas para o MVP
    let role = '';
    if (pin === '1234') role = 'cozinha';
    else if (pin === '5678') role = 'caixa';
    else if (pin === 'admin') role = 'admin';
    
    if (role) {
      document.cookie = `hum_vicio_role=${role}; path=/; max-age=86400`; // 1 dia
      window.location.href = role === 'admin' ? '/' : `/${role}`;
    } else {
      setError('Senha incorreta.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/20 blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Acesso Restrito</h1>
          <p className="text-slate-400 mb-8">Digite sua senha para acessar o módulo correspondente.</p>
          
          <form onSubmit={handleLogin} className="w-full">
            <input
              type="password"
              placeholder="Senha de Acesso"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-center text-2xl tracking-widest outline-none focus:border-blue-500 mb-4 transition-all"
            />
            {error && <p className="text-red-500 text-sm font-bold mb-4">{error}</p>}
            
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all">
              Entrar no Sistema <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
