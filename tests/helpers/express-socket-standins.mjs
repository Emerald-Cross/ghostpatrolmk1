import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

export function createExpressStandin() {
  const layers = [];
  const express = () => {
    const app = (req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname;
      res.status = code => { res.statusCode = code; return res; };
      res.type = type => { res.setHeader('Content-Type', type); return res; };
      res.send = body => res.end(body);
      let index = 0;
      const next = error => {
        if (error) { res.statusCode = 500; return res.end('stand-in error'); }
        const layer = layers[index++];
        if (!layer) { res.statusCode = 404; return res.end('not found'); }
        if (layer.path && (layer.path !== path || (layer.method !== 'ALL' && layer.method !== req.method))) return next();
        try {
          const result = layer.handler(req, res, next);
          result?.catch?.(next);
          return result;
        } catch (caught) { return next(caught); }
      };
      return next();
    };
    app.get = (path, handler) => layers.push({ method: 'GET', path, handler });
    app.all = (path, handler) => layers.push({ method: 'ALL', path, handler });
    app.use = handler => layers.push({ handler });
    app.disable = () => app;
    return app;
  };
  express.static = (directory, { index = 'index.html' } = {}) => async (req, res, next) => {
    try {
      const root = resolve(directory);
      let target = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
      if (target !== root && !target.startsWith(root + sep)) return next();
      if ((await stat(target)).isDirectory()) target = resolve(target, index);
      if (!(await stat(target)).isFile()) return next();
      res.setHeader('Content-Type', mime[extname(target)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.end(await readFile(target));
    } catch { next(); }
  };
  return express;
}

export class SocketIOServerStandin {
  constructor(server, options) { this.server = server; this.options = options; this.handlers = {}; this.events = []; SocketIOServerStandin.instance = this; }
  on(name, handler) { this.handlers[name] = handler; }
  emit(name, ...args) { this.events.push({ name, args }); }
}
