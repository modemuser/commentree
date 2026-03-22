const ALGOLIA_API = 'https://hn.algolia.com/api/v1';

export async function fetchThread(id) {
  const res = await fetch(`${ALGOLIA_API}/items/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch thread ${id}: ${res.status}`);
  return res.json();
}

export async function fetchFrontPage() {
  const res = await fetch(`${ALGOLIA_API}/search?tags=front_page&hitsPerPage=30`);
  if (!res.ok) throw new Error(`Failed to fetch front page: ${res.status}`);
  const data = await res.json();
  return data.hits;
}
