from typing import List
import logging
import traceback
from PyPDF2 import PdfMerger

logger = logging.getLogger(__name__)

class ContentService:
    def merge_pdfs(self, file_paths: List[str], output_path: str = "merged.pdf") -> str:
        """Merge multiple PDFs into one file"""
        logger.info(f"🔄 Merging {len(file_paths)} PDFs...")
        
        merger = PdfMerger()
        
        try:
            # Add each PDF to the merger
            for file_path in file_paths:
                logger.info(f"📄 Adding file: {file_path}")
                merger.append(file_path)
            
            # Write the merged PDF
            logger.info(f"💾 Writing merged PDF to: {output_path}")
            merger.write(output_path)
            merger.close()
            
            logger.info("✅ PDF merge complete")
            return output_path
            
        except Exception as e:
            logger.error(f"❌ Error merging PDFs: {str(e)}")
            logger.error(traceback.format_exc())
            raise

   