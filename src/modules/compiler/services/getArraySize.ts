export function getArraySize(initText: string): number {
    // Example: if initializer is Array(4) then return 4.
    const match = initText.match(/Array\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }