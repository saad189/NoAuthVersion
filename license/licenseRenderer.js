// Wait for document to be loaded
document.addEventListener("DOMContentLoaded", async () => {
  // Logging functions with prefix
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

  // DOM element references
  const licenseKeyInput = document.getElementById("licenseKey");
  const validateBtn = document.getElementById("validateBtn");
  const retryBtn = document.getElementById("retryBtn");
  const useYesBtn = document.getElementById("useYesBtn");
  const useNoBtn = document.getElementById("useNoBtn");
  const useSavedBtn = document.getElementById("useSavedBtn");
  const enterNewBtn = document.getElementById("enterNewBtn");
  const buyLicenseBtn = document.getElementById("buyLicenseBtn");
  const buyLicenseBtnInvalid = document.getElementById("buyLicenseBtnInvalid");
  const licenseForm = document.getElementById("license-form");
  const licenseInputForm = document.getElementById("license-input-form");
  const savedLicenseNotification = document.getElementById(
    "saved-license-notification"
  );
  const savedLicenseDisplay = document.getElementById("saved-license-display");
  const checkingResult = document.getElementById("checking-result");
  const validResult = document.getElementById("valid-result");
  const invalidResult = document.getElementById("invalid-result");
  const invalidMessage = document.getElementById("invalid-message");
  const expirationInfo = document.getElementById("expiration-info");
  const licenseKeyDisplay = document.getElementById("license-key-display");

  // UI elements for updates
  const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
  const viewChangelogBtn = document.getElementById("viewChangelogBtn");
  const updateInfo = document.getElementById("update-info");
  const updateIcon = document.getElementById("update-icon");
  const updateTitle = document.getElementById("update-title");
  const updateMessage = document.getElementById("update-message");
  const updateAction = document.getElementById("update-action");
  const downloadUpdateBtn = document.getElementById("downloadUpdateBtn");
  const changelogInfo = document.getElementById("changelog-info");
  const changelogContent = document.getElementById("changelog-content");

  // Store last update information
  let lastUpdateInfo = null;

  // Event listener for language changes
  document.addEventListener("languageChanged", (event) => {
    _log(`Language changed: ${event.detail.language}`);

    // Update dynamic contents if visible
    if (updateInfo.style.display === "block") {
      if (lastUpdateInfo) {
        // Re-render with new translations
        displayUpdateResult(lastUpdateInfo);
      }
    }

    // Update version history if visible
    if (changelogInfo.style.display === "block") {
      // Re-render history with new translations
      displayVersionHistory();
    }

    // Update expiration info if visible
    if (validResult.style.display === "block" && lastLicenseResult) {
      // Reformat expiration dates with new translations
      displayValidLicense(lastLicenseResult);
    }
  });

  // Load saved license information
  const savedLicense = await window.licenseAPI.getSavedLicense();
  if (savedLicense) {
    // Show saved license notification
    savedLicenseDisplay.textContent = maskLicenseKey(savedLicense);
    savedLicenseNotification.style.display = "block";
    licenseInputForm.style.display = "none";
    licenseKeyInput.value = savedLicense;
  }

  // Mask license key (show only last 4 chars)
  function maskLicenseKey(key) {
    if (!key || key.length <= 4) return key;
    return "•".repeat(key.length - 4) + key.slice(-4);
  }

  // Hide all results
  function hideAllResults() {
    licenseForm.style.display = "block";
    checkingResult.style.display = "none";
    validResult.style.display = "none";
    invalidResult.style.display = "none";
    updateInfo.style.display = "none";
  }

  // Show license input form
  function showLicenseInputForm() {
    savedLicenseNotification.style.display = "none";
    licenseInputForm.style.display = "block";
    licenseForm.style.display = "block";
    validResult.style.display = "none";
    invalidResult.style.display = "none";
  }

  // Format a date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const dateOptions = { year: "numeric", month: "long", day: "numeric" };
    const timeOptions = { hour: "2-digit", minute: "2-digit" };

    // Get current language from selector
    const languageSelect = document.getElementById("language-select");
    const currentLanguage = languageSelect ? languageSelect.value : "en";

    // Format dates according to current language
    return (
      date.toLocaleDateString(currentLanguage, dateOptions) +
      " " +
      getTranslation("datetime.at", "at") +
      " " +
      date.toLocaleTimeString(currentLanguage, timeOptions)
    );
  }

  // Display validation result
  function displayValidLicense(result) {
    licenseForm.style.display = "none";
    checkingResult.style.display = "none";
    validResult.style.display = "block";
    invalidResult.style.display = "none";

    // Show license information
    const expiration = new Date(result.expiration);
    const now = new Date();
    const daysUntilExpiration = Math.ceil(
      (expiration - now) / (1000 * 60 * 60 * 24)
    );

    // Build expiration info
    let expirationHtml = "";

    // Show activation date if available
    if (result.activationDate) {
      const activationDate = formatDate(result.activationDate);
      expirationHtml += `<p><strong>${getTranslation(
        "license.activatedOn",
        "Activated on:"
      )}</strong> ${activationDate}</p>`;
    }

    // Add expiration date
    const formattedExpiration = formatDate(result.expiration);
    expirationHtml += `<p><strong>${getTranslation(
      "license.expiresOn",
      "Expires on:"
    )}</strong> ${formattedExpiration}</p>`;

    expirationInfo.innerHTML = expirationHtml;

    // Add warning if expiration is near
    if (daysUntilExpiration <= 7) {
      expirationInfo.innerHTML += `
        <p style="color: var(--warning-color); font-weight: bold;">
          ${getTranslation(
            "license.expirationWarning",
            `Warning: Your license expires in ${daysUntilExpiration} days`
          )}
        </p>
      `;
      validResult.classList.add("warning");
    } else {
      validResult.classList.remove("warning");
    }

    // Hide update section (it will be shown after check)
    updateInfo.style.display = "none";

    // Automatically check for updates
    setTimeout(() => {
      checkForUpdates();
    }, 500); // Small delay to let UI render first
  }

  // Store license results for later use
  let lastLicenseResult = null;

  // Display an invalid license
  function displayInvalidLicense(message) {
    licenseForm.style.display = "none";
    checkingResult.style.display = "none";
    validResult.style.display = "none";
    invalidResult.style.display = "block";

    invalidMessage.textContent = message || "Unable to validate your license.";
  }

  // Translate keys using loaded translations
  function getTranslation(key, params = {}) {
    // Fallback values for common keys
    const fallbackTranslations = {
      "updates.upToDate": "Your application is up to date.",
      "updates.alreadyLatest": "You are already using the latest version.",
      "updates.checking": "Checking for updates...",
      "updates.available": "Update available",
      "updates.newVersion": "A new version ({0}) is available!",
      "updates.currentVersion": "Your current version: {0}",
      "updates.releaseNotes": "Release notes:",
      "updates.noReleaseNotes": "No release notes available.",
      "updates.connectionError": "Connection Error",
      "updates.unableToCheck": "Unable to check for updates",
      "updates.retrievalError": "Retrieval Error",
      "updates.unableToRetrieveHistory": "Unable to retrieve version history",
      "updates.error": "Error",
      "updates.unexpectedError": "An unexpected error occurred",
      "updates.noHistory": "No version history available.",
      "updates.historyEnd": "End of version history",
    };

    // Find the div containing translations injected by i18n script
    const translationsDiv = document.getElementById("translations-data");
    if (!translationsDiv) {
      console.warn(`[i18n] Translations element not found for key: ${key}`);
      // Use fallback if available
      if (fallbackTranslations[key]) {
        let result = fallbackTranslations[key];
        // Replace params {0}, {1}, etc.
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

      // Split key into parts (e.g., "updates.available" -> ["updates", "available"])
      const parts = key.split(".");
      let result = translations;

      // Traverse parts to obtain the value
      for (const part of parts) {
        if (result && result[part] !== undefined) {
          result = result[part];
        } else {
          console.warn(`[i18n] Translation key not found: ${key}`);
          // Use fallback if available
          if (fallbackTranslations[key]) {
            let fallbackResult = fallbackTranslations[key];
            // Replace params {0}, {1}, etc.
            if (params) {
              fallbackResult = fallbackResult.replace(
                /\{(\d+)\}/g,
                (match, number) => {
                  return params[number] !== undefined ? params[number] : match;
                }
              );
            }
            return fallbackResult;
          }
          return key;
        }
      }

      // Ensure result is a string
      if (typeof result !== "string") {
        console.warn(
          `[i18n] Translation key ${key} is not a string: ${typeof result}`
        );
        // Use fallback if available
        if (fallbackTranslations[key]) {
          let fallbackResult = fallbackTranslations[key];
          // Replace params {0}, {1}, etc.
          if (params) {
            fallbackResult = fallbackResult.replace(
              /\{(\d+)\}/g,
              (match, number) => {
                return params[number] !== undefined ? params[number] : match;
              }
            );
          }
          return fallbackResult;
        }
        return key;
      }

      // Replace params {0}, {1}, etc.
      if (params) {
        return result.replace(/\{(\d+)\}/g, (match, number) => {
          return params[number] !== undefined ? params[number] : match;
        });
      }

      return result;
    } catch (error) {
      console.error(`[i18n] Error translating key ${key}:`, error);
      // Use fallback if available
      if (fallbackTranslations[key]) {
        let fallbackResult = fallbackTranslations[key];
        // Replace params {0}, {1}, etc.
        if (params) {
          fallbackResult = fallbackResult.replace(
            /\{(\d+)\}/g,
            (match, number) => {
              return params[number] !== undefined ? params[number] : match;
            }
          );
        }
        return fallbackResult;
      }
      return key;
    }
  }

  // Manually check for updates
  async function checkForUpdates() {
    try {
      // Hide version history if visible
      changelogInfo.style.display = "none";

      // Show loading indicator
      updateInfo.style.display = "block";
      updateInfo.classList.remove("update-available");
      updateIcon.textContent = "🔄";
      updateTitle.textContent = getTranslation("updates.checking");
      updateMessage.textContent = getTranslation("updates.checking");
      updateAction.style.display = "none";

      // Call API to check for updates
      const updateResult = await window.licenseAPI.checkForUpdates();

      // Show results
      displayUpdateResult(updateResult);
    } catch (error) {
      _logError("Error while checking for updates:", error);
      displayUpdateError(error);
    }
  }

  // Show update check results
  function displayUpdateResult(updateData) {
    // Store update info for later use
    lastUpdateInfo = updateData;

    updateInfo.style.display = "block";

    // S'assurer que currentVersion est défini
    const currentVersion =
      updateData.currentVersion ||
      getTranslation("updates.currentVersion", { 0: "N/A" });

    if (updateData.hasUpdate) {
      // Update available
      updateInfo.classList.add("update-available");
      updateIcon.textContent = "⚠️";
      updateTitle.textContent = getTranslation("updates.available");
      updateMessage.innerHTML = `
        ${getTranslation("updates.currentVersion", { 0: currentVersion })}<br>
        ${getTranslation("updates.newVersion", {
          0: updateData.version || "N/A",
        })}<br>
        ${
          updateData.changelog
            ? `<strong>${getTranslation("updates.releaseNotes")}</strong> ${
                updateData.changelog
              }`
            : getTranslation("updates.noReleaseNotes")
        }
      `;

      // Show download button
      updateAction.style.display = "block";

      // Download button handler
      downloadUpdateBtn.onclick = function () {
        // Download directly without re-checking
        window.licenseAPI.downloadUpdate(updateData);
      };
    } else {
      // No update
      updateInfo.classList.remove("update-available");
      updateIcon.textContent = "✓";
      updateTitle.textContent = getTranslation("updates.upToDate");
      updateMessage.textContent = getTranslation("updates.alreadyLatest");
      updateAction.style.display = "none";
    }
  }

  // Show update check error
  function displayUpdateError(error) {
    updateInfo.style.display = "block";
    updateInfo.classList.remove("update-available");
    updateIcon.textContent = "⚠️";
    updateTitle.textContent = getTranslation("updates.connectionError");
    updateMessage.textContent =
      error.message || getTranslation("updates.unableToCheck");
    updateAction.style.display = "none";
  }

  // Show version history
  async function displayVersionHistory() {
    try {
      // Hide other info
      updateInfo.style.display = "none";

      // Show loading indicator
      changelogInfo.style.display = "block";
      changelogContent.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div><p>${getTranslation(
        "updates.checking"
      )}</p>`;

      // Retrieve version history
      const historyResult = await window.licenseAPI.getVersionHistory();

      if (historyResult.success) {
        const currentVersion =
          historyResult.currentVersion ||
          getTranslation("updates.currentVersion", { 0: "N/A" });
        let htmlContent = "";

        if (historyResult.versions && historyResult.versions.length > 0) {
          // Add current version indicator
          htmlContent += `<div class="current-version">
            <p><strong>${getTranslation("updates.currentVersion", {
              0: "",
            })}</strong> ${currentVersion}</p>
          </div>`;

          // Add each version with its changelog
          historyResult.versions.forEach((version, index) => {
            const isCurrentVersion = version.version === currentVersion;

            htmlContent += `
              <div class="version-item ${
                isCurrentVersion ? "current" : ""
              }" style="margin-top: 20px; padding: 15px; background-color: rgba(0, 0, 0, 0.2); border-radius: 5px; border-left: 3px solid ${
              isCurrentVersion ? "var(--success-color)" : "var(--primary-color)"
            }">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <h3 style="margin: 0; ${
                    isCurrentVersion ? "color: var(--success-color)" : ""
                  }">Version ${version.version}</h3>
                  <span style="font-size: 0.9em; opacity: 0.8;">${
                    version.releaseDate ? formatDate(version.releaseDate) : ""
                  }</span>
                </div>
                ${
                  version.changelog
                    ? `<div class="changelog" style="white-space: pre-wrap;">${version.changelog}</div>`
                    : `<p style="font-style: italic; opacity: 0.6;">${getTranslation(
                        "updates.noReleaseNotes"
                      )}</p>`
                }
              </div>
            `;
          });

          // Add content to ensure scrolling is needed
          htmlContent += `
            <div style="margin-top: 20px; padding: 15px; opacity: 0.7; background-color: rgba(0, 0, 0, 0.2); border-radius: 5px;">
              <h3>${getTranslation("app.title")}</h3>
              <p style="margin-top: 10px;">${getTranslation(
                "updates.autoUpdateInfo",
                "This application is regularly updated to improve your experience."
              )}</p>
              <p>${getTranslation(
                "updates.updateInclude",
                "Updates may include:"
              )}</p>
              <ul style="margin-left: 20px; margin-top: 10px;">
                <li>${getTranslation(
                  "updates.newFeatures",
                  "New features"
                )}</li>
                <li>${getTranslation(
                  "updates.bugFixes",
                  "Corrections de bugs"
                )}</li>
                <li>${getTranslation(
                  "updates.performance",
                  "Performance improvements"
                )}</li>
                <li>${getTranslation(
                  "updates.security",
                  "Security updates"
                )}</li>
              </ul>
              <p style="margin-top: 15px;">${getTranslation(
                "updates.recommendation",
                "We recommend always using the latest available version."
              )}</p>
            </div>
            
            <div style="height: 300px; padding-top: 30px; text-align: center; color: rgba(255,255,255,0.4);">
              <p>— ${getTranslation(
                "updates.historyEnd",
                "End of version history"
              )} —</p>
            </div>
          `;
        } else {
          htmlContent = `<p>${getTranslation(
            "updates.noHistory",
            "No version history available."
          )}</p>`;
        }

        changelogContent.innerHTML = htmlContent;

        // Forcer le rafraîchissement du layout pour assurer que le défilement fonctionne
        setTimeout(() => {
          changelogContent.style.display = "none";
          changelogContent.offsetHeight; // Force le reflow
          changelogContent.style.display = "block";

          // Configurer les contrôles de défilement
          setupScrollControls();
        }, 50);
      } else {
        changelogContent.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <span style="font-size: 30px; color: var(--danger-color);">⚠️</span>
            <p style="margin-top: 10px; font-weight: bold;">${getTranslation(
              "updates.retrievalError",
              "Erreur de récupération"
            )}</p>
            <p>${
              historyResult.message ||
              getTranslation(
                "updates.unableToRetrieveHistory",
                "Impossible de récupérer l'historique des versions"
              )
            }</p>
          </div>
        `;
      }
    } catch (error) {
      _logError("Error while displaying version history:", error);
      changelogContent.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <span style="font-size: 30px; color: var(--danger-color);">⚠️</span>
          <p style="margin-top: 10px; font-weight: bold;">${getTranslation(
            "updates.error",
            "Error"
          )}</p>
          <p>${
            error.message ||
            getTranslation(
              "updates.unexpectedError",
              "An unexpected error occurred"
            )
          }</p>
        </div>
      `;
    }
  }

  // Setup custom scroll controls
  function setupScrollControls() {
    // Remove scroll buttons and keep only event handlers

    // Ensure mouse wheel events work
    changelogContent.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY || e.detail || e.wheelDelta;
        changelogContent.scrollTop += delta > 0 ? 60 : -60;
      },
      { passive: false }
    );

    // Add keyboard handler for up/down arrows
    changelogContent.tabIndex = 0; // allow focus
    changelogContent.style.outline = "none"; // hide focus outline

    changelogContent.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        changelogContent.scrollTop -= 60;
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        changelogContent.scrollTop += 60;
      }
    });

    // Focus the container to allow keyboard navigation
    changelogContent.focus();
  }

  // Validate a license key
  async function validateLicenseKey(licenseKey) {
    if (!licenseKey) return;

    // Show loading indicator
    licenseForm.style.display = "none";
    checkingResult.style.display = "block";
    validResult.style.display = "none";
    invalidResult.style.display = "none";

    try {
      await window.licenseAPI.validateLicense(licenseKey);
      // The rest is handled by event listeners
    } catch (error) {
      _logError("Error during validation:", error);
      displayInvalidLicense("An unexpected error occurred.");
    }
  }

  // Button event: "Check for updates"
  checkUpdatesBtn.addEventListener("click", checkForUpdates);

  // Button event: "Version history"
  viewChangelogBtn.addEventListener("click", () => {
    // Toggle: if history is already visible, hide it
    if (changelogInfo.style.display === "block") {
      changelogInfo.style.display = "none";
      return;
    }

    // Hide update information if visible
    updateInfo.style.display = "none";

    // Show version history
    displayVersionHistory();
  });

  // Button event: "Use this license"
  useSavedBtn.addEventListener("click", () => {
    // Validate saved license
    validateLicenseKey(savedLicense);
  });

  // Button event: "Enter a new license"
  enterNewBtn.addEventListener("click", () => {
    showLicenseInputForm();
  });

  // Button event: "Yes" (use this license)
  useYesBtn.addEventListener("click", () => {
    _log("Yes button clicked - Signal sent to main process");
    // Signal to main process that user validated the license
    window.licenseAPI.signalLicenseValidated();
  });

  // Button event: "No" (change license)
  useNoBtn.addEventListener("click", () => {
    // Show form to enter a new license
    licenseKeyInput.value = "";
    showLicenseInputForm();
  });

  // Event: checking in progress
  window.licenseAPI.onLicenseChecking(() => {
    licenseForm.style.display = "none";
    checkingResult.style.display = "block";
    validResult.style.display = "none";
    invalidResult.style.display = "none";
  });

  // Event: after successful verification
  window.licenseAPI.onLicenseResult((result) => {
    if (result.valid) {
      const savedLicense = licenseKeyInput.value.trim();
      licenseKeyDisplay.textContent = maskLicenseKey(savedLicense);
      lastLicenseResult = result; // Save result for later use
      displayValidLicense(result);
    } else {
      displayInvalidLicense(result.message);
    }
  });

  // Event: verification error
  window.licenseAPI.onLicenseError((errorMessage) => {
    displayInvalidLicense(errorMessage);
  });

  // Events for update checks - now handled manually
  window.licenseAPI.onUpdateCheckResult((result) => {
    lastUpdateInfo = result;
    // Do not display automatically - user will click the button
  });

  window.licenseAPI.onUpdateCheckError((error) => {
    _logError("Error while checking for updates:", error);
    // Do not display automatically - user will click the button
  });

  // Validate button click
  validateBtn.addEventListener("click", async () => {
    const licenseKey = licenseKeyInput.value.trim();

    if (!licenseKey) {
      invalidMessage.textContent = "Please enter a license key.";
      invalidResult.style.display = "block";
      return;
    }

    validateLicenseKey(licenseKey);
  });

  // Retry event
  retryBtn.addEventListener("click", () => {
    hideAllResults();
    // If a license was saved, show the notification
    if (savedLicense) {
      savedLicenseDisplay.textContent = maskLicenseKey(savedLicense);
      savedLicenseNotification.style.display = "block";
      licenseInputForm.style.display = "none";
    } else {
      licenseInputForm.style.display = "block";
    }
  });

  // Enable Enter key to trigger validation
  licenseKeyInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      validateBtn.click();
    }
  });

  // Handlers for license purchase buttons
  buyLicenseBtn.addEventListener("click", () => {
    _log("Redirecting to license purchase page");
    window.licenseAPI.openExternalLink("https://6truc.mysellauth.com/");
  });

  buyLicenseBtnInvalid.addEventListener("click", () => {
    _log("Redirecting to license purchase page from invalid screen");
    window.licenseAPI.openExternalLink("https://6truc.mysellauth.com/");
  });
});
