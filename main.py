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
    provider = request.form.get('provider')
    
    # Add debug logging
    logger.info(f"Received upload request with provider: {provider}")
    logger.info(f"Form data: {request.form}")
    
    if not files or files[0].filename == '':
        return jsonify({"error": "No files selected"}), 400
    
    try:
        file_paths = []
        
        # Save uploaded files with unique names
        for file in files:
            if file and file.filename.endswith('.pdf'):
                filename = secure_filename(file.filename)
                unique_filename = f"{uuid.uuid4()}_{filename}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                
                logger.info(f"Saving uploaded file: {filename} as {unique_filename}")
                file.save(file_path)
                file_paths.append(file_path)
        
        if not file_paths:
            return jsonify({"error": "No valid PDF files uploaded"}), 400
            
        # Convert provider string to enum and pass it to merge_pdfs_by_type
        if provider:
            provider_enum = LLMProvider(provider.lower())
            logger.info(f"Using provider {provider_enum} for document classification")
        else:
            logger.warning("No provider specified in upload request, using default")
            provider_enum = Config.DEFAULT_PROVIDER
        
        # Classify and merge files by type
        logger.info("Classifying and merging uploaded files")
        merged_files = content_service.merge_pdfs_by_type(file_paths, provider=provider_enum)
        
        # Prepare response with document counts
        response = {
            "merged_files": merged_files,
            "summary": {
                "total_files": len(file_paths),
                "bank_statements": "bank_statements" in merged_files,
                "tax_returns": "tax_returns" in merged_files
            },
            "original_files": file_paths,
            "provider": provider  # Include provider in response for verification
        }
        
        logger.info(f"Upload processed successfully: {json.dumps(response, indent=2)}")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Clean up any saved files on error
        for path in file_paths:
            try:
                if os.path.exists(path):
                    os.remove(path)
                    logger.info(f"Cleaned up file after error: {path}")
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up file {path}: {str(cleanup_error)}")
        
        return jsonify({
            "error": "Error processing upload",
            "details": str(e)
        }), 500

@app.route('/underwrite', methods=['POST'])
def underwrite():
    logger.info("📥 Received underwrite request")
    send_status("start", "Processing", "Received underwrite request")
    
    debug_mode = request.json.get('debug', False)
    file_paths = request.json.get('file_paths', [])
    merged_files = request.json.get('merged_files', {})  # New parameter from upload
    provider = request.json.get('provider')
    document_types = request.json.get('document_types', {})

    logger.info(f"Debug mode: {debug_mode}")
    logger.info(f"File paths: {file_paths}")
    logger.info(f"Merged files: {merged_files}")
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
                provider_enum = LLMProvider(provider_value)  # Keep enum version for LLM creation
                
                # Pass the provider to merge_pdfs_by_type
               # merged_files = content_service.merge_pdfs_by_type(file_paths, provider=provider_enum)
                
                analysis_llm = LLMFactory.create_llm(
                    provider=provider_enum,
                    model_type=None  # Use default model type
                )
                
                # Store string version in master_response
                master_response = {
                    "provider": provider_value,  # Store string value, not enum
                    "metrics": {},
                    "analysis": {
                        "bank_statements": {},
                        "tax_returns": {}
                    },
                    "document_types": {
                        "has_bank_statements": False,
                        "has_tax_returns": False
                    },
                    "loan_recommendations": []
                }
                
            except ValueError as e:
                logger.error(f"Invalid configuration error: {str(e)}")
                return jsonify({
                    "error": f"Invalid configuration. Valid providers: {[p.value for p in LLMProvider]}"
                }), 400
        else:
            analysis_llm = LLMFactory.create_llm()
            master_response = {
                "provider": Config.DEFAULT_PROVIDER.value,  # Store string value of default provider
                "metrics": {},
                "analysis": {
                    "bank_statements": {},
                    "tax_returns": {}
                },
                "document_types": {
                    "has_bank_statements": False,
                    "has_tax_returns": False
                },
                "loan_recommendations": []
            }
        
        set_llm(analysis_llm)
        send_status("llm_setup", "Complete", "LLM initialized successfully")

        # Process bank statements if present
        if "bank_statements" in merged_files:
            send_status("bank_analysis", "Processing", "Analyzing bank statements")
            bank_statement_path = merged_files["bank_statements"]
            
            # Update document type flag
            master_response["document_types"]["has_bank_statements"] = True
            
            # Add bank statements to LLM context
            analysis_llm.add_pdf(bank_statement_path)
            
            try:
                # Run bank statement analysis pipeline
                continuity_json = check_statement_continuity("None")
                continuity_data = json.loads(continuity_json)
                
                # Store in bank statements section
                master_response["analysis"]["bank_statements"]["continuity"] = continuity_data
                
                # Only add to metrics if continuity check passes
                is_contiguous = continuity_data.get("analysis", {}).get("is_contiguous", False)
                if is_contiguous:
                    master_response["metrics"]["statement_continuity"] = continuity_data
                    
                    # Continue with other bank statement analyses
                    input_data = json.dumps({"continuity_data": continuity_data})
                    balances_json = extract_daily_balances(input_data)
                    master_response["analysis"]["bank_statements"]["daily_balances"] = json.loads(balances_json)
                    
                    nsf_json = check_nsf("None")
                    master_response["analysis"]["bank_statements"]["nsf_information"] = json.loads(nsf_json)
                    
                    closing_balances_json = extract_monthly_closing_balances("None")
                    master_response["analysis"]["bank_statements"]["closing_balances"] = json.loads(closing_balances_json)
                    
                    monthly_financials_json = analyze_monthly_financials("None")
                    master_response["analysis"]["bank_statements"]["monthly_financials"] = json.loads(monthly_financials_json)
                    
                    # Copy key metrics to top level for backward compatibility
                    master_response["metrics"].update({
                        "daily_balances": master_response["analysis"]["bank_statements"]["daily_balances"],
                        "nsf_information": master_response["analysis"]["bank_statements"]["nsf_information"],
                        "closing_balances": master_response["analysis"]["bank_statements"]["closing_balances"],
                        "monthly_financials": master_response["analysis"]["bank_statements"]["monthly_financials"]
                    })
                    
                else:
                    # Handle non-contiguous statements
                    explanation = continuity_data.get("analysis", {}).get("explanation", "No explanation provided")
                    gap_details = continuity_data.get("analysis", {}).get("gap_details", [])
                    master_response["analysis"]["bank_statements"]["error"] = {
                        "type": "continuity_error",
                        "explanation": explanation,
                        "gap_details": gap_details
                    }
                    
            except Exception as e:
                logger.error(f"Error during bank statement analysis: {str(e)}")
                master_response["analysis"]["bank_statements"]["error"] = {
                    "type": "analysis_error",
                    "message": str(e)
                }

        # Process tax returns if present
        if "tax_returns" in merged_files:
            send_status("tax_analysis", "Processing", "Analyzing tax returns")
            tax_return_path = merged_files["tax_returns"]
            
            # Add tax returns to LLM context
            analysis_llm.add_pdf(tax_return_path)
            
            # TODO: Add tax return analysis functions here
            # This will be implemented in the next step
            master_response["analysis"]["tax_returns"] = {
                "status": "pending",
                "message": "Tax return analysis to be implemented"
            }
            
            send_status("tax_analysis", "Complete", "Tax return analysis complete")

        # Perform credit analysis for any available documents
        send_status("credit_analysis", "Processing", "Performing credit analysis")
        
        # Switch to reasoning LLM for credit analysis
        try:
            reasoning_llm = LLMFactory.create_llm(
                provider=provider_enum,
                model_type=ModelType.REASONING
            )
            set_llm(reasoning_llm)
            
            # Add document availability to master response
            master_response["document_types"] = {
                "has_bank_statements": "bank_statements" in merged_files,
                "has_tax_returns": "tax_returns" in merged_files
            }
            
            # Add context about available documents
            context_message = {
                "analysis_context": {
                    "available_documents": master_response["document_types"],
                    "analysis_summary": {
                        "bank_statements": master_response["analysis"]["bank_statements"] if "bank_statements" in merged_files else None,
                        "tax_returns": master_response["analysis"]["tax_returns"] if "tax_returns" in merged_files else None
                    }
                }
            }
            
            # Add context first, then full response
            reasoning_llm.add_json(context_message)
            reasoning_llm.add_json(master_response)
            
            # Perform credit analysis for both products
            term_loan_analysis = analyze_credit_decision_term_loan("None")
            term_loan_recommendation = term_loan_analysis.get("credit_analysis", {}).get("loan_recommendation", {})
            
            # Add document source information to recommendation
            term_loan_recommendation["analysis_based_on"] = {
                "used_bank_statements": "bank_statements" in merged_files,
                "used_tax_returns": "tax_returns" in merged_files
            }
            
            accounts_payable_analysis = analyze_credit_decision_accounts_payable("None")
            accounts_payable_recommendation = accounts_payable_analysis.get("credit_analysis", {}).get("loan_recommendation", {})
            
            # Add document source information to recommendation
            accounts_payable_recommendation["analysis_based_on"] = {
                "used_bank_statements": "bank_statements" in merged_files,
                "used_tax_returns": "tax_returns" in merged_files
            }
            
            master_response["loan_recommendations"] = [
                term_loan_recommendation,
                accounts_payable_recommendation
            ]
            
            # Add summary of data sources used
            master_response["analysis_metadata"] = {
                "data_sources_used": {
                    "bank_statements": "bank_statements" in merged_files,
                    "tax_returns": "tax_returns" in merged_files
                },
                "analysis_timestamp": time.time(),
                "provider_used": provider
            }
            
            send_status("credit_analysis", "Complete", "Credit analysis complete")
            
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
                    },
                    "analysis_based_on": {
                        "used_bank_statements": "bank_statements" in merged_files,
                        "used_tax_returns": "tax_returns" in merged_files
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
                    },
                    "analysis_based_on": {
                        "used_bank_statements": "bank_statements" in merged_files,
                        "used_tax_returns": "tax_returns" in merged_files
                    }
                }
            ]

        send_status("complete", "Success", "All analyses complete")
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