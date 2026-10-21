import http from 'node:http';

export function createRenderServer({ express, SocketServer, handler, staticDir }) {
  const app = express();
  app.disable?.('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));
  app.all('/api/game', handler);
  app.use(express.static(staticDir, { index: 'index.html', etag: true, maxAge: '1h' }));

  const server = http.createServer(app);
  const io = new SocketServer(server, { serveClient: true, pingInterval: 20000, pingTimeout: 20000 });
  io.on('connection', socket => socket.emit('ready'));

  let lastPublicState = '';
  return {
    app,
    server,
    io,
    notifyStateChange(publicState) {
      // Ignore serverNow so polling itself does not create a feedback loop.
      const { serverNow: _serverNow, ...stableState } = publicState;
      const snapshot = JSON.stringify(stableState);
      if (snapshot === lastPublicState) return;
      lastPublicState = snapshot;
      io.emit('game:changed');
    }
  };
}
