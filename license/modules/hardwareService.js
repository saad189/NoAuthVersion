const si = require('systeminformation');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Service de gestion des identifiants matériels
 */
class HardwareService {
  /**
   * Log avec préfixe du nom du service
   * @private
   * @param {string} message - Message à logger
   */
  _log(message) {
    console.log(`[hardwareService] ${message}`);
  }

  /**
   * Log d'erreur avec préfixe du nom du service
   * @private
   * @param {string} message - Message d'erreur à logger
   * @param {Error} error - Objet d'erreur éventuel
   */
  _logError(message, error) {
    console.error(`[hardwareService] ${message}`, error);
  }

  /**
   * Génère un identifiant matériel unique basé sur les caractéristiques du système
   * @returns {Promise<string>} - L'identifiant matériel généré
   */
  async generateHardwareId() {
    try {
      this._log('Génération d\'un identifiant matériel');
      
      const [cpu, system, uuid, disk] = await Promise.all([
        si.cpu(),
        si.system(),
        si.uuid(),
        si.diskLayout()
      ]);

      this._log('Informations système récupérées, création du hash');

      const hardwareInfo = JSON.stringify({
        cpuId: cpu.manufacturer + cpu.brand + cpu.family + cpu.model + cpu.stepping,
        systemId: system.manufacturer + system.model + system.serial,
        diskId: disk.length > 0 ? disk[0].serialNum : '',
        uuid: uuid.os
      });

      const hardwareId = crypto
        .createHash('sha256')
        .update(hardwareInfo)
        .digest('hex');

      this._log(`ID matériel généré: ${hardwareId.substring(0, 8)}...`);
      return hardwareId;
    } catch (error) {
      this._logError('❌ Erreur lors de la génération de l\'ID matériel:', error);
      
      // En cas d'échec, générer un UUID comme solution de secours
      const fallbackId = uuidv4();
      this._log(`Utilisation d'un UUID de secours: ${fallbackId.substring(0, 8)}...`);
      
      return fallbackId;
    }
  }
}

module.exports = HardwareService; 