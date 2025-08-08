/**
 * Module de gestion des macros pour l'application
 * Contient toutes les macros disponibles et les méthodes de gestion
 */

class MacroManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.randomMovementActive = false;
    this.centralMovementController = {
      isRunning: false,
      currentSequence: [],
      currentIndex: 0,
      lastDirection: null,
      recentMoves: [],
      timeoutIds: []
    };
    this.randomMovementTimeouts = [];
    this.randomMovementIntervalId = null;
    this.afkHostActive = false;
    this.afkHostTimeoutId = null;
    this.afkPlayerActive = false;
    this.afkPlayerTimeoutId = null;
    this.vKeyPressIntervalIds = [];
    this.mouseClickIntervalIds = [];
  }

  /**
   * Exécution des macros en fonction de l'ID et du mode de jeu
   */
  executeMacro(macroId, gameMode) {
    if (!this.mainWindow) return;
    console.log(`Exécution de la macro ${macroId} pour le mode ${gameMode}`);

    // Vérifier si c'est macro10 (panneau de synchronisation)
    if (macroId === 'macro10') {
      this.mainWindow.openSyncPanel();
      return;
    }
    
    // Vérifier si c'est macro11 (panneau de macros)
    if (macroId === 'macro11') {
      this.mainWindow.openMacroPanel();
      return;
    }

    // Pour les macros de mouvements centralisés qui doivent s'exécuter globalement
    if (macroId === 'macro4') {
      this.toggleRandomMovements();
      return;
    }

    // Pour les autres macros, utiliser les vues synchronisées qui sont valides, visibles ou non
    // Collecter toutes les vues synchronisées (fonctionnalité)
    const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
    
    // Si aucune vue n'est synchronisée, utiliser toutes les vues valides (non détruites)
    let targetViews = synchronizedViews.length > 0 
      ? synchronizedViews 
      : this.mainWindow.views.filter(view => view && view.webContents && !view.webContents.isDestroyed());
    
    console.log(`Exécution de la macro ${macroId} sur ${targetViews.length} vues (synchronisées: ${synchronizedViews.length > 0})`);

    // Si après tout il n'y a aucune vue valide, ne rien faire
    if (targetViews.length === 0) {
      console.warn("Aucune vue valide trouvée pour exécuter la macro.");
      return;
    }

    // Exécuter la macro appropriée sur les vues cibles
    switch (macroId) {
      case 'macro1':
        this.executeMultiSearch(targetViews);
        break;
      case 'macro2':
        this.executeAbandonNext(targetViews);
        break;
      case 'macro3':
        this.executeFullscreen(targetViews);
        break;
      case 'macro5':
        this.executeAutoDrop(targetViews);
        break;
      case 'macro6':
        this.toggleAfkHost(targetViews);
        break;
      case 'macro7':
        this.toggleAfkPlayer(targetViews);
        break;
      case 'macro8':
        this.toggleAfkHostAndPlayer(targetViews);
        break;
      default:
        console.log('Macro non reconnue:', macroId);
    }
  }

  /**
   * Macro 1: Multi-Search (Appui sur R)
   */
  executeMultiSearch(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // Presser R pendant 100ms pour recharger
              window.pressKey('r');
              setTimeout(() => {
                window.releaseKey('r');
                console.log('Macro 1 exécutée avec succès');
              }, 100);
            } catch (error) {
              console.error('Erreur lors de l\\'exécution de la macro 1:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro1:', err));
      }
    });
  }

  /**
   * Macro 2: Abandon et Next (Echap, Tab x2, Enter)
   */
  executeAbandonNext(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // Séquence: Echap, Tab x2, Entrée
              console.log('Début de la séquence de la macro 2');
              window.pressKey('Escape');
              setTimeout(() => {
                window.releaseKey('Escape');
                console.log('Escape relâché');
                
                setTimeout(() => {
                  window.pressKey('Tab');
                  setTimeout(() => {
                    window.releaseKey('Tab');
                    console.log('Premier Tab relâché');
                    
                    setTimeout(() => {
                      window.pressKey('Tab');
                      setTimeout(() => {
                        window.releaseKey('Tab');
                        console.log('Second Tab relâché');
                        
                        setTimeout(() => {
                          window.pressKey('Enter');
                          setTimeout(() => {
                            window.releaseKey('Enter');
                            console.log('Enter relâché, séquence terminée');
                          }, 100);
                        }, 200);
                      }, 100);
                    }, 200);
                  }, 100);
                }, 500);
              }, 100);
            } catch (error) {
              console.error('Erreur lors de l\\'exécution de la macro 2:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro2:', err));
      }
    });
  }

  /**
   * Macro 3: Fullscreen (F11)
   */
  executeFullscreen(views) {
    views.forEach(view => {
      if (view.webContents) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              // F11 pour toggle fullscreen
              console.log('Exécution de la macro Fullscreen (F11)');
              window.pressKey('F11');
              setTimeout(() => {
                window.releaseKey('F11');
                console.log('F11 relâché, macro 3 terminée');
              }, 100);
            } catch (error) {
              console.error('Erreur lors de l\\'exécution de la macro 3:', error);
            }
          })();
        `).catch(err => console.error('Failed to execute macro3:', err));
      }
    });
  }

  /**
   * Macro 4: Mouvements Aléatoires (Toggle)
   */
  toggleRandomMovements() {
    // Inverser l'état de la macro
    this.randomMovementActive = !this.randomMovementActive;
    
    // Mettre à jour le statut visuel dans la barre de contrôle
    this.mainWindow.updateControlBarMacroStatus(4, this.randomMovementActive);
    
    if (this.randomMovementActive) {
      console.log('Démarrage des mouvements aléatoires synchronisés');
      
      // Obtenir toutes les vues synchronisées
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      
      if (synchronizedViews.length === 0) {
        console.log('Aucune vue synchronisée disponible - sélectionnez des vues dans le panneau de synchronisation');
        // Réinitialiser l'état si aucune vue synchronisée
        this.randomMovementActive = false;
        this.mainWindow.updateControlBarMacroStatus(4, false);
        
        // Ouvrir automatiquement le panneau de synchronisation si aucune vue n'est synchronisée
        this.mainWindow.openSyncPanel();
        return;
      }
      
      console.log(`Exécution de mouvements sur ${synchronizedViews.length} vues synchronisées`);
      
      // Initialiser le contrôleur central
      this.centralMovementController = {
        isRunning: true,
        currentSequence: [],
        currentIndex: 0,
        lastDirection: null,
        recentMoves: [],
        timeoutIds: []
      };
      
      // Démarrer la séquence de mouvements
      this.startCentralMovementSequence();
    } else {
      console.log('Arrêt des mouvements aléatoires');
      this.stopRandomMovements();
    }
  }

  /**
   * Arrêter tous les mouvements aléatoires
   */
  stopRandomMovements() {
    console.log('Arrêt des mouvements aléatoires');
    
    // Désactiver le flag de la macro
    this.randomMovementActive = false;
    
    // Arrêter tous les mouvements synchronisés
    this.stopAllSynchronizedMovements();
    
    console.log('Tous les mouvements aléatoires ont été arrêtés avec succès');
  }

  /**
   * Arrêter tous les mouvements synchronisés
   */
  stopAllSynchronizedMovements() {
    console.log('Arrêt de tous les mouvements synchronisés');
    
    // Arrêter le contrôleur central
    this.centralMovementController.isRunning = false;
    
    // Nettoyer tous les timeouts centraux
    if (this.centralMovementController.timeoutIds.length > 0) {
      this.centralMovementController.timeoutIds.forEach(id => clearTimeout(id));
      this.centralMovementController.timeoutIds = [];
    }
    
    // Nettoyer les autres timeouts et intervalles
    if (this.randomMovementTimeouts && this.randomMovementTimeouts.length > 0) {
      this.randomMovementTimeouts.forEach(id => clearTimeout(id));
      this.randomMovementTimeouts = [];
    }
    
    if (this.randomMovementIntervalId) {
      clearInterval(this.randomMovementIntervalId);
      this.randomMovementIntervalId = null;
    }
    
    // Réinitialiser l'état du contrôleur
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.currentSequence = [];
    
    // Relâcher toutes les touches dans chaque vue
    this.mainWindow.views.forEach(view => this.mainWindow.releaseAllKeysInView(view));
  }

  /**
   * Démarrer la séquence de mouvements centrale
   */
  startCentralMovementSequence() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log('Démarrage de la séquence de mouvements centrale');
    
    // Réinitialiser l'état du contrôleur
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.lastDirection = null;
    this.centralMovementController.recentMoves = [];
    
    // Commencer par 3 sauts
    this.executeJumpSequence(0);
  }

  /**
   * Exécuter la séquence de sauts initiale
   */
  executeJumpSequence(jumpIndex) {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log(`Exécution du saut ${jumpIndex+1}/3`);
    
    // Obtenir toutes les vues synchronisées
    const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
    
    // Exécuter le saut sur toutes les vues avec une approche simplifiée
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        const script = `
          (function() {
            try {
              const element = document.documentElement || document.body;
              
              // Simuler appui espace
              const downEvent = document.createEvent('HTMLEvents');
              downEvent.initEvent('keydown', true, true);
              downEvent.key = ' ';
              downEvent.code = 'Space';
              downEvent.keyCode = 32;
              element.dispatchEvent(downEvent);
              
              // Relâcher après 100ms
              setTimeout(() => {
                const upEvent = document.createEvent('HTMLEvents');
                upEvent.initEvent('keyup', true, true);
                upEvent.key = ' ';
                upEvent.code = 'Space';
                upEvent.keyCode = 32;
                element.dispatchEvent(upEvent);
              }, 100);
              
              return "Saut simple exécuté";
            } catch(error) {
              return "Erreur de saut: " + error.message;
            }
          })();
        `;
        
        view.webContents.executeJavaScript(script)
          .then(result => console.log(`Vue ${view.viewNumber}: ${result}`))
          .catch(err => {
            console.error(`Erreur de saut dans vue ${view.viewNumber}:`, err);
            // Essayer l'approche directe en cas d'échec
            this.executeDirectMovement(view, [' '], 100);
          });
      }
    });
    
    // Continuer avec le prochain saut ou passer aux mouvements
    if (jumpIndex < 2) {
      // Attendre 200ms avant le prochain saut
      const nextJumpId = setTimeout(() => {
        this.executeJumpSequence(jumpIndex + 1);
      }, 200);
      
      this.centralMovementController.timeoutIds.push(nextJumpId);
    } else {
      // Passer aux mouvements aléatoires après les 3 sauts
      const startMovementsId = setTimeout(() => {
        this.executeRandomMovement();
      }, 800);
      
      this.centralMovementController.timeoutIds.push(startMovementsId);
    }
  }

  /**
   * Exécuter un mouvement aléatoire
   */
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    // Directions possibles (en AZERTY: ZQSD)
    const directions = [
      ['z'],      // Avant
      ['q'],      // Gauche
      ['s'],      // Arrière
      ['d'],      // Droite
      ['z', 'q'], // Diagonale avant-gauche
      ['z', 'd'], // Diagonale avant-droite
      ['s', 'q'], // Diagonale arrière-gauche
      ['s', 'd']  // Diagonale arrière-droite
    ];
    
    try {
      // 1. Choisir une direction aléatoirement
      let chosen = directions[Math.floor(Math.random() * directions.length)];
      
      // 2. Réduire la probabilité de remplacement de 'z' par 's' à 20% seulement
      if (chosen.includes('z') && !chosen.includes('s') && Math.random() < 0.2) {
        chosen = ['s'];
      }
      
      // Utiliser directement les touches AZERTY
      const mappedKeys = chosen;
      
      // Déterminer la durée du mouvement (entre 500ms et 1750ms)
      const pressDuration = 500 + Math.random() * 1250;
      
      // Exécuter le mouvement sur toutes les vues synchronisées
      console.log(`Exécution du mouvement: ${mappedKeys.join('+')} pendant ${pressDuration}ms`);
      
      const synchronizedViews = this.mainWindow.getAllSynchronizedViews();
      
      // Utiliser l'approche la plus simple: createElement + dispatchEvent
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          const script = `
            (function() {
              try {
                const simulateKeyEvent = (type, key) => {
                  const element = document.documentElement || document.body;
                  const event = document.createEvent('HTMLEvents');
                  event.initEvent(type, true, true);
                  event.key = key;
                  event.code = key === ' ' ? 'Space' : 
                                key === 'Shift' ? 'ShiftLeft' : 
                                'Key' + (key === 'z' ? 'Z' : 
                                          key === 'q' ? 'Q' : 
                                          key === 's' ? 'S' : 
                                          key === 'd' ? 'D' : key.toUpperCase());
                  event.keyCode = key === ' ' ? 32 : 
                                  key === 'Shift' ? 16 : 
                                  key.charCodeAt(0);
                  event.shiftKey = key === 'Shift' || keys.includes('Shift');
                  element.dispatchEvent(event);
                };

                // Appuyer sur les touches
                const keys = ${JSON.stringify(mappedKeys)};
                keys.forEach(key => simulateKeyEvent('keydown', key));

                // Relâcher après le délai
                setTimeout(() => {
                  keys.forEach(key => simulateKeyEvent('keyup', key));
                  
                  // Correction pour le mouvement arrière (seulement s'il n'y a pas eu de combinaison)
                  if (keys.length === 1 && keys[0] === 's') {
                    simulateKeyEvent('keydown', 'z');
                    setTimeout(() => simulateKeyEvent('keyup', 'z'), 600);
                  }
                }, ${pressDuration});
                
                return "Exécuté";
              } catch (error) {
                return "Erreur: " + error.message;
              }
            })();
          `;
          
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`Vue ${view.viewNumber}: ${result}`))
            .catch(err => {
              console.error(`Erreur vue ${view.viewNumber}:`, err);
              // Essayer une approche alternative en cas d'erreur
              this.executeDirectMovement(view, mappedKeys, pressDuration);
            });
        }
      });
      
      // Planifier le prochain mouvement avec un délai aléatoire
      const nextDelay = pressDuration + 1000 + Math.random() * 1250;
      
      const nextMovementId = setTimeout(() => {
        this.executeRandomMovement();
      }, nextDelay);
      
      this.centralMovementController.timeoutIds.push(nextMovementId);
      
    } catch (error) {
      console.error('Erreur dans le mouvement aléatoire central:', error);
      
      // En cas d'erreur, essayer de continuer après un délai
      const errorRecoveryId = setTimeout(() => {
        this.executeRandomMovement();
      }, 2000);
      
      this.centralMovementController.timeoutIds.push(errorRecoveryId);
    }
  }

  /**
   * Exécuter un mouvement direct (fallback)
   */
  executeDirectMovement(view, keys, duration) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) return;
    
    console.log(`Fallback: Exécution directe pour vue ${view.viewNumber}`);
    
    try {
      // Essayer d'injecter du code directement dans la page
      view.webContents.insertCSS(`
        @keyframes pressed { from {opacity: 0.8;} to {opacity: 1;} }
        body:after {
          content: "Mouvement actif";
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0,255,0,0.5);
          padding: 5px;
          z-index: 9999;
          animation: pressed 0.5s infinite alternate;
        }
      `).then(() => {
        // Simuler un click au centre pour activer le focus
        const bounds = view.getBounds();
        view.webContents.sendInputEvent({
          type: 'mouseDown',
          x: Math.floor(bounds.width / 2),
          y: Math.floor(bounds.height / 2),
          button: 'left',
          clickCount: 1
        });
        
        setTimeout(() => {
          view.webContents.sendInputEvent({
            type: 'mouseUp',
            x: Math.floor(bounds.width / 2),
            y: Math.floor(bounds.height / 2),
            button: 'left',
            clickCount: 1
          });
          
          // Mapping AZERTY pour le fallback
          const keyMapping = {
            'z': 'w',
            'q': 'a',
            's': 's',
            'd': 'd',
            'Shift': 'Shift'
          };
          
          // Envoyer les événements de clavier directement via IPC
          keys.forEach(key => {
            const mappedKey = keyMapping[key] || key;
            this.mainWindow.mainWebContents.send('simulate-keypress', {
              viewId: view.viewNumber,
              key: mappedKey,
              state: 'down'
            });
          });
          
          setTimeout(() => {
            keys.forEach(key => {
              const mappedKey = keyMapping[key] || key;
              this.mainWindow.mainWebContents.send('simulate-keypress', {
                viewId: view.viewNumber,
                key: mappedKey,
                state: 'up'
              });
            });
          }, duration);
        }, 100);
      }).catch(err => console.error('CSS injection error:', err));
    } catch (error) {
      console.error(`Erreur lors du mouvement direct (vue ${view.viewNumber}):`, error);
    }
  }

  /**
   * Macro 5: Auto Drop (Espace sur Hosts puis Players)
   */
  executeAutoDrop(views) {
    if (!views || views.length === 0) return;
    
    console.log('Exécution de la macro Auto Drop');
    
    // Séparer les vues en hosts et players
    const hostViews = views.filter(view => view.viewType === 'host');
    const playerViews = views.filter(view => view.viewType === 'player');
    
    // Exécuter Espace sur les hosts d'abord
    hostViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.executeJavaScript(`
          (function() {
            try {
              console.log('Auto Drop: Appui sur Espace (host)');
              window.pressKey(' ');
              setTimeout(() => {
                window.releaseKey(' ');
                console.log('Auto Drop: Relâchement Espace (host)');
              }, 100);
              return "Auto Drop exécuté sur host";
            } catch (error) {
              console.error('Erreur lors de l\\'exécution de Auto Drop sur host:', error);
              return "Erreur: " + error.message;
            }
          })();
        `).catch(err => console.error('Failed to execute Auto Drop on host:', err));
      }
    });
    
    // Après 0,3 seconde (300ms), exécuter Espace sur les players
    setTimeout(() => {
      playerViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                console.log('Auto Drop: Appui sur Espace (player)');
                window.pressKey(' ');
                setTimeout(() => {
                  window.releaseKey(' ');
                  console.log('Auto Drop: Relâchement Espace (player)');
                }, 100);
                return "Auto Drop exécuté sur player";
              } catch (error) {
                console.error('Erreur lors de l\\'exécution de Auto Drop sur player:', error);
                return "Erreur: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to execute Auto Drop on player:', err));
        }
      });
    }, 900);
  }

  /**
   * Macro 6: AFK Host (Mouvement sur Hosts)
   * Exécute une séquence de touches ZQSD dans l'ordre puis DSQZ dans l'ordre inverse
   * Chaque touche est maintenue pendant 1 seconde avec une pause de 2 secondes entre chaque touche
   */
  toggleAfkHost(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggle de la macro AFK Host');
    
    // Identifier les hosts
    const hostViews = views.filter(view => view.viewType === 'host');
    
    if (hostViews.length === 0) {
      console.log('Aucun host visible pour exécuter la macro AFK Host');
      return;
    }
    
    // Vérifier si la macro est déjà active
    this.afkHostActive = !this.afkHostActive;
    
    // Mettre à jour le statut visuel
    this.mainWindow.updateControlBarMacroStatus(6, this.afkHostActive);
    
    if (this.afkHostActive) {
      console.log('Démarrage des mouvements AFK sur les hosts');
      
      // Fonction pour exécuter la séquence de touches
      const executeAfkMovement = () => {
        if (!this.afkHostActive) return;
        
        // Séquence de touches dans l'ordre puis dans l'ordre inverse
        const forwardKeys = ['z', 'q', 's', 'd'];
        const reverseKeys = ['d', 's', 'q', 'z'];
        const allKeys = [...forwardKeys, ...reverseKeys];
        
        const executeKeySequence = (keyIndex) => {
          if (keyIndex >= allKeys.length || !this.afkHostActive) return;
          
          const currentKey = allKeys[keyIndex];
          
          hostViews.forEach(view => {
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Host: Appui sur ${currentKey}');
                    window.pressKey('${currentKey}');
                    setTimeout(() => {
                      window.releaseKey('${currentKey}');
                      console.log('AFK Host: Relâchement ${currentKey}');
                    }, 1000); // Appui pendant 1 seconde
                    return "AFK Host: mouvement exécuté sur touche ${currentKey}";
                  } catch (error) {
                    console.error('Erreur lors de l\\'exécution de AFK Host:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error(`Failed to execute AFK Host movement for key ${currentKey}:`, err));
            }
          });
          
          // Passer à la touche suivante après 2 secondes de pause
          setTimeout(() => {
            executeKeySequence(keyIndex + 1);
          }, 3000); // 1000ms d'appui + 2000ms de pause
        };
        
        // Démarrer la séquence de touches
        executeKeySequence(0);
        
        // Planifier la prochaine séquence complète
        if (this.afkHostActive) {
          this.afkHostTimeoutId = setTimeout(executeAfkMovement, 3000); // Attendre 3 secondes avant de recommencer
        }
      };
      
      // Démarrer les mouvements
      executeAfkMovement();
    } else {
      console.log('Arrêt des mouvements AFK sur les hosts');
      
      // Arrêter les timeouts
      if (this.afkHostTimeoutId) {
        clearTimeout(this.afkHostTimeoutId);
        this.afkHostTimeoutId = null;
      }
      
      // Relâcher toutes les touches dans les vues host
      hostViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Relâcher toutes les touches possibles
                ['z', 'q', 's', 'd'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Host: Toutes les touches relâchées');
                return "AFK Host: arrêté";
              } catch (error) {
                console.error('Erreur lors de l\\'arrêt de AFK Host:', error);
                return "Erreur: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Host:', err));
        }
      });
    }
  }

  /**
   * Macro 7: AFK Player (Mouvement sur Players)
   * Exécute des touches aléatoires ZQSD pendant 0,6 seconde toutes les 1 seconde
   * Enregistre les 4 derniers mouvements et les reproduit dans l'ordre inverse
   */
  toggleAfkPlayer(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggle de la macro AFK Player');
    
    // Identifier les players
    const playerViews = views.filter(view => view.viewType === 'player');
    
    if (playerViews.length === 0) {
      console.log('Aucun player visible pour exécuter la macro AFK Player');
      return;
    }
    
    // Vérifier si la macro est déjà active
    this.afkPlayerActive = !this.afkPlayerActive;
    
    // Mettre à jour le statut visuel
    this.mainWindow.updateControlBarMacroStatus(7, this.afkPlayerActive);
    
    if (this.afkPlayerActive) {
      console.log('Démarrage des mouvements AFK sur les players');
      
      // Initialiser le tableau pour enregistrer les derniers mouvements
      let lastMoves = [];
      let isReplayingMoves = false;
      
      // Fonction pour exécuter un mouvement
      const executeAfkMovement = () => {
        if (!this.afkPlayerActive) return;
        
        // Touches possibles
        const possibleKeys = ['z', 'q', 's', 'd'];
        
        // Si nous sommes en mode replay, utiliser les mouvements enregistrés dans l'ordre inverse
        if (isReplayingMoves && lastMoves.length > 0) {
          // Prendre les mouvements dans l'ordre inverse
          const movesToReplay = [...lastMoves].reverse();
          console.log('Rejouant les mouvements en sens inverse:', movesToReplay);
          
          const replayMove = (index) => {
            if (index >= movesToReplay.length || !this.afkPlayerActive) {
              // Terminer le replay et revenir au mode normal
              isReplayingMoves = false;
              setTimeout(executeAfkMovement, 1000);
              return;
            }
            
            const currentKey = movesToReplay[index];
            
            playerViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Player Replay: Appui sur ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Player Replay: Relâchement ${currentKey}');
                      }, 600); // Appui pendant 0,6 seconde
                      return "AFK Player Replay: mouvement exécuté sur touche ${currentKey}";
                    } catch (error) {
                      console.error('Erreur lors de l\\'exécution de AFK Player Replay:', error);
                      return "Erreur: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Player replay movement for key ${currentKey}:`, err));
              }
            });
            
            // Passer au prochain mouvement après 1,6 secondes (0,6s d'appui + 1s de pause)
            setTimeout(() => {
              replayMove(index + 1);
            }, 1600);
          };
          
          // Démarrer le replay des mouvements
          replayMove(0);
          
        } else {
          // Mode normal: sélectionner une touche aléatoire
          const randomKey = possibleKeys[Math.floor(Math.random() * possibleKeys.length)];
          
          // Enregistrer ce mouvement
          lastMoves.push(randomKey);
          // Garder seulement les 4 derniers mouvements
          if (lastMoves.length > 4) {
            lastMoves.shift();
          }
          
          console.log('AFK Player: Exécution de la touche', randomKey, '- Mouvements enregistrés:', lastMoves);
          
          playerViews.forEach(view => {
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Player: Appui sur ${randomKey}');
                    window.pressKey('${randomKey}');
                    setTimeout(() => {
                      window.releaseKey('${randomKey}');
                      console.log('AFK Player: Relâchement ${randomKey}');
                    }, 600); // Appui pendant 0,6 seconde
                    return "AFK Player: mouvement exécuté sur touche ${randomKey}";
                  } catch (error) {
                    console.error('Erreur lors de l\\'exécution de AFK Player:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error(`Failed to execute AFK Player movement for key ${randomKey}:`, err));
            }
          });
          
          // Si nous avons enregistré 4 mouvements, passer en mode replay pour le prochain cycle
          if (lastMoves.length === 4 && !isReplayingMoves) {
            isReplayingMoves = true;
          }
          
          // Planifier le prochain mouvement après 1,6 secondes (0,6s d'appui + 1s de pause)
          this.afkPlayerTimeoutId = setTimeout(executeAfkMovement, 1600);
        }
      };
      
      // Démarrer les mouvements
      executeAfkMovement();
    } else {
      console.log('Arrêt des mouvements AFK sur les players');
      
      // Arrêter les timeouts
      if (this.afkPlayerTimeoutId) {
        clearTimeout(this.afkPlayerTimeoutId);
        this.afkPlayerTimeoutId = null;
      }
      
      // Relâcher toutes les touches dans les vues player
      playerViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Relâcher toutes les touches possibles
                ['z', 'q', 's', 'd'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Player: Toutes les touches relâchées');
                return "AFK Player: arrêté";
              } catch (error) {
                console.error('Erreur lors de l\\'arrêt de AFK Player:', error);
                return "Erreur: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Player:', err));
        }
      });
    }
  }

  /**
   * Macro 8: AFK Host and Player (Mouvement sur Hosts et Players)
   * Exécute une séquence de touches ZQSD dans l'ordre puis DSQZ dans l'ordre inverse
   * Chaque touche est maintenue pendant 1 seconde avec une pause de 2 secondes entre chaque touche
   * Appuie sur V toutes les 3 secondes sur les players et redémarre automatiquement toutes les 60 secondes
   */
  toggleAfkHostAndPlayer(views) {
    if (!views || views.length === 0) return;
    
    console.log('Toggle de la macro AFK Host and Player');
    
    // Identifier les hosts et players
    const hostViews = views.filter(view => view.viewType === 'host');
    const playerViews = views.filter(view => view.viewType === 'player');
    
    if (hostViews.length === 0 && playerViews.length === 0) {
      console.log('Aucun host ou player visible pour exécuter la macro AFK Host and Player');
      return;
    }
    
    // Vérifier si la macro est déjà active
    this.afkHostActive = !this.afkHostActive;
    this.afkPlayerActive = !this.afkPlayerActive;
    
    // Mettre à jour le statut visuel
    this.mainWindow.updateControlBarMacroStatus(8, this.afkHostActive && this.afkPlayerActive);
    
    if (this.afkHostActive && this.afkPlayerActive) {
      console.log('Démarrage des mouvements AFK sur les hosts et players');
      
      // Stocker les IDs d'interval pour pouvoir les nettoyer plus tard
      this.vKeyPressIntervalIds = [];
      this.autoCompleteRestartId = null;
      
      // Fonction pour démarrer les fonctionnalités de la macro
      const startAfkFunctionality = () => {
        // Nettoyer les intervalles existants pour éviter les doublons lors du redémarrage
        this.cleanupIntervals();
        
        // Démarrer l'appui périodique sur la touche V uniquement pour les players
        playerViews.forEach(view => {
          if (view.webContents && !view.webContents.isDestroyed()) {
            const intervalId = setInterval(() => {
              if (!this.afkHostActive || !this.afkPlayerActive) return;
              
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    console.log('AFK Host+Player: Appui sur V (player)');
                    window.pressKey('v');
                    setTimeout(() => {
                      window.releaseKey('v');
                      console.log('AFK Host+Player: Relâchement V (player)');
                    }, 100); // Appui court de 100ms
                    return "AFK Host+Player: appui V exécuté";
                  } catch (error) {
                    console.error('Erreur lors de l\\'appui sur V:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error('Failed to execute V key press on player:', err));
            }, 3000); // Répétition toutes les 3 secondes
            
            this.vKeyPressIntervalIds.push(intervalId);
          }
        });
        
        // Fonction pour exécuter la séquence de touches
        const executeAfkMovement = () => {
          if (!this.afkHostActive || !this.afkPlayerActive) return;
          
          // Séquence de touches dans l'ordre puis dans l'ordre inverse
          const forwardKeys = ['z', 'q', 's', 'd'];
          const reverseKeys = ['d', 's', 'q', 'z'];
          const allKeys = [...forwardKeys, ...reverseKeys];
          
          const executeKeySequence = (keyIndex) => {
            if (keyIndex >= allKeys.length || !this.afkHostActive || !this.afkPlayerActive) return;
            
            const currentKey = allKeys[keyIndex];
            
            hostViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Host and Player: Appui sur ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Host and Player: Relâchement ${currentKey}');
                      }, 1000); // Appui pendant 1 seconde
                      return "AFK Host and Player: mouvement exécuté sur touche ${currentKey}";
                    } catch (error) {
                      console.error('Erreur lors de l\\'exécution de AFK Host and Player:', error);
                      return "Erreur: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Host and Player movement for key ${currentKey}:`, err));
              }
            });
            
            playerViews.forEach(view => {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.executeJavaScript(`
                  (function() {
                    try {
                      console.log('AFK Host and Player: Appui sur ${currentKey}');
                      window.pressKey('${currentKey}');
                      setTimeout(() => {
                        window.releaseKey('${currentKey}');
                        console.log('AFK Host and Player: Relâchement ${currentKey}');
                      }, 1000); // Appui pendant 1 seconde
                      return "AFK Host and Player: mouvement exécuté sur touche ${currentKey}";
                    } catch (error) {
                      console.error('Erreur lors de l\\'exécution de AFK Host and Player:', error);
                      return "Erreur: " + error.message;
                    }
                  })();
                `).catch(err => console.error(`Failed to execute AFK Host and Player movement for key ${currentKey}:`, err));
              }
            });
            
            // Passer à la touche suivante après 2 secondes de pause
            setTimeout(() => {
              executeKeySequence(keyIndex + 1);
            }, 3000); // 1000ms d'appui + 2000ms de pause
          };
          
          // Démarrer la séquence de touches
          executeKeySequence(0);
          
          // Planifier la prochaine séquence complète
          if (this.afkHostActive && this.afkPlayerActive) {
            this.afkHostTimeoutId = setTimeout(executeAfkMovement, 3000); // Attendre 3 secondes avant de recommencer
          }
        };
        
        // Démarrer les mouvements
        executeAfkMovement();
      };
      
      // Configurer le redémarrage complet automatique toutes les 60 secondes
      this.autoCompleteRestartId = setInterval(() => {
        if (this.afkHostActive && this.afkPlayerActive) {
          console.log('Redémarrage complet automatique de la macro AFK Host+Player (toutes les 60 secondes)');
          
          // Arrêter tous les intervalles et timers
          this.cleanupIntervals();
          
          // Réinitialiser les flags pour simuler une désactivation complète
          const wasActive = this.afkHostActive && this.afkPlayerActive;
          this.afkHostActive = false;
          this.afkPlayerActive = false;
          
          // Relâcher toutes les touches dans les vues host et player
          const allViews = [...hostViews, ...playerViews];
          allViews.forEach(view => {
            if (view.webContents && !view.webContents.isDestroyed()) {
              view.webContents.executeJavaScript(`
                (function() {
                  try {
                    // Relâcher toutes les touches possibles
                    ['z', 'q', 's', 'd', 'v'].forEach(key => {
                      window.releaseKey(key);
                    });
                    return "AFK Host and Player: touches relâchées pour redémarrage complet";
                  } catch (error) {
                    console.error('Erreur lors du relâchement des touches:', error);
                    return "Erreur: " + error.message;
                  }
                })();
              `).catch(err => console.error('Failed to release keys:', err));
            }
          });
          
          // Simuler un redémarrage complet après une courte pause
          setTimeout(() => {
            if (wasActive) {
              // Réactiver les flags
              this.afkHostActive = true;
              this.afkPlayerActive = true;
              
              // Mettre à jour le statut visuel
              this.mainWindow.updateControlBarMacroStatus(8, true);
              
              console.log('Relancement complet de la macro AFK Host+Player');
              
              // Redémarrer toutes les fonctionnalités
              startAfkFunctionality();
            }
          }, 500); // Pause courte pour simuler un clic utilisateur
        }
      }, 60000); // Redémarrage complet toutes les 60 secondes
      
      // Méthode pour nettoyer les intervalles et timeouts existants
      this.cleanupIntervals = () => {
        // Arrêter les timeouts
        if (this.afkHostTimeoutId) {
          clearTimeout(this.afkHostTimeoutId);
          this.afkHostTimeoutId = null;
        }
        
        // Arrêter tous les intervalles d'appui sur V
        if (this.vKeyPressIntervalIds && this.vKeyPressIntervalIds.length > 0) {
          this.vKeyPressIntervalIds.forEach(intervalId => clearInterval(intervalId));
          this.vKeyPressIntervalIds = [];
        }
        
        // Relâcher toutes les touches dans les vues host et player
        const allViews = [...hostViews, ...playerViews];
        allViews.forEach(view => {
          if (view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.executeJavaScript(`
              (function() {
                try {
                  // Relâcher toutes les touches possibles
                  ['z', 'q', 's', 'd', 'v'].forEach(key => {
                    window.releaseKey(key);
                  });
                  return "AFK Host and Player: touches relâchées pour redémarrage";
                } catch (error) {
                  console.error('Erreur lors du relâchement des touches:', error);
                  return "Erreur: " + error.message;
                }
              })();
            `).catch(err => console.error('Failed to release keys:', err));
          }
        });
      };
      
      // Démarrer les fonctionnalités AFK
      startAfkFunctionality();
      
    } else {
      console.log('Arrêt des mouvements AFK sur les hosts et players');
      
      // Arrêter les timeouts
      if (this.afkHostTimeoutId) {
        clearTimeout(this.afkHostTimeoutId);
        this.afkHostTimeoutId = null;
      }
      
      // Arrêter l'intervalle de redémarrage complet automatique
      if (this.autoCompleteRestartId) {
        clearInterval(this.autoCompleteRestartId);
        this.autoCompleteRestartId = null;
      }
      
      // Arrêter tous les intervalles d'appui sur V
      if (this.vKeyPressIntervalIds && this.vKeyPressIntervalIds.length > 0) {
        this.vKeyPressIntervalIds.forEach(intervalId => clearInterval(intervalId));
        this.vKeyPressIntervalIds = [];
      }
      
      // Relâcher toutes les touches dans les vues host et player
      const allViews = [...hostViews, ...playerViews];
      allViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(`
            (function() {
              try {
                // Relâcher toutes les touches possibles
                ['z', 'q', 's', 'd', 'v'].forEach(key => {
                  window.releaseKey(key);
                });
                console.log('AFK Host and Player: Toutes les touches relâchées');
                return "AFK Host and Player: arrêté";
              } catch (error) {
                console.error('Erreur lors de l\\'arrêt de AFK Host and Player:', error);
                return "Erreur: " + error.message;
              }
            })();
          `).catch(err => console.error('Failed to stop AFK Host and Player:', err));
        }
      });
    }
  }
}

module.exports = MacroManager; 