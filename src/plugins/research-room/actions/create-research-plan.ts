import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
} from "@elizaos/core";
import { extractResearchQuestion } from "../lib/question";
import {
  createDefaultResearchPlan,
  createResearchPlan,
} from "../lib/plan";
import { buildPlannerPrompt, parsePlanResponse } from "../lib/planner";
import { generateStructuredText } from "../lib/structured-model";
import { resolveResearchMessageContext } from "../lib/message-context";
import { saveResearchPlan } from "../lib/plan-store";
import { saveResearchState } from "../lib/research-state-store";

export const createResearchPlanAction: Action = {
  name: "CREATE_RESEARCH_PLAN",
  similes: ["PLAN_RESEARCH", "OUTLINE_RESEARCH", "DRAFT_RESEARCH_PLAN"],
  description:
    "Create a structured research plan the user can review and approve before deep research starts.",
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
      /history|saved|past|previous|recent|export|download|open|reopen|view|show|get|read|follow\s*up|continue|go deeper|dig deeper|revisit|build on|expand/.test(
        text
      ) && /session|memo|report|dossier/.test(text)
    ) {
      return false;
    }

    return /plan|research|investigate|look into|help me research/.test(text);
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
    let plan = createDefaultResearchPlan(question);

    try {
      const plannerText = await generateStructuredText(
        runtime,
        ModelType.TEXT_LARGE,
        buildPlannerPrompt(question),
        {
          temperature: 0.3,
          maxTokens: 1600,
          timeoutMs: 120000,
        }
      );

      if (plannerText) {
        const parsedPlan = parsePlanResponse(question, plannerText, {
          questionPolicy: "preserve-input",
        });

        if (parsedPlan) {
          plan = parsedPlan;
        } else {
          logger.warn({ question }, "Planner returned non-JSON or invalid JSON");
        }
      } else {
        logger.warn({ question }, "Planner returned no usable text response");
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error), question },
        "Falling back to default research plan"
      );
    }

    const result = createResearchPlan(plan);
    await saveResearchPlan(runtime, message, plan);
    const context = await resolveResearchMessageContext(runtime, message);
    await saveResearchState(
      runtime,
      {
        roomId: context.roomId,
        worldId: context.worldId,
        channelId: context.channelId,
        userId: context.userId,
      },
      {
        question,
        phase: "plan-review",
        plan,
        run: null,
        session: null,
        progressEntry: {
          role: "planner",
          message: "Research plan ready for review.",
        },
      }
    );

    logger.info({ question, topicCount: plan.topics.length }, "Created research plan");

    if (callback) {
      const responseContent: Content = {
        text: result.markdown,
        actions: ["CREATE_RESEARCH_PLAN"],
        source: message.content.source,
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text: `Created research plan for: ${question}`,
      data: result.data,
    };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Help me research how to land a web3 job in 2026.",
        },
      },
      {
        name: "{{name2}}",
        content: {
          text: "I drafted a research plan for landing a web3 job in 2026.",
          actions: ["CREATE_RESEARCH_PLAN"],
        },
      },
    ],
  ],
};
