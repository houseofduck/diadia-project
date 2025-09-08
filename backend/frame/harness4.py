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
import ast
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generator

from frame.clients import *
from frame.errands4 import Errand, default_errand_profile
from frame.routines import *
from frame.tidings import *


@dataclass
class FrameConfigV4:
    long_context_cutoff: int = 8192
    force_long_context: bool = False
    max_iterations: int = 1024
    interaction_level: str = "none"  # one of "none", "system", "lm"

    def update(self, **kwargs) -> None:
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)

    def to_dict(self) -> dict:
        return {
            "long_context_cutoff": self.long_context_cutoff,
            "force_long_context": self.force_long_context,
            "max_iterations": self.max_iterations,
        }

    def from_dict(self, config: dict) -> None:
        self.update(**config)


class SkillV4:
    name: str
    source_message: str

    python_name: str
    docstring: str
    code: str

    def __init__(
        self,
        name: str,
        source_message: str,
        python_name: str,
        docstring: str,
        code: str,
    ) -> None:
        self.name = name
        self.python_name = python_name
        self.docstring = docstring
        self.code = code
        self.source_message = source_message

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "python_name": self.python_name,
            "docstring": self.docstring,
            "code": self.code,
            "source_message": self.source_message,
        }

    def from_dict(self, skill: dict) -> None:
        self.name = skill["name"]
        self.python_name = skill["python_name"]
        self.docstring = skill["docstring"]
        self.code = skill["code"]
        self.source_message = skill["source_message"]

    def __str__(self) -> str:
        return f"Skill: {self.name}\nPython name: {self.python_name}\nDocstring: {self.docstring}\nCode: {self.code}\nSource message: {self.source_message}"


class FrameV4:
    # general
    instance_id: str
    config: FrameConfigV4
    client_profile: dict[str, Client]
    errand_profile: dict[str, type[Errand]]
    compilation_trace: Trace
    execution_trace: Trace
    max_iterations: int = 1024

    # skills
    skills: dict[str, SkillV4]

    # context
    tidings: dict[str, Tiding]
    globals: dict[str, Any]
    last_mid: int

    def __init__(
        self,
        client_profile: dict[str, Client] | Client,
        instance_id: str | None = None,
        config: FrameConfigV4 | None = None,
        errand_profile: dict[str, type[Errand]] | None = None,
        compilation_trace: bool | str | Trace | None = None,
        execution_trace: bool | str | Trace | None = None,
    ) -> None:
        self.instance_id = (
            datetime.now().strftime("%Y%m%d_%H-%M-%S")
            if instance_id is None
            else instance_id
        )
        self.config = FrameConfigV4() if config is None else config

        self.errand_profile = (
            {**default_errand_profile, **errand_profile}
            if errand_profile is not None
            else {**default_errand_profile}
        )
        if isinstance(client_profile, Client):
            self.client_profile = {
                k: client_profile for k, _ in self.errand_profile.items()
            }
        elif isinstance(client_profile, dict):
            self.client_profile = client_profile
        else:
            raise ValueError(f"Invalid client profile type: {type(client_profile)}")

        self.compilation_trace = self.make_trace_from_arg(
            path=f"./logs/{self.instance_id}_compilation.log",
            trace_arg=compilation_trace,
        )
        self.execution_trace = self.make_trace_from_arg(
            path=f"./logs/{self.instance_id}_execution.log", trace_arg=execution_trace
        )

        self.new_instance()

    def get_chat_context_dict(self) -> dict:
        """
        Returns the chat context as a dictionary
        """

        filtered_system_globals = {
            k: v
            for k, v in self.globals.items()
            if not k.startswith("__")
            and not callable(v)
            and type(v) in [float, int, str, bool, list, set, dict, tuple]
        }
        return {
            "mid": self.last_mid,
            "tidings": {k: v.to_dict() for k, v in self.tidings.items()},
            "system_globals": filtered_system_globals,
        }

    def new_instance(self) -> None:
        self.skills = {}
        self.tidings = {}
        self.globals = {"__messages": []}
        self.last_mid = -1

        exec("import math", {}, self.globals)
        exec("from typing import *", {}, self.globals)
        exec("from tavily import TavilyClient", {}, self.globals)
        client = self.find_client_in_profile("language_model")

        def language_model(prompt: str, pre_prompt: str = None) -> str:
            """
            A simple language model calling function that returns the prompt as a response.

            Use the following guidelines to create effective prompts when calling the function `language_model`:
            - Start with using pre_prompt to assign a role to the language model (e.g. "You are an expert report writer." or "You are a Python code generator.")
            - Begin the prompt by asking the language model to perform a specific task (e.g. "Write a report on the current state of AI research based on the following CONTEXT." or "Generate a Python function that behaviour described in ASSIGNMENT.")
            - Mention the parameters of the prompt in the prompt, i.e. if the prompt operates on a text, mention the name of the parameter (e.g. "CONTEXT" or "ASSIGNMENT") and the type of the parameter (e.g. "text", "list", "dictionary", etc.).
            - Specify the expected output format (e.g. "Write a report in Markdown format. Do not output any other text." or "Generate a Python function that returns a list of numbers and enclose it in ``` and ```. Any text outside the code block will be ignored.")
            - Provide the context or assignment in a clear and concise manner (.e.g "\n\nCONTEXT:\n <context>" or "\n\nASSIGNMENT:\n<assignment>"); use newlines to separate the parameters from the rest of the prompt.
            - If you think the prompt might get long once the parameters are pasted into it, add a list of reminders, e.g. "Reminders:\n- Do not output any other text.\n- Output a report in Markdown format based on the CONTEXT given..."

            Args:
                prompt (str): The prompt to be sent to the language model.
                pre_prompt (str, optional): An optional pre-prompt (also known as system prompt, can be used to assign an overarching role to the LM) to be sent before the main prompt.

            Returns:
                str: The response from the language model.
            """
            return client.run(pre_prompt, prompt)

        if "language_model" not in self.skills:
            self.skills["language_model"] = SkillV4(
                name="language_model",
                source_message="",
                python_name="language_model",
                docstring=language_model.__doc__,
                code=language_model.__code__,
            )
        self.globals["language_model"] = language_model

        self.execution_trace.write_separator()
        self.execution_trace(
            f"Creating new instance with id {self.instance_id} at {datetime.now()}"
        )
        self.execution_trace(
            f"New instance created; skills, tidings, and globals erased"
        )
        self.execution_trace.write_separator()

    # HIGH-LEVEL OUTPUT GENERATION CODE
    def generate(
        self, messages: list[dict], frame_config: FrameConfigV4 | None = None
    ) -> str:
        """
        Generates a response to the given messages.
        """
        if frame_config is None:
            frame_config = self.config

        last_msg = messages[-1]
        ret = self.process_message(
            mid=last_msg["mid"],
            message=last_msg["content"],
            message_type=last_msg["type"],
        )
        return ret

        # HIGH-LEVEL OUTPUT GENERATION CODE

    def generate_with_notifications(
        self, messages: list[dict], frame_config: FrameConfigV4 | None = None
    ) -> Generator[dict, None, None]:
        """
        Generates a response to the given messages.
        """
        if frame_config is None:
            frame_config = self.config

        last_msg = messages[-1]
        for notification in self.process_message(
            mid=last_msg["mid"],
            message=last_msg["content"],
            message_type=last_msg["type"],
            generate_not_return=True,
        ):
            yield notification

    # MESSAGE HANDLING
    def process_message(
        self,
        mid: int,
        message: str,
        message_type: str | None,
        generate_not_return: bool = False,
    ) -> Any | Generator[dict, None, None]:
        """
        message_type is one of "routine", "routine_skill", "query", "query_skill", "code", "code_skill", "data", "auto" (also representable as None)
        """
        if message.strip() == "":
            raise ValueError("Empty message provided for instruction processing")
        if message_type is None:
            message_type = "auto"
        self.allowed_message_types = [
            "routine",
            "routine_skill",
            "query",
            "query_skill",
            "code",
            "code_skill",
            "data",
            "auto",
            "generating_routine",
        ]
        if message_type not in self.allowed_message_types:
            allowed_message_types_str: str = "', '".join(self.allowed_message_types)
            raise ValueError(
                f"Invalid message type: '{message_type}'; must be one of '{allowed_message_types_str}'"
            )

        if message_type == "auto":
            message_type = self.decide_message_type(message)

        skills: list[SkillV4] | None = None
        invocation_code: str | None = None
        variable_descriptions: dict[str, str] | None = None

        if message_type == "code":
            skills, invocation_code, variable_descriptions = self.process_message_code(
                mid, message, self.tidings
            )
        elif message_type == "code_skill":
            skills = self.process_message_code_skill(
                mid, message
            )  # no tidings, skills are supposed to be pure functions
        elif message_type == "routine":
            skills, invocation_code, variable_descriptions = (
                self.process_message_routine(mid, message, self.tidings)
            )
        elif message_type == "generating_routine":
            if not generate_not_return:
                raise ValueError(
                    "Generating routine messages must be processed with generate_not_return=True"
                )
            skills, invocation_code, variable_descriptions = (
                self.process_message_routine(
                    mid, message, self.tidings, is_generating_routine=True
                )
            )
        elif message_type == "data":
            invocation_code = self.process_message_data(mid, message)
            skills = []
        else:
            raise NotImplementedError(
                f"Message type '{message_type}' not implemented yet"
            )

        self.log_compilation_result(mid, skills, invocation_code, variable_descriptions)

        skill_capture_context = {}
        for skill in skills:
            exec(f"{skill.code}", self.globals, skill_capture_context)
            self.skills[skill.name] = skill
        for context_var, context_value in skill_capture_context.items():
            if not context_var in self.globals:
                self.globals[context_var] = context_value

        execution_context = {
            tiding.python_name: tiding.content for tiding in self.tidings.values()
        }
        __output = None
        if invocation_code is not None:
            if message_type != "generating_routine":
                exec(invocation_code, self.globals, execution_context)
                if "__output" in execution_context:
                    __output = execution_context["__output"]
                if "__vars" in execution_context:
                    __vars = execution_context["__vars"]
                    for var_name, var_value in __vars.items():
                        self.tidings[var_name] = Tiding(
                            natural_name=var_name,
                            python_name=var_name,
                            content=var_value,
                            description=(
                                variable_descriptions[var_name]
                                if variable_descriptions is not None
                                and var_name in variable_descriptions
                                else ""
                            ),
                        )
            else:
                exec(invocation_code, self.globals, execution_context)
                __generator = execution_context["__generator"]
                __final: dict[str, Any] = {}
                for notification in __generator:
                    if notification["type"] == "final":
                        __final = notification
                    else:
                        yield notification
                if "modified_vars" in __final:
                    for var_name, var_value in __final["modified_vars"].items():
                        self.tidings[var_name] = Tiding(
                            natural_name=var_name,
                            python_name=var_name,
                            content=var_value,
                            description=(
                                variable_descriptions[var_name]
                                if variable_descriptions is not None
                                and var_name in variable_descriptions
                                else ""
                            ),
                        )

        self.last_mid = mid

        if not generate_not_return:
            return __output

    def decide_message_type(self, message: str) -> str:
        """
        Decides the message type based on the content of the message.

        Returns one of "routine", "routine_skill", "query", "query_skill", "code", "code_skill", "data"
        """
        message_type_errand: Errand = self.find_errand_in_profile("message_type")()
        message_type_client = self.find_client_in_profile("message_type")

        message_type: str | None = message_type_errand.run(
            runner=message_type_client,
            args={"message": message},
        )

        if message_type is None or message_type not in self.allowed_message_types:
            raise ValueError(
                f"Message type could not be determined for message: '{message}'"
            )

        return message_type

    # MESSAGE PROCESSING
    def process_message_code(
        self, mid: int, message: str, tidings: dict[str, Tiding]
    ) -> tuple[list[SkillV4], str | None, dict[str, str] | None]:
        """
        Processes a code message and returns the corresponding skill(s), invocation code, and variable descriptions.
        """
        code_processing_errand: Errand = self.find_errand_in_profile(
            "message_code_processing"
        )()
        code_processing_client = self.find_client_in_profile("message_code_processing")

        # serialize tidings for prompt injection
        serialized_tidings = "\n".join(
            [f"{k}: {v.content}  # {v.description}" for k, v in tidings.items()]
        )
        code: str = code_processing_errand.run(
            runner=code_processing_client,
            args={"message": message, "tidings": serialized_tidings},
        )
        code = self.sanitize_code(code)

        # replace the first occurence of code with f"message_{mid}_code"
        code = code.replace("code", f"message_{mid}_code", 1)
        docstring_addendum = f"\n\nThis function was generated to fulfill the intent of the user message with message id {mid}."

        func_defs = self.extract_function_definitions(code)
        skills = []
        variable_descriptions: dict[str, str] | None = None
        if func_defs:
            func = func_defs[0]
            func_code = func["code"].replace(
                func["docstring"], func["docstring"] + docstring_addendum, 1
            )
            skills.append(
                SkillV4(
                    name=func["python_name"],
                    source_message=message,
                    python_name=func["python_name"],
                    docstring=func["docstring"] + docstring_addendum,
                    code=func_code,
                )
            )

            # TODO: perhaps, in the future, let the user know that other functions are present but ignored

            message_code_call_errand: Errand = self.find_errand_in_profile(
                "message_code_call"
            )()
            message_code_call_client = self.find_client_in_profile("message_code_call")
            invocation_code = message_code_call_errand.run(
                runner=message_code_call_client,
                args={
                    "message": message,
                    "code": skills[0].code,
                    "tidings": serialized_tidings,
                },
            )

            # Use MessageCodeVariablesErrand to get variable descriptions
            message_code_variables_errand: Errand = self.find_errand_in_profile(
                "message_code_variables"
            )()
            message_code_variables_client = self.find_client_in_profile(
                "message_code_variables"
            )
            variable_descriptions_raw = message_code_variables_errand.run(
                runner=message_code_variables_client,
                args={
                    "message": message,
                    "code": skills[0].code,
                    "tidings": serialized_tidings,
                },
            )
            # Parse the output into a dict
            variable_descriptions = {}
            for line in variable_descriptions_raw.strip().splitlines():
                if "#" in line:
                    var, desc = line.split("#", 1)
                    variable_descriptions[var.strip()] = desc.strip()

            return skills, invocation_code, variable_descriptions
        else:
            return [], None, None

    def process_message_code_skill(self, mid: int, message: str) -> list[SkillV4]:
        """
        Processes a code_skill message and returns the corresponding skill(s).
        """
        code_skill_processing_errand: Errand = self.find_errand_in_profile(
            "message_code_skill_processing"
        )()
        code_skill_processing_client = self.find_client_in_profile(
            "message_code_skill_processing"
        )
        code: str = code_skill_processing_errand.run(
            runner=code_skill_processing_client,
            args={"message": message},
        )
        code = self.sanitize_code(code)

        docstring_addendum = f"\n\nThis function was generated to fulfill the intent of the user message with message id {mid}."

        func_defs = self.extract_function_definitions(code)
        skills = []
        if func_defs:
            for func in func_defs:
                func_code = func["code"].replace(
                    func["docstring"], func["docstring"] + docstring_addendum, 1
                )
                skills.append(
                    SkillV4(
                        name=func["python_name"],
                        source_message=message,
                        python_name=func["python_name"],
                        docstring=func["docstring"] + docstring_addendum,
                        code=func_code,
                    )
                )
        return skills

    def process_message_routine(
        self,
        mid: int,
        message: str,
        tidings: dict[str, Tiding],
        is_generating_routine: bool = False,
    ) -> tuple[list[SkillV4], str | None, dict[str, str] | None]:
        """
        Processes a routine message and returns the corresponding skill(s), invocation code, and variable descriptions.
        """
        routine_processing_errand: Errand = (
            self.find_errand_in_profile("message_routine_processing")()
            if not is_generating_routine
            else self.find_errand_in_profile("message_generating_routine_processing")()
        )
        routine_processing_client = (
            self.find_client_in_profile("message_routine_processing")
            if not is_generating_routine
            else self.find_client_in_profile("message_generating_routine_processing")
        )

        # Prepare skills and tidings for prompt injection
        serialized_skills = "\n\n".join(
            [f"function {k}\n---\n{v.docstring}" for k, v in self.skills.items()]
        )
        serialized_tidings = "\n".join(
            [f"{k} = {v.content}  # {v.description}" for k, v in tidings.items()]
        )
        code: str = routine_processing_errand.run(
            runner=routine_processing_client,
            args={
                "message": message,
                "skills": serialized_skills,
                "tidings": serialized_tidings,
            },
        )
        code = self.sanitize_code(code)

        # replace the first occurrence of code with f"message_{mid}_routine_code"
        code = code.replace("code", f"message_{mid}_routine_code", 1)
        docstring_addendum = f"\n\nThis function was generated to fulfill the intent of the user message with message id {mid}."

        func_defs = self.extract_function_definitions(code)
        skills = []
        variable_descriptions: dict[str, str] | None = None
        if func_defs:
            func = func_defs[0]
            func_code = func["code"].replace(
                func["docstring"], func["docstring"] + docstring_addendum, 1
            )
            skills.append(
                SkillV4(
                    name=func["python_name"],
                    source_message=message,
                    python_name=func["python_name"],
                    docstring=func["docstring"] + docstring_addendum,
                    code=func_code,
                )
            )

            # Generate invocation code using MessageRoutineCallErrand
            message_routine_call_errand: Errand = (
                self.find_errand_in_profile("message_routine_call")()
                if not is_generating_routine
                else self.find_errand_in_profile("message_generating_routine_call")()
            )
            message_routine_call_client = (
                self.find_client_in_profile("message_routine_call")
                if not is_generating_routine
                else self.find_client_in_profile("message_generating_routine_call")
            )
            invocation_code = message_routine_call_errand.run(
                runner=message_routine_call_client,
                args={
                    "message": message,
                    "code": skills[0].code,
                    "tidings": serialized_tidings,
                },
            )

            # Generate variable descriptions using MessageRoutineVariablesErrand
            message_routine_variables_errand: Errand = self.find_errand_in_profile(
                "message_routine_variables"
            )()
            message_routine_variables_client = self.find_client_in_profile(
                "message_routine_variables"
            )
            variable_descriptions_raw = message_routine_variables_errand.run(
                runner=message_routine_variables_client,
                args={
                    "message": message,
                    "code": skills[0].code,
                    "tidings": serialized_tidings,
                },
            )
            # Parse the output into a dict
            variable_descriptions = {}
            for line in variable_descriptions_raw.strip().splitlines():
                if "#" in line:
                    var, desc = line.split("#", 1)
                    variable_descriptions[var.strip()] = desc.strip()

            return skills, invocation_code, variable_descriptions
        else:
            return [], None, None

    def process_message_data(self, mid: int, message: str) -> str:
        """
        Processes a data message and returns the corresponding Python code that, when executed, loads variables into memory.
        """
        data_processing_errand: Errand = self.find_errand_in_profile(
            "message_data_processing"
        )()
        data_processing_client = self.find_client_in_profile("message_data_processing")

        code: str = data_processing_errand.run(
            runner=data_processing_client,
            args={"message": message},
        )
        code = self.sanitize_code(code)
        return code

    # MISC
    def make_trace_from_arg(
        self, path: str, trace_arg: bool | str | Trace | None = None
    ) -> Trace:
        if trace_arg is None:
            return Trace(None)
        if isinstance(trace_arg, Trace):
            return trace_arg
        if isinstance(trace_arg, bool):
            if trace_arg is True:
                return Trace(path)
            else:
                return Trace(None)
        if isinstance(trace_arg, str):
            if trace_arg == "stdout":
                return Trace(None, copy_into_stdout=True)
            if trace_arg == "file_and_stdout":
                return Trace(path, copy_into_stdout=True)
            else:
                raise ValueError(f"Invalid value for trace: {trace_arg}")

    def log_compilation_result(
        self,
        mid: int,
        skills: list[SkillV4] | None,
        invocation_code: str | None,
        variable_descriptions: dict[str, str] | None,
    ) -> None:
        self.compilation_trace.write_separator()
        self.compilation_trace(f"Compiled message {mid} at {datetime.now()}")
        if invocation_code is not None:
            self.compilation_trace(f"Invocation code: {invocation_code}")
        if variable_descriptions is not None:
            self.compilation_trace(f"Variable descriptions: {variable_descriptions}")

        if skills is not None:
            for skill in skills:
                self.compilation_trace("*" * 20)
                self.compilation_trace(f"Skill name: {skill.name}")
                self.compilation_trace(f"Python name: {skill.python_name}")
                self.compilation_trace(f"Docstring:\n{skill.docstring}")
                self.compilation_trace("-" * 20)
                self.compilation_trace(f"Code:\n{skill.code}")
                self.compilation_trace("-" * 20)
                self.compilation_trace(f"Source message:\n{skill.source_message}")

        self.compilation_trace.write_separator()

    def find_errand_in_profile(self, designation: str) -> type[Errand]:
        if designation in self.errand_profile:
            return self.errand_profile[designation]
        raise ValueError(
            f"Errand choice with designation '{designation}' not found in the errand profile"
        )

    def find_client_in_profile(self, designation: str) -> Client:
        if designation in self.client_profile:
            return self.client_profile[designation]
        raise ValueError(
            f"Client choice with designation '{designation}' not found in the client profile"
        )

    def extract_function_definitions(self, code: str) -> list[dict[str, Any]]:
        """
        Parses the given Python code and returns a list of dictionaries, each containing:
        - python_name: the function name
        - args: a list of argument names
        - docstring: the function docstring (or None)
        - code: the full source code of the function, including the signature
        Only top-level (module-level) functions are extracted; nested functions are ignored.
        """
        results = []
        try:
            tree = ast.parse(code)
        except Exception as e:
            return []

        # Helper to get source code for a node
        def get_source_segment(node):
            try:
                return ast.get_source_segment(code, node)
            except Exception:
                lines = code.splitlines()
                if hasattr(node, "lineno") and hasattr(node, "end_lineno"):
                    return "\n".join(lines[node.lineno - 1 : node.end_lineno])
                return None

        # Only consider top-level functions (direct children of Module)
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                func_name = node.name
                args = [arg.arg for arg in node.args.args]
                docstring = ast.get_docstring(node)
                func_code = get_source_segment(node)
                results.append(
                    {
                        "python_name": func_name,
                        "args": args,
                        "docstring": docstring,
                        "code": func_code,
                    }
                )
        return results

    def sanitize_code(self, code: str) -> str:
        """
        Sanitizes the code by removing ```python and ``` tags. Note that the code might also start with ``` and end with ```.
        """
        # Remove the first and last lines if they are empty
        lines = code.splitlines()
        if len(lines) > 0 and lines[0].strip() == "":
            lines = lines[1:]
        if len(lines) > 0 and lines[-1].strip() == "":
            lines = lines[:-1]

        # Remove the first and last lines if they are ```python or ```
        if len(lines) > 0 and (
            lines[0].strip() == "```python" or lines[0].strip() == "```"
        ):
            lines = lines[1:]
        if len(lines) > 0 and (
            lines[-1].strip() == "```" or lines[-1].strip() == "```python"
        ):
            lines = lines[:-1]

        return "\n".join(lines)
