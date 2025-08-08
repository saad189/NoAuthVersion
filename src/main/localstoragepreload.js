const { contextBridge, ipcRenderer } = require('electron');

// Variable pour suivre si le script a déjà été injecté
let scriptInjected = false;

// Fonction pour injecter les paramètres BetterXcloud
function injectBetterXcloudSettings() {
  try {
    console.log("Injection des paramètres BetterXcloud");
    
    // Définir les paramètres principaux pour BetterXcloud
    const settings = {
      "ui.imageQuality": 10,
      "ui.gameCard.waitTime.show": true,
      "ui.layout": "default",
      "game.fortnite.forceConsole": false,
      "block.tracking": true,
      "xhome.enabled": false,
      "block.features": [],
      "ui.hideSections": [],
      "audio.volume.booster.enabled": false,
      "ui.feedbackDialog.disabled": true,
      "stream.video.combineAudio": false,
      "nativeMkb.mode": "default",
      "loadingScreen.gameArt.show": false,
      "nativeMkb.forcedGames": [],
      "stream.video.maxBitrate": 2000000, // 3 Mbps en dur
      "stream.video.codecProfile": "low",
      "ui.splashVideo.skip": true,
      "ui.reduceAnimations": true,
      "ui.systemMenu.hideHandle": true,
      "ui.streamMenu.simplify": false,
      "ui.hideScrollbar": false,
      "version.current": "6.4.6",
      "version.lastCheck": 1742417945,
      "mkb.enabled": false,
      "ui.controllerStatus.show": true,
      "version.latest": "6.4.6",
      "server.bypassRestriction": "off",
      "server.region": "default",
      "bx.locale": "en-US",
      "ui.controllerFriendly": false,
      "stream.locale": "default",
      "server.ipv6.prefer": false,
      "stream.video.resolution": "720p",
      "screenshot.applyFilters": false,
      "audio.mic.onPlaying": false,
      "mkb.cursor.hideIdle": false,
      "gameBar.position": "off",
      "loadingScreen.waitTime.show": true,
      "loadingScreen.rocket": "hide",
      "userAgent.profile": "default",
      "ui.theme": "default"
    };

    // Définir les paramètres spécifiques pour BetterXcloud.Stream
    const streamSettings = {
      "controller.pollingRate": 4,
      "deviceVibration.mode": "off",
      "mkb.p1.preset.mappingId": -1,
      "keyboardShortcuts.preset.inGameId": -1,
      "audio.volume": 100,
      "video.player.type": "default",
      "video.maxFps": 10,
      "video.player.powerPreference": "default",
      "video.processing": "usm",
      "video.ratio": "16:9",
      "video.position": "center",
      "video.processing.sharpness": 0,
      "video.saturation": 100,
      "video.contrast": 100,
      "video.brightness": 100,
      "localCoOp.enabled": false,
      "deviceVibration.intensity": 50,
      "stats.showWhenPlaying": false,
      "stats.quickGlance.enabled": true,
      "stats.items": ["ping", "fps", "btr"],
      "stats.position": "top-right",
      "stats.textSize": "0.9rem",
      "stats.opacity.all": 60,
      "stats.opacity.background": 60,
      "stats.colors": false,
      "mkb.p1.slot": 1
    };

    // Sauvegarder les paramètres dans le localStorage
    localStorage.setItem("BetterXcloud", JSON.stringify(settings));
    localStorage.setItem("BetterXcloud.Stream", JSON.stringify(streamSettings));
    console.log("Paramètres injectés dans le localStorage:", settings);
  } catch (error) {
    console.error("Erreur lors de l'injection des paramètres BetterXcloud:", error);
  }
}

// Injecter Better X Cloud dès que possible
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded déclenché, injection immédiate');
  
  // Éviter l'injection multiple du script
  if (scriptInjected) {
    console.log("Script BetterXcloud déjà injecté, aucune action nécessaire");
    return;
  }
  
  try {
    // Injecter le script seulement si nous sommes sur une page appropriée
    const url = window.location.href;
    if (url.includes('xbox.com') || url.includes('play')) {
      // Vérifier si le script est déjà présent
      if (document.getElementById('better-x-cloud-script')) {
        console.log("Script BetterXcloud déjà présent dans le DOM, pas besoin de le réinjecter");
        return;
      }
      
      // Version corrigée de l'URL
      const scriptSrc = "https://cdn.jsdelivr.net/gh/redphx/better-x-cloud@latest/dist/better-x-cloud.min.js";
      
      // Injecter le script
      const scriptElem = document.createElement('script');
      scriptElem.id = 'better-x-cloud-script';
      scriptElem.src = scriptSrc;
      document.head.appendChild(scriptElem);
      
      console.log("Script BetterXcloud injecté");
      scriptInjected = true;
      
      // Ajouter un gestionnaire d'erreur
      scriptElem.onerror = function() {
        console.error("Erreur lors du chargement du script BetterXcloud. URL incorrecte ?");
      };
      
      // Injecter les paramètres après le chargement du script
      scriptElem.onload = function() {
        console.log("Script BetterXcloud chargé, injection des paramètres");
        injectBetterXcloudSettings();
      };
    }
  } catch (error) {
    console.error("Erreur lors de l'injection du script BetterXcloud:", error);
  }
});

console.log("betterxcloudpreload.js est chargé");