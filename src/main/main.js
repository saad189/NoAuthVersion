const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const SelectionWindow = require('./selectionWindow');
const MainViewWindow = require('./mainViewWindow');
const { createMainViewWindow } = require('./mainViewWindow');
const LicenseManager = require('../license/licenseManager');

// Définir le chemin de l'icône de l'application
const iconPath = path.join(__dirname, '../../build/icon.ico');

let selectionWindow = null;
let mainViewWindow = null;
let macroActive = false;
let macroInterval = null;
let licenseManager = null;

// Fonction pour créer le menu de l'application
function createApplicationMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' }
      ]
    },
    {
      label: 'Outils',
      submenu: [
        {
          label: 'Panneau de Synchronisation',
          click: () => {
            if (mainViewWindow) {
              mainViewWindow.openSyncPanel();
            }
          }
        },
        {
          label: 'Gestion de Licence',
          click: () => {
            if (licenseManager) {
              //licenseManager.showLicenseWindow();
            }
          }
        },
        {
          label: 'Réinitialiser Licence',
          click: () => {
            if (licenseManager) {
              // Effacer les données de licence
              licenseManager.store.delete('licenseKey');
              licenseManager.store.delete('licenseStatus');
              // Afficher un message de confirmation
              const resetWindow = new BrowserWindow({
                width: 300,
                height: 150,
                autoHideMenuBar: true,
                resizable: false,
                modal: true
              });
              resetWindow.loadURL(`data:text/html;charset=utf-8,
                <html>
                  <head>
                    <style>
                      body { font-family: sans-serif; padding: 20px; text-align: center; }
                      button { margin-top: 15px; padding: 8px 15px; }
                    </style>
                  </head>
                  <body>
                    <h3>Licence réinitialisée</h3>
                    <p>Redémarrez l'application pour appliquer les changements.</p>
                    <button onclick="window.close()">OK</button>
                  </body>
                </html>
              `);
            }
          }
        }
      ]
    },
    {
      role: 'help',
      label: 'Aide',
      submenu: [
        {
          label: 'À propos',
          click: () => {
            // Afficher une fenêtre avec des informations sur l'application
            const aboutWindow = new BrowserWindow({
              width: 300,
              height: 200,
              title: 'À propos',
              autoHideMenuBar: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: true
              }
            });
            aboutWindow.loadFile(path.join(__dirname, '../renderer/about.html'));
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createSelectionWindow() {
  selectionWindow = new SelectionWindow();
  selectionWindow.window.on('closed', () => {
    selectionWindow = null;
  });
}

// Vérifier la licence avant de lancer l'application
async function checkLicense() {
  // Initialiser le gestionnaire de licence s'il n'existe pas déjà
  if (!licenseManager) {
    licenseManager = new LicenseManager();

    // 🎭 Spoof internal license status manually
    licenseManager.checkExistingLicense = () => ({
      valid: true,
      licenseKey: 'SPOOFED-KEY',
      activationDate: new Date().toISOString(),
      hardwareId: 'FAKE-HWID'
    });

    // 🧨 Optional: patch the activation function in case it's called elsewhere
    licenseManager.activateLicense = async () => ({
      valid: true,
      licenseKey: 'SPOOFED-KEY',
      activationDate: new Date().toISOString(),
      hardwareId: 'FAKE-HWID'
    });

    // Optional: patch showLicenseWindow() to avoid UI popup
    licenseManager.showLicenseWindow = async () => ({
      valid: true,
      licenseKey: 'SPOOFED-KEY',
      activationDate: new Date().toISOString(),
      hardwareId: 'FAKE-HWID'
    });
  }

  // ✅ Continue as if license is valid
  console.log('[FAKE LICENSE] Licence valide simulée, démarrage de l\'application...');
  createSelectionWindow();
  createApplicationMenu();
  setupIPCHandlers();
}


app.whenReady().then(() => {
  // Définir l'icône pour toute l'application
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName());
  }
  
  // Vérifier la licence avant de lancer l'application
  checkLicense();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Vérifier à nouveau la licence si aucune fenêtre n'est ouverte
      checkLicense();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Ajouter les écouteurs d'événements IPC
function setupIPCHandlers() {
  // Événement pour démarrer une session
  ipcMain.on('start-session', (event, config) => {
    createMainViewWindow(config);
    selectionWindow.window.close();
  });
  
  // Événement pour ouvrir le panneau de synchronisation
  ipcMain.on('open-sync-panel', () => {
    if (mainViewWindow) {
      mainViewWindow.openSyncPanel();
    }
  });
  
  // Événement pour exécuter une macro
  ipcMain.on('execute-macro', (event, data) => {
    const { macroId, gameMode } = data;
    
    if (mainViewWindow) {
      // Utiliser le macroManager pour exécuter la macro
      mainViewWindow.executeMacro(macroId, gameMode);
    }
  });
  
  // Événement pour recevoir les paramètres de bitrate
  ipcMain.on('update-bitrate-settings', (event, settings) => {
    console.log('Paramètres de bitrate reçus:', settings);
    
    // Stocker les paramètres dans une variable globale pour les futures vues
    global.serverConfig = {
      region: settings.region,
      hostBitrate: settings.hostBitrate,
      playerBitrate: settings.playerBitrate
    };
    
    // Mettre à jour les vues existantes si elles existent
    if (mainViewWindow && mainViewWindow.views) {
      mainViewWindow.views.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          // Déterminer le bitrate selon le type de vue
          const bitrate = view.viewType === 'host' ? settings.hostBitrate : settings.playerBitrate;
          
          // Envoyer la nouvelle configuration à la vue
          view.webContents.send('server-config', {
            region: settings.region,
            bitrate: bitrate,
            bypassRestriction: 'off'
          });
          
          console.log(`Configuration envoyée à la vue ${view.viewNumber} (${view.viewType}): bitrate=${bitrate}, region=${settings.region}`);
        }
      });
    }
  });
  
  // Événement pour demander l'état des vues
  ipcMain.on('request-views-state', (event) => {
    if (mainViewWindow) {
      mainViewWindow.updateSyncPanel();
    }
  });
  
  // Événement pour synchroniser les vues
  ipcMain.on('synchronize-views', (event, selectedIndices) => {
    if (mainViewWindow) {
      mainViewWindow.synchronizeViews(selectedIndices);
    }
  });
  
  // Événements pour les touches clavier synchronisées
  ipcMain.on('keyboard-event', (event, keyEvent) => {
    if (mainViewWindow) {
      mainViewWindow.handleSynchronizedKeyboard(keyEvent);
    }
  });
  
  // Gérer le défilement du conteneur principal
  ipcMain.on('container-scrolled', (event, position) => {
    if (mainViewWindow) {
      mainViewWindow.handleContainerScroll(position);
    }
  });
  
  // Gérer les événements de la molette
  ipcMain.on('wheel-scrolled', (event, delta) => {
    if (mainViewWindow) {
      mainViewWindow.handleWheelScroll(delta);
    }
  });
  
  // Gérer les événements clavier pour le défilement
  ipcMain.on('keyboard-scroll', (event, data) => {
    if (mainViewWindow) {
      mainViewWindow.handleKeyboardScroll(data);
    }
  });
}

ipcMain.on('sync-scroll', (event, scrollPos) => {
  if (mainViewWindow) {
    mainViewWindow.syncScroll(scrollPos);
  }
});

// Gestionnaire pour la macro de simulation de touches
ipcMain.on('toggle-macro', (event, enabled) => {
  if (enabled) {
    startMacro();
  } else {
    stopMacro();
  }
});

// Fonction pour démarrer la macro
function startMacro() {
  if (macroActive || !mainViewWindow) return;
  
  macroActive = true;
  
  // Notifier l'interface que la macro est active
  if (mainViewWindow && mainViewWindow.window) {
    mainViewWindow.window.webContents.send('macro-status-change', { enabled: true });
  }
  
  // Tableau des touches à simuler en rotation
  const mainKeys = ['a', 's', 'd', 'w'];
  const randomKeys = ['a', 's', 'd', 'w', 'q', 'e', 'z', 'x', 'c', 'space', 'shift', 'control'];
  let currentKeyIndex = 0;
  
  // Fonction pour simuler une touche principale pendant 500ms
  const simulateMainKey = () => {
    if (!macroActive || !mainViewWindow) return;
    
    const key = mainKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % mainKeys.length;
    
    // Simuler la touche enfoncée
    mainViewWindow.views.forEach(view => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        
        // Relâcher la touche après 500ms
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
          }
        }, 500);
      }
    });
  };
  
  // Fonction pour simuler une touche aléatoire
  const simulateRandomKey = () => {
    if (!macroActive || !mainViewWindow) return;
    
    const key = randomKeys[Math.floor(Math.random() * randomKeys.length)];
    
    mainViewWindow.views.forEach(view => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        
        // Relâcher la touche après 100ms
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
          }
        }, 100);
      }
    });
  };
  
  // Démarrer l'intervalle pour simuler les touches principales
  const mainKeyInterval = setInterval(simulateMainKey, 2000); // toutes les 2 secondes
  
  // Démarrer l'intervalle pour simuler les touches aléatoires
  const randomKeyInterval = setInterval(simulateRandomKey, 1000); // toutes les 1 seconde
  
  macroInterval = {
    mainKeyInterval,
    randomKeyInterval
  };
}

// Fonction pour arrêter la macro
function stopMacro() {
  if (!macroActive) return;
  
  macroActive = false;
  
  // Notifier l'interface que la macro est inactive
  if (mainViewWindow && mainViewWindow.window) {
    mainViewWindow.window.webContents.send('macro-status-change', { enabled: false });
  }
  
  // Arrêter les intervalles
  if (macroInterval) {
    if (macroInterval.mainKeyInterval) clearInterval(macroInterval.mainKeyInterval);
    if (macroInterval.randomKeyInterval) clearInterval(macroInterval.randomKeyInterval);
    macroInterval = null;
  }
} 