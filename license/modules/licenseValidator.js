const config = require('../config');

/**
 * Service de validation de licence
 */
class LicenseValidator {
  constructor(apiService, eventService) {
    this.apiService = apiService;
    this.eventService = eventService;
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[licenseValidator] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    if (error) {
      console.error(`[licenseValidator] ${message}`, error);
    } else {
      console.error(`[licenseValidator] ${message}`);
    }
  }

  /**
   * Traite le résultat de validation et met à jour le statut de licence
   * @param {Object} result - Résultat de l'API de validation
   * @returns {Object} - Statut de licence formaté
   */
  processLicenseResult(result) {
    if (result.valid) {
      this._logSuccessfulValidation(result);
    } else {
      this._logFailedValidation(result);
    }

    return {
      valid: result.valid,
      expiration: result.expiration,
      clientId: result.clientId,
      clientName: result.clientName,
      activationDate: result.activationDate,
      timestamp: new Date().toISOString(),
      gameModes: result.gameModes || config.defaultGameModes
    };
  }

  /**
   * Active une licence
   * @param {string} licenseKey - Clé de licence à activer
   * @param {string} hardwareId - ID matériel
   * @param {Object} currentLicenseStatus - Statut de licence actuel (optionnel)
   * @returns {Promise<Object>} - Résultat de l'activation
   */
  async activateLicense(licenseKey, hardwareId, currentLicenseStatus = null) {
    try {
      this._log(`Début de l'activation de licence (${licenseKey.substring(0, 4)}...)`);
      this.eventService.sendLicenseChecking();

      if (currentLicenseStatus && currentLicenseStatus.valid) {
        this._log('La licence a déjà été activée, utilisation de la validation standard');
        return this.validateLicense(licenseKey, hardwareId);
      }

      // Inclure la date d'activation actuelle avec la requête
      const activationDate = new Date().toISOString();
      this._log(`Date d'activation proposée: ${activationDate}`);
      
      const result = await this.apiService.activateLicense(licenseKey, hardwareId, activationDate);
      this._log(`Résultat d'activation reçu, traitement en cours`);
      
      const licenseStatus = this.processLicenseResult(result);
      
      this.eventService.sendLicenseResult(result);
      
      return licenseStatus;
    } catch (error) {
      this._logError(`Erreur lors de l'activation de la licence: ${error.message || 'Erreur inconnue'}`, error);
      
      const errorStatus = {
        valid: false,
        message: error.message || 'Erreur d\'activation'
      };
      
      this.eventService.sendLicenseError(errorStatus.message);
      
      return errorStatus;
    }
  }

  /**
   * Valide une licence existante
   * @param {string} licenseKey - Clé de licence à valider
   * @param {string} hardwareId - ID matériel
   * @returns {Promise<Object>} - Statut de licence mis à jour
   */
  async validateLicense(licenseKey, hardwareId) {
    try {
      this._log(`Début de la validation de licence (${licenseKey.substring(0, 4)}...)`);
      this.eventService.sendLicenseChecking();
      
      const result = await this.apiService.validateLicense(licenseKey, hardwareId);
      this._log(`Résultat de validation reçu, traitement en cours`);
      
      const licenseStatus = this.processLicenseResult(result);
      
      this.eventService.sendLicenseResult(result);
      
      return licenseStatus;
    } catch (error) {
      this._logError(`Erreur lors de la validation de la licence: ${error.message || 'Erreur inconnue'}`, error);
      
      const errorStatus = {
        valid: false,
        message: error.message || 'Erreur de validation'
      };
      
      this.eventService.sendLicenseError(errorStatus.message);
      
      return errorStatus;
    }
  }

  /**
   * Journalise une validation réussie
   * @private
   * @param {Object} result - Résultat de validation
   */
  _logSuccessfulValidation(result) {
    this._log('✅ Vérification de licence réussie');
    this._log(`Client: ${result.clientName || 'Non spécifié'} (ID: ${result.clientId || 'Non spécifié'})`);
    this._log(`Date d'activation: ${result.activationDate || 'Non spécifiée'}`);
    this._log(`Date d'expiration: ${result.expiration || 'Non spécifiée'}`);
    
    if (result.gameModes) {
      this._log(`Modes de jeu disponibles: ${
        Object.entries(result.gameModes)
          .filter(([_, enabled]) => enabled)
          .map(([mode]) => mode)
          .join(', ') || 'Aucun'
      }`);
    }
  }

  /**
   * Journalise une validation échouée
   * @private
   * @param {Object} result - Résultat de validation
   */
  _logFailedValidation(result) {
    this._log('❌ Échec de la vérification de licence');
    this._log(`Message d'erreur: ${result.message || 'Aucun message d\'erreur'}`);
  }
}

module.exports = LicenseValidator; 