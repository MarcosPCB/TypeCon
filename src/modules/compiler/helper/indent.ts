export function indent(text: string, level: number): string {
  const pad = "  ".repeat(level);
  return text
    .split("\n")
    .map(line => (line.trim() ? pad + line : line))
    .join("\n");
}
