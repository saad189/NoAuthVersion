const { contextBridge, ipcRenderer } = require('electron');

// Log de débogage
console.log('[viewPreload.js] Chargement des APIs pour les vues');

// Exposer les API protégées pour les BrowserViews
contextBridge.exposeInMainWorld('electronAPI', {
  // API pour la notification de défilement
  notifyScroll: (scrollPos) => ipcRenderer.send('sync-scroll', scrollPos),
  
  // API pour les mouvements synchronisés
  updateMovementState: (state) => ipcRenderer.send('update-movement-state', state),
  
  // Récepteur pour les mises à jour d'état
  onMovementStateUpdate: (callback) => {
    ipcRenderer.on('movement-state-update', (event, state) => callback(state));
    return () => {
      ipcRenderer.removeListener('movement-state-update', callback);
    };
  },
  
  // API pour notifier l'état de la vue
  notifyViewState: (stateData) => ipcRenderer.send('view-state-updated', stateData),
  
  // API pour activer/désactiver l'audio
  toggleAudio: (enabled) => ipcRenderer.send('toggle-audio', enabled),
  
  // API pour envoyer des événements clavier
  sendKeyboardEvent: (keyEvent) => ipcRenderer.send('keyboard-event', keyEvent),
  
  // API pour mettre à jour l'état de synchronisation
  onSyncStateChange: (callback) => ipcRenderer.on('sync-state-change', (event, data) => callback(data)),
  
  // Recevoir la position de défilement du conteneur principal
  onScrollPositionReceived: (callback) => ipcRenderer.on('scroll-to-position', (event, position) => callback(position))
});

// Fonction qui sera exécutée après le chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM chargé, préparation des fonctions de simulation clavier');
  
  // Rechercher des éléments qui pourraient recevoir des événements clavier
  const findInputTargets = () => {
    // Chercher d'abord le canvas (cible habituelle des jeux)
    const canvas = document.querySelector('canvas');
    if (canvas) {
      console.log('Canvas trouvé pour les événements clavier');
      return canvas;
    }
    
    // Chercher les éléments qui ont focus
    if (document.activeElement && document.activeElement !== document.body) {
      console.log('Élément actif trouvé pour les événements clavier');
      return document.activeElement;
    }
    
    // Chercher les éléments interactifs
    const interactiveElements = document.querySelector('button, input, textarea, [tabindex]');
    if (interactiveElements) {
      console.log('Élément interactif trouvé pour les événements clavier');
      return interactiveElements;
    }
    
    // Par défaut, utiliser le body
    console.log('Utilisation du body pour les événements clavier');
    return document.body;
  };
  
  // Créer une fonction pour injecter des événements directs
  const injectDirectEvent = (type, key) => {
    try {
      // Cibler un élément approprié
      const target = findInputTargets();
      
      // Obtenir les infos de touche
      const keyInfo = getKeyInfo(key);
      
      // Créer un événement avec toutes les propriétés nécessaires
      const event = new KeyboardEvent(type, {
        key: key,
        code: keyInfo.code,
        keyCode: keyInfo.keyCode,
        which: keyInfo.keyCode,
        bubbles: true,
        cancelable: true,
        view: window,
        composed: true
      });
      
      // Dispatch sur plusieurs éléments importants
      const dispatched = target.dispatchEvent(event);
      document.dispatchEvent(event);
      window.dispatchEvent(event);
      
      console.log(`Touche ${type === 'keydown' ? 'appuyée' : 'relâchée'}: ${key}`);
      return dispatched;
    } catch (e) {
      console.error(`Erreur lors de l'envoi de l'événement ${type} pour ${key}:`, e);
      return false;
    }
  };
  
  // Si le jeu utilise des écouteurs directs sur document/window, créer notre propre méthode
  window._gameKeyHandlers = {
    pressedKeys: new Set(),
    
    simulateKeyDown: function(key) {
      if (!this.pressedKeys.has(key)) {
        this.pressedKeys.add(key);
        return injectDirectEvent('keydown', key);
      }
      return true;
    },
    
    simulateKeyUp: function(key) {
      if (this.pressedKeys.has(key)) {
        this.pressedKeys.delete(key);
        return injectDirectEvent('keyup', key);
      }
      return true;
    },
    
    clearAllKeys: function() {
      const keys = Array.from(this.pressedKeys);
      keys.forEach(key => {
        this.simulateKeyUp(key);
      });
    }
  };
  
  // Ajouter quelques fonctions utilitaires pour aider au débogage
  window.debugKeyEvents = {
    // Fonction pour afficher les touches actuellement enfoncées
    showPressedKeys: function() {
      console.log('Touches actuellement enfoncées:', Array.from(window._gameKeyHandlers.pressedKeys));
      return Array.from(window._gameKeyHandlers.pressedKeys);
    },
    
    // Fonction pour tester un appui de touche manuel
    testKeyPress: function(key, duration = 200) {
      console.log(`Test d'appui sur ${key} pendant ${duration}ms`);
      window.pressKey(key);
      setTimeout(() => {
        window.releaseKey(key);
        console.log(`Test de relâchement de ${key} terminé`);
      }, duration);
    },
    
    // Fonction pour tester les touches WASD en QWERTY
    testWASDKeys: function(delay = 500) {
      const keys = ['w', 'a', 's', 'd', ' '];
      let index = 0;
      
      const pressNextKey = () => {
        if (index < keys.length) {
          const key = keys[index];
          console.log(`Test touche QWERTY: ${key}`);
          window.pressKey(key);
          
          setTimeout(() => {
            window.releaseKey(key);
            index++;
            setTimeout(pressNextKey, delay);
          }, 200);
        }
      };
      
      pressNextKey();
    }
  };
});

// Exposer les fonctions pour simuler l'appui et le relâchement de touches
contextBridge.exposeInMainWorld('pressKey', (key) => {
  try {
    // Essayer d'utiliser notre handler spécial s'il existe
    if (window._gameKeyHandlers) {
      return window._gameKeyHandlers.simulateKeyDown(key);
    }
    
    // Sinon, utiliser la méthode standard
    const keyInfo = getKeyInfo(key);
    
    // Simuler l'appui sur une touche
    const event = new KeyboardEvent('keydown', {
      key: key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    document.dispatchEvent(event);
    
    // Aussi dispatcher sur le document actif ou la fenêtre
    if (document.activeElement) {
      document.activeElement.dispatchEvent(event);
    } else {
      window.dispatchEvent(event);
    }
    
    console.log(`Touche appuyée: ${key}`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'appui sur la touche ${key}:`, error);
    return false;
  }
});

contextBridge.exposeInMainWorld('releaseKey', (key) => {
  try {
    // Essayer d'utiliser notre handler spécial s'il existe
    if (window._gameKeyHandlers) {
      return window._gameKeyHandlers.simulateKeyUp(key);
    }
    
    // Sinon, utiliser la méthode standard
    const keyInfo = getKeyInfo(key);
    
    // Simuler le relâchement d'une touche
    const event = new KeyboardEvent('keyup', {
      key: key,
      code: keyInfo.code,
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    document.dispatchEvent(event);
    
    // Aussi dispatcher sur le document actif ou la fenêtre
    if (document.activeElement) {
      document.activeElement.dispatchEvent(event);
    } else {
      window.dispatchEvent(event);
    }
    
    console.log(`Touche relâchée: ${key}`);
    return true;
  } catch (error) {
    console.error(`Erreur lors du relâchement de la touche ${key}:`, error);
    return false;
  }
});

// Fonction utilitaire pour obtenir les informations de la touche
function getKeyInfo(key) {
  // Codes de touches et keyCodes
  const keyMap = {
    'a': { code: 'KeyA', keyCode: 65 },
    'b': { code: 'KeyB', keyCode: 66 },
    'c': { code: 'KeyC', keyCode: 67 },
    'd': { code: 'KeyD', keyCode: 68 },
    'e': { code: 'KeyE', keyCode: 69 },
    'f': { code: 'KeyF', keyCode: 70 },
    'g': { code: 'KeyG', keyCode: 71 },
    'h': { code: 'KeyH', keyCode: 72 },
    'i': { code: 'KeyI', keyCode: 73 },
    'j': { code: 'KeyJ', keyCode: 74 },
    'k': { code: 'KeyK', keyCode: 75 },
    'l': { code: 'KeyL', keyCode: 76 },
    'm': { code: 'KeyM', keyCode: 77 },
    'n': { code: 'KeyN', keyCode: 78 },
    'o': { code: 'KeyO', keyCode: 79 },
    'p': { code: 'KeyP', keyCode: 80 },
    'q': { code: 'KeyQ', keyCode: 81 },
    'r': { code: 'KeyR', keyCode: 82 },
    's': { code: 'KeyS', keyCode: 83 },
    't': { code: 'KeyT', keyCode: 84 },
    'u': { code: 'KeyU', keyCode: 85 },
    'v': { code: 'KeyV', keyCode: 86 },
    'w': { code: 'KeyW', keyCode: 87 },
    'x': { code: 'KeyX', keyCode: 88 },
    'y': { code: 'KeyY', keyCode: 89 },
    'z': { code: 'KeyZ', keyCode: 90 },
    '0': { code: 'Digit0', keyCode: 48 },
    '1': { code: 'Digit1', keyCode: 49 },
    '2': { code: 'Digit2', keyCode: 50 },
    '3': { code: 'Digit3', keyCode: 51 },
    '4': { code: 'Digit4', keyCode: 52 },
    '5': { code: 'Digit5', keyCode: 53 },
    '6': { code: 'Digit6', keyCode: 54 },
    '7': { code: 'Digit7', keyCode: 55 },
    '8': { code: 'Digit8', keyCode: 56 },
    '9': { code: 'Digit9', keyCode: 57 },
    ' ': { code: 'Space', keyCode: 32 },
    'Escape': { code: 'Escape', keyCode: 27 },
    'Enter': { code: 'Enter', keyCode: 13 },
    'Tab': { code: 'Tab', keyCode: 9 },
    'F11': { code: 'F11', keyCode: 122 },
    'Shift': { code: 'ShiftLeft', keyCode: 16 },
    'Control': { code: 'ControlLeft', keyCode: 17 },
    'Alt': { code: 'AltLeft', keyCode: 18 }
  };
  
  return keyMap[key] || { code: key, keyCode: key.charCodeAt(0) };
}

// Recevoir les paramètres de bitrate mis à jour
ipcRenderer.on('bitrate-settings-updated', (event, settings) => {
  console.log('[viewPreload.js] Paramètres reçus dans la vue:', settings);
  
  try {
    // Stocker les paramètres dans localStorage
    if (settings.region) {
      localStorage.setItem('region', settings.region);
      console.log(`[viewPreload.js] Région définie: ${settings.region}`);
    }
    
    if (settings.bypassRestriction) {
      localStorage.setItem('bypassRestriction', settings.bypassRestriction);
      console.log(`[viewPreload.js] Restriction bypass défini: ${settings.bypassRestriction}`);
    }
    
    if (settings.hostBitrate && typeof settings.hostBitrate === 'number') {
      localStorage.setItem('hostBitrate', settings.hostBitrate.toString());
      console.log(`[viewPreload.js] Host bitrate défini: ${settings.hostBitrate}`);
    }
    
    if (settings.playerBitrate && typeof settings.playerBitrate === 'number') {
      localStorage.setItem('playerBitrate', settings.playerBitrate.toString());
      console.log(`[viewPreload.js] Player bitrate défini: ${settings.playerBitrate}`);
    }
    
    console.log('[viewPreload.js] Tous les paramètres ont été injectés dans localStorage');
  } catch (error) {
    console.error('[viewPreload.js] Erreur lors de l\'injection des paramètres:', error);
  }
});

// Script pour l'injection de viewPreload
(function() {
  try {
    console.log("Injection de viewPreload activée");
    
    // Ajouter les fonctionnalités nécessaires pour la vue
    window.addEventListener('load', () => {
      console.log("ViewPreload: Page chargée");
    });

    return "Injection de viewPreload réussie";
  } catch (error) {
    console.error("Erreur lors de l'injection de viewPreload:", error);
    return "Erreur: " + error.message;
  }
})(); 