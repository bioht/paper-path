// src/NetworkGraph.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { saveAs } from 'file-saver';
import { FaSave } from 'react-icons/fa';
import LoadingScreen from './LoadingScreen';
import './NetworkGraph.css';
import './GraphSettings.css';

// [Previous utility functions and constants remain unchanged...]

const calculateTopicRelevance = (paper, mainPapers) => {
  if (!paper.topics?.length) {
    return 0;
  }

  // Create map of topic ID to score for the paper being compared
  const paperTopicMap = new Map(paper.topics.map(t => [t.id, t.score || 0]));

  // Calculate average similarity across all main papers
  let totalSimilarity = 0;
  let validMainPapers = 0;

  mainPapers.forEach(mainPaper => {
    if (!mainPaper.topics?.length) return;

    // Create map of topic ID to score for the main paper
    const mainTopicMap = new Map(mainPaper.topics.map(t => [t.id, t.score || 0]));

    // Get all unique topic IDs
    const allTopicIds = new Set([...paperTopicMap.keys(), ...mainTopicMap.keys()]);

    let paperSimilarity = 0;
    let totalWeight = 0;

    // Calculate weighted similarity across all topics
    allTopicIds.forEach(topicId => {
      const score1 = paperTopicMap.get(topicId) || 0;
      const score2 = mainTopicMap.get(topicId) || 0;

      if (score1 > 0 && score2 > 0) {
        // For common topics, use the geometric mean of scores
        const weight = Math.sqrt(score1 * score2);
        paperSimilarity += weight;
      }
      
      // Add to total weight using the max score for normalization
      totalWeight += Math.max(score1, score2);
    });

    // Add normalized similarity score for this main paper
    if (totalWeight > 0) {
      totalSimilarity += paperSimilarity / totalWeight;
      validMainPapers++;
    }
  });

  // Return average similarity score across all main papers
  return validMainPapers > 0 ? totalSimilarity / validMainPapers : 0;
}

// Predefined themes
const THEMES = {
  default: {
    background: '#ffffff',
    node: {
      fill: '#EB5B00',
      highlightFill: '#640D5F',
      textColor: '#333333'
    },
    link: {
      stroke: '#FFB200',
      highlightStroke: '#EB5B00'
    }
  },
  dark: {
    background: '#1a1a1a',
    node: {
      fill: '#4a90e2',
      stroke: '#357abd',
      highlightFill: '#81c784',
      highlightStroke: '#81c784',
      textColor: '#ffffff'
    },
    link: {
      stroke: '#4f4f4f',
      highlightStroke: '#81c784'
    }
  },
  sunset: {
    background: '#2c3e50',
    node: {
      fill: '#e74c3c',
      stroke: '#c0392b',
      highlightFill: '#f39c12',
      highlightStroke: '#f39c12',
      textColor: '#ecf0f1'
    },
    link: {
      stroke: '#34495e',
      highlightStroke: '#f39c12'
    }
  },
  nature: {
    background: '#f4f1de',
    node: {
      fill: '#81b29a',
      stroke: '#3d405b',
      highlightFill: '#e07a5f',
      highlightStroke: '#e07a5f',
      textColor: '#3d405b'
    },
    link: {
      stroke: '#3d405b',
      highlightStroke: '#e07a5f'
    }
  }
};

function NetworkGraph({ paper, onClose }) {
  const navigate = useNavigate();
  const [mainPapers, setMainPapers] = useState([paper]); // Array of main papers
  const [currentMainPaper, setCurrentMainPaper] = useState(paper); // Current main paper being loaded
  const svgRef = useRef();
  const containerRef = useRef();
  const [error, setError] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanding, setIsExpanding] = useState(false);
  const [loadingStats, setLoadingStats] = useState({ refs: '...', cites: '...' });
  const [expandingStats, setExpandingStats] = useState({ cites: 0 });

  // Import API base URL
  const API_BASE_URL = 'http://localhost:5013';
  
  // Paper data cache
  const paperCache = useRef(new Map());

  // Fetch initial paper data with references and citations
  useEffect(() => {
    const fetchPaperData = async () => {
      try {
        const paperId = paper.paperId || paper.id;
        
        // Check cache first
        if (paperCache.current.has(paperId)) {
          const cachedData = paperCache.current.get(paperId);
          const refsCount = cachedData.references?.length || 0;
          const citesCount = cachedData.citations?.length || 0;
          setLoadingStats({ refs: refsCount, cites: citesCount });
          
          setIsLoading(true);
          setError(null);
          
          if (cachedData.references?.length > 0 || cachedData.citations?.length > 0) {
            console.log('Using cached data with refs/cites:', cachedData);
            setMainPapers([cachedData]);
            setCurrentMainPaper(cachedData);
            setIsLoading(false);
            return;
          }
        }

        console.log('Fetching paper data for:', paperId);
        const response = await fetch(`${API_BASE_URL}/api/paper/${paperId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch paper data');
        }
        const fullPaperData = await response.json();
        
        // Validate the data
        if (!fullPaperData) {
          throw new Error('Received empty paper data');
        }

        // Get initial counts from paper prop
        const initialRefsCount = paper.references?.length || 0;
        const initialCitesCount = paper.citations?.length || 0;
        setLoadingStats({ refs: initialRefsCount, cites: initialCitesCount });
        
        setIsLoading(true);
        setError(null);

        console.log('Received paper data:', {
          id: fullPaperData.id,
          title: fullPaperData.title,
          initialRefsCount,
          initialCitesCount
        });

        // Ensure we have arrays for references and citations
        fullPaperData.references = fullPaperData.references || [];
        fullPaperData.citations = fullPaperData.citations || [];

        if (fullPaperData.references.length === 0 && fullPaperData.citations.length === 0) {
          console.warn('Paper data has no references or citations:', paperId);
        }

        // Cache the complete data
        paperCache.current.set(paperId, fullPaperData);
        
        // Update state with the complete data
        setMainPapers([fullPaperData]);
        setCurrentMainPaper(fullPaperData);
      } catch (error) {
        console.error('Error fetching paper data:', error);
        setError('Failed to load paper data: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPaperData();
  }, [paper.id, paper.paperId]);

  const [readPapers, setReadPapers] = useState(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem('readPapers');
    return new Set(saved ? JSON.parse(saved) : []);
  });

  // Save to localStorage whenever readPapers changes
  useEffect(() => {
    localStorage.setItem('readPapers', JSON.stringify(Array.from(readPapers)));
  }, [readPapers]);

  const markAsRead = (paperId) => {
    setReadPapers(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(paperId);
      return newSet;
    });
  };

  const [topicThreshold, setTopicThreshold] = useState(0.1);
  const [lastPapersKey, setLastPapersKey] = useState('');
  const [forceUpdate, setForceUpdate] = useState(0);

  // Function to find the 15th highest similarity score
  const findInitialThreshold = (papers) => {
    const allScores = [];
    const { yearRange, minCitations, showReferences, showCitations } = settings;

    // Calculate all similarity scores with filters applied
    papers.forEach(mainPaper => {
      // Get scores from references
      if (showReferences && mainPaper.references) {
        mainPaper.references.forEach(ref => {
          // Apply filters before calculating score
          if (ref?.year != null && 
              ref.year >= yearRange.min && 
              ref.year <= yearRange.max && 
              (ref.citationCount || 0) >= minCitations &&
              matchesKeyword(ref)) {
            const score = calculateTopicRelevance(ref, mainPapers);
            if (score > 0) allScores.push(score);
          }
        });
      }

      // Get scores from citations
      if (showCitations && mainPaper.citations) {
        mainPaper.citations.forEach(cit => {
          // Apply filters before calculating score
          if (cit?.year != null && 
              cit.year >= yearRange.min && 
              cit.year <= yearRange.max && 
              (cit.citationCount || 0) >= minCitations &&
              matchesKeyword(cit)) {
            const score = calculateTopicRelevance(cit, mainPapers);
            if (score > 0) allScores.push(score);
          }
        });
      }
    });

    // Sort scores in descending order
    allScores.sort((a, b) => b - a);
    console.log('Filtered scores:', allScores);

    // Get the 15th score or the last score if less than 15 scores
    const threshold = allScores[Math.min(14, allScores.length - 1)] || 0.1;
    console.log(`Initial threshold set to ${threshold.toFixed(3)} (${allScores.length} filtered scores)`);
    return threshold;
  };

  const [settings, setSettings] = useState({
    yearRange: { min: 1900, max: new Date().getFullYear() },
    minCitations: 0,
    keyword: '',
    showReferences: true,
    showCitations: true,
    theme: 'default'
  });

  const [tempSettings, setTempSettings] = useState({
    yearRange: { min: 1900, max: new Date().getFullYear() },
    minCitations: 0,
    keyword: '',
    showReferences: true,
    showCitations: true,
    theme: 'default'
  });

  // Refs for input elements
  const yearMinRef = useRef(null);
  const yearMaxRef = useRef(null);
  const citationsRef = useRef(null);
  const keywordRef = useRef(null);

  // Update CSS variables when theme changes
  useEffect(() => {
    const theme = THEMES[settings.theme];
    const root = document.documentElement;
    
    root.style.setProperty('--tooltip-bg', theme.background);
    root.style.setProperty('--tooltip-border', theme.node.stroke);
    root.style.setProperty('--tooltip-color', theme.node.textColor);
    
    root.style.setProperty('--panel-bg', theme.background);
    root.style.setProperty('--panel-border', theme.node.stroke);
    root.style.setProperty('--panel-color', theme.node.textColor);
    
    root.style.setProperty('--input-bg', theme.background);
    root.style.setProperty('--input-border', theme.node.stroke);
    root.style.setProperty('--input-color', theme.node.textColor);
  }, [settings.theme]);

  // Settings Panel Component
  const SettingsPanel = () => {
    return (
      <div className="settings-panel">
        <div className="settings-grid">
          <div className="setting-group">
            <label>Topic Similarity Threshold: {topicThreshold.toFixed(3)}
              <br />
              <small style={{ fontSize: '12px', color: '#666' }}>
                Reduce for more papers
              </small>
            </label>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                setTopicThreshold(prev => Math.min(1, prev + 0.05));
                setForceUpdate(prev => prev + 1);
              }}
                disabled={topicThreshold >= 1}
                style={{
                  padding: '4px 8px',
                  cursor: topicThreshold >= 1 ? 'not-allowed' : 'pointer',
                  opacity: topicThreshold >= 1 ? 0.5 : 1
                }}
              >
                ▲
              </button>
              <button
                onClick={() => {
                setTopicThreshold(prev => Math.max(0, prev - 0.05));
                setForceUpdate(prev => prev + 1);
              }}
                disabled={topicThreshold <= 0}
                style={{
                  padding: '4px 8px',
                  cursor: topicThreshold <= 0 ? 'not-allowed' : 'pointer',
                  opacity: topicThreshold <= 0 ? 0.5 : 1
                }}
              >
                ▼
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label>Year Range</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                defaultValue={tempSettings.yearRange.min}
                ref={yearMinRef}
                style={{
                  width: '20px',
                  padding: '2px 4px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                onBlur={() => {
                  setTempSettings(prev => ({
                    ...prev,
                    yearRange: { ...prev.yearRange, min: parseInt(yearMinRef.current.value) }
                  }));
                }}
              />
              <span style={{ opacity: 0.6 }}>–</span>
              <input
                type="number"
                defaultValue={tempSettings.yearRange.max}
                ref={yearMaxRef}
                style={{
                  width: '20px',
                  padding: '2px 4px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
                onBlur={() => {
                  setTempSettings(prev => ({
                    ...prev,
                    yearRange: { ...prev.yearRange, max: parseInt(yearMaxRef.current.value) }
                  }));
                }}
              />
            </div>
          </div>

          <div className="setting-group">
            <label>Min Citations</label>
            <input
              type="number"
              defaultValue={tempSettings.minCitations}
              ref={citationsRef}
              style={{
                width: '60px',
                padding: '2px 4px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              onBlur={() => {
                setTempSettings(prev => ({
                  ...prev,
                  minCitations: parseInt(citationsRef.current.value)
                }));
              }}
            />
          </div>

          <div className="setting-group">
            <label>Keyword Filter</label>
            <input
              type="text"
              defaultValue={tempSettings.keyword}
              ref={keywordRef}
              placeholder="Filter by keyword"
              style={{
                width: '200px',
                padding: '2px 4px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              onBlur={() => {
                setTempSettings(prev => ({
                  ...prev,
                  keyword: keywordRef.current.value
                }));
              }}
            />
          </div>

          <div className="setting-group">
            <button
              onClick={() => {
                // Update settings and force update in a single batch
                Promise.resolve().then(() => {
                  setSettings(tempSettings);
                  setForceUpdate(prev => prev + 1);
                  
                  

                });
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#EB5B00',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Apply Filters
            </button>
          </div>

          <div className="setting-group">
            <label htmlFor="showRefs">
              <input
                type="checkbox"
                id="showRefs"
                checked={tempSettings.showReferences}
                onChange={(e) => setTempSettings(prev => ({
                  ...prev,
                  showReferences: e.target.checked
                }))}
              />
              References
            </label>
          </div>

          <div className="setting-group">
            <label htmlFor="showCites">
              <input
                type="checkbox"
                id="showCites"
                checked={tempSettings.showCitations}
                onChange={(e) => setTempSettings(prev => ({
                  ...prev,
                  showCitations: e.target.checked
                }))}
              />
              Citations
            </label>
          </div>
        </div>
      </div>
    );
  };


  // Function to check if paper matches any of the comma-separated keywords
  const matchesKeyword = (paper) => {
    if (!settings.keyword) return true;
    const keywords = settings.keyword.toLowerCase().split(',').map(k => k.trim());
    return keywords.every(keyword => 
      (paper.title?.toLowerCase().includes(keyword) || false) ||
      (paper.abstract?.toLowerCase().includes(keyword) || false)
    );
  };

  // Function to expand network from a new main paper
  const expandNetwork = async (newMainPaper) => {
    try {
      setIsExpanding(true);
      setError(null);
      
      // Set expanding stats using the paper being expanded
      setExpandingStats({ cites: newMainPaper.citationCount || 0 });
      
      // Store the current position of the node if it exists in the visualization
      const existingNode = d3.select(svgRef.current)
        .select('.nodes')
        .selectAll('g')
        .filter(d => d && (d.id === newMainPaper.id || d.id === newMainPaper.paperId))
        .datum();
      
      const initialPosition = existingNode ? { x: existingNode.x, y: existingNode.y } : null;
      
      // Fetch full paper data with references and citations
      const paperId = newMainPaper.paperId || newMainPaper.id;
      console.log('Expanding network for paper:', paperId);
      
      const response = await fetch(`${API_BASE_URL}/api/paper/${paperId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch paper data');
      }
      const fullPaperData = await response.json();
      
      // Validate the expanded data
      if (!fullPaperData) {
        throw new Error('Received empty paper data during expansion');
      }

      console.log('Received expanded paper data:', {
        id: fullPaperData.id,
        title: fullPaperData.title,
        refsCount: fullPaperData.references?.length,
        citesCount: fullPaperData.citations?.length
      });

      // Ensure we have arrays for references and citations
      fullPaperData.references = fullPaperData.references || [];
      fullPaperData.citations = fullPaperData.citations || [];

      if (fullPaperData.references.length === 0 && fullPaperData.citations.length === 0) {
        console.warn('Expanded paper has no references or citations:', paperId);
      }
      // Limit citations for very large papers to prevent localStorage quota issues
      const limitedPaperData = {
        ...fullPaperData,
        citations: fullPaperData.citations?.length > 1000 
          ? fullPaperData.citations.slice(0, 1000) 
          : fullPaperData.citations
      };

      // Add the new paper to mainPapers array if it's not already there
      setMainPapers(prev => {
        const existingIds = prev.map(p => p.id || p.paperId);
        if (!existingIds.includes(paperId)) {
          // Store the initial position with the paper data
          return [...prev, { ...limitedPaperData, initialPosition }];
        }
        return prev;
      });
      
      // Set as current main paper
      setCurrentMainPaper(fullPaperData);
      setSelectedPaper(null);
    } catch (error) {
      console.error('Error expanding network:', error);
      setError('Failed to expand network: ' + error.message);
    } finally {
      setIsExpanding(false);
      setForceUpdate(prev => prev + 1);
    }
  };

  // Store current node positions
  const nodePositionsRef = useRef(new Map());

  // Store the simulation reference
  const simulationRef = useRef(null);

  // Initialize or update the graph when mainPaper or settings change
  useEffect(() => {
    if (mainPapers.length === 0 || isLoading) return;

    // Log paper data to help debug
    console.log('Main papers:', mainPapers);
    mainPapers.forEach(paper => {
      console.log(`Paper ${paper.id || paper.paperId}:`);
      console.log('References:', paper.references?.length);
      console.log('Citations:', paper.citations?.length);
    });

    try {
      
      // Clear any previous errors
      setError(null);

      const getRelevanceScore = (paper) => {
        if (!paper.year) return 0.5;
        const currentYear = new Date().getFullYear();
        const yearDiff = Math.max(0, currentYear - paper.year);
        const recencyScore = Math.exp(-yearDiff / 20);
        const citationScore = Math.log((paper.citationCount || 0) + 1) / Math.log(100);
        return (recencyScore + citationScore) / 2;
      };

      const { yearRange, minCitations, showReferences, showCitations, showRelated } = settings;
      const nodes = [];
      const links = [];
      const nodeMap = {};

      // Add all main papers as central nodes
      mainPapers.forEach(paper => {
        const paperId = paper.paperId || paper.id;
        if (!paperId) {
          console.error('No paper ID found:', paper);
          return;
        }
        
        const mainNode = {
          id: paperId,
          paperId: paperId,  // Keep both for consistency
          title: paper.title,
          isCentral: true,
          year: paper.year,
          authors: paper.authors?.map(a => a.name || a) || [],
          abstract: paper.abstract,
          citationCount: paper.citationCount || 0,
          journalInfo: paper.journalInfo,
          doi: paper.doi,
          url: paper.url,
          relevanceScore: 1
        };
        nodes.push(mainNode);
        nodeMap[paperId] = mainNode;
      });
      
      const addNodeAndConnections = (paperData, type) => {
        const paperId = paperData?.id || paperData?.paperId;
        if (!paperId || !paperData?.title) return null;
        const relevanceScore = getRelevanceScore(paperData);
        if (relevanceScore < 0.5) return null;
        const node = {
          id: paperId,
          paperId: paperId,  // Keep both for consistency
          title: paperData.title,
          isCentral: false,
          year: paperData.year,
          authors: paperData.authors?.map(a => a.name || a) || [],
          abstract: paperData.abstract,
          citationCount: paperData.citationCount || 0,
          journalInfo: paperData.journalInfo,
          doi: paperData.doi,
          url: paperData.url,
          type: type,
          relevanceScore: relevanceScore
        };
        if (!nodeMap[paperId]) {
          nodes.push(node);
          nodeMap[paperId] = node;
        }
        return node;
      };

      // Process references in batches
      const processBatch = (items, processItem) => {
        const batchSize = 10;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          batch.forEach(processItem);
        }
      };

      // Process references for each main paper
      if (showReferences) {
        mainPapers.forEach(mainPaper => {
          const mainPaperId = mainPaper.paperId || mainPaper.id;
          if (Array.isArray(mainPaper.references)) {
            processBatch(mainPaper.references, ref => {
              const refId = ref?.id || ref?.paperId;
              if (refId && ref?.year != null && 
                  ref.year >= yearRange.min && ref.year <= yearRange.max && 
                  (ref.citationCount || 0) >= minCitations &&
                  matchesKeyword(ref)) {
                // Calculate similarity score
                const topicScore = calculateTopicRelevance(ref, mainPapers);
                if (topicScore >= topicThreshold) {
                  const refData = {
                    id: refId,
                    title: ref.title,
                    year: ref.year,
                    authors: ref.authors?.map(a => a.name) || [],
                    journalInfo: ref.journalInfo,
                    citationCount: ref.citationCount || 0,
                    abstract: ref.abstract,
                    doi: ref.doi,
                    url: ref.url
                  };
                  const refNode = addNodeAndConnections(refData, 'reference');
                  if (refNode) {
                    links.push({ 
                      source: mainPaperId, 
                      target: refId, 
                      type: 'cites',
                      strength: refNode.relevanceScore
                    });
                  }
                }
              }
            });
          }
        });
      }

      // Process citations for each main paper
      if (showCitations) {
        mainPapers.forEach(mainPaper => {
          const mainPaperId = mainPaper.paperId || mainPaper.id;
          if (mainPaper.citations && Array.isArray(mainPaper.citations)) {
            processBatch(mainPaper.citations, cit => {
              const citId = cit?.id || cit?.paperId;
              if (cit && citId && cit.year != null && 
                  cit.year >= yearRange.min && cit.year <= yearRange.max && 
                  (cit.citationCount || 0) >= minCitations &&
                  matchesKeyword(cit)) {
                // Calculate similarity score
                const topicScore = calculateTopicRelevance(cit, mainPapers);
                if (topicScore >= topicThreshold) {
                  const citData = {
                    id: citId,
                    title: cit.title,
                    year: cit.year,
                    authors: cit.authors?.map(a => a.name) || [],
                    journalInfo: cit.journalInfo,
                    citationCount: cit.citationCount || 0,
                    abstract: cit.abstract,
                    doi: cit.doi,
                    url: cit.url
                  };
                  const citNode = addNodeAndConnections(citData, 'citation');
                  if (citNode) {
                    links.push({ 
                      source: citId, 
                      target: mainPaperId, 
                      type: 'cites',
                      strength: citNode.relevanceScore
                    });
                    
                  }
                }
              }
            });
          }
        });
      }

      if (showRelated) {
        const directlyConnectedIds = new Set(
          links.map(link => 
            link.source === paper.id ? link.target : 
            link.target === paper.id ? link.source : null
          ).filter(id => id !== null)
        );
        const crossCitations = {};
        paper.references?.forEach(ref1 => {
          if (!directlyConnectedIds.has(ref1.paperId)) return;
          paper.references?.forEach(ref2 => {
            if (ref1.paperId === ref2.paperId) return;
            if (!directlyConnectedIds.has(ref2.paperId)) return;
            const ref1Citations = ref1.citations?.map(c => c.paperId) || [];
            if (ref1Citations.includes(ref2.paperId)) {
              const key = [ref1.paperId, ref2.paperId].sort().join('-');
              if (!crossCitations[key]) {
                const node1 = nodeMap[ref1.paperId];
                const node2 = nodeMap[ref2.paperId];
                if (node1 && node2) {
                  links.push({
                    source: ref1.paperId,
                    target: ref2.paperId,
                    type: 'related',
                    strength: Math.min(node1.relevanceScore, node2.relevanceScore) * 0.3
                  });
                  crossCitations[key] = true;
                }
              }
            }
          });
        });
      }

      if (nodes.length === 0) {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        svg.append('text')
          .attr('x', 400)
          .attr('y', 300)
          .attr('text-anchor', 'middle')
          .text('No connected papers found');
        return;
      }

      // Clear existing SVG content
      d3.select(svgRef.current).selectAll("*").remove();

      // Create zoom behavior
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      // Get container dimensions
      const container = containerRef.current;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const svg = d3.select(svgRef.current)
        .attr("width", width)
        .attr("height", height)
        .style('background', THEMES[settings.theme].background)
        .call(zoom);
        
      // Add resize observer
      const updateLayout = () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        
        if (simulationRef.current) {
          simulationRef.current
            .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
            .force('x', d3.forceX(newWidth / 2).strength(d => d.id === paper.id ? 0.8 : 0.1))
            .force('y', d3.forceY(newHeight / 2).strength(d => d.id === paper.id ? 0.8 : 0.1))
            .alpha(0.3)
            .restart();
        }
      };
      
      const resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(container);
      
      // Initial layout update
      updateLayout();

      // Add a group for the zoom container
      const g = svg.append('g')
        .attr('class', 'zoom-container');

      // Calculate center position
      const centerY = height / 2;

      // Set initial node positions
      nodes.forEach(node => {
        // Check if we have a stored position for this node
        const storedPosition = nodePositionsRef.current.get(node.id);
        if (storedPosition) {
          // Use stored position and velocity
          node.x = storedPosition.x;
          node.y = storedPosition.y;
          node.vx = storedPosition.vx;
          node.vy = storedPosition.vy;
        } else {
          // Find if this node is a main paper and has an initial position
          const mainPaper = mainPapers.find(p => p.id === node.id || p.paperId === node.id);
          if (mainPaper && mainPaper.initialPosition) {
            // Use the stored position from when it was selected
            node.x = mainPaper.initialPosition.x;
            node.y = mainPaper.initialPosition.y;
          } else {
            // Random position around the center, avoiding settings panel area
            node.x = width / 2 + (Math.random() - 0.5) * 100;
            node.y = centerY + (Math.random() - 0.5) * (height * 0.5);
          }
        }
      });

      // Center the initial view
      svg.call(zoom.transform, d3.zoomIdentity);

     
      // Function to fit view to all nodes
      const zoomToFit = () => {
        const bounds = g.node().getBBox();
        const fullWidth = width;
        const fullHeight = height;
        const padding = 50; // Padding around the graph

        const scale = 0.95 * Math.min(
          fullWidth / (bounds.width + padding * 2),
          fullHeight / (bounds.height + padding * 2)
        );

        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        const transform = d3.zoomIdentity
          .translate(fullWidth / 2, fullHeight / 2)
          .scale(scale)
          .translate(-centerX, -centerY);

        svg.transition()
          .duration(750)
          .call(zoom.transform, transform);
      };

      // Add legend
      const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 150}, 20)`);

      // Legend background
      legend.append('rect')
        .attr('width', 130)
        .attr('height', 90)
        .attr('rx', 5)
        .style('fill', '#fff')
        .style('stroke', '#999')
        .style('opacity', 0.9);

      // Legend items
      const legendItems = [
        { label: 'Main Papers', color: THEMES[settings.theme].node.highlightFill, y: 20 },
        { label: 'References', color: '#EB5B00', y: 45 },
        { label: 'Citations', color: '#D91656', y: 70 }
      ];

      legendItems.forEach(item => {
        // Circle
        legend.append('circle')
          .attr('cx', 20)
          .attr('cy', item.y)
          .attr('r', 6)
          .style('fill', item.color);

        // Label
        legend.append('text')
          .attr('x', 35)
          .attr('y', item.y + 4)
          .style('font-size', '12px')
          .style('fill', THEMES[settings.theme].node.textColor)
          .text(item.label);
      });

      // Add zoom controls
      const zoomControls = svg.append('g')
        .attr('class', 'zoom-controls')
        .attr('transform', 'translate(20, 20)');

      // Zoom in button
      zoomControls.append('rect')
        .attr('class', 'zoom-button')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 30)
        .attr('height', 30)
        .attr('rx', 5)
        .style('fill', '#fff')
        .style('stroke', '#999')
        .style('cursor', 'pointer')
        .on('click', () => {
          svg.transition().duration(300).call(zoom.scaleBy, 1.3);
        });

      zoomControls.append('text')
        .attr('x', 15)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('pointer-events', 'none')
        .style('fill', THEMES[settings.theme].node.textColor)
        .text('+');

      // Zoom out button
      zoomControls.append('rect')
        .attr('class', 'zoom-button')
        .attr('x', 0)
        .attr('y', 40)
        .attr('width', 30)
        .attr('height', 30)
        .attr('rx', 5)
        .style('fill', '#fff')
        .style('stroke', '#999')
        .style('cursor', 'pointer')
        .on('click', () => {
          svg.transition().duration(300).call(zoom.scaleBy, 0.7);
        });

      zoomControls.append('text')
        .attr('x', 15)
        .attr('y', 60)
        .attr('text-anchor', 'middle')
        .style('font-size', '20px')
        .style('pointer-events', 'none')
        .style('fill', THEMES[settings.theme].node.textColor)
        .text('−');

      // Fit to view button
      zoomControls.append('rect')
        .attr('class', 'zoom-button')
        .attr('x', 0)
        .attr('y', 80)
        .attr('width', 30)
        .attr('height', 30)
        .attr('rx', 5)
        .style('fill', '#fff')
        .style('stroke', '#999')
        .style('cursor', 'pointer')
        .on('click', zoomToFit);

      zoomControls.append('text')
        .attr('x', 15)
        .attr('y', 100)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('pointer-events', 'none')
        .style('fill', THEMES[settings.theme].node.textColor)
        .text('⊡');

      // Save button
      zoomControls.append('rect')
        .attr('class', 'zoom-button')
        .attr('x', 0)
        .attr('y', 120)
        .attr('width', 30)
        .attr('height', 30)
        .attr('rx', 5)
        .style('fill', '#fff')
        .style('stroke', '#999')
        .style('cursor', 'pointer')
        .on('click', () => {
          // Get current visible papers
          const visiblePapers = [];
          const nodeMap = {};
          
          // Add main papers
          mainPapers.forEach(paper => {
            visiblePapers.push({
              id: paper.id || paper.paperId,
              title: paper.title,
              authors: paper.authors,
              year: paper.year,
              citationCount: paper.citationCount,
              abstract: paper.abstract,
              doi: paper.doi,
              url: paper.url,
              journalInfo: paper.journalInfo,
              isMain: true
            });
            nodeMap[paper.id || paper.paperId] = true;
          });

          // Add connected papers
          mainPapers.forEach(paper => {
            if (settings.showReferences && paper.references) {
              paper.references.forEach(ref => {
                if (!nodeMap[ref.id] && 
                    ref.year >= settings.yearRange.min &&
                    ref.year <= settings.yearRange.max &&
                    (ref.citationCount || 0) >= settings.minCitations &&
                    calculateTopicRelevance(ref, mainPapers) >= topicThreshold &&
                    matchesKeyword(ref)) {
                  visiblePapers.push({
                    id: ref.id,
                    title: ref.title,
                    authors: ref.authors,
                    year: ref.year,
                    citationCount: ref.citationCount,
                    abstract: ref.abstract,
                    doi: ref.doi,
                    url: ref.url,
                    journalInfo: ref.journalInfo,
                    isMain: false
                  });
                }
              });
            }

            if (settings.showCitations && paper.citations) {
              paper.citations.forEach(cit => {
                if (!nodeMap[cit.id] && 
                    cit.year >= settings.yearRange.min &&
                    cit.year <= settings.yearRange.max &&
                    (cit.citationCount || 0) >= settings.minCitations &&
                    calculateTopicRelevance(cit, mainPapers) >= topicThreshold &&
                    matchesKeyword(cit)) {
                  visiblePapers.push({
                    id: cit.id,
                    title: cit.title,
                    authors: cit.authors,
                    year: cit.year,
                    citationCount: cit.citationCount,
                    abstract: cit.abstract,
                    doi: cit.doi,
                    url: cit.url,
                    journalInfo: cit.journalInfo,
                    isMain: false
                  });
                }
              });
            }
          });

          // Save to localStorage
          const savedGraphs = JSON.parse(localStorage.getItem('savedGraphs') || '[]');
          savedGraphs.push({
            id: Date.now(),
            date: new Date().toISOString(),
            papers: visiblePapers,
            settings: {
              yearRange: settings.yearRange,
              minCitations: settings.minCitations,
              topicThreshold: topicThreshold,
              showReferences: settings.showReferences,
              showCitations: settings.showCitations,
              keyword: settings.keyword // Add keyword filter to saved settings
            }
          });
          localStorage.setItem('savedGraphs', JSON.stringify(savedGraphs));
          
          navigate('/savedgraphs', { replace: true });
        });

        zoomControls.append('foreignObject')
          .attr('x', 5)
          .attr('y', 125)
          .attr('width', 30)
          .attr('height', 30)
          .append('xhtml:i')
          .attr('class', 'fas fa-save')
          .style('font-size', '20px')
          .style('color', THEMES[settings.theme].node.textColor);

      // Go to Saved Graphs button
      zoomControls.append('rect')
        .attr('class', 'zoom-button')
        .attr('x', 0)
        .attr('y', 160)
        .attr('width', 30)
        .attr('height', 30)
        .attr('rx', 5)
        .style('fill', '#fff')
        .style('stroke', '#999')
        .style('cursor', 'pointer')
        .on('click', () => {
          navigate('/savedgraphs');
        });

      zoomControls.append('foreignObject')
        .attr('x', 5)
        .attr('y', 165)
        .attr('width', 30)
        .attr('height', 30)
        .append('xhtml:i')
        .attr('class', 'fas fa-folder-open')
        .style('font-size', '20px')
        .style('color', THEMES[settings.theme].node.textColor);

      // Tooltip
      const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

      // Calculate citation depth for each node
      
      


      // Create scale for node sizes with bigger difference
      const minSize = 8;
      const maxSize = 35;
      
      const maxCitations = 30000;
      const nodeScale = d3.scalePow()
        .exponent(0.5)
        .domain([1, maxCitations])
        .range([minSize, maxSize])
        .clamp(true);
      
      // Enhanced force simulation with centered main paper and boundary forces
      // Define cluster centers with more spread
      const clusters = {
        reference: { x: width * 0.2, y: height / 2 },  // More to the left
        citation: { x: width * 0.8, y: height / 2 },    // More to the right
        central: { x: width / 2, y: height / 2 }
      };

      // Filter and validate nodes and links
      const validNodes = nodes.filter(node => node && node.id);
      const validLinks = links.map(link => ({
        source: nodeMap[link.source] || link.source,
        target: nodeMap[link.target] || link.target,
        type: link.type,
        strength: link.strength
      })).filter(link => link.source && link.target);

      // Calculate year-based distances
      const mainYear = paper.year || new Date().getFullYear();
      const yearBounds = {
        min: d3.min(validNodes, d => d.year || mainYear),
        max: d3.max(validNodes, d => d.year || mainYear)
      };
      
      // Scale for year-based distance
      const yearDistanceScale = d3.scaleLinear()
        .domain([0, Math.max(
          Math.abs(yearBounds.max - mainYear),
          Math.abs(yearBounds.min - mainYear)
        )])
        .range([100, 500]); // Min and max distances in pixels

      // Create a stronger clustering force with year-based positioning
      const forceCluster = (alpha) => {
        const referenceNodes = validNodes.filter(n => n.type === 'reference');
        
        // Calculate center of mass for reference nodes
        if (referenceNodes.length > 0) {
          const refCenterX = d3.mean(referenceNodes, d => d.x);
          const refCenterY = d3.mean(referenceNodes, d => d.y);
          
          // Additional force to keep references close to each other
          referenceNodes.forEach(node => {
            const dx = node.x - refCenterX;
            const dy = node.y - refCenterY;
            const l = Math.sqrt(dx * dx + dy * dy);
            if (l > 1) {
              node.vx -= (dx / l) * alpha * 1.2; // Stronger clustering for refs
              node.vy -= (dy / l) * alpha * 1.2;
            }
          });
        }

        // Apply main clustering force with year-based distance
        for (let node of validNodes) {
          if (node.id === paper.id) continue; // Skip main paper

          const yearDiff = Math.abs((node.year || mainYear) - mainYear);
          const targetDistance = yearDistanceScale(yearDiff);
          
          // Calculate base cluster position
          const cluster = node.type === 'reference' ? clusters.reference : clusters.citation;
          
          // Calculate angle from center to cluster
          const angleToCluster = Math.atan2(cluster.y - height/2, cluster.x - width/2);
          
          // Calculate target position based on year
          const targetX = width/2 + Math.cos(angleToCluster) * targetDistance;
          const targetY = height/2 + Math.sin(angleToCluster) * targetDistance;
          
          // Adjust force strength based on type and distance
          const k = node.type === 'reference' ? 1.2 * alpha : 0.8 * alpha;
          
          // Calculate force
          const dx = node.x - targetX;
          const dy = node.y - targetY;
          const l = Math.sqrt(dx * dx + dy * dy);
          
          if (l > 1) {
            node.vx -= (dx / l) * k;
            node.vy -= (dy / l) * k;
          }
        }
      };

      // Calculate positions for main papers in a circle
      const mainPaperIds = mainPapers.map(p => p.id || p.paperId);
      const mainPaperCount = mainPaperIds.length;
      const mainPaperRadius = Math.min(width, height) * 0.35; // Increased radius for main papers

      // If simulation exists, stop it
      if (simulationRef.current) {
        simulationRef.current.stop();
      }

      // Create new simulation or update existing one
      if (!simulationRef.current) {
        simulationRef.current = d3.forceSimulation()
          .force("link", d3.forceLink().id(d => d.id))
          .force("charge", d3.forceManyBody().strength(d => {
            // Stronger repulsion for high-citation nodes
            const citations = d.citationCount || 0;
            return -300 * (1 + Math.log(citations + 1) / 5);
          }).distanceMax(500))
          .force("center", d3.forceCenter(width / 2, height / 2).strength(d => {
            // Higher citation nodes pulled more toward center
            const citations = d.citationCount || 0;
            return 0.5 * (1 + Math.log(citations + 1) / 5);
          }))
          .force("collide", d3.forceCollide()
            .radius(d => mainPaperIds.includes(d.id) ? 50 : 30)
            .strength(0.8)
            .iterations(3))
          .force("bounds", (alpha) => {
            // Keep nodes within bounds
            const padding = 50;
            validNodes.forEach(d => {
              d.x = Math.max(padding, Math.min(width - padding, d.x));
              d.y = Math.max(padding, Math.min(height - padding, d.y));
            });
          });
      }

      // Calculate initial threshold based on filtered nodes
      const papersKey = mainPapers.map(p => p.id).join(',');
      if (papersKey !== lastPapersKey) {
        const initialThreshold = findInitialThreshold(mainPapers);
        setLastPapersKey(papersKey);
        if (initialThreshold !== topicThreshold) {
          setTopicThreshold(initialThreshold);
          return; // Will re-render with new threshold
        }
      }

      // Update simulation with new nodes and links
      simulationRef.current
        .nodes(validNodes)
        .force("link")
        .links(validLinks);

      // Update force parameters with tighter constraints
      simulationRef.current
        .force("link")
        .distance(d => {
          if (mainPaperIds.includes(d.source.id) && mainPaperIds.includes(d.target.id)) {
            return 25;
          }
          return mainPaperIds.includes(d.source.id) || mainPaperIds.includes(d.target.id) ? 100 : 50;
        })
        .strength(d => {
          if (mainPaperIds.includes(d.source.id) && mainPaperIds.includes(d.target.id)) {
            return 0.3;
          }
          return 0.4;
        });

      simulationRef.current
        .force("charge")
        .strength(d => mainPaperIds.includes(d.id) ? -400 : -200)
        .distanceMax(400);

      // Update collision force parameters
      simulationRef.current
        .force("collide")
        .radius(d => {
          const baseRadius = mainPaperIds.includes(d.id) ? 30 : 
            (d.citationCount ? nodeScale(d.citationCount + 1) : minSize);
          return baseRadius + 50;
        })
        .strength(0.9)
        .iterations(4);

      // Gently restart the simulation
      simulationRef.current
        .alpha(0.1)
        .force("mainPapers", alpha => {
          // Position main papers in a circle
          validNodes.forEach(node => {
            if (mainPaperIds.includes(node.id)) {
              const index = mainPaperIds.indexOf(node.id);
              const angle = (2 * Math.PI * index) / mainPaperCount;
              const targetX = width/2 + mainPaperRadius * Math.cos(angle);
              const targetY = height/2 + mainPaperRadius * Math.sin(angle);
              
              // Stronger force to maintain positions
              const strength = alpha * 1.5;
              node.vx -= (node.x - targetX) * strength;
              node.vy -= (node.y - targetY) * strength;
            }
          });
        })
        .force("cluster", forceCluster) // Custom clustering force
        .force("x", d3.forceX(d => {
          // Horizontal positioning force
          if (mainPapers.some(p => d.id === (p.id || p.paperId))) return width / 2;
          return d.type === 'reference' ? width * 0.15 : width * 0.85; // More spread between references and citations
        }).strength(0.2))
        .force("y", d3.forceY(height / 2).strength(0.1))
        .alphaDecay(0.15) // Even slower decay for better settling
        .velocityDecay(0.08) // Slightly more damping for stability
        .alpha(5) // Full initial energy
        .on('end', () => {
          // Auto-fit view after simulation stabilizes
          zoomToFit();
        });

      // Add arrow markers for directed edges
      

      // Links with enhanced styling and different arrows for refs/citations
      const link = g.append("g")
        .attr("class", "links")
        .selectAll("path")
        .data(validLinks)
        .enter().append("path")
        .attr("stroke-width", d => {
          if (mainPapers.some(p => d.source.id === (p.id || p.paperId) || d.target.id === (p.id || p.paperId))) return 0.8;
          return d.source.type === 'reference' ? 0.5 : 0.3;
        })
        .attr("stroke", d => {
          if (mainPapers.some(p => d.source.id === (p.id || p.paperId) || d.target.id === (p.id || p.paperId))) {
            return d.source.type === 'reference' ? '#EB5B00' : '#D91656';
          }
          return d.source.type === 'reference' ? '#FF8F59' : '#FF4081';
        })
        .attr("opacity", d => {
          if (mainPapers.some(p => d.source.id === (p.id || p.paperId) || d.target.id === (p.id || p.paperId))) return 0.4;
          return d.source.type === 'reference' ? 0.25 : 0.15;
        })
        .attr("marker-end", d => 
          d.source.type === 'reference' ? "url(#arrow-reference)" : "url(#arrow-citation)"
        )
        .attr("stroke-linecap", "round")
        .attr("stroke-dasharray", d => 
          d.source.type === 'reference' ? "none" : "2,2"
        )
        .attr("fill", "none")
        .style("pointer-events", "none");
        

      // Helper function to create complex curved paths
      const linkArc = d => {
        if (!d.source || !d.target || 
            typeof d.source.x === 'undefined' || typeof d.target.x === 'undefined' ||
            typeof d.source.y === 'undefined' || typeof d.target.y === 'undefined' ||
            isNaN(d.source.x) || isNaN(d.target.x) || 
            isNaN(d.source.y) || isNaN(d.target.y)) {
          console.warn('Invalid link data:', d);
          return '';
        }

        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If distance is too small, draw a straight line
        if (distance < 1) {
          return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        }

        // Calculate control points for a more complex curve
        const midX = (d.source.x + d.target.x) / 2;
        const midY = (d.source.y + d.target.y) / 2;

        // Add some randomness to make curves unique
        const uniqueOffset = ((Math.round(d.source.x) * 7919) + (Math.round(d.target.y) * 6397)) % 100;
        const offsetScale = distance / 4;

        // Calculate perpendicular offset for control points
        const perpX = (-dy / distance) * offsetScale;
        const perpY = (dx / distance) * offsetScale;

        // Create multiple control points
        const cp1x = midX + perpX + (uniqueOffset - 50) / 100 * offsetScale;
        const cp1y = midY + perpY + (uniqueOffset - 50) / 100 * offsetScale;
        const cp2x = midX - perpX - (uniqueOffset - 50) / 100 * offsetScale;
        const cp2y = midY - perpY - (uniqueOffset - 50) / 100 * offsetScale;

        // Ensure all coordinates are valid numbers
        if ([cp1x, cp1y, cp2x, cp2y].some(isNaN)) {
          return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        }

        // Create a complex curve using cubic Bézier curves
        return `M${d.source.x},${d.source.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${d.target.x},${d.target.y}`.trim();
      };



      // Nodes with varying sizes based on relevance
      const nodeGroup = g.append("g")
        .attr("class", "nodes")
        .selectAll(".node")
        .data(validNodes)
        .enter().append("g")
        .attr("class", "node");

      // Node size scale is defined above

      // Circle for each node (draggable and clickable)
      const node = nodeGroup.append("circle")
        .attr("r", d => {
          if (mainPapers.some(p => d.id === (p.id || p.paperId))) return 25;
          return d.citationCount ? Math.max(15, nodeScale(d.citationCount + 1)) : 15;
        })
        .attr("fill", d => {
          if (mainPapers.some(p => d.id === (p.id || p.paperId))) {
            return THEMES[settings.theme].node.highlightFill;
          }
          if (readPapers.has(d.id)) {
            return d.type === 'reference' ? '#FFC4A3' : '#FFB3D1';
          }
          return d.type === 'reference' ? '#EB5B00' : '#D91656';
        })
        .attr("stroke", d => d.isCentral ? THEMES[settings.theme].node.highlightStroke : THEMES[settings.theme].node.stroke)
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation(); // Prevent svg click handler from firing
          
          // Only mark as read and update color for non-main papers
          if (!mainPapers.some(p => d.id === (p.id || p.paperId))) {
            markAsRead(d.id);
            d3.select(event.currentTarget).attr("fill", d.type === 'reference' ? '#FFC4A3' : '#FFB3D1');
          }
          
          // Use only the node's own data
          console.log('Raw node data:', d);
          const completeData = {
            ...d,
            abstract: d.abstract,
            title: d.title,
            authors: d.authors?.map(a => typeof a === 'object' ? a.name : a) || [],
            year: d.year,
            citationCount: d.citationCount,
            doi: d.doi,
            url: d.url
          };
          console.log('Setting selected paper with data:', completeData);
          console.log('DOI value:', d.doi);
          setSelectedPaper(completeData);
        })
        .call(d3.drag()
          .on("start", (event, d) => dragstarted(event, d))
          .on("drag", (event, d) => dragged(event, d))
          .on("end", (event, d) => dragended(event, d)));

      // Format authors and year for display
      const formatLabel = d => {
        let label = '';
        
        // Format authors
        if (d.authors) {
          if (Array.isArray(d.authors)) {
            if (d.authors.length > 1) {
              label = `${d.authors[0]} et al.`;
            } else if (d.authors.length === 1) {
              label = d.authors[0];
            }
          } else {
            label = typeof d.authors === 'string' ? d.authors : '';
          }
        }
        
        // Add year if available
        if (d.year) {
          label = label ? `${label} (${d.year})` : d.year;
        }
        
        return label;
      };

      // Combined author and year label for each node
      nodeGroup.append("text")
        .attr("dy", d => d.isCentral ? 35 : 25)
        .attr("text-anchor", "middle")
        .style("fill", THEMES[settings.theme].node.textColor)
        .style("font-size", "10px")
        .style("pointer-events", "none")
        .text(formatLabel);

      // Add tooltips to the node circles
      node.on("mouseover", (event, d) => {
          tooltip.transition().duration(200).style("opacity", 0.9);
          let formattedAuthors = "";
          if (d.authors) {
            if (Array.isArray(d.authors) && d.authors.length > 1) {
              formattedAuthors = `${d.authors[0]} et al.`;
            } else if (Array.isArray(d.authors) && d.authors.length === 1) {
              formattedAuthors = d.authors[0];
            } else {
              formattedAuthors = d.authors; // fallback
            }
          }
          let content = `<strong>${d.title}</strong>`;
          if (formattedAuthors) {
            content += `<br/><em>${formattedAuthors}</em>`;
          }
          if (d.year) {
            content += `<br/><span class="year">(${d.year})</span>`;
          }
          if (d.abstract) {
            const truncatedAbstract = d.abstract.length > 200 ? 
              d.abstract.substring(0, 200) + '...' : 
              d.abstract;
            content += `<br/><br/><small>${truncatedAbstract}</small>`;
          }
          tooltip.html(content)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          tooltip.transition().duration(500).style("opacity", 0);
        });

      simulationRef.current.on("tick", () => {
        // Update link paths
        link.attr("d", linkArc);

        // Update node positions with safety checks
        nodeGroup.attr("transform", d => {
          const x = isNaN(d.x) ? 0 : d.x;
          const y = isNaN(d.y) ? 0 : d.y;
          return `translate(${x},${y})`;
        });

      });

      function dragstarted(event, d) {
        if (!event.active) simulationRef.current.alphaTarget(0.2).restart(); // Reduced target alpha
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) simulationRef.current.alphaTarget(0);
        // Keep the node fixed at its final position
        // This prevents it from moving after being dragged
        d.fx = event.x;
        d.fy = event.y;
        
        // Optional: Release after a short delay for subtle movement
        setTimeout(() => {
          d.fx = null;
          d.fy = null;
        }, 300);
      }

    } catch (error) {
      console.error('Error in graph rendering:', error);
      if (error.response?.status === 429) {
        const waitTime = error.response.data?.error?.match(/\d+/)?.[0] || 60;
        setError(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
      } else {
        setError(error.message || 'An error occurred while rendering the graph.');
      }
    }
    const papersKey = mainPapers.map(p => p.id).join(',');
      if (papersKey !== lastPapersKey) {
        const initialThreshold = findInitialThreshold(mainPapers);
        setLastPapersKey(papersKey);
        if (initialThreshold !== topicThreshold) {
          setTopicThreshold(initialThreshold);
          return; // Will re-render with new threshold
        }
      }
    // Cleanup function
    const svg = svgRef.current;
    return () => {
      if (simulationRef.current) simulationRef.current.stop();
      // Remove tooltip when component unmounts
      d3.select("body").selectAll(".tooltip").remove();
      // Clear all SVG content
      if (svg) {
        d3.select(svg).selectAll("*").remove();
      }
    };
  }, [mainPapers, currentMainPaper, settings, isLoading, forceUpdate, topicThreshold]);

  // Handle window resize with proper simulation reference
  useEffect(() => {
    let resizeTimeout;
    const handleResize = () => {
      if (!containerRef.current || !svgRef.current) return;
      
      // Clear the previous timeout
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      // Debounce resize event
      resizeTimeout = setTimeout(() => {
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Update SVG dimensions
        const svg = d3.select(svgRef.current)
          .attr('width', width)
          .attr('height', height);

        // Get current transform
        const currentTransform = d3.zoomTransform(svgRef.current);
        
        // Update zoom behavior
        const zoom = d3.zoom()
          .scaleExtent([0.1, 4])
          .on('zoom', (event) => {
            svg.select('g.zoom-container').attr('transform', event.transform);
          });

        // Apply the current transform
        svg.call(zoom.transform, currentTransform);
      }, 250); // Debounce delay
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  // Paper Info Panel Component
  const removePaperFromGraph = (paperId) => {
    // Remove from mainPapers if it's a main paper
    setMainPapers(prev => {
      const isMainPaper = prev.some(p => (p.id || p.paperId) === paperId);
      
      if (isMainPaper) {
        // If it's a main paper, remove it and its references/citations
        return prev.filter(p => (p.id || p.paperId) !== paperId);
      } else {
        // If it's a secondary paper, remove it from references/citations of all main papers
        return prev.map(mainPaper => ({
          ...mainPaper,
          references: (mainPaper.references || []).filter(ref => 
            (ref.id || ref.paperId) !== paperId
          ),
          citations: (mainPaper.citations || []).filter(cit => 
            (cit.id || cit.paperId) !== paperId
          )
        }));
      }
    });

    // Force graph update
    setForceUpdate(prev => prev + 1);
    // Close the paper info panel
    setSelectedPaper(null);
  };

  const PaperInfoPanel = ({ paper }) => {
    if (!paper) return null;
    
    // Only log if there's an issue with journal info
    if (paper.journalInfo && !paper.journalInfo.name) {
      console.log('Invalid journal info:', paper.journalInfo);
    }

    const formatAuthors = authors => {
      if (!authors) return '';
      if (Array.isArray(authors)) {
        return authors.map(a => typeof a === 'object' ? a.name : a).join(', ');
      }
      return typeof authors === 'string' ? authors : '';
    };

    // Function to get the paper URL
    const getPaperUrl = () => {
      console.log('Paper data in info panel:', paper);
      if (paper.doi) {
        const doiUrl = `https://doi.org/${paper.doi}`;
        console.log('Using DOI URL:', doiUrl);
        return doiUrl;
      } else if (paper.url) {
        console.log('Using direct URL:', paper.url);
        return paper.url;
      }
      console.log('No URL available');
      return null;
    };

    const paperUrl = getPaperUrl();
    console.log('Final paper URL:', paperUrl);

    return (
      <div className={`paper-info-panel ${settings.theme !== 'default' ? `theme-${settings.theme}` : ''}`}>
        <button 
          className="close-button" 
          onClick={() => setSelectedPaper(null)}
          aria-label="Close panel"
        >
          ×
        </button>
        <h3>
          {paperUrl ? (
            <a 
              href={paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="paper-title-link"
              title="View paper on publisher's website"
            >
              {paper.title}
              <span className="external-link-icon">↗</span>
            </a>
          ) : (
            paper.title
          )}
        </h3>
        <div className="authors">{formatAuthors(paper.authors)}</div>
        <div className="metadata">
          <span>Year: {paper.year || 'N/A'}</span>
          <span>Citations: {paper.citationCount || 0}</span>
          {(() => {
            console.log('Attempting to display journal info:', paper.journalInfo);
            if (paper.journalInfo && paper.journalInfo.name) {
              console.log('Displaying journal info:', {
                name: paper.journalInfo.name,
                type: paper.journalInfo.type
              });
              return (
                <span className="journal-info">
                  Journal: {paper.journalInfo.name}
                  
                </span>
              );
            }
            console.log('No journal info to display');
            return null;
          })()}
          {paper.doi && (
            <span>
              DOI: <a 
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="doi-link"
              >
                {paper.doi}
              </a>
            </span>
          )}
        </div>
        {paper.abstract && (
          <div className="abstract">
            <strong>Abstract:</strong>
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{paper.abstract}</p>
          </div>
        )}
        <div className="paper-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => removePaperFromGraph(paper.id)}
            style={{
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: '1'
            }}
          >
            Remove from Graph
          </button>
          {!mainPapers.some(p => paper.id === (p.id || p.paperId)) && (
            <button 
              onClick={() => expandNetwork(paper)}
              style={{
                backgroundColor: THEMES[settings.theme].node.highlightFill,
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                flex: '1'
              }}
            >
              Expand Network Here
            </button>
          )}
        </div>
      </div>
    );
  };

  

  return (
    <div className="network-container">
      {isLoading && (
        <LoadingScreen 
          theme={settings.theme} 
          loadingText={`Loading Network. Fetching ${paper.citationCount} articles...`}
        />
      )}
      {isExpanding && (
        <LoadingScreen 
          theme={settings.theme} 
          loadingText={`Adding ${expandingStats.cites} citations...`}
        />
      )}
      <div className="network-graph" ref={containerRef} style={{ width: '100%', height: '800px', position: 'relative' }}>
        <div className="network-content" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <svg 
            ref={svgRef}
            style={{ display: 'block', width: '100%', height: '100%' }}
          ></svg>
        </div>
      </div>
      <div className="settings-container">
        <SettingsPanel />
      </div>
      {error && <div className="error">{error}</div>}
      {selectedPaper && (
        <div className="modal-overlay" 
          onClick={(e) => {
            if (e.target.className === 'modal-overlay') {
              setSelectedPaper(null);
            }
          }}
        >
          <PaperInfoPanel paper={selectedPaper} key={selectedPaper.id} />
        </div>
      )}
    </div>
  );
}

export default NetworkGraph;
