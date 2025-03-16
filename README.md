# PaperPath - Academic Paper Network Visualization

A web application for visualizing academic paper networks using data from the Semantic Scholar API. The application allows users to search for academic papers and visualize their citation networks.

## Features

- Search academic papers using Semantic Scholar API
- Visualize paper citation networks
- View paper details, references, and citations
- Interactive network graph visualization
- Modern, responsive UI

## Tech Stack

- Backend: Python/Flask
- Frontend: React
- APIs: Semantic Scholar API
- Graph Visualization: D3.js

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/scholar-sphere.git
cd scholar-sphere
```

2. Install backend dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your Semantic Scholar API key
```

4. Install frontend dependencies:
```bash
cd litmap-frontend
npm install
```

5. Run the development servers:

Backend:
```bash
python app.py
```

Frontend:
```bash
cd litmap-frontend
npm start
```

## Environment Variables

- `SEMANTIC_SCHOLAR_API_KEY`: Your Semantic Scholar API key (optional)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
>>>>>>> 5e5b73c (Initial commit)
