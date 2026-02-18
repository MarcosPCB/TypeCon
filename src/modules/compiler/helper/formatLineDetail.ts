export function formatLineDetail(text: string, prefix: string = ''): string {
    const lines = text.split('\n');
    return lines.map(line => `// ${prefix}${line.trim()}`).join('\n') + '\n';
}
