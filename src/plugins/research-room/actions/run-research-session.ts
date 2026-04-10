import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  type State,
} from "@elizaos/core";
import { extractResearchQuestion } from "../lib/question";
import { getLatestResearchPlan } from "../lib/plan-store";
import { queueResearchSessionTask } from "../lib/research-task";

export const runResearchSessionAction: Action = {
  name: "RUN_RESEARCH_SESSION",
  similes: ["RESEARCH_TOPIC", "INVESTIGATE_TOPIC", "START_RESEARCH"],
  description:
    "Queue the role-based research phase for an approved plan as a background task.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    if (!text.length) {
      return false;
    }

    if (/approve|approved|confirm/.test(text) && /plan/.test(text)) {
      return false;
    }

    if (/update|edit|revise|change|refine/.test(text) && /plan/.test(text)) {
      return false;
    }

    if (/status|progress|running|queued|done/.test(text) && /research|session|memo|job/.test(text)) {
      return false;
    }

    if (
      /history|saved|past|previous|recent|export|download|open|reopen|view|show|get|read|follow\s*up|revisit|build on|expand/.test(
        text
      ) && /session|memo|report|dossier/.test(text)
    ) {
      return false;
    }

    return (
      /start|run|begin/.test(text) ||
      ((/research|investigate/.test(text) && /now|phase|go ahead|approved|continue/.test(text)))
    );
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const text = message.content.text ?? "";
    const question = extractResearchQuestion(text);
    const plan = await getLatestResearchPlan(runtime, message.roomId);

    if (!plan || !plan.approved) {
      const noApprovedPlanText =
        "I could not find an approved research plan in this session. Create and approve a plan first, then start the research phase.";

      if (callback) {
        const responseContent: Content = {
          text: noApprovedPlanText,
          actions: ["RUN_RESEARCH_SESSION"],
          source: message.content.source,
        };

        await callback(responseContent);
      }

      return {
        success: false,
        text: noApprovedPlanText,
      };
    }

    const questionFromPlan = plan.question || question;
    const queuedTask = await queueResearchSessionTask(runtime, {
      roomId: message.roomId,
      worldId: message.worldId,
      entityId: message.entityId,
      question: questionFromPlan,
      plan,
    });

    if (queuedTask.alreadyQueued) {
      const existingTaskText = "A research task is already in progress for this session.";

      if (callback) {
        await callback({
          text: existingTaskText,
          actions: ["RUN_RESEARCH_SESSION"],
          source: message.content.source,
          metadata: {
            research: {
              phase: "queued",
              taskId: queuedTask.taskId,
            },
          },
        });
      }

      return {
        success: true,
        text: existingTaskText,
        data: {
          taskId: queuedTask.taskId,
          status: "queued",
        },
      };
    }

    logger.info(
      { question: questionFromPlan, topicCount: plan.topics.length, taskId: queuedTask.taskId },
      "Queued research task"
    );

    const queuedText = "Research is queued and will continue in the background.";

    if (callback) {
      await callback({
        text: queuedText,
        actions: ["RUN_RESEARCH_SESSION"],
        source: message.content.source,
          metadata: {
            research: {
              phase: "queued",
              taskId: queuedTask.taskId,
              topicCount: plan.topics.length,
            },
          },
        });
    }

    return {
      success: true,
      text: `Queued research session for: ${questionFromPlan}`,
      data: {
        taskId: queuedTask.taskId,
        status: "queued",
        question: questionFromPlan,
      },
    };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Start the research phase.",
        },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Research is queued and will continue in the background.",
          actions: ["RUN_RESEARCH_SESSION"],
        },
      },
    ],
  ],
};
