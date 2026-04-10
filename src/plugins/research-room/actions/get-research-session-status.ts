import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from "@elizaos/core";
import { getLatestResearchRun } from "../lib/research-run-store";
import { RESEARCH_SESSION_TASK_TAGS } from "../lib/research-task";

const TASK_STATUS_PENDING = 1;
const TASK_STATUS_IN_PROGRESS = 2;

const renderTaskStatusText = (task: Awaited<ReturnType<IAgentRuntime["getTask"]>>) => {
  const metadata = task?.metadata as Record<string, unknown> | undefined;
  const status = typeof metadata?.status === "string" ? metadata.status : "queued";
  const phase = typeof metadata?.phase === "string" ? metadata.phase : "queued";
  const evidenceCount = typeof metadata?.evidenceCount === "number" ? metadata.evidenceCount : 0;
  const topicCount = typeof metadata?.topicCount === "number" ? metadata.topicCount : 0;

  return [
    "## Research Status",
    `- Status: ${status}`,
    `- Phase: ${phase}`,
    `- Topics: ${topicCount}`,
    `- Evidence Cards: ${evidenceCount}`,
    task?.id ? `- Task ID: ${task.id}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
};

const renderRunStatusText = (run: NonNullable<Awaited<ReturnType<typeof getLatestResearchRun>>>) => {
  return [
    "## Research Status",
    `- Status: ${run.status}`,
    `- Phase: ${run.phase}`,
    `- Topics: ${run.topicCount}`,
    `- Evidence Cards: ${run.evidenceCount}`,
    run.error ? `- Error: ${run.error}` : null,
    "",
    run.text,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
};

export const getResearchSessionStatusAction: Action = {
  name: "GET_RESEARCH_SESSION_STATUS",
  similes: ["CHECK_RESEARCH_STATUS", "RESEARCH_PROGRESS", "SESSION_STATUS"],
  description: "Get the latest queued, running, or completed status for the research session in this room.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return /status|progress|running|queued|done/.test(text) && /research|session|memo|job/.test(text);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const activeTasks = await runtime.getTasks({
      roomId: message.roomId,
      tags: RESEARCH_SESSION_TASK_TAGS,
      agentIds: [runtime.agentId],
    });

    const activeTask =
      activeTasks.find(
        (task) => task.status === TASK_STATUS_PENDING || task.status === TASK_STATUS_IN_PROGRESS
      ) ?? null;
    const latestRun = await getLatestResearchRun(runtime, message.roomId);

    const text = activeTask
      ? renderTaskStatusText(activeTask)
      : latestRun
      ? renderRunStatusText(latestRun)
      : "I could not find an active or saved research run in this session yet.";

    if (callback) {
      const responseContent: Content = {
        text,
        actions: ["GET_RESEARCH_SESSION_STATUS"],
        source: message.content.source,
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text,
      data: {
        activeTaskId: activeTask?.id ?? null,
        latestRun,
      },
    };
  },
};
