import { bindAdminActions } from "/admin-actions.js";

function bindAuthActions({ els, onLogin, onRegister, setStatus }) {
  els["login-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["login-status"], "登录中...");

    try {
      await onLogin({
        password: els["login-password"].value,
        username: els["login-username"].value.trim()
      });
      setStatus(els["login-status"], "");
    } catch (error) {
      setStatus(els["login-status"], error.message);
    }
  };

  els["register-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["register-status"], "注册中...");

    try {
      await onRegister({
        inviteCode: els["register-invite-code"].value.trim(),
        password: els["register-password"].value,
        username: els["register-username"].value.trim()
      });
      setStatus(els["register-status"], "");
    } catch (error) {
      setStatus(els["register-status"], error.message);
    }
  };
}

function bindWorkspaceActions({ els, onAccountChange, onAddAccount, onLogout, onToggleIncognito, setStatus }) {
  els["logout-button"].onclick = async () => {
    setStatus(els["app-status"], "");

    try {
      await onLogout();
    } catch (error) {
      setStatus(els["app-status"], error.message);
    }
  };

  els["account-select"].onchange = async () => {
    try {
      await onAccountChange(els["account-select"].value);
    } catch (error) {
      setStatus(els["app-status"], error.message);
    }
  };

  els["account-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["account-status"], "绑定中...");

    try {
      await onAddAccount({
        password: els["account-password"].value,
        username: els["account-username"].value.trim()
      });
      els["account-username"].value = "";
      setStatus(els["account-status"], "已绑定。");
    } catch (error) {
      setStatus(els["account-status"], error.message);
    }
  };

  els["incognito-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["incognito-status"], "保存中...");

    try {
      await onToggleIncognito(els["incognito-toggle"].checked);
      setStatus(els["incognito-status"], "已保存。");
    } catch (error) {
      setStatus(els["incognito-status"], error.message);
    }
  };
}

function bindSessionActions({ els, onCreateSession, onRefreshSessions, setStatus }) {
  els["refresh-sessions"].onclick = async () => {
    setStatus(els["app-status"], "");

    try {
      await onRefreshSessions();
    } catch (error) {
      setStatus(els["app-status"], error.message);
    }
  };

  els["new-session"].onclick = async () => {
    setStatus(els["app-status"], "");

    try {
      await onCreateSession();
    } catch (error) {
      setStatus(els["app-status"], error.message);
    }
  };
}

function bindUploadActions({ els, onUploadFiles, setStatus }) {
  els["attach-files"].onclick = () => {
    els["file-input"].click();
  };

  els["file-input"].onchange = async () => {
    const files = Array.from(els["file-input"].files ?? []);
    if (!files.length) {
      return;
    }

    setStatus(els["chat-status"], "");
    try {
      await onUploadFiles(files);
    } catch (error) {
      setStatus(els["chat-status"], error.message);
    } finally {
      els["file-input"].value = "";
    }
  };
}

function bindComposerActions({ els, onSendPrompt, setStatus }) {
  els["send-button"].onclick = async () => {
    setStatus(els["chat-status"], "");

    try {
      await onSendPrompt();
    } catch (error) {
      setStatus(els["chat-status"], error.message);
    }
  };

  els["prompt-input"].onkeydown = async (event) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
      return;
    }

    event.preventDefault();
    await els["send-button"].onclick();
  };
}

function bindFormActions({ els, onExplorerSubmit, onSubmitApiKey, setStatus }) {
  els["api-key-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["api-key-output"], "");

    try {
      await onSubmitApiKey({
        label: els["api-key-label"].value.trim(),
        plainKey: els["api-key-plain"].value.trim()
      });
    } catch (error) {
      setStatus(els["api-key-output"], error.message);
    }
  };

  els["explorer-form"].onsubmit = async (event) => {
    event.preventDefault();
    setStatus(els["explorer-output"], "");

    try {
      await onExplorerSubmit({
        bodyText: els["explorer-body"].value.trim(),
        method: els["explorer-method"].value,
        path: els["explorer-path"].value,
        queryText: els["explorer-query"].value.trim()
      });
    } catch (error) {
      setStatus(els["explorer-output"], error.message);
    }
  };
}

export function bindActions(options) {
  bindAuthActions(options);
  bindWorkspaceActions(options);
  bindSessionActions(options);
  bindUploadActions(options);
  bindComposerActions(options);
  bindFormActions(options);
  bindAdminActions(options);
}
