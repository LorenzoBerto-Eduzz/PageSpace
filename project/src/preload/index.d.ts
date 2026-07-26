declare global {
  interface Window {
    pageMaker: Readonly<Record<string, never>>
  }
}
