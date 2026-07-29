'use client';
import { LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function LogoutButton() {
  const pathname = usePathname();
  
  // Não mostrar o botão na tela de login
  if (pathname === '/login') return null;

  const handleLogout = () => {
    document.cookie = 'hum_vicio_role=; path=/; max-age=0'; // Deleta o cookie
    window.location.href = '/login';
  };

  return (
    <button 
      onClick={handleLogout}
      className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-500 text-white p-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all z-50 flex items-center justify-center group"
      title="Sair do Sistema"
    >
      <LogOut size={24} />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-2 font-bold">
        Trocar Usuário / Sair
      </span>
    </button>
  );
}
