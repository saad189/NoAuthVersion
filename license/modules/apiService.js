const axios = require('axios');
const config = require('../config');

/**
 * Service de gestion des appels API pour la vérification de licence
 */
class ApiService {
  constructor(options = {}) {
    this.options = {
      licenseServerUrl: config.server.licenseValidation,
      activationServerUrl: config.server.licenseActivation,
      ...options
    };
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[apiService] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    console.error(`[apiService] ${message}`, error);
  }

  /**
   * Effectue un appel API pour activer une licence
   * @param {string} licenseKey - Clé de licence à activer
   * @param {string} hardwareId - Identifiant matériel
   * @param {string} activationDate - Date d'activation
   * @returns {Promise<Object>} - Résultat de l'activation
   */
  async activateLicense(licenseKey, hardwareId, activationDate) {
    try {
      this._log(`Activation de licence depuis: ${this.options.activationServerUrl}`);
      this._log(`Activation de la licence (***clé masquée***)`);
      this._log(`ID Matériel: ${hardwareId.substring(0, 8)}...`);
      this._log(`Date d'activation proposée: ${activationDate}`);

      const response = await axios.post(this.options.activationServerUrl, {
        licenseKey,
        hardwareId,
        activationDate
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: config.timeouts.apiRequest,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });

      this._log(`Réponse reçue du serveur d'activation: ${response.status}`);
      return response.data;
    } catch (error) {
      this._logError(`❌ Erreur d'activation de licence:`, error);
      
      const errorMessage = error.response 
        ? error.response.data.message || 'Erreur d\'activation'
        : 'Impossible de contacter le serveur de licence';
      
      this._log(`Message d'erreur: ${errorMessage}`);
      
      throw {
        valid: false,
        message: errorMessage
      };
    }
  }

  /**
   * Effectue un appel API pour valider une licence
   * @param {string} licenseKey - Clé de licence à valider
   * @param {string} hardwareId - Identifiant matériel
   * @returns {Promise<Object>} - Résultat de la validation
   */
  async validateLicense(licenseKey, hardwareId) {
    try {
      this._log(`Vérification de licence depuis: ${this.options.licenseServerUrl}`);
      this._log(`Vérification de la licence (***clé masquée***)`);
      this._log(`ID Matériel: ${hardwareId.substring(0, 8)}...`);

      const response = await axios.post(this.options.licenseServerUrl, {
        licenseKey,
        hardwareId
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: config.timeouts.apiRequest,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      });

      this._log(`Réponse reçue du serveur de validation: ${response.status}`);
      return response.data;
    } catch (error) {
      this._logError(`❌ Erreur de validation de licence:`, error);
      
      const errorMessage = error.response 
        ? error.response.data.message || 'Erreur de validation'
        : 'Impossible de contacter le serveur de licence';
      
      this._log(`Message d'erreur: ${errorMessage}`);
      
      throw {
        valid: false,
        message: errorMessage
      };
    }
  }
}

module.exports = ApiService; 