const DEFAULT_BASE_URL = import.meta.env.VITE_AI_BASE_URL || '/api';

const postJson = async (path, body) => {
  const res = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `AI backend error (${res.status})`);
  }

  return res.json();
};

const getJson = async (path) => {
  const res = await fetch(`${DEFAULT_BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `AI backend error (${res.status})`);
  }
  return res.json();
};

const deleteJson = async (path) => {
  const res = await fetch(`${DEFAULT_BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `AI backend error (${res.status})`);
  }
  return res.json();
};

export const AIClient = {
  generateDrums: (payload) => postJson('/generate/drums', payload),
  generateBassline: (payload) => postJson('/generate/bassline', payload),
  generateMelody: (payload) => postJson('/generate/melody', payload),
  generateChords: (payload) => postJson('/generate/chords', payload),
  generateArrangement: (payload) => postJson('/generate/arrangement', payload),
  pulseChat: (payload) => postJson('/pulse/chat', payload),
  getGenerationCount: (userId = 'local-user') => getJson(`/stats/generations?user_id=${encodeURIComponent(userId)}`),
  savePatternRemote: (payload) => postJson('/patterns', payload),
  listPatternsRemote: (userId = 'local-user') => getJson(`/patterns?user_id=${encodeURIComponent(userId)}`),
  deletePatternRemote: (patternId, userId = 'local-user') => deleteJson(`/patterns/${encodeURIComponent(patternId)}?user_id=${encodeURIComponent(userId)}`)
};
