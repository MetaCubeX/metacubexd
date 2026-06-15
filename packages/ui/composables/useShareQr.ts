import type { ProfileMeta } from '~/types/control'
import { encode } from 'uqr'

// Subscription QR sharing.
//
// Only remote (subscription) profiles carry a `url`; local/merge/script profiles
// have nothing shareable. `qrSvg` turns a url into a standalone SVG string built
// from uqr's boolean matrix (one black `<rect>` per set module), so it renders
// without any DOM dependency and stays trivially unit-testable.
export function useShareQr() {
  // A profile can be shared as a QR only when it is a remote subscription with
  // a non-empty url.
  const isShareable = (profile: ProfileMeta): boolean =>
    profile.type === 'remote' && !!profile.url

  // Render `url` as an SVG QR code. Returns '' for an empty url (nothing to
  // encode) so callers can guard the dialog without throwing.
  const qrSvg = (url: string): string => {
    if (!url) return ''

    const { data, size } = encode(url)

    // One module border so scanners get the required quiet zone.
    const border = 1
    const dimension = size + border * 2

    const rects: string[] = []
    for (let y = 0; y < size; y++) {
      const row = data[y]
      if (!row) continue
      for (let x = 0; x < size; x++) {
        if (row[x]) {
          rects.push(
            `<rect x="${x + border}" y="${y + border}" width="1" height="1"/>`,
          )
        }
      }
    }

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${dimension} ${dimension}" ` +
      `shape-rendering="crispEdges">` +
      `<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>` +
      `<g fill="#000000">${rects.join('')}</g>` +
      `</svg>`
    )
  }

  return {
    isShareable,
    qrSvg,
  }
}
