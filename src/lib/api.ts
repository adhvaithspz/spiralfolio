/** Browser calls same-origin `/api` (Vite dev proxy or hosted reverse proxy → spiralfolio-api). */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const path = input.startsWith('/') ? input : `/${input}`;
  return fetch(path, {
    ...init,
    credentials: 'include',
  });
}
