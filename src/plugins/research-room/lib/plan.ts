export type ResearchTopicPriority = "high" | "medium" | "low";

export type ResearchTopic = {
  id: string;
  title: string;
  reason: string;
  searchQueries: string[];
  priority: ResearchTopicPriority;
};

export type ResearchPlanData = {
  question: string;
  goal: string;
  topics: ResearchTopic[];
  outOfScope: string[];
  assumptions: string[];
  clarifyingGaps: string[];
  approved: boolean;
};

export type ResearchPlan = {
  markdown: string;
  data: ResearchPlanData;
};

const createDefaultClarifyingGaps = (question: string): string[] => {
  return [
    `What exact outcome should this research answer for "${question}"?`,
    `What timeframe, geography, or audience should scope "${question}"?`,
    `Which comparison criteria or success metrics matter most for "${question}"?`,
  ];
};

const createGenericFallbackTopics = (question: string): ResearchTopic[] => {
  return [
    {
      id: "topic-1",
      title: "Current landscape and primary sources",
      reason: "Establish the most current baseline using primary or official sources before drawing conclusions.",
      searchQueries: [
        `${question} official sources`,
        `${question} current landscape`,
        `${question} latest developments`,
      ],
      priority: "high",
    },
    {
      id: "topic-2",
      title: "Practical approaches and decision criteria",
      reason: "Identify the main approaches, levers, or evaluation criteria that most affect the answer.",
      searchQueries: [
        `${question} best practices`,
        `${question} requirements`,
        `${question} case studies`,
      ],
      priority: "high",
    },
    {
      id: "topic-3",
      title: "Constraints, tradeoffs, and risks",
      reason: "Surface limitations, tradeoffs, and failure modes that could change the recommendation.",
      searchQueries: [
        `${question} constraints`,
        `${question} tradeoffs`,
        `${question} risks`,
      ],
      priority: "medium",
    },
    {
      id: "topic-4",
      title: "Evidence gaps and open questions",
      reason: "Find what still needs verification so the later synthesis can clearly separate evidence from uncertainty.",
      searchQueries: [
        `${question} open questions`,
        `${question} evidence gaps`,
        `${question} unresolved issues`,
      ],
      priority: "medium",
    },
  ];
};

export const createDefaultResearchPlan = (
  question: string
): ResearchPlanData => {
  return {
    question,
    goal: `Build a research plan to answer "${question}" with concrete evidence and decision-useful findings.`,
    topics: createGenericFallbackTopics(question),
    outOfScope: [],
    assumptions: [],
    clarifyingGaps: createDefaultClarifyingGaps(question),
    approved: false,
  };
};

const renderBulletList = (items: string[], emptyMessage: string): string[] => {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${emptyMessage}`];
};

export const createResearchPlan = (plan: ResearchPlanData): ResearchPlan => {
  const markdown = [
    "# Plan",
    "",
    `Main goal: ${plan.goal}`,
    "",
    "## Main Topics",
    ...(plan.topics.length > 0
      ? plan.topics.map((topic, index) => `${index + 1}. **${topic.title}**`)
      : ["- No topics generated yet."]),
    "",
    "## Things I’d Still Want To Clarify",
    ...renderBulletList(
      plan.clarifyingGaps,
      "No clarifying gaps."
    ),
    "",
    "## Assumptions I’m Making",
    ...renderBulletList(plan.assumptions, "No assumptions captured yet."),
    "",
    "## Out Of Scope",
    ...renderBulletList(plan.outOfScope, "No out-of-scope items captured yet."),
    "",
    plan.approved
      ? "The plan is approved, so the next step is to start the research phase."
      : "If this direction looks right, approve it. If not, edit or regenerate it before we start the research phase.",
    "",
    "## What I’d Do Next",
    plan.approved
      ? "Start researching each topic, using multiple queries per topic and collecting evidence before synthesis."
      : "Tighten the scope if needed, then approve the plan so research can begin.",
  ].join("\n");

  return {
    markdown,
    data: plan,
  };
};
