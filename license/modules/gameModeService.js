const config = require('../config');

/**
 * Service de gestion des modes de jeu
 */
class GameModeService {
  constructor(licenseStatusProvider) {
    this.getLicenseStatus = licenseStatusProvider;
  }

  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[gameModeService] ${message}`);
  }

  /**
   * Vérifie si un mode de jeu spécifique est disponible avec la licence actuelle
   * @param {string} mode - Le mode de jeu à vérifier ('multiplayer', 'warzone', ou 'cdl')
   * @returns {boolean} - true si le mode est disponible, false sinon
   */
  isGameModeAvailable(mode) {
    const licenseStatus = this.getLicenseStatus();
    
    // Vérifier si la licence est valide
    if (!licenseStatus || !licenseStatus.valid) {
      this._log(`Mode ${mode} non disponible: licence non valide`);
      return false;
    }
    
    // Vérifier si les modes de jeu sont définis
    if (!licenseStatus.gameModes) {
      this._log(`Mode ${mode} non disponible: information des modes manquante`);
      return false;
    }
    
    // Vérifier si le mode spécifique est disponible
    const isAvailable = !!licenseStatus.gameModes[mode];
    this._log(`Mode ${mode}: ${isAvailable ? 'disponible' : 'non disponible'}`);
    return isAvailable;
  }
  
  /**
   * Récupère la liste des modes de jeu disponibles
   * @returns {Object} - Un objet contenant les modes de jeu et leur disponibilité
   */
  getAvailableGameModes() {
    const licenseStatus = this.getLicenseStatus();
    
    if (!licenseStatus || !licenseStatus.valid || !licenseStatus.gameModes) {
      this._log('Aucun mode de jeu disponible: licence non valide ou information des modes manquante');
      return config.defaultGameModes;
    }
    
    const modes = licenseStatus.gameModes;
    this._log(`Modes de jeu disponibles: ${
      Object.entries(modes)
        .filter(([_, enabled]) => enabled)
        .map(([mode]) => mode)
        .join(', ') || 'Aucun'
    }`);
    
    return modes;
  }
}

module.exports = GameModeService; 