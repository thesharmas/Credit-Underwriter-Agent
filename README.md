# PDF Extractor

A simple web application that allows users to upload PDF bank statements and analyze them using various LLM providers.

## Features

- Upload multiple PDF bank statements
- Process PDFs using different LLM providers (Anthropic, OpenAI, Google)
- Analyze bank statements for:
  - Statement continuity
  - Daily balances
  - NSF fees
  - Monthly closing balances
  - Monthly financials
  - Credit analysis

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set up environment variables in a `.env` file:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   GOOGLE_API_KEY=your_google_api_key
   OPENAI_API_KEY=your_openai_api_key
   ```

## Running the Application

```
python main.py
```

The application will be available at http://localhost:8080

## Project Structure

```
├── app/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── script.js
│   ├── templates/
│   │   └── index.html
│   ├── services/
│   ├── tools/
│   └── config/
├── uploads/
├── main.py
├── requirements.txt
└── README.md
```

## How to Use

1. Open the application in your web browser
2. Upload one or more PDF bank statements
3. Select the LLM provider and model type
4. Click "Process PDFs"
5. View the analysis results

## API Endpoints

- `GET /`: Main page
- `POST /upload`: Upload PDF files
- `POST /underwrite`: Process uploaded PDFs and generate analysis 