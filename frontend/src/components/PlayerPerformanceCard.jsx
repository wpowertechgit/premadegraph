import React, { useState, useEffect } from 'react';
import './PlayerPerformanceCard.css';

const API_BASE = 'http://localhost:3001/api';

/**
 * PlayerPerformanceCard Component
 * 
 * Displays:
 * - Overall opscore & feedscore in circular progress charts
 * - Primary role + confidence
 * - 8-artifact breakdown with bars
 * - Match metadata
 */

export default function PlayerPerformanceCard({ puuid }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!puuid) {
      setError('No player PUUID provided');
      setLoading(false);
      return;
    }
    fetchPlayerScores();
    fetchConfig();
  }, [puuid]);

  const fetchPlayerScores = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/players/${encodeURIComponent(puuid)}/scores`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setScoreData(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch player scores:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/scores/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.warn('Failed to fetch scoring config:', err);
    }
  };

  if (loading) {
    return <div className="performance-card loading">Loading performance data...</div>;
  }

  if (error) {
    return <div className="performance-card error">Error: {error}</div>;
  }

  if (!scoreData) {
    return <div className="performance-card">No data available</div>;
  }

  const { scores, names, country } = scoreData;
  const primaryName = names[0] || 'Unknown Player';
  const roleClass = scores.detectedRole.toLowerCase();

  return (
    <div className="performance-card">
      {/* Header */}
      <div className="card-header">
        <div className="player-identity">
          <h3 className="player-name">{primaryName}</h3>
          <div className="player-meta">
            {country && <span className="country-badge">{country}</span>}
            <span className="match-count">
              {scores.matchesProcessed} {scores.matchesProcessed === 1 ? 'match' : 'matches'}
            </span>
          </div>
        </div>

        <div className="role-indicator">
          <span className={`role-badge ${roleClass}`}>
            {scores.detectedRole}
          </span>
          <span className="confidence-text">
            {(scores.roleConfidence * 100).toFixed(0)}% primary
          </span>
        </div>
      </div>

      {/* Circular Score Charts */}
      <div className="scores-circular-section">
        <div className="circular-score-wrapper">
          <CircularScore 
            value={scores.opscore} 
            max={10}
            label="Opscore"
            color="#4c6ef5"
          />
        </div>

        <div className="circular-score-wrapper">
          <CircularScore 
            value={Math.abs(scores.feedscore)}
            max={10}
            label="Feedscore"
            color="#ff6b6b"
            inverted={true}
          />
          <div className="feedscore-note">
            (lower is better)
          </div>
        </div>
      </div>

      {/* 8-Artifact Breakdown */}
      {scores.artifacts && Object.keys(scores.artifacts).length > 0 && (
        <div className="artifacts-section">
          <h4>Performance Breakdown (Role-Adjusted)</h4>
          <div className="artifact-grid">
            <ArtifactBar 
              label="KDA Score" 
              value={scores.artifacts.kda}
              description={config?.artifacts?.kda}
              color="#51cf66"
            />
            <ArtifactBar 
              label="Economy" 
              value={scores.artifacts.economy}
              description={config?.artifacts?.economy}
              color="#4c6ef5"
            />
            <ArtifactBar 
              label="Map Awareness" 
              value={scores.artifacts.map_awareness}
              description={config?.artifacts?.map_awareness}
              color="#748ffc"
            />
            <ArtifactBar 
              label="Utility" 
              value={scores.artifacts.utility}
              description={config?.artifacts?.utility}
              color="#b197fc"
            />
            <ArtifactBar 
              label="Damage Output" 
              value={scores.artifacts.damage}
              description={config?.artifacts?.damage}
              color="#ff8787"
            />
            <ArtifactBar 
              label="Tanking" 
              value={scores.artifacts.tanking}
              description={config?.artifacts?.tanking}
              color="#ffd43b"
            />
            <ArtifactBar 
              label="Objectives" 
              value={scores.artifacts.objectives}
              description={config?.artifacts?.objectives}
              color="#ff922b"
            />
            <ArtifactBar 
              label="Early Game" 
              value={scores.artifacts.early_game}
              description={config?.artifacts?.early_game}
              color="#f06595"
            />
          </div>
          <div className="artifacts-note">
            <em>Each artifact is weighted according to {scores.detectedRole} role expectations</em>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="metadata-footer">
        <span className="computed-date">
          Computed: {new Date(scores.computedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

/**
 * CircularScore Component
 * 
 * Displays a circular progress chart with the score in the center.
 * Uses SVG for precise circular rendering.
 */
function CircularScore({ value, max = 10, label, color = '#4c6ef5', inverted = false }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate progress as a percentage (0-100)
  const percentage = Math.min(value / max, 1) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine color based on value
  let displayColor = color;
  if (!inverted) {
    if (value >= 7) {
      displayColor = '#51cf66'; // green
    } else if (value >= 5) {
      displayColor = '#ffd43b'; // yellow
    } else if (value >= 3) {
      displayColor = '#ff922b'; // orange
    } else {
      displayColor = '#ff6b6b'; // red
    }
  } else {
    // For feedscore (inverted: lower is better)
    if (value <= 3) {
      displayColor = '#51cf66'; // green (low feedscore is good)
    } else if (value <= 5) {
      displayColor = '#ffd43b'; // yellow
    } else if (value <= 7) {
      displayColor = '#ff922b'; // orange
    } else {
      displayColor = '#ff6b6b'; // red
    }
  }

  return (
    <div className="circular-score">
      <svg viewBox="0 0 120 120" className="circular-chart">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e8e8e8"
          strokeWidth="8"
        />
        
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={displayColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          className="progress-circle"
        />

        {/* Center text */}
        <text
          x="60"
          y="55"
          textAnchor="middle"
          className="score-text"
          fill="#1a1a1a"
        >
          {value.toFixed(1)}
        </text>
        <text
          x="60"
          y="70"
          textAnchor="middle"
          className="score-max-text"
          fill="#999"
        >
          /{max}
        </text>
      </svg>

      <div className="circular-label">{label}</div>
    </div>
  );
}

/**
 * ArtifactBar Component
 * 
 * Displays a single artifact with a horizontal bar and tooltip.
 */
function ArtifactBar({ label, value = 0, description, color }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Normalize value to 0-100 for bar width
  // Assuming artifact values are roughly 0-10 scale
  const percentage = Math.min(Math.max(value, 0), 10) * 10;

  return (
    <div 
      className="artifact-bar"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="artifact-header">
        <span className="artifact-label">{label}</span>
        {description && <span className="info-icon">ⓘ</span>}
        <span className="artifact-value">{value.toFixed(2)}</span>
      </div>
      
      <div className="artifact-bar-container">
        <div 
          className="artifact-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>

      {showTooltip && description && (
        <div className="artifact-tooltip">
          {description}
        </div>
      )}
    </div>
  );
}
