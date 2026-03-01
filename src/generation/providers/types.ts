export interface GenerationProvider {
  generate(prompt: string): Promise<string>;
  generateStream(prompt: string, onChunk: (delta: string) => void): Promise<string>;
}
