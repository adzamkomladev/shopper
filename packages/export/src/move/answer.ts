/** The cloud's answer, or its own words as the failure the owner reads. */
export async function answer<T>(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    const message = (JSON.parse(text || "{}") as { error?: string }).error;
    throw new Error(message ?? `The cloud answered ${response.status}.`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
