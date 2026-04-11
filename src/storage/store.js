import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { config } from "../config.js";

function defaultState() {
  return {
    accounts: [],
    apiKeys: [],
    incognito: {
      globalEnabled: false,
      owners: {}
    },
    invites: [],
    registration: {
      inviteRequired: false
    },
    sessions: [],
    users: []
  };
}

function normalizeIncognito(value) {
  const owners = value?.owners;

  return {
    globalEnabled: Boolean(value?.globalEnabled),
    owners: owners && typeof owners === "object" ? owners : {}
  };
}

function normalizeInvites(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRegistration(value) {
  return {
    inviteRequired: Boolean(value?.inviteRequired)
  };
}

function normalizeUsers(value) {
  const normalizeLimit = (limit) => {
    const parsed = Number(limit);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  return Array.isArray(value) ? value.map((user) => ({
    ...user,
    disabled: Boolean(user?.disabled),
    requestLimits: {
      maxConcurrency: normalizeLimit(user?.requestLimits?.maxConcurrency),
      maxRequestsPerMinute: normalizeLimit(user?.requestLimits?.maxRequestsPerMinute)
    }
  })) : [];
}

function normalizeState(value) {
  return {
    accounts: Array.isArray(value?.accounts) ? value.accounts : [],
    apiKeys: Array.isArray(value?.apiKeys) ? value.apiKeys : [],
    incognito: normalizeIncognito(value?.incognito),
    invites: normalizeInvites(value?.invites),
    registration: normalizeRegistration(value?.registration),
    sessions: Array.isArray(value?.sessions) ? value.sessions : [],
    users: normalizeUsers(value?.users)
  };
}

export function readStore() {
  if (!existsSync(config.dataFile)) {
    const state = defaultState();
    writeStore(state);
    return state;
  }

  const raw = readFileSync(config.dataFile, "utf8");
  return normalizeState(JSON.parse(raw));
}

export function writeStore(state) {
  writeFileSync(config.dataFile, JSON.stringify(normalizeState(state), null, 2));
}

export function updateStore(updater) {
  const current = readStore();
  const next = updater(current);
  writeStore(next);
  return next;
}
