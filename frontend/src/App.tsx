import { useCallback, useEffect, useState } from "react";
import { login, logout, restoreSession } from "./api/auth";
import { LoginPage } from "./features/auth/LoginPage";
import { ChatWorkspace } from "./features/chat/ChatWorkspace";
import type { Session } from "./types/auth";
import { clearStoredToken, readStoredToken, writeStoredToken } from "./utils/storage";

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = readStoredToken();
    if (!token) {
      setInitializing(false);
      return;
    }

    restoreSession(token)
      .then((nextSession) => {
        writeStoredToken(nextSession.token);
        setSession(nextSession);
      })
      .catch(() => {
        clearStoredToken();
        setSession(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  const handleLogin = useCallback(async (account: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await login(account, password);
      writeStoredToken(nextSession.token);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "登录失败，请稍后重试");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    if (session?.token) {
      logout(session.token).catch(() => undefined);
    }
    clearStoredToken();
    setSession(null);
    setAuthError(null);
  }, [session?.token]);

  if (initializing) {
    return (
      <div className="app-loading" role="status">
        <span>B</span>
        <strong>正在进入 BeeChat</strong>
      </div>
    );
  }

  if (!session) {
    return <LoginPage error={authError} loading={authLoading} onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <ChatWorkspace onLogout={handleLogout} token={session.token} user={session.user} workspace={session.workspace} />
    </div>
  );
}
