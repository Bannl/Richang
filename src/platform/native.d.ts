export interface RichangNative {
  platform: 'electron';
  readState(): Promise<string | null>;
  writeState(json: string): Promise<boolean>;
  exportState(json: string): Promise<boolean>;
  importState(): Promise<string | null>;
}
declare global {
  interface Window { richangNative?: RichangNative }
}
export {};
