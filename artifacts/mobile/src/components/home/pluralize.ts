export function pluralize(
  value: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${value} ${value === 1 ? singular : plural}`;
}
