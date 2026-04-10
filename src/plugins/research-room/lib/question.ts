export const extractResearchQuestion = (text: string): string => {
  const trimmed = text.trim();

  if (!trimmed) {
    return "What should I research next?";
  }

  const cleaned = trimmed
    .replace(
      /^(please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:help\s+me\s+)?(?:research|investigate|look\s+into|find\s+out\s+about)\s+/i,
      ""
    )
    .replace(/[?]+$/, "")
    .trim();

  return cleaned || trimmed;
};
