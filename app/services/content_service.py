from typing import List, Dict
import logging
import traceback
from PyPDF2 import PdfMerger
import uuid
from app.services.llm_factory import LLMFactory
from app.tools.analysis_tools import classify_document_type, set_llm
from app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class ContentService:
    def merge_pdfs_by_type(self, file_paths: List[str], doc_type: str = None, provider: LLMProvider = None) -> Dict[str, str]:
        """
        Merge PDFs by document type. If doc_type is not specified, uses AI classification.
        
        Args:
            file_paths: List of paths to PDF files
            doc_type: Optional, specific document type to merge as
            provider: Optional, LLM provider to use for classification
            
        Returns:
            Dict mapping document types to merged PDF paths
        """
        logger.info(f"🔄 Processing {len(file_paths)} PDFs...")
        
        if not file_paths:
            logger.warning("No PDF files provided")
            return {}
            
        try:
            if doc_type:
                # If type is specified, merge into single file
                output_path = f"merged_{doc_type}_{uuid.uuid4()}.pdf"
                merger = PdfMerger()
                for path in file_paths:
                    logger.info(f"Adding file to {doc_type} merger: {path}")
                    merger.append(path)
                merger.write(output_path)
                merger.close()
                logger.info(f"Created merged {doc_type} file: {output_path}")
                return {doc_type: output_path}
            else:
                # If no type specified, classify and merge separately
                classification_llm = LLMFactory.create_llm(provider=provider)
                set_llm(classification_llm)
                
                bank_paths = []
                tax_paths = []
                
                # Classify each document
                for path in file_paths:
                    logger.info(f"Classifying document: {path}")
                    classification_llm.add_pdf(path)
                    result = classify_document_type()
                    
                    if result["document_type"] == "bank_statement":
                        logger.info(f"Classified as bank statement: {path}")
                        bank_paths.append(path)
                    elif result["document_type"] == "tax_return":
                        logger.info(f"Classified as tax return: {path}")
                        tax_paths.append(path)
                    else:
                        logger.warning(f"Unknown document type for {path}: {result}")
                
                merged_files = {}
                
                # Merge bank statements if any found
                if bank_paths:
                    bank_output = f"merged_bank_{uuid.uuid4()}.pdf"
                    merger = PdfMerger()
                    for path in bank_paths:
                        merger.append(path)
                    merger.write(bank_output)
                    merger.close()
                    merged_files["bank_statements"] = bank_output
                    logger.info(f"Created merged bank statements file: {bank_output}")
                
                # Merge tax returns if any found
                if tax_paths:
                    tax_output = f"merged_tax_{uuid.uuid4()}.pdf"
                    merger = PdfMerger()
                    for path in tax_paths:
                        merger.append(path)
                    merger.write(tax_output)
                    merger.close()
                    merged_files["tax_returns"] = tax_output
                    logger.info(f"Created merged tax returns file: {tax_output}")
                
                return merged_files
                
        except Exception as e:
            logger.error(f"❌ Error in merge_pdfs_by_type: {str(e)}")
            logger.error(traceback.format_exc())
            raise

   