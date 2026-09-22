# Agent Note: pi-ai 请求携带会话头

Status: implemented

[English](2026-09-17-pi-ai-session-header.md) | 中文

## Problem

[OpenCode Go](https://opencode.ai/docs/go/) 网关会拒绝不携带会话身份的请求，返回 `400 MissingSessionID` 与 `Request is missing x-opencode-session`：会话 ID 用于路由流量并保持提示缓存热度。`dsh-llm-deepseek` 适配器已经发送 Harness 原生 `x-deepseek-harness-session-id` 头（OpenCode Go 能识别），但 pi-ai 适配器只传递 pi-ai 自己的 `sessionId` 选项——该值在部分协议上被 pi-ai 映射为 `x-session-affinity` 或 `prompt_cache_key`，而 OpenCode 网关读不到它。因此运行 `opencode-go/*` 模型的会话每个请求都会因缺少会话而失败。

## Decision

当 `GenerateOptions.sessionId` 存在时，pi-ai 适配器将 Harness 原生 `x-deepseek-harness-session-id` 头合并进每个请求，与 `dsh-llm-deepseek` 的做法完全一致。该头属于 Harness 自有身份，因此与部署配置的 profile 头冲突时胜出，与 attribution 规则一致。OpenCode Go 能识别该原生头，请求不再被拒绝。循环（loop）在每个请求上都盖上 `sessionId`，因此这补齐了 OpenCode 列出的缺口——"会话信息在部分模型路径上到达，在其他路径上缺失"。

## Alternatives considered

**为 OpenCode 端点发送 `x-opencode-session`。** 网关接受 Harness 原生头，而为每个声明自有会话头的网关添加按提供方别名会让别名不断膨胀。规范头保持为会话身份的唯一来源。

**等待 pi-ai 自行发送会话信息。** pi-ai 0.85.1 不会把 `sessionId` 映射成 OpenCode 网关可读的任何内容，且与 OpenCode 的头契约由 Harness 拥有；适配器修复不依赖 pi-ai 升级。

## Consequences

每个 pi-ai 支持的请求现在都携带 Harness 会话 ID，与 deepseek 适配器一致。忽略该头的网关只是丢弃它；Harness 自身的会话日志与线上格式不变。[适配器规范](../../../../packages/llm/llm-pi-ai/tests/adapter.spec.ts) 同时固定了发送头与循环无会话 ID 时省略头的两种行为。
