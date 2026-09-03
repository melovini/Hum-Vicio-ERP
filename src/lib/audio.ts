// Sintetizador de Áudio Web Audio API para KDS de Cozinha e Balcão (Hum Vício Hamburgueria)
// Não depende de arquivos MP3 externos (funciona 100% offline e sem risco de 404)

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Desbloquear áudio globalmente no primeiro clique ou toque do usuário na tela
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export function playKitchenChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, start: number, duration: number, volume: number = 0.4) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Toque duplo clássico de sino de restaurante / KDS (E5 -> A5)
    playTone(659.25, 0, 0.4, 0.45); 
    playTone(880.00, 0.18, 0.9, 0.55); 
  } catch (err) {
    console.warn('Áudio KDS não pôde ser reproduzido:', err);
  }
}

export function playCancellationWarning() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, start: number, duration: number, volume: number = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Sinal sonoro de cancelamento / alerta da chapa (dois bips graves descendentes)
    playTone(380, 0, 0.28, 0.4);
    playTone(260, 0.30, 0.55, 0.45);
  } catch (err) {
    console.warn('Áudio de alerta KDS não pôde ser reproduzido:', err);
  }
}

// Alerta de Pedido Pronto para o Balcão (Campainha de Expedição)
export function playOrderReadyChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, start: number, duration: number, volume: number = 0.35) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Acorde ascendente suave de pedido pronto (C5 -> G5 -> C6)
    playTone(523.25, 0, 0.25, 0.35);
    playTone(783.99, 0.14, 0.28, 0.4);
    playTone(1046.50, 0.28, 0.7, 0.45);
  } catch (err) {
    console.warn('Áudio de pedido pronto não pôde ser reproduzido:', err);
  }
}
