export const stripJsonCodeFences = (raw: string): string => {
  return raw.replace(/^```json\s*|^```\s*|```$/gim, "").trim();
};
