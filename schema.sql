-- schema.sql
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    abstract TEXT,
    year INTEGER
);

CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citing_paper_id TEXT NOT NULL,
    cited_paper_id TEXT NOT NULL,
    FOREIGN KEY (citing_paper_id) REFERENCES papers(paper_id),
    FOREIGN KEY (cited_paper_id) REFERENCES papers(paper_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_id ON papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_year ON papers(year);
CREATE INDEX IF NOT EXISTS idx_author_name ON authors(name);
CREATE INDEX IF NOT EXISTS idx_paper_authors ON paper_authors(paper_id, author_id);
CREATE INDEX IF NOT EXISTS idx_citations ON citations(citing_paper_id, cited_paper_id);
