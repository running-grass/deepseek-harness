---
description: "在 dsh Web 会话结束、失败、提问或请求权限时播放提示音并弹出浏览器通知，并提供「通知」设置栏目。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-session-notification

[English](README.md) | 中文

## 概述

在 dsh Web GUI 中开启会话提醒：当一次运行完成、中断、向你提问或请求权限时，浏览器会播放提示音，并在你授予权限后弹出系统通知——即使你切到别的标签页也能收到。所有开关都在「通知」设置栏目里：按类型启用与选择音效、上传自定义音频、调节音量，以及「通知范围」——默认会把主会话的提醒压到它的全部 subagent 结束之后再发。偏好设置只保存在浏览器里，因此本插件不需要任何 host settings namespace，可直接运行在未经改动的 harness 上。部署方通过本包的 overlay 逐次按需启用；它是实验性包，没有任何已发布 profile 默认挂载它。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 Web 启动时挂载本插件的 overlay，然后打开 **设置 ⚙ → 通知**。没有已发布 profile 携带本插件，因此部署方通过 `--patch` 按需启用，composition 中其他部分不需要改动。

### 挂载 overlay

先构建一次，然后选择任一启动方式：

```sh
pnpm run build
pnpm run demo:session-notification
node apps/cli/lib/bin.js web --patch ./packages/experimental/session-notification/cordis.patch.yml
```

两个 overlay 的 entry 都相对 overlay 文件本身，因此本包无需安装进 profile。[`cordis.source.patch.yml`](cordis.source.patch.yml) 通过 CLI 的 tsx loader 加载 `./src/index.ts`，是 `pnpm run demo:session-notification` 背后的源码开发挂载；[`cordis.patch.yml`](cordis.patch.yml) 加载构建产物 `./lib/index.js`。两种方式下浏览器半边都由构建后的 `lib/client.js` 提供，所以必须先构建。对于安装了已发布包的部署，也可以改为 patch 一个名为 `@deepseek-ai/dsh-experimental-session-notification` 的行。

### 何时选择它

当你或用户会发起长时间运行并离开标签页，希望在运行完成、中断或卡在提问与审批时收到提示音或系统通知时，选择本插件。它是仓库中唯一的通知界面，因此没有替代包；不需要提醒的部署只要不挂载 overlay 即可。代价是浏览器半边观察的是客户端状态，其覆盖范围受 GUI 已加载内容以及浏览器自身的权限与自动播放规则限制（见[已知限制与延期工作](#known-limitations-and-deferred-work)）。

### 四种通知类型

| 类型 | 触发时机 | 默认音效 |
|---|---|---|
| 会话完成 | 一轮正常运行结束（`turn/end` completed） | chime |
| 会话失败 | 一轮因错误中断，或 host 报告 agent error | fault |
| 提问 | agent 正在等待你的回答（`question/requested`） | pop |
| 请求权限 | agent 请求执行需要授权的操作（`approval/requested`） | alert |

每种类型都可以单独关闭，或改用任意内置音效；四种内置音效由 Web Audio 实时合成，因此本包不附带任何音频文件。播放链路上有一个固定的响度提升（约 +6 dB）与软限幅器，让每种音效更响而不失真，自定义音频走同一条链路。

### 「通知」设置栏目

插件注册一个 `settings.section` 行（id 为 `notifications`，order 为 40），因此它会与官方栏目并列显示：

- **浏览器通知**总开关，附带权限状态与**测试通知**按钮。
- **当前会话也提醒**开关——你正在阅读的会话默认保持安静，除非显式开启。
- **通知范围**选择器：*全部会话*、*仅主会话*，或*主会话，等 subagent 之后*（默认值：主会话的提醒会等到它派生出的所有 subagent 结束后才发出；失败则始终立即提醒）。
- **音效**总开关与**音量**滑块（0–100%）。
- 每种类型一行：启用开关、音效选择器、自定义音频上传与**试听**按钮。

### 自定义音频

每种类型还支持上传音频文件（mp3、ogg 或 wav，上限 1 MB）。在对应类型的行上选择 **自定义音频** 会把文件存进浏览器并替换该类型的内置音效，同时提供替换与移除操作，以及标明哪些类型正在使用自定义音频的标签。

### 截图

| 设置中的「通知」栏目 | 按类型选择音效 | 栏目的导航入口 |
| --- | --- | --- |
| ![通知设置栏目](screenshots/01-notifications-section.png) | ![音效选择器](screenshots/02-sound-menu-open.png) | ![通知导航入口](screenshots/03-settings-nav.png) |

### 偏好设置存放位置

偏好设置保存在浏览器的 `dsh-session-notification:*` localStorage key 下，并在打开的标签页之间同步；自定义音频文件同样如此存放。这些都不需要 host settings namespace，因此本插件不会给 composition 增加任何配置字段——它的 Host 半边只负责把本包锚定在 profile 中。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

Host export 不执行任何行为（`apply(): void`）。全部行为都位于 `./client` export：它的 `inject` 列表要求 `slots`、`locale`、`sessions`、`uiConversation` 与 `uiSession`。插件通过 Cordis effect 注册一个 locale dictionary、一个浏览器本地设置 scope，以及一个 `settings.section` registration，因此 dispose fiber 会把它们全部移除。

engine 只读取 snapshot，从不读取原始事件流：

- 会话的 `running` 边沿由 true 变为 false 表示一次运行结束；经过 250 ms 的 settle 窗口后，如果期间出现新的 `turn-error` 节点或 host `agent-error`，该次运行判定为**失败**，否则为**完成**。
- 待处理交互的边沿会触发提问或权限类型，并携带提问文本，或工具名与原因。
- 加载时建立的 baseline 不会为已经空闲或已经在等待交互的会话产生任何通知。
- `main-wait` 范围会沿 `parentId` 链向上走，因此嵌套 subagent 也会推迟其 root 的完成通知。

每个打开的标签页都会运行自己的插件实例并收到相同事件，因此由 `BroadcastChannel` coordinator 对每个 `sessionId:kind` 事件做 claim：可见标签页立即 claim，后台标签页等待一个短暂的宽限期，最终只有一个标签页执行 dispatch。没有 `BroadcastChannel` 时，每个标签页都会 claim 自己的事件，而不是保持静默。

| 文件 | 职责 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | 插件主体：dictionary、scope、栏目 registration 与 engine 接线 |
| [`src/client/notification-service.ts`](src/client/notification-service.ts) | 运行分类与 dispatch 门控 |
| [`src/client/settings-store.ts`](src/client/settings-store.ts) | 设置栏目 store 与 bound action |
| [`src/client/NotificationsSection.tsx`](src/client/NotificationsSection.tsx) | 栏目 UI |
| [`src/client/sounds.ts`](src/client/sounds.ts) | 合成的内置音效与播放链路 |
| [`src/client/custom-audio.ts`](src/client/custom-audio.ts) | 自定义音频上传、存储与大小限制 |
| [`src/client/tab-coordinator.ts`](src/client/tab-coordinator.ts) | 跨标签页 claim 仲裁 |
| [`src/client/local-settings.ts`](src/client/local-settings.ts) | 浏览器本地偏好 scope 与跨标签页同步 |
| [`src/settings.ts`](src/settings.ts) | 偏好类型、默认值与存储值校验 |
| [`src/index.ts`](src/index.ts) | 不执行行为的 Host entry |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [实验性包](../README.zh.md)——孵化状态与本包遵循的发布规则。
- [Web app bundle](../../bundle/web-app/README.zh.md)——overlay 所扩展的已发布 Web profile。
- [设置 UI](../../client/ui-settings/README.zh.md)——本插件注册 `settings.section` 的 slot。
- [Session controller](../../api/session-controller/README.zh.md)——engine 观察的会话列表与会话快照。
- [开发者实践指南](../../../docs/user/develop/practice/index.zh.md)——opt-in overlay 的组合与运行方式。

-----

<a id="model-experience"></a>
## 模型体验

无直接影响，因为该插件观察的是浏览器中已经记录到日志的会话状态，不注册任何面向模型的输入。

#### KV Cache 影响

无影响；本包既不组装也不发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **未打开过的会话会判定为完成**——失败检测读取会话的 conversation snapshot，而客户端只为打开过的会话维护它；因此一次从未在界面上打开过的运行即使失败，也会按完成通知。
- **浏览器权限与自动播放策略**——系统通知需要用户授权，播放声音需要页面已有用户激活；两者都会在用户首次与 GUI 交互后解决，权限状态在栏目中显示。
- **自定义音频是设备本地的**——上传的文件存在浏览器存储里，不会跟随用户跨浏览器或跨 profile。
- **只基于列表 snapshot 的边沿**——engine 读取的是会话列表与待处理交互的 snapshot，而不是原始事件流，因此一次在两次 snapshot 之间开始并结束的运行原则上会被漏掉；host 会为每个边沿发送状态翻转，因此实践中不会发生。
- **没有 host 侧或按 profile 的持久化**——偏好设置按设计只存在浏览器本地，因此不会同步到另一台机器或另一个浏览器。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

栏目遵循官方行模式：`register` 时声明的 store 由 slot renderer 持有，renderer 把它绑定的 action 交给 inject factory，因此 apply 侧不会创建第二个 store 实例。浏览器本地 scope 是读写的事实来源，renderer store 镜像它的 snapshot。

分类刻意基于 snapshot 且只读：engine 不写入会话状态，也不新增 Session event，因此这里不需要 replay 支持或持久化格式。

</details>

**运行时不变式：** 不发布伴生入口，因为本插件只持有浏览器本地状态与可释放的 registration；这样的检查只会复述服务存在与注册关系，而不是一个可观测且可能发生分歧的关系。
