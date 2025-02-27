import time
import logging
from typing import Dict, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class RateLimitConfig:
    requests_per_minute: int
    tokens_per_minute: int
    min_request_interval: float = 0.1  # seconds between requests

class RateLimiter:
    def __init__(self, config: RateLimitConfig):
        self.config = config
        self.last_request_time = 0
        self.request_count = 0
        self.token_count = 0
        self.last_reset = time.time()
        
    def _reset_if_needed(self):
        """Reset counters if minute has elapsed"""
        current_time = time.time()
        if current_time - self.last_reset >= 60:
            logger.debug("Resetting rate limit counters")
            self.request_count = 0
            self.token_count = 0
            self.last_reset = current_time
    
    def check_limits(self, estimated_tokens: int = 0) -> None:
        """Check and enforce rate limits"""
        current_time = time.time()
        self._reset_if_needed()
        
        # Enforce minimum delay between requests
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.config.min_request_interval:
            sleep_time = self.config.min_request_interval - time_since_last
            logger.debug(f"Rate limiting: Minimum delay sleep for {sleep_time:.2f}s")
            time.sleep(sleep_time)
        
        # Check request limit
        if self.request_count >= self.config.requests_per_minute:
            sleep_time = 60 - (current_time - self.last_reset)
            if sleep_time > 0:
                logger.info(f"Rate limiting: Request limit reached, sleeping for {sleep_time:.2f}s")
                time.sleep(sleep_time)
                self._reset_if_needed()
        
        # Check token limit
        if estimated_tokens > 0 and self.token_count + estimated_tokens > self.config.tokens_per_minute:
            sleep_time = 60 - (current_time - self.last_reset)
            if sleep_time > 0:
                logger.info(f"Rate limiting: Token limit reached, sleeping for {sleep_time:.2f}s")
                time.sleep(sleep_time)
                self._reset_if_needed()
        
        # Update counters
        self.request_count += 1
        self.token_count += estimated_tokens
        self.last_request_time = time.time()

# Pre-configured rate limiters for different LLMs
RATE_LIMITERS = {
    "claude": RateLimiter(RateLimitConfig(
        requests_per_minute=5,
        tokens_per_minute=80000,
        min_request_interval=0.5
    )),
    "google": RateLimiter(RateLimitConfig(
        requests_per_minute=60,
        tokens_per_minute=60000,
        min_request_interval=0.1
    )),
    "openai": RateLimiter(RateLimitConfig(
        requests_per_minute=200,  # GPT-4 limit
        tokens_per_minute=100000,
        min_request_interval=0.05
    ))
} 