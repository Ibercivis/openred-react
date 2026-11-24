/**
 * Signing in with an Ibercivis account: the browser's half.
 *
 * LOCAL-DEV.md describes the service and what signing in with it does here.
 *
 * This module sends the person to the service with a PKCE challenge and a
 * `state`, and on the way back checks that the answer is the one it asked for
 * and yields the authorization code with the verifier that goes with it. The
 * API redeems that code with its own client secret
 * (`apiService.loginWithIbercivis`), so this app never holds a token of the
 * service's.
 *
 * The protocol work is `oauth4webapi`'s. What is here is which values go where.
 */
import * as oauth from 'oauth4webapi';

const issuer = process.env.REACT_APP_IBERCIVIS_ACCOUNT_ISSUER;
const clientId = process.env.REACT_APP_IBERCIVIS_ACCOUNT_CLIENT_ID;

/** Off unless both are set: no button, and the callback page has nothing to finish. */
export const ibercivisAccountEnabled = Boolean(issuer && clientId);

export const IBERCIVIS_ACCOUNT_CALLBACK_PATH = '/auth/ibercivis/callback';

/** The service grants this client these scopes and refuses a request for any other. */
const SCOPE = 'openid email';

const PENDING_KEY = 'ibercivis-account.pending';

interface Pending {
  codeVerifier: string;
  state: string;
}

/** What the callback page hands to the API. */
export interface IbercivisAccountCode {
  code: string;
  code_verifier: string;
}

function redirectUri(): string {
  return `${window.location.origin}${IBERCIVIS_ACCOUNT_CALLBACK_PATH}`;
}

async function discover(): Promise<oauth.AuthorizationServer> {
  if (!issuer) throw new Error('The Ibercivis account is not configured');
  const issuerUrl = new URL(issuer);
  const response = await oauth.discoveryRequest(issuerUrl, {
    // A local stack reaches the service over plain HTTP. A production build never does.
    [oauth.allowInsecureRequests]: process.env.NODE_ENV === 'development',
  });
  return oauth.processDiscoveryResponse(issuerUrl, response);
}

/** Leaves the page for the service's sign-in. */
export async function startIbercivisAccountSignIn(): Promise<void> {
  const as = await discover();
  if (!as.authorization_endpoint) throw new Error('The service names no authorization endpoint');

  const pending: Pending = {
    codeVerifier: oauth.generateRandomCodeVerifier(),
    state: oauth.generateRandomState(),
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const url = new URL(as.authorization_endpoint);
  url.searchParams.set('client_id', clientId!);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(pending.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', pending.state);
  window.location.assign(url.href);
}

/**
 * Checks the answer the service sent back to the callback page -- the `state`
 * this browser kept, and the `iss` the service names itself with -- and yields
 * the code. Throws when the person declined, when nothing was started here, or
 * when the answer is not the one asked for. Usable once: the verifier is gone
 * afterwards.
 */
export async function finishIbercivisAccountSignIn(callbackUrl: URL): Promise<IbercivisAccountCode> {
  const stored = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  if (!stored) throw new Error('No Ibercivis sign-in was started in this browser tab');
  const pending: Pending = JSON.parse(stored);

  const as = await discover();
  const params = oauth.validateAuthResponse(as, { client_id: clientId! }, callbackUrl, pending.state);
  const code = params.get('code');
  // `validateAuthResponse` checks the answer is the one this browser asked for;
  // it does not promise a code is in it. Without one there is nothing to
  // redeem, and failing here beats posting `undefined` to the API.
  if (!code) throw new Error('The service sent no authorization code');
  return { code, code_verifier: pending.codeVerifier };
}
