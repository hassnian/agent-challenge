import type { ResearchTopic } from "./plan";

export const buildTopicResearchPrompt = (
  question: string,
  topic: ResearchTopic,
  evidenceContext: string
): string => {
  return `
You are the Researcher in a research room.

Question: ${question}

Topic: ${topic.title}
Why this topic matters: ${topic.reason}

Search queries to investigate:
${topic.searchQueries.map((query) => `- ${query}`).join("\n")}

Real search evidence gathered for this topic:
${evidenceContext}

Return valid JSON only with this exact shape:
{
  "summary": "short summary of what this topic suggests",
  "findings": [
    {
      "claim": "finding 1",
      "support": "why this seems true based on the current research pass",
      "confidence": "medium",
      "evidenceRefs": [1]
    }
  ],
  "openQuestions": ["question 1", "question 2"],
  "followUpQueries": ["query 1", "query 2"]
}

Rules:
- Do not wrap the JSON in markdown fences
- Keep findings concise and practical
- Each finding should be a concrete claim, not a paragraph
- Confidence must be one of: high, medium, low
- Use the evidence above instead of inventing support
- Cite evidence with numbered "evidenceRefs" that match the evidence list above
- Do not cite evidence numbers that do not exist
- If evidence exists, every medium- or high-confidence finding should cite at least one evidence reference
- If evidence is weak or missing, say so plainly and keep confidence low
- Focus on what this topic suggests, not the whole question
- If you are unsure, still return valid JSON
`.trim();
};

export const buildSkepticPrompt = (
  question: string,
  topicResearch: string
): string => {
  return `
You are the Skeptic in a research room.

Question: ${question}

Topic research produced:
${topicResearch}

Return valid JSON only with this exact shape:
{
  "summary": "short skeptical summary",
  "challenges": [
    {
      "topicId": "topic-1",
      "claim": "claim to challenge",
      "concern": "why this claim is weak, unsupported, or incomplete",
      "severity": "high"
    }
  ],
  "missingEvidence": ["missing evidence 1", "missing evidence 2"],
  "followUpQueries": ["query 1", "query 2"]
}

Rules:
- Do not wrap the JSON in markdown fences
- Focus on weak support, vague reasoning, contradictions, and missing evidence
- Pay special attention to findings that have no evidence references or weak evidence references
- Severity must be one of: high, medium, low
- If the research is strong, still note what could most improve confidence
`.trim();
};

export const buildSynthesizerPrompt = (
  question: string,
  topicResearch: string,
  skepticOutput: string
): string => {
  return `
You are the Synthesizer in a research room.

Question: ${question}

Topic research notes:
${topicResearch}

Skeptic notes:
${skepticOutput}

Return valid JSON only with this exact shape:
{
  "answer": "short direct answer",
  "summary": "detailed executive summary in 2-4 short paragraphs",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "contestedPoints": ["point 1", "point 2"],
  "openQuestions": ["question 1", "question 2"]
}

Rules:
- Do not wrap the JSON in markdown fences
- Keep the answer direct, but make the summary meaningfully more detailed than a one-liner
- The summary should read like an executive brief: synthesize the strongest supported findings, the main caveats, and the practical implication or bottom line
- Target roughly 120-220 words for the summary unless the evidence is too thin to support that much detail
- Use 2-4 short paragraphs for the summary, not a single sentence
- Each array should contain short strings
- Use the skeptic notes to keep contested claims out of the final answer unless uncertainty is explicit
`.trim();
};
