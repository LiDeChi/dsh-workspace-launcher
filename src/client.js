// Older desktop module rosters may retain the prototype package until restart.
window.__ModuleLoader__.load({ id: 'dsh-session-launcher', factory: () => ({ name: 'session-launcher-compat', apply() {} }) });
window.__ModuleLoader__.load({
  id: 'dsh-workspace-launcher',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;
    const labels = { idle: '未启动', starting: '启动中', running: '运行中', external: '已在运行', stopping: '停止中', stopped: '已停止', exited: '已结束', failed: '失败' };
    const css = `
      /* The entry is a compact split button that lives inside the session header
         row itself — never a bar of its own. The leading seat carries it while a
         blank session shows its hero (that header has no title chrome at all),
         the utilities seat carries it once the title row is up. */
      .dsl-launcher{display:flex;align-items:center;gap:6px;min-width:0;flex-shrink:0;font-size:12px;-webkit-app-region:no-drag;color:var(--dsw-alias-label-primary)}
      .dsl-launcher.dsl-lead{padding:0}
      .dsl-entry{display:inline-flex;align-items:stretch;flex-shrink:0;border:1px solid var(--dsw-alias-border-l3,#555);border-radius:8px;background:var(--dsw-alias-bg-layer-1,transparent);overflow:hidden}
      .dsl-entry button,.dsl-launcher>button{font:inherit;color:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;white-space:nowrap;border:0;background:transparent}
      .dsl-launcher>button{border:1px solid var(--dsw-alias-border-l3,#555);border-radius:8px;padding:0 10px}
      .dsl-entry button:disabled,.dsl-launcher>button:disabled{opacity:.45;cursor:default}
      .dsl-entry button:hover:not(:disabled),.dsl-launcher>button:hover:not(:disabled){background:rgba(128,128,128,.16)}
      .dsl-entry .dsl-more{border-left:1px solid var(--dsw-alias-border-l3,#555);padding:0 6px;opacity:.75}
      .dsl-entry .dsl-more:hover{opacity:1}
      .dsl-glyph{font-size:10px;line-height:1}
      .dsl-glyph.play{color:#3eab74}
      .dsl-glyph.stop{color:#d45c5c}
      .dsl-menu{position:fixed;z-index:10000;min-width:238px;max-width:min(360px,92vw);padding:6px;font-size:12px;color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#232327));border:1px solid var(--dsw-alias-border-l3,#555);border-radius:10px;box-shadow:0 14px 44px rgba(0,0,0,.38);-webkit-app-region:no-drag}
      .dsl-menu-head{padding:4px 8px 6px;font-size:11px;opacity:.55}
      .dsl-item{display:flex;align-items:center;border-radius:6px}
      .dsl-item:hover{background:rgba(128,128,128,.16)}
      .dsl-item-main{flex:1;display:flex;align-items:center;gap:7px;min-width:0;padding:7px 8px;font:inherit;color:inherit;text-align:left;cursor:pointer;border:0;background:transparent}
      .dsl-item-main:disabled{cursor:default;opacity:.6}
      .dsl-item-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dsl-item-state{margin-left:auto;padding-left:8px;font-size:11px;opacity:.6;white-space:nowrap}
      .dsl-icon{display:inline-flex;align-items:center;justify-content:center;padding:6px 7px;font:inherit;color:inherit;text-decoration:none;cursor:pointer;opacity:.65;border:0;border-radius:6px;background:transparent}
      .dsl-icon:hover{opacity:1;background:rgba(128,128,128,.22)}
      .dsl-sep{height:1px;margin:5px 4px;background:var(--dsw-alias-border-l3,#555);opacity:.6}
      .dsl-row{display:flex;width:100%;align-items:center;gap:7px;padding:7px 8px;font:inherit;color:inherit;text-align:left;cursor:pointer;border:0;border-radius:6px;background:transparent}
      .dsl-row:hover{background:rgba(128,128,128,.16)}
      .dsl-row:disabled{cursor:default;opacity:.6}
      .dsl-dot{width:6px;height:6px;border-radius:50%;background:#999;flex-shrink:0}
      .dsl-dot.ready{background:#3eab74}
      .dsl-dot.failed{background:#d45c5c}
      .dsl-error{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d45c5c}
      .dsl-overlay{position:fixed;inset:0;background:#0007;z-index:9999;display:flex;align-items:center;justify-content:center;-webkit-app-region:no-drag}
      .dsl-dialog{color:var(--dsw-alias-label-primary,#ddd);background:var(--dsw-alias-bg-layer-1,#202124);border:1px solid var(--dsw-alias-border-l3,#555);border-radius:12px;box-shadow:0 16px 60px #0005;width:min(820px,92vw);max-height:85vh;overflow:auto;padding:22px;font-size:13px}
      .dsl-dialog h3{margin:0 0 12px}.dsl-dialog p{opacity:.75}.dsl-dialog label{display:flex;flex-direction:column;gap:4px;min-width:0}
      .dsl-dialog button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l3,#555);border-radius:6px;background:var(--dsw-alias-bg-layer-1,transparent);padding:5px 8px}
      .dsl-dialog button:disabled{opacity:.45;cursor:default}
      .dsl-dialog .dsl-primary{background:#317756;color:white;border-color:#317756}
      .dsl-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l3,#555)}
      .dsl-form .dsl-wide{grid-column:1/-1}
      .dsl-dialog input,.dsl-dialog textarea{box-sizing:border-box;width:100%;font:inherit;padding:8px;border:1px solid var(--dsw-alias-border-l3,#555);border-radius:6px;color:inherit;background:var(--dsw-alias-bg-l1,#111)}
      .dsl-dialog textarea{font-family:monospace;resize:vertical;min-height:58px}
      .dsl-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
      .dsl-dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;max-height:56vh;overflow:auto;background:#111;color:#ddd;padding:12px;border-radius:6px}
      @media(max-width:600px){.dsl-form{grid-template-columns:1fr}.dsl-dialog{padding:14px}}
    `;
    async function api(cwd, action, extra = {}) {
      const response = await fetch('/api/session-launcher', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd, action, ...extra }) });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { throw new Error(`启动器请求失败 (${response.status})：${text.slice(0, 120)}`); }
      if (!response.ok || !result.ok) throw new Error(result.error || `请求失败 (${response.status})`);
      return result;
    }
    /**
     * The session the main view is showing. Root-scoped seats receive no
     * sessionId, and the launcher must render on a blank session too — so the
     * workspace comes from the session the conversation is currently retaining,
     * the same `retainedBy.mainView` signal `ui-session` uses for `isMain`.
     */
    function activeRow(list) {
      if (list === undefined) return undefined;
      let fallback;
      for (const id of Object.keys(list.byId)) {
        const row = list.byId[id];
        if (row === undefined || row.origin === 'subagent') continue;
        if ((row.retainedBy?.mainView ?? 0) > 0) return row;
        if (fallback === undefined && row.cwd !== undefined) fallback = row;
      }
      return fallback;
    }
    /** Blank means the shipped session header hides its title row — the leading seat must cover it. */
    function activeBlank(list) {
      const row = activeRow(list);
      return row === undefined ? true : row.blank === true;
    }
    function Launcher({ sessionId, useSessions, useLauncherSessions, mode }) {
      const useList = useSessions ?? useLauncherSessions;
      const cwd = useList === undefined ? undefined : useList((s) => sessionId === undefined ? activeRow(s)?.cwd : s.byId[sessionId]?.cwd);
      const blank = useList === undefined ? true : useList((s) => activeBlank(s));
      // Only one of the two seats may show the entry: the leading one covers the
      // blank/hero state, the utilities one covers the session that has chrome.
      const visible = mode === 'lead' ? blank : !blank;
      const [services, setServices] = useState([]);
      const [status, setStatus] = useState([]);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [loaded, setLoaded] = useState(false);
      const [draft, setDraft] = useState(null);
      const [log, setLog] = useState(null);
      const [menu, setMenu] = useState(null);
      const entry = useRef(null);
      const scope = useRef(cwd); scope.current = cwd;
      useEffect(() => {
        let live = true, pending = false;
        setServices([]); setStatus([]); setDraft(null); setLog(null); setMenu(null); setError(''); setBusy(false); setLoaded(false);
        if (!cwd) return;
        api(cwd, 'config').then((result) => { if (live) { setServices(result.services); setLoaded(true); } }).catch((e) => { if (live) setError(e.message); });
        const refresh = async () => {
          if (pending) return; pending = true;
          try {
            const result = await api(cwd, 'status');
            if (live) setStatus(result.status);
          } catch (e) { if (live) setError(e.message); }
          finally { pending = false; }
        };
        refresh(); const timer = setInterval(refresh, 4000);
        return () => { live = false; clearInterval(timer); };
      }, [cwd]);
      useEffect(() => {
        if (!draft && !log) return;
        const escape = (event) => { if (event.key === 'Escape') { setDraft(null); setLog(null); } };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
      }, [draft, log]);
      useEffect(() => {
        if (!menu) return;
        const away = (event) => { if (!entry.current?.contains(event.target)) setMenu(null); };
        const key = (event) => { if (event.key === 'Escape') setMenu(null); };
        const dismiss = () => setMenu(null);
        document.addEventListener('pointerdown', away, true);
        document.addEventListener('keydown', key);
        window.addEventListener('resize', dismiss);
        window.addEventListener('scroll', dismiss, true);
        return () => {
          document.removeEventListener('pointerdown', away, true);
          document.removeEventListener('keydown', key);
          window.removeEventListener('resize', dismiss);
          window.removeEventListener('scroll', dismiss, true);
        };
      }, [menu]);
      const act = async (action, extra = {}) => {
        if (busy) return;
        const source = cwd; setBusy(true); setError('');
        try {
          const result = await api(source, action, extra);
          if (scope.current !== source) return;
          if (result.status) setStatus(result.status);
          if (result.errors?.length) setError(result.errors.join('；'));
          if (action === 'save') { setServices(result.services); setDraft(null); }
          if (action === 'log') setLog({ id: extra.id, name: services.find((s) => s.id === extra.id)?.name, text: result.log });
        } catch (e) { if (scope.current === source) setError(e.message); }
        finally { if (scope.current === source) setBusy(false); }
      };
      const run = (action, extra) => { setMenu(null); return act(action, extra); };
      useEffect(() => {
        if (!log) return;
        let live = true;
        const timer = setInterval(() => api(cwd, 'log', { id: log.id }).then((result) => { if (live) setLog((current) => current && { ...current, text: result.log }); }).catch(() => {}), 2000);
        return () => { live = false; clearInterval(timer); };
      }, [cwd, log?.id]);
      if (!cwd || !visible) return null;
      const button = (text, onClick, props = {}) => h('button', { type: 'button', onClick, disabled: busy, ...props }, text);
      const newRow = () => ({ id: crypto.randomUUID(), name: '', command: '', cwd: '.', url: '' });
      const editRow = (index, key, value) => setDraft((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
      const field = (row, index, key, label, wide = false) => h('label', { className: wide ? 'dsl-wide' : '' }, label,
        h(key === 'command' ? 'textarea' : 'input', { value: row[key], 'aria-label': `${label} ${index + 1}`, onChange: (event) => editRow(index, key, event.target.value), placeholder: key === 'cwd' ? '.' : key === 'url' ? 'http://localhost:3000' : undefined }));
      const statuses = new Map(status.map((s) => [s.id, s]));
      const live = (state) => ['running', 'starting', 'stopping'].includes(state.phase);
      const anyActive = status.some(live);
      const unconfigured = loaded && services.length === 0;
      const openMenu = (event) => {
        if (menu) { setMenu(null); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        setMenu({ top: Math.round(rect.bottom + 6), right: Math.round(Math.max(8, window.innerWidth - rect.right)) });
      };
      const dialog = draft ? h('div', { className: 'dsl-overlay', onClick: (event) => { if (event.target === event.currentTarget) setDraft(null); } },
        h('section', { className: 'dsl-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '配置启动命令' },
          h('h3', null, '配置启动命令'), h('p', null, '按工作区保存。每条命令独立运行；“启动”一次拉起全部环境。目录可以填写相对工作区的路径。'),
          h('p', null, cwd),
          draft.map((row, i) => h('div', { className: 'dsl-form', key: row.id }, field(row, i, 'name', '环境名称'), field(row, i, 'cwd', '运行目录'), field(row, i, 'command', '启动命令', true), field(row, i, 'url', '访问地址', true), button('删除环境', () => setDraft((rows) => rows.filter((_, j) => j !== i))))),
          h('div', { className: 'dsl-footer' }, button('添加环境', () => setDraft((rows) => [...rows, newRow()]), { disabled: busy || draft.length >= 16 }), button('取消', () => setDraft(null)), button('保存', () => act('save', { services: draft }), { className: 'dsl-primary' })),
          error && h('p', { className: 'dsl-error', role: 'alert' }, error)
        )) : log ? h('div', { className: 'dsl-overlay', onClick: (event) => { if (event.target === event.currentTarget) setLog(null); } },
          h('section', { className: 'dsl-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': '环境日志' }, h('h3', null, `${log.name || '环境'} · 日志`), h('pre', null, log.text), h('div', { className: 'dsl-footer' }, button('刷新日志', () => act('log', { id: log.id })), button('关闭', () => setLog(null))))) : null;
      const menuNode = menu && h('div', { className: 'dsl-menu', role: 'menu', style: { top: menu.top, right: menu.right } },
        h('div', { className: 'dsl-menu-head' }, services.length === 1 ? '选择启动命令' : `选择启动命令 · ${services.length} 个环境`),
        services.map((service) => {
          const state = statuses.get(service.id) || { phase: 'idle' };
          const running = live(state);
          return h('div', { className: 'dsl-item', key: service.id },
            h('button', { type: 'button', role: 'menuitem', className: 'dsl-item-main', disabled: busy, title: service.command, onClick: () => run(running ? 'stop' : 'start', { id: service.id }) },
              h('span', { className: `dsl-dot ${state.ready ? 'ready' : state.phase === 'failed' ? 'failed' : ''}` }),
              h('span', { className: 'dsl-item-name' }, service.name),
              h('span', { className: 'dsl-item-state' }, state.ready ? '可访问' : labels[state.phase])),
            service.url ? h('a', { className: 'dsl-icon', href: service.url, target: '_blank', rel: 'noopener noreferrer', title: service.url, 'aria-label': `打开 ${service.name}` }, '↗') : null,
            h('button', { type: 'button', className: 'dsl-icon', title: '查看日志', 'aria-label': `查看 ${service.name} 的日志`, onClick: () => run('log', { id: service.id }) }, '☰')
          );
        }),
        h('div', { className: 'dsl-sep' }),
        h('button', { type: 'button', role: 'menuitem', className: 'dsl-row', disabled: busy, onClick: () => run('startAll') }, '▶ 全部启动'),
        anyActive ? h('button', { type: 'button', role: 'menuitem', className: 'dsl-row', disabled: busy, onClick: () => run('stopAll') }, '■ 停止全部') : null,
        h('button', { type: 'button', role: 'menuitem', className: 'dsl-row', disabled: busy, onClick: () => { setMenu(null); setDraft(services.map((s) => ({ ...s }))); } }, '⚙ 配置命令')
      );
      return h('div', { className: mode === 'lead' ? 'dsl-launcher dsl-lead' : 'dsl-launcher', 'data-session-launcher': true, ref: entry },
        unconfigured
          ? button('配置启动命令', () => setDraft([newRow()]), { title: '这个工作区还没有启动命令' })
          : h('div', { className: 'dsl-entry' },
            button(h(React.Fragment, null, h('span', { className: `dsl-glyph ${anyActive ? 'stop' : 'play'}` }, anyActive ? '■' : '▶'), anyActive ? '停止' : '启动'),
              () => run(anyActive ? 'stopAll' : 'startAll'),
              { className: 'dsl-main', disabled: busy || !loaded, title: anyActive ? '停止全部环境' : '启动全部环境' }),
            button(h('span', { className: 'dsl-glyph' }, '▾'), openMenu, { className: 'dsl-more', 'aria-label': '选择启动命令', 'aria-haspopup': 'menu', 'aria-expanded': menu !== null })
          ),
        menuNode,
        error && h('span', { className: 'dsl-error', role: 'alert', title: error }, error),
        dialog
      );
    }
    return {
      name: 'dsh-session-launcher', inject: ['slots', 'sessions'],
      apply(ctx) {
        const style = document.createElement('style'); style.textContent = css; document.head.append(style);
        ctx.effect(() => () => style.remove());
        const shared = () => ({ hooks: { launcherSessions: ctx.sessions.list } });
        // Blank/hero sessions: the leading seat is the only header hole that renders.
        ctx.slots.inject('conversation.header.leading', () => ctx.slots.register({
          name: 'conversation.header.leading',
          inject: shared
        }, (props) => h(Launcher, { ...props, mode: 'lead' })));
        // Sessions with title chrome: this seat is not rendered at all while blank.
        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities', id: 'session-launcher',
          inject: shared
        }, (props) => h(Launcher, { ...props, mode: 'inline' })));
      }
    };
  }
});
