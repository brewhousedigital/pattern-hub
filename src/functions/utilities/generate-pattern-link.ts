export const generatePatternLink = (patternId: string) => {
  return `/pattern?id=%5B%22${patternId}%22%5D&patternId=${patternId}`;
};
