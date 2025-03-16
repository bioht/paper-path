// src/SearchResults.js
import React, { useState, useEffect, useCallback } from 'react';
import { searchPapers, prefetchNextPage } from './utils/api';
import './SearchResults.css';
import { useNavigate } from 'react-router-dom';

const RESULTS_PER_PAGE = 10;

function SearchResults({ query, onPaperSelect, shouldSearch, onSearchComplete }) {
  const navigate = useNavigate()
  const [searchState, setSearchState] = useState({
    results: [],
    loading: false,
    error: null,
    pagination: {
      page: 1,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  });

  const fetchResults = useCallback(async (page = 1) => {
    if (!query?.trim()) return;

    setSearchState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await searchPapers(query, page, RESULTS_PER_PAGE);
      console.log('API response:', data);
      if (data?.results) {
        const pagination = {
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.total_pages,
          hasNext: data.pagination.has_next,
          hasPrev: data.pagination.has_prev,
        };
        console.log('Setting pagination:', pagination);
        console.log('Calculated total pages:', Math.ceil(data.pagination.total / RESULTS_PER_PAGE));
        const newState = {
          results: data.results,
          pagination,
          loading: false,
          error: null,
        };
        console.log('Setting new search state:', newState);
        setSearchState(newState);

        if (data.pagination.has_next) {
          prefetchNextPage(query, page + 1, RESULTS_PER_PAGE);
        }
      } else {
        setSearchState(prev => ({ ...prev, results: [], loading: false }));
      }
    } catch (err) {
      setSearchState(prev => ({
        ...prev,
        error: err.message?.includes('Rate limit exceeded')
          ? err.message
          : 'Failed to fetch results. Please try again.',
        loading: false,
      }));
    }
  }, [query]);

  useEffect(() => {
    if (shouldSearch && query?.trim()) {
      fetchResults(1);
      onSearchComplete();
    }
  }, [shouldSearch, query, fetchResults, onSearchComplete]);

  const handlePageChange = (newPage) => {
    if (newPage !== searchState.pagination.page) {
      fetchResults(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPagination = () => {
    const { page, totalPages } = searchState.pagination;
    console.log('Rendering pagination:', { page, totalPages });
    if (totalPages <= 1) {
      console.log('Not rendering pagination - only 1 page');
      return null;
    }
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    console.log('Pagination range:', { start, end });

    if (start > 1) {
      pages.push(
        <button key="1" onClick={() => handlePageChange(1)} className="page-button">
          1
        </button>
      );
      if (start > 2) {
        pages.push(<span key="ellipsis1" className="ellipsis">...</span>);
      }
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`page-button ${searchState.pagination.page === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push(<span key="ellipsis2" className="ellipsis">...</span>);
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="page-button"
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div className="pagination">
        <button
          onClick={() => handlePageChange(searchState.pagination.page - 1)}
          disabled={!searchState.pagination.hasPrev}
          className="page-button nav-button"
        >
          Previous
        </button>
        <div className="pagination-numbers">{pages}</div>
        <button
          onClick={() => handlePageChange(searchState.pagination.page + 1)}
          disabled={!searchState.pagination.hasNext}
          className="page-button nav-button"
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <div className="search-results">
      <button 
          className="cta-button"
          onClick={() => {
            navigate('/savedgraphs');     // Second action
          }}
        >
          Go to saved graphs
        </button>
      <button 
          className="cta-button"
          onClick={() => {
            navigate('/');     // Second action
          }}
        >
          Back to Home
        </button>
      {(searchState.loading || searchState.error || searchState.results.length > 0) && (
        <div className="search-results-container">
          {searchState.loading && <div className="loading">Searching...</div>}
          {searchState.error && <div className="error">{searchState.error}</div>}
          {!searchState.loading && !searchState.error && searchState.results.length > 0 && (
            <div className="results-count">
              Found {searchState.pagination.total} results
            </div>
          )}
          <div className="results-list">
            {!searchState.loading &&
              !searchState.error &&
              searchState.results.map((paper) => {
                const abstractText = paper.summary || paper.abstract || '';
                return (
                  <div
                    key={paper.id}
                    className="paper-item"
                    onClick={() => onPaperSelect(paper)}
                  >
                    <h3>{paper.title}</h3>
                    <div className="paper-meta">
                      <span className="authors">
                        {Array.isArray(paper.authors)
                          ? paper.authors.map(author => author.name || author).join(', ')
                          : paper.authors}
                      </span>
                      <span className="year">{paper.year}</span>
                      <span className="citations">{paper.citations || 'N/A'}</span>
                    </div>
                    {abstractText && (
                      <p className="paper-abstract">{abstractText}</p>
                    )}
                  </div>
                );
              })}
          </div>
          {!searchState.loading &&
            !searchState.error &&
            searchState.results.length > 0 && (
              <div className="pagination-wrapper">{renderPagination()}</div>
            )}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
