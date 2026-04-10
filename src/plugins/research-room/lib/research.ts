export type ResearchConfidence = "high" | "medium" | "low";

export type TopicFinding = {
  claim: string;
  support: string;
  confidence: ResearchConfidence;
  evidenceRefs: number[];
};

export type TopicResearchResult = {
  topicId: string;
  title: string;
  summary: string;
  findings: TopicFinding[];
  openQuestions: string[];
  followUpQueries: string[];
};

export type DebateSeverity = "high" | "medium" | "low";

export type DebateChallenge = {
  topicId: string;
  claim: string;
  concern: string;
  severity: DebateSeverity;
};

export type DebateReview = {
  summary: string;
  challenges: DebateChallenge[];
  missingEvidence: string[];
  followUpQueries: string[];
};

export const DEFAULT_TOPIC_RESEARCH_SUMMARY =
  "I could not generate a research brief for this topic.";

export const DEFAULT_DEBATE_SUMMARY =
  "I could not generate a skeptical review for this question.";

export const createDefaultTopicResearchResult = (
  topicId: string,
  title: string
): TopicResearchResult => {
  return {
    topicId,
    title,
    summary: DEFAULT_TOPIC_RESEARCH_SUMMARY,
    findings: [],
    openQuestions: [],
    followUpQueries: [],
  };
};

export const createDefaultDebateReview = (): DebateReview => {
  return {
    summary: DEFAULT_DEBATE_SUMMARY,
    challenges: [],
    missingEvidence: [],
    followUpQueries: [],
  };
};
