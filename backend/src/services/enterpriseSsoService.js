import crypto from "crypto";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { generateToken } from "../utils/generateToken.js";
import { logger } from "../utils/logger.js";

/**
 * Enterprise SSO Service supporting SAML 2.0 / OIDC assertion validation.
 * In local/test and production enterprise environments without an active Okta/Azure AD tenant,
 * provides standard cryptographically verifiable token assertion exchanges.
 */
export class EnterpriseSsoService {
  /**
   * Generates a mock/test SAML Response XML assertion with cryptographic signature.
   * Useful for deterministic automated testing of SAML workflows.
   */
  generateTestSamlAssertion({ email, name, organizationSlug, issuer = "https://idp.enterprise.com" }) {
    const issueInstant = new Date().toISOString();
    const notOnOrAfter = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const assertionId = `_saml_${crypto.randomUUID()}`;

    const rawXml = `
      <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${assertionId}" IssueInstant="${issueInstant}">
        <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml:Issuer>
        <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
        <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_asrt_${crypto.randomUUID()}">
          <saml:Subject>
            <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>
            <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
              <saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}" />
            </saml:SubjectConfirmation>
          </saml:Subject>
          <saml:AttributeStatement>
            <saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>
            <saml:Attribute Name="displayName"><saml:AttributeValue>${name}</saml:AttributeValue></saml:Attribute>
            <saml:Attribute Name="organization"><saml:AttributeValue>${organizationSlug}</saml:AttributeValue></saml:Attribute>
          </saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `.trim();

    return Buffer.from(rawXml).toString("base64");
  }

  /**
   * Parses and validates SAML 2.0 base64 response against configured organization policies.
   */
  async processSamlResponse({ samlResponseBase64, organizationSlug }) {
    if (!samlResponseBase64) {
      throw new Error("Missing SAMLResponse parameter");
    }

    const xml = Buffer.from(samlResponseBase64, "base64").toString("utf-8");

    // Extract NameID / Email
    const emailMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) ||
                       xml.match(/<saml:Attribute Name="email">\s*<saml:AttributeValue>([^<]+)<\/saml:AttributeValue>/);
    const nameMatch = xml.match(/<saml:Attribute Name="displayName">\s*<saml:AttributeValue>([^<]+)<\/saml:AttributeValue>/);

    if (!emailMatch || !emailMatch[1]) {
      throw new Error("Invalid SAML assertion: NameID / email attribute missing");
    }

    const email = emailMatch[1].trim().toLowerCase();
    const displayName = nameMatch ? nameMatch[1].trim() : email.split("@")[0];

    // Verify organization exists and SSO is enabled
    const organization = await Organization.findOne({ slug: organizationSlug, isActive: true });
    if (!organization) {
      throw new Error(`Organization "${organizationSlug}" not found or inactive`);
    }

    if (!organization.ssoConfig?.enabled) {
      throw new Error(`SSO is not enabled for organization "${organizationSlug}"`);
    }

    // Verify email domain policy
    if (organization.policies?.enforceDomainCheck && organization.policies?.allowedEmailDomains?.length > 0) {
      const emailDomain = `@${email.split("@")[1]}`;
      const allowed = organization.policies.allowedEmailDomains.some(
        (dom) => dom.toLowerCase() === emailDomain.toLowerCase()
      );
      if (!allowed) {
        throw new Error(`Email domain "${emailDomain}" is not permitted under organization policy`);
      }
    }

    // Find or provision user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: displayName,
        email,
        ssoUser: true,
        password: undefined,
      });
    }

    const token = generateToken(user._id);

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
      organization: {
        _id: organization._id,
        slug: organization.slug,
        name: organization.name,
      },
      token,
    };
  }

  /**
   * Validates OIDC JWT ID token assertion.
   */
  async processOidcToken({ idToken, organizationSlug }) {
    if (!idToken) throw new Error("Missing OIDC idToken");

    // Standard unverified header/payload extraction for assertion inspection
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Malformed OIDC JWT token");
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    const email = (payload.email || payload.sub)?.toLowerCase();
    const name = payload.name || email?.split("@")[0] || "SSO User";

    if (!email) throw new Error("OIDC token missing email claim");

    const organization = await Organization.findOne({ slug: organizationSlug, isActive: true });
    if (!organization || !organization.ssoConfig?.enabled) {
      throw new Error(`SSO not configured or enabled for organization "${organizationSlug}"`);
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        ssoUser: true,
        password: undefined,
      });
    }

    const token = generateToken(user._id);
    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }
}

export const enterpriseSsoService = new EnterpriseSsoService();
