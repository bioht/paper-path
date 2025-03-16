import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchResults from './SearchResults';
import './SavedGraphs.css';

const SavedGraphs = ({ onPaperSelect }) => {
  const [savedGraphs, setSavedGraphs] = useState([]);
  const [selectedGraph, setSelectedGraph] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const graphs = JSON.parse(localStorage.getItem('savedGraphs') || '[]');
    setSavedGraphs(graphs);
  }, []);

  const deleteGraph = (id) => {
    const updatedGraphs = savedGraphs.filter(graph => graph.id !== id);
    localStorage.setItem('savedGraphs', JSON.stringify(updatedGraphs));
    setSavedGraphs(updatedGraphs);
  };

  return (
    <div className="saved-graphs">
      <h1>Saved Graphs</h1>
      {savedGraphs.length === 0 ? (
        <p>No graphs saved yet.</p>
      ) : (
        <div className="graph-list">
          {savedGraphs.map(graph => (
            <div key={graph.id} className="graph-card">
              <div className="graph-header">
                <h3>Graph saved on {new Date(graph.date).toLocaleString()}</h3>
                <button 
                  className="delete-button"
                  onClick={() => deleteGraph(graph.id)}
                >
                  Delete
                </button>
              </div>
              <div className="graph-stats">
                <p>Papers: {graph.papers.length}</p>
                <p>Filters:</p>
                <ul>
                  <li>Year Range: {graph.settings.yearRange.min} - {graph.settings.yearRange.max}</li>
                  <li>Min Citations: {graph.settings.minCitations}</li>
                  <li>Topic Threshold: {graph.settings.topicThreshold.toFixed(2)}</li>
                  <li>Show References: {graph.settings.showReferences ? 'Yes' : 'No'}</li>
                  <li>Show Citations: {graph.settings.showCitations ? 'Yes' : 'No'}</li>
                </ul>
              </div>
              <div className="graph-actions">
                <button
                  className="view-button"
                  onClick={() => setSelectedGraph(graph)}
                >
                  View Articles
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedGraph && (
        <div className="graph-details">
          <h2>Articles in Graph saved on {new Date(selectedGraph.date).toLocaleString()}</h2>
          <button 
            className="back-button"
            onClick={() => setSelectedGraph(null)}
          >
            Back to Saved Graphs
          </button>
          <SearchResults 
            papers={selectedGraph.papers}
            showSearchControls={false}
            onPaperSelect={(paper) => {
              navigate('/search', { state: { selectedPaper: paper } });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default SavedGraphs;
