# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

The TalkCody team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **kaisenkang@talkcody.com**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include in Your Report

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

### Our Commitment

- We will acknowledge your email within 48 hours
- We will provide a more detailed response within 7 days
- We will work with you to understand and validate the issue
- We will keep you informed about our progress
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices for Users

### API Keys

- Never commit API keys to version control
- Use the `.env` file for storing API keys (already in `.gitignore`)
- Rotate your API keys regularly
- Use separate API keys for development and production

### Data Security

- All conversations and data are stored locally in SQLite
- Database location: `~/Library/Application Support/com.talkcody.app/`
- No data is sent to TalkCody servers (only to your configured AI providers)
- Back up your data regularly

### MCP Servers

- Only install MCP servers from trusted sources
- Review MCP server permissions before installation
- MCP servers have access to your local file system
- Remove unused MCP servers

### AI Provider API Keys

When using AI providers:
- OpenAI, Anthropic, Google, etc. API keys are stored in macOS Keychain
- API keys are encrypted at rest
- Keys are only transmitted directly to the respective AI providers
- TalkCody does not log or store API responses containing sensitive data

## Known Security Considerations

### Local File Access

TalkCody requires file system access to:
- Read and write project files
- Execute bash commands
- Search code repositories

**Mitigation**:
- TalkCody uses macOS sandboxing
- Path security checks prevent directory traversal attacks
- User confirmation required for destructive operations

### AI Model Risks

When using AI models:
- Models may generate code with security vulnerabilities
- Always review AI-generated code before executing
- Don't share sensitive information in prompts
- Use code analysis tools on AI-generated code

### Marketplace

The Agent and Skills Marketplace:
- Community-contributed agents and skills are not vetted by TalkCody
- Review agent/skill code before installation
- Report malicious agents/skills immediately
- We reserve the right to remove harmful content

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. Updates will be announced via:

- GitHub Security Advisories
- Release notes
- Twitter/X: [@talkcody](https://twitter.com/talkcody)

## Bug Bounty Program

We currently do not have a bug bounty program, but we deeply appreciate responsible disclosure and will publicly acknowledge your contribution (with your permission).

## Security Audit

TalkCody has not yet undergone a formal security audit. We plan to conduct one as the project matures.

## Additional Resources

- [OWASP Desktop App Security](https://owasp.org/www-project-desktop-app-security-top-10/)
- [Tauri Security Documentation](https://tauri.app/security/)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)

## Questions?

If you have questions about this security policy, please open a GitHub Discussion or contact us at kaisenkang@talkcody.com.

---

**Last Updated**: 2025-11-30
