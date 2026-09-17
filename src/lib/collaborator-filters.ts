import type { Collaborator, CollaboratorRole } from './collaborators';

export interface CollaboratorFilterOptions {
  role?: 'todos' | CollaboratorRole;
  searchQuery?: string;
  status?: 'todos' | 'ativos' | 'inativos';
}

export interface CollaboratorKpis {
  total: number;
  ativos: number;
  inativos: number;
  caixas: number;
  cozinha: number;
  gerentes: number;
}

export function filterCollaborators(
  collaborators: Collaborator[],
  options: CollaboratorFilterOptions = {},
): Collaborator[] {
  const { role = 'todos', searchQuery = '', status = 'todos' } = options;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return collaborators.filter((c) => {
    // Filtro de Papel
    if (role !== 'todos' && c.role !== role) {
      return false;
    }

    // Filtro de Status Ativo/Inativo
    if (status === 'ativos' && !c.isActive) {
      return false;
    }
    if (status === 'inativos' && c.isActive) {
      return false;
    }

    // Filtro Textual (nome, telefone ou cargo)
    if (normalizedQuery) {
      const nameMatch = c.name.toLowerCase().includes(normalizedQuery);
      const phoneMatch = Boolean(c.phone && c.phone.includes(normalizedQuery));
      const roleMatch = c.role.toLowerCase().includes(normalizedQuery);
      if (!nameMatch && !phoneMatch && !roleMatch) {
        return false;
      }
    }

    return true;
  });
}

export function computeCollaboratorKpis(collaborators: Collaborator[]): CollaboratorKpis {
  const total = collaborators.length;
  let ativos = 0;
  let inativos = 0;
  let caixas = 0;
  let cozinha = 0;
  let gerentes = 0;

  for (const c of collaborators) {
    if (c.isActive) {
      ativos += 1;
      if (c.role === 'caixa') caixas += 1;
      else if (c.role === 'cozinha') cozinha += 1;
      else if (c.role === 'gerente' || c.role === 'admin') gerentes += 1;
    } else {
      inativos += 1;
    }
  }

  return { total, ativos, inativos, caixas, cozinha, gerentes };
}

export function getRoleLabel(role: CollaboratorRole): string {
  switch (role) {
    case 'admin':
      return 'Administrador Master';
    case 'gerente':
      return 'Gerente Operacional';
    case 'caixa':
      return 'Operador de Caixa';
    case 'cozinha':
      return 'Equipe Cozinha';
    default:
      return 'Colaborador';
  }
}

export function getRoleBadgeVariant(role: CollaboratorRole): 'danger' | 'warning' | 'info' | 'success' | 'neutral' {
  switch (role) {
    case 'admin':
      return 'danger';
    case 'gerente':
      return 'warning';
    case 'caixa':
      return 'info';
    case 'cozinha':
      return 'success';
    default:
      return 'neutral';
  }
}
