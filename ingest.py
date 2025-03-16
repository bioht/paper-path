# ingest.py
import requests
from neo4j import GraphDatabase
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)

# Neo4j connection URI and credentials (adjust as needed)
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASS = "testtest"

# Connect to Neo4j
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))

def fetch_paper_data(doi):
    """
    Fetches paper data from the Semantic Scholar API.

    Args:
        doi (str): The unique identifier for the paper (DOI).

    Returns:
        dict: A dictionary containing the paper data.
    """
    api_url = f"https://api.semanticscholar.org/v1/paper/{doi}"
    
    try:
        response = requests.get(api_url)
        response.raise_for_status()  # Raise an error for bad status codes
        logging.info(f"Successfully fetched data for paper ID: {doi}")
        data = response.json()
        item = data.get("message", {})
        return {
            "doi": item.get("DOI", doi),
            "title": item.get("title", ["No title"])[0] if item.get("title") else "No title",
            "authors": [
                f"{author.get('given', '')} {author.get('family', '')}".strip()
                for author in item.get("author", [])
            ] if "author" in item else [],
            "citation_count": item.get("is-referenced-by-count", 0),
            "references": item.get("reference", [])
        }
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching paper data for ID {doi}: {e}")
        logging.error(f"API Response: {response.text if 'response' in locals() else 'No response'}")
        return None

def ingest_paper_data(paper_data):
    """
    Insert or update paper node in Neo4j, along with references.
    """
    with driver.session() as session:
        # Upsert the main paper
        session.run(
            """
            MERGE (p:Paper {doi: $doi})
            ON CREATE SET p.title = $title,
                          p.authors = $authors,
                          p.citationCount = $citation_count
            ON MATCH SET p.title = $title,
                         p.authors = $authors,
                         p.citationCount = $citation_count
            """,
            doi=paper_data["doi"],
            title=paper_data["title"],
            authors=paper_data["authors"],
            citation_count=paper_data["citation_count"]
        )

        # Upsert references
        if paper_data["references"]:
            for ref in paper_data["references"]:
                ref_doi = ref.get("DOI")
                if ref_doi:
                    # Merge reference node
                    session.run(
                        """
                        MERGE (r:Paper {doi: $ref_doi})
                        ON CREATE SET r.title = $ref_title
                        ON MATCH SET r.title = COALESCE(r.title, $ref_title)
                        """,
                        ref_doi=ref_doi,
                        # We might have partial info for the reference
                        ref_title=ref.get("article-title") or ref_doi
                    )
                    # Create relationship (paper)-[:CITES]->(reference)
                    session.run(
                        """
                        MATCH (p:Paper {doi: $paper_doi})
                        MATCH (r:Paper {doi: $ref_doi})
                        MERGE (p)-[:CITES]->(r)
                        """,
                        paper_doi=paper_data["doi"],
                        ref_doi=ref_doi
                    )

def main():
    # Example usage: ingest one paper by DOI
    doi = "10.1038/s41586-020-2649-2"  # example
    paper_data = fetch_paper_data(doi)
    if paper_data:
        ingest_paper_data(paper_data)
        print("Ingested paper:", paper_data["doi"])

if __name__ == "__main__":
    main()
    driver.close()
