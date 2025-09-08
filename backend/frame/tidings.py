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
from typing import Any


class Tiding:
    def __init__(
        self, natural_name: str, python_name: str, description: str, content: Any
    ) -> None:
        self.natural_name = natural_name
        self.python_name = python_name
        self.description = description
        self.content = content

    def __str__(self) -> str:
        return f"Natural name: {self.natural_name}\nPython name: {self.python_name}\nDescription: {self.description}\nContent: {self.content}"

    def to_dict(self) -> dict:
        return {
            "natural_name": self.natural_name,
            "python_name": self.python_name,
            "description": self.description,
            "content": self.content,
            "type": type(self.content).__name__,
        }

    def from_dict(self, tiding: dict) -> None:
        self.natural_name = tiding["natural_name"]
        self.python_name = tiding["python_name"]
        self.description = tiding["description"]
        self.content = tiding["content"]
