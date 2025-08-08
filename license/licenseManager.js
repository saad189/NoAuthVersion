const { BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const config = require('./config');

// Import des services modulaires
const ApiService = require('./modules/apiService');
const HardwareService = require('./modules/hardwareService');
const StorageService = require('./modules/storageService');
const GameModeService = require('./modules/gameModeService');
const EventService = require('./modules/eventService');
const LicenseValidator = require('./modules/licenseValidator');
const UpdateService = require('./modules/updateService');

/**
 * Gestionnaire de licence principal
 */
class LicenseManager {
  constructor(options = {}) {
    this.mainWindow = null;
    this.options = {
      licenseServerUrl: config.server.licenseValidation,
      activationServerUrl: config.server.licenseActivation,
      ...options
    };

    // Initialiser les services
    this.initializeServices();
    
    // Initialiser les écouteurs d'événements IPC
    this.initIPCListeners();
    
    this._log('Gestionnaire de licence initialisé');
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[licenseManager] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    if (error) {
      console.error(`[licenseManager] ${message}`, error);
    } else {
      console.error(`[licenseManager] ${message}`);
    }
  }

  /**
   * Initialise les services modulaires
   */
  initializeServices() {
    // Service de stockage
    this.storageService = new StorageService();
    
    // Récupérer les données stockées
    const { licenseKey, hardwareId, licenseStatus } = this.storageService.getLicenseData();
    this.licenseKey = licenseKey;
    this.hardwareId = hardwareId;
    this.licenseStatus = licenseStatus;
    
    // Service d'identification matérielle
    this.hardwareService = new HardwareService();
    
    // Service d'événements
    this.eventService = new EventService(this.mainWindow);
    
    // Service API
    this.apiService = new ApiService(this.options);
    
    // Service de validation de licence
    this.licenseValidator = new LicenseValidator(this.apiService, this.eventService);
    
    // Service de gestion des modes de jeu
    this.gameModeService = new GameModeService(() => this.licenseStatus);

    // Service de gestion des mises à jour
    this.updateService = new UpdateService();
    
    this._log('Services initialisés');
  }

  /**
   * Affiche la fenêtre de vérification de licence
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  async showLicenseWindow() {
    this._log('[FAKE] Bypassing license window and granting access automatically');

    this.licenseStatus = {
      valid: true,
      licenseKey: 'BYPASSED-KEY',
      hardwareId: await this.getHardwareId(),
      activationDate: new Date().toISOString()
    };

    // Simulate launching BotLobby immediately (if that was part of the flow)
    try {
      const botLobby = require('../botlobby/modules');
      const coordinator = botLobby.getBotLobbyCoordinator();

      if (coordinator) {
        this._log('[FAKE] Launching BotLobby window directly');
        coordinator.createBotLobbyWindow();
      }
    } catch (error) {
      this._logError('[FAKE] Failed to launch BotLobby', error);
    }

    return this.licenseStatus;
  }


  /**
   * Initialise les écouteurs d'événements IPC
   */
  initIPCListeners() {
    this._log('Initialisation des écouteurs d\'événements IPC');
    
    // Ajout d'un gestionnaire pour le changement de langue
    ipcMain.handle('change-language', async (event, language) => {
      this._log(`Changement de langue demandé: ${language}`);
      try {
        // Mettre à jour la langue dans le service de mise à jour
        if (this.updateService) {
          await this.updateService.setLanguage(language);
        }
        return { success: true, language };
      } catch (error) {
        this._logError(`Erreur lors du changement de langue: ${language}`, error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('validate-license', async (event, licenseKey) => {
      this._log(`Demande de validation de licence reçue: ${licenseKey.substring(0, 4)}...`);
      const hardwareId = this.hardwareId || await this.getHardwareId();
      this.licenseKey = licenseKey;
      
      // Sauvegarder la clé de licence
      this.storageService.saveLicenseKey(licenseKey);
      
      // Vérifier si c'est la première utilisation ou utilisation ultérieure
      let licenseResult;
      if (!this.licenseStatus || !this.licenseStatus.valid) {
        this._log('Première utilisation ou licence invalide, activation en cours');
        licenseResult = await this.activateLicense(licenseKey, hardwareId);
      } else {
        this._log('Licence déjà activée, validation en cours');
        licenseResult = await this.validateLicense(licenseKey, hardwareId);
      }
      
      return licenseResult;
    });

    ipcMain.handle('get-license-status', () => {
      this._log('Demande de statut de licence reçue');
      return this.licenseStatus;
    });

    ipcMain.handle('get-saved-license', () => {
      this._log('Demande de licence sauvegardée reçue');
      return this.licenseKey;
    });

    ipcMain.handle('get-hardware-id', async () => {
      this._log('Demande d\'ID matériel reçue');
      return this.hardwareId || await this.getHardwareId();
    });

    ipcMain.handle('get-activation-date', () => {
      this._log('Demande de date d\'activation reçue');
      return this.licenseStatus ? this.licenseStatus.activationDate : null;
    });
    
    // Gestionnaires pour les modes de jeu
    ipcMain.handle('is-game-mode-available', (event, mode) => {
      this._log(`Vérification de disponibilité du mode de jeu: ${mode}`);
      return this.gameModeService.isGameModeAvailable(mode);
    });
    
    ipcMain.handle('get-available-game-modes', () => {
      this._log('Demande des modes de jeu disponibles');
      return this.gameModeService.getAvailableGameModes();
    });

    // Gestionnaire pour les mises à jour - Utilisation du service UpdateService
    ipcMain.handle('check-for-updates', async () => {
      try {
        this._log('Demande de vérification des mises à jour');
        return await this.updateService.checkForUpdates(false, false);
      } catch (error) {
        this._logError('Erreur lors de la vérification des mises à jour:', error);
        throw error;
      }
    });

    ipcMain.handle('get-version-history', async (event, limit = 5) => {
      try {
        this._log('Demande de récupération de l\'historique des versions');
        return await this.updateService.getVersionHistory(limit);
      } catch (error) {
        this._logError('Erreur lors de la récupération de l\'historique des versions:', error);
        return { 
          success: false, 
          message: `Erreur: ${error.message}`,
          versions: [],
          currentVersion: require('electron').app.getVersion()
        };
      }
    });

    ipcMain.handle('download-update', async (event, updateInfo) => {
      try {
        this._log('Demande de téléchargement de mise à jour reçue');
        return await this.updateService.downloadUpdate(updateInfo);
      } catch (error) {
        this._logError('Erreur lors du téléchargement de la mise à jour:', error);
        throw error;
      }
    });

    ipcMain.handle('clear-license', () => {
      this._log('Demande d\'effacement des données de licence reçue');
      this.licenseKey = null;
      this.licenseStatus = null;
      this.storageService.clearLicenseData();
      return true;
    });
    
    ipcMain.handle('open-external-link', async (event, url) => {
      try {
        this._log(`Ouverture d'un lien externe: ${url}`);
        const { shell } = require('electron');
        await shell.openExternal(url);
        return true;
      } catch (error) {
        this._logError('Erreur lors de l\'ouverture du lien externe:', error);
        return false;
      }
    });

    ipcMain.on('quit-app', () => {
      this._log('Demande de quitter l\'application reçue');
      require('electron').app.quit();
    });
  }

  /**
   * Récupère ou génère l'identifiant matériel
   * @returns {Promise<string>} - L'identifiant matériel
   */
  async getHardwareId() {
    if (this.hardwareId) {
      this._log(`Utilisation de l'ID matériel existant: ${this.hardwareId.substring(0, 8)}...`);
      return this.hardwareId;
    }
    
    this._log('Génération d\'un nouvel ID matériel');
    this.hardwareId = await this.hardwareService.generateHardwareId();
    this.storageService.saveHardwareId(this.hardwareId);
    
    return this.hardwareId;
  }

  /**
   * Active une licence
   * @param {string} licenseKey - Clé de licence à activer
   * @param {string} hardwareId - ID matériel
   * @returns {Promise<Object>} - Statut de licence
   */
  async activateLicense(licenseKey, hardwareId) {
  this._log(`[FAKE] Activation de la licence acceptée automatiquement`);

    const licenseStatus = {
      valid: true,
      licenseKey,
      hardwareId,
      activationDate: new Date().toISOString()
    };

  this.licenseStatus = licenseStatus;
  this.storageService.saveLicenseStatus(licenseStatus);
  
  return licenseStatus;
}


  /**
   * Valide une licence existante
   * @param {string} licenseKey - Clé de licence à valider
   * @param {string} hardwareId - ID matériel
   * @returns {Promise<Object>} - Statut de licence
   */
  async validateLicense(licenseKey, hardwareId) {
    this._log(`[FAKE] Validation de la licence acceptée automatiquement`);

    const licenseStatus = {
      valid: true,
      licenseKey,
      hardwareId,
      activationDate: this.licenseStatus?.activationDate || new Date().toISOString()
    };

    this.licenseStatus = licenseStatus;
    this.storageService.saveLicenseStatus(licenseStatus);
  
    return licenseStatus;
  }

}

module.exports = LicenseManager; 