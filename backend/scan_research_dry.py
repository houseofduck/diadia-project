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
import asyncio
import json
import random
from datetime import datetime
from glob import glob
from typing import Any, AsyncGenerator, Dict, List


async def do_research(
    session_key: str,
    query: str,
    mock_directory: str = "mock_instances/stocks_24th_3_sections",
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Generator that reads and replays events from mock_instances with random delays.
    Does not save any artifacts or events.

    Args:
        query: The research query to process (ignored in dry mode)
        session_key: Unique identifier for this research session (ignored in dry mode)
        mock_directory: Directory containing mock instance files to replay

    Yields:
        Dict containing event data from the mock instance
    """
    # Find the mock instance files
    mock_files = glob(f"{mock_directory}/*.events.jsonl")
    if not mock_files:
        yield {
            "type": "error",
            "description": "No mock instance files found in mock_instances directory",
        }
        return

    # Use the first mock file found
    mock_file = mock_files[0]

    # Read all events from the mock file
    with open(mock_file, "r") as f:
        events = [json.loads(line) for line in f if line.strip()]

    # Filter for non-reporting events
    research_events = [
        event
        for event in events
        if not event.get("type", "").startswith("report_")
        and event.get("type", "") != "completed"
    ]

    # Replay each event with a random delay
    for event in research_events:
        # Update timestamp to current time
        event["timestamp"] = datetime.now().isoformat()
        # Yield the event
        yield event
        # Wait for a random time between 0.5 and 2 seconds
        await asyncio.sleep(random.uniform(0.5, 2.0))


async def do_reporting(
    session_key: str, mock_directory: str = "mock_instances/stocks_24th_3_sections"
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Generator that reads and replays reporting events from mock_instances with random delays.
    Does not save any artifacts or events.

    Args:
        session_key: Unique identifier for this research session (ignored in dry mode)
        mock_directory: Directory containing mock instance files to replay

    Yields:
        Dict containing event data from the mock instance
    """
    # Find the mock instance files
    mock_files = glob(f"{mock_directory}/*.events.jsonl")
    if not mock_files:
        yield {
            "type": "error",
            "description": "No mock instance files found in mock_instances directory",
        }
        return

    # Use the first mock file found
    mock_file = mock_files[0]

    # Read all events from the mock file
    with open(mock_file, "r") as f:
        events = [json.loads(line) for line in f if line.strip()]

    # Filter for reporting events
    reporting_events = [
        event for event in events if event.get("type", "").startswith("report_")
    ]

    # Replay each event with a random delay
    for event in reporting_events:
        # Update timestamp to current time
        event["timestamp"] = datetime.now().isoformat()
        # Yield the event
        yield event
        # Wait for a random time between 0.5 and 2 seconds
        await asyncio.sleep(random.uniform(0.5, 2.0))
