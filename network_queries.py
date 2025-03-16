from typing import Dict, List, Set, Tuple
import json
from db import get_db_connection

def get_paper_network(db_path: str, 
                     search_query: str = None,
                     min_year: int = None,
                     max_year: int = None) -> Tuple[List[Dict], List[Dict]]:
    """
    Get paper network data for visualization.
    
    Args:
        db_path: Path to SQLite database
        search_query: Optional text to search in titles/abstracts
        max_papers: Maximum number of papers to return
        min_year: Minimum publication year
        max_year: Maximum publication year
        
    Returns:
        Tuple of (nodes, edges) where:
        - nodes: List of paper nodes with id, title, year, etc.
        - edges: List of citation edges between papers
    """
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Build query conditions
        conditions = []
        params = []
        
        if search_query:
            conditions.append("(title LIKE ? OR abstract LIKE ?)")
            params.extend([f"%{search_query}%", f"%{search_query}%"])
        
        if min_year:
            conditions.append("year >= ?")
            params.append(min_year)
            
        if max_year:
            conditions.append("year <= ?")
            params.append(max_year)
            
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # First get the main paper
        cursor.execute("""
            SELECT p.paper_id, p.title, p.abstract, p.year, p.doi, p.url
            FROM papers p
            WHERE p.paper_id = ?
        """, [search_query])
        main_paper = cursor.fetchone()
        
        if not main_paper:
            return [], []
            
        # Get all references and citations
        cursor.execute("""
            WITH RECURSIVE
            related_papers(paper_id) AS (
                -- Start with the main paper
                SELECT ?
                UNION
                -- Get all references
                SELECT cited_paper_id
                FROM citations
                WHERE citing_paper_id = ?
                UNION
                -- Get all papers that cite this paper
                SELECT citing_paper_id
                FROM citations
                WHERE cited_paper_id = ?
            )
            SELECT p.paper_id, p.title, p.abstract, p.year, p.doi, p.url
            FROM papers p
            JOIN related_papers rp ON p.paper_id = rp.paper_id
            WHERE p.year >= COALESCE(?, p.year)
            AND p.year <= COALESCE(?, p.year)
        """, [search_query, search_query, search_query, min_year, max_year])
        
        papers = [main_paper] + cursor.fetchall()
        paper_ids = {p[0] for p in papers}
        
        # Get authors for these papers
        authors_by_paper = {}
        if paper_ids:
            placeholders = ','.join('?' * len(paper_ids))
            cursor.execute(f"""
                SELECT p.paper_id, GROUP_CONCAT(a.name, '; ')
                FROM papers p
                JOIN paper_authors pa ON p.id = pa.paper_id
                JOIN authors a ON pa.author_id = a.id
                WHERE p.paper_id IN ({placeholders})
                GROUP BY p.paper_id
            """, list(paper_ids))
            authors_by_paper = dict(cursor.fetchall())
        
        # Create nodes
        nodes = []
        for paper_id, title, abstract, year, doi, url in papers:
            nodes.append({
                'id': paper_id,
                'title': title,
                'abstract': abstract,
                'year': year,
                'authors': authors_by_paper.get(paper_id, '').split('; '),
                'doi': doi,
                'url': url,
                'type': 'paper'
            })
        
        # Get all citations where either the citing or cited paper is in our set
        edges = []
        if paper_ids:
            cursor.execute("""
                WITH paper_citations AS (
                    -- Get direct citations (papers cited by our main paper)
                    SELECT citing_paper_id, cited_paper_id
                    FROM citations
                    WHERE citing_paper_id = ?
                    
                    UNION
                    
                    -- Get reverse citations (papers that cite our main paper)
                    SELECT citing_paper_id, cited_paper_id
                    FROM citations
                    WHERE cited_paper_id = ?
                )
                SELECT DISTINCT c.citing_paper_id, c.cited_paper_id
                FROM paper_citations c
                JOIN papers p1 ON c.citing_paper_id = p1.paper_id
                JOIN papers p2 ON c.cited_paper_id = p2.paper_id
                WHERE p1.year >= COALESCE(?, p1.year)
                AND p1.year <= COALESCE(?, p1.year)
                AND p2.year >= COALESCE(?, p2.year)
                AND p2.year <= COALESCE(?, p2.year)
            """, [search_query, search_query, min_year, max_year, min_year, max_year])
            
            # Create edges
            for citing_id, cited_id in cursor.fetchall():
                edges.append({
                    'source': citing_id,
                    'target': cited_id,
                    'type': 'cites'
                })
    
    return nodes, edges

def get_author_network(db_path: str,
                      search_query: str = None,
                      max_authors: int = 50,
                      min_year: int = None,
                      max_year: int = None) -> Tuple[List[Dict], List[Dict]]:
    """
    Get author collaboration network data.
    
    Args:
        db_path: Path to SQLite database
        search_query: Optional text to search in author names
        max_authors: Maximum number of authors to return
        min_year: Minimum publication year
        max_year: Maximum publication year
        
    Returns:
        Tuple of (nodes, edges) where:
        - nodes: List of author nodes with id, name, etc.
        - edges: List of collaboration edges between authors
    """
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        
        # Build query conditions
        conditions = []
        params = []
        
        if search_query:
            conditions.append("a.name LIKE ?")
            params.append(f"%{search_query}%")
        
        if min_year:
            conditions.append("p.year >= ?")
            params.append(min_year)
            
        if max_year:
            conditions.append("p.year <= ?")
            params.append(max_year)
            
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        # Get top authors by paper count
        cursor.execute(f"""
            SELECT a.id, a.name, COUNT(DISTINCT p.id) as paper_count
            FROM authors a
            JOIN paper_authors pa ON a.id = pa.author_id
            JOIN papers p ON pa.paper_id = p.id
            WHERE {where_clause}
            GROUP BY a.id, a.name
            ORDER BY paper_count DESC
            LIMIT ?
        """, params + [max_authors])
        
        authors = cursor.fetchall()
        author_ids = {a[0] for a in authors}
        
        # Create author nodes
        nodes = []
        for author_id, name, paper_count in authors:
            nodes.append({
                'id': f"author_{author_id}",
                'name': name,
                'paper_count': paper_count,
                'type': 'author'
            })
        
        # Get collaborations between these authors
        edges = []
        if author_ids:
            placeholders = ','.join('?' * len(author_ids))
            cursor.execute(f"""
                SELECT a1.id, a2.id, COUNT(*) as collab_count
                FROM paper_authors pa1
                JOIN paper_authors pa2 ON pa1.paper_id = pa2.paper_id
                JOIN authors a1 ON pa1.author_id = a1.id
                JOIN authors a2 ON pa2.author_id = a2.id
                WHERE a1.id < a2.id
                AND a1.id IN ({placeholders})
                AND a2.id IN ({placeholders})
                GROUP BY a1.id, a2.id
                HAVING collab_count > 0
            """, list(author_ids) + list(author_ids))
            
            # Create collaboration edges
            for author1_id, author2_id, weight in cursor.fetchall():
                edges.append({
                    'source': f"author_{author1_id}",
                    'target': f"author_{author2_id}",
                    'weight': weight,
                    'type': 'collaborates'
                })
    
    return nodes, edges
