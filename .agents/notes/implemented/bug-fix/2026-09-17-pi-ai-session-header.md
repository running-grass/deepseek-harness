# Agent Note: pi-ai requests carry the session header

Status: implemented

English | [中文](2026-09-17-pi-ai-session-header.zh.md)

## Problem

The [OpenCode Go](https://opencode.ai/docs/go/) gateway rejects a request that carries no session identity with `400 MissingSessionID` and `Request is missing x-opencode-session`: the session id is how it routes traffic and keeps prompt caches warm. The `dsh-llm-deepseek` adapter already sends the harness-native `x-deepseek-harness-session-id` header, which OpenCode Go recognizes, but the pi-ai adapter sent only pi-ai's own `sessionId` option — a value pi-ai maps to `x-session-affinity` or `prompt_cache_key` on some protocols, and to nothing the OpenCode gateway reads. A session running `opencode-go/*` models therefore failed every request with the missing-session error.

## Decision

The pi-ai adapter merges the harness-native `x-deepseek-harness-session-id` header into every request when `GenerateOptions.sessionId` is present, exactly as `dsh-llm-deepseek` does. The header is harness-owned identity and therefore wins a collision with a deployment-configured profile header, matching the attribution rule. OpenCode Go recognizes the native header, so the request is no longer rejected. The loop stamps `sessionId` on every request, so this closes the OpenCode-listed gap — "Session information arrives on some model paths, but is missing on others."

## Alternatives considered

**Send `x-opencode-session` for OpenCode endpoints.** The gateway accepts the harness-native header, and a per-provider alias would have to grow for every gateway that names its own session header. The canonical header stays the single source of session identity.

**Wait for pi-ai to send session information itself.** pi-ai 0.85.1 does not map `sessionId` to anything the OpenCode gateway reads, and the harness owns the header contract with OpenCode; the adapter fix is independent of a pi-ai upgrade.

## Consequences

Every pi-ai-backed request now carries the harness session id, matching the deepseek adapter. Gateways that ignore the header simply drop it; the harness's own session-log and wire formats are unchanged. [The adapter spec](../../../../packages/llm/llm-pi-ai/tests/adapter.spec.ts) pins both the sent header and its omission when the loop has no session id.
