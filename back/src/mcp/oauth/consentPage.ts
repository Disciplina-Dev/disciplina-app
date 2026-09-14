import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { env } from '../../config/env';
import type { Region } from '../../types/tenant';
import { VALID_REGIONS } from '../../types/tenant';
import { LOGO_SVG } from './consentLogo';
import { MCP_SCOPE } from './tokens';

const DEFAULT_CLIENT_NAME = 'Claude (claude.ai)';

const REGION_LABELS: Record<Region, string> = {
    reunion: 'La Réunion',
    annemasse: 'Annemasse',
};

export function escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// Construit l'URL de retour vers le client OAuth (code émis ou erreur), en
// reportant `state` reçu. Utilisé pour le lien « Refuser » et le redirect 302.
export function buildRedirectUri(redirectUri: string, params: AuthorizationParams, code?: string, error?: string): string {
    const url = new URL(redirectUri);
    if (code) url.searchParams.set('code', code);
    if (error) url.searchParams.set('error', error);
    if (params.state) url.searchParams.set('state', params.state);
    return url.href;
}

// Style calqué sur le portail Disciplina (LoginPage + composants ui) : carte
// blanche arrondie, contours gris très clairs, accent bleu unique #1130A7.
export function renderConsentPage(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    error: string | null,
    currentEmail = '',
    currentRegion: Region = env.DB_DEFAULT_TENANT,
): string {
    const clientName = escapeHtml(client.client_name || DEFAULT_CLIENT_NAME);
    const clientUri = client.client_uri ? escapeHtml(client.client_uri.toString()) : null;
    const logoUri = client.logo_uri ? escapeHtml(client.logo_uri.toString()) : null;
    const resource = params.resource ? escapeHtml(params.resource.toString()) : null;
    const scopeRequested = params.scopes && params.scopes.length > 0 ? params.scopes : [MCP_SCOPE];
    const scopeLabel = scopeRequested.includes(MCP_SCOPE)
        ? 'Accès en lecture seule aux données du CRM Disciplina'
        : scopeRequested.map(escapeHtml).join(', ');

    const hiddenFields = [
        ['response_type', 'code'],
        ['client_id', client.client_id],
        ['redirect_uri', params.redirectUri],
        ['code_challenge', params.codeChallenge],
        ['code_challenge_method', 'S256'],
        ...(params.scopes && params.scopes.length > 0 ? ([['scope', params.scopes.join(' ')]] as const) : []),
        ...(params.state ? ([['state', params.state]] as const) : []),
        ...(params.resource ? ([['resource', params.resource.toString()]] as const) : []),
    ]
        .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}"/>`)
        .join('\n    ');

    const regionOptions = VALID_REGIONS.map(
        (region) =>
            `<option value="${region}"${region === currentRegion ? ' selected' : ''}>${REGION_LABELS[region]}</option>`,
    ).join('');

    const errorHtml = error
        ? `<p class="error" role="alert"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>${escapeHtml(error)}</p>`
        : '';
    const clientLogoHtml =
        logoUri && clientName !== DEFAULT_CLIENT_NAME
            ? `<img class="client-logo" src="${logoUri}" alt="" referrerpolicy="no-referrer"/>`
            : '';
    const forgotUrl = escapeHtml(`${env.FRONTEND_BASE_URL}/forgot-password`);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${clientName} — Autorisation Disciplina</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #FAF9F5;
    color: #1A1A1A;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px 16px;
  }
  .card {
    background: #FFFFFF;
    width: 100%; max-width: 448px;
    border-radius: 20px; padding: 32px;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
  .logo { text-align: center; margin-bottom: 24px; }
  .logo svg { height: 40px; width: auto; }
  .title { font-size: 20px; font-weight: 600; text-align: center; margin: 0 0 4px; }
  .subtitle { font-size: 14px; color: #6B6B6B; text-align: center; margin: 0 0 24px; }
  .info {
    background: #F4F3EF;
    border: 1px solid #E8E8E4; border-radius: 12px;
    padding: 12px 14px; margin-bottom: 24px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .info .row { display: flex; gap: 10px; }
  .client-logo { width: 18px; height: 18px; border-radius: 4px; object-fit: contain; flex-shrink: 0; }
  .info .key { color: #6B6B6B; font-size: 13px; }
  .info .val { font-size: 13px; font-weight: 500; }
  .info .val.muted { font-weight: 400; color: #6B6B6B; }
  .info code {
    background: #E8E8E4; padding: 1px 5px; border-radius: 5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
  }
  .field { margin: 0 0 16px; }
  label { display: block; font-size: 14px; font-weight: 500; color: #3D3D3D; margin-bottom: 6px; }
  .input {
    position: relative;
    display: flex; align-items: center;
  }
  .input .icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: #B0B0B0; pointer-events: none; display: flex;
  }
  input, select {
    width: 100%; padding: 12px 14px;
    border: 1px solid #E8E8E4; border-radius: 10px;
    background: #FFFFFF; color: #1A1A1A;
    font-size: 14px; font-family: inherit;
    outline: none; transition: border-color .15s ease;
  }
  input[type=email] { padding-left: 40px; }
  input[type=password] { padding-left: 40px; padding-right: 44px; }
  .input .eye {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; color: #B0B0B0;
    padding: 8px; border-radius: 8px; display: flex;
  }
  .input .eye:hover { color: #3D3D3D; }
  input:focus, select:focus { border-color: #1130A7; }
  select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
  .forgot { display: flex; justify-content: flex-end; margin-top: 6px; }
  .forgot a { font-size: 14px; color: #1130A7; text-decoration: none; }
  .forgot a:hover { text-decoration: underline; }
  .error {
    display: flex; align-items: center; gap: 7px;
    font-size: 14px; color: #EF4444; margin: 0 0 16px;
  }
  .actions { display: flex; gap: 10px; }
  .submit, .deny {
    flex: 1; height: 48px; border-radius: 10px;
    font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    transition: background-color .15s ease, border-color .15s ease, filter .15s ease;
  }
  .submit {
    background: #1130A7; color: #FFFFFF; border: none;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
  .submit:hover { background: #0C2180; }
  .submit:disabled { opacity: .6; cursor: not-allowed; }
  .submit:focus-visible, .deny:focus-visible, .eye:focus-visible {
    outline: none; box-shadow: 0 0 0 3px rgb(17 48 167 / 0.3);
  }
  .deny {
    background: #FFFFFF; color: #1A1A1A;
    border: 1px solid #B0B0B0; text-decoration: none;
  }
  .deny:hover { background: #F4F3EF; }
  .meta { font-size: 12px; color: #6B6B6B; text-align: center; margin: 20px 0 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">${LOGO_SVG}</div>
    <h1 class="title">Connexion requise</h1>
    <p class="subtitle">${clientName} souhaite accéder à vos données Disciplina pour vous assister dans votre travail.</p>

    <div class="info">
      <div class="row">
        ${clientLogoHtml}
        <span class="key">Application</span>
        <span class="val">${clientName}</span>
      </div>
      ${clientUri ? `<div class="row"><span class="key">Site</span><span class="val muted"><a href="${clientUri}" rel="noreferrer" style="color:inherit">${clientUri}</a></span></div>` : ''}
      <div class="row">
        <span class="key">Accès accordé</span>
        <span class="val">Lecture seule — <code>${escapeHtml(MCP_SCOPE)}</code></span>
      </div>
      <div class="row">
        <span class="key">Contenu</span>
        <span class="val muted">${scopeLabel}.</span>
      </div>
      ${resource ? `<div class="row"><span class="key">Destination</span><span class="val muted"><code>${resource}</code></span></div>` : ''}
    </div>

    <form method="post" action="/authorize">
      ${hiddenFields}
      <div class="field">
        <label for="email">E-mail du compte Disciplina</label>
        <div class="input">
          <span class="icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
          <input id="email" name="email" type="email" value="${escapeHtml(currentEmail)}" autocomplete="username" required autofocus/>
        </div>
      </div>
      <div class="field">
        <label for="password">Mot de passe</label>
        <div class="input">
          <span class="icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
          <input id="password" name="password" type="password" autocomplete="current-password" required/>
          <button type="button" id="toggle" class="eye" aria-label="Afficher le mot de passe" aria-pressed="false">
            <svg id="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <div class="forgot"><a href="${forgotUrl}">Mot de passe oublié ?</a></div>
      </div>
      <div class="field">
        <label for="region">Région du compte</label>
        <select id="region" name="region">${regionOptions}</select>
      </div>
      ${errorHtml}
      <div class="actions">
        <button class="submit" id="submit" type="submit">Autoriser</button>
        <a class="deny" id="deny" href="${escapeHtml(buildRedirectUri(params.redirectUri, params, undefined, 'access_denied'))}">Refuser</a>
      </div>
    </form>
    <p class="meta">Autorisation OAuth &mdash; dissociable à tout moment depuis votre compte claude.ai.</p>
  </div>
  <script>
    (() => {
      const toggle = document.getElementById('toggle');
      const password = document.getElementById('password');
      if (toggle && password) {
        toggle.addEventListener('click', () => {
          const show = password.type === 'password';
          password.type = show ? 'text' : 'password';
          toggle.setAttribute('aria-pressed', String(show));
          toggle.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
          const icon = document.getElementById('eye-icon');
          if (icon) icon.innerHTML = show
            ? '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
            : '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>';
        });
      }
      const submit = document.getElementById('submit');
      const form = document.querySelector('form');
      if (submit && form) {
        form.addEventListener('submit', () => {
          submit.disabled = true;
          submit.textContent = 'Connexion…';
        });
      }
    })();
  </script>
</body>
</html>`;
}