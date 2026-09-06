declare global {
  interface Window {
    supabase: {
      createClient(url: string, key: string, options?: Record<string, unknown>): any;
    };
  }
}
export {};
