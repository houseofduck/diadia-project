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
import re

from frame.clients import Client


def namify_model_path(hf_model_path: str) -> str:
    return hf_model_path.replace("/", "_").replace("-", "_").replace(" ", "_")


class Errand:
    def __init__(self, pre_prompt: str, prompt: str) -> None:
        self.pre_prompt = pre_prompt
        self.prompt = prompt

    def run(self, runner: Client, args: dict, completion_config: dict = {}) -> str:
        prompt_with_args = self.prompt
        for arg_name, arg_value in args.items():
            prompt_with_args = prompt_with_args.replace("{" + arg_name + "}", arg_value)

        ret = runner.run(self.pre_prompt, prompt_with_args, completion_config)
        return ret


class FileErrand(
    Errand
):  # NOTE: this is only for easier debug for now; production code should use errands directly
    def __init__(self, errand_path: str) -> None:
        with open(errand_path, "r") as f:
            errand = f.read()

        errand_parts = errand.split("===SEPARATOR===")
        if len(errand_parts) != 2:
            raise ValueError(
                f"Errand file {errand_path} is not valid. It should contain exactly one separator."
            )
        pre_prompt = errand_parts[0].strip()
        prompt = errand_parts[1].strip()
        super().__init__(pre_prompt, prompt)


class MultipleChoiceErrand(FileErrand):
    def __init__(self, errand_path: str, choices: list[str]) -> None:
        super().__init__(errand_path)
        self.choices = choices

    def run(
        self, runner: Client, args: dict, completion_config: dict = {}
    ) -> str | None:
        raw_completion = super().run(runner, args, completion_config)

        for choice in self.choices:
            if choice in raw_completion:
                return choice

        return None


import os
from pathlib import Path


class MessageTypeErrand(MultipleChoiceErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_type.txt"
        )
        choices = [
            "code_skill",
            "routine_skill",
            "query_skill",
            "code",
            "routine",
            "query",
            "data",
        ]
        super().__init__(errand_path, choices)


class MessageCodeProcessingErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_code_processing.txt"
        )
        super().__init__(errand_path)


class MessageCodeSkillProcessingErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_code_skill_processing.txt"
        )
        super().__init__(errand_path)


class MessageCodeCallErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_code_call.txt"
        )
        super().__init__(errand_path)


class MessageCodeVariablesErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_code_variables.txt"
        )
        super().__init__(errand_path)


class MessageRoutineProcessingErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_routine_processing.txt"
        )
        super().__init__(errand_path)


class MessageGeneratingRoutineProcessingErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent,
            "errands/message_generating_routine_processing.txt",
        )
        super().__init__(errand_path)


class MessageRoutineCallErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_routine_call.txt"
        )
        super().__init__(errand_path)


class MessageGeneratingRoutineCallErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent,
            "errands/message_generating_routine_call.txt",
        )
        super().__init__(errand_path)


class MessageRoutineVariablesErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_routine_variables.txt"
        )
        super().__init__(errand_path)


class MessageDataProcessingErrand(FileErrand):
    def __init__(self) -> None:
        errand_path = os.path.join(
            Path(__file__).resolve().parent, "errands/message_data_processing.txt"
        )
        super().__init__(errand_path)


default_errand_profile: dict[str, type[Errand] | None] = {
    "message_type": MessageTypeErrand,
    "message_code_processing": MessageCodeProcessingErrand,
    "message_code_skill_processing": MessageCodeSkillProcessingErrand,
    "message_code_call": MessageCodeCallErrand,
    "message_code_variables": MessageCodeVariablesErrand,
    "message_routine_processing": MessageRoutineProcessingErrand,
    "message_generating_routine_processing": MessageGeneratingRoutineProcessingErrand,
    "message_routine_call": MessageRoutineCallErrand,
    "message_generating_routine_call": MessageGeneratingRoutineCallErrand,
    "message_routine_variables": MessageRoutineVariablesErrand,
    "message_data_processing": MessageDataProcessingErrand,
    "language_model": None,  # on purpose, currently there is no errand but there might be a client profile # TODO: double-check if this is still needed in V4
}
