import React, { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";

export default function NodeCard({ node, parent, updateRoot, autoEdit = false, deleteAll, activeIds = [] }) {
  const [editing, setEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(node.label);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (autoEdit) setEditing(true);
  }, [autoEdit]);

  useEffect(() => {
    setTempLabel(node.label || "");
  }, [node.id, node.label]);

  const forceUpdate = () => {
    updateRoot(structuredClone(findRoot(node)));
  };

  function findRoot(n) {
    while (n.parent) n = n.parent;
    return n;
  }

  // ⭐ Add Child
  const addNode = (type, branchKey = null) => {
    const newNode = {
      id: nanoid(),
      type,
      label: type === "action" ? "Action"
           : type === "branch" ? "Condition"
           : "End",
      children: [],
    };

    if (type === "branch") {
      newNode.branches = { true: null, false: null };
    }

    if (node.type === "action") node.children = [newNode];
    if (node.type === "branch") node.branches[branchKey] = newNode;

    newNode.parent = node;
    forceUpdate();
  };

  // ⭐ Edit Label
  const saveLabel = () => {
    node.label = tempLabel;
    setEditing(false);
    forceUpdate();
  };

  // ⭐ Delete Node + reconnect
  const deleteNode = () => {
    if (!parent) return alert("Cannot delete Start Node");
    // Remove this node from parent's children array (if present)
    if (parent.children) {
      parent.children = parent.children.filter(c => c?.id !== node.id);
    }

    // Remove this node reference from any branch on the parent
    if (parent.branches) {
      Object.keys(parent.branches).forEach(k => {
        if (parent.branches[k]?.id === node.id) parent.branches[k] = null;
      });
    }

    // Optional: detach parent reference from this node
    node.parent = null;

    forceUpdate();
  };

  const toggleMenu = (e) => {
    e?.stopPropagation();
    setMenuOpen(prev => {
      const next = !prev;
      if (next) {
        try { window.dispatchEvent(new CustomEvent('node-menu-open', { detail: node.id })); } catch(e) { /* ignore */ }
      }
      return next;
    });
  };

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onOtherOpen = (e) => {
      if (e?.detail && e.detail !== node.id) setMenuOpen(false);
    };
    window.addEventListener('node-menu-open', onOtherOpen);
    return () => window.removeEventListener('node-menu-open', onOtherOpen);
  }, [node.id]);

  // close menu on outside click or Escape
  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <div className="node-wrapper" ref={rootRef}>
      <div className={`node ${node.type} ${activeIds.includes(node.id) ? 'active-node' : ''}`}>
        {editing ? (
          <div className="edit-inline">
            <input
              value={tempLabel}
              onChange={e => setTempLabel(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveLabel(); } }}
              autoFocus
            />
            <button className="save" onClick={saveLabel}>Save</button>
          </div>
        ) : (
          <div className="node-title" onDoubleClick={() => setEditing(true)}>
            <span className="node-icon">
              {node.type === 'action' ? '📤' : node.type === 'branch' ? '❓' : '⏹️'}
            </span>
            <span className="node-label">{node.label || (node.type === 'action' ? 'Action' : node.type === 'branch' ? 'Condition' : 'End')}</span>
          </div>
        )}

        {node.type === 'branch' && node.condition && (
          <div className="node-condition">{node.condition}</div>
        )}

        {/* Three-dot menu button */}
        <div className="node-menu">
          <button className="menu-btn" onClick={toggleMenu}>⋯</button>
          {menuOpen && (
            <div className="menu" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setEditing(true); closeMenu(); }}>Edit</button>
              {editing && <button onClick={() => { saveLabel(); closeMenu(); }}>Save</button>}
              {parent && <button onClick={() => { deleteNode(); closeMenu(); }}>Delete</button>}
              {!parent && deleteAll && (
                <button onClick={() => {
                  if (window.confirm('Delete entire workflow? This cannot be undone.')) {
                    deleteAll();
                    closeMenu();
                  }
                }}>Delete All</button>
              )}
              {node.type === 'branch' && (
                <button onClick={() => {
                  const t = window.prompt('Choose condition type:\n1) Comparison\n2) Boolean\n3) String\n4) Multi (AND/OR)\n5) Switch (multi-branch)\n6) Date\n7) Range\n8) Regex\n9) External (API)\nEnter number', '1');
                  if (!t) return;
                  let obj = null;
                  try {
                    switch (t.trim()) {
                      case '1': {
                        const left = window.prompt('Left variable (e.g. amount)', node.conditionObj?.left || 'amount');
                        const op = window.prompt('Operator (>,<,>=,<=,==,!=)', node.conditionObj?.op || '>');
                        const right = window.prompt('Right value (e.g. 5000)', node.conditionObj?.right || '5000');
                        if (left == null || op == null || right == null) return;
                        obj = { type: 'comparison', left, op, right };
                        node.condition = `${left} ${op} ${right}`;
                        break;
                      }
                      case '2': {
                        const v = window.prompt('Variable name (e.g. isActive)', node.conditionObj?.var || 'isActive');
                        const want = window.prompt('Value (true/false)', node.conditionObj?.value ? 'true' : 'false');
                        if (v == null || want == null) return;
                        obj = { type: 'boolean', var: v, value: want.toLowerCase() === 'true' };
                        node.condition = `${v} == ${obj.value}`;
                        break;
                      }
                      case '3': {
                        const left = window.prompt('Variable name (e.g. status)', node.conditionObj?.left || 'status');
                        const op = window.prompt('Operator: contains, not_contains, starts_with, ends_with, equals', node.conditionObj?.op || 'contains');
                        const val = window.prompt('String value', node.conditionObj?.value || 'foo');
                        const ci = window.prompt('Case insensitive? (yes/no)', node.conditionObj?.caseInsensitive ? 'yes' : 'no');
                        if (left == null || op == null || val == null || ci == null) return;
                        obj = { type: 'string', left, op, value: val, caseInsensitive: ci.toLowerCase().startsWith('y') };
                        node.condition = `${left} ${op} "${val}"`;
                        break;
                      }
                      case '4': {
                        const first = window.prompt('First comparison (e.g. amount > 1000)', node.conditionObj?.conds?.[0] || 'amount > 1000');
                        const second = window.prompt('Second comparison (e.g. status == Approved)', node.conditionObj?.conds?.[1] || 'status == Approved');
                        const join = window.prompt('Join operator (AND/OR)', node.conditionObj?.op || 'AND');
                        if (first == null || second == null || join == null) return;
                        obj = { type: 'multi', op: join.toUpperCase(), conds: [first, second] };
                        node.condition = `${first} ${join.toUpperCase()} ${second}`;
                        break;
                      }
                      case '5': {
                        const v = window.prompt('Variable name (e.g. status)', node.conditionObj?.var || 'status');
                        const map = window.prompt('Map values to branches, comma separated (value:branchKey), e.g. Approved:true,Pending:false', node.conditionObj?.mapStr || 'Approved:true,Pending:false');
                        if (v == null || map == null) return;
                        const mapObj = {};
                        map.split(',').forEach(pair => {
                          const [k, val] = pair.split(':').map(s => s && s.trim());
                          if (k) mapObj[k] = val || k;
                        });
                        obj = { type: 'switch', var: v, map: mapObj };
                        node.condition = `${v} in {${Object.keys(mapObj).join(',')}}`;
                        break;
                      }
                      case '6': {
                        const left = window.prompt('Date variable (e.g. subscriptionEndDate)', node.conditionObj?.left || 'subscriptionEndDate');
                        const op = window.prompt('Operator: before / after', node.conditionObj?.op || 'before');
                        const dateStr = window.prompt('Date (YYYY-MM-DD)', node.conditionObj?.date || new Date().toISOString().slice(0,10));
                        if (left == null || op == null || dateStr == null) return;
                        obj = { type: 'date', left, op, date: dateStr };
                        node.condition = `${left} ${op} ${dateStr}`;
                        break;
                      }
                      case '7': {
                        const left = window.prompt('Variable name (e.g. score)', node.conditionObj?.left || 'score');
                        const min = window.prompt('Min value', node.conditionObj?.min || '0');
                        const max = window.prompt('Max value', node.conditionObj?.max || '100');
                        if (left == null || min == null || max == null) return;
                        obj = { type: 'range', left, min: Number(min), max: Number(max) };
                        node.condition = `${left} between ${min} and ${max}`;
                        break;
                      }
                      case '8': {
                        const left = window.prompt('Variable name (e.g. email)', node.conditionObj?.left || 'email');
                        const pattern = window.prompt('Regex pattern (without /)', node.conditionObj?.pattern || '^\\S+@\\S+\\.\\S+$');
                        const flags = window.prompt('Flags (e.g. i)', node.conditionObj?.flags || 'i');
                        if (left == null || pattern == null || flags == null) return;
                        obj = { type: 'regex', left, pattern, flags };
                        node.condition = `${left} matches /${pattern}/${flags}`;
                        break;
                      }
                      case '9': {
                        const url = window.prompt('API URL to call (GET). Returns truthy in body to follow true branch', node.conditionObj?.url || '');
                        if (url == null) return;
                        obj = { type: 'external', url };
                        node.condition = `external(${url})`;
                        break;
                      }
                      default:
                        return;
                    }
                  } catch (err) {
                    console.error(err);
                    return;
                  }
                  if (obj) {
                    node.conditionObj = obj;
                    closeMenu();
                    forceUpdate();
                  }
                }}>Set Condition</button>
              )}
              {node.type !== "end" && (
                <>
                  <button onClick={() => { addNode("action"); closeMenu(); }}>Add Action</button>
                  <button onClick={() => { addNode("branch"); closeMenu(); }}>Add Branch</button>
                  <button onClick={() => { addNode("end"); closeMenu(); }}>Add End</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Add controls moved to three-dot menu */}
      </div>

      {/* ⭐ Action Child */}
      {node.type === "action" && node.children?.length > 0 && (
        <>
          <div className="line" />
          <NodeCard node={node.children[0]} parent={node} updateRoot={updateRoot} />
        </>
      )}

      {/* ⭐ Branch Children */}
      {node.type === "branch" && (
        <>
          <div className="branch-connector">
            <div className="line" />
            <div className="branch-split" />
          </div>
          <div className="branch-wrapper">
            {["true", "false"].map(key => (
              <div className="branch-col" key={key}>
                <p className="branch-label">{key.toUpperCase()}</p>

                {node.branches?.[key] ? (
                  <NodeCard
                    node={node.branches[key]}
                    parent={node}
                    updateRoot={updateRoot}
                  />
                ) : (
                  <button
                    className="branch-add"
                    onClick={() => addNode("action", key)}
                  >
                    Add Step
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
