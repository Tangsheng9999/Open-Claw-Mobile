"use client"

import useSWR, { type SWRConfiguration } from "swr"
import { agentApi } from "./agent-client"

const fast: SWRConfiguration = { refreshInterval: 5000, revalidateOnFocus: true }
const slow: SWRConfiguration = { refreshInterval: 15000, revalidateOnFocus: true }

export function useAgentInfo() {
  return useSWR("agent.info", () => agentApi.info(), slow)
}
export function useStatus() {
  return useSWR("agent.status", () => agentApi.status(), fast)
}
export function useMetrics() {
  return useSWR("agent.metrics", () => agentApi.metrics(), fast)
}
export function useConversations() {
  return useSWR("agent.conversations", () => agentApi.conversations(), fast)
}
export function useProjects() {
  return useSWR("agent.projects", () => agentApi.projects(), fast)
}
export function useHeartbeats() {
  return useSWR("agent.heartbeats", () => agentApi.heartbeats(), fast)
}
export function useLogs(limit = 80) {
  return useSWR(["agent.logs", limit], () => agentApi.logs(limit), fast)
}
export function useModels() {
  return useSWR("agent.models", () => agentApi.models(), slow)
}
export function useDiagnostics() {
  return useSWR("agent.diagnostics", () => agentApi.diagnostics(), slow)
}
</content>
<parameter name="taskNameActive">SWR Hooks
