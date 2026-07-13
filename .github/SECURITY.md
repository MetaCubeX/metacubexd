# Security Policy

## Supported versions

Security fixes are developed on `main` and shipped in the newest release. The
current release and `main` receive security fixes; older releases are not
guaranteed to receive backports. Upgrade to the latest release before reporting
an issue that may already be fixed.

| Version        | Security fixes |
| -------------- | -------------- |
| `main`         | Yes            |
| Latest release | Yes            |
| Older releases | Not guaranteed |

## Report a vulnerability privately

Do not disclose a suspected vulnerability in a public GitHub issue,
discussion, pull request, commit, or other public channel.

Use [GitHub private vulnerability reporting](https://github.com/MetaCubeX/metacubexd/security/advisories/new).
Include enough information for maintainers to reproduce and assess the issue:

- The affected version, release tag, or commit.
- Deployment type, operating system, and architecture.
- Reproduction steps, impact, and required privileges or network access.
- Relevant logs or screenshots with secrets and personal data removed.
- A suggested mitigation or fix, if available.

Never submit a real `CONTROL_TOKEN`, `CLASH_SECRET`, subscription URL, profile,
private key, or other credential. Replace sensitive values with clearly marked
placeholders.

Maintainers will triage the report privately, may request more information, and
will coordinate any fix, advisory, and release before public disclosure. Please
allow time for investigation and coordinate disclosure timing with the
maintainers.

Non-security bugs can be reported through the public
[issue tracker](https://github.com/MetaCubeX/metacubexd/issues).
