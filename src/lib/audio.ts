// Sintetizador de Áudio Web Audio API para KDS de Cozinha (Hum Vício Hamburgueria)
// Não depende de arquivos MP3 externos (funciona 100% offline e sem risco de 404)

export function playKitchenChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playTone = (freq: number, start: number, duration: number, volume: number = 0.35) => {
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
    playTone(659.25, 0, 0.35, 0.4); 
    playTone(880.00, 0.18, 0.85, 0.5); 
  } catch (err) {
    console.warn('Áudio KDS não pôde ser reproduzido:', err);
  }
}

export function playCancellationWarning() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playTone = (freq: number, start: number, duration: number, volume: number = 0.3) => {
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
    playTone(380, 0, 0.25, 0.35);
    playTone(260, 0.28, 0.5, 0.4);
  } catch (err) {
    console.warn('Áudio de alerta KDS não pôde ser reproduzido:', err);
  }
}
