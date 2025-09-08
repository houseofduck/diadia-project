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
import importlib.util
import json
import sys
import types

import docstring_parser


def import_from_path(module_name, file_path):
    """Import a module given its name and file path."""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class Routine:
    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, str],
        fn: callable,
        returns: dict[str, str] | None = None,
        module: str | None = None,
        source_file: str | None = None,
    ) -> None:
        self.name: str = name
        self.description: str = description
        self.parameters: dict[str, dict[str, str]] = parameters
        self.returns: dict[str, str] | None = returns
        self.fn = fn

        self.module: str | None = module
        self.source_file: str | None = source_file

    def __str__(self) -> str:
        ret = "Name: " + self.name + "\n"
        ret += "Description: " + self.description + "\n"
        ret += "Parameters:\n"
        for key, props in self.parameters.items():
            ret += f"  {key}:\n"
            for prop, value in props.items():
                ret += f"    {prop}: {value}\n"
        return ret

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {"type": "object", "properties": self.parameters},
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=4)


class RoutineRegistry:
    def __init__(self, routines: list[Routine] | None = None) -> None:
        self.routines: list[Routine] = routines if routines is not None else []

    def add_routine(self, routine: Routine) -> None:
        self.routines.append(routine)

    def remove_routine(self, routine: Routine) -> None:
        self.routines.remove(routine)

    def get_routine_of_name(self, name: str) -> Routine:
        return next(
            (
                routine
                for routine in self.routines
                if routine.name.lower() == name.lower()
            ),
            None,
        )

    def to_list(self) -> list[dict]:
        return [routine.to_dict() for routine in self.routines]

    def to_json(self) -> str:
        return json.dumps(self.to_list(), indent=4)

    def load_from_file(self, module_name: str, file_path: str) -> None:
        module = import_from_path(module_name, file_path)
        for name, obj in module.__dict__.items():
            if type(obj) == types.FunctionType:
                doc = docstring_parser.parse(obj.__doc__)
                parameters = {
                    param.arg_name: {
                        "type": param.type_name,
                        "description": param.description,
                    }
                    for param in doc.params
                }
                returns = {
                    "type": doc.returns.type_name,
                    "description": doc.returns.description,
                }
                self.add_routine(
                    Routine(
                        name,
                        doc.short_description
                        + "\n"
                        + (
                            doc.long_description
                            if doc.long_description is not None
                            else ""
                        ),
                        parameters,
                        obj,
                        returns,
                        module_name,
                        file_path,
                    )
                )
