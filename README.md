# Credit Underwriter Agent

A powerful AI-powered credit underwriting system that analyzes bank statements to make automated lending decisions. The system processes PDF bank statements and provides detailed financial analysis and credit recommendations for different loan products.

## Features

- 📊 Comprehensive Bank Statement Analysis
  - Statement continuity verification
  - Daily balance tracking
  - NSF (Non-Sufficient Funds) detection
  - Monthly closing balance analysis
  - Detailed financial metrics calculation

- 🤖 Multiple AI Provider Support
  - Anthropic Claude
  - Google PaLM
  - OpenAI

- 💰 Multi-Product Credit Assessment
  - Term Loan analysis
  - Accounts Payable Financing analysis

- 🔒 Secure File Handling
  - PDF file processing
  - Temporary file storage
  - Automatic cleanup

## Prerequisites

- Python 3.8+
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/Credit-Underwriter-Agent.git
cd Credit-Underwriter-Agent
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key
```

## Running the Application

### Local Development
```bash
python main.py
```
The application will be available at `http://localhost:8080`

### Using Docker
```bash
docker-compose up --build
```
The application will be available at `http://localhost:8080`

## API Endpoints

- `GET /` - Web interface for file upload and analysis
- `POST /upload` - Upload PDF bank statements
- `POST /underwrite` - Process uploaded statements and generate credit analysis
- `GET /status` - Stream analysis status updates
- `POST /clear-uploads` - Clear uploaded files

## Usage

1. Access the web interface at `http://localhost:8080`
2. Upload PDF bank statements
3. Select the AI provider (Anthropic, Google, or OpenAI)
4. Start the analysis
5. View real-time progress updates
6. Receive detailed credit analysis and recommendations

## Analysis Output

The system provides comprehensive analysis including:
- Statement continuity verification
- Daily balance trends
- NSF incidents
- Monthly closing balances
- Financial metrics
- Credit recommendations for different loan products
- Risk factors and mitigating circumstances
- Suggested loan terms and conditions

## Directory Structure

```
├── app/                    # Application code
│   ├── services/          # Core services
│   ├── tools/             # Analysis tools
│   ├── static/            # Static files
│   └── templates/         # HTML templates
├── utils/                 # Utility functions
├── uploads/               # Temporary file storage
├── main.py               # Application entry point
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
└── requirements.txt      # Python dependencies
```

## Security Considerations

- All uploaded files are temporarily stored and automatically cleaned up
- API keys are managed through environment variables
- File size limits are enforced
- Secure filename handling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 