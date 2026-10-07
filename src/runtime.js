import { LauncherManager } from './manager.js';
export const name = 'dsh-session-launcher';
export const inject = ['connection'];
export function apply(ctx) {
  const manager = new LauncherManager();
  ctx.connection.fetch.register({
    path: '/api/session-launcher', methods: ['POST'], requestBody: 'buffered',
    fetch: async (request) => {
      // Connection admits only authenticated requests within its Host/Origin fence.
      try {
        return Response.json({ ok: true, ...await manager.dispatch(await request.json()) });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }
  });
  ctx.effect(() => () => manager.dispose());
}
