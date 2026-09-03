'use client';
import { LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';
import { useState } from 'react';

export default function LogoutButton() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  
  // Não mostrar o botão na tela de login
  if (pathname === '/login') return null;

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    // Remove cookie no cliente por compatibilidade e chama encerramento seguro no servidor
    document.cookie = 'hum_vicio_role=; path=/; max-age=0';
    document.cookie = 'hum_vicio_session=; path=/; max-age=0';
    await logoutAction();
  };

  return (
    <button 
      onClick={handleLogout}
      disabled={loading}
      className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white p-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all z-50 flex items-center justify-center group cursor-pointer"
      title="Sair do Sistema"
    >
      <LogOut size={24} />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-2 font-bold">
        {loading ? 'Encerrando...' : 'Trocar Usuário / Sair'}
      </span>
    </button>
  );
}
