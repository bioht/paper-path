import React from 'react';
import './LoadingScreen.css';

function LoadingScreen({ theme = 'default', loadingText = 'Loading Network', progress = 0 }) {
  return (
    <div className={`loading-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="loading-content">
        <div className="loading-spinner"></div>
        
        <h2 className="loading-title">{loadingText}</h2>
        <p className="loading-subtitle">Building your paper network...</p>
        <div className="loading-progress">
          <div 
            className="loading-progress-bar" 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
