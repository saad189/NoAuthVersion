/**
 * Configuration globale du système de licence
 * Ce fichier centralise toutes les constantes de l'application
 * pour éviter les duplications et faciliter les modifications futures
 */

const path = require('path');

module.exports = {
  // URLs pour le serveur de licence
  server: {
    baseUrl: 'XXXXXXXX',
    licenseValidation: 'XXXXXXXX',
    licenseActivation: 'XXXXXXXX',
    purchaseUrl: 'XXXXXXXX'
  },

  // Configuration du stockage
  storage: {
    name: 'license-data',
    encryptionKey: 'app-license-secure-key'
  },

  // Modes de jeu par défaut
  defaultGameModes: {
    multiplayer: false,
    warzone: false,
    cdl: false
  },

  // Timeouts pour les requêtes API (en ms)
  timeouts: {
    apiRequest: 10000
  },

  // Chemins des fichiers
  paths: {
    licenseView: path.join(__dirname, 'licenseView.html'),
    licensePreload: path.join(__dirname, 'licensePreload.js'),
    appIcon: path.join(__dirname, '../assets/icon.ico')
  },

  // Configuration de la fenêtre de licence
  licenseWindow: {
    width: 800,
    height: 1200,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Le chemin du preload sera défini dynamiquement
    }
  },

  // Niveaux de log (pour une implémentation future de filtrage)
  logLevels: {
    DEBUG: 0, 
    INFO: 1,
    WARNING: 2,
    ERROR: 3
  },

  // Autres constantes
  constants: {
    licenseNotValidError: 'Vérification de licence abandonnée'
  }
}; 