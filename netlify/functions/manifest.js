// Netlify Function: regenerate manifests from public folders
// Requires Node 18+ runtime with fs access to site bundle
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' };
  }
  try {
    const root = process.cwd();
    const publicDir = path.join(root, 'public');
    const pngDir = path.join(publicDir, 'png');
    const videoDir = path.join(publicDir, 'video');
    ensureDir(pngDir); ensureDir(videoDir);
    const pngs = listFiles(pngDir, ['.png']).map((f) => `/public/png/${f}`);
    const videos = listFiles(videoDir, ['.mp4', '.mov', '.webm', '.m4v', '.ogg', '.ogv', '.avi', '.mkv']).map((f) => `/public/video/${f}`);
    fs.writeFileSync(path.join(pngDir, '_manifest.json'), JSON.stringify({ files: pngs }, null, 2));
    fs.writeFileSync(path.join(videoDir, '_manifest.json'), JSON.stringify({ files: videos }, null, 2));
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ pngs: pngs.length, videos: videos.length }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(), body: e.message || 'Error' };
  }
};

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function listFiles(dir, exts) { return fs.readdirSync(dir).filter(f => exts.includes(path.extname(f).toLowerCase())); }
function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' }; }


