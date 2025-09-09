// Netlify Function: Generate a thumbnail for a video by URL path under /public/video
// Requires Netlify Node runtime with ffmpeg available (use a build plugin or bundled binary)
// Env optional: THUMB_TIME (seconds)
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: 'Method Not Allowed' };
  try {
    const { videoPath } = JSON.parse(event.body || '{}');
    if (!videoPath || !videoPath.startsWith('/public/video/')) return { statusCode: 400, headers: cors(), body: 'Invalid videoPath' };
    const root = process.cwd();
    const absVideo = path.join(root, videoPath);
    if (!fs.existsSync(absVideo)) return { statusCode: 404, headers: cors(), body: 'Video not found' };
    const time = process.env.THUMB_TIME || '1';
    const base = absVideo.replace(path.extname(absVideo), '');
    const outPng = `${base}.png`;
    await runFfmpeg(['-y', '-ss', String(time), '-i', absVideo, '-frames:v', '1', '-vf', 'scale=640:-1', outPng]);
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ thumbnail: videoPath.replace(path.extname(videoPath), '.png') }) };
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: e.message || 'Error' };
  }
};

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve();
    });
  });
}

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' };
}


