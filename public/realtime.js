export function connectGameUpdates(ioFactory, onChange) {
  if (typeof ioFactory !== 'function') return null;
  const socket = ioFactory({ reconnection: true });
  socket.on('connect', onChange);
  socket.on('game:changed', onChange);
  return socket;
}
