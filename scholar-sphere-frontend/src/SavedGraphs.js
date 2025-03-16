import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SavedGraphs.css';

const SavedGraphs = () => {
  const [savedGraphs, setSavedGraphs] = useState([]);
  const [selectedGraph, setSelectedGraph] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const graphs = JSON.parse(localStorage.getItem('savedGraphs') || '[]');
    console.log('Saved papers:', graphs[0]?.papers[0]); // Log first paper to check structure
    setSavedGraphs(graphs);
  }, []);

  const deleteGraph = (id) => {
    const updatedGraphs = savedGraphs.filter(graph => graph.id !== id);
    localStorage.setItem('savedGraphs', JSON.stringify(updatedGraphs));
    setSavedGraphs(updatedGraphs);
  };

  return (
    
    <div className="saved-graphs">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#EB5B00"/>
      <stop offset="100%" stopColor="#640D5F"/>
    </linearGradient>
  </defs>

  

  <path d="M100,100 Q75,25 50,50" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q125,25 150,50" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q190,90 170,140" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q10,90 30,140" stroke="url(#grad)" strokeWidth="3" fill="none"/>

  <circle cx="100" cy="100" r="12" fill="url(#grad)" />

  <circle cx="50" cy="50" r="8" fill="#640D5F"/>
  <circle cx="150" cy="50" r="8" fill="#640D5F"/>
  <circle cx="170" cy="140" r="8" fill="#640D5F"/>
  <circle cx="30" cy="140" r="8" fill="#640D5F"/>

  <text x="100" y="180" text-anchor="middle" font-size="24" font-family="Arial, sans-serif"
        font-weight="bold" fill="url(#grad)">
    PaperPath
  </text>
</svg>

      <h1>Saved Graphs</h1>
      <button 
          className="cta-button"
          onClick={() => {
            navigate('/search');     // Second action
          }}
        >
          Back to network visualization
        </button>
        <button 
          className="cta-button"
          onClick={() => {
            navigate('/');     // Second action
          }}
        >
          Back to Home
        </button>
      {savedGraphs.length === 0 ? (
        
        <p>No graphs saved yet.</p>
      ) : (
        <div className="graph-list">
          {savedGraphs.map(graph => (
            <div key={graph.id} className="graph-card">
              <div className="graph-header">
                <h3>{graph.name || `Graph saved on ${new Date(graph.date).toLocaleString()}`}</h3>
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
                  onClick={() => navigate('/graph-articles', { state: { graph } })}
                >
                  View Articles
                </button>
                <button
                  className="view-button"
                  onClick={() => navigate('/search', { state: { savedGraph: graph } })}
                >
                  View Graph
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default SavedGraphs;
