import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LauncherManager, validateServices } from '../src/manager.js';

const waitFor = async (fn) => { const end = Date.now() + 6000; while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 50)); } throw new Error('timed out'); };
test('parallel startup, duplicate prevention, failure isolation, logs and process cleanup', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-launcher-test-'));
  const manager = new LauncherManager({ file: join(cwd, 'saved.json') });
  const services = [
    { id: 'frontend', name: 'Frontend', command: `node -e 'console.log("front ready");setInterval(()=>{},1000)'`, cwd: '.', url: '' },
    { id: 'backend', name: 'Backend', command: `node -e 'console.log("back ready");setInterval(()=>{},1000)'`, cwd: '.', url: '' },
    { id: 'bad', name: 'Failure', command: `node -e 'process.exit(7)'`, cwd: '.', url: '' }
  ];
  try {
    await manager.save(cwd, services);
    await manager.dispatch({ cwd, action: 'startAll' });
    await waitFor(async () => (await manager.status(cwd)).find((s) => s.id === 'bad').phase === 'failed');
    const status = await manager.status(cwd);
    assert.equal(status[0].phase, 'running'); assert.equal(status[1].phase, 'running'); assert.equal(status[2].exitCode, 7);
    const pid = status[0].pid;
    await Promise.all([manager.start(cwd, 'frontend'), manager.start(cwd, 'frontend')]);
    assert.equal((await manager.status(cwd))[0].pid, pid);
    await waitFor(() => manager.runs.get(manager.key(cwd, 'frontend')).log.includes('front ready'));
    await manager.dispatch({ cwd, action: 'stopAll' });
    assert.ok((await manager.status(cwd)).every((s) => !s.pid));
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    const reloaded = new LauncherManager({ file: join(cwd, 'saved.json') });
    assert.deepEqual(await reloaded.config(cwd), services);
  } finally { await manager.dispose(); }
});
test('workspace configuration, detection, validation and external service reuse', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-launcher-config-'));
  const manager = new LauncherManager({ file: join(cwd, 'saved.json') });
  await writeFile(join(cwd, 'package.json'), JSON.stringify({ scripts: { 'dev:frontend': 'vite', 'dev:backend': 'node server.js' }, packageManager: 'pnpm@10' }));
  assert.equal((await manager.config(cwd)).length, 2);
  await writeFile(join(cwd, '.dsh-launcher.json'), JSON.stringify({ services: [{ id: 'game', name: 'Game', command: 'exit 99', url: 'http://localhost:12345' }] }));
  manager.ready = async () => true;
  await manager.start(cwd, 'game');
  assert.equal((await manager.status(cwd))[0].phase, 'external');
  await manager.stop(cwd, 'game');
  assert.equal((await manager.status(cwd))[0].phase, 'external');
  assert.throws(() => validateServices([{ name: 'Bad', command: 'echo bad', url: 'javascript:alert(1)' }]));
  assert.throws(() => validateServices([{ name: '', command: 'x' }]));
});
