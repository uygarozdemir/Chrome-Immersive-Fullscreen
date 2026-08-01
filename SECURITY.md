# Security Policy

## Supported versions

The latest commit on the default branch is the supported version of this source-distributed extension. No Chrome Web Store package is currently published from this repository.

## Reporting a vulnerability

Please use GitHub's **Report a vulnerability** option in the repository's Security tab. This creates a private vulnerability report.

Do not open a public issue for vulnerabilities that could expose user data, bypass URL restrictions, perform actions in the wrong browser window, inject markup or script, or expand extension permissions unexpectedly.

Include:

- a clear description of the issue and its impact;
- reproducible steps or a minimal proof of concept;
- the affected Chrome and extension versions;
- relevant logs or screenshots with personal data removed;
- any suggested mitigation.

Non-sensitive hardening suggestions may be submitted as regular issues.

## Security model

The project is intentionally dependency-free and local-only. Changes affecting `manifest.json`, content-script scope, Chrome permissions, message handling, tab access, navigation, bookmarks, storage, or window actions receive additional scrutiny. Remote code, telemetry, and silent data transmission are out of scope for the project.
