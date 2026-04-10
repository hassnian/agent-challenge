import { stripJsonCodeFences } from "./json";
import { createDefaultResearchPlan, type ResearchPlanData, type ResearchTopic, type ResearchTopicPriority } from "./plan";
import type { ResearchSessionData } from "./session";

export const getNonEmptyString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidateFields = ["text", "content", "response", "output"];
  for (const field of candidateFields) {
    const candidate = (value as Record<string, unknown>)[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

export const buildPlannerPrompt = (question: string): string => {
  return `
You are the Planner in a research room.
Build a plan the user can inspect and act on, not a generic blog outline.

Question: ${question}

Return valid JSON only with this exact shape:
{
  "question": "restated research question",
  "goal": "one sentence goal",
  "topics": [
    {
      "id": "topic-1",
      "title": "topic title",
      "reason": "why this topic matters",
      "searchQueries": ["query 1", "query 2", "query 3"],
      "priority": "high"
    }
  ],
  "outOfScope": ["item 1", "item 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "clarifyingGaps": ["gap 1", "gap 2"]
}

Rules:
- Do not wrap the JSON in markdown fences
- Generate 3 to 5 main topics
- Topics must be concrete, researchable, and non-overlapping
- Topics should be framed as decision-useful workstreams, not generic blog categories
- The full set of topics should cover the highest-value parts of answering the question
- If the user's role, audience, or target path is still unclear, include a topic that resolves that ambiguity instead of assuming one path too early
- Each topic must include 2 to 4 distinct high-signal search queries
- Put the strongest queries first because only the first few may be used
- Queries should be specific to the question and likely sources, not generic SEO phrases
- Prefer queries that target official docs, company career pages, ecosystem sites, GitHub, hackathons, community channels, or role-specific job boards when relevant
- Add time, geography, remote/on-site, or role constraints when they materially change the answer
- Avoid vague queries like "best resources", "overview", or "for beginners" unless the user's question explicitly asks for beginner learning material
- Priority must be one of: high, medium, low
- Clarifying gaps should be specific to this question, not generic filler
- Each clarifying gap must be phrased as a direct question the user can answer
- This is only a plan, not the actual research result
`.trim();
};

export const buildPlanUpdatePrompt = (
  currentPlan: ResearchPlanData,
  instruction: string
): string => {
  return `
You are the Planner in a research room.
Update the plan so it stays sharp, inspectable, and directly useful for research.

Current plan:
${JSON.stringify(currentPlan, null, 2)}

User instruction for updating the plan:
${instruction}

Return valid JSON only with this exact shape:
{
  "question": "updated research question",
  "goal": "one sentence goal",
  "topics": [
    {
      "id": "topic-1",
      "title": "topic title",
      "reason": "why this topic matters",
      "searchQueries": ["query 1", "query 2", "query 3"],
      "priority": "high"
    }
  ],
  "outOfScope": ["item 1", "item 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "clarifyingGaps": ["gap 1", "gap 2"]
}

Rules:
- Do not wrap the JSON in markdown fences
- Apply the user's requested changes to the current plan
- Keep only the parts of the current plan that still fit the updated scope
- Generate 3 to 5 main topics
- Topics must be concrete, researchable, and non-overlapping
- Topics should be framed as decision-useful workstreams, not generic blog categories
- If the updated scope leaves role, audience, or path unclear, include a topic that resolves that ambiguity instead of assuming one path too early
- Each topic must include 2 to 4 distinct high-signal search queries
- Put the strongest queries first because only the first few may be used
- Queries should be specific to the question and likely sources, not generic SEO phrases
- Prefer queries that target official docs, company career pages, ecosystem sites, GitHub, hackathons, community channels, or role-specific job boards when relevant
- Add time, geography, remote/on-site, or role constraints when they materially change the answer
- Avoid vague queries like "best resources", "overview", or "for beginners" unless the user's question explicitly asks for beginner learning material
- Priority must be one of: high, medium, low
- Clarifying gaps should reflect the updated scope and open decisions
- Each clarifying gap must be phrased as a direct question the user can answer
- Return an unapproved plan, since edits require review again
  `.trim();
};

export const buildFollowUpPlanPrompt = (
  session: ResearchSessionData,
  instruction: string
): string => {
  return `
You are the Planner in a research room.
Build a follow-up research plan that extends a prior completed session instead of repeating it.

Previous session question: ${session.question}
Previous direct answer: ${session.answer}
Previous summary: ${session.summary}
Previous key points: ${JSON.stringify(session.keyPoints)}
Previous contested points: ${JSON.stringify(session.contestedPoints)}
Previous open questions: ${JSON.stringify(session.openQuestions)}

User follow-up request:
${instruction}

Return valid JSON only with this exact shape:
{
  "question": "updated research question",
  "goal": "one sentence goal",
  "topics": [
    {
      "id": "topic-1",
      "title": "topic title",
      "reason": "why this topic matters",
      "searchQueries": ["query 1", "query 2", "query 3"],
      "priority": "high"
    }
  ],
  "outOfScope": ["item 1", "item 2"],
  "assumptions": ["assumption 1", "assumption 2"],
  "clarifyingGaps": ["gap 1", "gap 2"]
}

Rules:
- Do not wrap the JSON in markdown fences
- Treat this as a continuation of the saved session, not a fresh plan from zero
- Focus on unresolved questions, contested claims, missing evidence, or the user's newly requested angle
- Avoid spending topics on points that are already settled unless the user explicitly wants to reopen them
- Generate 3 to 5 main topics
- Topics must be concrete, researchable, and non-overlapping
- Topics should be framed as decision-useful workstreams, not generic blog categories
- Each topic must include 2 to 4 distinct high-signal search queries
- Put the strongest queries first because only the first few may be used
- Queries should be specific to the follow-up request and likely sources, not generic SEO phrases
- Prefer queries that target official docs, company pages, ecosystem sites, GitHub, primary sources, regulators, or role-specific sources when relevant
- Priority must be one of: high, medium, low
- Clarifying gaps should only ask questions that are still genuinely unresolved after the previous session
- Return an unapproved plan shape only; the caller decides whether to auto-approve the follow-up run
`.trim();
};

const isPriority = (value: unknown): value is ResearchTopicPriority => {
  return value === "high" || value === "medium" || value === "low";
};

const parseTopics = (value: unknown): ResearchTopic[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.title !== "string" ||
        typeof item.reason !== "string" ||
        !Array.isArray(item.searchQueries) ||
        !isPriority(item.priority)
      ) {
        return null;
      }

      const searchQueries = Array.from(
        new Set(
          item.searchQueries
            .filter(
              (query: unknown): query is string =>
                typeof query === "string" && query.trim().length > 0
            )
            .map((query: string) => query.trim())
        )
      ).slice(0, 4);

      if (searchQueries.length === 0) {
        return null;
      }

      const id =
        typeof item.id === "string" && item.id.trim().length > 0
          ? item.id
          : `topic-${index + 1}`;

      return {
        id,
        title: item.title.trim(),
        reason: item.reason.trim(),
        searchQueries,
        priority: item.priority,
      };
    })
    .filter((item): item is ResearchTopic => item !== null);
};

const parseStringList = (value: unknown): string[] => {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

const normalizeClarifyingGap = (gap: string): string => {
  const trimmed = gap.trim().replace(/[.?!]+$/, "");
  if (!trimmed) {
    return "Can you clarify the missing scope here?";
  }

  if (/^(what|which|who|where|when|why|how|is|are|do|does|did|can|could|should|would|will)\b/i.test(trimmed)) {
    return `${trimmed}?`;
  }

  const normalizedLead = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `Can you clarify ${normalizedLead}?`;
};

const parseClarifyingGaps = (value: unknown, fallback: string[]): string[] => {
  const gaps = parseStringList(value).map(normalizeClarifyingGap).filter(Boolean);
  return gaps.length > 0 ? gaps : fallback;
};

export const parsePlanResponse = (
  fallbackQuestion: string,
  raw: string
): ResearchPlanData | null => {
  const withoutFences = stripJsonCodeFences(raw);

  try {
    const parsed = JSON.parse(withoutFences) as Partial<ResearchPlanData>;
    if (typeof parsed.goal !== "string") {
      return null;
    }

    const topics = parseTopics(parsed.topics);
    if (topics.length === 0) {
      return null;
    }

    const question =
      typeof parsed.question === "string" && parsed.question.trim().length > 0
        ? parsed.question.trim()
        : fallbackQuestion;

    const defaultPlan = createDefaultResearchPlan(question);

    return {
      question,
      goal: parsed.goal,
      topics,
      outOfScope: parseStringList(parsed.outOfScope),
      assumptions: parseStringList(parsed.assumptions),
      clarifyingGaps: parseClarifyingGaps(parsed.clarifyingGaps, defaultPlan.clarifyingGaps),
      approved: false,
    };
  } catch {
    return null;
  }
};
