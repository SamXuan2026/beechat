import { FormEvent, useState } from "react";
import { Button } from "../../components/Button";
import { TextInput } from "../../components/TextInput";
import "./LoginPage.css";

interface LoginPageProps {
  error?: string | null;
  loading?: boolean;
  onLogin: (account: string, password: string) => Promise<void>;
}

const quickAccounts = [
  { label: "管理员", account: "13677889001", password: "admin123", description: "全量权限" },
  { label: "张三", account: "zhangsan", password: "123456", description: "普通成员" },
  { label: "李四", account: "lisi", password: "123456", description: "普通成员" }
];

export function LoginPage({ error, loading = false, onLogin }: LoginPageProps) {
  const [account, setAccount] = useState("13677889001");
  const [password, setPassword] = useState("admin123");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin(account.trim(), password);
  }

  async function handleQuickLogin(nextAccount: string, nextPassword: string) {
    setAccount(nextAccount);
    setPassword(nextPassword);
    await onLogin(nextAccount, nextPassword);
  }

  return (
    <section className="login-preview" aria-label="BeeChat 登录">
      <form className="login-card" data-testid="login-form" onSubmit={handleSubmit}>
        <div className="login-logo">B</div>
        <h1>登录 BeeChat</h1>
        <p>欢迎回来，请输入您的账号信息</p>
        <TextInput
          autoComplete="username"
          label="账号"
          onChange={(event) => setAccount(event.target.value)}
          value={account}
        />
        <TextInput
          autoComplete="current-password"
          label="密码"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        {error ? <div className="login-error">{error}</div> : null}
        <Button disabled={loading} type="submit">
          {loading ? "登录中..." : "登录"}
        </Button>
        <div className="quick-login" aria-label="测试账号快捷登录">
          <span>测试账号</span>
          <div>
            {quickAccounts.map((item) => (
              <button
                data-testid={`quick-login-${item.account}`}
                disabled={loading}
                key={item.account}
                onClick={() => handleQuickLogin(item.account, item.password)}
                type="button"
              >
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </button>
            ))}
          </div>
        </div>
      </form>
    </section>
  );
}
