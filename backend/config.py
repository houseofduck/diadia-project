# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
Configuration module for the Universal Deep Research Backend (UDR-B).

This module centralizes all configurable settings and provides
environment variable support for easy deployment customization.
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


@dataclass
class ServerConfig:
    """Server configuration settings."""

    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "info"))
    reload: bool = field(
        default_factory=lambda: os.getenv("RELOAD", "true").lower() == "true"
    )


@dataclass
class CORSConfig:
    """CORS configuration settings."""

    frontend_url: str = field(
        default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:3000")
    )
    allow_credentials: bool = field(
        default_factory=lambda: os.getenv("ALLOW_CREDENTIALS", "true").lower() == "true"
    )
    allow_methods: list = field(default_factory=lambda: ["*"])
    allow_headers: list = field(default_factory=lambda: ["*"])


@dataclass
class ModelConfig:
    """Model configuration settings."""

    default_model: str = field(
        default_factory=lambda: os.getenv("DEFAULT_MODEL", "llama-3.1-nemotron-253b")
    )
    base_url: str = field(
        default_factory=lambda: os.getenv(
            "LLM_BASE_URL", "https://integrate.api.nvidia.com/v1"
        )
    )
    api_key_file: str = field(
        default_factory=lambda: os.getenv("LLM_API_KEY_FILE", "nvdev_api.txt")
    )
    temperature: float = field(
        default_factory=lambda: float(os.getenv("LLM_TEMPERATURE", "0.2"))
    )
    top_p: float = field(default_factory=lambda: float(os.getenv("LLM_TOP_P", "0.7")))
    max_tokens: int = field(
        default_factory=lambda: int(os.getenv("LLM_MAX_TOKENS", "2048"))
    )


@dataclass
class SearchConfig:
    """Search configuration settings."""

    tavily_api_key_file: str = field(
        default_factory=lambda: os.getenv("TAVILY_API_KEY_FILE", "tavily_api.txt")
    )
    max_search_results: int = field(
        default_factory=lambda: int(os.getenv("MAX_SEARCH_RESULTS", "10"))
    )


@dataclass
class ResearchConfig:
    """Research configuration settings."""

    max_topics: int = field(default_factory=lambda: int(os.getenv("MAX_TOPICS", "1")))
    max_search_phrases: int = field(
        default_factory=lambda: int(os.getenv("MAX_SEARCH_PHRASES", "1"))
    )
    mock_directory: str = field(
        default_factory=lambda: os.getenv(
            "MOCK_DIRECTORY", "mock_instances/stocks_24th_3_sections"
        )
    )
    random_seed: int = field(
        default_factory=lambda: int(os.getenv("RANDOM_SEED", "42"))
    )


@dataclass
class LoggingConfig:
    """Logging configuration settings."""

    log_dir: str = field(default_factory=lambda: os.getenv("LOG_DIR", "logs"))
    trace_enabled: bool = field(
        default_factory=lambda: os.getenv("TRACE_ENABLED", "true").lower() == "true"
    )
    copy_into_stdout: bool = field(
        default_factory=lambda: os.getenv("COPY_INTO_STDOUT", "false").lower() == "true"
    )


@dataclass
class FrameConfig:
    """FrameV4 configuration settings."""

    long_context_cutoff: int = field(
        default_factory=lambda: int(os.getenv("LONG_CONTEXT_CUTOFF", "8192"))
    )
    force_long_context: bool = field(
        default_factory=lambda: os.getenv("FORCE_LONG_CONTEXT", "false").lower()
        == "true"
    )
    max_iterations: int = field(
        default_factory=lambda: int(os.getenv("MAX_ITERATIONS", "1024"))
    )
    interaction_level: str = field(
        default_factory=lambda: os.getenv("INTERACTION_LEVEL", "none")
    )


@dataclass
class AppConfig:
    """Main application configuration."""

    server: ServerConfig = field(default_factory=ServerConfig)
    cors: CORSConfig = field(default_factory=CORSConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    search: SearchConfig = field(default_factory=SearchConfig)
    research: ResearchConfig = field(default_factory=ResearchConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    frame: FrameConfig = field(default_factory=FrameConfig)

    def __post_init__(self):
        """Ensure log directory exists."""
        os.makedirs(self.logging.log_dir, exist_ok=True)

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            "server": {
                "host": self.server.host,
                "port": self.server.port,
                "log_level": self.server.log_level,
                "reload": self.server.reload,
            },
            "cors": {
                "frontend_url": self.cors.frontend_url,
                "allow_credentials": self.cors.allow_credentials,
                "allow_methods": self.cors.allow_methods,
                "allow_headers": self.cors.allow_headers,
            },
            "model": {
                "default_model": self.model.default_model,
                "base_url": self.model.base_url,
                "api_key_file": self.model.api_key_file,
                "temperature": self.model.temperature,
                "top_p": self.model.top_p,
                "max_tokens": self.model.max_tokens,
            },
            "search": {
                "tavily_api_key_file": self.search.tavily_api_key_file,
                "max_search_results": self.search.max_search_results,
            },
            "research": {
                "max_topics": self.research.max_topics,
                "max_search_phrases": self.research.max_search_phrases,
                "mock_directory": self.research.mock_directory,
                "random_seed": self.research.random_seed,
            },
            "logging": {
                "log_dir": self.logging.log_dir,
                "trace_enabled": self.logging.trace_enabled,
                "copy_into_stdout": self.logging.copy_into_stdout,
            },
            "frame": {
                "long_context_cutoff": self.frame.long_context_cutoff,
                "force_long_context": self.frame.force_long_context,
                "max_iterations": self.frame.max_iterations,
                "interaction_level": self.frame.interaction_level,
            },
        }


# Global configuration instance
config = AppConfig()


def get_config() -> AppConfig:
    """Get the global configuration instance."""
    return config


def update_config(**kwargs) -> None:
    """Update configuration with new values."""
    for key, value in kwargs.items():
        if hasattr(config, key):
            setattr(config, key, value)
        else:
            raise ValueError(f"Unknown configuration key: {key}")


def get_model_configs() -> Dict[str, Dict[str, Any]]:
    """Get the model configurations from clients.py with configurable values."""
    from clients import MODEL_CONFIGS

    # Update model configs with environment variables
    updated_configs = {}
    for model_name, model_config in MODEL_CONFIGS.items():
        updated_config = model_config.copy()

        # Override with environment variables if available
        env_prefix = f"{model_name.upper().replace('-', '_')}_"

        if os.getenv(f"{env_prefix}BASE_URL"):
            updated_config["base_url"] = os.getenv(f"{env_prefix}BASE_URL")

        if os.getenv(f"{env_prefix}MODEL"):
            updated_config["completion_config"]["model"] = os.getenv(
                f"{env_prefix}MODEL"
            )

        if os.getenv(f"{env_prefix}TEMPERATURE"):
            updated_config["completion_config"]["temperature"] = float(
                os.getenv(f"{env_prefix}TEMPERATURE")
            )

        if os.getenv(f"{env_prefix}TOP_P"):
            updated_config["completion_config"]["top_p"] = float(
                os.getenv(f"{env_prefix}TOP_P")
            )

        if os.getenv(f"{env_prefix}MAX_TOKENS"):
            updated_config["completion_config"]["max_tokens"] = int(
                os.getenv(f"{env_prefix}MAX_TOKENS")
            )

        updated_configs[model_name] = updated_config

    return updated_configs
