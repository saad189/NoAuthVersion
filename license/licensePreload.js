const { contextBridge, ipcRenderer } = require('electron');

// Définir les API exposées au renderer
const licenseAPI = {
  // Validation de licence
  validateLicense: (licenseKey) => ipcRenderer.invoke('validate-license', licenseKey),
  
  // Récupération d'informations de licence
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  getSavedLicense: () => ipcRenderer.invoke('get-saved-license'),
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  getActivationDate: () => ipcRenderer.invoke('get-activation-date'),
  
  // Gestion des modes de jeu
  isGameModeAvailable: (mode) => ipcRenderer.invoke('is-game-mode-available', mode),
  getAvailableGameModes: () => ipcRenderer.invoke('get-available-game-modes'),
  
  // Gestion des mises à jour
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (updateInfo) => ipcRenderer.invoke('download-update', updateInfo),
  getVersionHistory: (limit = 5) => ipcRenderer.invoke('get-version-history', limit),
  
  // Gestion des langues
  changeLanguage: (language) => ipcRenderer.invoke('change-language', language),
  
  // Actions diverses
  clearLicense: () => ipcRenderer.invoke('clear-license'),
  signalLicenseValidated: () => ipcRenderer.send('license-validated'),
  quitApp: () => ipcRenderer.send('quit-app'),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // Écouteurs d'événements - Licence
  onLicenseResult: createEventListener('license-result'),
  onLicenseChecking: createEventListener('license-checking'),
  onLicenseError: createEventListener('license-error'),
  
  // Écouteurs d'événements - Mises à jour
  onUpdateCheckResult: createEventListener('update-check-result'),
  onUpdateCheckError: createEventListener('update-check-error')
};

/**
 * Crée un wrapper pour les écouteurs d'événements
 * @param {string} eventName - Nom de l'événement
 * @returns {Function} - Fonction d'écoute d'événement
 */
function createEventListener(eventName) {
  return (callback) => {
    const eventHandler = (_, data) => callback(data);
    ipcRenderer.on(eventName, eventHandler);
    
    // Retourne une fonction pour supprimer l'écouteur
    return () => ipcRenderer.removeListener(eventName, eventHandler);
  };
}

// Exposer les API sécurisées au processus renderer
contextBridge.exposeInMainWorld('licenseAPI', licenseAPI); 