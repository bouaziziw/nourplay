export interface FetchResult {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

export interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
}

// Typage explicite : le builder Vercel (@vercel/node) vérifie les types avec ses propres
// définitions Node, où la Response globale de fetch n'expose pas ok/json/text.
export function safeFetch(input: string | URL, init?: FetchOptions): Promise<FetchResult> {
  return fetch(input as never, init as never) as unknown as Promise<FetchResult>
}
