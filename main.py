from flask import Flask, request, jsonify, Response, render_template,stream_with_context
import os
import traceback
from app.services.content_service import ContentService
from typing import List, Dict, Any, Tuple
import logging
from app.services.content_service import ContentService
from app.tools.analysis_tools import  check_nsf, set_llm,check_statement_continuity,extract_daily_balances,extract_monthly_closing_balances,analyze_credit_decision_term_loan,analyze_monthly_financials, analyze_credit_decision_accounts_payable
from app.services.llm_factory import LLMFactory
from app.config import  LLMProvider, ModelType
import json
import uuid
from werkzeug.utils import secure_filename
from queue import Queue
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,  
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Create logger for this module
logger = logging.getLogger(__name__)

# Set specific loggers to DEBUG level

# Add near the top of the file, after other imports
content_service = ContentService()

# Create a queue for status messages
status_queue = Queue()


# Create upload directory if it doesn't exist
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__, 
    static_folder='app/static',
    template_folder='app/templates'
)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload size

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({"error": "No files part in the request"}), 400
    
    files = request.files.getlist('files')
    
    if not files or files[0].filename == '':
        return jsonify({"error": "No files selected"}), 400
    
    file_paths = []
    
    for file in files:
        if file and file.filename.endswith('.pdf'):
            # Create a unique filename to avoid collisions
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # Save the file
            file.save(file_path)
            file_paths.append(file_path)
    
    if not file_paths:
        return jsonify({"error": "No valid PDF files uploaded"}), 400
    
    return jsonify({"file_paths": file_paths})

@app.route('/underwrite', methods=['POST'])
def underwrite():
    logger.info("📥 Received underwrite request")
    send_status("start", "Processing", "Received underwrite request")
    
    debug_mode = request.json.get('debug', False)
    file_paths = request.json.get('file_paths', [])
    provider = request.json.get('provider')
    
    logger.info(f"Debug mode: {debug_mode}")
    logger.info(f"File paths: {file_paths}")
    logger.info(f"Provider: {provider}")
    
    if not file_paths:
        logger.error("No file paths provided")
        return jsonify({"error": "No file paths provided"}), 400

    try:
        # Initialize LLM
        send_status("llm_setup", "Processing", f"Initializing {provider} LLM")
        if provider:
            try:
                provider_value = provider.lower()
                provider = LLMProvider(provider_value)
                analysis_llm = LLMFactory.create_llm(
                    provider=provider,
                    model_type=None  # Use default model type
                )
            except ValueError as e:
                logger.error(f"Invalid configuration error: {str(e)}")
                return jsonify({
                    "error": f"Invalid configuration. Valid providers: {[p.value for p in LLMProvider]}"
                }), 400
        else:
            analysis_llm = LLMFactory.create_llm()
        
        set_llm(analysis_llm)
    
        send_status("llm_setup", "Complete", "LLM initialized successfully")

        # Process and add PDFs
        send_status("pdf_processing", "Processing", "Merging PDF files")
        merged_pdf_path = content_service.merge_pdfs(file_paths)
        analysis_llm.add_pdf(merged_pdf_path)
        send_status("pdf_processing", "Complete", "PDFs processed successfully")

        # Check statement continuity first
        send_status("continuity", "Processing", "Checking statement continuity")
        continuity_json = check_statement_continuity("None")
        continuity_data = json.loads(continuity_json)
        
        is_contiguous = continuity_data.get("analysis", {}).get("is_contiguous", False)
        explanation = continuity_data.get("analysis", {}).get("explanation", "No explanation provided")
        gap_details = continuity_data.get("analysis", {}).get("gap_details", [])
        
        if not is_contiguous:
            logger.warning("❌ Bank statements are not contiguous!")
            logger.warning(f"Analysis: {explanation}")
            if gap_details:
                logger.warning(f"Found gaps: {gap_details}")
            send_status("continuity", "Error", f"Statements not contiguous: {explanation}")
            return jsonify({
                "error": "Bank statements are not contiguous",
                "metrics": {
                    "statement_continuity": continuity_data
                },
                "details": {
                    "explanation": explanation,
                    "gap_details": gap_details
                }
            })
        
        send_status("continuity", "Complete", "Statements are contiguous")
        
        # Initialize master response
        master_response = {
            "metrics": {
                "statement_continuity": continuity_data
            }
        }
        
        # Run all analyses in sequence
        try:
            # 1. Daily Balances
            send_status("daily_balances", "Processing", "Analyzing daily balances")
            input_data = json.dumps({"continuity_data": continuity_data})
            balances_json = extract_daily_balances(input_data)
            master_response["metrics"]["daily_balances"] = json.loads(balances_json)
            send_status("daily_balances", "Complete", "Daily balance analysis complete")
            
            # 2. NSF Check
            send_status("nsf", "Processing", "Checking for NSF incidents")
            nsf_json = check_nsf("None")
            master_response["metrics"]["nsf_information"] = json.loads(nsf_json)
            send_status("nsf", "Complete", "NSF analysis complete")
            
            # 3. Monthly Closing Balances
            send_status("closing_balances", "Processing", "Analyzing monthly closing balances")
            closing_balances_json = extract_monthly_closing_balances("None")
            master_response["metrics"]["closing_balances"] = json.loads(closing_balances_json)
            send_status("closing_balances", "Complete", "Monthly closing balance analysis complete")
            
            # 4. Monthly Financials
            send_status("monthly_financials", "Processing", "Analyzing monthly financials")
            monthly_financials_json = analyze_monthly_financials("None")
            master_response["metrics"]["monthly_financials"] = json.loads(monthly_financials_json)
            send_status("monthly_financials", "Complete", "Monthly financial analysis complete")
            
        except Exception as e:
            logger.error(f"Error during analysis: {str(e)}")
            send_status("analysis", "Error", f"Analysis failed: {str(e)}")
            return jsonify({
                "error": "Analysis failed",
                "details": str(e),
                "partial_results": master_response
            }), 500
        
        # Switch to reasoning LLM for credit analysis
        try:
            # Use the same provider as selected in the UI
            send_status("llm_setup", "Processing", f"Initializing Reasoning LLM with {provider}")
            reasoning_llm = LLMFactory.create_llm(
                provider=provider,  # Use the same provider from UI
                model_type=ModelType.REASONING
            )
            set_llm(reasoning_llm)
            reasoning_llm.add_json(master_response)
            
            # Perform credit analysis for both products
            send_status("credit_analysis", "Processing", "Analyzing Term Loan product")
            term_loan_analysis = analyze_credit_decision_term_loan("None")
            term_loan_recommendation = term_loan_analysis.get("credit_analysis", {}).get("loan_recommendation", {})
            
            send_status("credit_analysis", "Processing", "Analyzing Accounts Payable product")
            accounts_payable_analysis = analyze_credit_decision_accounts_payable("None")
            accounts_payable_recommendation = accounts_payable_analysis.get("credit_analysis", {}).get("loan_recommendation", {})
            
            # Combine both analyses into the master response
            master_response["loan_recommendations"] = [
                term_loan_recommendation,
                accounts_payable_recommendation
            ]
            
            send_status("credit_analysis", "Complete", "Credit analysis complete for all products")
            
        except Exception as e:
            logger.error(f"Error during credit analysis: {str(e)}")
            send_status("credit_analysis", "Error", f"Credit analysis failed: {str(e)}")
            master_response["loan_recommendations"] = [
                {
                    "product_type": "term_loan",
                    "product_name": "Term Loan",
                    "approval_decision": "ERROR",
                    "confidence_score": 0,
                    "max_loan_amount": 0,
                    "max_monthly_payment_amount": 0,
                    "detailed_analysis": f"Credit analysis failed: {str(e)}",
                    "mitigating_factors": [],
                    "risk_factors": ["Analysis error occurred"],
                    "conditions_if_approved": [],
                    "key_metrics": {
                        "payment_coverage_ratio": 0,
                        "average_daily_balance_trend": "N/A",
                        "lowest_monthly_balance": 0,
                        "highest_nsf_month_count": 0
                    }
                },
                {
                    "product_type": "accounts_payable",
                    "product_name": "Accounts Payable Financing",
                    "approval_decision": "ERROR",
                    "confidence_score": 0,
                    "max_loan_amount": 0,
                    "max_monthly_payment_amount": 0,
                    "detailed_analysis": f"Credit analysis failed: {str(e)}",
                    "mitigating_factors": [],
                    "risk_factors": ["Analysis error occurred"],
                    "conditions_if_approved": [],
                    "key_metrics": {
                        "payment_coverage_ratio": 0,
                        "average_daily_balance_trend": "N/A",
                        "lowest_monthly_balance": 0,
                        "highest_nsf_month_count": 0
                    }
                }
            ]
        
        send_status("complete", "Success", "All analyses complete")
        # Log the formatted JSON response
        logger.info("Master response:")
        logger.info("-" * 50)
        logger.info(json.dumps(master_response, indent=2))
        logger.info("-" * 50)
        return jsonify(master_response)

    except Exception as e:
        logger.error(f"Error in underwrite: {str(e)}")
        logger.error(traceback.format_exc())
        send_status("error", "Error", f"Unexpected error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/clear-uploads', methods=['POST'])
def clear_uploads():
    try:
        # Clear the uploads directory
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                logger.error(f"Error deleting {file_path}: {str(e)}")
        
        return jsonify({"message": "Uploads cleared successfully"}), 200
    except Exception as e:
        logger.error(f"Error clearing uploads: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add new route for SSE
@app.route('/status')
def status_stream():
    def event_stream():
        while True:
            # Get message from queue
            if not status_queue.empty():
                message = status_queue.get()
                yield f"data: {json.dumps(message)}\n\n"
            time.sleep(0.5)  # Small delay to prevent CPU overuse
    
    return Response(stream_with_context(event_stream()), 
                   mimetype='text/event-stream')

# Helper function to send status updates
def send_status(step: str, status: str, details: str = None):
    status_message = {
        "step": step,
        "status": status,
        "details": details,
        "timestamp": time.time()
    }
    status_queue.put(status_message)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    # Enable debug mode for hot reloading
    app.run(host='0.0.0.0', port=port, debug=True)