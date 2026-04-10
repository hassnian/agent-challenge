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

export const createDefaultResearchPlan = (
  question: string
): ResearchPlanData => {
  return {
    question,
    goal: "Create a research plan the user can review before any deep research starts.",
    topics: [
      {
        id: "topic-1",
        title: "Clarify the core question",
        reason: "Make sure the question is specific enough for useful research.",
        searchQueries: [
          question,
          `${question} beginner perspective`,
          `${question} overview`,
        ],
        priority: "high",
      },
      {
        id: "topic-2",
        title: "Identify the most important subtopics",
        reason: "Break the problem into smaller areas that can be researched separately.",
        searchQueries: [
          `${question} subtopics`,
          `${question} framework`,
          `${question} dimensions`,
        ],
        priority: "high",
      },
      {
        id: "topic-3",
        title: "Find the biggest uncertainties",
        reason: "Expose where more evidence or clarification is needed before researching deeply.",
        searchQueries: [
          `${question} open questions`,
          `${question} risks`,
          `${question} unknowns`,
        ],
        priority: "medium",
      },
    ],
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
