const { expect, test } = require("@playwright/test");

const adminAccount = "13677889001";
const adminPassword = "admin123";

async function login(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("login-form")).toBeVisible();
  await page.getByRole("textbox", { name: "账号" }).fill(adminAccount);
  await page.getByLabel("密码", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("BeeChat").first()).toBeVisible();
  await expect(page.getByTestId("channel-general")).toBeVisible();
}

async function saveLisiRole(page, role) {
  await page.getByTestId("admin-user-role-lisi").selectOption(role);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/admin/users/3") && response.request().method() === "PUT"),
    page.getByTestId("admin-user-save-lisi").click()
  ]);
  await expect(page.getByTestId("admin-user-role-lisi")).toHaveValue(role);
}

test.describe("BeeChat MVP 回归测试", () => {
  test("入口页面可加载并展示登录页", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page).toHaveTitle(/BeeChat/);
    await expect(page.getByRole("heading", { name: "登录 BeeChat" })).toBeVisible();
  });

  test("测试账号可快捷登录", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("quick-login-zhangsan").click();
    await expect(page.getByTestId("channel-general")).toBeVisible();
  });

  test("主体界面固定在一个屏幕内", async ({ page }) => {
    async function readLayoutMetrics() {
      return page.evaluate(() => {
        const workspace = document.querySelector(".chat-workspace")?.getBoundingClientRect();
        const main = document.querySelector(".chat-main")?.getBoundingClientRect();
        const sidebar = document.querySelector(".chat-sidebar")?.getBoundingClientRect();
        const composer = document.querySelector(".composer-preview")?.getBoundingClientRect();
        const rightPanel = document.querySelector(".right-panel")?.getBoundingClientRect();
        const rightPanelContent = document.querySelector(".right-panel-content")?.getBoundingClientRect();

        return {
          innerHeight,
          bodyScrollHeight: document.body.scrollHeight,
          workspaceHeight: workspace?.height ?? 0,
          mainBottom: main?.bottom ?? 0,
          sidebarBottom: sidebar?.bottom ?? 0,
          composerBottom: composer?.bottom ?? 0,
          rightPanelBottom: rightPanel?.bottom ?? 0,
          rightPanelContentBottom: rightPanelContent?.bottom ?? 0
        };
      });
    }

    function expectOneScreen(metrics, hasRightPanel = true) {
      expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
      expect(metrics.workspaceHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
      expect(metrics.mainBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
      expect(metrics.sidebarBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
      expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
      if (hasRightPanel) {
        expect(metrics.rightPanelBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
        expect(metrics.rightPanelContentBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await expect(page.getByTestId("channel-info-bar")).toBeVisible();
    await expect(page.getByTestId("channel-info-bar")).toContainText("安全协作");
    await expect(page.locator(".chat-topbar-title")).toContainText("general");
    await expect(page.locator(".channel-icon")).toBeVisible();
    expectOneScreen(await readLayoutMetrics());

    await page.setViewportSize({ width: 390, height: 844 });
    expectOneScreen(await readLayoutMetrics(), false);
  });

  test("长文本、输入区与右侧面板不会撑破主界面", async ({ page }) => {
    const stamp = Date.now();
    const longMessage = `E2E 长文本 ${stamp} ` + "企业协同消息需要自动换行".repeat(80);

    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();
    await expect(page.getByTestId("composer-preview")).toContainText("待输入");
    await expect(page.getByTestId("composer-preview")).toContainText("输入消息后发送");
    await expect(page.getByTestId("composer-preview")).toHaveAttribute("data-state", "empty");
    await expect(page.getByTestId("composer-upload-button")).toBeEnabled();
    await page.getByTestId("message-input").fill(longMessage);
    await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
    await expect(page.getByTestId("composer-preview")).toContainText("准备发送");
    await expect(page.getByTestId("composer-preview")).toHaveAttribute("data-state", "ready");
    await page.getByRole("button", { name: "发送" }).click();

    const sentMessage = page.getByTestId("message-row").filter({ hasText: `E2E 长文本 ${stamp}` }).last();
    await expect(sentMessage).toBeVisible();
    await expect(sentMessage).toHaveAttribute("data-message-owner", "me");
    await expect(sentMessage.getByRole("group", { name: "消息操作" })).toBeVisible();
    await expect(sentMessage.getByRole("group", { name: "消息回应" })).toBeVisible();

    const layoutMetrics = await page.evaluate((messageText) => {
      const rows = Array.from(document.querySelectorAll(".message-row"));
      const targetRow = rows.find((row) => row.textContent?.includes(messageText));
      const rowRect = targetRow?.getBoundingClientRect();
      const listRect = document.querySelector(".message-list")?.getBoundingClientRect();
      const composerRect = document.querySelector(".composer-preview")?.getBoundingClientRect();
      return {
        innerHeight,
        composerBottom: composerRect?.bottom ?? 0,
        rowRight: rowRect?.right ?? 0,
        listRight: listRect?.right ?? 0
      };
    }, `E2E 长文本 ${stamp}`);

    expect(layoutMetrics.composerBottom).toBeLessThanOrEqual(layoutMetrics.innerHeight + 2);
    expect(layoutMetrics.rowRight).toBeLessThanOrEqual(layoutMetrics.listRight + 2);

    await page.getByRole("button", { name: "成员" }).click();
    await expect(page.getByTestId("member-panel")).toBeVisible();
    await expect(page.getByTestId("member-panel")).toContainText("位成员");
    await page.getByRole("button", { name: "文件" }).click();
    await expect(page.getByTestId("file-panel")).toBeVisible();
    await expect(page.getByTestId("file-panel")).toContainText("频道文件");
    await page.getByRole("button", { name: "审计" }).click();
    await expect(page.getByTestId("audit-panel")).toBeVisible();
    await expect(page.getByTestId("audit-panel")).toContainText("审计记录");
  });

  test("侧边栏搜索、频道未读和私信状态保持稳定", async ({ page }) => {
    const searchMessage = `E2E 搜索侧栏 ${Date.now()}`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await expect(page.getByTestId("channel-engineering")).toBeVisible();
    await expect(page.getByTestId("dm-3")).toBeVisible();

    await page.getByTestId("message-input").fill(searchMessage);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByTestId("message-row").filter({ hasText: searchMessage }).last()).toBeVisible();

    await page.getByRole("textbox", { name: "搜索" }).fill("不存在的侧边栏搜索词");
    await expect(page.getByTestId("search-results")).toContainText("暂无结果");

    await page.getByRole("textbox", { name: "搜索" }).fill(searchMessage);
    await expect(page.getByTestId("search-results")).toBeVisible();
    await expect(page.getByTestId("search-results").getByRole("button").first()).toBeVisible();
    await expect(page.getByTestId("search-results")).toContainText("频道消息");

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector(".chat-sidebar")?.getBoundingClientRect();
      const activeChannel = document.querySelector("[data-testid='channel-general']")?.getBoundingClientRect();
      const channel = document.querySelector("[data-testid='channel-engineering']")?.getBoundingClientRect();
      const direct = document.querySelector("[data-testid='dm-3']")?.getBoundingClientRect();
      const searchResults = document.querySelector(".search-results")?.getBoundingClientRect();
      return {
        innerHeight,
        activeChannelWidth: activeChannel?.width ?? 0,
        channelRight: channel?.right ?? 0,
        directRight: direct?.right ?? 0,
        searchBottom: searchResults?.bottom ?? 0,
        sidebarRight: sidebar?.right ?? 0,
        sidebarBottom: sidebar?.bottom ?? 0
      };
    });
    expect(metrics.sidebarBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.activeChannelWidth).toBeGreaterThan(120);
    expect(metrics.searchBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.channelRight).toBeLessThanOrEqual(metrics.sidebarRight + 2);
    expect(metrics.directRight).toBeLessThanOrEqual(metrics.sidebarRight + 2);
  });

  test("窄屏下侧栏、输入区和管理弹层保持可操作", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    await expect(page.locator(".right-panel")).toBeHidden();
    await expect(page.getByTestId("message-input")).toBeVisible();
    await page.getByRole("textbox", { name: "搜索" }).fill("欢迎");
    await expect(page.getByTestId("search-results")).toBeVisible();

    const workspaceMetrics = await page.evaluate(() => {
      const sidebar = document.querySelector(".chat-sidebar")?.getBoundingClientRect();
      const main = document.querySelector(".chat-main")?.getBoundingClientRect();
      const composer = document.querySelector(".composer-preview")?.getBoundingClientRect();
      const searchResults = document.querySelector(".search-results")?.getBoundingClientRect();
      return {
        bodyScrollHeight: document.body.scrollHeight,
        composerBottom: composer?.bottom ?? 0,
        innerHeight,
        mainBottom: main?.bottom ?? 0,
        searchBottom: searchResults?.bottom ?? 0,
        sidebarBottom: sidebar?.bottom ?? 0,
        sidebarHeight: sidebar?.height ?? 0
      };
    });
    expect(workspaceMetrics.bodyScrollHeight).toBeLessThanOrEqual(workspaceMetrics.innerHeight + 2);
    expect(workspaceMetrics.sidebarHeight).toBeLessThanOrEqual(280);
    expect(workspaceMetrics.sidebarHeight).toBeGreaterThanOrEqual(210);
    expect(workspaceMetrics.sidebarBottom).toBeLessThanOrEqual(workspaceMetrics.innerHeight + 2);
    expect(workspaceMetrics.mainBottom).toBeLessThanOrEqual(workspaceMetrics.innerHeight + 2);
    expect(workspaceMetrics.composerBottom).toBeLessThanOrEqual(workspaceMetrics.innerHeight + 2);
    expect(workspaceMetrics.searchBottom).toBeLessThanOrEqual(workspaceMetrics.innerHeight + 2);

    await page.getByTestId("admin-button").click();
    await expect(page.getByRole("dialog", { name: "管理后台" })).toBeVisible();
    const modalMetrics = await page.evaluate(() => {
      const modal = document.querySelector(".bc-modal")?.getBoundingClientRect();
      const panel = document.querySelector(".admin-panel")?.getBoundingClientRect();
      return {
        innerHeight,
        modalBottom: modal?.bottom ?? 0,
        modalLeft: modal?.left ?? 0,
        modalRight: modal?.right ?? 0,
        panelBottom: panel?.bottom ?? 0
      };
    });
    expect(modalMetrics.modalLeft).toBeGreaterThanOrEqual(0);
    expect(modalMetrics.modalRight).toBeLessThanOrEqual(390);
    expect(modalMetrics.modalBottom).toBeLessThanOrEqual(modalMetrics.innerHeight + 2);
    expect(modalMetrics.panelBottom).toBeLessThanOrEqual(modalMetrics.innerHeight + 2);
  });

  test("管理员可登录、发送频道消息、发送线程回复并退出", async ({ page }) => {
    const stamp = Date.now();
    const channelMessage = `E2E 频道消息 ${stamp}`;
    const threadMessage = `E2E 线程回复 ${stamp}`;

    await login(page);
    await page.getByTestId("channel-general").click();
    await page.getByTestId("message-input").fill(channelMessage);
    await page.getByRole("button", { name: "发送" }).click();
    const sentMessage = page.getByTestId("message-row").filter({ hasText: channelMessage }).last();
    await expect(sentMessage).toBeVisible();

    await sentMessage.getByTestId("thread-open-button").click();
    await expect(page.getByTestId("thread-panel")).toContainText(channelMessage);
    await expect(page.getByTestId("thread-detail-panel")).toContainText("线程回复");
    await page.getByTestId("thread-input").fill(threadMessage);
    await page.getByTestId("thread-detail-panel").getByRole("button", { name: "回复" }).click();
    await expect(page.getByTestId("thread-panel")).toContainText(threadMessage);

    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page.getByRole("heading", { name: "登录 BeeChat" })).toBeVisible();
  });

  test("管理员可在发现频道中创建频道并发送消息", async ({ page }) => {
    const stamp = Date.now();
    const channelName = `e2e-${stamp}`;
    const channelDescription = "E2E 自动创建频道";
    const channelMessage = `E2E 新频道消息 ${stamp}`;

    await login(page);
    await page.getByTestId("discover-button").click();
    await expect(page.getByRole("dialog", { name: "发现频道" })).toBeVisible();
    await page.getByTestId("channel-name-input").fill(channelName);
    await page.getByTestId("channel-description-input").fill(channelDescription);
    await page.getByRole("button", { name: "创建" }).click();

    const createdChannel = page.getByTestId(`channel-${channelName}`);
    await expect(createdChannel).toBeVisible();
    await expect(createdChannel).toHaveClass(/active/);
    await page.getByTestId("message-input").fill(channelMessage);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByTestId("message-row").filter({ hasText: channelMessage }).last()).toBeVisible();
  });

  test("管理员可在成员面板邀请并移除频道成员", async ({ page }) => {
    const stamp = Date.now();
    const channelName = `members-${stamp}`;

    await login(page);
    await page.getByTestId("discover-button").click();
    await page.getByTestId("channel-name-input").fill(channelName);
    await page.getByTestId("channel-description-input").fill("E2E 成员管理频道");
    await page.getByRole("button", { name: "创建" }).click();
    await expect(page.getByTestId(`channel-${channelName}`)).toBeVisible();

    await page.getByRole("button", { name: "成员" }).click();
    await expect(page.getByTestId("member-panel")).toBeVisible();
    await page.getByTestId("member-invite-select").selectOption("2");
    await page.getByRole("button", { name: "邀请" }).click();
    await expect(page.getByTestId("member-panel")).toContainText("张三");

    await page.getByTestId("remove-member-2").click();
    await expect(page.getByTestId("member-row").filter({ hasText: "张三" })).toHaveCount(0);
  });

  test("管理员可在审计面板按类型筛选记录", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "审计" }).click();
    await expect(page.getByTestId("audit-panel")).toBeVisible();
    await expect(page.getByTestId("audit-row").first()).toBeVisible();

    await page.getByTestId("audit-filter-login").click();
    await expect(page.getByTestId("audit-panel")).toContainText("用户登录");

    await page.getByTestId("audit-filter-member").click();
    await expect(page.getByTestId("audit-panel")).toContainText(/创建频道|加入频道|邀请频道成员|移除频道成员/);

    await page.getByTestId("audit-filter-all").click();
    await page.getByTestId("audit-operator-input").fill(adminAccount);
    await page.getByTestId("audit-keyword-input").fill("登录");
    await expect(page.getByTestId("audit-panel")).toContainText("用户登录");
  });

  test("管理员可打开设置并保存个人偏好", async ({ page }) => {
    const stamp = Date.now();

    await login(page);
    await page.getByRole("button", { name: "打开设置" }).click();
    await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
    await expect(page.getByTestId("settings-panel")).toBeVisible();
    await page.getByTestId("settings-bio").fill(`E2E 设置 ${stamp}`);
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByTestId("settings-bio")).toHaveValue(`E2E 设置 ${stamp}`);
  });

  test("管理员可打开管理后台并维护频道说明", async ({ page }) => {
    const description = `E2E 管理频道说明 ${Date.now()}`;

    await login(page);
    await page.getByTestId("admin-button").click();
    await expect(page.getByRole("dialog", { name: "管理后台" })).toBeVisible();
    await expect(page.getByTestId("admin-panel")).toBeVisible();
    await expect(page.getByTestId("admin-audit-row").first()).toBeVisible();
    await page.getByTestId("admin-channel-description-general").fill(description);
    await page.getByRole("button", { name: "保存" }).first().click();
    await expect(page.getByTestId("admin-channel-description-general")).toHaveValue(description);

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector(".admin-panel")?.getBoundingClientRect();
      const hero = document.querySelector(".admin-hero")?.getBoundingClientRect();
      const policyLayout = document.querySelector(".admin-policy-layout")?.getBoundingClientRect();
      return {
        innerHeight,
        heroWidth: hero?.width ?? 0,
        panelBottom: panel?.bottom ?? 0,
        panelHeight: panel?.height ?? 0,
        policyWidth: policyLayout?.width ?? 0
      };
    });
    expect(metrics.panelBottom).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.panelHeight).toBeGreaterThan(0);
    expect(metrics.heroWidth).toBeGreaterThan(0);
    expect(metrics.policyWidth).toBeGreaterThan(0);
  });

  test("管理员可维护角色、安全策略并看到审计导出入口", async ({ page }) => {
    await login(page);
    await page.getByTestId("admin-button").click();
    await expect(page.getByRole("dialog", { name: "管理后台" })).toBeVisible();

    await expect(page.getByTestId("admin-user-row-lisi")).toBeVisible();
    await saveLisiRole(page, "ADMIN");
    await saveLisiRole(page, "AUDITOR");
    await saveLisiRole(page, "CHANNEL_ADMIN");
    await saveLisiRole(page, "USER");

    await page.getByTestId("admin-policy-max-failures").fill("4");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/admin/security-policy") && response.request().method() === "PUT"),
      page.getByRole("button", { name: "保存安全策略" }).click()
    ]);
    await expect(page.getByTestId("admin-policy-max-failures")).toHaveValue("4");
    await page.getByTestId("admin-upload-max-size").fill("2");
    await expect(page.getByTestId("admin-upload-max-size")).toHaveValue("2");
    await page.getByTestId("admin-upload-extensions").fill(".txt, .pdf, .png");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/admin/upload-policy") && response.request().method() === "PUT"),
      page.getByRole("button", { name: "保存文件策略" }).click()
    ]);
    await expect(page.getByTestId("admin-upload-max-size")).toHaveValue("2");
    await page.getByTestId("admin-network-ips").fill("127.0.0.1, ::1");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/admin/network-policy") && response.request().method() === "PUT"),
      page.getByRole("button", { name: "保存网络策略" }).click()
    ]);
    await expect(page.getByTestId("admin-network-ips")).toHaveValue("127.0.0.1");
    await expect(page.getByTestId("admin-audit-export")).toHaveAttribute("href", /\/api\/admin\/audits\/export\?token=/);
  });

  test("管理员可上传频道文件并看到文件卡片", async ({ page }) => {
    const stamp = Date.now();
    const fileName = `e2e-${stamp}.txt`;

    await login(page);
    await page.getByTestId("file-input").setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(`BeeChat E2E file ${stamp}`)
    });

    await expect(page.getByTestId("message-row").filter({ hasText: fileName }).last()).toBeVisible();
  });
});
