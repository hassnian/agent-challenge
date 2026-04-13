import { type IAgentRuntime, logger, ModelType } from "@elizaos/core";
import {
  buildSkepticPrompt,
  buildSynthesizerPrompt,
  buildTopicResearchPrompt,
} from "./prompts";
import { generateStructuredText } from "./structured-model";
import { stripJsonCodeFences } from "./json";
import { type ResearchTopic, type ResearchPlanData } from "./plan";
import {
  createDefaultSynthesis,
  createResearchSession,
  isFallbackOnlyResearchSessionData,
  type EvidenceCard,
  type ResearchSession,
  type ResearchSynthesis,
} from "./session";
import { saveResearchSessionForRoom } from "./session-store";
import {
  createDefaultDebateReview,
  createDefaultTopicResearchResult,
  type DebateReview,
  type ResearchConfidence,
  type TopicFinding,
  type TopicResearchResult,
} from "./research";

type TavilySearchResult = {
  title: string;
  url: string;
  content?: string;
  raw_content?: string;
};

type TavilySearchResponse = {
  results: TavilySearchResult[];
};

type SerperSearchResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

type SerperSearchResponse = {
  organic?: SerperSearchResult[];
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

export type ResearchExecutionPhase = "searching" | "challenging" | "synthesizing" | "done";

export type ResearchExecutionRole = "searcher" | "skeptic" | "synthesizer";

export type ResearchExecutionProgress = {
  phase: ResearchExecutionPhase;
  role: ResearchExecutionRole;
  text: string;
  evidenceCount: number;
  topicCount: number;
  currentTopicIndex: number;
  completedTopicCount: number;
};

export type ExecuteResearchSessionParams = {
  runtime: IAgentRuntime;
  roomId: string;
  worldId: string;
  question: string;
  plan: ResearchPlanData;
  onProgress?: (progress: ResearchExecutionProgress) => Promise<void>;
};

type EvidenceProviderState = {
  tavilyEnabled: boolean;
  jinaEnabled: boolean;
  serperEnabled: boolean;
};

type SearchProviderName = "tavily" | "serper";

type SearchProviderEnabledKey = "tavilyEnabled" | "serperEnabled";

type SearchProviderConfig = {
  name: SearchProviderName;
  label: string;
  enabledKey: SearchProviderEnabledKey;
  maxQueries: number;
  execute: (query: string) => Promise<Response>;
  parseResults: (payload: unknown) => SearchResult[];
};

type ProviderDisableReason =
  | {
      kind: "auth";
      logMessage: string;
    }
  | {
      kind: "billing";
      logMessage: string;
    }
  | {
      kind: "rate_limit";
      logMessage: string;
    };

const getApiKey = (runtime: IAgentRuntime, key: string): string | null => {
  const setting = runtime.getSetting(key);
  return typeof setting === "string" && setting.trim().length > 0
    ? setting.trim()
    : null;
};

const isConfidence = (value: unknown): value is ResearchConfidence => {
  return value === "high" || value === "medium" || value === "low";
};

const parseEvidenceRefs = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is number => Number.isInteger(item) && item > 0))
  );
};

const truncateText = (value: string, maxLength: number): string => {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
};

const getDomainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
};

const normalizeSnippet = (value: string | undefined): string => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? truncateText(normalized, 3000) : "No snippet captured.";
};

const getProviderDisableReason = (
  providerLabel: string,
  status: number
): ProviderDisableReason | null => {
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      logMessage: `${providerLabel} authentication or permission failure; disabling ${providerLabel} for the rest of this run`,
    };
  }

  if (status === 402) {
    return {
      kind: "billing",
      logMessage: `${providerLabel} billing or quota issue; disabling ${providerLabel} for the rest of this run`,
    };
  }

  if (status === 429 || status === 432) {
    return {
      kind: "rate_limit",
      logMessage: `${providerLabel} rate limit reached; disabling ${providerLabel} for the rest of this run`,
    };
  }

  return null;
};

const createEvidenceCardFromSearchResult = (
  topicId: string,
  query: string,
  result: SearchResult
): EvidenceCard => {
  return {
    topicId,
    query,
    title: result.title.trim() || "Untitled source",
    domain: getDomainFromUrl(result.url),
    url: result.url,
    snippet: normalizeSnippet(result.snippet),
  };
};

const dedupeEvidenceCards = (cards: EvidenceCard[]): EvidenceCard[] => {
  const uniqueByUrl = new Map<string, EvidenceCard>();

  for (const card of cards) {
    if (!uniqueByUrl.has(card.url)) {
      uniqueByUrl.set(card.url, card);
    }
  }

  return Array.from(uniqueByUrl.values());
};

const renderEvidenceContext = (cards: EvidenceCard[]): string => {
  if (cards.length === 0) {
    return "No real web evidence was captured for this topic. Use the topic and query intent, but be explicit about uncertainty.";
  }

  return cards
    .map(
      (card, index) =>
        `${index + 1}. ${card.title} (${card.domain})\nURL: ${card.url}\nQuery: ${card.query}\nSnippet: ${card.snippet}`
    )
    .join("\n\n");
};

const readUrlWithJina = async (
  url: string,
  apiKey: string | null,
  providerState: EvidenceProviderState
): Promise<string | null> => {
  if (!providerState.jinaEnabled) {
    return null;
  }

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : undefined,
    });

    if (!response.ok) {
      const responseBody = normalizeSnippet(await response.text());
      const disableReason = getProviderDisableReason("r.jina", response.status);

      if (disableReason) {
        providerState.jinaEnabled = false;
        logger.warn(
          { status: response.status, responseBody },
          disableReason.logMessage
        );
        return null;
      }

      throw new Error(
        `Jina reader failed with status ${response.status}${responseBody !== "No snippet captured." ? `: ${responseBody}` : ""}`
      );
    }

    const text = normalizeSnippet(await response.text());
    return text === "No snippet captured." ? null : text;
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        url,
      },
      "Jina reader failed for source URL"
    );

    return null;
  }
};

const enrichEvidenceCardsWithReader = async (
  cards: EvidenceCard[],
  jinaApiKey: string | null,
  providerState: EvidenceProviderState
): Promise<EvidenceCard[]> => {
  if (!providerState.jinaEnabled) {
    return cards;
  }

  const enriched = await Promise.all(
    cards.map(async (card) => {
      const readerSnippet = await readUrlWithJina(card.url, jinaApiKey, providerState);
      return readerSnippet
        ? {
            ...card,
            snippet: readerSnippet,
          }
        : card;
    })
  );

  return enriched;
};

const searchTopicEvidenceWithProvider = async (
  topic: ResearchTopic,
  jinaApiKey: string | null,
  providerState: EvidenceProviderState,
  provider: SearchProviderConfig
): Promise<EvidenceCard[]> => {
  if (!providerState[provider.enabledKey]) {
    return [];
  }

  const collected: EvidenceCard[] = [];

  for (const query of topic.searchQueries.slice(0, provider.maxQueries)) {
    if (!providerState[provider.enabledKey]) {
      break;
    }

    try {
      const response = await provider.execute(query);

      if (!response.ok) {
        const responseBody = normalizeSnippet(await response.text());
        const disableReason = getProviderDisableReason(provider.label, response.status);

        if (disableReason) {
          providerState[provider.enabledKey] = false;
          logger.warn(
            {
              status: response.status,
              topic: topic.title,
              query,
              responseBody,
            },
            disableReason.logMessage
          );
          break;
        }

        throw new Error(
          `${provider.label} search failed with status ${response.status}${responseBody ? `: ${responseBody}` : ""}`
        );
      }

      const payload = await response.json();
      const cards = provider
        .parseResults(payload)
        .map((result) => createEvidenceCardFromSearchResult(topic.id, query, result));

      collected.push(...cards);
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          topic: topic.title,
          query,
        },
        `${provider.label} search failed for topic query`
      );
    }
  }

  const uniqueCards = dedupeEvidenceCards(collected).slice(0, 5);
  return enrichEvidenceCardsWithReader(uniqueCards, jinaApiKey, providerState);
};

const parseTavilyResults = (payload: unknown): SearchResult[] => {
  return ((payload as TavilySearchResponse).results ?? [])
    .filter(
      (result) =>
        typeof result.title === "string" &&
        result.title.trim().length > 0 &&
        typeof result.url === "string" &&
        result.url.trim().length > 0
    )
    .map((result) => ({
      title: result.title.trim(),
      url: result.url.trim(),
      snippet: result.content ?? result.raw_content,
    }));
};

const parseSerperResults = (payload: unknown): SearchResult[] => {
  return (((payload as SerperSearchResponse).organic ?? []) as SerperSearchResult[])
    .filter(
      (result) =>
        typeof result.title === "string" &&
        result.title.trim().length > 0 &&
        typeof result.link === "string" &&
        result.link.trim().length > 0
    )
    .map((result) => ({
      title: result.title?.trim() || "Untitled source",
      url: result.link?.trim() || "",
      snippet: result.snippet,
    }));
};

const parseFindings = (value: unknown): TopicFinding[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof item.claim !== "string" ||
        typeof item.support !== "string" ||
        !isConfidence(item.confidence)
      ) {
        return null;
      }

        return {
          claim: item.claim,
          support: item.support,
          confidence: item.confidence,
          evidenceRefs: parseEvidenceRefs((item as { evidenceRefs?: unknown }).evidenceRefs),
        };
      })
    .filter((item): item is TopicFinding => item !== null);
};

const parseStringList = (value: unknown): string[] => {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

const parseSynthesisResponse = (raw: string): ResearchSynthesis | null => {
  const withoutFences = stripJsonCodeFences(raw);

  try {
    const parsed = JSON.parse(withoutFences) as Partial<ResearchSynthesis>;
    if (
      typeof parsed.answer !== "string" ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.keyPoints) ||
      !Array.isArray(parsed.contestedPoints) ||
      !Array.isArray(parsed.openQuestions)
    ) {
      return null;
    }

    return {
      answer: parsed.answer,
      summary: parsed.summary,
      keyPoints: parseStringList(parsed.keyPoints),
      contestedPoints: parseStringList(parsed.contestedPoints),
      openQuestions: parseStringList(parsed.openQuestions),
    };
  } catch {
    return null;
  }
};

const parseTopicResearchResponse = (
  raw: string,
  fallback: TopicResearchResult
): TopicResearchResult | null => {
  const withoutFences = stripJsonCodeFences(raw);

  try {
    const parsed = JSON.parse(withoutFences) as Partial<TopicResearchResult>;
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.findings) ||
      !Array.isArray(parsed.openQuestions) ||
      !Array.isArray(parsed.followUpQueries)
    ) {
      return null;
    }

    const findings = parseFindings(parsed.findings);

    return {
      topicId: fallback.topicId,
      title: fallback.title,
      summary: parsed.summary,
      findings,
      openQuestions: parseStringList(parsed.openQuestions),
      followUpQueries: parseStringList(parsed.followUpQueries),
    };
  } catch {
    return null;
  }
};

const parseDebateReviewResponse = (raw: string): DebateReview | null => {
  const withoutFences = stripJsonCodeFences(raw);

  try {
    const parsed = JSON.parse(withoutFences) as Partial<DebateReview>;
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.challenges) ||
      !Array.isArray(parsed.missingEvidence) ||
      !Array.isArray(parsed.followUpQueries)
    ) {
      return null;
    }

    const challenges = parsed.challenges
      .map((item) => {
        if (
          typeof item !== "object" ||
          item === null ||
          typeof item.topicId !== "string" ||
          typeof item.claim !== "string" ||
          typeof item.concern !== "string" ||
          !isConfidence(item.severity)
        ) {
          return null;
        }

        return {
          topicId: item.topicId,
          claim: item.claim,
          concern: item.concern,
          severity: item.severity,
        };
      })
      .filter((item): item is DebateReview["challenges"][number] => item !== null);

    return {
      summary: parsed.summary,
      challenges,
      missingEvidence: parseStringList(parsed.missingEvidence),
      followUpQueries: parseStringList(parsed.followUpQueries),
    };
  } catch {
    return null;
  }
};

const emitProgress = async (
  params: ExecuteResearchSessionParams,
  progress: ResearchExecutionProgress
): Promise<void> => {
  await params.onProgress?.(progress);
};

export const executeResearchSession = async (
  params: ExecuteResearchSessionParams
): Promise<ResearchSession> => {
  const { runtime, question, plan, roomId, worldId } = params;
  const questionFromPlan = plan.question || question;
  const topicResults: TopicResearchResult[] = [];
  const evidence: EvidenceCard[] = [];
  let debate = createDefaultDebateReview();
  let synthesis = createDefaultSynthesis();
  const tavilyApiKey = getApiKey(runtime, "TAVILY_API_KEY");
  const jinaApiKey = getApiKey(runtime, "JINA_API_KEY");
  const serperApiKey = getApiKey(runtime, "SERPER_API_KEY");
  const hasAnySearchProvider = Boolean(tavilyApiKey || serperApiKey);
  const providerState: EvidenceProviderState = {
    tavilyEnabled: Boolean(tavilyApiKey),
    jinaEnabled: true,
    serperEnabled: Boolean(serperApiKey),
  };

  await emitProgress(params, {
    phase: "searching",
    role: "searcher",
    text: hasAnySearchProvider
      ? `Starting across ${plan.topics.length} approved topics with live web evidence.`
      : `Starting across ${plan.topics.length} approved topics without live web evidence.`,
    evidenceCount: 0,
    topicCount: plan.topics.length,
    currentTopicIndex: 0,
    completedTopicCount: 0,
  });

  for (let topicIndex = 0; topicIndex < plan.topics.length; topicIndex++) {
    const topic = plan.topics[topicIndex];
    await emitProgress(params, {
      phase: "searching",
      role: "searcher",
      text: `Investigating: ${topic.title}`,
      evidenceCount: evidence.length,
      topicCount: plan.topics.length,
      currentTopicIndex: topicIndex,
      completedTopicCount: topicIndex,
    });

    const fallbackTopicResult = createDefaultTopicResearchResult(topic.id, topic.title);
    const topicEvidenceFromTavily = tavilyApiKey && providerState.tavilyEnabled
        ? await searchTopicEvidenceWithProvider(topic, jinaApiKey, providerState, {
          name: "tavily",
          label: "Tavily",
          enabledKey: "tavilyEnabled",
          maxQueries: 4,
          execute: (query) =>
            fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                api_key: tavilyApiKey,
                query,
                topic: "general",
                search_depth: "basic",
                max_results: 3,
                include_answer: false,
                include_raw_content: false,
              }),
            }),
          parseResults: parseTavilyResults,
        })
      : [];
    const topicEvidence =
      topicEvidenceFromTavily.length > 0
        ? topicEvidenceFromTavily
        : serperApiKey && providerState.serperEnabled
        ? await searchTopicEvidenceWithProvider(topic, jinaApiKey, providerState, {
            name: "serper",
            label: "Serper",
            enabledKey: "serperEnabled",
            maxQueries: 3,
            execute: (query) =>
              fetch("https://google.serper.dev/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-API-KEY": serperApiKey,
                },
                body: JSON.stringify({
                  q: query,
                  gl: "us",
                  hl: "en",
                  num: 5,
                }),
              }),
            parseResults: parseSerperResults,
          })
        : [];
    evidence.push(...topicEvidence);

    if (hasAnySearchProvider) {
      await emitProgress(params, {
        phase: "searching",
        role: "searcher",
        text: `Collected ${topicEvidence.length} evidence cards for ${topic.title}.`,
        evidenceCount: evidence.length,
        topicCount: plan.topics.length,
        currentTopicIndex: topicIndex,
        completedTopicCount: topicIndex + 1,
      });
    }

    try {
      const topicText = await generateStructuredText(
        runtime,
        ModelType.TEXT_LARGE,
        buildTopicResearchPrompt(
          questionFromPlan,
          topic,
          renderEvidenceContext(topicEvidence)
        ),
        {
          temperature: 0.3,
          maxTokens: 3200,
        }
      );

      if (topicText) {
        const parsedTopic = parseTopicResearchResponse(topicText, fallbackTopicResult);

        if (parsedTopic) {
          topicResults.push(parsedTopic);
          continue;
        }

        logger.warn(
          { question: questionFromPlan, topic: topic.title },
          "Topic research returned non-JSON or invalid JSON"
        );
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          question: questionFromPlan,
          topic: topic.title,
        },
        "Topic research step failed; using fallback result for this topic"
      );
    }

    topicResults.push(fallbackTopicResult);
  }

  const topicResearchJson = JSON.stringify(topicResults, null, 2);

  await emitProgress(params, {
    phase: "challenging",
    role: "skeptic",
    text: "Challenging weak claims, missing evidence, and unresolved gaps.",
    evidenceCount: evidence.length,
    topicCount: plan.topics.length,
    currentTopicIndex: plan.topics.length,
    completedTopicCount: plan.topics.length,
  });

  try {
    const skepticText = await generateStructuredText(
      runtime,
      ModelType.TEXT_LARGE,
      buildSkepticPrompt(questionFromPlan, topicResearchJson),
      {
        temperature: 0.3,
        maxTokens: 2200,
      }
    );

    if (skepticText) {
      const parsedDebate = parseDebateReviewResponse(skepticText);

      if (parsedDebate) {
        debate = parsedDebate;
      } else {
        logger.warn({ question }, "Skeptic returned non-JSON or invalid JSON");
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), question: questionFromPlan },
      "Skeptic step failed; using fallback skeptical review"
    );
  }

  const debateJson = JSON.stringify(debate, null, 2);

  await emitProgress(params, {
    phase: "synthesizing",
    role: "synthesizer",
    text: "Combining the strongest supported findings into a final report.",
    evidenceCount: evidence.length,
    topicCount: plan.topics.length,
    currentTopicIndex: plan.topics.length,
    completedTopicCount: plan.topics.length,
  });

  try {
    const synthesizerText = await generateStructuredText(
      runtime,
      ModelType.TEXT_LARGE,
      buildSynthesizerPrompt(questionFromPlan, topicResearchJson, debateJson),
      {
        temperature: 0.3,
        maxTokens: 3200,
      }
    );

    if (synthesizerText) {
      const parsedSynthesis = parseSynthesisResponse(synthesizerText);

      if (parsedSynthesis) {
        synthesis = parsedSynthesis;
      } else {
        logger.warn({ question }, "Synthesizer returned non-JSON or invalid JSON");
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), question: questionFromPlan },
      "Synthesizer step failed; using fallback synthesis"
    );
  }

  const session = createResearchSession({
    question: questionFromPlan,
    plan,
    topicResults,
    debate,
    synthesis,
    evidence: dedupeEvidenceCards(evidence),
  });

  await saveResearchSessionForRoom(
    runtime,
    {
      roomId,
      worldId,
    },
    session.data,
    session.markdown
  );

  const degraded = isFallbackOnlyResearchSessionData(session.data);

  const completionLogContext = {
    question: questionFromPlan,
    topicCount: topicResults.length,
    evidenceCount: session.data.evidence.length,
    degraded,
  };

  if (degraded) {
    logger.warn(
      completionLogContext,
      "Completed degraded multi-topic research session with fallback-only output"
    );
  } else {
    logger.info(completionLogContext, "Completed multi-topic research session");
  }

  await emitProgress(params, {
    phase: "done",
    role: "synthesizer",
    text: degraded
      ? "Completed with fallback-only output and no live evidence."
      : "Completed.",
    evidenceCount: session.data.evidence.length,
    topicCount: session.data.topicResults.length,
    currentTopicIndex: session.data.topicResults.length,
    completedTopicCount: session.data.topicResults.length,
  });

  return session;
};
