# Hop 管理面板实施计划

状态：已完成并通过交付门禁（2026-08-14）
目标仓库：`/home/oslo/projects/hop-rs-frontend`
后端契约：`/home/oslo/projects/hop-rs/crates/hop-server/src/control_api.rs`

## 1. 交付定义

首个提交交付一套可运行、可构建、可测试的独立 Vue 应用。它默认使用标注清楚的 Demo 数据，也能通过用户提供的 URL 和 Bearer Token 连接真实 Hop v0.2 Control API。六个主路由都必须具备完整的读取状态；当前 API 支持的 mutation 必须可操作，后端未提供的能力不得伪装实现。

## 2. 技术基线

- Vue 3、TypeScript、Vite
- Vue Router：路由与移动端详情导航
- TanStack Vue Query：服务端状态、失效和 mutation 生命周期
- 项目原生组件与 CSS token，不引入大型 UI 框架
- Lucide Vue：一致的可访问图标
- Zod：连接设置、写入表单和 API 边界校验
- Vitest、Vue Test Utils：单元与组件测试
- Playwright：关键桌面/移动端流程和视觉截图
- 静态 `dist/` 输出；运行时配置读取相对路径或环境注入的 API base URL

依赖版本在脚手架阶段从官方 npm registry 锁定，并提交 lockfile。

## 3. 架构边界

```text
src/
  api/          HTTP client、错误规范化、真实 Control API adapter
  demo/         合成数据与等价 adapter
  domain/       Catalog、session、config 类型和纯函数
  queries/      Vue Query keys、queries、mutations
  components/   通用组件与业务组件
  layouts/      A 全局壳
  pages/        六个路由及页面内详情层
  stores/       连接、主题与瞬时 UI 状态
  styles/       tokens、reset、基础布局与响应式规则
  test/         测试工具、fixtures、MSW handlers
```

页面不直接调用 `fetch`。真实 API 和 Demo adapter 实现同一接口，页面只消费 domain model。Bearer Token 由内存 store 持有；仅 URL 和非敏感显示偏好允许进入 `sessionStorage`，禁止使用 `localStorage`。

## 4. 分阶段实施

### Phase 0：契约固化（完成）

- 审计 `control_api.rs`、admin guide 与序列化结构。
- 建立端点矩阵、请求/响应 TypeScript 类型和统一错误模型。
- 标记 UI 需要但 API 不存在的字段/动作；当前已确认 ownership/source、asset health、audit queue 和 connection test 均不存在，实现中删除或由 capability flags 降级。
- 为 `401`、`403 managed_by_source`、`404`、`409 revision_conflict` 和网络错误定义 UX。

完成条件：API adapter 的公共接口和 fixtures 可独立测试。

### Phase 1：工程基础与 A 全局壳（完成）

- 建立 Vite/Vue/TypeScript 项目、lint、typecheck、test、build 脚本。
- 实现语义 token、深浅主题、字体、图标和基础控件。
- 实现桌面侧栏、平板图标栏、移动底部导航、页面标题区和连接卡。
- 实现连接引导、Demo/真实/重新认证状态及全局错误边界。

完成条件：六个路由可导航，375px/1440px 无页面级横向滚动，连接状态可测试。

### Phase 2：读取体验（完成）

- Overview：status、revision、资源摘要、sessions、config sources。
- Assets：B 主从工作区、搜索/协议/所有权筛选、详情与响应式详情层。
- Credentials、Access、Sessions、Configuration：完成紧凑清单、详情和真实空态/错误态。
- Demo adapter 提供覆盖 healthy、warning、empty、declarative ownership 和 active session 的合成数据。

完成条件：断网也能完成产品走查；真实 adapter 的所有 GET 路径有契约测试。

### Phase 3：安全 mutation（完成）

- Assets：创建、更新、删除本地 SSH/TCP 资产。
- Credentials：创建、轮换、删除；永不显示现有 secret。
- Access：使用已有 OpenSSH public key 创建、启停、替换 allowlist、撤销；不得声称 Hop 生成或返回 private key。
- Sessions：显式中止活动会话。
- Configuration：validate、diff、apply、reload；处理 base revision 冲突。
- 为所有 mutation 添加 pending、success、error、重试和查询失效策略。

完成条件：声明式资源不能在 UI 中触发本地 CRUD；secret 和 revision 边界通过测试。

### Phase 4：质量收口（完成）

- 单元测试：筛选、所有权、错误映射、credential secret 边界、Access public/private key 边界、revision 冲突。
- 组件测试：连接层、Assets 主从选择、危险确认、移动详情返回。
- E2E：Demo 首次访问与六路由、资产筛选/深链/创建、credential 与 Access secret 边界、中止会话、config validate/diff/apply、移动导航与详情返回。
- 运行 typecheck、lint、unit、E2E smoke、production build。
- 批量截取 1440px 桌面与 390px 手机，按获批 comp 做两轮以内视觉修正。
- 运行 Impeccable detector、独立 finish review，并从成品生成 `DESIGN.md`。

完成条件：所有门禁通过，review 无未处置的阻断项。

### Phase 5：交付（完成）

- 编写 README：开发、构建、运行时 API 配置、Demo 模式、安全说明。
- 提交设计规范、实施计划、成品 DESIGN.md、源码、测试和 lockfile。
- 在本地 `main` 创建首个提交；当前无 GitHub remote，因此不 push、不创建远端仓库。

## 5. 并行开发拆分

用户已授权使用子 Agent。共享工作树下只分配互不重叠的文件边界：

1. API 契约 Agent：只负责 `src/api`、`src/domain` 与相应测试。
2. Shell/Design System Agent：只负责 `src/components/ui`、`src/layouts`、`src/styles`。
3. Feature Agent：只负责指定 page/query 分区；避免同时修改根路由和公共 token。
4. 主 Agent：脚手架、路由、集成、冲突处理、视觉验收、最终文档与提交。

每个分支任务在合入前必须运行其局部 typecheck/test；最终门禁只由主 Agent 执行。

## 6. API 交付矩阵

| 领域 | 读取 | 写入 |
| --- | --- | --- |
| Instance | `GET /api/v1/status`, `GET /api/v1/catalog/revision` | — |
| Assets | `GET /api/v1/assets` | `POST /assets`, `PUT/DELETE /assets/{id}` |
| Credentials | `GET /api/v1/credentials` | `POST /credentials`, `PUT/DELETE /credentials/{id}` |
| Access | `GET /api/v1/access-keys` | `POST /access-keys`, `PUT .../enabled`, `PUT .../access`, `DELETE /{id}` |
| Sessions | `GET /api/v1/sessions` | `POST /sessions/{id}/terminate` |
| Configuration | `GET /config/sources`, `GET /config/status` | `POST /config/validate`, `/diff`, `/apply`, `/reload` |

所有路径以 `/api/v1` 为前缀。实现阶段以 Rust 序列化定义为事实来源，文档示例只作为补充。

## 7. 风险与处理

- **CORS/部署差异**：开发模式支持 Vite proxy；生产环境要求 Hop 配置显式允许面板 origin，或由同源静态服务器反代 `/api/v1`。
- **API 无聚合 Overview**：首屏并行请求并用稳定旧数据渲染；`status: ok` 只表达 API connected / Catalog available，不伪造资产健康。
- **列表无 ownership 元数据**：真实 transport 不预先显示来源或禁用写入；遇到 `409 managed_by_source` 后就地解释。Demo 所有权必须有 Demo 标记。
- **Token 刷新丢失**：这是安全取舍，刷新后进入明确的重新认证状态。
- **大清单性能**：首版先使用语义表格和分页/过滤边界；当真实规模证明需要时再引入虚拟化。
- **LuCI 复用**：保持 domain/query 与 transport 分离，为后续 rpcd proxy adapter 留接口，但本提交不实现 LuCI 页面。

## 8. 完成门禁

```text
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

同时满足：

- 生产输出中保留已批准的设计方向 contract。
- Demo 数据有明显标识，真实与合成状态不会混淆。
- `localStorage` 搜索结果为零，源码和构建产物不记录 Token。
- 桌面/移动端截图通过方向对照和独立 finish review。
- `README.md`、`PRODUCT.md`、`docs/design-spec.md`、`docs/implementation-plan.md`、`DESIGN.md` 与实现一致。

最终证据：ESLint 0 warning；TypeScript typecheck 通过；Vitest 6 files / 29 tests 通过；Playwright 8 个实际场景通过（另 8 个为跨 project 的预期 skip）；Vite production build 通过；独立 finish reviewer 的最终 disposition 为 `ship`。
