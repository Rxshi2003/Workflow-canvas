import React, { useState } from "react";
import { nanoid } from "nanoid";
import NodeCard from "./NodeCard";
import "./App.css";

export default function App() {
  const [workflow, setWorkflow] = useState(null);
  const [autoEditRoot, setAutoEditRoot] = useState(false);

  const createStart = () => {
    const newNode = {
      id: nanoid(),
      type: "action",
      label: "",
      children: []
    };
    setWorkflow(newNode);
    setAutoEditRoot(true);
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
        {workflow && hasBranch(workflow) && <button className="run-btn" onClick={runWorkflow}>Run</button>}
      </div>

      <div className="canvas">
        {!workflow ? (
          <div className="landing">
            <h2>Welcome</h2>
            <p>Click Start to create a new workflow.</p>
            <button className="start-btn" onClick={createStart}>Start</button>
          </div>
        ) : (
          <NodeCard node={workflow} parent={null} updateRoot={updateTree} autoEdit={autoEditRoot} deleteAll={deleteAll} activeIds={activeIds} />
        )}
      </div>
    </div>
  );
}

