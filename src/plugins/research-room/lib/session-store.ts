import type { IAgentRuntime, Memory } from "@elizaos/core";
import type { ResearchSessionData } from "./session";
import { resolveResearchMessageContext } from "./message-context";

export const RESEARCH_SESSIONS_TABLE = "research_sessions";

export type StoredResearchSession = {
  id: string;
  createdAt: number;
  markdown: string;
  data: ResearchSessionData;
};

type SessionMemoryMetadata = {
  session?: ResearchSessionData;
};

const getSessionFromMemory = (memory: Memory): ResearchSessionData | null => {
  const metadata = memory.content.metadata as SessionMemoryMetadata | undefined;
  return metadata?.session ?? null;
};

const getStoredSessionFromMemory = (memory: Memory): StoredResearchSession | null => {
  const session = getSessionFromMemory(memory);
  if (!session || !memory.id) {
    return null;
  }

  return {
    id: memory.id,
    createdAt:
      typeof memory.createdAt === "number" ? memory.createdAt : session.completedAt,
    markdown: memory.content.text ?? "",
    data: session,
  };
};

export const getLatestResearchSession = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"]
): Promise<ResearchSessionData | null> => {
  const latest = await getLatestStoredResearchSession(runtime, roomId);
  return latest?.data ?? null;
};

export const getLatestStoredResearchSession = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"]
): Promise<StoredResearchSession | null> => {
  const sessions = await listResearchSessions(runtime, roomId, 1);
  return sessions.at(0) ?? null;
};

export const listResearchSessions = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"],
  count = 10
): Promise<StoredResearchSession[]> => {
  const sessions = await runtime.getMemories({
    roomId,
    tableName: RESEARCH_SESSIONS_TABLE,
    count,
  });

  return sessions
    .map(getStoredSessionFromMemory)
    .filter((session): session is StoredResearchSession => session !== null);
};

export const getStoredResearchSessionById = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"],
  sessionId: string
): Promise<StoredResearchSession | null> => {
  const normalizedId = sessionId.trim().toLowerCase();
  if (!normalizedId) {
    return null;
  }

  const sessions = await listResearchSessions(runtime, roomId, 50);
  return (
    sessions.find(
      (session) =>
        session.id.toLowerCase() === normalizedId ||
        session.id.toLowerCase().startsWith(normalizedId)
    ) ?? null
  );
};

export const saveResearchSession = async (
  runtime: IAgentRuntime,
  message: Memory,
  session: ResearchSessionData,
  markdown: string
): Promise<void> => {
  const context = await resolveResearchMessageContext(runtime, message);

  await saveResearchSessionForRoom(
    runtime,
    {
      roomId: context.roomId,
      worldId: context.worldId,
    },
    session,
    markdown
  );
};

export const saveResearchSessionForRoom = async (
  runtime: IAgentRuntime,
  context: {
    roomId: Memory["roomId"];
    worldId: Memory["worldId"];
  },
  session: ResearchSessionData,
  markdown: string
): Promise<void> => {
  await runtime.createMemory(
    {
      agentId: runtime.agentId,
      entityId: runtime.agentId,
      roomId: context.roomId,
      worldId: context.worldId,
      content: {
        text: markdown,
        metadata: {
          session,
        },
      },
    },
    RESEARCH_SESSIONS_TABLE
  );
};
