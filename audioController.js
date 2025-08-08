class SoundController {
  constructor() {
    this.audioContext = null;
    this.audioGainNode = null;
    this.volume = 100; // Volume par défaut
  }

  // Initialise le contexte audio et le gain node
  setupAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 0
      });
    }
  }

  // Configure le gain node pour un élément média
  setupGainNode($media, audioStream) {
    this.setupAudioContext();
    
    if ($media instanceof HTMLAudioElement) {
      $media.muted = true;
      $media.addEventListener("playing", () => {
        $media.muted = true;
        $media.pause();
      });
    } else {
      $media.muted = true;
      $media.addEventListener("playing", () => {
        $media.muted = true;
      });
    }

    try {
      const source = this.audioContext.createMediaStreamSource(audioStream);
      const gainNode = this.audioContext.createGain();
      source.connect(gainNode).connect(this.audioContext.destination);
      this.audioGainNode = gainNode;
      this.setGainNodeVolume(this.volume);
    } catch (error) {
      console.error("Erreur lors de la configuration du gain node:", error);
      this.audioGainNode = null;
    }
  }

  // Définit le volume du gain node
  setGainNodeVolume(value) {
    if (this.audioGainNode) {
      this.audioGainNode.gain.value = value / 100;
      this.volume = value;
    }
  }

  // Mute/démute l'audio
  toggleMute() {
    if (this.audioGainNode) {
      // Utilise le gain node si disponible
      const currentGain = this.audioGainNode.gain.value;
      if (currentGain === 0) {
        // Démute
        this.setGainNodeVolume(this.volume);
        return { muted: false, volume: this.volume };
      } else {
        // Mute
        this.setGainNodeVolume(0);
        return { muted: true, volume: 0 };
      }
    } else {
      // Fallback sur le mute natif
      const $media = document.querySelector("audio, video");
      if ($media) {
        $media.muted = !$media.muted;
        return { muted: $media.muted, volume: $media.muted ? 0 : 100 };
      }
    }
    return { muted: false, volume: 0 };
  }

  // Ajuste le volume
  adjustVolume(amount) {
    if (this.audioGainNode) {
      const newVolume = Math.max(0, Math.min(100, this.volume + amount));
      this.setGainNodeVolume(newVolume);
      return { muted: false, volume: newVolume };
    }
    return { muted: false, volume: this.volume };
  }
}

// Classe pour gérer l'interface utilisateur du contrôle audio
class AudioUI {
  constructor() {
    this.soundController = new SoundController();
    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.className = 'audio-controls';
    
    this.muteButton = document.createElement('button');
    this.muteButton.className = 'mute-button';
    this.muteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
    `;
    
    this.unmuteButton = document.createElement('button');
    this.unmuteButton.className = 'unmute-button';
    this.unmuteButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    `;
    
    this.container.appendChild(this.muteButton);
    this.container.appendChild(this.unmuteButton);
    document.body.appendChild(this.container);
  }

  setupEventListeners() {
    this.muteButton.addEventListener('click', () => {
      const state = this.soundController.toggleMute();
      this.updateUI(state.muted);
    });

    this.unmuteButton.addEventListener('click', () => {
      const state = this.soundController.toggleMute();
      this.updateUI(state.muted);
    });
  }

  updateUI(muted) {
    this.muteButton.style.display = muted ? 'none' : 'block';
    this.unmuteButton.style.display = muted ? 'block' : 'none';
  }
}

// Styles CSS pour l'interface audio
const audioStyles = `
.audio-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
}

.mute-button,
.unmute-button {
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: background-color 0.3s;
}

.mute-button:hover,
.unmute-button:hover {
  background: rgba(0, 0, 0, 0.9);
}

.mute-button svg,
.unmute-button svg {
  width: 24px;
  height: 24px;
}
`;

// Ajouter les styles au document
const styleSheet = document.createElement("style");
styleSheet.textContent = audioStyles;
document.head.appendChild(styleSheet);

// Exporter les classes pour utilisation
export { SoundController, AudioUI }; 