/**
 * Service de gestion des événements de licence
 */
class EventService {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[eventService] ${message}`);
  }

  /**
   * Log d'avertissement avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'avertissement à logger
   */
  _logWarning(message) {
    console.warn(`[eventService] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    if (error) {
      console.error(`[eventService] ${message}`, error);
    } else {
      console.error(`[eventService] ${message}`);
    }
  }

  /**
   * Met à jour la fenêtre principale
   * @param {BrowserWindow} window - Nouvelle fenêtre principale
   */
  setMainWindow(window) {
    this.mainWindow = window;
    this._log('Fenêtre principale mise à jour');
  }

  /**
   * Envoie un événement au renderer
   * @private
   * @param {string} channel - Canal d'événement
   * @param {any} data - Données à envoyer (optionnel)
   */
  _sendEvent(channel, data = null) {
    if (!this.mainWindow) {
      this._logWarning(`Impossible d'envoyer l'événement "${channel}": aucune fenêtre principale`);
      return false;
    }
    
    try {
      if (data) {
        this.mainWindow.webContents.send(channel, data);
      } else {
        this.mainWindow.webContents.send(channel);
      }
      this._log(`Événement "${channel}" envoyé`);
      return true;
    } catch (error) {
      this._logError(`Erreur lors de l'envoi de l'événement "${channel}"`, error);
      return false;
    }
  }

  /**
   * Envoie un événement indiquant que la vérification de licence est en cours
   */
  sendLicenseChecking() {
    this._sendEvent('license-checking');
  }

  /**
   * Envoie le résultat de la vérification de licence
   * @param {Object} result - Résultat de la vérification
   */
  sendLicenseResult(result) {
    const status = result.valid ? 'valide' : 'invalide';
    this._log(`Envoi du résultat de licence: ${status}`);
    this._sendEvent('license-result', result);
  }

  /**
   * Envoie une erreur de vérification de licence
   * @param {string} errorMessage - Message d'erreur
   */
  sendLicenseError(errorMessage) {
    this._log(`Envoi d'erreur de licence: ${errorMessage}`);
    this._sendEvent('license-error', errorMessage);
  }

  /**
   * Envoie le résultat de la vérification de mise à jour
   * @param {Object} result - Résultat de la vérification
   */
  sendUpdateCheckResult(result) {
    const hasUpdate = result.hasUpdate ? 'disponible' : 'non disponible';
    this._log(`Envoi du résultat de vérification de mise à jour: ${hasUpdate}`);
    this._sendEvent('update-check-result', result);
  }

  /**
   * Envoie une erreur de vérification de mise à jour
   * @param {Object} error - Erreur de vérification
   */
  sendUpdateCheckError(error) {
    this._log(`Envoi d'erreur de vérification de mise à jour: ${error.message || 'Erreur inconnue'}`);
    this._sendEvent('update-check-error', error);
  }
}

module.exports = EventService; 