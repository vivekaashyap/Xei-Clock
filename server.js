const fs = require('fs');
const http = require('http');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store'
  });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      send(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = types[ext] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        send(res, 416, 'Range not satisfiable');
        return;
      }

      let start;
      let end;
      if (!match[1] && match[2]) {
        const suffixLength = Number(match[2]);
        start = Math.max(stat.size - suffixLength, 0);
        end = stat.size - 1;
      } else {
        start = match[1] ? Number(match[1]) : 0;
        end = match[2] ? Number(match[2]) : stat.size - 1;
      }
      if (start >= stat.size || end >= stat.size || start > end) {
        res.writeHead(416, {
          'Content-Range': `bytes */${stat.size}`
        });
        res.end();
        return;
      }

      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': type,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(port, () => {
  console.log(`FocusForest running on http://localhost:${port}`);
});
