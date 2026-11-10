import crypto from 'crypto';
import { Role } from '@prisma/client';
import { config } from '../../config';

export interface OidcUserInfo {
  email: string;
  fullName: string;
  role?: Role;
  departmentCode?: string;
}

export interface IAuthProvider {
  getAuthorizationUrl(state: string, codeChallenge: string): Promise<string>;
  exchangeCode(code: string, codeVerifier: string): Promise<OidcUserInfo>;
}

export class OidcAuthProvider implements IAuthProvider {
  async getAuthorizationUrl(state: string, codeChallenge: string): Promise<string> {
    if (!config.OIDC_ISSUER_URL || !config.OIDC_CLIENT_ID || !config.OIDC_REDIRECT_URI) {
      throw new Error('OIDC provider configuration missing');
    }

    const authEndpoint = `${config.OIDC_ISSUER_URL.replace(/\/$/, '')}/authorize`;
    const params = new URLSearchParams({
      client_id: config.OIDC_CLIENT_ID,
      response_type: 'code',
      redirect_uri: config.OIDC_REDIRECT_URI,
      response_mode: 'query',
      scope: config.OIDC_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${authEndpoint}?${params.toString()}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<OidcUserInfo> {
    if (!config.OIDC_ISSUER_URL || !config.OIDC_CLIENT_ID || !config.OIDC_REDIRECT_URI) {
      throw new Error('OIDC provider configuration missing');
    }

    const tokenEndpoint = `${config.OIDC_ISSUER_URL.replace(/\/$/, '')}/token`;
    const body = new URLSearchParams({
      client_id: config.OIDC_CLIENT_ID,
      client_secret: config.OIDC_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.OIDC_REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OIDC token exchange failed: ${errText}`);
    }

    const tokenData = (await response.json()) as { id_token?: string };
    const idToken = tokenData.id_token;
    if (!idToken) {
      throw new Error('No id_token in OIDC response');
    }

    // Decode ID token payload
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    // Map claims to role
    let role: Role = Role.EMPLOYEE;
    const groups: string[] = payload.groups || payload.roles || [];
    if (groups.includes('IT_ADMIN') || groups.includes('Admin')) {
      role = Role.ADMIN;
    } else if (groups.includes('IT_TECH') || groups.includes('Technician')) {
      role = Role.TECHNICIAN;
    }

    return {
      email: payload.preferred_username || payload.email || payload.upn,
      fullName: payload.name || payload.given_name || 'OIDC User',
      role,
      departmentCode: payload.department,
    };
  }
}

export class DevAuthProvider implements IAuthProvider {
  async getAuthorizationUrl(state: string, codeChallenge: string): Promise<string> {
    return `/api/auth/dev-login?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<OidcUserInfo> {
    // In dev mode, the code can be the user's email directly
    return {
      email: code,
      fullName: 'Dev User',
      role: Role.EMPLOYEE,
    };
  }
}

export function getAuthProvider(): IAuthProvider {
  if (config.AUTH_MODE === 'dev') {
    return new DevAuthProvider();
  }
  return new OidcAuthProvider();
}
