<div align="center">

<img src="docs/screenshots/landing-desktop.png" alt="BILL SWIPE 首页" width="100%" />

# BILL SWIPE 账单滑动互助

**刷到一张账单，也许就改变一个人的一天。**

一个「左右滑动」的陌生账单互助平台：发现体验像社交 App，背后的支付流水线按金融系统标准实现。

[![线上体验](https://img.shields.io/badge/线上体验-billswipe.852367856.dpdns.org-7957FF?style=flat-square)](https://billswipe.852367856.dpdns.org)
[![License: MIT](https://img.shields.io/badge/许可证-MIT-29C58A?style=flat-square)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/运行于-Cloudflare%20Workers-F5A524?style=flat-square)](https://workers.cloudflare.com/)
[![Follow on X](https://img.shields.io/badge/%F0%9D%95%8F-@0xkillcoin-191919?style=flat-square)](https://x.com/0xkillcoin)

[English README](README.md) · [线上体验](https://billswipe.852367856.dpdns.org) · [作者 X](https://x.com/0xkillcoin)

</div>

---

## 这个产品是什么

有人这周有一张付不掉的账单。BILL SWIPE 把「帮一把」变成一次滑动：一次只出现一张账单，左滑跳过，右滑愿意帮助，上滑「超级帮助」。

**滑动永远不会扣款。** 它只记录你的帮助意愿，并打开金额选择。你只有在下一屏确认了明细总额之后才会真正付款 —— 这条界线写进了代码，而不只是一句文案。

> 这不是静态页面或 UI Demo：账号体系、会话、账单发布与私有凭证存储、人工审核、原子化的筹款记账、通知、举报、带审计日志的后台管理，全部真实可用，并有自动化测试覆盖。

---

## 核心功能

### 发现与帮助
- 卡片拖拽、旋转、弹性回弹、`HELP` / `PASS` / `SUPER HELP` 印章、触觉反馈、三层卡堆。
- **撤销** 上一次滑动（恢复卡片并删除滑动记录）。
- 键盘操作：`←` 跳过、`→` 帮助、`↑` 超级帮助、`↵` 打开、`Z` 撤销。
- 金额面板：$5 / $10 / $25 / $50 快捷金额、自定义金额（上限为剩余所需）、一键匿名。
- **两步确认**：服务端先创建 `pending` 支付意图，再由第二个明确动作完成结算。前端绝不自称支付成功。

### 发布账单
- 五步向导：类型 → 信息 → 凭证 → 故事 → 预览提交。
- 凭证存入 R2 私有存储，原件只有审核员可见；按魔数校验文件类型，用 SHA-256 指纹做重复凭证检测。
- 自动预审信号：重复凭证、异常金额、高频发布、疑似身份证/卡号、引导站外联系。
- **锁定规则**：账单收到第一笔帮助后，金额与收款对象不可再修改，发布者也不能随意关闭。

### 记录与成长
- **我的账单**：审核中 / 进行中 / 已完成 / 需修改 / 已关闭，含进度条。
- **Activity**：我给出的帮助（含支付状态）与收到的帮助（尊重匿名）。
- **个人中心**：统计、成就（刻意不与金额排名挂钩）、隐私开关、通知偏好、改密、拉黑名单。
- **通知**：支付确认、账单审核结果、收到帮助、筹款完成。

### 社区
- 信息流由真实的帮助记录生成，不使用虚构证言；点赞与受审核的留言（服务端限流）。
- 影响力统计来自数据库，Demo 数据在界面上明确标注。

### 后台管理
- 仪表盘：用户数、账单数、待审核、进行中、已完成、成功支付总额、待处理举报、支付异常。
- 账单审核：通过 / 拒绝（附说明）/ 暂停 / 恢复，含风险标记与私有凭证入口。
- 用户管理：搜索、限制、封禁、恢复。
- 支付管理：完整流水与退款（退款在同一事务中回滚筹款金额）。
- 举报处理与**只追加的审计日志**。

---

## 技术架构

```mermaid
flowchart LR
  U[浏览器<br/>React 19 + Vite] -->|/api/*| W[Cloudflare Worker<br/>Hono 路由]
  W -->|静态资源| A[Workers Assets<br/>dist/]
  W -->|私有文件| R[(R2 存储<br/>凭证原件)]
  W -->|RPC 串行| D[Core Durable Object<br/>SQLite]
  D --> DB[(关系型库<br/>16 张表)]
```

**为什么用 Durable Object 而不是 D1？** Cloudflare 免费计划的 D1 数据库上限为 10 个，该账号已被其他线上项目占满。SQLite 后端的 Durable Object 提供同样的 SQL 语义，天然单写者，适合原子化的筹款记账，且完全在免费额度内。数据访问被隔离在 `Db` 接口之后，未来迁移到 D1 / Postgres 是受控的局部改动。

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 界面 | React 19 + TypeScript + Tailwind CSS 4 | 迭代快、无运行时 CSS 开销、设计令牌集中在 `@theme` |
| 动效 | Framer Motion | 拖拽手势、弹簧物理、布局动画 |
| 构建 | Vite 7 | 极快 HMR，产物小 |
| 接口 | Hono on Cloudflare Workers | 基于 Web 标准 Request/Response |
| 数据 | Durable Object 内 SQLite | 事务、单写者原子性 |
| 文件 | Cloudflare R2 | 私有对象存储 |
| 认证 | 自建会话 | PBKDF2-SHA256 口令散列 + HTTP-only Cookie 令牌 |

**金额一律以整数最小货币单位（分）存储**，存储、传输、运算全程没有浮点数；换算边界集中在 `src/shared/money.ts`。

### 支付状态机

```
createPaymentIntent → pending → (settlePayment) → succeeded → (管理员) refunded
                            └──→ failed
结算的同一事务内：payments 状态 + bills.raised_amount + help_records + notifications + 社区动态
达到目标 → 自动 fully_funded，后续支付意图被服务端拒绝
```

已在测试中验证的保证：**幂等键去重**、**重复结算无副作用**、**并发下不会超额筹款**、**贡献金额按剩余额封顶**、**非 sandbox 支付渠道拒绝被 sandbox 结算**。

---

## 安全设计

| 领域 | 实现 |
| --- | --- |
| 口令 | PBKDF2-SHA256（60000 轮）+ 16 字节随机盐 + 恒定时间比较 |
| 会话 | 256 位随机令牌，落库前 SHA-256，约 30 天有效期，HTTP-only + SameSite=Lax + Secure |
| 权限 | 每个管理端路由都在服务端重新校验角色；绝不依赖前端隐藏按钮 |
| 归属校验 | 编辑/关闭/更新账单在服务层校验 `bill.user_id === 当前用户` |
| 凭证 | 私有 R2 键、魔数校验、原件仅审核员可取、`no-store` 缓存策略 |
| 限流 | 基于 Durable Object 的固定窗口，覆盖注册、登录、支付、上传、举报、评论 |
| 响应头 | 全站 `nosniff`、`DENY` 框架、Referrer-Policy、Permissions-Policy |
| 审计 | 审核、封禁、退款、举报处理全部写入 `audit_logs` |

---

## 支付：当前为沙箱，随时可接真实渠道

本部署运行在 **Payment Sandbox 模式**，并在支付确认页、页脚和 `/payments-info` 页面明确标注：**不会真实扣款，不会真实转账。**

沙箱并非「假装成功」：它走的是与真实渠道完全相同的服务端代码路径。

上线需要改的只有服务端三件事：配置 `PAYMENT_MODE=stripe` 与密钥 → 实现带签名校验的 `POST /api/webhooks/stripe` 并调用 `settlePayment(..., { source: 'webhook' })` → 完成渠道 KYC 与结算主体审核。前端无需改动。在此之前，请务必先确认所在地的资金转移合规要求 —— 本项目刻意不让平台自身托管资金。

---

## 本地运行

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/bill-swipe.git
cd bill-swipe
npm install

cp .env.example .dev.vars   # 可选，默认即为沙箱配置
npm run dev:api             # 终端 1：API at http://127.0.0.1:8787
npm run dev                 # 终端 2：UI at http://127.0.0.1:5173
```

打开 <http://127.0.0.1:5173>，首次启动会自动写入 Demo 数据（16 张虚构账单、15 位用户、帮助记录）。

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@billswipe.local` | `BillSwipe!Admin2026` |
| 普通用户 | 自行注册（5 秒） | — |

> 正式使用前请更换：`ADMIN_EMAIL` / `ADMIN_PASSWORD` 用于初始化管理员，`ALLOW_DEMO_SEED=false` 可整体关闭 Demo 数据。

---

## 测试

```bash
npm run typecheck                              # 严格 TypeScript，零错误
npm test                                       # 38 个单元/集成测试（真实 SQLite）
npm run test:e2e                               # 28 条 Playwright 端到端流程（桌面 Chrome + iPhone/WebKit）
node scripts/smoke.mjs https://your-deployment # 31 项 API 契约检查
node scripts/audit-ui.mjs https://your-deployment # 337 项响应式/无障碍检查
```

测试实际证明的内容包括：金额零浮点漂移、费用取整、幂等与重放安全、退款回滚、并发不超额筹款；普通用户访问管理端返回 403；匿名帮助人对公众隐藏但对账单主人可见；沙箱提示出现在确认环节；320px → 1920px 视口无横向溢出、触控目标 ≥32px、正文无小于 10px 的字号、颜色对比度满足 WCAG AA。

实测结果记录见 [`docs/testing.md`](docs/testing.md)。

---

## 已知限制（如实披露）

1. **支付为沙箱**：接入真实渠道、Webhook 验签与结算资质尚未完成。界面已如实标注。
2. **邮件只入队未投递**：未配置 `RESEND_API_KEY` 时，验证与通知邮件写入 `email_outbox` 表而不发送。
3. **邮箱验证未强制**：流程已实现，但 Demo 阶段未开启强制拦截。
4. **单一 Durable Object**：所有写入串行化，正确性极佳，但存在吞吐上限；真实放量前需分片或迁移。
5. **无 KYC**：没有任何机制验证发布者身份，审核仅为人工核对单据。
6. **凭证脱敏靠人工**：界面会提示用户自行遮挡敏感信息，不做自动 PII 识别。
7. **中文界面为预留**：`locale` 字段与文案结构已就位，当前仅英文界面接通。
8. **Demo 数据**：`is_demo = 1` 且界面带「Demo」标记，影响力统计包含它们并在界面说明。

完整的英文说明、部署指南与架构细节见 [`README.md`](README.md)、[`docs/deployment.md`](docs/deployment.md)、[`docs/architecture.md`](docs/architecture.md)。

---

## 许可证

[MIT](LICENSE) © BILL SWIPE contributors

<div align="center">

**Someone's bill. Someone's kindness.**

由 [@0xkillcoin](https://x.com/0xkillcoin) 构建 · [𝕏](https://x.com/0xkillcoin)

</div>
