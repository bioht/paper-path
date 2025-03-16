import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import NetworkGraph from './NetworkGraph';
import SearchResults from './SearchResults';
import LandingPage from './LandingPage';
import Login from './Login';
import Signup from './Signup';
import SavedGraphs from './SavedGraphs';
import { getPaperDetails } from './utils/api';
import './App.css';

const Navigation = ({ setIsLoggedIn: setParentIsLoggedIn }) => {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const loggedIn = !!token;
    setIsLoggedIn(loggedIn);
    setParentIsLoggedIn(loggedIn);
  }, [location, setParentIsLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    window.location.href = '/';
  };

  // Don't show navigation on landing page or auth pages
  if (location.pathname === '/' || 
      location.pathname === '/login' || 
      location.pathname === '/signup') return null;

  return (
    <nav className="main-nav">
      <div className="auth-buttons">
        {isLoggedIn ? (
          <button onClick={handleLogout} className="nav-button">Logout</button>
        ) : (
          <>
            <Link to="/login" className="nav-button">Login</Link>
            <Link to="/signup" className="nav-button">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
};

function App() {
  const [query, setQuery] = useState("");
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [shouldSearch, setShouldSearch] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const landingPageProps = {
    isLoggedIn,
    setIsLoggedIn
  };

  const handleSelectPaper = async (paper) => {
    console.log('Selected paper:', paper);
    const paperId = paper?.paperId || paper?.id;
    
    if (!paperId) {
      console.error('No paper ID found:', paper);
      return;
    }
    
    // Process authors to ensure we have name strings
    const processAuthors = (authors) => {
      if (!authors) return [];
      return authors.map(author => {
        if (typeof author === 'object' && author.name) {
          return author.name;
        }
        return typeof author === 'string' ? author : '';
      }).filter(name => name);
    };
    
    // Immediately show the paper we have from search results
    setSelectedPaper({
      ...paper,
      id: paperId,
      paperId: paperId,
      authors: processAuthors(paper.authors),
      references: [],
      citations: []
    });
    
    try {
      const data = await getPaperDetails(paperId);
      const dataId = data?.paperId || data?.id;
      if (dataId) {
        setSelectedPaper(prev => ({
          ...prev,
          ...data,
          id: dataId,
          paperId: dataId,
          authors: processAuthors(data.authors || prev.authors),
          references: data.references || [],
          citations: data.citations || []
        }));
      }
    } catch (err) {
      console.error('Fetch paper error:', err);
    }
  };

  return (
    <Router>
      <Navigation setIsLoggedIn={setIsLoggedIn} />
      <Routes>
        <Route path="/" element={<LandingPage {...landingPageProps} />} />
        <Route path="/search" element={
          <div className="app-container">
            <div className="App">
              <h1>Paper</h1>

              {!selectedPaper && (
                <div className="search-container">
                  <div className="search-box">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && setShouldSearch(true)}
                      placeholder="Search for papers..."
                      className="search-input"
                    />
                    <button onClick={() => setShouldSearch(true)} className="search-button">
                      Search
                    </button>
                  </div>

                  <SearchResults 
                    query={query} 
                    onPaperSelect={handleSelectPaper} 
                    shouldSearch={shouldSearch}
                    onSearchComplete={() => setShouldSearch(false)}
                  />
                </div>
              )}
              
              {selectedPaper && (
                <div className="paper-view">
                  <div className="paper-details">
                    <button 
                      className="back-button"
                      onClick={() => setSelectedPaper(null)}
                    >
                      ← Back to Search
                    </button>
                    <h2 className="paper-title">{selectedPaper.title}</h2>
                    <p className="paper-authors">{selectedPaper.authors.join(", ")}</p>
                    {selectedPaper.year && (
                      <p className="paper-year">Published: {selectedPaper.year}</p>
                    )}
                    { (selectedPaper.journalInfo?.name || selectedPaper.journal) && (
                      <p className="paper-journal">
                        Journal: { selectedPaper.journalInfo?.name || selectedPaper.journal }
                      </p>
                    )}
                    {selectedPaper.abstract && (
                      <div className="paper-abstract">
                        <h3>Abstract</h3>
                        <p>{selectedPaper.abstract}</p>
                      </div>
                    )}
                  </div>
                  <div className="network-view">
                    <h3>Citation Network</h3>
                    <NetworkGraph paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        } />
        <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} />} />
        <Route path="/signup" element={<Signup setIsLoggedIn={setIsLoggedIn} />} />
        <Route path="/savedgraphs" element={<SavedGraphs />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
