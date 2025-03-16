import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1 className="app-title">Welcome to PaperPath</h1>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#EB5B00"/>
      <stop offset="100%" stopColor="#fff"/>
    </linearGradient>
  </defs>

  

  <path d="M100,100 Q75,25 50,50" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q125,25 150,50" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q190,90 170,140" stroke="url(#grad)" strokeWidth="3" fill="none"/>
  <path d="M100,100 Q10,90 30,140" stroke="url(#grad)" strokeWidth="3" fill="none"/>

  <circle cx="100" cy="100" r="12" fill="#fff" />

  <circle cx="50" cy="50" r="8" fill="#fff"/>
  <circle cx="150" cy="50" r="8" fill="#fff"/>
  <circle cx="170" cy="140" r="8" fill="#fff"/>
  <circle cx="30" cy="140" r="8" fill="#fff"/>

  <text x="100" y="180" text-anchor="middle" font-size="24" font-family="Arial, sans-serif"
        font-weight="bold" fill="#fff">
    PaperPath
  </text>
</svg>
       

        <p className="app-description">
          Explore academic papers through an interactive visualization of citations and references.
          Discover connections between research papers and navigate through knowledge networks.
        </p>
        <button 
          className="cta-button"
          onClick={() => {
            navigate('/search');     // Second action
          }}
        >
          Try Now
        </button>
        
        <div className="auth-buttons">
          <button
            className="auth-button login-button"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
          <button
            className="auth-button signup-button"
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
      <div className="background-pattern"></div>
    </div>
  );
};

export default LandingPage;
