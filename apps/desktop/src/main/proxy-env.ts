/**
 * Build the copy-pasteable shell command that points a terminal session at the
 * managed mixed (http+socks) proxy port — the tray's "Copy Proxy Command"
 * action every mature Clash-family desktop client offers. Pure so the per-shell
 * syntax is unit-testable; the caller owns the clipboard side effect.
 *
 * POSIX shells get one `export` with the three canonical lowercase variables
 * (http_proxy / https_proxy / all_proxy — the spelling curl, git and friends
 * all honor); Windows gets PowerShell `$env:` assignments (the default shell on
 * modern Windows; cmd users can trivially adapt).
 */
export function buildProxyEnvCommand(
  platform: NodeJS.Platform,
  host: string,
  port: number,
): string {
  const http = `http://${host}:${port}`
  const socks = `socks5://${host}:${port}`
  if (platform === 'win32') {
    return [
      `$env:HTTP_PROXY="${http}"`,
      `$env:HTTPS_PROXY="${http}"`,
      `$env:ALL_PROXY="${socks}"`,
    ].join('; ')
  }
  return `export http_proxy=${http} https_proxy=${http} all_proxy=${socks}`
}
