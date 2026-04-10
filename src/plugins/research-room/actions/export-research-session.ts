import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
} from "@elizaos/core";
import { resolveStoredResearchSession } from "../lib/session-reference";

const getExportFormat = (text: string): "markdown" | "json" => {
  return /\bjson\b/i.test(text) ? "json" : "markdown";
};

export const exportResearchSessionAction: Action = {
  name: "EXPORT_RESEARCH_SESSION",
  similes: ["DOWNLOAD_RESEARCH_SESSION", "EXPORT_RESEARCH_MEMO", "EXPORT_RESEARCH_REPORT"],
  description: "Export a saved research session as markdown or JSON.",
  validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.trim().toLowerCase() ?? "";
    return (
      /export|download|copy/.test(text) &&
      /session|memo|report|research|dossier/.test(text)
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
    const session = await resolveStoredResearchSession(
      runtime,
      message.roomId,
      message.content.text ?? ""
    );

    if (!session) {
      const notFoundText = "I could not find a saved research session to export.";

      if (callback) {
        const responseContent: Content = {
          text: notFoundText,
          actions: ["EXPORT_RESEARCH_SESSION"],
          source: message.content.source,
        };

        await callback(responseContent);
      }

      return {
        success: false,
        text: notFoundText,
      };
    }

    const format = getExportFormat(message.content.text ?? "");
    const payload =
      format === "json"
        ? JSON.stringify(session.data, null, 2)
        : session.markdown;

    if (callback) {
      const responseContent: Content = {
        text: payload,
        actions: ["EXPORT_RESEARCH_SESSION"],
        source: message.content.source,
        metadata: {
          research: {
            sessionId: session.id,
            format,
          },
        },
      };

      await callback(responseContent);
    }

    return {
      success: true,
      text: `Exported research session ${session.id} as ${format}.`,
      data: {
        sessionId: session.id,
        format,
        payload,
      },
    };
  },
};
