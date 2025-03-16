import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NetworkGraph from './NetworkGraph';
import './SavedGraphs.css';

const SavedGraphView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const graph = location.state?.graph;

  if (!graph) {
    return (
      <div className="saved-graphs">
        <h1>No graph selected</h1>
        <button 
          className="back-button"
          onClick={() => navigate('/savedgraphs')}
        >
          Back to Saved Graphs
        </button>
      </div>
    );
  }

  // Find the main papers (papers marked as isMain)
  const mainPapers = graph.papers.filter(paper => paper.isMain);
  const firstPaper = mainPapers[0] || graph.papers[0];

  return (
    <div className="saved-graphs">
      <div className="graph-details">
        <button 
          className="back-button"
          onClick={() => navigate('/savedgraphs')}
        >
          Back to Saved Graphs
        </button>
        <h2>Graph View: {graph.name || `Graph saved on ${new Date(graph.date).toLocaleString()}`}</h2>
        <div className="network-view">
          <NetworkGraph 
            paper={firstPaper} 
            onClose={() => navigate('/savedgraphs')}
            initialPapers={mainPapers}
            initialSettings={graph.settings}
          />
        </div>
      </div>
    </div>
  );
};

export default SavedGraphView;
