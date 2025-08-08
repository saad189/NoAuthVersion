const { BrowserWindow, BrowserView, ipcMain, app, globalShortcut, Menu } = require('electron');
const path = require('path');
const { FullScreenSpooferScript } = require('./fullscreenSpoofer');
const fs = require('fs');
const url = require('url');
const MacroManager = require('./macro');

// Script pour simuler que la fenêtre est toujours active
const AlwaysActiveWindowScript = `
  // Remplacer document.hasFocus() pour qu'il retourne toujours true
  const originalHasFocus = document.hasFocus;
  document.hasFocus = function() { return true; };
  
  // Définir document.visibilityState comme toujours "visible"
  Object.defineProperty(document, 'visibilityState', {
    get: function() { return 'visible'; }
  });
  
  // Définir document.hidden comme toujours false
  Object.defineProperty(document, 'hidden', {
    get: function() { return false; }
  });
  
  // Gérer les événements de visibilité du document
  const fireVisibilityChange = (type) => {
    const evt = new Event('visibilitychange');
    document.dispatchEvent(evt);
  };
  
  // Intercepter les événements blur et simuler le focus
  window.addEventListener('blur', function(e) {
    setTimeout(() => {
      const focusEvent = new FocusEvent('focus');
      window.dispatchEvent(focusEvent);
      document.dispatchEvent(focusEvent);
      if (document.activeElement && document.activeElement.blur) {
        const focusedElement = document.activeElement;
        focusedElement.dispatchEvent(focusEvent);
      }
    }, 0);
  }, true);
  
  // Fonction pour s'assurer que les vidéos continuent de jouer
  const keepVideosPlaying = () => {
    document.querySelectorAll('video, audio').forEach(media => {
      if (media.paused && !media.ended && media.autoplay !== false) {
        media.play().catch(e => {});
      }
    });
  };
  
  // Vérifier périodiquement les médias qui pourraient avoir été mis en pause
  setInterval(keepVideosPlaying, 1000);
  
  // Styles CSS pour maintenir l'apparence active
  const styleElement = document.createElement('style');
  styleElement.textContent = \`
    /* Empêcher les éléments de changer d'apparence quand la fenêtre est inactive */
    :root, body, * {
      opacity: 1 !important;
      filter: none !important;
      animation-play-state: running !important;
      transition-property: none important;
    }
    
    /* S'assurer que les vidéos et animations gardent leur pleine visibilité */
    video, audio, canvas, iframe {
      opacity: 1 !important;
    }
    
    /* Supprimer les filtres spécifiques qui pourraient être appliqués en mode inactif */
    *:not(:focus-within) {
      filter: none !important;
    }
  \`;
  document.head.appendChild(styleElement);
  
  console.log('[AlwaysActiveWindow] Module activé');
`;

class MainViewWindow {
  constructor(config) {
    // Définir le chemin de l'icône
    const iconPath = path.join(__dirname, '../../build/icon.ico');

    this.config = config;
    this.views = [];
    this.scrollPosition = { x: 0, y: 0 };
    this.lastScrollUpdateTime = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.viewsVisibility = new Map(); // Pour garder la trace des vues visibles
    this.fullscreenView = null; // Pour suivre la vue en plein écran
    
    // Définir les hauteurs des barres de contrôle dès l'initialisation
    this.controlBarHeight = 40;
    this.gameControlBarHeight = 30;
    this.totalControlBarHeight = this.controlBarHeight + this.gameControlBarHeight;
    
    // Initialiser le nombre de vues par ligne en fonction du mode
    this.viewsPerRow = config.mode === 'multiplayer' ? 5 : 4;
    
    // Initialiser la configuration de synchronisation
    this.syncConfig = {
      groups: [],
      lastActive: null
    };
    
    // Initialiser le gestionnaire de macros
    this.macroManager = new MacroManager(this);
    
    // Ajouter une propriété pour suivre l'état de la macro de mouvements aléatoires
    this.randomMovementActive = false;
    
    // Ajouter des propriétés pour gérer les timeout des mouvements aléatoires
    this.randomMovementTimeouts = [];
    this.randomMovementIntervalId = null;
    
    // Ajouter des propriétés pour les mouvements synchronisés
    this.centralMovementController = {
      isRunning: false,
      currentSequence: [],
      currentIndex: 0,
      lastDirection: null,
      recentMoves: [],
      timeoutIds: []
    };
    
    // Créer la fenêtre principale
    this.window = new BrowserWindow({
      width: 1600,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Multi-View Browser',
      show: false,
      backgroundColor: '#000000',
      icon: iconPath
    });

    // Charger la page de base
    this.window.loadFile(path.join(__dirname, '../renderer/main.html'));
    
    // Créer la control bar spécifique au mode de jeu
    this.gameControlBar = null;
    
    this.window.once('ready-to-show', () => {
      this.window.show();
      this.setupBrowserViews();
      this.createGameControlBar();
      this.setupScrollListeners();
      // Initialiser un groupe de synchronisation par défaut
      this.initDefaultSyncGroup();
    });

    // Gérer le redimensionnement de la fenêtre
    this.window.on('resize', () => {
      this.resizeViews();
      this.updateViewsVisibility();
      if (this.gameControlBar) {
        this.positionGameControlBar();
      }
    });
    
    // Configurer les gestionnaires IPC
    this.setupIpcHandlers();

    // Ajout d'une nouvelle propriété pour la fenêtre de synchronisation
    this.syncWindow = null;
    
    // Charger les paramètres de serveur depuis le localStorage
    this.loadServerSettings();
  }
  
  // Méthode pour charger les paramètres du serveur depuis le localStorage
  loadServerSettings() {
    console.log('Chargement des paramètres du serveur');
    
    // Par défaut
    global.serverConfig = {
      region: 'default',
      bypassRestriction: 'off',
      hostBitrate: 5000000,
      playerBitrate: 500000,
      resolution: '720p'
    };
    
    // Demander au processus de rendu de récupérer les paramètres du localStorage
    this.window.webContents.once('did-finish-load', () => {
      this.window.webContents.executeJavaScript(`
        (function() {
          try {
            const betterXcloudSettings = localStorage.getItem('BetterXcloud');
            if (betterXcloudSettings) {
              console.log('Paramètres BetterXcloud trouvés:', betterXcloudSettings);
              return betterXcloudSettings;
            }
            return null;
          } catch(err) {
            console.error('Erreur lors de la récupération des paramètres:', err);
            return null;
          }
        })()
      `).then(result => {
        if (result) {
          try {
            const settings = JSON.parse(result);
            console.log('Paramètres chargés:', settings);
            
            // Mettre à jour la configuration du serveur
            if (settings["server.region"]) {
              global.serverConfig.region = settings["server.region"];
            }
            
            if (settings["server.bypassRestriction"]) {
              global.serverConfig.bypassRestriction = settings["server.bypassRestriction"];
            }
            
            // Récupérer la résolution vidéo
            if (settings["stream.video.resolution"]) {
              global.serverConfig.resolution = settings["stream.video.resolution"];
            }
            
            // Récupérer les valeurs de bitrate
            if (settings["host.bitrate"]) {
              global.serverConfig.hostBitrate = settings["host.bitrate"];
            }
            
            if (settings["player.bitrate"]) {
              global.serverConfig.playerBitrate = settings["player.bitrate"];
            }
            
            console.log('Configuration du serveur mise à jour:', global.serverConfig);
          } catch (error) {
            console.error('Erreur lors du parsing des paramètres:', error);
          }
        } else {
          console.log('Aucun paramètre BetterXcloud trouvé, utilisation des valeurs par défaut');
        }
      }).catch(err => {
        console.error('Erreur lors de l\'exécution du script de récupération des paramètres:', err);
      });
    });
  }
  
  // Initialiser un groupe de synchronisation par défaut
  initDefaultSyncGroup() {
    console.log('Initialisation du groupe de synchronisation par défaut');
    
    // Créer un groupe par défaut avec toutes les vues
    const allViewIndices = this.views.map(view => view.viewIndex);
    
    if (allViewIndices.length > 0) {
      // Créer un nouveau groupe par défaut
      const defaultGroup = {
        id: 'default',
        name: 'Groupe par défaut',
        views: allViewIndices,
        active: true
      };
      
      // Ajouter le groupe à la configuration
      this.syncConfig.groups = [defaultGroup];
      this.syncConfig.lastActive = 'default';
      
      // Marquer toutes les vues comme synchronisées
      this.views.forEach(view => {
        view.isSynchronized = true;
      });
      
      console.log(`Groupe par défaut créé avec ${allViewIndices.length} vues`);
    } else {
      console.warn('Aucune vue disponible pour créer un groupe par défaut');
    }
  }
  
  // Créer la control bar spécifique au mode de jeu
  createGameControlBar() {
    const { mode } = this.config;
    
    // Déterminer quel fichier HTML utiliser en fonction du mode
    let controlBarPath;
    
    if (mode === 'warzone') {
      controlBarPath = path.join(__dirname, '../renderer/controlbarWarzone.html');
    } else {
      // Pour multiplayer et cdl, utiliser la même barre mais avec paramètre différent
      controlBarPath = path.join(__dirname, '../renderer/controlbarMultiplayer.html');
    }
    
    // Créer une BrowserView pour la control bar
    this.gameControlBar = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'controlBarPreload.js')
      }
    });
    
    this.window.addBrowserView(this.gameControlBar);
    
    // Charger le fichier HTML approprié avec le mode comme paramètre
    this.gameControlBar.webContents.loadFile(controlBarPath, { 
      search: `mode=${this.config.mode}` 
    });
    
    // Positionner la control bar
    this.positionGameControlBar();
  }
  
  // Positionner la control bar du jeu
  positionGameControlBar() {
    if (!this.gameControlBar) return;
    
    const { width } = this.window.getContentBounds();
    
    this.gameControlBar.setBounds({
      x: 0,
      y: this.controlBarHeight,
      width: width,
      height: this.gameControlBarHeight
    });
  }
  
  // Configurer les gestionnaires IPC pour la communication avec le renderer
  setupIpcHandlers() {
    console.log('Configuration des gestionnaires IPC pour le défilement');
    
    ipcMain.on('container-scrolled', (event, position) => {
      console.log('Événement container-scrolled reçu:', position);
      this.throttledUpdateViewPositions(position);
    });
    
    ipcMain.on('wheel-scrolled', (event, delta) => {
      console.log('Événement wheel-scrolled reçu:', delta);
      this.handleWheelScroll(delta);
    });
    
    ipcMain.on('keyboard-scroll', (event, data) => {
      console.log('Événement keyboard-scroll reçu:', data);
      this.handleKeyboardScroll(data);
    });
    
    // Gestionnaire pour l'événement 'execute-macro'
    ipcMain.on('execute-macro', (event, data) => {
      console.log('Demande d\'exécution de la macro:', data);
      
      // Utiliser le gestionnaire de macros
      this.macroManager.executeMacro(data.macroId, data.gameMode);
    });
    
    // Gestionnaire pour l'événement 'open-sync-panel'
    ipcMain.on('open-sync-panel', () => {
      this.openSyncPanel();
    });
    
    // Gestionnaire pour l'événement 'open-macro-panel'
    ipcMain.on('open-macro-panel', (event, gameMode) => {
      // Si le mode de jeu est spécifié, mettre temporairement à jour la configuration
      if (gameMode) {
        const savedMode = this.config.mode;
        this.config.mode = gameMode;
        this.openMacroPanel();
        this.config.mode = savedMode;
      } else {
        this.openMacroPanel();
      }
    });
    
    // Gestionnaire pour l'événement 'open-settings'
    ipcMain.on('open-settings', () => {
      this.openSettings();
    });
    
    // Gestionnaire pour l'événement 'reload-view'
    ipcMain.on('reload-view', (event, viewId) => {
      console.log(`Demande de rechargement de la vue ${viewId}`);
      
      // Vérifier si l'ID de vue est valide
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          console.log(`Rechargement de la vue ${viewId} (${view.viewType} ${view.viewNumber})`);
          view.webContents.reload();
        } else {
          console.log(`La vue ${viewId} n'est pas valide ou est détruite`);
        }
      } else {
        console.log(`ID de vue invalide: ${viewId}`);
      }
    });
    
    // Gestionnaire pour l'événement 'toggle-view-fullscreen'
    ipcMain.on('toggle-view-fullscreen', (event, viewId) => {
      console.log(`Basculement du mode plein écran pour la vue ${viewId}`);
      
      // Vérifier si l'ID de vue est valide
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        this.toggleViewFullscreen(view);
      }
    });
    
    // Gestionnaire pour l'événement 'open-view-devtools'
    ipcMain.on('open-view-devtools', (event, viewId) => {
      console.log(`Ouverture des DevTools pour la vue ${viewId}`);
      
      // Vérifier si l'ID de vue est valide
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
    
    // Gestionnaire pour l'événement 'close-current-window'
    ipcMain.on('close-current-window', () => {
      console.log('Demande de fermeture de fenêtre reçue');
      // Fermer la fenêtre de paramètres si elle existe
      if (this.settingsWindow) {
        console.log('Fermeture de la fenêtre de paramètres');
        this.settingsWindow.close();
        this.settingsWindow = null;
        
        // Recharger les paramètres et mettre à jour les vues existantes
        this.reloadSettingsAndUpdateViews();
      }
    });
    
    // Gestionnaire pour 'request-views-state'
    ipcMain.on('request-views-state', (event) => {
      this.updateSyncPanel();
    });
    
    // Gestionnaire pour 'request-macros'
    ipcMain.on('request-macros', (event, gameMode) => {
      // Dans une version future, on pourrait charger dynamiquement les macros depuis une configuration
      // Pour l'instant, on ne fait rien car les macros sont définies côté client
      console.log(`Demande de chargement des macros pour le mode: ${gameMode}`);
    });
    
    // Gestionnaire pour synchroniser les vues
    ipcMain.on('synchronize-views', (event, selectedIndices) => {
      this.synchronizeViews(selectedIndices);
    });
    
    // Gestionnaire d'événements clavier
    ipcMain.on('keyboard-event', (event, keyEvent) => {
      // Propager l'événement clavier aux vues synchronisées
      this.handleKeyboardEvent(keyEvent);
    });
  }

  // Ajouter cette méthode pour vérifier si une vue est visible
  isViewVisible(view) {
    // Vérifier si la vue existe dans notre collection
    const index = this.views.indexOf(view);
    if (index === -1) return false;
    
    // Utiliser la Map de visibilité pour déterminer si la vue est visible
    return this.viewsVisibility.get(index) === true;
  }

  // Améliorer la méthode stopRandomMovements pour arrêter tous les mouvements
  stopRandomMovements() {
    console.log('Arrêt des mouvements aléatoires');
    
    // Désactiver le flag de la macro
    this.randomMovementActive = false;
    
    // Arrêter tous les mouvements synchronisés
    this.stopAllSynchronizedMovements();
    
    console.log('Tous les mouvements aléatoires ont été arrêtés avec succès');
  }

  // Méthode améliorée pour synchronizer les vues avec gestion de l'état des mouvements
  synchronizeViews(selectedIndices) {
    // Sauvegarder les vues actuellement synchronisées pour comparaison
    const previouslySynchronized = this.views.filter(v => v.isSynchronized).map(v => v.viewIndex);
    
    // Réinitialiser l'état de synchronisation
    this.views.forEach(view => {
      view.isSynchronized = false;
    });

    // Marquer les vues sélectionnées comme synchronisées
    selectedIndices.forEach(index => {
      const view = this.views.find(v => v.viewIndex === index);
      if (view) {
        view.isSynchronized = true;
      }
    });

    // Mettre à jour la configuration de synchronisation
    if (selectedIndices.length > 0) {
      const existingDefaultGroup = this.syncConfig.groups.find(g => g.id === 'default');
      
      if (existingDefaultGroup) {
        // Mettre à jour le groupe existant
        existingDefaultGroup.views = selectedIndices;
        existingDefaultGroup.active = true;
      } else {
        // Créer un nouveau groupe
        const newGroup = {
          id: 'default',
          name: 'Groupe par défaut',
          views: selectedIndices,
          active: true
        };
        
        // Réinitialiser les groupes et ajouter le nouveau
        this.syncConfig.groups = [newGroup];
        this.syncConfig.lastActive = 'default';
      }
    }
    
    // Si la macro de mouvements est active
    if (this.randomMovementActive) {
      // Trouver les vues qui ont été désynchronisées
      const desynchronizedViews = previouslySynchronized.filter(index => !selectedIndices.includes(index));
      
      // Arrêter les mouvements dans ces vues spécifiquement
      desynchronizedViews.forEach(index => {
        const view = this.views.find(v => v.viewIndex === index);
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          console.log(`Arrêt des mouvements pour la vue désynchronisée ${view.viewNumber}`);
          view.webContents.executeJavaScript(`
            if (typeof window.clearRandomMovements === 'function') {
              window.clearRandomMovements();
              console.log('Mouvements arrêtés suite à la désynchronisation');
            }
          `).catch(err => {
            console.log(`Erreur lors de l'arrêt des mouvements dans la vue ${view.viewNumber}:`, err.message);
          });
        }
      });
      
      // Si de nouvelles vues ont été synchronisées
      const newlySynchronized = selectedIndices.filter(index => !previouslySynchronized.includes(index));
      
      if (newlySynchronized.length > 0) {
        console.log(`${newlySynchronized.length} nouvelles vues synchronisées, injection de l'état actuel de mouvements`);
        
        // Injecter l'état de mouvement actuel dans les nouvelles vues
        newlySynchronized.forEach(index => {
          const view = this.views.find(v => v.viewIndex === index);
          if (view) {
            this.injectCurrentMovementState(view);
          }
        });
      }
    }

    this.updateSyncPanel();
  }
  
  // Méthode pour arrêter tous les mouvements dans toutes les vues
  stopAllSynchronizedMovements() {
    console.log('Arrêt de tous les mouvements synchronisés');
    
    // Arrêter le contrôleur central
    this.centralMovementController.isRunning = false;
    
    // Nettoyer tous les timeouts centraux
    if (this.centralMovementController.timeoutIds.length > 0) {
      this.centralMovementController.timeoutIds.forEach(id => clearTimeout(id));
      this.centralMovementController.timeoutIds = [];
    }
    
    // Nettoyer les autres timeouts et intervalles
    if (this.randomMovementTimeouts && this.randomMovementTimeouts.length > 0) {
      this.randomMovementTimeouts.forEach(id => clearTimeout(id));
      this.randomMovementTimeouts = [];
    }
    
    if (this.randomMovementIntervalId) {
      clearInterval(this.randomMovementIntervalId);
      this.randomMovementIntervalId = null;
    }
    
    // Réinitialiser l'état du contrôleur
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.currentSequence = [];
    
    // Arrêter les mouvements dans chaque vue
    const synchronizedViews = this.getAllSynchronizedViews();
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.executeJavaScript(`
          if (typeof window.clearRandomMovements === 'function') {
            window.clearRandomMovements();
          }
        `).catch(() => {});
      }
    });
    
    // Relâcher toutes les touches dans chaque vue
    this.views.forEach(view => this.releaseAllKeysInView(view));
  }
  
  // Méthode pour relâcher toutes les touches dans une vue
  releaseAllKeysInView(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      return;
    }
    
    try {
      const releaseScript = `
        (function() {
          try {
            console.log('Relâchement de toutes les touches');
            
            // Liste de toutes les touches à relâcher (en QWERTY)
            const keysToRelease = ['w', 'a', 's', 'd', ' '];
            
            // Créer et dispatcher les événements keyup pour chaque touche
            keysToRelease.forEach(key => {
              try {
                if (window.releaseKey) {
                  window.releaseKey(key);
                } else {
                  const code = key === ' ' ? 'Space' : 'Key' + key.toUpperCase();
                  const keyCode = key === ' ' ? 32 : key.toUpperCase().charCodeAt(0);
                  
                  const keyEvent = new KeyboardEvent('keyup', {
                    key: key,
                    code: code,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  
                  document.dispatchEvent(keyEvent);
                }
              } catch (keyErr) {
                console.error('Erreur lors du relâchement de ' + key + ':', keyErr);
              }
            });
            
            if (window._gameKeyHandlers && typeof window._gameKeyHandlers.clearAllKeys === 'function') {
              window._gameKeyHandlers.clearAllKeys();
            }
            
            return "Toutes les touches relâchées";
          } catch (e) {
            console.error('Erreur générale lors du relâchement des touches:', e);
            return "Erreur: " + e.message;
          }
        })();
      `;
      
      view.webContents.executeJavaScript(releaseScript).catch(() => {});
    } catch (e) {
      console.error(`Erreur générale pour la vue ${view.viewNumber}:`, e);
    }
  }
  
  // Méthode pour injecter l'état actuel de mouvement dans une vue nouvellement synchronisée
  injectCurrentMovementState(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed() || !view.isSynchronized || !this.randomMovementActive) {
      return;
    }
    
    console.log(`Injection de l'état de mouvement actuel dans la vue ${view.viewNumber}`);
    
    // Si le contrôleur central est déjà en cours d'exécution, injecter le script avec l'état actuel
    if (this.centralMovementController.isRunning) {
      const currentState = JSON.stringify({
        lastDirection: this.centralMovementController.lastDirection,
        recentMoves: this.centralMovementController.recentMoves,
        currentIndex: this.centralMovementController.currentIndex
      });
      
      const initScript = `
        window.SYNC_STATE = ${currentState};
        console.log('État de synchronisation reçu:', window.SYNC_STATE);
      `;
      
      view.webContents.executeJavaScript(initScript)
        .then(() => {
          // Une fois l'état injecté, démarrer le script de mouvements
          this.executeDirectMovementScript(view, true);
        })
        .catch(err => {
          console.error(`Erreur lors de l'injection de l'état dans la vue ${view.viewNumber}:`, err);
          // En cas d'erreur, essayer quand même de démarrer le script sans état
          this.executeDirectMovementScript(view, false);
        });
    } else {
      // Si le contrôleur n'est pas en cours d'exécution, simplement démarrer le script
      this.executeDirectMovementScript(view, false);
    }
  }
  
  // Méthode améliorée pour exécuter un script de mouvements direct avec synchronisation
  executeDirectMovementScript(view, joinExisting = false) {
    if (!view || !view.webContents || view.webContents.isDestroyed() || !view.isSynchronized || !this.randomMovementActive) {
      return;
    }
    
    console.log(`Exécution d'un script de mouvement pour la vue ${view.viewNumber}${joinExisting ? ' (rejoignant une séquence existante)' : ''}`);
    
    // Script complet de mouvements aléatoires à injecter dans la vue, modifié pour utiliser les mouvements synchronisés
    const scriptContents = `
      (function() {
        console.log("Démarrage du script de mouvements synchronisés");
        
        // Constantes et variables - en QWERTY (WASD)
        const KEYS = {
          FORWARD: 'w',    // Avancer (W en QWERTY)
          LEFT: 'a',       // Gauche (A en QWERTY)
          BACKWARD: 's',   // Reculer (S en QWERTY)
          RIGHT: 'd',      // Droite (D en QWERTY)
          JUMP: ' '        // Saut (Espace)
        };
        
        // Directions possibles
        const DIRECTIONS = [
          [KEYS.FORWARD],     // Avant
          [KEYS.LEFT],        // Gauche
          [KEYS.BACKWARD],    // Arrière
          [KEYS.RIGHT],       // Droite
          [KEYS.FORWARD, KEYS.LEFT],  // Diagonale avant-gauche
          [KEYS.FORWARD, KEYS.RIGHT], // Diagonale avant-droite
          [KEYS.BACKWARD, KEYS.LEFT], // Diagonale arrière-gauche
          [KEYS.BACKWARD, KEYS.RIGHT] // Diagonale arrière-droite
        ];
        
        // Variables d'état local
        let isRunning = true;
        const timeoutIds = [];
        
        // Récupérer l'état synchronisé s'il existe
        const syncState = window.SYNC_STATE || { 
          lastDirection: null,
          recentMoves: [],
          currentIndex: 0
        };
        
        console.log("État initial:", syncState);
        
        // Fonction pour envoyer l'état au processus principal
        function sendStateToMain(state) {
          if (window.electronAPI && window.electronAPI.updateMovementState) {
            window.electronAPI.updateMovementState(state);
          }
        }
        
        // Fonction pour recevoir l'état du processus principal
        function listenForStateUpdates() {
          if (window.electronAPI && window.electronAPI.onMovementStateUpdate) {
            window.electronAPI.onMovementStateUpdate((state) => {
              Object.assign(syncState, state);
              console.log("État mis à jour depuis le processus principal:", syncState);
            });
          }
        }
        
        // Fonction pour appuyer sur une touche
        function pressKey(key) {
          if (!isRunning) return false;
          try {
            console.log('Appui sur ' + key);
            
            if (window.pressKey) {
              return window.pressKey(key);
            } else {
              const event = new KeyboardEvent('keydown', {
                key: key,
                code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(),
                keyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              if (document.activeElement) {
                document.activeElement.dispatchEvent(event);
              }
              window.dispatchEvent(event);
              return true;
            }
          } catch(e) {
            console.error('Erreur lors de l\\'appui sur ' + key, e);
            return false;
          }
        }
        
        // Fonction pour relâcher une touche
        function releaseKey(key) {
          try {
            console.log('Relâchement de ' + key);
            
            if (window.releaseKey) {
              return window.releaseKey(key);
            } else {
              const event = new KeyboardEvent('keyup', {
                key: key,
                code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(),
                keyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              if (document.activeElement) {
                document.activeElement.dispatchEvent(event);
              }
              window.dispatchEvent(event);
              return true;
            }
          } catch(e) {
            console.error('Erreur lors du relâchement de ' + key, e);
            return false;
          }
        }
        
        // Fonction pour recevoir et exécuter une action de mouvement
        window.executeMovementAction = function(action) {
          // Envelopper dans une promesse qui se résout immédiatement
          return new Promise((resolve, reject) => {
            try {
              if (!isRunning) {
                console.log('Impossible d\\'exécuter l\\'action: script arrêté');
                resolve(false);
                return;
              }
              
              console.log('Exécution de l\\'action:', action);
              
              // Si c'est un saut
              if (action.type === 'jump') {
                const success = pressKey(KEYS.JUMP);
                
                if (success) {
                  const jumpReleaseId = setTimeout(() => {
                    releaseKey(KEYS.JUMP);
                  }, action.duration || 200);
                  
                  timeoutIds.push(jumpReleaseId);
                  resolve(true);
                } else {
                  console.error('Échec de l\\'appui sur espace');
                  resolve(false);
                }
                return;
              }
              
              // Si c'est un mouvement directionnel
              if (action.type === 'move') {
                // Appliquer toutes les touches de direction
                const allPressed = action.keys.every(key => pressKey(key));
                
                if (allPressed) {
                  // Planifier le relâchement
                  const releaseId = setTimeout(() => {
                    // Relâcher toutes les touches
                    action.keys.forEach(key => releaseKey(key));
                    
                    // Si correction nécessaire
                    if (action.correction) {
                      setTimeout(() => {
                        const correctionPressed = pressKey(action.correction);
                        
                        if (correctionPressed) {
                          const correctionReleaseId = setTimeout(() => {
                            releaseKey(action.correction);
                          }, action.correctionDuration || 300);
                          
                          timeoutIds.push(correctionReleaseId);
                        }
                      }, 30);
                    }
                  }, action.duration || 200);
                  
                  timeoutIds.push(releaseId);
                  resolve(true);
                } else {
                  console.error('Échec de l\\'appui sur certaines touches');
                  resolve(false);
                }
                return;
              }
              
              console.error('Type d\\'action non reconnue:', action.type);
              resolve(false);
            } catch (error) {
              console.error('Erreur lors de l\\'exécution de l\\'action:', error);
              reject(error);
            }
          });
        };
        
        // Fonction pour arrêter tous les mouvements
        window.clearRandomMovements = function() {
          isRunning = false;
          
          // Nettoyer tous les timeouts
          timeoutIds.forEach(id => clearTimeout(id));
          timeoutIds.length = 0;
          
          // Relâcher toutes les touches possibles
          Object.values(KEYS).forEach(key => {
            releaseKey(key);
          });
          
          console.log('Mouvements aléatoires arrêtés');
        };
        
        // Initialiser l'écoute des mises à jour d'état
        listenForStateUpdates();
        
        // Si on rejoint une séquence existante, on n'a pas besoin de démarrer les sauts
        if (${joinExisting}) {
          console.log("Rejoindre la séquence existante sans initialiser de nouveaux mouvements");
        }
        
        return "Script de mouvements synchronisés démarré";
      })();
    `;
    
    // Exécuter le script dans la vue
    view.webContents.executeJavaScript(scriptContents)
      .then(result => {
        console.log(`Résultat du script pour vue ${view.viewNumber}:`, result);
        
        // Si c'est une nouvelle séquence (pas de joinExisting), démarrer la séquence centrale si ce n'est pas déjà fait
        if (!joinExisting && this.centralMovementController.isRunning && this.centralMovementController.currentIndex === 0) {
          this.startCentralMovementSequence();
        }
      })
      .catch(err => {
        console.error(`Erreur lors de l'exécution du script pour vue ${view.viewNumber}:`, err);
      });
  }
  
  // Méthode pour exécuter la séquence de sauts initiale
  executeJumpSequence(jumpIndex) {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log(`Exécution du saut ${jumpIndex+1}/3`);
    
    // Envoyer la commande de saut à toutes les vues synchronisées
    const jumpAction = {
      type: 'jump',
      duration: 200
    };
    
    this.executeActionOnAllSynchronizedViews(jumpAction);
    
    // Continuer avec le prochain saut ou passer aux mouvements
    if (jumpIndex < 2) {
      const nextJumpId = setTimeout(() => {
        this.executeJumpSequence(jumpIndex + 1);
      }, 500);
      
      this.centralMovementController.timeoutIds.push(nextJumpId);
    } else {
      // Passer aux mouvements aléatoires après les 3 sauts
      const startMovementsId = setTimeout(() => {
        this.executeRandomMovement();
      }, 800);
      
      this.centralMovementController.timeoutIds.push(startMovementsId);
    }
  }
  
  // Méthode pour exécuter un mouvement aléatoire
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    // Directions possibles (comme dans le script injecté) - en QWERTY (WASD)
    const directions = [
      ['w'],     // Avant (W en QWERTY)
      ['a'],     // Gauche (A en QWERTY)
      ['s'],     // Arrière (S en QWERTY)
      ['d'],     // Droite (D en QWERTY)
      ['w', 'a'], // Diagonale avant-gauche
      ['w', 'd'], // Diagonale avant-droite
      ['s', 'a'], // Diagonale arrière-gauche
      ['s', 'd']  // Diagonale arrière-droite
    ];
    
    const maxRecentMoves = 5;
    
    try {
      // 1. Choisir une direction, en évitant la dernière utilisée
      const availableDirections = directions.filter(dir => 
        !this.centralMovementController.lastDirection || 
        JSON.stringify(dir) !== JSON.stringify(this.centralMovementController.lastDirection)
      );
      
      // Éviter aussi les mouvements récents
      const nonRecentDirections = availableDirections.filter(dir => 
        !this.centralMovementController.recentMoves.some(recent => JSON.stringify(dir) === JSON.stringify(recent)))
      
      // Utiliser les directions non récentes si possible, sinon toutes les directions disponibles
      const directionPool = nonRecentDirections.length > 0 ? nonRecentDirections : availableDirections;
      
      let directionKeys = directionPool[Math.floor(Math.random() * directionPool.length)];
      
      // 2. Déterminer la durée du mouvement (entre 50ms et 1500ms)
      let duration = Math.floor(Math.random() * 1450 + 50);
      
      // 3. Si le mouvement avant ('w') est choisi, 50% de chance de le remplacer par arrière ('s')
      let correctionKey = null;
      let correctionDuration = 0;
      
      if (directionKeys.includes('w') && Math.random() < 0.5) {
        // Passer à 's' et augmenter légèrement la durée
        directionKeys = ['s'];
        duration += Math.floor(Math.random() * 300 + 200); // +200-500ms
        
        // Ajouter une correction 'w'
        correctionKey = 'w';
        correctionDuration = duration + 100; // +0.1s
      }
      
      // 4. Créer l'action
      const moveAction = {
        type: 'move',
        keys: directionKeys,
        duration: duration,
        correction: correctionKey,
        correctionDuration: correctionDuration
      };
      
      // 5. Exécuter l'action sur toutes les vues
      this.executeActionOnAllSynchronizedViews(moveAction);
      
      // 6. Mettre à jour l'historique des mouvements
      this.centralMovementController.recentMoves.push(directionKeys);
      if (this.centralMovementController.recentMoves.length > maxRecentMoves) {
        this.centralMovementController.recentMoves.shift();
      }
      this.centralMovementController.lastDirection = directionKeys;
      
      // 7. Planifier le prochain mouvement avec un délai aléatoire (500-1000ms)
      const totalDuration = duration + (correctionKey ? 30 + correctionDuration : 0);
      const nextDelay = totalDuration + Math.floor(Math.random() * 500 + 500);
      
      const timerId = setTimeout(() => {
        this.executeRandomMovement();
      }, nextDelay);
      
      this.centralMovementController.timeoutIds.push(timerId);
      
    } catch (error) {
      console.error('Erreur dans le mouvement aléatoire central:', error);
      
      // En cas d'erreur, essayer de continuer après un délai
      const errorRecoveryId = setTimeout(() => {
        this.executeRandomMovement();
      }, 2000);
      
      this.centralMovementController.timeoutIds.push(errorRecoveryId);
    }
  }
  
  // Méthode pour démarrer et contrôler la séquence de mouvements centrale
  startCentralMovementSequence() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log('Démarrage de la séquence de mouvements centrale');
    
    // Réinitialiser l'état du contrôleur
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.lastDirection = null;
    this.centralMovementController.recentMoves = [];
    
    // Commencer par 3 sauts
    this.executeJumpSequence(0);
  }

  // Exécuter une action sur toutes les vues synchronisées
  executeActionOnAllSynchronizedViews(action) {
    const synchronizedViews = this.getAllSynchronizedViews();
    
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Convertir l'action en JSON et échapper les caractères spéciaux
          const actionJSON = JSON.stringify(action).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          
          // Script sécurisé qui garantit que executeMovementAction est disponible
          const safeScript = `
            (function() {
              try {
                if (typeof window.executeMovementAction === 'function') {
                  return window.executeMovementAction(${actionJSON});
                } else {
                  console.error('executeMovementAction n\\'est pas disponible dans cette vue');
                  return false;
                }
              } catch (err) {
                console.error('Erreur lors de l\\'exécution de l\\'action:', err);
                return false;
              }
            })();
          `;
          
          // Exécuter le script de manière sécurisée
          view.webContents.executeJavaScript(safeScript)
            .then(result => {
              if (!result) {
                console.log(`Action non exécutée dans la vue ${view.viewNumber}, fonction non disponible`);
              }
            })
            .catch(err => {
              console.error(`Erreur lors de l'exécution de l'action dans la vue ${view.viewNumber}:`, err);
            });
        } catch (e) {
          console.error(`Erreur lors de la préparation de l'action pour la vue ${view.viewNumber}:`, e);
        }
      }
    });
  }

  // Ajouter une méthode pour ouvrir le panneau de synchronisation
  openSyncPanel() {
    if (this.syncWindow) {
      this.syncWindow.focus();
      return;
    }

    // Obtenir les dimensions de l'écran principal
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculer la largeur en fonction de la résolution
    // 350px pour 1920px de large (1080p)
    const panelWidth = Math.round((350 * screenWidth) / 1920);
    
    // Hauteur fixe pour le panneau
    const panelHeight = 800;

    this.syncWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Panneau de Synchronisation',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'syncPanelPreload.js')
      }
    });

    this.syncWindow.loadFile(path.join(__dirname, '../renderer/syncPanel.html'));

    this.syncWindow.on('closed', () => {
      this.syncWindow = null;
    });

    // Mettre à jour le panneau quand l'état change
    this.updateSyncPanel();
  }

  // Ajouter une méthode pour ouvrir le panneau de macros
  openMacroPanel() {
    if (this.macroWindow) {
      this.macroWindow.focus();
      return;
    }

    // Obtenir les dimensions de l'écran principal
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculer la largeur en fonction de la résolution
    const panelWidth = Math.round((400 * screenWidth) / 1920);
    
    // Hauteur fixe pour le panneau
    const panelHeight = 600;

    this.macroWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Panneau de Macros',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'macroPanelPreload.js')
      }
    });

    // Passer le mode de jeu actuel dans les paramètres d'URL
    this.macroWindow.loadFile(path.join(__dirname, '../renderer/macroPanel.html'), {
      query: { mode: this.config.mode }
    });

    this.macroWindow.on('closed', () => {
      this.macroWindow = null;
    });
  }

  // Ajouter une méthode pour ouvrir la page des paramètres
  openSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    // Obtenir les dimensions de l'écran principal
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculer la largeur en fonction de la résolution
    const panelWidth = Math.round((500 * screenWidth) / 1920);
    
    // Hauteur fixe pour le panneau
    const panelHeight = 400;

    this.settingsWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Paramètres du Serveur',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  // Mettre à jour les données du panneau de synchronisation
  updateSyncPanel() {
    if (!this.syncWindow) return;

    const viewsData = {
      viewsPerRow: this.viewsPerRow,
      views: this.views.map((view, index) => ({
        index: view.viewIndex,
        type: view.viewType,
        number: view.viewNumber,
        isSynchronized: view.isSynchronized
      }))
    };

    this.syncWindow.webContents.send('views-update', viewsData);
  }

  // Ajouter la méthode manquante pour mettre à jour le statut visuel de la macro
  updateControlBarMacroStatus(macroNumber, isActive) {
    // Vérifier si la barre de contrôle existe
    if (!this.gameControlBar || !this.gameControlBar.webContents) {
      console.log('Barre de contrôle non disponible pour mise à jour');
      return;
    }
    
    // Envoyer l'état de la macro à la barre de contrôle du jeu
    this.gameControlBar.webContents.send('macro-status', {
      macroId: `macro${macroNumber}`,
      running: isActive,
      timestamp: Date.now()
    });
    
    console.log(`Statut de la macro ${macroNumber} mis à jour: ${isActive ? 'active' : 'inactive'}`);
  }

  /**
   * Obtenir toutes les vues synchronisées qui sont valides
   */
  getAllSynchronizedViews() {
    try {
      // Vérifier d'abord que la configuration de synchronisation existe
      if (!this.syncConfig || !this.syncConfig.groups) {
        console.warn('Pas de configuration de synchronisation');
        return [];
      }
      
      // Trouver le groupe actif (sélectionné)
      const activeGroup = this.syncConfig.groups.find(g => g.active === true);
      if (!activeGroup || !activeGroup.views || activeGroup.views.length === 0) {
        console.warn('Aucun groupe actif ou groupe sans vues');
        return [];
      }
      
      // Récupérer les indices des vues dans le groupe actif
      const viewIndices = activeGroup.views;
      
      // Récupérer les objets de vues correspondants qui sont valides
      const synchronizedViews = viewIndices
        .map(index => this.views[index])
        .filter(view => {
          // Vérifier si la vue existe
          if (!view) return false;
          
          // BrowserView n'a pas de méthode isDestroyed, mais webContents oui
          // On vérifie donc si webContents existe et n'est pas détruit
          return view.webContents && !view.webContents.isDestroyed();
        });
      
      console.log(`Trouvé ${synchronizedViews.length} vues synchronisées valides`);
      return synchronizedViews;
    } catch (error) {
      console.error('Erreur lors de la récupération des vues synchronisées:', error);
      return [];
    }
  }

  // Fonction pour limiter la fréquence des mises à jour de position pendant le défilement
  throttledUpdateViewPositions(position) {
    const now = Date.now();
    
    // Si le défilement est très rapide (moins de 16ms entre événements), limiter la fréquence
    if (now - this.lastScrollUpdateTime < 16) {
      return;
    }
    
    this.lastScrollUpdateTime = now;
    this.scrollPosition = position;
    this.updateViewPositions();
    
    // Indiquer que nous sommes en train de défiler
    this.isScrolling = true;
    
    // Réinitialiser le timeout de défilement
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // Après 150ms sans défilement, considérer que le défilement est terminé
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.updateViewsVisibility(); // Mettre à jour la visibilité des vues une fois le défilement terminé
    }, 150);
  }
  
  // Gérer le défilement par la molette de souris
  handleWheelScroll(delta) {
    // Calculer la nouvelle position de défilement
    const newY = Math.max(0, this.scrollPosition.y + delta.y);
    const maxScroll = this.calculateMaxScrollOffset();
    
    // Limiter la position de défilement au maximum
    this.scrollPosition.y = Math.min(newY, maxScroll);
    
    // Mettre à jour les positions des vues
    this.throttledUpdateViewPositions(this.scrollPosition);
  }
  
  // Gérer le défilement par clavier
  handleKeyboardScroll(data) {
    const { key, amount } = data;
    const step = amount || 50; // Pas par défaut
    
    if (key === 'ArrowDown' || key === 'PageDown') {
      const newY = Math.min(this.scrollPosition.y + step, this.calculateMaxScrollOffset());
      this.scrollPosition.y = newY;
    } else if (key === 'ArrowUp' || key === 'PageUp') {
      const newY = Math.max(0, this.scrollPosition.y - step);
      this.scrollPosition.y = newY;
    } else if (key === 'Home') {
      this.scrollPosition.y = 0;
    } else if (key === 'End') {
      this.scrollPosition.y = this.calculateMaxScrollOffset();
    }
    
    this.throttledUpdateViewPositions(this.scrollPosition);
  }

  // Configurer les écouteurs de défilement directs depuis la fenêtre principale
  setupScrollListeners() {
    console.log('Configuration des écouteurs de défilement sur la fenêtre principale');
    
    // Écouter les événements de la molette de souris sur la fenêtre principale
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'mouseWheel') {
        console.log('Événement mouseWheel direct:', input.deltaY);
        const scrollAmount = input.deltaY * 3; // Multiplicateur pour rendre le défilement plus rapide
        
        // Envoyer l'événement de défilement via le système de throttling
        this.handleWheelScroll({ 
          x: 0, 
          y: scrollAmount 
        });
        
        event.preventDefault();
      } else if (input.type === 'keyDown') {
        // Gérer les touches de navigation
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(input.key)) {
          console.log('Événement keyDown pour navigation:', input.key);
          let amount = 50; // Pas standard
          
          if (input.key === 'PageDown' || input.key === 'PageUp') {
            amount = 200; // Pas plus grand pour Page Up/Down
          }
          
          this.handleKeyboardScroll({
            key: input.key,
            amount: amount
          });
          
          event.preventDefault();
        }
      }
    });
    
    // Communiquer la taille du conteneur au renderer
    this.window.webContents.on('did-finish-load', () => {
      console.log('Fenêtre chargée, mise à jour de la taille du conteneur');
      this.updateContainerSize();
    });
  }

  // Calculer et communiquer la taille du conteneur
  updateContainerSize() {
    const numViews = this.views.length;
    const totalHeight = this.calculateTotalContentHeight();
    
    console.log(`Mise à jour de la taille du conteneur: ${totalHeight}px pour ${numViews} vues`);
    
    // Envoyer la taille au renderer pour configurer la zone de défilement
    this.window.webContents.send('set-container-size', {
      width: this.window.getContentBounds().width,
      height: totalHeight
    });
  }

  // Calculer la hauteur totale du contenu
  calculateTotalContentHeight() {
    const numRows = Math.ceil(this.views.length / this.viewsPerRow);
    return numRows * (this.viewHeight + this.viewMargin) + this.totalControlBarHeight;
  }

  // Méthode pour mettre à jour les positions des vues
  updateViewPositions() {
    this.views.forEach((view, index) => {
      this.positionView(view, index);
    });
    
    // Mettre à jour la visibilité des vues si nous ne sommes pas en train de défiler
    if (!this.isScrolling) {
      this.updateViewsVisibility();
    }
  }
  
  // Déterminer quelles vues sont visibles et optimiser leur affichage
  updateViewsVisibility() {
    const { height } = this.window.getContentBounds();
    const visibleTop = this.scrollPosition.y;
    const visibleBottom = visibleTop + height;
    
    // Marge de préchargement (200px avant et après la zone visible)
    const bufferSize = 200;
    const expandedTop = Math.max(0, visibleTop - bufferSize);
    const expandedBottom = visibleBottom + bufferSize;
    
    this.views.forEach((view, index) => {
      const row = Math.floor(index / this.viewsPerRow);
      const viewTop = this.totalControlBarHeight + (row * (this.viewHeight + this.viewMargin));
      const viewBottom = viewTop + this.viewHeight;
      
      // Vérifier si la vue est dans la zone visible étendue
      const isVisible = (viewBottom >= expandedTop && viewTop <= expandedBottom);
      
      // Si l'état de visibilité a changé
      if (this.viewsVisibility.get(index) !== isVisible) {
        if (isVisible) {
          // La vue est devenue visible
          this.positionView(view, index);
        } else {
          // La vue n'est plus visible, la déplacer hors écran
          view.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
          
          // Déplacer aussi la control bar hors écran
          if (view.controlBar) {
            view.controlBar.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: 20 });
          }
        }
        
        // Mettre à jour l'état de visibilité
        this.viewsVisibility.set(index, isVisible);
      }
    });
  }

  // Calculer le défilement maximal
  calculateMaxScrollOffset() {
    const { height } = this.window.getContentBounds();
    const totalHeight = this.calculateTotalContentHeight();
    return Math.max(0, totalHeight - height);
  }

  setupBrowserViews() {
    const { mode, viewCount } = this.config;
    const viewsPerRow = mode === 'multiplayer' ? 5 : 4;
    
    // Calculer les dimensions des BrowserViews
    this.calculateViewDimensions(viewsPerRow, viewCount);
    
    // Créer les BrowserViews
    for (let i = 0; i < viewCount; i++) {
      this.createBrowserView(i);
      // Initialiser toutes les vues comme non visibles
      this.viewsVisibility.set(i, false);
    }
    
    // Mise à jour initiale de la visibilité
    this.updateViewsVisibility();
    
    // Mettre à jour la taille du conteneur
    this.updateContainerSize();
    
    // Créer le menu contextuel
    this.setupContextMenu();
    
    // Gérer les clics de souris pour activer les BrowserViews
    this.window.on('click', (event) => {
      // Parcourir toutes les vues visibles
      for (let i = 0; i < this.views.length; i++) {
        if (this.viewsVisibility.get(i) === true) {
          const view = this.views[i];
          const bounds = view.getBounds();
          
          // Vérifier si le clic est dans les limites de cette vue
          if (event.x >= bounds.x && event.x <= bounds.x + bounds.width &&
              event.y >= bounds.y && event.y <= bounds.y + bounds.height) {
            
            // Focaliser cette vue
            this.window.setTopBrowserView(view);
            view.webContents.focus();
            
            // Envoyer l'événement de clic à la vue
            view.webContents.sendInputEvent({
              type: 'mouseDown',
              x: event.x - bounds.x,
              y: event.y - bounds.y,
              button: 'left',
              clickCount: 1
            });
            
            view.webContents.sendInputEvent({
              type: 'mouseUp',
              x: event.x - bounds.x,
              y: event.y - bounds.y,
              button: 'left',
              clickCount: 1
            });
            
            // Arrêter la propagation si on a trouvé une vue qui correspond
            return;
          }
        }
      }
    });
  }

  calculateViewDimensions(viewsPerRow, viewCount) {
    const { width, height } = this.window.getContentBounds();
    // Les hauteurs de barres de contrôle sont déjà définies dans le constructeur
    
    // Définir les marges
    this.horizontalMargin = Math.floor(width * 0.05); // 5% de marge de chaque côté
    this.viewMargin = 10; // 10px de marge entre les vues
    
    // Déterminer le nombre de lignes nécessaires
    const rows = Math.ceil(viewCount / viewsPerRow);
    
    // Calculer l'espace disponible après les marges latérales
    const availableWidth = width - (this.horizontalMargin * 2);
    // Calculer la largeur de chaque vue en tenant compte des marges entre vues
    const totalViewMargins = (viewsPerRow - 1) * this.viewMargin;
    this.viewWidth = Math.floor((availableWidth - totalViewMargins) / viewsPerRow);
    
    // Calculer la hauteur pour maintenir un ratio 16:9 (width / 16 * 9)
    this.viewHeight = Math.floor(this.viewWidth / 16 * 9);
    
    // Toujours maintenir le ratio 16:9, même si les vues dépassent de la fenêtre
    this.rows = rows;
    this.viewsPerRow = viewsPerRow;
  }

  createBrowserView(index) {
    // Définir la partition selon le mode
    const partition = this.config.mode === 'cdl' 
      ? `persist:cdl-profile-${index}` 
      : `persist:view-${index}`;
      
    // Déterminer le type de vue (host/player) et l'état de synchronisation
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    const isHost = col === 0; // Première vue de chaque ligne est un host
    const viewType = isHost ? 'host' : 'player';
    const viewNumber = isHost ? row + 1 : (row * (this.viewsPerRow - 1)) + col;
      
    // Créer une nouvelle BrowserView
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'betterxcloudpreload.js'),
        partition: partition // Sessions indépendantes avec profil spécifique pour CDL
      }
    });
    
    // Désactiver l'auto-resize pour éviter les problèmes de focus et de souris
    view.setAutoResize({ width: false, height: false });
    
    // Définir les propriétés de type et de synchronisation
    view.viewType = viewType;      // 'host' ou 'player'
    view.viewNumber = viewNumber;  // Numéro de la vue (1-N)
    view.isSynchronized = false;   // Par défaut, les vues ne sont pas synchronisées
    view.viewIndex = index;        // Conserver l'index pour référence
    
    this.window.addBrowserView(view);
    this.views.push(view);
    
    // Positionner la vue
    this.positionView(view, index);
    
    // Créer la control bar pour cette vue
    this.createViewControlBar(view, index);
    
    // Avant de charger l'URL, configurer les paramètres de bitrate selon le type de vue
    view.webContents.on('did-finish-load', () => {
      // Vérifier si des paramètres serveur ont été définis
      const serverConfig = global.serverConfig || {
        region: 'default',
        bypassRestriction: 'off',
        hostBitrate: 5000000,
        playerBitrate: 500000,
        resolution: '720p'
      };
      
      // Déterminer le bon bitrate selon le type de vue
      const bitrate = viewType === 'host' ? serverConfig.hostBitrate : serverConfig.playerBitrate;
      
      // Envoyer la configuration à la vue
      view.webContents.send('server-config', {
        region: serverConfig.region,
        bitrate: bitrate,
        bypassRestriction: serverConfig.bypassRestriction,
        resolution: serverConfig.resolution
      });
      
      console.log(`Vue ${viewNumber} (${viewType}) - Configuration: bitrate=${bitrate}, region=${serverConfig.region}, bypassRestriction=${serverConfig.bypassRestriction}, resolution=${serverConfig.resolution}`);
      
      // Injecter directement un script pour configurer les paramètres de Better X Cloud
      const script = `
        (function() {
          try {
            console.log("Configuration directe des paramètres pour vue ${viewType}");
            
            // Récupérer les paramètres actuels ou créer un nouvel objet
            let settings = {};
            try {
              const existingSettings = localStorage.getItem("BetterXcloud");
              if (existingSettings) {
                settings = JSON.parse(existingSettings);
              }
            } catch (e) {
              console.error("Erreur lors de la récupération des paramètres:", e);
            }
            
            // Injecter les fonctions pressKey et releaseKey pour les macros
            window.pressKey = function(key) {
              console.log("PressKey appelé pour:", key);
              try {
                const element = document.documentElement;
                const keyCode = key === 'Escape' ? 27 : 
                               key === ' ' ? 32 : 
                               key === 'Enter' ? 13 :
                               key === 'Tab' ? 9 :
                               key === 'F11' ? 122 :
                               key.charCodeAt(0);
                               
                const code = key === ' ' ? 'Space' : 
                           key === 'Escape' ? 'Escape' :
                           key === 'Enter' ? 'Enter' :
                           key === 'Tab' ? 'Tab' :
                           key === 'F11' ? 'F11' :
                           'Key' + key.toUpperCase();
                           
                const event = new KeyboardEvent('keydown', {
                  key: key,
                  code: code,
                  keyCode: keyCode,
                  which: keyCode,
                  bubbles: true,
                  cancelable: true
                });
                
                element.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
                
                if (document.activeElement) {
                  document.activeElement.dispatchEvent(event);
                }
                
                return true;
              } catch(e) {
                console.error("Erreur pressKey:", e);
                return false;
              }
            };
            
            window.releaseKey = function(key) {
              console.log("ReleaseKey appelé pour:", key);
              try {
                const element = document.documentElement;
                const keyCode = key === 'Escape' ? 27 : 
                               key === ' ' ? 32 : 
                               key === 'Enter' ? 13 :
                               key === 'Tab' ? 9 :
                               key === 'F11' ? 122 :
                               key.charCodeAt(0);
                               
                const code = key === ' ' ? 'Space' : 
                           key === 'Escape' ? 'Escape' :
                           key === 'Enter' ? 'Enter' :
                           key === 'Tab' ? 'Tab' :
                           key === 'F11' ? 'F11' :
                           'Key' + key.toUpperCase();
                           
                const event = new KeyboardEvent('keyup', {
                  key: key,
                  code: code,
                  keyCode: keyCode,
                  which: keyCode,
                  bubbles: true,
                  cancelable: true
                });
                
                element.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
                
                if (document.activeElement) {
                  document.activeElement.dispatchEvent(event);
                }
                
                return true;
              } catch(e) {
                console.error("Erreur releaseKey:", e);
                return false;
              }
            };
            
            // Appliquer les paramètres
            settings["server.region"] = "${serverConfig.region}";
            settings["server.bypassRestriction"] = "${serverConfig.bypassRestriction}";
            settings["stream.video.maxBitrate"] = ${bitrate};
            settings["stream.video.resolution"] = "${serverConfig.resolution}";
            
            // Stocker les valeurs de référence
            settings["host.bitrate"] = ${serverConfig.hostBitrate};
            settings["player.bitrate"] = ${serverConfig.playerBitrate};
            
            // Sauvegarder les paramètres
            localStorage.setItem("BetterXcloud", JSON.stringify(settings));
            
            console.log("Vue ${viewType} - Paramètres configurés:", {
              type: "${viewType}",
              bitrate: ${bitrate},
              region: "${serverConfig.region}",
              resolution: "${serverConfig.resolution}"
            });
            
            return true;
          } catch (error) {
            console.error("Erreur lors de la configuration des paramètres:", error);
            return false;
          }
        })();
      `;
      
      view.webContents.executeJavaScript(script)
        .then(result => {
          console.log(`Configuration des paramètres BetterXcloud pour vue ${viewNumber} (${viewType}): ${result ? 'réussie' : 'échouée'}`);
        })
        .catch(error => {
          console.error(`Erreur lors de la configuration des paramètres pour vue ${viewNumber}:`, error);
        });
      
      // Injecter le script de spoofing fullscreen
      view.webContents.executeJavaScript(FullScreenSpooferScript)
        .then(() => {
          console.log(`FullScreen Spoofer injecté dans la vue ${index}`);
        })
        .catch(err => {
          console.error(`Erreur lors de l'injection du FullScreen Spoofer dans la vue ${index}:`, err);
        });
        
      // Injecter le script AlwaysActiveWindow
      this.injectAlwaysActiveWindow(view, index);
    });
    
    // Charger xbox.com/fr-FR/play
    view.webContents.loadURL('https://www.xbox.com/fr-FR/play/launch/call-of-duty-black-ops-6---pack-cross-gen/9PF528M6CRHQ');
    
    // Ouvrir les DevTools en mode détaché pour chaque vue
    //view.webContents.openDevTools({ mode: 'detach' });
  }

  // Créer une control bar HTML pour chaque BrowserView
  createViewControlBar(view, index) {
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Déterminer le type de label (Host pour la première vue de chaque ligne, Bot pour les autres)
    const isFirstInRow = col === 0;
    
    // Calculer le numéro de host ou de bot
    const hostNumber = row + 1; // Le numéro du host est basé sur la ligne (commence à 1)
    
    // Pour les bots, maintenir une numérotation globale de 1 à N
    let botNumber = 1;
    if (!isFirstInRow) {
      // Calculer le numéro de bot global
      // Pour chaque ligne, on a (viewsPerRow - 1) bots
      // Exemple: si viewsPerRow = 5, alors ligne 0 = bots 1-4, ligne 1 = bots 5-8, etc.
      botNumber = (row * (this.viewsPerRow - 1)) + col;
    }
    
    const label = isFirstInRow ? `Host ${hostNumber}` : `Bot ${botNumber}`;
    
    // Créer une BrowserView pour la control bar avec le preload
    const controlBar = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'viewControlBarPreload.js')
      }
    });
    
    this.window.addBrowserView(controlBar);
    
    // Charger le fichier HTML de la control bar avec le label et l'ID de la vue en paramètres
    controlBar.webContents.loadFile(
      path.join(__dirname, '../renderer/viewControlBar.html'),
      { search: `label=${encodeURIComponent(label)}&viewId=${view.viewIndex}` }
    );
    
    // Stocker la référence à cette control bar avec la vue parente
    view.controlBar = controlBar;
    
    // Positionner la control bar
    this.positionViewControlBar(view, index);
  }
  
  // Positionner la control bar d'une vue
  positionViewControlBar(view, index) {
    if (!view.controlBar) return;
    
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Calculer la position x en tenant compte des marges
    const x = this.horizontalMargin + (col * (this.viewWidth + this.viewMargin));
    
    // Calculer la position y en tenant compte des marges entre vues et du défilement
    const y = this.totalControlBarHeight + (row * (this.viewHeight + this.viewMargin)) - this.scrollPosition.y;
    
    // Hauteur de la control bar
    const controlBarHeight = 20;
    
    // Positionner la control bar au-dessus de la vue
    view.controlBar.setBounds({ 
      x, 
      y: Math.max(this.totalControlBarHeight, y), 
      width: this.viewWidth, 
      height: controlBarHeight 
    });
  }

  positionView(view, index) {
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Calculer la position x en tenant compte des marges
    const x = this.horizontalMargin + (col * (this.viewWidth + this.viewMargin));
    
    // Calculer la position y en tenant compte des marges entre vues et du défilement
    let y = this.totalControlBarHeight + (row * (this.viewHeight + this.viewMargin)) - this.scrollPosition.y;
    
    // Hauteur de la control bar de la vue
    const viewControlBarHeight = 20;
    
    // S'assurer que les vues ne dépassent pas sur les barres de contrôle
    // Si y est négatif, cela signifie que la vue remonte au-dessus des barres de contrôle
    if (y < this.totalControlBarHeight) {
      // Couper la partie qui dépasse dans les barres de contrôle
      const visibleHeight = this.viewHeight - (this.totalControlBarHeight - y);
      
      // Ne montrer que la partie visible de la vue en dessous des barres de contrôle
      if (visibleHeight > 0) {
        view.setBounds({ 
          x, 
          y: this.totalControlBarHeight + viewControlBarHeight, 
          width: this.viewWidth, 
          height: visibleHeight - viewControlBarHeight 
        });
      } else {
        // Si la vue est complètement cachée, la placer hors écran
        view.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
      }
    } else {
      // Position normale si la vue est complètement en dessous des barres de contrôle
      view.setBounds({ 
        x, 
        y: y + viewControlBarHeight, 
        width: this.viewWidth, 
        height: this.viewHeight - viewControlBarHeight 
      });
    }
    
    // Positionner également la control bar de la vue
    this.positionViewControlBar(view, index);
  }

  resizeViews() {
    // Recalculer les dimensions
    this.calculateViewDimensions(this.viewsPerRow, this.views.length);
    
    // Mettre à jour la taille du conteneur
    this.updateContainerSize();
    
    // Ajuster le défilement actuel si nécessaire
    const maxScroll = this.calculateMaxScrollOffset();
    if (this.scrollPosition.y > maxScroll) {
      this.scrollPosition.y = maxScroll;
    }
    
    // Repositionner toutes les vues
    this.updateViewPositions();
  }

  // Fonction pour injecter la fonctionnalité "Always Active Window"
  injectAlwaysActiveWindow(view, index) {
    view.webContents.executeJavaScript(AlwaysActiveWindowScript)
      .then(() => {
        console.log(`AlwaysActiveWindow injecté dans la vue ${index}`);
      })
      .catch(err => {
        console.error(`Erreur lors de l'injection du AlwaysActiveWindow dans la vue ${index}:`, err);
      });
  }

  // Ajouter la méthode setupContextMenu
  setupContextMenu() {
    const { Menu } = require('electron');
    
    // Définir le template du menu contextuel
    this.contextMenuTemplate = [
      {
        label: 'Recharger toutes les vues',
        click: () => {
          this.views.forEach(view => {
            if (view.webContents) {
              view.webContents.reload();
            }
          });
        }
      },
      {
        label: 'Rafraîchir la disposition',
        click: () => {
          this.resizeViews();
        }
      },
      { type: 'separator' },
      {
        label: 'Panneau de Synchronisation',
        click: () => {
          this.openSyncPanel();
        }
      },
      {
        label: 'Panneau de Macros',
        click: () => {
          this.openMacroPanel();
        }
      }
    ];
    
    // Créer le menu contextuel
    const contextMenu = Menu.buildFromTemplate(this.contextMenuTemplate);
    
    // Attacher le menu contextuel à la fenêtre principale
    this.window.webContents.on('context-menu', (_, params) => {
      contextMenu.popup({ window: this.window });
    });
  }

  // Méthode pour propager l'état de mouvement aux autres vues
  propagateMovementState(state, excludeView) {
    const synchronizedViews = this.getAllSynchronizedViews();
    
    synchronizedViews.forEach(view => {
      // Ne pas envoyer l'état à la vue qui l'a généré
      if (view !== excludeView && view.webContents && !view.webContents.isDestroyed()) {
        try {
          view.webContents.send('movement-state-update', state);
        } catch (e) {
          console.error(`Erreur lors de la propagation de l'état à la vue ${view.viewNumber}:`, e);
        }
      }
    });
  }

  // Gestionnaire d'événements clavier
  handleKeyboardEvent(keyEvent) {
    // Obtenir toutes les vues synchronisées
    const synchronizedViews = this.getAllSynchronizedViews();
    
    if (synchronizedViews.length === 0) {
      console.log('Aucune vue synchronisée pour transmettre les événements clavier');
      return;
    }
    
    console.log(`Transmission d'un événement clavier ${keyEvent.type} (touche: ${keyEvent.key})`);
    
    // Fonction pour obtenir le code correct pour une touche
    const getKeyCode = (key) => {
      if (key === ' ') return 'Space';
      if (key === 'Escape') return 'Escape';
      if (key === 'Shift') return 'ShiftLeft';
      if (key === 'Control') return 'ControlLeft';
      if (key === 'Alt') return 'AltLeft';
      if (key === 'Tab') return 'Tab';
      if (key === 'Enter') return 'Enter';
      if (key === 'Backspace') return 'Backspace';
      return 'Key' + key.toUpperCase();
    };
    
    // Approche directe - simuler l'exécution d'une macro
    if (keyEvent.type === 'keydown') {
      // Pour toutes les touches, on utilise l'approche avec executeJavaScript
      const script = `
        (function() {
          try {
            // On essaie d'utiliser la fonction pressKey déjà injectée par les macros
            if (typeof window.pressKey === 'function') {
              window.pressKey('${keyEvent.key}');
              return "Touche pressée via window.pressKey: ${keyEvent.key}";
            } else {
              // Fallback si la fonction n'existe pas
              const element = document.documentElement;
              const event = new KeyboardEvent('keydown', {
                key: '${keyEvent.key}',
                code: '${getKeyCode(keyEvent.key)}',
                keyCode: ${keyEvent.key === 'Escape' ? 27 : (keyEvent.key === ' ' ? 32 : keyEvent.key.charCodeAt(0))},
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              document.dispatchEvent(event);
              window.dispatchEvent(event);
              return "Touche pressée via KeyboardEvent: ${keyEvent.key}";
            }
          } catch(e) {
            return "Erreur: " + e.message;
          }
        })();
      `;
      
      // Exécuter le script dans toutes les vues synchronisées
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`Vue ${view.viewNumber} keydown:`, result))
            .catch(err => console.error(`Erreur vue ${view.viewNumber}:`, err));
        }
      });
    } else if (keyEvent.type === 'keyup') {
      // Pour les événements keyup
      const script = `
        (function() {
          try {
            // S'assurer que toutes les touches relâchées sont correctement traitées
            // On essaie d'utiliser la fonction releaseKey déjà injectée par les macros
            if (typeof window.releaseKey === 'function') {
              window.releaseKey('${keyEvent.key}');
              return "Touche relâchée via window.releaseKey: ${keyEvent.key}";
            } else {
              // Fallback si la fonction n'existe pas
              const element = document.documentElement;
              const event = new KeyboardEvent('keyup', {
                key: '${keyEvent.key}',
                code: '${getKeyCode(keyEvent.key)}',
                keyCode: ${keyEvent.key === 'Escape' ? 27 : (keyEvent.key === ' ' ? 32 : keyEvent.key.charCodeAt(0))},
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              document.dispatchEvent(event);
              window.dispatchEvent(event);
              return "Touche relâchée via KeyboardEvent: ${keyEvent.key}";
            }
          } catch(e) {
            return "Erreur: " + e.message;
          }
        })();
      `;
      
      // Exécuter le script dans toutes les vues synchronisées
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`Vue ${view.viewNumber} keyup:`, result))
            .catch(err => console.error(`Erreur vue ${view.viewNumber}:`, err));
        }
      });
    }
  }

  // Ajouter la méthode pour gérer le plein écran
  toggleViewFullscreen(view) {
    if (!view) return;
    
    console.log(`Basculement du plein écran pour la vue ${view.viewIndex}`);

    if (this.fullscreenView === view) {
      // Si la vue est déjà en plein écran, revenir à la vue normale
      console.log(`La vue ${view.viewIndex} quitte le plein écran`);
      this.exitFullscreen();
    } else {
      // Si une autre vue est en plein écran, la quitter d'abord
      if (this.fullscreenView) {
        console.log(`Sortie du plein écran pour la vue précédente ${this.fullscreenView.viewIndex}`);
        this.exitFullscreen();
      }
      // Mettre la nouvelle vue en plein écran
      console.log(`La vue ${view.viewIndex} entre en plein écran`);
      this.enterFullscreen(view);
    }
  }

  // Méthode pour entrer en plein écran
  enterFullscreen(view) {
    const { width, height } = this.window.getContentBounds();
    
    // Sauvegarder la vue en plein écran
    this.fullscreenView = view;
    
    // Cacher toutes les autres vues
    this.views.forEach(v => {
      if (v !== view) {
        v.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
        if (v.controlBar) {
          v.controlBar.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: 20 });
        }
      }
    });
    
    // Positionner la barre de contrôle de la vue au-dessus des autres éléments
    const controlBarHeight = 20;
    
    // Récupérer la barre de contrôle du jeu et la rendre visible au-dessus des autres éléments
    if (this.gameControlBar) {
      this.window.setTopBrowserView(this.gameControlBar); // Mettre la barre de jeu au-dessus
    }
    
    // Positionner la barre de contrôle de vue au premier plan
    if (view.controlBar) {
      this.window.setTopBrowserView(view.controlBar); // S'assurer que la barre de contrôle est au-dessus
      view.controlBar.setBounds({
        x: 0,
        y: 0, // Positionner tout en haut de la fenêtre, au-dessus de tout
        width: width,
        height: controlBarHeight
      });
    }
    
    // Mettre la vue sélectionnée en plein écran
    view.setBounds({
      x: 0,
      y: this.totalControlBarHeight, // Utiliser la hauteur totale des barres de contrôle
      width: width,
      height: height - this.totalControlBarHeight // Ajuster la hauteur pour ne pas déborder
    });
    
    // Place la vue sous la barre de contrôle mais au-dessus des autres éléments
    this.window.setTopBrowserView(view); 
    
    // S'assurer que la barre de vue reste au-dessus de tout
    if (view.controlBar) {
      this.window.setTopBrowserView(view.controlBar);
      
      // Mettre à jour l'icône du bouton plein écran
      view.controlBar.webContents.executeJavaScript(`
        document.getElementById('fullscreen-btn').innerHTML = '<span>⮌</span>';
      `);
    }
  }

  // Méthode pour quitter le plein écran
  exitFullscreen() {
    if (!this.fullscreenView) return;
    
    // Réinitialiser la vue en plein écran
    const view = this.fullscreenView;
    this.fullscreenView = null;
    
    // Repositionner toutes les vues
    this.updateViewPositions();
    
    // Mettre à jour l'icône du bouton plein écran
    if (view.controlBar) {
      view.controlBar.webContents.executeJavaScript(`
        document.getElementById('fullscreen-btn').innerHTML = '<span>⛶</span>';
      `);
    }
  }

  // Méthode pour recharger les paramètres et mettre à jour les vues
  reloadSettingsAndUpdateViews() {
    console.log('Rechargement des paramètres et mise à jour des vues');
    // Exécuter un script dans la fenêtre principale pour récupérer les paramètres
    this.window.webContents.executeJavaScript(`
      (function() {
        try {
          const betterXcloudSettings = localStorage.getItem('BetterXcloud');
          if (betterXcloudSettings) {
            console.log('Paramètres BetterXcloud rechargés:', betterXcloudSettings);
            return betterXcloudSettings;
          }
          return null;
        } catch(err) {
          console.error('Erreur lors de la récupération des paramètres:', err);
          return null;
        }
      })()
    `).then(result => {
      if (result) {
        try {
          const settings = JSON.parse(result);
          console.log('Paramètres chargés:', settings);
          
          // Mettre à jour la configuration du serveur
          if (settings["server.region"]) {
            global.serverConfig.region = settings["server.region"];
          }
          
          if (settings["server.bypassRestriction"]) {
            global.serverConfig.bypassRestriction = settings["server.bypassRestriction"];
          }
          
          // Récupérer la résolution vidéo
          if (settings["stream.video.resolution"]) {
            global.serverConfig.resolution = settings["stream.video.resolution"];
          }
          
          // Récupérer les valeurs de bitrate
          if (settings["host.bitrate"]) {
            global.serverConfig.hostBitrate = settings["host.bitrate"];
          }
          
          if (settings["player.bitrate"]) {
            global.serverConfig.playerBitrate = settings["player.bitrate"];
          }
          
          console.log('Configuration du serveur mise à jour:', global.serverConfig);
          
          // Mettre à jour toutes les vues avec la nouvelle configuration
          this.updateServerConfigInViews();
        } catch (error) {
          console.error('Erreur lors du parsing des paramètres:', error);
        }
      }
    }).catch(err => {
      console.error('Erreur lors de l\'exécution du script de récupération des paramètres:', err);
    });
  }
  
  // Mettre à jour la configuration du serveur dans toutes les vues
  updateServerConfigInViews() {
    console.log('Mise à jour de la configuration du serveur dans toutes les vues');
    
    // Récupérer la configuration actuelle
    const serverConfig = global.serverConfig || {
      region: 'default',
      bypassRestriction: 'off',
      hostBitrate: 5000000,
      playerBitrate: 500000
    };
    
    // Mettre à jour toutes les vues existantes
    this.views.forEach(view => {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Déterminer le bitrate en fonction du type de vue
          const bitrate = view.viewType === 'host' ? serverConfig.hostBitrate : serverConfig.playerBitrate;
          
          // Envoyer la configuration à la vue via IPC
          view.webContents.send('server-config', {
            region: serverConfig.region,
            bitrate: bitrate,
            bypassRestriction: serverConfig.bypassRestriction,
            resolution: serverConfig.resolution
          });
          
          // Injecter directement un script qui applique les paramètres dans le localStorage
          const injectionScript = `
            (function() {
              try {
                console.log("Injection directe des paramètres serveur");
                
                // Récupérer les paramètres actuels
                let settings = {};
                try {
                  const existingSettings = localStorage.getItem("BetterXcloud");
                  if (existingSettings) {
                    settings = JSON.parse(existingSettings);
                  }
                } catch (e) {
                  console.error("Erreur lors de la récupération des paramètres existants:", e);
                }
                
                // Mettre à jour les paramètres avec la nouvelle configuration
                settings["server.region"] = "${serverConfig.region}";
                settings["server.bypassRestriction"] = "${serverConfig.bypassRestriction}";
                
                // Appliquer le bitrate en fonction du type de vue
                settings["stream.video.maxBitrate"] = ${bitrate};
                console.log("Bitrate injecté pour vue ${view.viewType}:", ${bitrate});
                
                // Stocker les valeurs de référence pour les paramètres
                settings["host.bitrate"] = ${serverConfig.hostBitrate};
                settings["player.bitrate"] = ${serverConfig.playerBitrate};
                
                // Appliquer la résolution depuis la configuration du serveur
                settings["stream.video.resolution"] = "${serverConfig.resolution}";
                console.log("Résolution appliquée:", "${serverConfig.resolution}");
                
                // Sauvegarder les paramètres mis à jour
                localStorage.setItem("BetterXcloud", JSON.stringify(settings));
                
                console.log("Paramètres serveur mis à jour dans le localStorage:", 
                  { 
                    region: "${serverConfig.region}", 
                    bypassRestriction: "${serverConfig.bypassRestriction}", 
                    bitrate: ${bitrate},
                    resolution: settings["stream.video.resolution"]
                  });
                
                return true;
              } catch (error) {
                console.error("Erreur lors de l'injection directe des paramètres serveur:", error);
                return false;
              }
            })();
          `;
          
          // Exécuter le script dans la vue
          view.webContents.executeJavaScript(injectionScript)
            .then(result => {
              console.log(`Vue ${view.viewNumber} (${view.viewType}) - Injection directe des paramètres: ${result ? 'réussie' : 'échouée'}`);
              
              // Recharger la page pour appliquer les nouveaux paramètres
              view.webContents.reload();
            })
            .catch(error => {
              console.error(`Erreur lors de l'exécution du script d'injection dans la vue ${view.viewNumber}:`, error);
            });
          
          console.log(`Vue ${view.viewNumber} (${view.viewType}) - Configuration mise à jour: region=${serverConfig.region}, bypassRestriction=${serverConfig.bypassRestriction}, bitrate=${bitrate}`);
        } catch (error) {
          console.error(`Erreur lors de la mise à jour de la vue ${view.viewNumber}:`, error);
        }
      }
    });
  }
}

// Fonction pour créer une nouvelle instance de MainViewWindow
function createMainViewWindow(config) {
  return new MainViewWindow(config);
}

// Exporter la classe et la fonction
module.exports = {
  MainViewWindow,
  createMainViewWindow
}; 


