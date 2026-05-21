# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in the AppSpec schema, the
reference packages, or any official native library descriptor, please
report it privately rather than opening a public GitHub issue.

**Contact:** brad@skylie.com

Please include:
- The version (commit SHA or release tag)
- A description of the vulnerability and its impact
- Reproduction steps or a proof-of-concept
- Suggested remediation, if you have one

We will acknowledge receipt within 5 business days and aim to issue a
fix or coordinated disclosure plan within 30 days for high-severity
issues.

## Scope

Issues we treat as security-sensitive:
- Schema validation bypass (e.g. a crafted input that passes validation
  but breaks downstream consumers' assumptions).
- JSON Patch operations that escape their declared target boundary.
- Provenance forgery — anything that lets an actor edit a spec without
  the audit envelope reflecting the change.
- Native library descriptors that, when applied via the documented
  runtime walker, allow arbitrary code execution beyond the declared
  componentName.

Issues we do not treat as security-sensitive (file a regular issue):
- Style/lint complaints about lint output.
- Cosmetic schema improvements.
- Migration ergonomics.

## Supported versions

We provide security fixes for:
- The current major (v10.x)
- The previous major (v9.x) — fixes only, no new features

Earlier majors are unsupported. Readers in the reference packages
honour the **Forever Backwards Read** commitment for historical
specs, but security patches do not backport.

## Coordinated disclosure

We prefer coordinated disclosure. Please give us a reasonable window
to ship a fix before publishing details. We will credit reporters in
the release notes unless you ask to remain anonymous.
