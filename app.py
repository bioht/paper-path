# app.py
import os
import json
import asyncio
import aiohttp
from time import sleep
from urllib.parse import quote
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import redis
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

import ssl
import certifi

ssl_context = ssl.create_default_context(cafile=certifi.where())

# Load environment variables
load_dotenv()

# Initialize Redis
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_client = redis.from_url(redis_url, decode_responses=True)
CACHE_DURATION = 3600  # 1 hour in seconds

def async_route(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return wrapped

# Constants
OPENALEX_API_URL = 'https://api.openalex.org'
# Use your email as polite pool identifier
EMAIL = os.getenv('EMAIL', 'mahdi.fayad@gmail.com')

async def fetch_paper_details(session, paper_id):
    cache_key = f"paper:{paper_id}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
        
    async with session.get(
        f'{OPENALEX_API_URL}/works/{paper_id}',
        headers={'User-Agent': f'mailto:{EMAIL}'}
    ) as response:
        data = await response.json()
        redis_client.setex(cache_key, CACHE_DURATION, json.dumps(data))
        return data

# Helper functions for OpenAlex data conversion
def convert_inverted_index_to_text(abstract_index):
    if not abstract_index:
        return ''
    # Sort by position and join words
    words = [None] * (max(max(positions) for positions in abstract_index.values()) + 1)
    for word, positions in abstract_index.items():
        for pos in positions:
            words[pos] = word
    return ' '.join(word for word in words if word is not None)

def transform_author(authorship):
    author = authorship.get('author', {})
    return {
        'authorId': author.get('id', '').split('/')[-1],
        'name': author.get('display_name', ''),
        'affiliations': [inst.get('display_name', '') for inst in authorship.get('institutions', [])]
    }

def transform_paper(paper):
    if not paper:
        return None
        
    try:
        # Extract the ID from the URL format
        paper_id = paper.get('id', '').split('/')[-1] if paper.get('id') else None
        
        # Get abstract text
        abstract = ''
        if paper.get('abstract_inverted_index'):
            try:
                abstract = convert_inverted_index_to_text(paper['abstract_inverted_index'])
            except Exception:
                # If there's an error converting the inverted index, try direct abstract
                abstract = paper.get('abstract', '')
        elif paper.get('abstract'):
            abstract = paper.get('abstract', '')
        
        # Get journal information from primary_location
        primary_location = paper.get('primary_location') or {}
        source = (primary_location.get('source') or {}) if primary_location else {}
        
        # Extract journal info
        journal_name = source.get('display_name')
        journal_type = source.get('type')
        
        # Only include journal info if we have a name
        journal_info = None
        if journal_name:
            journal_info = {
                'name': journal_name,
                'type': journal_type,
                'issn': source.get('issn') or []
            }
        
        # Get the paper URL
        paper_url = primary_location.get('landing_page_url') if primary_location else None
        if not paper_url and paper.get('doi'):
            paper_url = f"https://doi.org/{paper.get('doi')}"
        
        # Transform the paper data
        transformed = {
            'id': paper_id,  # Frontend expects 'id'
            'paperId': paper_id,
            'title': paper.get('title', ''),
            'abstract': abstract,
            'venue': journal_name or '',  # Use journal name as venue
            'journalInfo': journal_info,  # Will be None if no journal name
            'year': paper.get('publication_year'),
            'url': paper_url or '',
            'authors': [transform_author(auth) for auth in paper.get('authorships') or []],
            'numCitedBy': paper.get('cited_by_count', 0),
            'citationCount': paper.get('cited_by_count', 0),  # Keep both for compatibility
            'references': [ref.split('/')[-1] for ref in paper.get('referenced_works') or []],
            'citations': [],  # Citations will be populated separately
            'doi': paper.get('doi'),
            'citationsUrl': paper.get('cited_by_api_url'),
            'pdf_url': primary_location.get('pdf_url') if primary_location else None,
            'is_open_access': primary_location.get('is_oa', False) if primary_location else False,
            'topics': [{
                'id': concept.get('id', '').split('/')[-1],
                'name': concept.get('display_name', ''),
                'score': concept.get('score', 1.0)
            } for concept in paper.get('concepts', [])] if paper.get('concepts') else [{
                'id': 'unknown',
                'name': 'Unknown',
                'score': 1.0
            }]
        }
        
        return transformed
    except Exception as e:
        print(f"Error transforming paper: {str(e)}")
        # Return a minimal valid paper object instead of None
        return {
            'id': paper.get('id', '').split('/')[-1] if paper.get('id') else 'unknown',
            'title': paper.get('title', 'Untitled Paper'),
            'abstract': '',
            'authors': [],
            'year': None,
            'citations': [],
            'citationCount': 0,
            'references':[ref.split('/')[-1] for ref in paper.get('referenced_works') or []]
        }

app = Flask(__name__, static_folder='scholar-sphere-frontend/build', static_url_path='/')

# Configure CORS
CORS(app)

@app.route('/')
def serve():
    return app.send_static_file('index.html')

@app.errorhandler(404)
def not_found(e):
    return app.send_static_file('index.html')

# Configure requests with retries and backoff
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
http = requests.Session()
http.mount("https://", adapter)
http.mount("http://", adapter)

async def search_papers_with_cache(session, query, cursor=None, per_page=25):
    """Search papers with Redis caching and cursor pagination"""
    cache_key = f"search:{query}:{cursor}:{per_page}"
    cached_data = redis_client.get(cache_key)
    
    if cached_data:
        return json.loads(cached_data)
    
    try:
        # Split query by commas for filtering
        keywords = [k.strip() for k in query.split(',') if k.strip()]
        
        params = {
            'search': query,
            'per_page': per_page,
            'select': 'id,title,abstract_inverted_index,publication_year,authorships,cited_by_count,referenced_works,cited_by_api_url,concepts,type,doi,primary_location,concepts'
        }
        
        # Add filter conditions if multiple keywords
        if len(keywords) > 1:
            filter_conditions = [f'title.search:{k}|abstract.search:{k}' for k in keywords[1:]]
            params['filter'] = '|'.join(filter_conditions)
        
        # Add cursor for pagination beyond 10,000 results
        if cursor:
            params['cursor'] = cursor
        elif cursor is None:  # Initial request
            params['cursor'] = '*'
            
        async with session.get(
            f'{OPENALEX_API_URL}/works',
            params=params,
            headers={'User-Agent': f'mailto:{EMAIL}'}
        ) as response:
            if response.status != 200:
                return None
            data = await response.json()
            if data:
                redis_client.setex(cache_key, CACHE_DURATION // 2, json.dumps(data))
            return data
    except Exception as e:
        print(f"Error in search: {e}")
        return None

@app.route('/api/search')
@async_route
async def search():
    """Search papers with caching, async processing, and cursor pagination"""
    query = request.args.get('q', '')
    if not query:
        return jsonify({"error": "Search query is required"}), 400

    try:
        per_page = min(int(request.args.get('per_page', 25)), 200)
        cursor = request.args.get('cursor', None)
    except ValueError:
        return jsonify({"error": "Invalid per_page parameter"}), 400

    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
            data = await search_papers_with_cache(session, query, cursor, per_page)
            
            if not data:
                return jsonify({"error": "Failed to fetch search results"}), 500
                
            results = [transform_paper(paper) for paper in data.get('results', []) if paper.get('id') and paper.get('title')]
            meta = data.get('meta', {})
            
            return jsonify({
                'results': results,
                'meta': {
                    'per_page': per_page,
                    'total_results': meta.get('count', 0),
                    'next_cursor': meta.get('next_cursor'),
                }
            })
            
    except Exception as e:
        return jsonify({"error": f"Error processing search: {str(e)}"}), 500

async def fetch_paper_with_cache(session, paper_id, params=None):
    """Fetch paper data with Redis caching"""
    try:
        # Clean paper ID
        paper_id = paper_id.strip()
        if paper_id.startswith('https://openalex.org/'):
            paper_id = paper_id.split('/')[-1]
        elif '/' in paper_id:  # Handle any other URL format
            paper_id = paper_id.split('/')[-1]
            
        if not paper_id.startswith('W'):
            paper_id = f'W{paper_id}'
            
        print(f"Processing paper ID: {paper_id}")
        
        cache_key = f"paper:{paper_id}"
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            print(f"Cache hit for paper {paper_id}")
            try:
                data = json.loads(cached_data)
                if data and data.get('id'):  # Validate cached data
                    return data
                print(f"Invalid cached data for paper {paper_id}")
            except json.JSONDecodeError:
                print(f"Corrupted cache for paper {paper_id}")
            # If cache is invalid or corrupted, continue to fetch from API
            
        if not params:
            params = {
                'select': 'id,title,abstract_inverted_index,publication_year,authorships,cited_by_count,referenced_works,cited_by_api_url,concepts,type,doi,primary_location,concepts'
            }
        
        print(f"Fetching paper {paper_id} from OpenAlex")
        async with session.get(
            f'{OPENALEX_API_URL}/works/{paper_id}',
            params=params,
            headers={'User-Agent': f'mailto:{EMAIL}'}
        ) as response:
            if response.status == 404:
                print(f"Paper {paper_id} not found")
                return None
            elif response.status == 429:
                print(f"Rate limit hit for paper {paper_id}")
                return None
            elif response.status != 200:
                print(f"Error fetching paper {paper_id}: HTTP {response.status}")
                return None
                
            try:
                data = await response.json()
                if not data:
                    print(f"Empty response for paper {paper_id}")
                    return None
                    
                if 'error' in data:
                    print(f"API error for paper {paper_id}: {data['error']}")
                    return None
                    
                # Validate essential fields
                if not data.get('id') or not data.get('title'):
                    print(f"Missing required fields for paper {paper_id}")
                    return None
                    
                # Cache the valid response
                redis_client.setex(cache_key, CACHE_DURATION, json.dumps(data))
                print(f"Successfully fetched and cached paper {paper_id}")
                return data
                
            except json.JSONDecodeError as e:
                print(f"JSON decode error for paper {paper_id}: {str(e)}")
                return None
                
    except Exception as e:
        print(f"Unexpected error fetching paper {paper_id}: {str(e)}")
        return None

def is_valid_openalex_id(paper_id):
    """Check if a paper ID appears to be a valid OpenAlex ID"""
    if not paper_id:
        return False
    
    # Clean the ID
    paper_id = paper_id.strip()
    if paper_id.startswith('https://openalex.org/'):
        paper_id = paper_id.split('/')[-1]
    elif '/' in paper_id:
        paper_id = paper_id.split('/')[-1]
    
    # Valid OpenAlex IDs for works start with 'W' followed by digits
    return paper_id.startswith('W') and paper_id[1:].isdigit()




@app.route('/api/paper/<paper_id>')
@async_route
async def get_paper(paper_id):
    """Get details for a single paper with its references and citations
    
    Query parameters:
    - max_citations: Maximum number of citation pages to fetch (default: 50, each page has 200 citations)
    """
    if not paper_id:
        return jsonify({'error': 'No paper ID provided'}), 400
        
    try:
        # OpenAlex IDs are URLs, so we need to handle both formats
        if not paper_id.startswith('W'):
            paper_id = f'W{paper_id}'
            
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
            # Fetch main paper data
            paper = await fetch_paper_with_cache(session, paper_id)
            
            if not paper:
                return jsonify({"error": "Paper not found"}), 404
                
            # Transform the main paper data
            paper_data = transform_paper(paper)
            
            # Get references directly from referenced_works
            references = []
            if paper.get('referenced_works'):
                print(f"Fetching {len(paper['referenced_works'])} references")
                try:
                    params = {
                        'select': 'id,title,abstract_inverted_index,publication_year,authorships,cited_by_count,doi,primary_location,concepts',
                        'per_page': 200,  # Maximum allowed by OpenAlex
                        'sort': 'cited_by_count:desc'
                    }
                    # Process references directly without pagination
                    ref_ids = [ref.split('/')[-1] for ref in paper['referenced_works']]
                    
                    # Process in smaller batches
                    batch_size = 25  # Smaller batch size
                    for i in range(0, len(ref_ids), batch_size):
                        batch_ids = ref_ids[i:i + batch_size]
                        batch_filter = '|'.join(batch_ids)
                        batch_params = {**params, 'filter': f'openalex:W{batch_filter}'}
                        
                        try:
                            async with session.get(
                                f'{OPENALEX_API_URL}/works',
                                params=batch_params,
                                headers={'User-Agent': f'mailto:{EMAIL}'}
                            ) as response:
                                if response.status == 200:
                                    data = await response.json()
                                    if data and 'results' in data:
                                        batch_refs = [transform_paper(ref) for ref in data['results'] if ref]
                                        references.extend(batch_refs)
                                        print(f"Processed references batch {i//batch_size + 1}, got {len(batch_refs)} papers")
                                else:
                                    print(f"Batch request failed with status {response.status}")
                        except Exception as e:
                            print(f"Error processing batch: {str(e)}")
                            continue
                    
                    print(f"Successfully processed {len(references)} total references")
                except Exception as e:
                    print(f"Error fetching references: {str(e)}")
            
            # Get citations directly from the cited_by_api_url
            citations = []
            if paper.get('cited_by_api_url'):
                print(f"Using citations URL: {paper.get('cited_by_api_url')}")
                try:
                    params = {
                        'select': 'id,title,abstract_inverted_index,publication_year,authorships,cited_by_count,doi,primary_location,concepts',
                        'per_page': 200,
                        'sort': 'cited_by_count:desc'
                    }
                    
                    # Get total count and first page of results
                    async with session.get(
                        paper.get('cited_by_api_url'),
                        params={**params, 'page': 1},
                        headers={'User-Agent': f'mailto:{EMAIL}'}
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            total_citations = data.get('meta', {}).get('count', 0)
                            total_pages = (total_citations + params['per_page'] - 1) // params['per_page']
                            
                            # Get all pages of citations
                            max_pages = total_pages
                            
                            print(f"Total citations: {total_citations}, pages: {total_pages}, fetching max {max_pages} pages")
                            
                            # Process first page results that we already have
                            if data and 'results' in data:
                                first_page_citations = [transform_paper(cite) for cite in data['results'] if cite]
                                citations.extend(first_page_citations)
                                print(f"Processed citations page 1, got {len(first_page_citations)} papers")
                            
                            async def fetch_citations_page(page_num):
                                try:
                                    page_params = {**params, 'page': page_num}
                                    async with session.get(
                                        paper.get('cited_by_api_url'),
                                        params=page_params,
                                        headers={'User-Agent': f'mailto:{EMAIL}'}
                                    ) as page_response:
                                        if page_response.status == 200:
                                            page_data = await page_response.json()
                                            if page_data and 'results' in page_data:
                                                batch_citations = [transform_paper(cite) for cite in page_data['results'] if cite]
                                                print(f"Processed citations page {page_num}, got {len(batch_citations)} papers")
                                                return batch_citations
                                        elif page_response.status == 403:
                                            # OpenAlex API has a limit of ~10,000 citations (50 pages)
                                            # When we hit this limit, stop processing and return what we have
                                            print(f"Received 403 Forbidden for page {page_num} - OpenAlex API limit reached")
                                            return []
                                        else:
                                            print(f"Error status {page_response.status} for page {page_num}")
                                        return []
                                except Exception as e:
                                    print(f"Error processing citations page {page_num}: {str(e)}")
                                    return []
                            
                            # Process remaining pages (2 to max_pages) in small batches with longer delays between batches
                            batch_size = 10  # Process 10 pages at a time
                            for batch_start in range(2, max_pages + 1, batch_size):
                                batch_end = min(batch_start + batch_size, max_pages + 1)
                                print(f"Processing citations batch {batch_start}-{batch_end-1}")
                                
                                # Create tasks for this batch
                                batch_tasks = [fetch_citations_page(page) for page in range(batch_start, batch_end)]
                                batch_results = await asyncio.gather(*batch_tasks)
                                
                                # Process results from this batch
                                batch_citations = []
                                for page_citations in batch_results:
                                    if page_citations:  # Only add non-empty results
                                        batch_citations.extend(page_citations)
                                
                                # Add to main citations list
                                citations.extend(batch_citations)
                                if (len(batch_citations)==0):
                                    break
                                
                                print(f"Added {len(batch_citations)} citations from batch {batch_start}-{batch_end-1}, total now: {len(citations)}")
                                
                                # Add a longer delay between batches to avoid overwhelming the API
                                if batch_end < max_pages + 1:
                                    print(f"Sleeping for 2 seconds before next batch...")
                                    await asyncio.sleep(1)  # Longer sleep between batches
                            
                            print(f"Successfully processed {len(citations)} total citations")
                except Exception as e:
                    print(f"Error fetching citations: {str(e)}")
            
            # Update paper data with references and citations
            paper_data['references'] = references
            paper_data['citations'] = citations
            
            print(f"Final paper data - References: {len(references)}, Citations: {len(citations)}")
            
            return jsonify(paper_data)
            
    except Exception as e:
        return jsonify({"error": f"Error processing paper: {str(e)}"}), 500

@app.route('/api/papers')
@async_route
async def get_papers():
    """Get details for multiple papers"""
    paper_ids = request.args.get('ids', '').split(',')
    if not paper_ids or not paper_ids[0]:
        return jsonify({'error': 'No paper IDs provided'}), 400
    
    if len(paper_ids) > 5000:  # Limit batch size
        return jsonify({'error': 'Too many paper IDs requested (max 50)'}), 400
        
    try:
        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=ssl_context)) as session:
            # Fetch papers individually
            papers = []
            for paper_id in paper_ids:
                paper = await fetch_paper_with_cache(session, paper_id)
                if paper:
                    transformed = transform_paper(paper)
                    if transformed:
                        papers.append(transformed)
            
            return jsonify(papers)
        
    except Exception as e:
        return jsonify({'error': f'Error processing papers: {str(e)}'}), 500

if __name__ == "__main__":
    import os
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 10000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host=host, port=port, debug=debug)
