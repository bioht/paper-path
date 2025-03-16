import { debounce } from 'lodash';

// API configuration
const API_BASE_URL = 'https://paper-path.onrender.com';
// Cache configuration
const CACHE_DURATION = 3600000; // 1 hour
const DEBOUNCE_WAIT = 300; // 300ms debounce for search


// Cache management
const getCache = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
      localStorage.removeItem(key);
    }
    return null;
  } catch (err) {
    console.error('Cache error:', err);
    return null;
  }
};

const setCache = (key, data) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (err) {
    console.error('Cache error:', err);
    // If localStorage is full, clear old entries
    clearOldCache();
  }
};

const clearOldCache = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    getCache(key); // This will remove if expired
  }
};


// API functions
// Create a non-debounced version for immediate search
const searchPapersImmediate = async (query, page = 1, perPage = 10) => {
  console.log('Searching papers:', { query, page, perPage });
  const cacheKey = `search:${query}:${page}:${perPage}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('Returning cached results');
    return cached;
  }

  try {
    console.log('Fetching from API...');
    const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API response:', data);
    
    // Ensure we have the correct structure
    const formattedData = {
      results: data.results || data.papers || [],
      pagination: data.pagination || {
        page: page,
        per_page: perPage,
        total: data.total || 0,
        total_pages: Math.ceil((data.total || 0) / perPage),
        has_next: data.has_next || ((page * perPage) < (data.total || 0)),
        has_prev: page > 1
      }
    };
    
    // Cache the results
    setCache(cacheKey, formattedData);
    
    return formattedData;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

// Export both debounced and immediate versions
export const searchPapers = Object.assign(searchPapersImmediate, {
  debounced: debounce(searchPapersImmediate, DEBOUNCE_WAIT)
});

export const getPaperDetails = async (paperId) => {
  if (!paperId) {
    console.error('No paperId provided');
    throw new Error('No paperId provided');
  }

  // Check cache first
  const cached = getCache(`paper:${paperId}`);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/api/paper/${encodeURIComponent(paperId)}`;
    console.log('Fetching paper details from URL:', url);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error:', response.status, response.statusText, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data;
    try {
      data = await response.json();
      console.log('API response data:', data);
      console.log('Journal info in response:', data.journalInfo);
      if (data.references) {
        console.log('References with journal info:', data.references.filter(r => r.journalInfo));
      }
      if (data.citations) {
        console.log('Citations with journal info:', data.citations.filter(c => c.journalInfo));
      }
    } catch (jsonError) {
      const text = await response.text();
      console.error('Error parsing JSON. Response text:', text);
      throw new Error('Failed to parse JSON response');
    }
    
    console.log('Raw API response:', data);
    console.log('Journal info in API response:', data.journalInfo);

    // If the API returned an error in the JSON body, throw it
    if (data.error) {
      console.error('API error:', data.error);
      throw new Error(data.error);
    }
    
    // Validate that we received a valid paper object
    if (!data || typeof data !== 'object' || (!data.paperId && !data.id)) {
      console.error('Invalid paper data:', data);
      throw new Error('No paper data found');
    }
    
    // Normalize the data to ensure consistency
    const paperData = {
      ...data,
      id: data.paperId || data.id,
      paperId: data.paperId || data.id,
      references: Array.isArray(data.references)
        ? data.references.map(ref => ({
            ...ref,
            id: ref.paperId || ref.id,
            paperId: ref.paperId || ref.id
          }))
        : [],
      citations: Array.isArray(data.citations)
        ? data.citations.map(cite => ({
            ...cite,
            id: cite.paperId || cite.id,
            paperId: cite.paperId || cite.id
          }))
        : []
    };
    
    console.log('Processed paper data:', paperData);
    setCache(`paper:${paperId}`, paperData);
    return paperData;
  } catch (error) {
    console.error('Error in getPaperDetails:', error);
    throw error;
  }
};



// Prefetching
export const prefetchNextPage = (query, currentPage, perPage) => {
  const nextPage = currentPage + 1;
  const cacheKey = `search:${query}:${nextPage}:${perPage}`;
  
  if (!getCache(cacheKey)) {
    searchPapers(query, nextPage, perPage).catch(() => {});
  }
};

// Export utility functions
export const clearCache = () => {
  localStorage.clear();
};

export const getCacheSize = () => {
  return localStorage.length;
};

export const getCacheStats = () => {
  let size = 0;
  let items = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    size += value.length * 2; // UTF-16 characters = 2 bytes
    items++;
  }
  
  return {
    items,
    sizeKB: Math.round(size / 1024),
  };
};
