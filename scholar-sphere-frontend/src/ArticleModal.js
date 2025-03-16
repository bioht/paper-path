import React from 'react';

const ArticleModal = React.memo(({ article, onClose }) => {
  if (!article) return null;

  const formatAuthors = authors => {
    if (!authors) return '';
    if (Array.isArray(authors)) {
      return authors.join(', ');
    }
    return authors;
  };

  const handleTitleClick = () => {
    if (article.doi) {
      window.open(`https://doi.org/${article.doi}`, '_blank');
    } else if (article.url) {
      window.open(article.url, '_blank');
    } else {
      // If no DOI or direct URL, search on Google Scholar
      const query = encodeURIComponent(`${article.title} ${formatAuthors(article.authors)}`);
      window.open(`https://scholar.google.com/scholar?q=${query}`, '_blank');
    }
  };

  return (
    <>
      <div className="article-modal-overlay" onClick={onClose} />
      <div className="article-modal">
        <div className="article-modal-header">
          <h2 className="article-modal-title" onClick={handleTitleClick} style={{ cursor: 'pointer' }}>
            {article.title}
          </h2>
          <button className="article-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="article-modal-content">
          <div className="article-modal-authors">
            {formatAuthors(article.authors)}
          </div>
          <div className="article-modal-metadata">
            <span>Year: {article.year || 'N/A'}</span>
            <span> • </span>
            <span>Citations: {article.citationCount || 0}</span>
            {article.journal && (
              <>
                <span> • </span>
                <span>Journal: {article.journal}</span>
              </>
            )}
            {article.doi && (
              <>
                <span> • </span>
                <span>DOI: <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer">{article.doi}</a></span>
              </>
            )}
          </div>
          {article.abstract && (
            <div className="article-modal-abstract">
              <div className="article-modal-abstract-title">Abstract</div>
              <p>{article.abstract}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

export default ArticleModal;
