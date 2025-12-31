import React, { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import NodeCard from "./NodeCard";
import Login from "./Login";
import "./App.css";

export default function App() {
  const [workflow, setWorkflow] = useState(null);
  const [autoEditRoot, setAutoEditRoot] = useState(false);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);

  const createStart = () => {
    const newNode = {
      id: nanoid(),
      type: "action",
      label: "",
      children: []
    };
    setWorkflow(newNode);
    setAutoEditRoot(true);
    setCurrentHistoryId(null);
  };

  // history helpers (localStorage)
  const HISTORY_KEY = 'workflowHistory_v1';

  // Clean a node tree by removing `parent` references to make it JSON-serializable
  const cleanNode = (node, seen = new Map()) => {
    if (!node || typeof node !== 'object') return node;
    if (seen.has(node)) return seen.get(node);
    const out = Array.isArray(node) ? [] : {};
    seen.set(node, out);
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const val = node[key];
      if (key === 'children' && Array.isArray(val)) {
        out.children = val.map(c => cleanNode(c, seen));
        continue;
      }
      if (key === 'branches' && val && typeof val === 'object') {
        out.branches = {};
        for (const k of Object.keys(val)) {
          out.branches[k] = val[k] ? cleanNode(val[k], seen) : null;
        }
        continue;
      }
      out[key] = cleanNode(val, seen);
    }
    return out;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }, []);

  const persistHistory = (next) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  };

  const saveCurrentToHistory = async () => {
    if (!workflow) return alert('No workflow to save');
    let name = window.prompt('Name for this workflow', workflow.name || ('Workflow ' + new Date().toLocaleString()));
    if (name == null) return; // cancelled
    const item = {
      id: currentHistoryId || nanoid(),
      name: name.trim() || ('Workflow ' + new Date().toLocaleString()),
      data: cleanNode(workflow),
      updatedAt: Date.now(),
    };
    let next;
    if (currentHistoryId) {
      next = history.map(h => h.id === currentHistoryId ? item : h);
    } else {
      next = [item, ...history];
      setCurrentHistoryId(item.id);
    }
    persistHistory(next);
    alert('Saved to history');
  };

  const loadHistoryItem = (id) => {
    const it = history.find(h => h.id === id);
    if (!it) return;
    setWorkflow(structuredClone(it.data));
    setCurrentHistoryId(it.id);
    setAutoEditRoot(false);
  };

  const deleteHistoryItem = (id) => {
    if (!window.confirm('Delete this saved workflow?')) return;
    const next = history.filter(h => h.id !== id);
    persistHistory(next);
    if (currentHistoryId === id) {
      setCurrentHistoryId(null);
      setWorkflow(null);
    }
  };

  const renameHistoryItem = (id) => {
    const it = history.find(h => h.id === id);
    if (!it) return;
    const name = window.prompt('New name', it.name || '');
    if (name == null) return;
    const next = history.map(h => h.id === id ? { ...h, name: name.trim() } : h);
    persistHistory(next);
  };

  const downloadHistoryItem = (id) => {
    const it = history.find(h => h.id === id);
    if (!it) return;
    // ensure data is cleaned (no parent refs) before serializing
    const clean = cleanNode(it.data);
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (it.name || 'workflow').replace(/[^a-z0-9\-_.]/gi, '_');
    a.href = url;
    a.download = `${safeName}.odf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Capture the visible `.canvas` element as an image using html2canvas (loaded from CDN if needed)
  const ensureHtml2Canvas = () => new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve(window.html2canvas);
    const src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { if (window.html2canvas) resolve(window.html2canvas); else reject(new Error('html2canvas failed to load')); };
    s.onerror = () => reject(new Error('html2canvas failed to load'));
    document.head.appendChild(s);
  });

  const captureCanvasImageDataUrl = async () => {
    const el = document.querySelector('.canvas');
    if (!el) throw new Error('Canvas element not found');
    await ensureHtml2Canvas();
    // capture with white background to match UI
    const cn = await window.html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
    return cn.toDataURL('image/png');
  };

  const downloadCanvasPNG = async (fileName = 'workflow') => {
    try {
      const dataUrl = await captureCanvasImageDataUrl();
      const a = document.createElement('a');
      a.href = dataUrl;
      const safe = (fileName || 'workflow').replace(/[^a-z0-9\-_.]/gi, '_');
      a.download = `${safe}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      alert('Failed to capture image: ' + e.message);
    }
  };

  const downloadCanvasPDF = async (fileName = 'workflow') => {
    try {
      const dataUrl = await captureCanvasImageDataUrl();
      // open a new tab with the image and trigger print (user can save as PDF)
      const w = window.open('about:blank');
      if (!w) return alert('Popup blocked. Allow popups to download as PDF.');
      w.document.write(`<html><head><title>${fileName}</title></head><body style="margin:0"><img src="${dataUrl}" style="width:100%;height:auto;"/></body></html>`);
      w.document.close();
      // wait for image load then call print
      w.onload = () => setTimeout(() => { try { w.print(); } catch (err) { /* ignore */ } }, 500);
    } catch (e) {
      console.error(e);
      alert('Failed to create PDF: ' + e.message);
    }
  };

  const updateTree = (updated) => {
    setWorkflow({ ...updated });
    setAutoEditRoot(false);
  };

  const deleteAll = () => {
    if (!workflow) return;
    if (window.confirm("Delete entire workflow? This cannot be undone.")) {
      setWorkflow(null);
    }
  };

  const getContextValue = (path, context) => {
    if (!path) return undefined;
    const parts = String(path).split('.');
    let cur = context;
    for (let p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };

  const evaluateCondition = async (expr, context) => {
    if (!expr) return false;
    // string: evaluate as JS expression in context
    if (typeof expr === 'string') {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('context', 'with(context){return (' + expr + ')}');
        return Boolean(fn(context || {}));
      } catch (e) {
        console.error('Condition eval error', e);
        return false;
      }
    }

    // structured object
    const t = expr.type;
    try {
      if (t === 'comparison') {
        const left = getContextValue(expr.left, context);
        let right = expr.right;
        // try parse number/boolean
        if (typeof right === 'string') {
          if (/^\d+(\.\d+)?$/.test(right)) right = Number(right);
          else if (right === 'true' || right === 'false') right = right === 'true';
        }
        const op = expr.op;
        switch (op) {
          case '>': return left > right;
          case '<': return left < right;
          case '>=': return left >= right;
          case '<=': return left <= right;
          case '==': return left == right;
          case '!=': return left != right;
          default: return false;
        }
      }
      if (t === 'boolean') {
        const v = getContextValue(expr.var, context);
        return Boolean(v) === Boolean(expr.value);
      }
      if (t === 'string') {
        let left = getContextValue(expr.left, context);
        if (left == null) left = '';
        let val = expr.value;
        if (expr.caseInsensitive) {
          left = String(left).toLowerCase();
          val = String(val).toLowerCase();
        }
        switch (expr.op) {
          case 'contains': return String(left).includes(val);
          case 'not_contains': return !String(left).includes(val);
          case 'starts_with': return String(left).startsWith(val);
          case 'ends_with': return String(left).endsWith(val);
          case 'equals': return String(left) === String(val);
          default: return false;
        }
      }
      if (t === 'multi') {
        const results = [];
        for (let c of expr.conds) {
          // cond can be string expression
          const r = await evaluateCondition(c, context);
          results.push(r);
        }
        if (expr.op === 'AND') return results.every(Boolean);
        return results.some(Boolean);
      }
      if (t === 'date') {
        const left = getContextValue(expr.left, context);
        const leftD = left ? new Date(left) : null;
        const rightD = new Date(expr.date);
        if (!leftD || isNaN(leftD)) return false;
        if (expr.op === 'before') return leftD < rightD;
        if (expr.op === 'after') return leftD > rightD;
        return false;
      }
      if (t === 'range') {
        const left = Number(getContextValue(expr.left, context));
        return left >= Number(expr.min) && left <= Number(expr.max);
      }
      if (t === 'regex') {
        const left = String(getContextValue(expr.left, context) || '');
        const re = new RegExp(expr.pattern, expr.flags || '');
        return re.test(left);
      }
      if (t === 'external') {
        // call API; expect JSON boolean or {result:true}
        try {
          const res = await fetch(expr.url);
          const j = await res.json();
          if (typeof j === 'boolean') return j;
          if (j && typeof j.result !== 'undefined') return Boolean(j.result);
          return Boolean(j);
        } catch (e) {
          console.error('External condition error', e);
          return false;
        }
      }
      if (t === 'switch') {
        // switch handled by runWorkflow for branching; return false as default
        return false;
      }
    } catch (err) {
      console.error('Error evaluating structured condition', err);
      return false;
    }

    return false;
  };

  const [activeIds, setActiveIds] = useState([]);

  const hasBranch = (n) => {
    if (!n) return false;
    if (n.type === 'branch') return true;
    if (n.type === 'action' && n.children?.length) return hasBranch(n.children[0]);
    if (n.type === 'branch') return true;
    if (n.branches) return Object.values(n.branches).some(b => hasBranch(b));
    return false;
  };

  const runWorkflow = async () => {
    if (!workflow) return alert('No workflow to run');
    let input = window.prompt('Enter JSON context (example: {"value": 12})');
    if (input === null) return; // canceled
    let context = {};
    try {
      context = input.trim() ? JSON.parse(input) : {};
    } catch (e) {
      return alert('Invalid JSON');
    }

    const pathNodes = [];
    let node = workflow;
    while (node) {
      pathNodes.push(node);
      if (node.type === 'end') break;
      if (node.type === 'action') {
        node = node.children?.[0] || null;
        continue;
      }
      if (node.type === 'branch') {
        // support structured switch separately
        if (node.conditionObj?.type === 'switch') {
          const left = getContextValue(node.conditionObj.var, context);
          const mapped = node.conditionObj.map?.[left];
          const key = mapped === 'true' || mapped === true ? 'true' : (mapped === 'false' || mapped === false ? 'false' : String(mapped));
          node = node.branches?.[key] || node.branches?.[mapped] || null;
          continue;
        }
        const res = await evaluateCondition(node.conditionObj || node.condition, context);
        node = node.branches?.[res ? 'true' : 'false'] || null;
        continue;
      }
      break;
    }

    // animate through nodes
    for (let i = 0; i < pathNodes.length; i++) {
      setActiveIds([pathNodes[i].id]);
      // wait
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 600));
    }
    // keep full path highlighted briefly
    setActiveIds(pathNodes.map(n => n.id));
    setTimeout(() => setActiveIds([]), 800);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Workflow Builder</h1>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {workflow && hasBranch(workflow) && <button className="run-btn" onClick={runWorkflow}>Run</button>}
          {workflow && <button className="run-btn" onClick={saveCurrentToHistory}>Save</button>}
          {user && <button className="delete" onClick={() => { if(window.confirm('Logout?')) setUser(null); }}>Logout</button>}
        </div>
      </div>

      {user && (
        <div className="history">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>Saved Workflows</h3>
            <div style={{fontSize:13, color:'#6b7280'}}>{history.length} saved</div>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">No saved workflows yet — save one to see it here.</div>
            ) : history.map(h => (
              <div className="history-item" key={h.id}>
                <div className="history-meta">
                  <div className="history-name">{h.name}</div>
                  <small>{new Date(h.updatedAt || 0).toLocaleString()}</small>
                </div>
                <div className="history-actions">
                  <button className="run-btn" onClick={() => loadHistoryItem(h.id)}>Load</button>
                  <button className="run-btn" onClick={() => renameHistoryItem(h.id)}>Rename</button>
                  <button className="run-btn" onClick={() => downloadHistoryItem(h.id)}>Download</button>
                  <button className="delete" onClick={() => deleteHistoryItem(h.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="canvas">
        {!user ? (
          <Login onLogin={(u) => setUser(u)} />
        ) : (!workflow ? (
          <div className="landing">
            <h2>Welcome, {user.username}</h2>
            <p>Click Start to create a new workflow.</p>
            <button className="start-btn" onClick={createStart}>Start</button>
          </div>
        ) : (
          <NodeCard node={workflow} parent={null} updateRoot={updateTree} autoEdit={autoEditRoot} deleteAll={deleteAll} activeIds={activeIds} />
        ))}
      </div>
    </div>
  );
}

