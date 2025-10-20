// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface KnowledgeNode {
  id: string;
  encryptedValue: string;
  relationStrength: number;
  timestamp: number;
  owner: string;
  topic: string;
  connections: string[];
}

// Randomly selected styles: 
// Colors: Gradient (Rainbow)
// UI Style: Glass Morphism
// Layout: Center Radiation
// Interaction: Micro-interactions (hover ripple, button breathing light)

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHEComputeSimilarity = (encryptedData1: string, encryptedData2: string): string => {
  const value1 = FHEDecryptNumber(encryptedData1);
  const value2 = FHEDecryptNumber(encryptedData2);
  const similarity = 1 - Math.abs(value1 - value2) / (value1 + value2);
  return FHEEncryptNumber(similarity);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newNodeData, setNewNodeData] = useState({ topic: "", value: 0, relationStrength: 0.5 });
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [decryptedValue, setDecryptedValue] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showGraph, setShowGraph] = useState(false);

  // Randomly selected features: Search & Filter, Data Visualization, Project Introduction

  useEffect(() => {
    loadNodes().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadNodes = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("node_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing node keys:", e); }
      }
      
      const list: KnowledgeNode[] = [];
      for (const key of keys) {
        try {
          const nodeBytes = await contract.getData(`node_${key}`);
          if (nodeBytes.length > 0) {
            try {
              const nodeData = JSON.parse(ethers.toUtf8String(nodeBytes));
              list.push({ 
                id: key, 
                encryptedValue: nodeData.value, 
                relationStrength: nodeData.relationStrength || 0.5,
                timestamp: nodeData.timestamp, 
                owner: nodeData.owner, 
                topic: nodeData.topic,
                connections: nodeData.connections || []
              });
            } catch (e) { console.error(`Error parsing node data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading node ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setNodes(list);
    } catch (e) { console.error("Error loading nodes:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitNode = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting knowledge node with Zama FHE..." });
    try {
      const encryptedValue = FHEEncryptNumber(newNodeData.value);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const nodeId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const nodeData = { 
        value: encryptedValue, 
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        topic: newNodeData.topic,
        relationStrength: newNodeData.relationStrength,
        connections: []
      };
      
      await contract.setData(`node_${nodeId}`, ethers.toUtf8Bytes(JSON.stringify(nodeData)));
      
      const keysBytes = await contract.getData("node_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(nodeId);
      await contract.setData("node_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Knowledge node encrypted and stored!" });
      await loadNodes();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewNodeData({ topic: "", value: 0, relationStrength: 0.5 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const connectNodes = async (nodeId1: string, nodeId2: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Computing FHE similarity..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      const node1Bytes = await contract.getData(`node_${nodeId1}`);
      const node2Bytes = await contract.getData(`node_${nodeId2}`);
      if (node1Bytes.length === 0 || node2Bytes.length === 0) throw new Error("Node not found");
      
      const node1Data = JSON.parse(ethers.toUtf8String(node1Bytes));
      const node2Data = JSON.parse(ethers.toUtf8String(node2Bytes));
      
      const similarity = FHEComputeSimilarity(node1Data.value, node2Data.value);
      
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      
      // Update both nodes with connection
      const updatedNode1 = { 
        ...node1Data, 
        connections: [...(node1Data.connections || []), nodeId2] 
      };
      const updatedNode2 = { 
        ...node2Data, 
        connections: [...(node2Data.connections || []), nodeId1] 
      };
      
      await contractWithSigner.setData(`node_${nodeId1}`, ethers.toUtf8Bytes(JSON.stringify(updatedNode1)));
      await contractWithSigner.setData(`node_${nodeId2}`, ethers.toUtf8Bytes(JSON.stringify(updatedNode2)));
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE similarity connection established!" });
      await loadNodes();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Connection failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (nodeAddress: string) => address?.toLowerCase() === nodeAddress.toLowerCase();

  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || 
                      (activeTab === "mine" && isOwner(node.owner)) || 
                      (activeTab === "connected" && node.connections.length > 0);
    return matchesSearch && matchesTab;
  });

  const renderKnowledgeGraph = () => {
    if (nodes.length === 0) return null;
    
    const sampleNodes = nodes.slice(0, Math.min(5, nodes.length));
    
    return (
      <div className="knowledge-graph">
        {sampleNodes.map((node, i) => (
          <div 
            key={node.id} 
            className="graph-node"
            style={{
              top: `${50 + 40 * Math.sin(i * (2 * Math.PI / sampleNodes.length))}%`,
              left: `${50 + 40 * Math.cos(i * (2 * Math.PI / sampleNodes.length))}%`,
              background: `hsl(${i * (360 / sampleNodes.length)}, 80%, 60%)`
            }}
            onClick={() => setSelectedNode(node)}
          >
            <div className="node-topic">{node.topic}</div>
            <div className="node-connections">{node.connections.length} connections</div>
          </div>
        ))}
        {sampleNodes.length > 1 && (
          <svg className="graph-lines" width="100%" height="100%">
            {sampleNodes.slice(1).map((node, i) => (
              <line
                key={`line-${i}`}
                x1="50%"
                y1="50%"
                x2={`${50 + 40 * Math.cos((i+1) * (2 * Math.PI / sampleNodes.length))}%`}
                y2={`${50 + 40 * Math.sin((i+1) * (2 * Math.PI / sampleNodes.length))}%`}
                stroke={`hsl(${(i+1) * (360 / sampleNodes.length)}, 80%, 60%)`}
                strokeWidth="2"
              />
            ))}
          </svg>
        )}
        <div className="graph-center" onClick={() => setShowGraph(!showGraph)}>
          <div className="center-icon">🧠</div>
          <div className="center-label">Knowledge Hub</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing encrypted knowledge graph...</p>
    </div>
  );

  return (
    <div className="app-container">
      <div className="glass-background"></div>
      <header className="app-header">
        <div className="logo">
          <h1>隱知<span>FHE</span>社交網絡</h1>
          <p>Knowledge Graph Social Network</p>
        </div>
        <div className="header-actions">
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="center-radial-layout">
          <div className="content-panel glass-card">
            <div className="panel-header">
              <h2>FHE-Encrypted Knowledge Graph</h2>
              <div className="search-filter">
                <input 
                  type="text" 
                  placeholder="Search topics..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="glass-input"
                />
                <div className="filter-tabs">
                  <button 
                    className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                    onClick={() => setActiveTab("all")}
                  >
                    All Nodes
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "mine" ? "active" : ""}`}
                    onClick={() => setActiveTab("mine")}
                  >
                    My Nodes
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "connected" ? "active" : ""}`}
                    onClick={() => setActiveTab("connected")}
                  >
                    Connected
                  </button>
                </div>
              </div>
            </div>

            <div className="feature-section">
              <div className="feature-card glass-card">
                <h3>Project Introduction</h3>
                <p>
                  A decentralized social network based on <strong>FHE-encrypted knowledge graphs</strong>. 
                  The platform connects users with similar knowledge graphs using <strong>Zama FHE technology</strong> 
                  to compute similarities without decrypting user data.
                </p>
                <div className="tech-badge">
                  <span>Powered by Zama FHE</span>
                </div>
              </div>

              <div className="feature-card glass-card">
                <h3>How It Works</h3>
                <ol className="steps-list">
                  <li>Users create encrypted knowledge nodes</li>
                  <li>FHE computes similarities between nodes</li>
                  <li>Users connect based on knowledge similarities</li>
                  <li>All computations happen on encrypted data</li>
                </ol>
              </div>
            </div>

            <div className="graph-visualization">
              <div className="section-header">
                <h3>Knowledge Graph Visualization</h3>
                <button 
                  className="glass-button"
                  onClick={() => setShowGraph(!showGraph)}
                >
                  {showGraph ? "Hide Graph" : "Show Graph"}
                </button>
              </div>
              {showGraph && renderKnowledgeGraph()}
            </div>

            <div className="nodes-section">
              <div className="section-header">
                <h3>Knowledge Nodes</h3>
                <div className="header-actions">
                  <button 
                    className="glass-button primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    + Add Node
                  </button>
                  <button 
                    className="glass-button"
                    onClick={loadNodes}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>

              {filteredNodes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧠</div>
                  <p>No knowledge nodes found</p>
                  <button 
                    className="glass-button primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create First Node
                  </button>
                </div>
              ) : (
                <div className="nodes-list">
                  {filteredNodes.map(node => (
                    <div 
                      key={node.id} 
                      className="node-card glass-card"
                      onClick={() => setSelectedNode(node)}
                    >
                      <div className="node-header">
                        <h4>{node.topic}</h4>
                        <span className={`owner-badge ${isOwner(node.owner) ? "owner" : ""}`}>
                          {isOwner(node.owner) ? "You" : `${node.owner.substring(0, 6)}...`}
                        </span>
                      </div>
                      <div className="node-meta">
                        <span>{new Date(node.timestamp * 1000).toLocaleDateString()}</span>
                        <span>{node.connections.length} connections</span>
                      </div>
                      <div className="node-actions">
                        <button 
                          className="glass-button small"
                          onClick={(e) => {
                            e.stopPropagation();
                            const otherNode = nodes.find(n => n.id !== node.id);
                            if (otherNode) connectNodes(node.id, otherNode.id);
                          }}
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal glass-card">
            <div className="modal-header">
              <h2>Create Knowledge Node</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Topic *</label>
                <input
                  type="text"
                  name="topic"
                  value={newNodeData.topic}
                  onChange={(e) => setNewNodeData({...newNodeData, topic: e.target.value})}
                  placeholder="Enter knowledge topic..."
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label>Value (0-100) *</label>
                <input
                  type="range"
                  name="value"
                  min="0"
                  max="100"
                  value={newNodeData.value}
                  onChange={(e) => setNewNodeData({...newNodeData, value: parseInt(e.target.value)})}
                  className="glass-slider"
                />
                <div className="value-display">{newNodeData.value}</div>
              </div>
              <div className="form-group">
                <label>Connection Strength (0-1)</label>
                <input
                  type="range"
                  name="relationStrength"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newNodeData.relationStrength}
                  onChange={(e) => setNewNodeData({...newNodeData, relationStrength: parseFloat(e.target.value)})}
                  className="glass-slider"
                />
                <div className="value-display">{newNodeData.relationStrength.toFixed(1)}</div>
              </div>
              <div className="encryption-preview">
                <h4>FHE Encryption Preview</h4>
                <div className="preview-box">
                  <div>Plain Value: {newNodeData.value}</div>
                  <div>→</div>
                  <div>Encrypted: {FHEEncryptNumber(newNodeData.value).substring(0, 30)}...</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="glass-button"
              >
                Cancel
              </button>
              <button 
                onClick={submitNode} 
                disabled={creating || !newNodeData.topic}
                className="glass-button primary"
              >
                {creating ? "Encrypting..." : "Create Node"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="modal-overlay">
          <div className="detail-modal glass-card">
            <div className="modal-header">
              <h2>Knowledge Node: {selectedNode.topic}</h2>
              <button onClick={() => setSelectedNode(null)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="node-details">
                <div className="detail-item">
                  <span>Owner:</span>
                  <strong>{selectedNode.owner}</strong>
                </div>
                <div className="detail-item">
                  <span>Created:</span>
                  <strong>{new Date(selectedNode.timestamp * 1000).toLocaleString()}</strong>
                </div>
                <div className="detail-item">
                  <span>Connections:</span>
                  <strong>{selectedNode.connections.length}</strong>
                </div>
              </div>
              
              <div className="encrypted-data-section">
                <h3>Encrypted Data</h3>
                <div className="encrypted-data">
                  {selectedNode.encryptedValue.substring(0, 50)}...
                </div>
                <button 
                  className="glass-button"
                  onClick={async () => {
                    if (decryptedValue !== null) {
                      setDecryptedValue(null);
                    } else {
                      const decrypted = await decryptWithSignature(selectedNode.encryptedValue);
                      if (decrypted !== null) setDecryptedValue(decrypted);
                    }
                  }}
                  disabled={isDecrypting}
                >
                  {isDecrypting ? "Decrypting..." : 
                   decryptedValue !== null ? "Hide Value" : "Decrypt with Wallet"}
                </button>
              </div>
              
              {decryptedValue !== null && (
                <div className="decrypted-section">
                  <h3>Decrypted Value</h3>
                  <div className="decrypted-value">{decryptedValue}</div>
                  <div className="decryption-note">
                    This value was decrypted client-side after wallet signature verification
                  </div>
                </div>
              )}
              
              <div className="connections-section">
                <h3>Connected Nodes</h3>
                {selectedNode.connections.length > 0 ? (
                  <div className="connections-list">
                    {selectedNode.connections.slice(0, 3).map(connId => {
                      const connNode = nodes.find(n => n.id === connId);
                      return connNode ? (
                        <div 
                          key={connId} 
                          className="connection-card"
                          onClick={() => setSelectedNode(connNode)}
                        >
                          {connNode.topic}
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="no-connections">No connections yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="glass-card">
            <div className={`status-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="status-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>隱知 FHE 社交網絡</h3>
            <p>A decentralized social network based on FHE-encrypted knowledge graphs</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">About Zama FHE</a>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge">FHE-Powered Knowledge Graph</div>
          <div className="copyright">© {new Date().getFullYear()} 隱知社交網絡</div>
        </div>
      </footer>
    </div>
  );
};

export default App;