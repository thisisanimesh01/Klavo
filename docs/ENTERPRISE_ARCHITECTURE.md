# Klavo Enterprise Workspace Management Architecture (ENT-01)

## 1. Overview
The Klavo Enterprise Workspace Management subsystem introduces organization-level hierarchy, domain and invitation governance policies, fine-grained configurable roles, centralized tamper-resistant audit trails, and federated Single Sign-On (SAML 2.0 / OIDC) architecture while remaining 100% backward compatible with existing workspace teams.

---

## 2. Organization & Workspace Hierarchy

```
+-------------------------------------------------------+
|              Enterprise Organization                  |
|    - slug, name, ownerId                              |
|    - centralized security policies                    |
|    - SSO configuration (SAML 2.0 / OIDC)              |
|    - SCIM 2.0 directory sync specification hook       |
+---------------------------+---------------------------+
                            |
           +----------------+----------------+
           |                                 |
           v                                 v
+-----------------------+         +-----------------------+
|  Workspace (Team A)   |         |  Workspace (Team B)   |
|  - organizationId     |         |  - organizationId     |
|  - policies           |         |  - policies           |
|  - custom roles       |         |  - custom roles       |
|  - memberRoles        |         |  - memberRoles        |
+-----------------------+         +-----------------------+
```

### Compatibility Model
- Independent standalone teams continue to work without an organization (`organizationId: null`).
- Organizations link multiple workspace teams under a unified governance hierarchy without breaking any existing project, task, milestone, or sprint associations.

---

## 3. Cryptographically Verifiable Audit Trail

```
[Genesis Hash: "0"*64]
         |
         v
+-------------------+
|  Sequence 1       | -> calculateHash(event_1, "0"*64) = Hash_1
+-------------------+
         |
         v
+-------------------+
|  Sequence 2       | -> calculateHash(event_2, Hash_1) = Hash_2
+-------------------+
         |
         v
+-------------------+
|  Sequence 3       | -> calculateHash(event_3, Hash_2) = Hash_3
+-------------------+
```

- Each administrative action (`member.added`, `member.role_updated`, `workspace.created`, `workspace.updated`, `organization.policies_updated`, etc.) records an immutable block in `AuditEvent`.
- The `AuditService.verifyChainIntegrity` endpoint iterates through sequential records, verifying that `previousHash` links remain intact and recomputing SHA-256 digests from content to detect any out-of-band tampering or deletions.

---

## 4. Policy & Security Controls

### Domain Restrictions
- Workspaces and organizations can enforce domain validation (`enforceDomainCheck: true`).
- New invitations (`addMemberToTeam`) validate the invitee's email domain against `allowedEmailDomains` (e.g. `["@acme.com", "@acme.corp"]`). Unauthorized domains are denied with HTTP 403.

### Session Max Duration
- Configurable `sessionMaxAgeMinutes` (15 to 43,200 minutes) governs cookie and token lifetime for high-compliance tenants.

---

## 5. Enterprise Identity (SAML 2.0 / OIDC) & SCIM

### SAML 2.0 Assertion Consumer Service (ACS)
- Public endpoint: `POST /api/enterprise/sso/saml/acs`
- Validates base64-encoded XML assertions, matches `NameID` and `Attribute` claims, ensures the tenant organization is active with SSO enabled, checks domain restrictions, and auto-provisions or authenticates the enterprise user.

### Provider Limitations & Assumptions
- In environments without a live external IdP (such as Okta or Azure AD), the `EnterpriseSsoService` supports cryptographically verifiable SAML assertions and standard OIDC tokens.
- **SCIM 2.0**: The schema includes extension hooks (`scimConfig.scimEndpointUrl` and `bearerTokenHash`). Klavo does not expose an active SCIM listener endpoint in this release; organizations wishing to connect automated directory provisioning should use the documented webhook and public REST APIs (`POST /api/teams/add-member` and `DELETE /api/teams/:teamId/members/:memberId`).

---

## 6. Granular Custom Roles & RBAC Matrix
- Workspaces can instantiate `CustomRole` definitions supporting boolean capability flags:
  - `manageMembers`, `manageRoles`, `manageBilling`, `manageSettings`, `manageIntegrations`
  - `createProjects`, `deleteProjects`, `exportData`, `viewAuditLogs`, `manageAutomations`
- Privilege escalation protections ensure that non-owners cannot modify or delete the workspace owner, promote users to owner, or bypass tenant isolation boundaries.
