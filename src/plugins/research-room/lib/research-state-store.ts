import {
  ChannelType,
  createUniqueUuid,
  type IAgentRuntime,
  type Memory,
  type UUID,
} from "@elizaos/core";
import type { ResearchPlanData } from "./plan";
import type { ResearchRunRecord } from "./research-run-store";
import type { ResearchSessionData } from "./session";

export const RESEARCH_STATE_TABLE = "research_state";
export const RESEARCH_STATE_INDEX_TABLE = "research_state_index";

export type ResearchStatePhase =
  | "planning"
  | "plan-review"
  | "researching"
  | "critiquing"
  | "synthesizing"
  | "complete";

export type ResearchStateProgressRole =
  | "planner"
  | "searcher"
  | "skeptic"
  | "synthesizer";

export type ResearchStateProgressEntry = {
  id: string;
  timestamp: number;
  role: ResearchStateProgressRole;
  message: string;
};

export type ResearchStateRecord = {
  channelId: string;
  userId: string | null;
  question: string;
  phase: ResearchStatePhase;
  createdAt: number;
  updatedAt: number;
  plan: ResearchPlanData | null;
  run: ResearchRunRecord | null;
  session: ResearchSessionData | null;
  progressLog: ResearchStateProgressEntry[];
};

type ResearchStateMemoryMetadata = {
  state?: ResearchStateRecord;
};

const isUuid = (value: string | null | undefined): value is UUID => {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
};

const getStateFromMemory = (memory: Memory): ResearchStateRecord | null => {
  const metadata = memory.content.metadata as
    | ResearchStateMemoryMetadata
    | undefined;

  return metadata?.state ?? null;
};

const dedupeProgressLog = (
  entries: ResearchStateProgressEntry[],
): ResearchStateProgressEntry[] => {
  const ordered = [...entries].sort((left, right) => left.timestamp - right.timestamp);
  const deduped: ResearchStateProgressEntry[] = [];

  for (const entry of ordered) {
    const previous = deduped.at(-1);
    if (
      previous &&
      previous.role === entry.role &&
      previous.message === entry.message
    ) {
      continue;
    }

    deduped.push(entry);
  }

  return deduped;
};

const buildProgressEntry = (
  role: ResearchStateProgressRole,
  message: string,
  timestamp: number,
): ResearchStateProgressEntry => {
  return {
    id: `${timestamp}-${role}-${message.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}`,
    timestamp,
    role,
    message,
  };
};

const getStateIndexRoomId = (runtime: IAgentRuntime, userId: UUID): UUID => {
  return createUniqueUuid(runtime, userId);
};

const ensureStateIndexRoomExists = async (
  runtime: IAgentRuntime,
  userId: UUID,
  worldId: Memory["worldId"],
): Promise<UUID> => {
  const roomId = getStateIndexRoomId(runtime, userId);
  const existing = await runtime.getRoom(roomId);

  if (!existing) {
    await runtime.ensureRoomExists({
      id: roomId,
      name: `research-index-${userId.slice(0, 8)}`,
      source: "research-room",
      type: ChannelType.DM,
      channelId: userId,
      worldId,
    });
  }

  return roomId;
};

const loadLatestState = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"],
): Promise<ResearchStateRecord | null> => {
  const memories = await runtime.getMemories({
    roomId,
    tableName: RESEARCH_STATE_TABLE,
    count: 1,
  });

  const latest = memories.at(0);
  return latest ? getStateFromMemory(latest) : null;
};

export const getLatestResearchState = async (
  runtime: IAgentRuntime,
  roomId: Memory["roomId"],
): Promise<ResearchStateRecord | null> => {
  return loadLatestState(runtime, roomId);
};

export const listIndexedResearchStates = async (
  runtime: IAgentRuntime,
  userId: UUID,
  count = 100,
): Promise<ResearchStateRecord[]> => {
  const indexRoomId = getStateIndexRoomId(runtime, userId);
  const memories = await runtime.getMemories({
    roomId: indexRoomId,
    tableName: RESEARCH_STATE_INDEX_TABLE,
    count,
  });

  return memories
    .map(getStateFromMemory)
    .filter((state): state is ResearchStateRecord => state !== null);
};

const inferQuestion = (
  existing: ResearchStateRecord | null,
  update: Partial<ResearchStateRecord>,
): string => {
  return (
    update.question ??
    update.session?.question ??
    update.plan?.question ??
    update.run?.question ??
    existing?.question ??
    "Untitled research session"
  );
};

const inferCreatedAt = (
  existing: ResearchStateRecord | null,
  update: Partial<ResearchStateRecord>,
  timestamp: number,
): number => {
  return (
    update.createdAt ??
    existing?.createdAt ??
    update.session?.completedAt ??
    timestamp
  );
};

const inferPhase = (
  existing: ResearchStateRecord | null,
  update: Partial<ResearchStateRecord>,
): ResearchStatePhase => {
  if (update.phase) {
    return update.phase;
  }

  const run = update.run ?? existing?.run ?? null;
  const session = update.session ?? existing?.session ?? null;
  const plan = update.plan ?? existing?.plan ?? null;

  if (session) {
    return "complete";
  }

  if (run?.status === "running" || run?.status === "failed") {
    if (run.phase === "challenging") {
      return "critiquing";
    }

    if (run.phase === "synthesizing") {
      return "synthesizing";
    }

    return "researching";
  }

  if (run?.status === "queued") {
    return "researching";
  }

  if (plan) {
    return plan.approved ? "researching" : "plan-review";
  }

  return existing?.phase ?? "planning";
};

export const saveResearchState = async (
  runtime: IAgentRuntime,
  context: {
    roomId: Memory["roomId"];
    worldId: Memory["worldId"];
    channelId: string;
    userId?: string | null;
  },
  update: Partial<ResearchStateRecord> & {
    progressEntry?: {
      role: ResearchStateProgressRole;
      message: string;
      timestamp?: number;
    };
  },
): Promise<ResearchStateRecord> => {
  const existing = await loadLatestState(runtime, context.roomId);
  const timestamp = update.updatedAt ?? Date.now();
  const createdAt = inferCreatedAt(existing, update, timestamp);
  const progressEntries = [
    ...(existing?.progressLog ?? []),
    ...(update.progressLog ?? []),
  ];

  if (update.progressEntry) {
    progressEntries.push(
      buildProgressEntry(
        update.progressEntry.role,
        update.progressEntry.message,
        update.progressEntry.timestamp ?? timestamp,
      ),
    );
  }

  const state: ResearchStateRecord = {
    channelId: update.channelId ?? context.channelId,
    userId:
      update.userId ??
      context.userId ??
      existing?.userId ??
      null,
    question: inferQuestion(existing, update),
    phase: inferPhase(existing, update),
    createdAt,
    updatedAt: timestamp,
    plan: update.plan ?? existing?.plan ?? null,
    run: update.run ?? existing?.run ?? null,
    session: update.session ?? existing?.session ?? null,
    progressLog: dedupeProgressLog(progressEntries),
  };

  await runtime.createMemory(
    {
      agentId: runtime.agentId,
      entityId: runtime.agentId,
      roomId: context.roomId,
      worldId: context.worldId,
      content: {
        text: state.question,
        metadata: {
          state,
        },
      },
    },
    RESEARCH_STATE_TABLE,
  );

  if (isUuid(state.userId)) {
    const indexRoomId = await ensureStateIndexRoomExists(
      runtime,
      state.userId,
      context.worldId,
    );
    await runtime.createMemory(
      {
        agentId: runtime.agentId,
        entityId: runtime.agentId,
        roomId: indexRoomId,
        worldId: context.worldId,
        content: {
          text: state.question,
          metadata: {
            state,
          },
        },
      },
      RESEARCH_STATE_INDEX_TABLE,
    );
  }

  return state;
};
