// electron-builder afterPack hook: flip Electron's runtime fuses on the packaged
// binary to shrink the attack surface. Fuses are baked into the binary, so this
// must run per-arch on the packed output (afterPack runs before signing, so the
// subsequent electron-builder code-sign covers the modified binary; for unsigned
// dev builds resetAdHocDarwinSignature keeps it loadable).
//
// WHY THESE SETTINGS (NOT the usual "disable RunAsNode" lockdown):
//  - RunAsNode stays ON. The privileged TUN helper is the SAME bundled Electron
//    binary launched with ELECTRON_RUN_AS_NODE=1 to run out/helper/index.js as a
//    root service. Disabling RunAsNode would break TUN entirely. The IPC is still
//    secret-gated + path-validated (see assertSafeKernelPaths), so the residual
//    risk of RunAsNode is mitigated at the helper layer instead.
//  - NodeOptions env + Node CLI inspect args are turned OFF: they are the usual
//    vectors for injecting code into an Electron app via env/argv, and nothing in
//    this app (or the helper) needs them.
//  - OnlyLoadAppFromAsar ON: refuse to load the app from an on-disk app/ folder
//    swapped in next to the binary (the helper runs from app.asar.unpacked as a
//    plain node script path, which this fuse does not govern).
//  - Cookie encryption ON: cheap hardening for any persisted cookie state.
//
// VERIFY ON A REAL PACK: `npx @electron/fuses read --app <packaged .app/.exe>`
// should show RunAsNode=Enable and the three above Disable/Enable as set here,
// and TUN enable must still elevate + route on a real machine.

const fs = require('node:fs')
const path = require('node:path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

/** @param {import('electron-builder').AfterPackContext} context */
exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context
  const productName = packager.appInfo.productFilename

  let electronBinaryPath
  if (electronPlatformName === 'darwin') {
    electronBinaryPath = path.join(appOutDir, `${productName}.app`)
  } else if (electronPlatformName === 'win32') {
    electronBinaryPath = path.join(appOutDir, `${productName}.exe`)
  } else {
    // Linux: electron-builder names the unpacked executable from executableName
    // (lowercased), which differs from the product name — pick whichever
    // candidate actually exists rather than guessing.
    const candidates = [
      packager.executableName,
      productName,
      productName.toLowerCase(),
    ].filter(Boolean)
    const found = candidates.find((n) => fs.existsSync(path.join(appOutDir, n)))
    if (!found) {
      throw new Error(
        `[after-pack] linux executable not found in ${appOutDir} (tried: ${candidates.join(', ')})`,
      )
    }
    electronBinaryPath = path.join(appOutDir, found)
  }

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    // Re-apply an ad-hoc signature on macOS after mutating the binary so unsigned
    // dev builds stay launchable; a real signing identity overrides it in the
    // later electron-builder sign step.
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true,
  })

  console.log(
    `[after-pack] fuses flipped on ${electronPlatformName} (${context.arch}): ` +
      `RunAsNode kept ON for the helper; NodeOptions/inspect OFF; OnlyLoadAppFromAsar ON`,
  )
}
