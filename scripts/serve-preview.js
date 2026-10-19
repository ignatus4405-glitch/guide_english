#!/usr/bin/env node
/**
 * Лёгкий статический сервер для просмотра интерфейса в браузере без Electron.
 * Приложение работает в «веб-режиме»: прогресс хранится в localStorage, автообновление отключено.
 *
 * Запуск: npm run preview  →  http://localhost:5173
 * Порт можно переопределить: PORT=8080 npm run preview
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/renderer/index.html';

  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }).end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Guide English preview: http://${HOST}:${PORT}`);
  console.log('Веб-режим: прогресс в localStorage, автообновления только в установленной версии.');
});
