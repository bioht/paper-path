import React from 'react';
import './GraphSettings.css';

function SettingsPanel({ settings, setSettings, settingsExpanded, setSettingsExpanded, THEMES }) {
  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>Graph Settings</h3>
        <button
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className="toggle-panel-btn"
          aria-label="Toggle Graph Settings"
        >
          {settingsExpanded ? '−' : '+'}
        </button>
      </div>

      <div className="settings-content" style={{ display: settingsExpanded ? 'flex' : 'none' }}>
        <div className="settings-row">
          {/* Text Similarity Threshold */}
          <div className="setting-group slider-group">
            <label htmlFor="similarityThreshold">
              Text Similarity Threshold: {settings.similarityThreshold.toFixed(2)}
            </label>
            <input
              id="similarityThreshold"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.similarityThreshold}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  similarityThreshold: parseFloat(e.target.value),
                }))
              }
            />
            <small className="description">
              Filter papers based on text similarity with main paper
            </small>
          </div>

          {/* Year Range */}
          <div className="setting-group">
            <label>Year Range</label>
            <div className="year-range-inputs">
              <input
                type="number"
                value={settings.yearRange.min}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    yearRange: { ...prev.yearRange, min: parseInt(e.target.value) },
                  }))
                }
                min="1900"
                max={settings.yearRange.max}
              />
              <span>–</span>
              <input
                type="number"
                value={settings.yearRange.max}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    yearRange: { ...prev.yearRange, max: parseInt(e.target.value) },
                  }))
                }
                min={settings.yearRange.min}
                max="2025"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
