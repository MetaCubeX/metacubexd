import { describe, expect, it } from 'vitest'
import { parseSubscriptionDeepLink } from '../deep-link'

describe('parseSubscriptionDeepLink', () => {
  it('parses a clash:// install-config link', () => {
    const url = 'https://example.com/sub?token=abc&flag=meta'
    const raw = `clash://install-config?url=${encodeURIComponent(url)}`
    expect(parseSubscriptionDeepLink(raw)).toEqual({ url })
  })

  it('parses a clashmeta:// install-config link', () => {
    const url = 'https://example.com/sub.yaml'
    const raw = `clashmeta://install-config?url=${encodeURIComponent(url)}`
    expect(parseSubscriptionDeepLink(raw)).toEqual({ url })
  })

  it('includes the optional name param when present', () => {
    const url = 'https://example.com/sub'
    const name = 'My Subscription'
    const raw = `clash://install-config?url=${encodeURIComponent(
      url,
    )}&name=${encodeURIComponent(name)}`
    expect(parseSubscriptionDeepLink(raw)).toEqual({ url, name })
  })

  it('url-decodes the encoded url param', () => {
    const url = 'https://example.com/path with space?a=1&b=2'
    const raw = `clash://install-config?url=${encodeURIComponent(url)}`
    expect(parseSubscriptionDeepLink(raw)?.url).toBe(url)
  })

  it('returns null for an unrecognized scheme', () => {
    const url = 'https://example.com/sub'
    const raw = `vless://install-config?url=${encodeURIComponent(url)}`
    expect(parseSubscriptionDeepLink(raw)).toBeNull()
  })

  it('returns null when the url param is missing', () => {
    expect(
      parseSubscriptionDeepLink('clash://install-config?name=foo'),
    ).toBeNull()
  })

  it('returns null when the url param is empty', () => {
    expect(parseSubscriptionDeepLink('clash://install-config?url=')).toBeNull()
  })

  it('returns null for junk / malformed input', () => {
    expect(parseSubscriptionDeepLink('not a url at all')).toBeNull()
    expect(parseSubscriptionDeepLink('')).toBeNull()
    expect(parseSubscriptionDeepLink('clash://')).toBeNull()
  })

  it('returns null for a recognized scheme but wrong host/path', () => {
    const url = 'https://example.com/sub'
    const raw = `clash://something-else?url=${encodeURIComponent(url)}`
    expect(parseSubscriptionDeepLink(raw)).toBeNull()
  })
})
