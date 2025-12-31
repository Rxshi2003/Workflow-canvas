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

  return (
    <div className="app">
      <h1>Workflow Builder</h1>

      <div className="canvas">
        {workflow && (
          <div className="canvas-controls">
            <button className="danger" onClick={deleteAll}>Delete All</button>
          </div>
        )}
        {!workflow ? (
          <div className="landing">
            <h2>Welcome</h2>
            <p>Click Start to create a new workflow.</p>
            <button className="start-btn" onClick={createStart}>Start</button>
          </div>
        ) : (
          <NodeCard node={workflow} parent={null} updateRoot={updateTree} autoEdit={autoEditRoot} />
        )}
      </div>
    </div>
  );
}

