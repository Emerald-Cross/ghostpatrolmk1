import { resolve } from 'node:path';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { createConfiguredHandler } from './api/game.js';
import { createRenderServer } from './lib/render-server.mjs';

let runtime;
const handler = createConfiguredHandler({ onState: state => runtime?.notifyStateChange(state) });
runtime = createRenderServer({ express, SocketServer, handler, staticDir: resolve('dist') });

const port = Number(process.env.PORT || 3000);
runtime.server.listen(port, '0.0.0.0', () => console.log(`Ghost Patrol listening on ${port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => runtime.server.close(() => process.exit(0)));
}
