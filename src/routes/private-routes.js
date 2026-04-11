import { createApiKeyRecord, deleteApiKeyRecord, listApiKeysForOwner } from "../services/api-key-service.js";
import { resolveScopedAccount, saveDeepseekAccountForOwner } from "../services/auth-service.js";
import { deleteAccountById, resolveAccountLabel } from "../services/account-service.js";
import { loginToDeepseek } from "../services/deepseek-auth.js";
import { setGlobalIncognitoEnabled, setOwnerIncognitoEnabled } from "../services/incognito-service.js";
import { toPublicAccount } from "../services/app-payload-service.js";
import { getVisibleAccounts, getSessionIncognitoState } from "../services/auth-service.js";
import { parseJsonBody, readRequestBody, sendError, sendJson } from "../utils/http.js";

async function readJsonRequest(request) {
  return parseJsonBody(await readRequestBody(request)) ?? {};
}

function requireDeviceId(response, body) {
  if (body.deviceId) {
    return true;
  }

  sendError(response, 400, "Missing deviceId");
  return false;
}

function toIncognitoPayload(session) {
  const state = getSessionIncognitoState(session);
  const scope = session.role === "admin" ? "global" : "self";

  return {
    effectiveEnabled: state.effectiveEnabled,
    globalEnabled: state.globalEnabled,
    ownerEnabled: state.ownerEnabled,
    scope,
    scopeEnabled: scope === "global" ? state.globalEnabled : state.ownerEnabled
  };
}

async function handleAccountCreation(request, response, session) {
  const body = await readJsonRequest(request);
  if (!requireDeviceId(response, body)) {
    return true;
  }

  try {
    const loginResult = await loginToDeepseek({
      loginValue: body.username,
      password: body.password,
      deviceId: body.deviceId
    });
    const account = saveDeepseekAccountForOwner({
      ownerId: session.ownerId,
      loginValue: body.username,
      password: body.password,
      deviceId: body.deviceId,
      loginResult
    });

    sendJson(response, 200, { account: toPublicAccount(account) });
  } catch (error) {
    sendError(response, 401, error.message);
  }

  return true;
}

async function handleIncognitoUpdate(request, response, session) {
  const body = await readJsonRequest(request);

  if (session.role === "admin") {
    setGlobalIncognitoEnabled(body.enabled);
  } else {
    setOwnerIncognitoEnabled(session.ownerId, body.enabled);
  }

  sendJson(response, 200, {
    incognito: toIncognitoPayload(session)
  });
  return true;
}

function handleAccountDeletion(response, session, url) {
  const accountId = url.pathname.split("/").pop();
  const account = resolveScopedAccount(session, accountId);

  if (!account) {
    sendError(response, 404, "Account not found");
    return true;
  }

  deleteAccountById(account.id);
  sendJson(response, 200, { accountId: account.id, ok: true });
  return true;
}

export async function handlePrivateApiRequest({ request, response, session, url }) {
  if (request.method === "GET" && url.pathname === "/api/accounts") {
    sendJson(response, 200, {
      accounts: getVisibleAccounts(session).map(toPublicAccount)
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/accounts") {
    return handleAccountCreation(request, response, session);
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/accounts/")) {
    return handleAccountDeletion(response, session, url);
  }

  if (request.method === "POST" && url.pathname === "/api/incognito") {
    return handleIncognitoUpdate(request, response, session);
  }

  if (request.method === "GET" && url.pathname === "/api/api-keys") {
    sendJson(response, 200, {
      apiKeys: listApiKeysForOwner(session.ownerId)
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/api-keys") {
    const body = await readJsonRequest(request);
    const account = resolveScopedAccount(session, body.accountId);
    if (!account) {
      sendError(response, 404, "Account not found");
      return true;
    }

    const result = createApiKeyRecord({
      ownerId: session.ownerId,
      accountId: account.id,
      label: body.label || resolveAccountLabel(account),
      plainKey: body.plainKey || ""
    });

    sendJson(response, 200, result);
    return true;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/api-keys/")) {
    deleteApiKeyRecord(session.ownerId, url.pathname.split("/").pop());
    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}
