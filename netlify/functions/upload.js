// Netlify Function: Persist uploads into GitHub repository
// Env vars required:
// - GITHUB_TOKEN: PAT with repo scope
// - GITHUB_REPO: e.g. "justinraymondpark/snowglobe"
// - GITHUB_BRANCH: e.g. "main"

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }
  try {
    const { path, contentType, dataBase64, message } = JSON.parse(event.body || '{}');
    if (!path || !dataBase64) {
      return { statusCode: 400, headers: corsHeaders(), body: 'Missing path or dataBase64' };
    }
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    if (!token || !repo) {
      return { statusCode: 500, headers: corsHeaders(), body: 'Server not configured' };
    }

    // Get existing file SHA if exists
    const apiBase = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
    let sha = undefined;
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' },
    });
    if (getRes.status === 200) {
      const j = await getRes.json();
      sha = j.sha;
    }

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message || `chore(upload): ${path}`,
        content: dataBase64,
        branch,
        sha,
      }),
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      return { statusCode: putRes.status, headers: corsHeaders(), body: text };
    }
    const resp = await putRes.json();
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(resp) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(), body: e.message || 'Error' };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}


