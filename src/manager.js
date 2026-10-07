import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { dirname, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const MAX_LOG = 64000;
export function validateServices(input) {
  if (!Array.isArray(input) || input.length > 16) throw new Error('最多配置 16 个环境');
  const ids = new Set();
  return input.map((row) => {
    const id = String(row.id || randomUUID());
    if (ids.has(id)) throw new Error('环境 ID 重复');
    ids.add(id);
    const name = String(row.name || '').trim();
    const command = String(row.command || '').trim();
    if (!name || !command || command.length > 8192) throw new Error('请填写环境名称和启动命令（最多 8192 字）');
    const cwd = String(row.cwd || '.');
    const url = String(row.url || '').trim();
    if (url && !/^https?:\/\//.test(url)) throw new Error('访问地址须以 http:// 或 https:// 开头');
    return { id, name, command, cwd, url };
  });
}

export class LauncherManager {
  constructor(options = {}) {
    this.file = options.file || resolve(homedir(), '.dsh/session-launcher.json');
    this.runs = new Map();
    this.loading = null;
    this.saved = {};
    this.saveQueue = Promise.resolve();
    this.disposed = false;
  }
  async workspace(cwd) {
    if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new Error('工作区路径必须是绝对路径');
    const path = resolve(cwd);
    if (!(await stat(path)).isDirectory()) throw new Error('工作区目录不存在');
    return path;
  }
  async load() {
    if (!this.loading) this.loading = readFile(this.file, 'utf8').then((text) => { this.saved = JSON.parse(text); }).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await this.loading;
  }
  async config(cwd) {
    cwd = await this.workspace(cwd);
    await this.load();
    if (Object.hasOwn(this.saved, cwd)) return this.saved[cwd];
    try { return validateServices(JSON.parse(await readFile(resolve(cwd, '.dsh-launcher.json'), 'utf8')).services); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      const pkg = JSON.parse(await readFile(resolve(cwd, 'package.json'), 'utf8'));
      const scripts = pkg.scripts || {};
      const names = ['dev:backend', 'dev:server', 'dev:frontend', 'dev:client'].filter((key) => scripts[key]);
      if (!names.length) { const key = ['dev', 'start'].find((key) => scripts[key]); if (key) names.push(key); }
      const pm = pkg.packageManager?.split('@')[0] || 'npm';
      return names.map((key) => ({ id: key, name: key, command: `${['npm', 'pnpm', 'yarn', 'bun'].includes(pm) ? pm : 'npm'} run ${key}`, cwd: '.', url: '' }));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return [];
  }
  async save(cwd, services) {
    cwd = await this.workspace(cwd);
    services = validateServices(services);
    await this.load();
    this.saveQueue = this.saveQueue.catch(() => {}).then(async () => {
      const next = { ...this.saved, [cwd]: services };
      await mkdir(dirname(this.file), { recursive: true });
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(temp, this.file);
      this.saved = next;
    });
    await this.saveQueue;
    return services;
  }
  key(cwd, id) { return JSON.stringify([cwd, id]); }
  async ready(url) {
    if (!url) return false;
    try { const r = await fetch(url, { signal: AbortSignal.timeout(1200) }); await r.body?.cancel(); return r.ok; } catch { return false; }
  }
  async start(cwd, id) {
    if (this.disposed) throw new Error('启动器已关闭');
    cwd = await this.workspace(cwd);
    const services = await this.config(cwd);
    const service = services.find((s) => s.id === id);
    if (!service) throw new Error('环境配置不存在');
    const key = this.key(cwd, id);
    const previous = this.runs.get(key);
    if (previous?.child || previous?.starting) return;
    const run = { phase: 'starting', log: '', service, starting: true, child: null, exitCode: null };
    this.runs.set(key, run);
    try {
      if (service.url && await this.ready(service.url)) { run.phase = 'external'; return; }
      if (this.disposed) throw new Error('启动器已关闭');
      const workingDir = await this.workspace(resolve(cwd, service.cwd));
      const shell = process.platform === 'win32' ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/sh');
      const child = spawn(shell, process.platform === 'win32' ? ['/d', '/s', '/c', service.command] : ['-lc', service.command], {
        cwd: workingDir, env: { ...process.env, FORCE_COLOR: '0' }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']
      });
      run.child = child;
      run.phase = 'running';
      run.log = `$ ${service.command}\n目录：${workingDir}\n`;
      const append = (chunk) => { run.log = (run.log + chunk.toString()).slice(-MAX_LOG); };
      child.stdout.on('data', append); child.stderr.on('data', append);
      child.on('error', (error) => { run.log += `\n${error.message}`; run.phase = 'failed'; run.child = null; });
      child.on('exit', (code, signal) => {
        run.exitCode = code;
        run.phase = run.stopping ? 'stopped' : code === 0 ? 'exited' : 'failed';
        run.log = (run.log + `\n进程结束：${signal || code}\n`).slice(-MAX_LOG);
        run.child = null;
      });
    } catch (error) { run.phase = 'failed'; run.log += error.message; throw error; }
    finally { run.starting = false; }
  }
  async stop(cwd, id) {
    cwd = await this.workspace(cwd);
    const run = this.runs.get(this.key(cwd, id));
    if (!run?.child) return;
    const child = run.child;
    run.stopping = true;
    run.phase = 'stopping';
    const kill = (signal) => {
      try {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        else process.kill(-child.pid, signal);
      } catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    kill('SIGTERM');
    await new Promise((done) => {
      let timer;
      const finish = () => { clearTimeout(timer); child.off('exit', finish); done(); };
      child.once('exit', finish);
      timer = setTimeout(() => { kill('SIGKILL'); finish(); }, 3000);
      if (child.exitCode !== null || child.signalCode !== null) finish();
    });
  }
  async status(cwd) {
    cwd = await this.workspace(cwd);
    const services = await this.config(cwd);
    return Promise.all(services.map(async (s) => {
      const run = this.runs.get(this.key(cwd, s.id));
      const accessible = await this.ready(s.url);
      return { id: s.id, phase: run?.phase || (accessible ? 'external' : 'idle'), ready: accessible, pid: run?.child?.pid || null, exitCode: run?.exitCode ?? null };
    }));
  }
  async dispatch(body) {
    const cwd = await this.workspace(body.cwd);
    if (body.action === 'config') return { services: await this.config(cwd) };
    if (body.action === 'save') return { services: await this.save(cwd, body.services) };
    if (body.action === 'status') return { status: await this.status(cwd) };
    if (body.action === 'log') return { log: this.runs.get(this.key(cwd, body.id))?.log || '尚未启动；已在运行的外部服务没有启动器日志。' };
    if (['start', 'stop', 'startAll', 'stopAll'].includes(body.action)) {
      const ids = body.action.endsWith('All') ? (await this.config(cwd)).map((s) => s.id) : [body.id];
      const action = body.action.startsWith('start') ? 'start' : 'stop';
      const results = await Promise.allSettled(ids.map((id) => this[action](cwd, id)));
      return { errors: results.flatMap((result, index) => result.status === 'rejected' ? [`${ids[index]}: ${result.reason.message}`] : []), status: await this.status(cwd) };
    }
    throw new Error('未知操作');
  }
  async dispose() {
    this.disposed = true;
    await Promise.all([...this.runs.keys()].map((key) => { const [cwd, id] = JSON.parse(key); return this.stop(cwd, id).catch(() => {}); }));
  }
}
