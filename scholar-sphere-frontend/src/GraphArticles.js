import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './SavedGraphs.css';

const GraphArticles = () => {
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

  return (
    <div className="saved-graphs">
      <div className="graph-details">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EB5B00"/>
      <stop offset="100%" stop-color="#640D5F"/>
    </linearGradient>
  </defs>

  

  <path d="M100,100 Q75,25 50,50" stroke="url(#grad)" stroke-width="3" fill="none"/>
  <path d="M100,100 Q125,25 150,50" stroke="url(#grad)" stroke-width="3" fill="none"/>
  <path d="M100,100 Q190,90 170,140" stroke="url(#grad)" stroke-width="3" fill="none"/>
  <path d="M100,100 Q10,90 30,140" stroke="url(#grad)" stroke-width="3" fill="none"/>

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
        <button 
          className="back-button"
          onClick={() => navigate('/savedgraphs')}
        >
          Back to Saved Graphs
        </button>
        <button
          className="search-button"
          onClick={() => {
            navigate('/');     // Second action
          }}
        >  
          Back to Home
        </button>
        <h2>Articles in {graph.name || `Graph saved on ${new Date(graph.date).toLocaleString()}`}</h2>
        <div className="papers-list">
          {graph.papers.map((paper) => (
            <div 
              key={paper.id} 
              className="paper-item"
              onClick={() => {
                const url = paper.doi 
                  ? `${paper.url}`
                  : `https://arxiv.org/abs/${paper.arxiv_id}`;
                window.open(url, '_blank');
              }}
            >
              <h3>{paper.title}</h3>
              <div className="paper-meta">
                <span className="authors">
                  {Array.isArray(paper.authors)
                    ? paper.authors.map(author => author.name || author).join(', ')
                    : paper.authors}
                </span>
                {paper.journalInfo?.name && (
                  <span className="journal">{paper.journalInfo.name}</span>
                )}
                <span className="year">{paper.year}</span>
                <span className="citations">{paper.citationCount || 0} citations</span>
                <span className="url">{paper.url || 0}</span>
              </div>
              {(paper.summary || paper.abstract) && (
                <p className="paper-abstract">
                  {paper.summary || paper.abstract}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GraphArticles;
