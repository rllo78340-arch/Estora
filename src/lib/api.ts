export async function apiFetch<T>(
  url: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  if (token) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string' && payload.error.length > 0
        ? payload.error
        : `Ошибка запроса (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}
