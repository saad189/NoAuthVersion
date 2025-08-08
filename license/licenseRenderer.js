// Attendre que le document soit chargé
document.addEventListener('DOMContentLoaded', async () => {
  // Fonctions de logging avec préfixe
  function _log(message) {
    console.log(`[licenseRenderer] ${message}`);
  }
  
  function _logError(message, error) {
    if (error) {
      console.error(`[licenseRenderer] ${message}`, error);
    } else {
      console.error(`[licenseRenderer] ${message}`);
    }
  }

  // Références aux éléments DOM
  const licenseKeyInput = document.getElementById('licenseKey');
  const validateBtn = document.getElementById('validateBtn');
  const retryBtn = document.getElementById('retryBtn');
  const useYesBtn = document.getElementById('useYesBtn');
  const useNoBtn = document.getElementById('useNoBtn');
  const useSavedBtn = document.getElementById('useSavedBtn');
  const enterNewBtn = document.getElementById('enterNewBtn');
  const buyLicenseBtn = document.getElementById('buyLicenseBtn');
  const buyLicenseBtnInvalid = document.getElementById('buyLicenseBtnInvalid');
  const licenseForm = document.getElementById('license-form');
  const licenseInputForm = document.getElementById('license-input-form');
  const savedLicenseNotification = document.getElementById('saved-license-notification');
  const savedLicenseDisplay = document.getElementById('saved-license-display');
  const checkingResult = document.getElementById('checking-result');
  const validResult = document.getElementById('valid-result');
  const invalidResult = document.getElementById('invalid-result');
  const invalidMessage = document.getElementById('invalid-message');
  const expirationInfo = document.getElementById('expiration-info');
  const licenseKeyDisplay = document.getElementById('license-key-display');
  
  // Éléments d'interface pour les mises à jour
  const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
  const viewChangelogBtn = document.getElementById('viewChangelogBtn');
  const updateInfo = document.getElementById('update-info');
  const updateIcon = document.getElementById('update-icon');
  const updateTitle = document.getElementById('update-title');
  const updateMessage = document.getElementById('update-message');
  const updateAction = document.getElementById('update-action');
  const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
  const changelogInfo = document.getElementById('changelog-info');
  const changelogContent = document.getElementById('changelog-content');
  
  // Variable pour stocker les dernières informations de mise à jour
  let lastUpdateInfo = null;
  
  // Écouteur d'événement pour les changements de langue
  document.addEventListener('languageChanged', (event) => {
    _log(`Langue changée: ${event.detail.language}`);
    
    // Mettre à jour les contenus dynamiques si visibles
    if (updateInfo.style.display === 'block') {
      if (lastUpdateInfo) {
        // Réafficher avec les nouvelles traductions
        displayUpdateResult(lastUpdateInfo);
      }
    }
    
    // Mettre à jour l'historique des versions si affiché
    if (changelogInfo.style.display === 'block') {
      // Réafficher l'historique avec les nouvelles traductions
      displayVersionHistory();
    }
    
    // Mettre à jour les informations d'expiration si elles sont affichées
    if (validResult.style.display === 'block' && lastLicenseResult) {
      // Reformater les dates d'expiration avec les nouvelles traductions
      displayValidLicense(lastLicenseResult);
    }
  });
  
  // Charger les informations de licence enregistrées
  const savedLicense = await window.licenseAPI.getSavedLicense();
  if (savedLicense) {
    // Afficher la notification de licence sauvegardée
    savedLicenseDisplay.textContent = maskLicenseKey(savedLicense);
    savedLicenseNotification.style.display = 'block';
    licenseInputForm.style.display = 'none';
    licenseKeyInput.value = savedLicense;
  }

  // Fonction pour masquer la clé de licence (afficher juste les 4 derniers caractères)
  function maskLicenseKey(key) {
    if (!key || key.length <= 4) return key;
    return '•'.repeat(key.length - 4) + key.slice(-4);
  }

  // Fonction pour masquer tous les résultats
  function hideAllResults() {
    licenseForm.style.display = 'block';
    checkingResult.style.display = 'none';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
    updateInfo.style.display = 'none';
  }
  
  // Fonction pour afficher le formulaire de licence
  function showLicenseInputForm() {
    savedLicenseNotification.style.display = 'none';
    licenseInputForm.style.display = 'block';
    licenseForm.style.display = 'block';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
  }
  
  // Fonction pour formater une date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    // Récupérer la langue actuelle depuis le sélecteur
    const languageSelect = document.getElementById('language-select');
    const currentLanguage = languageSelect ? languageSelect.value : 'fr';
    
    // Formatter les dates selon la langue actuelle
    return date.toLocaleDateString(currentLanguage, dateOptions) + ' ' + 
           getTranslation('datetime.at', 'à') + ' ' + 
           date.toLocaleTimeString(currentLanguage, timeOptions);
  }
  
  // Fonction pour afficher le résultat de validation
  function displayValidLicense(result) {
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'none';
    validResult.style.display = 'block';
    invalidResult.style.display = 'none';
    
    // Afficher les informations de licence
    const expiration = new Date(result.expiration);
    const now = new Date();
    const daysUntilExpiration = Math.ceil((expiration - now) / (1000 * 60 * 60 * 24));
    
    // Construire les informations d'expiration
    let expirationHtml = '';
    
    // Afficher la date d'activation si disponible
    if (result.activationDate) {
      const activationDate = formatDate(result.activationDate);
      expirationHtml += `<p><strong>${getTranslation('license.activatedOn', 'Activée le:')}</strong> ${activationDate}</p>`;
    }
    
    // Ajouter la date d'expiration
    const formattedExpiration = formatDate(result.expiration);
    expirationHtml += `<p><strong>${getTranslation('license.expiresOn', 'Expire le:')}</strong> ${formattedExpiration}</p>`;
    
    expirationInfo.innerHTML = expirationHtml;
    
    // Ajouter un avertissement si l'expiration est proche
    if (daysUntilExpiration <= 7) {
      expirationInfo.innerHTML += `
        <p style="color: var(--warning-color); font-weight: bold;">
          ${getTranslation('license.expirationWarning', `Attention: Votre licence expire dans ${daysUntilExpiration} jours`)}
        </p>
      `;
      validResult.classList.add('warning');
    } else {
      validResult.classList.remove('warning');
    }
    
    // Cacher la section de mise à jour (elle sera affichée automatiquement après la vérification)
    updateInfo.style.display = 'none';
    
    // Vérifier automatiquement les mises à jour
    setTimeout(() => {
      checkForUpdates();
    }, 500); // Petit délai pour que l'interface s'affiche correctement d'abord
  }
  
  // Stocker les résultats de licence pour utilisation ultérieure
  let lastLicenseResult = null;
  
  // Fonction pour afficher une licence invalide
  function displayInvalidLicense(message) {
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'none';
    validResult.style.display = 'none';
    invalidResult.style.display = 'block';
    
    invalidMessage.textContent = message || 'Impossible de valider votre licence.';
  }
  
  // Fonction pour traduire les clés en utilisant les traductions chargées
  function getTranslation(key, params = {}) {
    // Valeurs de fallback pour les clés courantes
    const fallbackTranslations = {
      'updates.upToDate': 'Your application is up to date.',
      'updates.alreadyLatest': 'You are already using the latest version.',
      'updates.checking': 'Checking for updates...',
      'updates.available': 'Update available',
      'updates.newVersion': 'A new version ({0}) is available!',
      'updates.currentVersion': 'Your current version: {0}',
      'updates.releaseNotes': 'Release notes:',
      'updates.noReleaseNotes': 'No release notes available.',
      'updates.connectionError': 'Connection Error',
      'updates.unableToCheck': 'Unable to check for updates',
      'updates.retrievalError': 'Retrieval Error',
      'updates.unableToRetrieveHistory': 'Unable to retrieve version history',
      'updates.error': 'Error',
      'updates.unexpectedError': 'An unexpected error occurred',
      'updates.noHistory': 'No version history available.',
      'updates.historyEnd': 'End of version history'
    };
    
    // Trouver le div contenant les traductions qui est injecté par le script i18n
    const translationsDiv = document.getElementById('translations-data');
    if (!translationsDiv) {
      console.warn(`[i18n] Élément de traductions non trouvé pour la clé: ${key}`);
      // Si la clé existe dans notre fallback, l'utiliser
      if (fallbackTranslations[key]) {
        let result = fallbackTranslations[key];
        // Remplacer les paramètres {0}, {1}, etc. par leurs valeurs
        if (params) {
          result = result.replace(/\{(\d+)\}/g, (match, number) => {
            return params[number] !== undefined ? params[number] : match;
          });
        }
        return result;
      }
      return key;
    }
    
    try {
      const translations = JSON.parse(translationsDiv.textContent);
      
      // Diviser la clé en parties (ex: "updates.available" -> ["updates", "available"])
      const parts = key.split('.');
      let result = translations;
      
      // Parcourir les parties pour obtenir la valeur
      for (const part of parts) {
        if (result && result[part] !== undefined) {
          result = result[part];
        } else {
          console.warn(`[i18n] Clé de traduction non trouvée: ${key}`);
          // Si la clé existe dans notre fallback, l'utiliser
          if (fallbackTranslations[key]) {
            let fallbackResult = fallbackTranslations[key];
            // Remplacer les paramètres {0}, {1}, etc. par leurs valeurs
            if (params) {
              fallbackResult = fallbackResult.replace(/\{(\d+)\}/g, (match, number) => {
                return params[number] !== undefined ? params[number] : match;
              });
            }
            return fallbackResult;
          }
          return key;
        }
      }
      
      // S'assurer que le résultat est une chaîne
      if (typeof result !== 'string') {
        console.warn(`[i18n] La clé de traduction ${key} n'est pas une chaîne: ${typeof result}`);
        // Si la clé existe dans notre fallback, l'utiliser
        if (fallbackTranslations[key]) {
          let fallbackResult = fallbackTranslations[key];
          // Remplacer les paramètres {0}, {1}, etc. par leurs valeurs
          if (params) {
            fallbackResult = fallbackResult.replace(/\{(\d+)\}/g, (match, number) => {
              return params[number] !== undefined ? params[number] : match;
            });
          }
          return fallbackResult;
        }
        return key;
      }
      
      // Remplacer les paramètres {0}, {1}, etc. par leurs valeurs
      if (params) {
        return result.replace(/\{(\d+)\}/g, (match, number) => {
          return params[number] !== undefined ? params[number] : match;
        });
      }
      
      return result;
    } catch (error) {
      console.error(`[i18n] Erreur lors de la traduction de la clé ${key}:`, error);
      // Si la clé existe dans notre fallback, l'utiliser
      if (fallbackTranslations[key]) {
        let fallbackResult = fallbackTranslations[key];
        // Remplacer les paramètres {0}, {1}, etc. par leurs valeurs
        if (params) {
          fallbackResult = fallbackResult.replace(/\{(\d+)\}/g, (match, number) => {
            return params[number] !== undefined ? params[number] : match;
          });
        }
        return fallbackResult;
      }
      return key;
    }
  }
  
  // Fonction pour vérifier les mises à jour manuellement
  async function checkForUpdates() {
    try {
      // Cacher l'historique des versions s'il est affiché
      changelogInfo.style.display = 'none';
      
      // Afficher l'indicateur de chargement
      updateInfo.style.display = 'block';
      updateInfo.classList.remove('update-available');
      updateIcon.textContent = '🔄';
      updateTitle.textContent = getTranslation('updates.checking');
      updateMessage.textContent = getTranslation('updates.checking');
      updateAction.style.display = 'none';
      
      // Appeler l'API pour vérifier les mises à jour
      const updateResult = await window.licenseAPI.checkForUpdates();
      
      // Afficher les résultats
      displayUpdateResult(updateResult);
    } catch (error) {
      _logError('Erreur lors de la vérification des mises à jour:', error);
      displayUpdateError(error);
    }
  }
  
  // Fonction pour afficher les résultats de vérification de mise à jour
  function displayUpdateResult(updateData) {
    // Stocker les infos de mise à jour pour une utilisation ultérieure
    lastUpdateInfo = updateData;
    
    updateInfo.style.display = 'block';
    
    // S'assurer que currentVersion est défini
    const currentVersion = updateData.currentVersion || getTranslation('updates.currentVersion', {0: 'N/A'});
    
    if (updateData.hasUpdate) {
      // Mise à jour disponible
      updateInfo.classList.add('update-available');
      updateIcon.textContent = '⚠️';
      updateTitle.textContent = getTranslation('updates.available');
      updateMessage.innerHTML = `
        ${getTranslation('updates.currentVersion', {0: currentVersion})}<br>
        ${getTranslation('updates.newVersion', {0: updateData.version || 'N/A'})}<br>
        ${updateData.changelog ? `<strong>${getTranslation('updates.releaseNotes')}</strong> ${updateData.changelog}` : getTranslation('updates.noReleaseNotes')}
      `;
      
      // Afficher le bouton de téléchargement
      updateAction.style.display = 'block';
      
      // Événement pour le bouton de téléchargement
      downloadUpdateBtn.onclick = function() {
        // Télécharger directement sans re-vérifier
        window.licenseAPI.downloadUpdate(updateData);
      };
    } else {
      // Pas de mise à jour
      updateInfo.classList.remove('update-available');
      updateIcon.textContent = '✓';
      updateTitle.textContent = getTranslation('updates.upToDate');
      updateMessage.textContent = getTranslation('updates.alreadyLatest');
      updateAction.style.display = 'none';
    }
  }
  
  // Fonction pour afficher une erreur de vérification de mise à jour
  function displayUpdateError(error) {
    updateInfo.style.display = 'block';
    updateInfo.classList.remove('update-available');
    updateIcon.textContent = '⚠️';
    updateTitle.textContent = getTranslation('updates.connectionError');
    updateMessage.textContent = error.message || getTranslation('updates.unableToCheck');
    updateAction.style.display = 'none';
  }
  
  // Fonction pour afficher l'historique des versions
  async function displayVersionHistory() {
    try {
      // Masquer les autres informations
      updateInfo.style.display = 'none';
      
      // Afficher l'indicateur de chargement
      changelogInfo.style.display = 'block';
      changelogContent.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div><p>${getTranslation('updates.checking')}</p>`;
      
      // Récupérer l'historique des versions
      const historyResult = await window.licenseAPI.getVersionHistory();
      
      if (historyResult.success) {
        const currentVersion = historyResult.currentVersion || getTranslation('updates.currentVersion', {0: 'N/A'});
        let htmlContent = '';
        
        if (historyResult.versions && historyResult.versions.length > 0) {
          // Ajouter une indication de la version actuelle
          htmlContent += `<div class="current-version">
            <p><strong>${getTranslation('updates.currentVersion', {0: ''})}</strong> ${currentVersion}</p>
          </div>`;
          
          // Ajouter chaque version avec son changelog
          historyResult.versions.forEach((version, index) => {
            const isCurrentVersion = version.version === currentVersion;
            
            htmlContent += `
              <div class="version-item ${isCurrentVersion ? 'current' : ''}" style="margin-top: 20px; padding: 15px; background-color: rgba(0, 0, 0, 0.2); border-radius: 5px; border-left: 3px solid ${isCurrentVersion ? 'var(--success-color)' : 'var(--primary-color)'}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <h3 style="margin: 0; ${isCurrentVersion ? 'color: var(--success-color)' : ''}">Version ${version.version}</h3>
                  <span style="font-size: 0.9em; opacity: 0.8;">${version.releaseDate ? formatDate(version.releaseDate) : ''}</span>
                </div>
                ${version.changelog ? `<div class="changelog" style="white-space: pre-wrap;">${version.changelog}</div>` : `<p style="font-style: italic; opacity: 0.6;">${getTranslation('updates.noReleaseNotes')}</p>`}
              </div>
            `;
          });
          
          // Ajouter du contenu pour s'assurer que le défilement est nécessaire
          htmlContent += `
            <div style="margin-top: 20px; padding: 15px; opacity: 0.7; background-color: rgba(0, 0, 0, 0.2); border-radius: 5px;">
              <h3>${getTranslation('app.title')}</h3>
              <p style="margin-top: 10px;">${getTranslation('updates.autoUpdateInfo', 'Cette application est régulièrement mise à jour pour améliorer votre expérience.')}</p>
              <p>${getTranslation('updates.updateInclude', 'Les mises à jour peuvent inclure :')}</p>
              <ul style="margin-left: 20px; margin-top: 10px;">
                <li>${getTranslation('updates.newFeatures', 'Nouvelles fonctionnalités')}</li>
                <li>${getTranslation('updates.bugFixes', 'Corrections de bugs')}</li>
                <li>${getTranslation('updates.performance', 'Améliorations de performance')}</li>
                <li>${getTranslation('updates.security', 'Mises à jour de sécurité')}</li>
              </ul>
              <p style="margin-top: 15px;">${getTranslation('updates.recommendation', 'Nous vous recommandons de toujours utiliser la dernière version disponible.')}</p>
            </div>
            
            <div style="height: 300px; padding-top: 30px; text-align: center; color: rgba(255,255,255,0.4);">
              <p>— ${getTranslation('updates.historyEnd', 'Fin de l\'historique des versions')} —</p>
            </div>
          `;
        } else {
          htmlContent = `<p>${getTranslation('updates.noHistory', 'Aucun historique de version disponible.')}</p>`;
        }
        
        changelogContent.innerHTML = htmlContent;
        
        // Forcer le rafraîchissement du layout pour assurer que le défilement fonctionne
        setTimeout(() => {
          changelogContent.style.display = 'none';
          changelogContent.offsetHeight; // Force le reflow
          changelogContent.style.display = 'block';
          
          // Configurer les contrôles de défilement
          setupScrollControls();
        }, 50);
      } else {
        changelogContent.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <span style="font-size: 30px; color: var(--danger-color);">⚠️</span>
            <p style="margin-top: 10px; font-weight: bold;">${getTranslation('updates.retrievalError', 'Erreur de récupération')}</p>
            <p>${historyResult.message || getTranslation('updates.unableToRetrieveHistory', 'Impossible de récupérer l\'historique des versions')}</p>
          </div>
        `;
      }
    } catch (error) {
      _logError('Erreur lors de l\'affichage de l\'historique des versions:', error);
      changelogContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <span style="font-size: 30px; color: var(--danger-color);">⚠️</span>
          <p style="margin-top: 10px; font-weight: bold;">${getTranslation('updates.error', 'Erreur')}</p>
          <p>${error.message || getTranslation('updates.unexpectedError', 'Une erreur inattendue s\'est produite')}</p>
        </div>
      `;
    }
  }
  
  // Fonction pour configurer des contrôles de défilement personnalisés
  function setupScrollControls() {
    // Supprimer les boutons de défilement et ne garder que les gestionnaires d'événements
    
    // Assurer que les événements de molette de souris fonctionnent
    changelogContent.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY || e.detail || e.wheelDelta;
      changelogContent.scrollTop += delta > 0 ? 60 : -60;
    }, { passive: false });
    
    // Ajouter un gestionnaire de clavier pour les flèches haut/bas
    changelogContent.tabIndex = 0; // Pour permettre le focus
    changelogContent.style.outline = 'none'; // Pour cacher l'outline du focus
    
    changelogContent.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        changelogContent.scrollTop -= 60;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        changelogContent.scrollTop += 60;
      }
    });
    
    // Mettre le focus sur le conteneur pour permettre la navigation au clavier
    changelogContent.focus();
  }
  
  // Fonction pour valider une clé de licence
  async function validateLicenseKey(licenseKey) {
    if (!licenseKey) return;
    
    // Afficher l'indicateur de chargement
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'block';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
    
    try {
      await window.licenseAPI.validateLicense(licenseKey);
      // Le reste est géré par les écouteurs d'événements
    } catch (error) {
      _logError('Erreur lors de la validation:', error);
      displayInvalidLicense('Une erreur inattendue s\'est produite.');
    }
  }
  
  // Événement pour le bouton "Vérifier les mises à jour"
  checkUpdatesBtn.addEventListener('click', checkForUpdates);
  
  // Événement pour le bouton "Historique des versions"
  viewChangelogBtn.addEventListener('click', () => {
    // Toggle: Si l'historique est déjà affiché, le cacher
    if (changelogInfo.style.display === 'block') {
      changelogInfo.style.display = 'none';
      return;
    }
    
    // Masquer les informations de mise à jour si elles sont affichées
    updateInfo.style.display = 'none';
    
    // Afficher l'historique des versions
    displayVersionHistory();
  });
  
  // Événement pour le bouton "Utiliser cette licence"
  useSavedBtn.addEventListener('click', () => {
    // Vérifier le statut de la licence sauvegardée
    validateLicenseKey(savedLicense);
  });
  
  // Événement pour le bouton "Entrer une nouvelle licence"
  enterNewBtn.addEventListener('click', () => {
    showLicenseInputForm();
  });
  
  // Événement pour le bouton "Oui" (utiliser cette licence)
  useYesBtn.addEventListener('click', () => {
    _log("Bouton Oui cliqué - Signal envoyé au processus principal");
    // Signal au processus principal que l'utilisateur a validé la licence
    window.licenseAPI.signalLicenseValidated();
  });
  
  // Événement pour le bouton "Non" (changer de licence)
  useNoBtn.addEventListener('click', () => {
    // Afficher le formulaire pour saisir une nouvelle licence
    licenseKeyInput.value = '';
    showLicenseInputForm();
  });
  
  // Événement lors de la vérification en cours
  window.licenseAPI.onLicenseChecking(() => {
    licenseForm.style.display = 'none';
    checkingResult.style.display = 'block';
    validResult.style.display = 'none';
    invalidResult.style.display = 'none';
  });
  
  // Événement après vérification réussie
  window.licenseAPI.onLicenseResult((result) => {
    if (result.valid) {
      const savedLicense = licenseKeyInput.value.trim();
      licenseKeyDisplay.textContent = maskLicenseKey(savedLicense);
      lastLicenseResult = result; // Sauvegarder le résultat pour utilisation ultérieure
      displayValidLicense(result);
    } else {
      displayInvalidLicense(result.message);
    }
  });
  
  // Événement en cas d'erreur de vérification
  window.licenseAPI.onLicenseError((errorMessage) => {
    displayInvalidLicense(errorMessage);
  });
  
  // Événements pour la vérification des mises à jour - gérés désormais manuellement
  window.licenseAPI.onUpdateCheckResult((result) => {
    lastUpdateInfo = result;
    // Ne pas afficher automatiquement - l'utilisateur va cliquer sur le bouton
  });
  
  window.licenseAPI.onUpdateCheckError((error) => {
    _logError('Erreur lors de la vérification des mises à jour:', error);
    // Ne pas afficher automatiquement - l'utilisateur va cliquer sur le bouton
  });
  
  // Événement de validation de la licence
  validateBtn.addEventListener('click', async () => {
    const licenseKey = licenseKeyInput.value.trim();
    
    if (!licenseKey) {
      invalidMessage.textContent = 'Veuillez entrer une clé de licence.';
      invalidResult.style.display = 'block';
      return;
    }
    
    validateLicenseKey(licenseKey);
  });
  
  // Événement pour réessayer
  retryBtn.addEventListener('click', () => {
    hideAllResults();
    // Si une licence était sauvegardée, montrer la notification
    if (savedLicense) {
      savedLicenseDisplay.textContent = maskLicenseKey(savedLicense);
      savedLicenseNotification.style.display = 'block';
      licenseInputForm.style.display = 'none';
    } else {
      licenseInputForm.style.display = 'block';
    }
  });
  
  // Activer la validation par la touche Entrée
  licenseKeyInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      validateBtn.click();
    }
  });
  
  // Gestionnaires pour les boutons d'achat de licence
  buyLicenseBtn.addEventListener('click', () => {
    _log("Redirection vers la page d'achat de licence");
    window.licenseAPI.openExternalLink('https://6truc.mysellauth.com/');
  });
  
  buyLicenseBtnInvalid.addEventListener('click', () => {
    _log("Redirection vers la page d'achat de licence depuis l'écran d'invalidité");
    window.licenseAPI.openExternalLink('https://6truc.mysellauth.com/');
  });
}); 