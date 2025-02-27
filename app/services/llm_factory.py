import logging
import base64
from typing import Any, List, Dict
from app.config import Config, LLMProvider, ModelType
import json
from anthropic import Anthropic
import google.generativeai as genai
from openai import OpenAI
import PyPDF2
from app.services.rate_limiter import RATE_LIMITERS

logger = logging.getLogger(__name__)

class LLMWrapper:
    """Base wrapper class for LLMs with conversation memory"""
    def __init__(self, model_type: ModelType = None):
        self.messages = []
        self.tools = []
        self.model_type = model_type or Config.DEFAULT_MODEL_TYPE
        logger.info(f"Initializing {self.__class__.__name__} with model type: {self.model_type.value}")

    def add_pdf(self, file_path: str) -> None:
        """Add PDF content to conversation history"""
        raise NotImplementedError

    def add_json(self, data: dict) -> None:
        """Add JSON content to conversation history"""
        raise NotImplementedError

    def set_tools(self, tools: List[Any]):
        """Configure tools for the LLM"""
        logger.info(f"🔧 Setting tools: {[t.name for t in tools]}")
        self._bind_tools(tools)
        return self

    def _bind_tools(self, tools: List[Any]):
        """Base implementation for binding tools"""
        logger.info(f"🔧 Binding tools: {[t.name for t in tools]}")
        self.tools = tools

    def get_response(self, prompt: str) -> str:
        """Get response for a prompt, maintaining conversation history"""
        raise NotImplementedError

class AnthropicWrapper(LLMWrapper):
    def __init__(self, model_type: ModelType = None):
        super().__init__(model_type)
        self.model = Anthropic(api_key=Config.ANTHROPIC_API_KEY)
        self.model_config = Config.get_model_config(LLMProvider.ANTHROPIC, model_type)
        logger.info(f"🤖 Initialized Anthropic wrapper with {self.model_config['name']}")

    def add_pdf(self, file_path: str) -> None:
        try:
            with open(file_path, 'rb') as file:
                pdf_data = base64.b64encode(file.read()).decode('utf-8')
                self.messages.append({
                    "role": "user",
                    "content": [{
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_data
                        }
                    }]
                })
            logger.info("📄 Added PDF to conversation")
        except Exception as e:
            logger.error(f"Error adding PDF: {str(e)}")
            raise

    def add_json(self, data: dict) -> None:
        try:
            self.messages.append({
                "role": "user",
                "content": [{
                    "type": "text",
                    "text": f"JSON content:\n{json.dumps(data, indent=2)}"
                }]
            })
            logger.info("📄 Added JSON to conversation")
        except Exception as e:
            logger.error(f"Error adding JSON: {str(e)}")
            raise

    def get_response(self, prompt: str) -> str:
        try:
            if not prompt:
                return ""
            
            self.messages.append({
                "role": "user",
                "content": [{"type": "text", "text": prompt}]
            })
            
            result = self.model.messages.create(
                model=self.model_config['name'],
                messages=self.messages,
                max_tokens=self.model_config['max_tokens'],
                temperature=Config.TEMPERATURE
            )
            
            response_text = result.content[0].text
            self.messages.append({
                "role": "assistant",
                "content": response_text
            })
            
            return response_text
            
        except Exception as e:
            logger.error(f"❌ Error from Anthropic: {str(e)}")
            raise

class GoogleWrapper(LLMWrapper):
    def __init__(self, model_type: ModelType = None):
        super().__init__(model_type)
        genai.configure(api_key=Config.GOOGLE_API_KEY)
        self.model_config = Config.get_model_config(LLMProvider.GOOGLE, model_type)
        self.model = genai.GenerativeModel(self.model_config['name'])
        self.chat = self.model.start_chat()
        self.rate_limiter = RATE_LIMITERS["google"]
        logger.info(f"🤖 Initialized Google wrapper with {self.model_config['name']}")

    def add_pdf(self, file_path: str) -> None:
        try:
            content = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    content += page.extract_text() + "\n\n"
            
            self.chat.send_message(f"PDF content:\n{content}")
            logger.info("📄 Added PDF to conversation")
        except Exception as e:
            logger.error(f"Error adding PDF: {str(e)}")
            raise

    def add_json(self, data: dict) -> None:
        try:
            self.chat.send_message(
                f"JSON content:\n{json.dumps(data, indent=2)}"
            )
            logger.info("📄 Added JSON to conversation")
        except Exception as e:
            logger.error(f"Error adding JSON: {str(e)}")
            raise

    def get_response(self, prompt: str) -> str:
        try:
            if not prompt:
                return ""
            
            response = self.chat.send_message(prompt)
            response_text = response.text
            
            if response_text.count('{') != response_text.count('}'):
                logger.warning("⚠️ Incomplete JSON detected, requesting completion")
                completion = self.chat.send_message(
                    "Please complete the JSON response. Return ONLY the complete JSON."
                )
                response_text = completion.text
            
            return response_text
            
        except Exception as e:
            logger.error(f"❌ Error from Google: {str(e)}")
            raise

class OpenAIWrapper(LLMWrapper):
    def __init__(self, model_type: ModelType = None):
        super().__init__(model_type)
        self.client = OpenAI(api_key=Config.OPENAI_API_KEY)
        self.model_config = Config.get_model_config(LLMProvider.OPENAI, model_type)
        self.rate_limiter = RATE_LIMITERS["openai"]
        logger.info(f"🤖 Initialized OpenAI wrapper with {self.model_config['name']}")

    def add_pdf(self, file_path: str) -> None:
        try:
            content = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    content += page.extract_text() + "\n\n"
            
            self.messages.append({
                "role": "user",
                "content": f"PDF content:\n{content}"
            })
            logger.info("📄 Added PDF to conversation")
        except Exception as e:
            logger.error(f"Error adding PDF: {str(e)}")
            raise

    def add_json(self, data: dict) -> None:
        try:
            self.messages.append({
                "role": "user",
                "content": f"JSON content:\n{json.dumps(data, indent=2)}"
            })
            logger.info("📄 Added JSON to conversation")
        except Exception as e:
            logger.error(f"Error adding JSON: {str(e)}")
            raise

    def get_response(self, prompt: str) -> str:
        try:
            if not prompt:
                return ""
            
            self.messages.append({
                "role": "user",
                "content": prompt
            })
            
            response = self.client.chat.completions.create(
                model=self.model_config['name'],
                messages=self.messages,
                max_completion_tokens=self.model_config['max_tokens'],
            )
            
            response_text = response.choices[0].message.content
            self.messages.append({
                "role": "assistant",
                "content": response_text
            })
            
            return response_text
            
        except Exception as e:
            logger.error(f"❌ Error from OpenAI: {str(e)}")
            raise

class LLMFactory:
    @staticmethod
    def create_llm(
        provider: LLMProvider = None,
        model_type: ModelType = None
    ) -> LLMWrapper:
        """
        Factory method that produces wrapped LLM instances
        If model_type not specified, uses DEFAULT_MODEL_TYPE (ANALYSIS) from Config
        """
        provider = provider or Config.DEFAULT_PROVIDER
        model_type = model_type or Config.DEFAULT_MODEL_TYPE
        
        logger.info(f"🏭 Creating new LLM instance for provider: {provider} with model type: {model_type.value}")
        
        if provider == LLMProvider.ANTHROPIC:
            return AnthropicWrapper(model_type)
        elif provider == LLMProvider.GOOGLE:
            return GoogleWrapper(model_type)
        elif provider == LLMProvider.OPENAI:
            return OpenAIWrapper(model_type)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")