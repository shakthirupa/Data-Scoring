# Data Quality Scoring Backend

## Setup

1. Install MongoDB locally or use MongoDB Atlas

2. Create `.env` file:
```
PORT=5000
MONGDB_URI=mongodb://localhost:27017/data-quality-db
```

3. Install dependencies:
```bash
npm install
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Analysis Routes
- **POST** `/api/analysis/upload` - Upload and analyze CSV file
- **GET** `/api/analysis/history` - Get all analysis history
- **GET** `/api/analysis/:id` - Get specific analysis by ID
- **POST** `/api/analysis/insights` - Get AI insights based on scores

### User Routes
- **GET** `/api/user/profile` - Get user profile
- **PUT** `/api/user/profile` - Update user profile

### Settings Routes
- **GET** `/api/settings` - Get user settings
- **PUT** `/api/settings` - Update settings
- **POST** `/api/settings/regenerate-key` - Regenerate API key

### Dashboard Routes
- **GET** `/api/dashboard/stats` - Get dashboard statistics
- **GET** `/api/dashboard/trends` - Get 30-day quality trends
- **GET** `/api/dashboard/issues` - Get issues summary

### Recommendation Routes
- **POST** `/api/recommendations/:analysisId/generate` - Generate recommendations
- **GET** `/api/recommendations/:analysisId` - Get recommendations

### Export Routes
- **GET** `/api/export/report/:analysisId` - Export analysis report
- **GET** `/api/export/history` - Export all history as CSV

### Comparison Routes
- **POST** `/api/comparison/compare` - Compare multiple analyses
- **GET** `/api/comparison/search` - Search analyses with filters

### Health Check
- **GET** `/api/health` - Server health status

## Features

### Advanced Analytics
- Dashboard statistics with score distribution
- 30-day quality trends tracking
- Issue tracking by severity and type

### AI-Powered Recommendations
- Automated recommendations based on scores
- Priority-based action items
- Category-specific suggestions

### Data Export
- Detailed analysis reports
- CSV export for history
- Comprehensive issue summaries

### Comparison & Search
- Compare multiple analyses side-by-side
- Advanced search with filters (score range, date range, filename)
- Average score calculations

## MongoDB Collections
- **analyses** - File analysis results
- **users** - User profiles
- **settings** - User preferences
- **recommendations** - AI-generated recommendations
- **dataissues** - Tracked data quality issues

## Server runs on port 5000
