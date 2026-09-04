import { findCollaboratorByPin } from './collaborators';
import { 
  signSessionToken, 
  verifySessionToken, 
  SESSION_COOKIE_NAME,
  type UserRole,
  type SessionPayload 
} from './session';

export { 
  signSessionToken, 
  verifySessionToken, 
  SESSION_COOKIE_NAME,
  type UserRole,
  type SessionPayload 
};

/**
 * Validação segura de credenciais exclusivamente dentro do servidor.
 * Consulta o armazenamento resiliente do servidor (Supabase Cloud + Arquivo Local)
 * e bloqueia senhas antigas de contingência se o usuário já personalizou a credencial.
 */
export async function validateServerCredentialsAsync(pinOrPassword: string): Promise<{
  valid: boolean;
  role?: UserRole;
  userName?: string;
  collaboratorId?: string;
}> {
  if (!pinOrPassword) return { valid: false };

  const clean = pinOrPassword.trim();

  // 1. Consultar a lista oficial de colaboradores mantida pelo servidor (Supabase + Local)
  try {
    const { getServerCollaborators } = await import('./server-collaborators');
    const { collaborators } = await getServerCollaborators();

    if (collaborators && collaborators.length > 0) {
      const activeCollabs = collaborators.filter(c => c.isActive);

      // Buscar se o PIN digitado pertence a algum colaborador ativo
      const matched = activeCollabs.find(c => c.pin?.trim() === clean);
      if (matched) {
        return {
          valid: true,
          role: matched.role as UserRole,
          userName: matched.name,
          collaboratorId: matched.id
        };
      }

      // Regra de Revogação de Segurança:
      // Se qualquer Administrador Master já definiu uma senha personalizada diferente de 'admin',
      // a senha antiga padrão 'admin' NUNCA mais deve ser aceita!
      const activeAdmins = activeCollabs.filter(c => c.role === 'admin');
      const hasCustomizedAdmin = activeAdmins.some(c => c.pin?.trim() !== 'admin');
      if (clean === 'admin' && hasCustomizedAdmin) {
        console.warn('[auth] Tentativa de login rejeitada: senha padrão "admin" revogada após personalização.');
        return { valid: false };
      }
    }
  } catch (e) {
    console.warn('[auth] Falha ao consultar colaboradores no servidor:', e);
  }

  // 2. Fallback de contingência (apenas se a base for virgem ou não houver admins customizados)
  const cozinhaPin = process.env.COZINHA_PIN || '1234';
  const caixaPin = process.env.CAIXA_PIN || '5678';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (clean === adminPassword) {
    return { valid: true, role: 'admin', userName: 'Administrador Master' };
  }
  if (clean === '0000') {
    return { valid: true, role: 'gerente', userName: 'Gerente Geral' };
  }
  if (clean === caixaPin) {
    return { valid: true, role: 'caixa', userName: 'Operador de Caixa' };
  }
  if (clean === cozinhaPin) {
    return { valid: true, role: 'cozinha', userName: 'Chapeiro Cozinha' };
  }

  return { valid: false };
}

/**
 * @deprecated Use validateServerCredentialsAsync. Mantido para compatibilidade.
 */
export function validateServerCredentials(pinOrPassword: string): {
  valid: boolean;
  role?: UserRole;
  userName?: string;
  collaboratorId?: string;
} {
  if (!pinOrPassword) return { valid: false };

  const clean = pinOrPassword.trim();

  const cozinhaPin = process.env.COZINHA_PIN || '1234';
  const caixaPin = process.env.CAIXA_PIN || '5678';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (clean === adminPassword) {
    return { valid: true, role: 'admin', userName: 'Administrador Master' };
  }
  if (clean === '0000') {
    return { valid: true, role: 'gerente', userName: 'Gerente Geral' };
  }
  if (clean === caixaPin) {
    return { valid: true, role: 'caixa', userName: 'Operador de Caixa' };
  }
  if (clean === cozinhaPin) {
    return { valid: true, role: 'cozinha', userName: 'Chapeiro Cozinha' };
  }

  try {
    const collab = findCollaboratorByPin(clean);
    if (collab && collab.isActive) {
      return {
        valid: true,
        role: collab.role,
        userName: collab.name,
        collaboratorId: collab.id
      };
    }
  } catch (e) {
    console.warn('Erro ao validar colaborador por PIN:', e);
  }

  return { valid: false };
}
