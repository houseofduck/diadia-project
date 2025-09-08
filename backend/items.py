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
Data persistence utilities for the Universal Deep Research Backend (UDR-B).

This module provides functions for storing and loading research artifacts,
events, and other data in JSONL format for easy processing and analysis.
"""

import json
import os
from typing import Any, Dict, List


def store_items(items: List[Dict[str, Any]], filepath: str) -> None:
    """
    Stores a list of items line by line in a file, with proper string escaping.
    Each item is stored as a JSON string on a separate line.

    Args:
        items: List of dictionaries to store
        filepath: Path to the file where items will be stored

    Example:
        store_items([
            {"type": "event1", "message": "Hello \"world\""},
            {"type": "event2", "message": "Line\nbreak"}
        ], "events.jsonl")
    """
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    with open(filepath, "w", encoding="utf-8") as f:
        for item in items:
            # Convert dictionary to JSON string and write with newline
            json_str = json.dumps(item, ensure_ascii=False)
            f.write(json_str + "\n")


def load_items(filepath: str) -> List[Dict[str, Any]]:
    """
    Loads items from a file where each line is a JSON string.

    Args:
        filepath: Path to the file containing the items

    Returns:
        List of items loaded from the file

    Example:
        items = load_items("events.jsonl")
        for item in items:
            print(item["type"], item["message"])
    """
    if not os.path.exists(filepath):
        return []

    items = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():  # Skip empty lines
                item = json.loads(line)
                items.append(item)
    return items


def register_item(filepath: str, item: Dict[str, Any]) -> None:
    """
    Appends a single item to the specified file.
    Creates the file and its directory if they don't exist.

    Args:
        filepath: Path to the file where the item will be appended
        item: Dictionary to append to the file

    Example:
        register_item(
            "events.jsonl",
            {"type": "event3", "message": "New event"}
        )
    """
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Append the item to the file
    with open(filepath, "a", encoding="utf-8") as f:
        json_str = json.dumps(item, ensure_ascii=False)
        f.write(json_str + "\n")


def find_item_by_type(filepath: str, item_type: str) -> Dict[str, Any]:
    """
    Finds an item by its type in the specified file.

    Args:
        filepath: Path to the file containing the items
        item_type: Type of the item to find

    Returns:
        Item found in the file
    """
    items = load_items(filepath)
    return next((item for item in items if item["type"] == item_type), None)
