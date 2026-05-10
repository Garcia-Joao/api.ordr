const TERMINAL_LATEST_VERSION = process.env.TERMINAL_LATEST_VERSION || '0.1.0'
const TERMINAL_MIN_SUPPORTED_VERSION = process.env.TERMINAL_MIN_SUPPORTED_VERSION || ''
const TERMINAL_DOWNLOAD_PAGE_URL = process.env.TERMINAL_DOWNLOAD_PAGE_URL || 'https://panelordr.com.br/terminal'
const TERMINAL_INSTALLER_URL = process.env.TERMINAL_INSTALLER_URL || 'https://panelordr.com.br/downloads/ORDR-Terminal-Setup.exe'
const TERMINAL_RELEASE_NOTES = process.env.TERMINAL_RELEASE_NOTES || ''

export function getVersionCheck() {
  return {
    product: 'ORDR Terminal',
    latestVersion: TERMINAL_LATEST_VERSION,
    minSupportedVersion: TERMINAL_MIN_SUPPORTED_VERSION || null,
    downloadPageUrl: TERMINAL_DOWNLOAD_PAGE_URL,
    installerUrl: TERMINAL_INSTALLER_URL,
    releaseNotes: TERMINAL_RELEASE_NOTES || null,
    checkedAt: new Date().toISOString(),
  }
}
