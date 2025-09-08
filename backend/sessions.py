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
Session management utilities for the Universal Deep Research Backend (UDR-B).

This module provides functions for generating unique session identifiers
that combine timestamps with random components for tracking research sessions.
"""

import uuid
from datetime import datetime


def generate_session_key() -> str:
    """
    Generates a unique session key combining timestamp and random components.
    Format: {timestamp}-{random_uuid}
    Example: "20240315T123456Z-a1b2c3d4"

    Returns:
        str: A unique session identifier
    """
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%SZ")
    random_component = str(uuid.uuid4())[:8]  # First 8 chars of UUID
    return f"{timestamp}-{random_component}"
