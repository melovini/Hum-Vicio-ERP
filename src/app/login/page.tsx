'use client';
import { useState } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await loginAction(pin);
      if (res.success && res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        setError(res.error || 'Credencial inválida.');
        setLoading(false);
      }
    } catch {
      setError('Falha de conexão com o servidor.');
      setLoading(false);
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
          <p className="text-slate-400 mb-8 text-sm">
            Digite sua credencial de acesso para entrar no módulo operacional.
          </p>
          
          <form onSubmit={handleLogin} className="w-full">
            <input
              type="password"
              placeholder="Senha de Acesso"
              value={pin}
              disabled={loading}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-center text-2xl tracking-widest outline-none focus:border-blue-500 mb-4 transition-all disabled:opacity-50"
              autoFocus
              required
            />
            {error && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading || !pin.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  Entrar no Sistema <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-600">
            🔒 Autenticação protegida por criptografia de ponta a ponta.
          </p>
        </div>
      </div>
    </div>
  );
}
