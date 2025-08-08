const Store = require('electron-store');
const config = require('../config');

/**
 * Service de gestion du stockage des données de licence
 */
class StorageService {
  constructor(encryptionKey = config.storage.encryptionKey) {
    this.store = new Store({
      name: config.storage.name,
      encryptionKey
    });
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[storageService] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    console.error(`[storageService] ${message}`, error);
  }

  /**
   * Récupère une valeur du stockage
   * @param {string} key - Clé à récupérer
   * @param {*} defaultValue - Valeur par défaut si la clé n'existe pas
   * @returns {*} - Valeur récupérée ou valeur par défaut
   */
  get(key, defaultValue = null) {
    const value = this.store.get(key, defaultValue);
    if (value === defaultValue) {
      this._log(`Clé "${key}" non trouvée, valeur par défaut utilisée`);
    } else {
      this._log(`Clé "${key}" récupérée du stockage`);
    }
    return value;
  }

  /**
   * Enregistre une valeur dans le stockage
   * @param {string} key - Clé à enregistrer
   * @param {*} value - Valeur à enregistrer
   */
  set(key, value) {
    try {
      this.store.set(key, value);
      this._log(`Clé "${key}" enregistrée dans le stockage`);
    } catch (error) {
      this._logError(`❌ Erreur lors de l'enregistrement de la clé "${key}"`, error);
      throw error;
    }
  }

  /**
   * Supprime une clé du stockage
   * @param {string} key - Clé à supprimer
   */
  delete(key) {
    try {
      this.store.delete(key);
      this._log(`Clé "${key}" supprimée du stockage`);
    } catch (error) {
      this._logError(`❌ Erreur lors de la suppression de la clé "${key}"`, error);
      throw error;
    }
  }

  /**
   * Récupère les données de licence du stockage
   * @returns {Object} - Données de licence (licenseKey, hardwareId, licenseStatus)
   */
  getLicenseData() {
    this._log('Récupération des données de licence du stockage');
    return {
      licenseKey: this.get('licenseKey'),
      hardwareId: this.get('hardwareId'),
      licenseStatus: this.get('licenseStatus')
    };
  }

  /**
   * Sauvegarde le statut de licence
   * @param {Object} licenseStatus - Statut de la licence à sauvegarder
   */
  saveLicenseStatus(licenseStatus) {
    if (!licenseStatus) {
      this._log('❌ Tentative de sauvegarde d\'un statut de licence nul');
      return;
    }
    this._log('Sauvegarde du statut de licence');
    this.set('licenseStatus', licenseStatus);
  }

  /**
   * Sauvegarde la clé de licence
   * @param {string} licenseKey - Clé de licence à sauvegarder
   */
  saveLicenseKey(licenseKey) {
    if (!licenseKey) {
      this._log('❌ Tentative de sauvegarde d\'une clé de licence nulle');
      return;
    }
    this._log(`Sauvegarde de la clé de licence: ${licenseKey.substring(0, 4)}...`);
    this.set('licenseKey', licenseKey);
  }

  /**
   * Sauvegarde l'identifiant matériel
   * @param {string} hardwareId - Identifiant matériel à sauvegarder
   */
  saveHardwareId(hardwareId) {
    if (!hardwareId) {
      this._log('❌ Tentative de sauvegarde d\'un ID matériel nul');
      return;
    }
    this._log(`Sauvegarde de l'ID matériel: ${hardwareId.substring(0, 8)}...`);
    this.set('hardwareId', hardwareId);
  }

  /**
   * Efface toutes les données de licence
   */
  clearLicenseData() {
    this._log('Effacement de toutes les données de licence');
    this.delete('licenseKey');
    this.delete('licenseStatus');
  }
}

module.exports = StorageService; 