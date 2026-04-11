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
import { createDefaultResearchPlan, createResearchPlan } from "../lib/plan";
import {
  buildPlanUpdatePrompt,
  getNonEmptyString,
  parsePlanResponse,
} from "../lib/planner";
import { resolveResearchMessageContext } from "../lib/message-context";
import { getLatestResearchPlan, saveResearchPlan } from "../lib/plan-store";
import { saveResearchState } from "../lib/research-state-store";

export const updateResearchPlanAction: Action = {
  name: "UPDATE_RESEARCH_PLAN",
  similes: ["EDIT_RESEARCH_PLAN", "REVISE_RESEARCH_PLAN", "REFINE_RESEARCH_PLAN"],
  description:
    "Update the latest research plan in the current room based on user feedback, then require review again before research starts.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return /update|edit|revise|change|refine/.test(text) && /plan/.test(text);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ): Promise<ActionResult> => {
    const latestPlan = await getLatestResearchPlan(runtime, message.roomId);

    if (!latestPlan) {
      const noPlanText =
        "I could not find a research plan to update in this session. Create a plan first, then update it.";

      if (callback) {
        const responseContent: Content = {
          text: noPlanText,
          actions: ["UPDATE_RESEARCH_PLAN"],
          source: message.content.source,
        };

        await callback(responseContent);
      }

      return {
        success: false,
        text: noPlanText,
      };
    }

    const instruction = message.content.text?.trim() ?? "";
    let updatedPlan = createDefaultResearchPlan(latestPlan.question);

    try {
      const plannerResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: buildPlanUpdatePrompt(latestPlan, instruction),
        temperature: 0.3,
      });

      const plannerText = getNonEmptyString(plannerResponse);
      if (plannerText) {
        const parsedPlan = parsePlanResponse(latestPlan.question, plannerText);

        if (parsedPlan) {
          updatedPlan = parsedPlan;
        } else {
          logger.warn(
            { question: latestPlan.question },
            "Plan update returned non-JSON or invalid JSON"
          );
          updatedPlan = {
            ...latestPlan,
            approved: false,
          };
        }
      } else {
        logger.warn(
          { question: latestPlan.question },
          "Plan update returned no usable text response"
        );
        updatedPlan = {
          ...latestPlan,
          approved: false,
        };
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          question: latestPlan.question,
        },
        "Falling back to latest research plan after failed plan update"
      );
      updatedPlan = {
        ...latestPlan,
        approved: false,
      };
    }

    updatedPlan = {
      ...updatedPlan,
      approved: false,
    };

    const rendered = createResearchPlan(updatedPlan);
    await saveResearchPlan(runtime, message, updatedPlan);
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
        question: updatedPlan.question,
        phase: "plan-review",
        plan: updatedPlan,
        run: null,
        session: null,
        progressEntry: {
          role: "planner",
          message: "Research plan updated and ready for review.",
        },
      }
    );

    logger.info(
      { question: updatedPlan.question, topicCount: updatedPlan.topics.length },
      "Updated research plan"
    );

    if (callback) {
      const responseContent: Content = {
        text: rendered.markdown,
        actions: ["UPDATE_RESEARCH_PLAN"],
        source: message.content.source,
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text: `Updated research plan for: ${updatedPlan.question}`,
      data: updatedPlan,
    };
  },
  examples: [
    [
      {
        name: "{{name1}}",
        content: {
          text: "Update the plan to focus on Europe first and cut anything enterprise-specific.",
        },
      },
      {
        name: "{{name2}}",
        content: {
          text: "I updated the plan and reset it for review before research starts.",
          actions: ["UPDATE_RESEARCH_PLAN"],
        },
      },
    ],
  ],
};
