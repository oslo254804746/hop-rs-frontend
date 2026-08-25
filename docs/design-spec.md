# Hop 管理面板设计规范

状态：已按 Compose 同源与单配置模型更新

## 1. 设计目标

Hop 面板是紧凑、低噪声的运维工作区。它首先回答：实例是否可管理、Catalog 中有什么、哪些资源可在这里修改。界面不暴露启动配置编排，也不伪造 secret、健康检查或入口私钥。

## 2. 全局壳

- 桌面侧栏：Overview、Assets、Credentials、Access、Sessions、Host trust、Settings。
- 移动底栏保留高频入口，Credentials、Host trust 与 Settings 进入 More。
- 顶栏提供主题、刷新、实例连接和 English/中文切换。
- 首次打开显示连接对话框。默认只要求 `hop.yaml` 的网页管理 Token；远程 API URL 位于折叠高级区域。
- Demo 模式必须始终带有 synthetic 标识。

Token 仅保存在当前标签页的 sessionStorage，刷新时校验后自动重连。远程 endpoint 也可写 sessionStorage；locale 是唯一允许写 localStorage 的状态。

## 3. 信息架构

| 路由 | 用户任务 | 主要动作 |
|---|---|---|
| `/` | 判断实例状态、Catalog 数量与管理边界 | 进入问题资源、查看会话 |
| `/assets` | 管理 SSH/TCP 目标 | 筛选、新建、编辑/删除本地资产 |
| `/credentials` | 管理目标认证材料 | 新建、轮换/删除本地凭据 |
| `/access` | 管理入口公钥与资产范围 | 新建、启停、修改范围、删除本地公钥 |
| `/sessions` | 查看并终止活动连接 | 查看详情、显式确认终止 |
| `/known-hosts` | 核验目标 SSH 主机密钥信任 | 查看完整指纹、匹配资产、显式确认重置信任 |
| `/configuration` | 理解连接与安全设置 | 重新认证、查看 ownership/CSP 说明 |

## 4. Ownership 交互

真实响应包含 `local` 或 `config`：

- 列表和详情始终显示归属标签；
- `local` 展示可用操作；
- `config` 展示 `Managed by hop.yaml` 只读提示，操作按钮不进入 DOM；
- 不显示内部管理标识；
- 若状态竞争仍导致后端冲突，在原位显示错误并停止自动重试。

该判断必须发生在表单打开之前，不能让用户填完表单后才发现不可编辑。

## 5. 连接与安全提示

- 同源 Compose 显示 “This panel · same origin”，不要求填写 URL。
- `change-me` 在连接对话框、全局壳和 Settings 中持续警告。
- 刷新时用已保存的 Token 静默校验并恢复连接；只有无可用 Token 或校验失败时才显示 re-auth。
- 远程 URL 使用 `<details>` 降低默认路径认知负担。
- Settings 明确 Nginx 只代理 `/api/v1`、Token 仅在当前标签页会话中保存、配置资源需改文件并重启。
- Host trust 详情显示完整 SHA256 指纹；重置前说明风险并要求独立确认目标重装或密钥轮换。

## 6. 国际化

- 源字符串为 English，简体中文词典覆盖全部主导航、页面标题、表单、错误、空态、确认与 ownership 文案。
- 切换即时更新 `<html lang>`、日期与相对时间格式。
- 资源名、地址、指纹、后端错误原文不翻译。
- 中文布局允许控件文本变长，不依靠固定字符宽度。

## 7. 视觉系统

延续低眩光蓝炭表面、细分隔线与薄荷绿主强调。警告用琥珀，破坏性与失败用红色，信息用蓝色。浅色主题逐项映射语义 token。

- 页面标题 20–24px，表格正文 13–14px；
- 面板圆角 10–12px，控件 8px；
- 主要层级依靠底色、1px 线与留白，少用阴影；
- 表格行 48–62px，提供 hover/selected/focus-visible；
- 状态同时用文字/图标与颜色；
- 每个工作区最多一个 primary 动作。

## 8. 响应式与无障碍

- 1440px 使用完整主从工作区；窄桌面将详情变为侧层；390px 使用底部导航与全屏详情。
- 页面不得横向溢出。
- 交互目标至少 44×44px，表单有 label，图标按钮有可翻译 aria-label。
- Dialog 支持 Esc、焦点恢复和明确取消；危险操作包含资源名并二次确认。
- 尊重 `prefers-reduced-motion`，动画不承担状态表达。

## 9. 生产容器体验

未知前端深链回退到 SPA；未知 `/api` 路径不得回退或代理。上游不可用应返回明确 502，而不是面板 HTML。CSP 禁止任意脚本与嵌入，同时允许高级远程 HTTPS 连接。
