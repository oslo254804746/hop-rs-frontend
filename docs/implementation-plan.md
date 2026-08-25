# Hop 管理面板实施记录

状态：Compose 同源、ownership 与国际化改造已实施

## 交付定义

交付一套可独立开发、以静态容器运行、与 Hop 同版本配套的 Vue 应用。默认生产路径不要求 API URL，只要求网页管理 Token。普通 UI 不再提供配置来源或声明文件 Apply 工作台。

## 架构

```text
src/
  api/          同源/远程 Control API adapter 与错误规范化
  demo/         明确标记的合成数据 adapter
  domain/       Catalog、session 与 ownership 模型
  i18n/         English/简体中文 locale 与词典
  queries/      Vue Query keys、queries、mutations
  components/   UI 与业务编辑器
  layouts/      响应式全局壳、连接层、语言切换
  pages/        Overview/Assets/Credentials/Access/Sessions/HostTrust/Settings
  stores/       当前标签页 Token、可选 session endpoint、主题
```

页面不直接调用 `fetch`。真实与 Demo adapter 实现同一 domain 接口。Token 仅进入当前标签页的 sessionStorage；locale 之外禁止 localStorage。

## 已实施阶段

### 1. 后端契约对齐

- Wire asset/credential/access response 接收 `ownership`。
- 映射为 `management.mode = local | config`。
- 真实 capability 标记 ownership 可用。
- 同源空 endpoint 规范化为 `/api/v1` 并可创建真实 adapter。

### 2. 默认连接模型

- 首次状态为 re-auth，而不是自动 Demo。
- 主表单只有 Token；高级 `<details>` 才显示远程 URL。
- `change-me` 设置 `insecureToken` 并显示多处警告。
- 连接成功后将 Token 保存在当前标签页的 sessionStorage，刷新时先校验并自动重连；切换 Demo、重新认证、忘记实例或标签页会话结束时清除。

### 3. 产品工作流收缩

- Configuration 页面替换为 Settings。
- 删除普通 UI 的来源列表、孤儿状态、声明文件编辑、validate/diff/apply/reload。
- Overview 使用 local/config 计数表达管理边界。
- Assets、Credentials、Access 在显示操作前判断 config ownership。

### 4. 国际化

- 新增无运行时依赖的 English/简体中文切换。
- 主壳、七个页面、编辑器、确认、状态、空态和安全提示使用统一 `t()`。
- `<html lang>`、`Intl.DateTimeFormat` 与 `Intl.RelativeTimeFormat` 跟随 locale。
- E2E 覆盖双向切换与持久化边界。

### 5. Known Hosts 信任重置

- 真实与 Demo adapter 统一实现 Known Hosts 列表和精确重置。
- 页面显示主机、端口、算法、完整 SHA256 指纹、首次信任时间和匹配 SSH 资产。
- 删除请求固定携带 `confirm_reset: true`，并由危险确认弹窗保护下一次 TOFU 自动学习边界。
- 桌面使用紧凑列表与持久详情；移动端保留全部字段且不产生横向滚动。

### 5. 生产容器

- Node 22 多阶段构建；Nginx Alpine 运行，不保留 Node。
- SPA fallback；精确代理 `/api/v1`；其他 `/api` 返回 404。
- Bearer 原样转发但关闭 API access log。
- read-only 容器兼容 `/var/cache/nginx` 与 `/var/run` tmpfs。
- CSP 与常见安全响应头。

### 6. 发布

- Tag 触发 GHCR 构建并发布同名 tag。
- Compose 通过一个 `HOP_VERSION` 配对前后端。
- 生产 smoke 脚本构建双镜像并验证真实代理与端口边界。

## 测试矩阵

| 层级 | 覆盖 |
|---|---|
| Unit | Wire 映射、ownership、secret 写入边界、同源 URL、Demo 状态、格式化 |
| Build | TypeScript project build 与 Vite production bundle |
| E2E desktop | 六路由、CRUD、secret 公私钥边界、会话终止、Settings、i18n、只读 ownership |
| E2E mobile | 390px 导航、深链详情、返回历史、无横向溢出 |
| Container | 首页、深链、401、Bearer 200、未知 API 404、上游 502、8083 未发布 |
| Integration | 后端 Compose 空 Catalog、同源 Token、local 写入、config 只读 |

## 质量门槛

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:container
```

另运行 Impeccable detector 检查 UI 反模式，并扫描源码与 `dist/`，确认没有部署 Token 或目标 secret。
