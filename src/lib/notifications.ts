export type SecurityAlertType = 
  | 'CANCELAMENTO_VENDA' 
  | 'SANGRIA' 
  | 'BRINDE_OU_DESCONTO' 
  | 'TETO_GAVETA_EXCEDIDO'
  | 'TESTE_SISTEMA';

export interface SecurityAlertPayload {
  type: SecurityAlertType;
  title: string;
  message: string;
  operator: string;
  amount?: number;
  details?: Record<string, any>;
  timestamp?: string;
}

const STORAGE_KEY = 'hum_vicio_owner_webhook_url';

export function getOwnerWebhookUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveOwnerWebhookUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, url.trim());
  } catch (e) {
    console.error('Erro ao salvar URL do Webhook do Dono:', e);
  }
}

/**
 * Dispara notificação assíncrona para o Webhook do Dono
 * Compatível com Discord, Telegram (via n8n/Bridge), WhatsApp Evolution/Z-API, Slack e webhooks genéricos
 */
export async function sendOwnerSecurityAlert(payload: SecurityAlertPayload): Promise<boolean> {
  const url = getOwnerWebhookUrl();
  if (!url) return false;

  const timestamp = payload.timestamp || new Date().toLocaleString('pt-BR');
  
  // Mensagem padronizada e legível
  const contentText = `🛡️ *[HUM VÍCIO ERP - ALERTA OPERACIONAL]*\n` +
    `📌 *Evento:* ${payload.title}\n` +
    `👤 *Operador:* ${payload.operator}\n` +
    (payload.amount !== undefined ? `💰 *Valor:* R$ ${payload.amount.toFixed(2)}\n` : '') +
    `📝 *Detalhes:* ${payload.message}\n` +
    `⏰ *Horário:* ${timestamp}`;

  // Formato compatível com múltiplos provedores
  const body = {
    content: contentText, // Discord / Slack
    text: contentText,    // Telegram / WhatsApp Bridge
    event: payload.type,
    title: payload.title,
    message: payload.message,
    operator: payload.operator,
    amount: payload.amount,
    timestamp,
    details: payload.details || {}
  };

  try {
    // Disparo não-bloqueante
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(err => console.warn('Erro silencioso ao enviar webhook:', err));
    return true;
  } catch (e) {
    console.warn('Falha no envio de alerta ao proprietário:', e);
    return false;
  }
}

/**
 * Testa o disparo do webhook do dono
 */
export async function testOwnerWebhook(url: string): Promise<{ success: boolean; message: string }> {
  if (!url || !url.startsWith('http')) {
    return { success: false, message: 'URL inválida. Deve iniciar com http:// ou https://' };
  }

  const payload = {
    content: '✅ *[HUM VÍCIO ERP]* Conexão de teste bem-sucedida! Este canal receberá alertas de cancelamento, sangria e segurança da loja em tempo real.',
    text: '✅ *[HUM VÍCIO ERP]* Conexão de teste bem-sucedida! Este canal receberá alertas de cancelamento, sangria e segurança da loja em tempo real.',
    event: 'TESTE_SISTEMA',
    title: 'Disparo de Teste',
    message: 'Canal de notificações ativado e validado.',
    operator: 'Administrador Master',
    timestamp: new Date().toLocaleString('pt-BR')
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok || res.status === 204 || res.status === 200) {
      saveOwnerWebhookUrl(url);
      return { success: true, message: 'Notificação de teste enviada com sucesso!' };
    } else {
      return { success: false, message: `O servidor retornou código de status HTTP ${res.status}. Verifique a URL do Webhook.` };
    }
  } catch (err: any) {
    return { success: false, message: `Falha na conexão: ${err.message || 'Verifique se a URL está ativa'}` };
  }
}
