import type { ResearchPlanData } from "./plan";
import {
  DEFAULT_DEBATE_SUMMARY,
  DEFAULT_TOPIC_RESEARCH_SUMMARY,
  type DebateReview,
  type TopicFinding,
  type TopicResearchResult,
} from "./research";

export type ResearchRole = "searcher" | "skeptic" | "synthesizer";

export type ResearchStep = {
  role: ResearchRole;
  status: "done";
  text: string;
};

export type EvidenceCard = {
  topicId: string;
  query: string;
  title: string;
  domain: string;
  url: string;
  snippet: string;
};

export type ResearchSessionData = {
  question: string;
  phase: "done";
  completedAt: number;
  plan: ResearchPlanData;
  topicResults: TopicResearchResult[];
  debate: DebateReview;
  answer: string;
  summary: string;
  keyPoints: string[];
  contestedPoints: string[];
  openQuestions: string[];
  evidence: EvidenceCard[];
  steps: ResearchStep[];
};

export type ResearchSession = {
  markdown: string;
  data: ResearchSessionData;
  preview: string;
};

export type CreateResearchSessionParams = {
  question: string;
  plan: ResearchPlanData;
  topicResults: TopicResearchResult[];
  debate: DebateReview;
  synthesis: ResearchSynthesis;
  evidence: EvidenceCard[];
};

export type ResearchSynthesis = {
  answer: string;
  summary: string;
  keyPoints: string[];
  contestedPoints: string[];
  openQuestions: string[];
};

export const DEFAULT_SYNTHESIS_ANSWER =
  "I could not generate a structured answer for this question.";

export const DEFAULT_SYNTHESIS_SUMMARY =
  "The assistant could not yet produce a structured synthesis.";

export const createDefaultSynthesis = (): ResearchSynthesis => {
  return {
    answer: DEFAULT_SYNTHESIS_ANSWER,
    summary: DEFAULT_SYNTHESIS_SUMMARY,
    keyPoints: [],
    contestedPoints: [],
    openQuestions: [],
  };
};

export const isFallbackOnlyResearchSessionData = (
  data: Pick<ResearchSessionData, "topicResults" | "debate" | "answer" | "summary" | "evidence">
): boolean => {
  const allTopicsFallback =
    data.topicResults.length > 0 &&
    data.topicResults.every(
      (topic) =>
        topic.summary === DEFAULT_TOPIC_RESEARCH_SUMMARY &&
        topic.findings.length === 0 &&
        topic.openQuestions.length === 0 &&
        topic.followUpQueries.length === 0
    );

  const debateFallback =
    data.debate.summary === DEFAULT_DEBATE_SUMMARY &&
    data.debate.challenges.length === 0 &&
    data.debate.missingEvidence.length === 0 &&
    data.debate.followUpQueries.length === 0;

  const synthesisFallback =
    data.answer === DEFAULT_SYNTHESIS_ANSWER &&
    data.summary === DEFAULT_SYNTHESIS_SUMMARY;

  return data.evidence.length === 0 && allTopicsFallback && debateFallback && synthesisFallback;
};

const renderBulletList = (items: string[], emptyMessage: string): string[] => {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${emptyMessage}`];
};

const truncateLine = (value: string, maxLength: number): string => {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
};

const renderFindings = (findings: TopicFinding[]): string[] => {
  return findings.length > 0
    ? findings.flatMap((finding) => [
        `     - Claim: ${finding.claim}`,
        `       - Support: ${finding.support}`,
        `       - Confidence: ${finding.confidence}`,
        `       - Evidence: ${finding.evidenceRefs.length > 0 ? finding.evidenceRefs.map((ref) => `#${ref}`).join(", ") : "No evidence refs cited"}`,
      ])
    : ["     - No concrete findings captured yet."];
};

export const createResearchSession = ({
  question,
  plan,
  topicResults,
  debate,
  synthesis,
  evidence,
}: CreateResearchSessionParams): ResearchSession => {
  const data: ResearchSessionData = {
    question,
    completedAt: Date.now(),
    plan,
    topicResults,
    debate,
    phase: "done",
    answer: synthesis.answer,
    summary: synthesis.summary,
    keyPoints: synthesis.keyPoints,
    contestedPoints: synthesis.contestedPoints,
    openQuestions: synthesis.openQuestions,
    evidence,
    steps: [
      {
        role: "searcher",
        status: "done",
        text: `Completed research on ${topicResults.length} topics.`,
      },
      {
        role: "skeptic",
        status: "done",
        text: debate.summary,
      },
      {
        role: "synthesizer",
        status: "done",
        text: synthesis.summary,
      },
    ],
  };

  const markdown = [
    "# Research Session",
    "",
    "## Question",
    question,
    "",
    "## Topics Researched",
    ...(topicResults.length > 0
      ? topicResults.flatMap((topic, index) => [
          `${index + 1}. **${topic.title}**`,
          `   - Summary: ${topic.summary}`,
          `   - Findings:`,
          ...renderFindings(topic.findings),
          ...(topic.openQuestions.length > 0
            ? [
                `   - Open Questions:`,
                ...topic.openQuestions.map((item) => `     - ${item}`),
              ]
            : []),
          ...(topic.followUpQueries.length > 0
            ? [
                `   - Follow-up Queries:`,
                ...topic.followUpQueries.map((item) => `     - ${item}`),
              ]
            : []),
        ])
      : ["- No topics researched yet."]),
    "",
    "## Skeptic Summary",
    debate.summary,
    "",
    "## Main Challenges",
    ...(debate.challenges.length > 0
      ? debate.challenges.flatMap((challenge, index) => [
          `${index + 1}. **${challenge.claim}**`,
          `   - Topic: ${challenge.topicId}`,
          `   - Severity: ${challenge.severity}`,
          `   - Concern: ${challenge.concern}`,
        ])
      : ["- No skeptic challenges captured yet."]),
    "",
    "## Missing Evidence",
    ...renderBulletList(debate.missingEvidence, "No missing evidence captured yet."),
    "",
    "## Debate Follow-up Queries",
    ...renderBulletList(debate.followUpQueries, "No follow-up queries captured yet."),
    "",
    "## Evidence Board",
    ...(evidence.length > 0
      ? evidence.map(
          (item, index) =>
            `${index + 1}. **${item.title}** (${item.domain})\n   - Topic: ${item.topicId}\n   - Query: ${item.query}\n   - URL: ${item.url}\n   - Snippet: ${item.snippet}`
        )
      : ["- No source evidence captured yet."]),
    "",
    "## Direct Answer",
    synthesis.answer,
    "",
    "## Executive Summary",
    synthesis.summary,
    "",
    "## Key Points",
    ...(synthesis.keyPoints.length > 0
      ? synthesis.keyPoints.map((point) => `- ${point}`)
      : ["- No key points captured yet."]),
    "",
    "## Contested Points",
    ...(synthesis.contestedPoints.length > 0
      ? synthesis.contestedPoints.map((point) => `- ${point}`)
      : ["- No contested points captured yet."]),
    "",
    "## Open Questions",
    ...renderBulletList(synthesis.openQuestions, "No open questions captured yet."),
    "",
    "## Summary",
    "The assistant completed a role-based research pass with topic findings, skeptic challenges, and a final synthesis.",
    "",
    "## Next",
    "Connect real source evidence next, then store the session for reuse.",
  ].join("\n");

  const preview = [
    "# Research Session",
    "",
    "## Question",
    question,
    "",
    "## Direct Answer",
    truncateLine(synthesis.answer, 700),
    "",
    "## Executive Summary",
    truncateLine(synthesis.summary, 700),
    "",
    "## Key Points",
    ...renderBulletList(synthesis.keyPoints.slice(0, 5), "No key points captured yet."),
    "",
    "## Contested Points",
    ...renderBulletList(
      synthesis.contestedPoints.slice(0, 5),
      "No contested points captured yet."
    ),
    "",
    "## Open Questions",
    ...renderBulletList(synthesis.openQuestions.slice(0, 5), "No open questions captured yet."),
    "",
    "## Evidence Board",
    ...(evidence.length > 0
      ? evidence.slice(0, 3).map(
          (item, index) =>
            `${index + 1}. **${item.title}** (${item.domain})\n   - URL: ${item.url}`
        )
      : ["- No source evidence captured yet."]),
    "",
    "## Saved",
    "The full research artifact was saved for reuse, including topic findings, skeptic challenges, evidence, and synthesis.",
  ].join("\n");

  return {
    markdown,
    preview,
    data,
  };
};
