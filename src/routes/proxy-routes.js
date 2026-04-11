import { getApiKeyRecord } from "../services/api-key-service.js";
import { takeRoundRobinAccount } from "../services/account-rotation-service.js";
import { resolveScopedAccount, resolveSession } from "../services/auth-service.js";
import { deleteChatSession } from "../services/chat-session-service.js";
import {
  collectDeepseekChatResponse,
  createChatCompletionRequestBody,
  sanitizeChatCompletionBody
} from "../services/deepseek-chat-response.js";
import { isIncognitoEnabledForOwner } from "../services/incognito-service.js";
import { collectOpenAiResponse, streamOpenAiResponse } from "../services/openai-bridge.js";
import { proxyDeepseekRequest } from "../services/deepseek-proxy.js";
import { listOpenAiModels } from "../services/openai-request.js";
import { withOwnerRequestLimit } from "../services/request-limit-service.js";
import { parseJsonBody, readRequestBody, sendError, sendJson } from "../utils/http.js";

const CHAT_COMPLETION_PATH = "/api/v0/chat/completion";

function getForwardHeaders(request) {
  const headers = {};
  const contentType = request.headers["content-type"];
  const accept = request.headers.accept;

  if (contentType) {
    headers["content-type"] = contentType;
  }

  if (accept) {
    headers.accept = accept;
  }

  return headers;
}

function getResponseHeaders(upstream) {
  const headers = Object.fromEntries(upstream.headers.entries());
  delete headers["content-encoding"];
  delete headers["content-length"];
  delete headers.connection;
  delete headers["keep-alive"];
  delete headers["transfer-encoding"];
  return headers;
}

function getBearerToken(request) {
  const value = request.headers.authorization ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function tryParseChatCompletionBody(body) {
  if (!body?.byteLength) {
    return null;
  }

  try {
    return parseJsonBody(body);
  } catch {
    return null;
  }
}

function resolveChatCompletionRequest(method, targetPath, body) {
  if (method !== "POST" || targetPath !== CHAT_COMPLETION_PATH) {
    return null;
  }

  const payload = tryParseChatCompletionBody(body);
  if (!payload) {
    return null;
  }

  return {
    payload,
    shouldStream: payload.stream !== false,
    forwardedBody: createChatCompletionRequestBody(payload)
  };
}

function resolveCleanupTask({ account, body, method, ownerId, targetPath }) {
  if (method !== "POST" || targetPath !== CHAT_COMPLETION_PATH) {
    return null;
  }

  if (!isIncognitoEnabledForOwner(ownerId)) {
    return null;
  }

  const chatSessionId = tryParseChatCompletionBody(body)?.chat_session_id;
  if (!chatSessionId) {
    return null;
  }

  return () => deleteChatSession(account, chatSessionId);
}

async function writeUpstreamResponse({ onAfterStream, response, upstream }) {
  response.writeHead(upstream.status, getResponseHeaders(upstream));
  response.flushHeaders?.();

  if (upstream.body) {
    for await (const chunk of upstream.body) {
      response.write(chunk);
    }
  }

  await onAfterStream?.();
  response.end();
}

function resolveLimitStatus(error) {
  return error.code === "USER_DISABLED" ? 403 : 429;
}

function handleOpenAiError(response, error) {
  if (error.code === "USER_DISABLED" || error.code === "REQUEST_LIMIT") {
    sendError(response, resolveLimitStatus(error), error.message);
    return true;
  }

  if (error instanceof SyntaxError) {
    sendError(response, 400, "Invalid JSON body");
    return true;
  }

  if (error.statusCode) {
    sendError(response, error.statusCode, error.message);
    return true;
  }

  return false;
}

export async function handleProxyRequest(request, response, url, allowedProxyPaths) {
  const session = resolveSession(request);
  if (!session) {
    sendError(response, 401, "Unauthorized");
    return true;
  }

  const targetPath = url.pathname.slice("/proxy".length);
  if (!allowedProxyPaths.has(targetPath)) {
    sendError(response, 404, "Proxy path not allowed");
    return true;
  }

  const account = resolveScopedAccount(session, request.headers["x-proxy-account-id"]);
  if (!account) {
    sendError(response, 404, "Account not found");
    return true;
  }

  try {
    await withOwnerRequestLimit(session.ownerId, async () => {
      const rawBody = request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await readRequestBody(request);
      const chatCompletion = resolveChatCompletionRequest(request.method, targetPath, rawBody);
      const forwardedBody = chatCompletion?.forwardedBody ?? rawBody;
      const cleanup = resolveCleanupTask({
        account,
        body: rawBody,
        method: request.method,
        ownerId: session.ownerId,
        targetPath
      });

      if (chatCompletion && !chatCompletion.shouldStream) {
        try {
          const payload = await collectDeepseekChatResponse({
            account,
            body: sanitizeChatCompletionBody(chatCompletion.payload)
          });
          await cleanup?.();
          sendJson(response, 200, payload);
          return;
        } catch (error) {
          await cleanup?.();
          throw error;
        }
      }

      const { response: upstream } = await proxyDeepseekRequest({
        account,
        method: request.method,
        path: targetPath,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: getForwardHeaders(request),
        body: forwardedBody
      });

      await writeUpstreamResponse({
        onAfterStream: cleanup,
        response,
        upstream
      });
    });
  } catch (error) {
    if (error.statusCode) {
      sendError(response, error.statusCode, error.message);
      return true;
    }

    if (error.code !== "USER_DISABLED" && error.code !== "REQUEST_LIMIT") {
      throw error;
    }

    sendError(response, resolveLimitStatus(error), error.message);
  }

  return true;
}

export async function handleOpenAiRequest(request, response, url) {
  const apiKey = getBearerToken(request);
  const apiKeyRecord = apiKey ? getApiKeyRecord(apiKey) : null;

  if (!apiKeyRecord) {
    sendError(response, 401, "Invalid API key");
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/models") {
    try {
      await withOwnerRequestLimit(apiKeyRecord.ownerId, async () => {
        sendJson(response, 200, {
          object: "list",
          data: listOpenAiModels()
        });
      });
    } catch (error) {
      if (!handleOpenAiError(response, error)) {
        throw error;
      }
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
    try {
      await withOwnerRequestLimit(apiKeyRecord.ownerId, async () => {
        const body = parseJsonBody(await readRequestBody(request));
        const account = takeRoundRobinAccount(apiKeyRecord);
        if (!account) {
          sendError(response, 404, "Account not found");
          return;
        }

        const deleteAfterFinish = isIncognitoEnabledForOwner(apiKeyRecord.ownerId);
        if (body.stream) {
          await streamOpenAiResponse({
            response,
            account,
            body,
            deleteAfterFinish
          });
          return;
        }

        const payload = await collectOpenAiResponse({
          account,
          body,
          deleteAfterFinish
        });
        sendJson(response, 200, payload);
      });
    } catch (error) {
      if (!handleOpenAiError(response, error)) {
        throw error;
      }
    }

    return true;
  }

  return false;
}
