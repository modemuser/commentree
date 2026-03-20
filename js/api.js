const ALGOLIA_API = 'https://hn.algolia.com/api/v1/items';

export async function fetchThread(id) {
  const res = await fetch(`${ALGOLIA_API}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch thread ${id}: ${res.status}`);
  return res.json();
}
