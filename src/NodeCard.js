import React, { useState, useEffect } from "react";
import { nanoid } from "nanoid";

export default function NodeCard({ node, parent, updateRoot, autoEdit = false }) {
  const [editing, setEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(node.label);
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(open => !open);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="node-wrapper">
      <div className={`node ${node.type}`}>
        {editing ? (
          <div className="edit-inline">
            <input
              value={tempLabel}
              onChange={e => setTempLabel(e.target.value)}
              onBlur={saveLabel}
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
              <div className="menu-sep" />
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
