import ky from 'ky'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchIPInfo } from '../useIPInfo'

vi.mock('ky', () => ({
  default: {
    get: vi.fn(),
  },
}))

describe('fetchIPInfo with vpndetection.io', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the caller IP and maps VPN, Tor and relay flags', async () => {
    vi.mocked(ky.get).mockReturnValue({
      json: vi.fn().mockResolvedValue({
        ip: '185.220.101.1',
        is_vpn: false,
        is_tor: true,
        is_relay: false,
        location: {
          country: 'DE',
          country_name: 'Germany',
          timezone: 'Europe/Berlin',
        },
        asn: { asn: 60729, name: 'Stiftung Erneuerbare Freiheit' },
      }),
    } as unknown as ReturnType<typeof ky.get>)

    const info = await fetchIPInfo('vpndetection.io')

    expect(ky.get).toHaveBeenCalledWith(
      'https://api.vpndetection.io/myip',
      expect.anything(),
    )
    expect(info).toEqual({
      ip: '185.220.101.1',
      country: 'Germany',
      countryCode: 'DE',
      asn: 60729,
      org: 'Stiftung Erneuerbare Freiheit',
      isProxy: true,
      isVPN: false,
      timezone: 'Europe/Berlin',
    })
  })
})

describe('fetchIPInfo with internetdata.io', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the caller IP, country, ASN and company', async () => {
    vi.mocked(ky.get).mockReturnValue({
      json: vi.fn().mockResolvedValue({
        ip: '8.8.8.8',
        location: {
          country: 'US',
          country_name: 'United States',
          timezone: 'America/Los_Angeles',
        },
        asn: { asn: 15169, name: 'Google LLC', domain: 'google.com' },
        company: { name: 'Google LLC', domain: 'google.com' },
      }),
    } as unknown as ReturnType<typeof ky.get>)

    const info = await fetchIPInfo('internetdata.io')

    expect(ky.get).toHaveBeenCalledWith(
      'https://api.internetdata.io/myip',
      expect.anything(),
    )
    expect(info).toEqual({
      ip: '8.8.8.8',
      country: 'United States',
      countryCode: 'US',
      asn: 15169,
      org: 'Google LLC',
      timezone: 'America/Los_Angeles',
    })
  })
})
