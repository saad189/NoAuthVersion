const config = require('../config');
const UpdateChecker = require('../../update/updateChecker');
const fs = require('fs');
const path = require('path');

/**
 * Service de gestion des mises à jour et des historiques de versions
 */
class UpdateService {
  constructor() {
    // Initialiser avec la langue par défaut (fr)
    this.language = 'fr';
    this.translations = null;
    this.translationsCache = {};
    
    // Charger les traductions par défaut
    this.loadTranslations(this.language).then(translations => {
      this.translations = translations;
      
      // Initialiser l'UpdateChecker après le chargement des traductions
      this.updateChecker = new UpdateChecker({
        serverUrl: config.server.baseUrl,
        checkOnStartup: false,
        enableLogs: false,
        language: this.language,
        translations: this.translations
      });
      
      this._log(`Service initialisé avec la langue: ${this.language}`);
    }).catch(error => {
      this._logError('Erreur lors du chargement des traductions initiales', error);
      
      // Initialiser quand même l'UpdateChecker même sans traductions
      this.updateChecker = new UpdateChecker({
        serverUrl: config.server.baseUrl,
        checkOnStartup: false,
        enableLogs: false
      });
      
      this._log('Service initialisé sans traductions');
    });
  }

  /**
   * Change la langue utilisée pour les messages
   * @param {string} language - Code de langue (fr, en, etc.)
   */
  async setLanguage(language) {
    if (language === this.language) return;
    
    this.language = language || 'fr';
    await this.loadTranslations(this.language);
    
    // Mettre à jour les traductions dans l'UpdateChecker
    if (this.updateChecker) {
      this.updateChecker.setLanguage(this.language, this.translations);
      this._log(`Langue changée pour: ${this.language}`);
    } else {
      this._log(`Langue changée pour: ${this.language}, mais UpdateChecker n'est pas encore initialisé`);
    }
  }
  
  /**
   * Charge les fichiers de traduction
   * @param {string} language - Code de langue à charger
   */
  async loadTranslations(language) {
    try {
      // Si déjà en cache, utiliser directement
      if (this.translationsCache[language]) {
        this._log(`Utilisation des traductions en cache pour la langue: ${language}`);
        this.translations = this.translationsCache[language];
        return this.translations;
      }
      
      // Chemin vers le fichier de traduction
      const translationPath = path.join(__dirname, '..', '..', 'translations', `${language}.json`);
      
      // Vérifier si le fichier existe
      if (!fs.existsSync(translationPath)) {
        this._logError(`Fichier de traduction non trouvé: ${translationPath}`);
        return null;
      }
      
      // Lire et parser le fichier
      const content = fs.readFileSync(translationPath, 'utf8');
      this.translations = JSON.parse(content);
      
      // Vérifier que les sections 'updates' existent
      if (!this.translations.updates) {
        this._logError(`Section 'updates' manquante dans les traductions pour ${language}`);
      } else {
        const keysToCheck = ['available', 'noUpdates', 'upToDate', 'alreadyLatest', 'newVersion'];
        let missingKeys = [];
        
        keysToCheck.forEach(key => {
          if (!this.translations.updates[key]) {
            missingKeys.push(key);
          }
        });
        
        if (missingKeys.length > 0) {
          this._logError(`Clés manquantes dans la section 'updates' pour ${language}: ${missingKeys.join(', ')}`);
        } else {
          this._log(`Vérification des clés de traduction 'updates' réussie pour ${language}`);
        }
      }
      
      // Mettre en cache
      this.translationsCache[language] = this.translations;
      
      this._log(`Traductions chargées pour la langue: ${language}`);
      return this.translations;
    } catch (error) {
      this._logError(`Erreur lors du chargement des traductions pour ${language}`, error);
      this.translations = null;
      return null;
    }
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[updateService] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    if (error) {
      console.error(`[updateService] ${message}`, error);
    } else {
      console.error(`[updateService] ${message}`);
    }
  }

  /**
   * Vérifie si une mise à jour est disponible
   * @param {boolean} silent - Si true, ne pas afficher de popup si pas de mise à jour
   * @param {boolean} ignoreErrors - Si true, ne pas afficher de message d'erreur
   * @returns {Promise<Object>} - Informations sur la mise à jour
   */
  async checkForUpdates(silent = true, ignoreErrors = false) {
    try {
      this._log(`Vérification des mises à jour depuis ${config.server.baseUrl}...`);
      
      // Vérifier que l'UpdateChecker est initialisé
      if (!this.updateChecker) {
        throw new Error('Le service de mise à jour n\'est pas encore initialisé');
      }
      
      const updateResult = await this.updateChecker.checkForUpdates(silent, ignoreErrors);
      
      // S'assurer que la version actuelle est incluse dans le résultat
      if (updateResult && !updateResult.currentVersion) {
        updateResult.currentVersion = require('electron').app.getVersion();
      }
      
      const status = updateResult.hasUpdate ? 'Mise à jour disponible' : 'Aucune mise à jour disponible';
      this._log(`Résultat de la vérification des mises à jour: ${status}`);
      
      return updateResult;
    } catch (error) {
      this._logError('Erreur lors de la vérification des mises à jour', error);
      throw error;
    }
  }

  /**
   * Récupère l'historique des versions
   * @param {number} limit - Nombre de versions à récupérer
   * @returns {Promise<Object>} - Historique des versions
   */
  async getVersionHistory(limit = 5) {
    try {
      this._log(`Récupération de l'historique des versions (limite: ${limit})...`);
      
      // Vérifier que l'UpdateChecker est initialisé
      if (!this.updateChecker) {
        throw new Error('Le service de mise à jour n\'est pas encore initialisé');
      }
      
      const historyResult = await this.updateChecker.getVersionHistory(limit);
      
      // S'assurer que la version actuelle est incluse dans le résultat
      if (historyResult && !historyResult.currentVersion) {
        historyResult.currentVersion = require('electron').app.getVersion();
      }
      
      this._log(`Historique des versions récupéré: ${historyResult.versions?.length || 0} versions`);
      
      if (historyResult.versions && historyResult.versions.length > 0) {
        this._log('Versions disponibles:');
        historyResult.versions.forEach((version, index) => {
          this._log(`[${index + 1}] Version ${version.version} (${version.releaseDate || 'date inconnue'})`);
        });
      }
      
      return historyResult;
    } catch (error) {
      this._logError(`Erreur lors de la récupération de l'historique des versions`, error);
      
      return { 
        success: false, 
        message: `Erreur: ${error.message}`,
        versions: [],
        currentVersion: require('electron').app.getVersion()
      };
    }
  }

  /**
   * Télécharge une mise à jour
   * @param {Object} updateInfo - Informations sur la mise à jour à télécharger
   * @returns {Promise<Object>} - Résultat du téléchargement
   */
  async downloadUpdate(updateInfo) {
    try {
      this._log('Téléchargement de la mise à jour...');
      
      // Vérifier que l'UpdateChecker est initialisé
      if (!this.updateChecker) {
        throw new Error('Le service de mise à jour n\'est pas encore initialisé');
      }
      
      if (updateInfo && updateInfo.downloadUrl) {
        this._log(`Téléchargement direct depuis: ${updateInfo.downloadUrl}`);
        await this.updateChecker.downloadUpdate(updateInfo);
        this._log('Téléchargement terminé avec succès');
        return { success: true };
      } else {
        this._log('Pas d\'URL de téléchargement fournie, vérification des mises à jour');
        const result = await this.updateChecker.checkForUpdates(false, false);
        return result;
      }
    } catch (error) {
      this._logError('Erreur lors du téléchargement de la mise à jour', error);
      throw error;
    }
  }
}

module.exports = UpdateService; 