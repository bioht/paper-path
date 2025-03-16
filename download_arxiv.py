import json
import sqlite3
from tqdm import tqdm
import os
import time
import requests
from datetime import datetime, timedelta
from data_ingestion import setup_database, ingest_papers
from urllib.parse import urlencode

def fetch_arxiv_papers(query='cat:q-bio.BM', start=0, max_results=100):
    """Fetch papers from arXiv API with retries"""
    base_url = 'http://export.arxiv.org/api/query?'
    max_retries = 3
    retry_delay = 10  # seconds
    
    # API parameters
    params = {
        'search_query': query,
        'start': start,
        'max_results': max_results,
        'sortBy': 'submittedDate',
        'sortOrder': 'descending'
    }
    
    for attempt in range(max_retries):
        try:
            # Make request
            response = requests.get(base_url + urlencode(params), timeout=30)
            
            if response.status_code == 200:
                return response.text
            elif response.status_code == 429:  # Too Many Requests
                print(f"Rate limit hit, waiting {retry_delay * (attempt + 1)} seconds...")
                time.sleep(retry_delay * (attempt + 1))
            else:
                print(f"Error fetching papers (attempt {attempt + 1}): {response.status_code}")
                time.sleep(retry_delay)
        except requests.exceptions.RequestException as e:
            print(f"Request failed (attempt {attempt + 1}): {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            continue
    
    return None

def process_arxiv_response(xml_response):
    """Process arXiv API response and extract paper information"""
    import xml.etree.ElementTree as ET
    
    # Parse XML
    root = ET.fromstring(xml_response)
    
    # Define namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom',
          'arxiv': 'http://arxiv.org/schemas/atom'}
    
    papers = []
    for entry in root.findall('atom:entry', ns):
        # Skip if it's the feed entry
        if entry.find('atom:title', ns).text == 'ArXiv Query:':
            continue
        
        # Extract paper info
        paper_id = entry.find('atom:id', ns).text.split('/abs/')[-1]
        title = entry.find('atom:title', ns).text.strip()
        abstract = entry.find('atom:summary', ns).text.strip()
        published = entry.find('atom:published', ns).text
        year = int(published.split('-')[0])
        
        # Extract authors
        authors = []
        for author in entry.findall('atom:author', ns):
            name = author.find('atom:name', ns).text.strip()
            authors.append({'name': name})
        
        paper = {
            'paper_id': paper_id,
            'title': title,
            'abstract': abstract,
            'year': year,
            'authors': authors,
            'citations': []  # We'll need to fetch this separately
        }
        papers.append(paper)
    
    return papers

if __name__ == '__main__':
    # Setup database
    conn = setup_database()
    c = conn.cursor()
    
    # Create indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_authors_name ON authors(name)')
    
    # ALL categories that could contain medical research
    categories = [
        # Quantitative Biology (all subcategories)
        'q-bio.BM',   # Biomolecules: DNA, RNA, proteins, molecular structures
        'q-bio.CB',   # Cell Behavior: development, immunology, viral-host interaction
        'q-bio.GN',   # Genomics: DNA sequencing, gene finding, genomic processes
        'q-bio.MN',   # Molecular Networks: gene regulation, signal transduction
        'q-bio.NC',   # Neurons and Cognition: neuroscience, brain function
        'q-bio.OT',   # Other Quantitative Biology
        'q-bio.PE',   # Populations and Evolution: epidemiology, aging
        'q-bio.QM',   # Quantitative Methods in biology
        'q-bio.SC',   # Subcellular Processes: cellular structures
        'q-bio.TO',   # Tissues and Organs: blood flow, tumor growth
        
        # Physics (medical-related)
        'physics.med-ph',  # Medical Physics
        'physics.bio-ph',  # Biological Physics
        'physics.chem-ph', # Chemical Physics: drug design, molecular interactions
        'physics.flu-dyn', # Fluid Dynamics: blood flow, respiratory systems
        'physics.ao-ph',   # Atmospheric Physics: environmental health
        'physics.app-ph',  # Applied Physics: medical devices and imaging
        'physics.atom-ph', # Atomic Physics: medical imaging, radiation therapy
        'physics.data-an', # Data Analysis: medical data processing
        
        # Computer Science
        'cs.AI',      # AI in Healthcare
        'cs.CV',      # Computer Vision: medical imaging
        'cs.LG',      # Machine Learning in Medicine
        'cs.CY',      # Computers and Society: health informatics
        'cs.NE',      # Neural/Evolutionary: brain modeling
        'cs.HC',      # Human-Computer Interaction: medical interfaces
        'cs.DB',      # Databases: medical data management
        'cs.CE',      # Computational Engineering: medical simulations
        
        # Statistics
        'stat.AP',    # Statistics Applications: medical statistics
        'stat.ML',    # Machine Learning: medical applications
        'stat.ME',    # Methodology: clinical trials analysis
        'stat.TH',    # Theory: biostatistics foundations
        
        # Mathematics
        'math.NA',    # Numerical Analysis: medical modeling
        'math.PR',    # Probability: epidemiological models
        'math.ST',    # Statistics: biostatistics
        'math.CA',    # Complex Analysis: medical signal processing
        
        # Interdisciplinary
        'cond-mat.soft',   # Soft Matter: biological materials
        'cond-mat.stat-mech', # Statistical Mechanics: biological systems
        'nlin.AO',        # Adaptation in biological systems
        'nlin.CD',        # Chaotic Dynamics: physiological systems
        'nlin.PS',        # Pattern Formation: tissue development
        
        # Chemical and Materials
        'cond-mat.mtrl-sci', # Materials Science: biomedical materials
        'cond-mat.mes-hall', # Mesoscopic Systems: drug delivery
        
        # Additional Biology-related
        'physics.soc-ph',  # Social Physics: healthcare systems
        'physics.pop-ph',  # Popular Physics: medical education
        'q-fin.CP',       # Computational Finance: healthcare economics
    ]
    
    total_papers = 0
    batch_size = 100  # arXiv API allows max 100 results per request
    
    try:
        for category in categories:
            print(f"\nFetching papers from category: {category}")
            start = 0
            had_papers = True
            
            while had_papers:
                print(f"Fetching results {start} to {start + batch_size}...")
                
                try:
                    # Fetch papers
                    response = fetch_arxiv_papers(f'cat:{category}', start, batch_size)
                    if not response:
                        print(f"No response for {category} at offset {start}")
                        break
                        
                    # Process response
                    papers = process_arxiv_response(response)
                    if not papers:
                        print(f"No more papers in {category} after {start} results")
                        had_papers = False
                        continue
                        
                    # Ingest papers
                    ingest_papers(conn, papers)
                    total_papers += len(papers)
                    
                    print(f"Processed {len(papers)} papers from {category} (Total: {total_papers})")
                    
                    # If we got less than batch_size papers, we've reached the end
                    if len(papers) < batch_size:
                        had_papers = False
                    
                    # Move to next batch
                    start += batch_size
                    
                    # Sleep to respect arXiv API rate limits (3 seconds between requests)
                    time.sleep(3)
                    
                except Exception as e:
                    print(f"Error processing {category} at offset {start}: {str(e)}")
                    print("Waiting 60 seconds before retrying...")
                    time.sleep(60)  # Wait longer on error
                    continue
    
    except KeyboardInterrupt:
        print("\nStopping paper collection...")
    
    print(f"\nTotal papers collected: {total_papers}")
    print("Database processing complete!")
    conn.commit()
    conn.close()
