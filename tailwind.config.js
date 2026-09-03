/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          ground: '#090A0F',     // Fundo base profundo da aplicação
          card: '#12141C',       // Superfície de cards, modais e containers
          elevated: '#1A1D27',   // Menus suspensos, dropdowns e popovers
          border: '#242838',     // Bordas sutis e separadores estruturais
          borderHover: '#373D54'
        },
        brand: {
          primary: '#F97316',    // Laranja queimado industrial/moderno (ações primárias e destaque)
          primaryHover: '#EA580C',
          accent: '#38BDF8'      // Azul técnico para dados analíticos e métricas
        },
        status: {
          free: '#10B981',       // Emerald: Mesa/Item Livre ou Sucesso
          occupied: '#F59E0B',   // Âmbar: Em consumo / Aberta
          partial: '#8B5CF6',    // Roxo: Parcialmente paga / Em trânsito
          paid: '#06B6D4',       // Ciano: Paga / Aguardando desocupação
          danger: '#EF4444',     // Vermelho: Sangrias, cancelamentos com autorização, atrasos
          neutral: '#64748B'     // Slate: Arquivado / Guardado / Inativo
        }
      }
    }
  },
  plugins: [],
};
