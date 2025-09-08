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
import os
import sys
from typing import Callable


class Trace:
    def __init__(
        self,
        path: str | None = None,
        copy_into_stdout: bool = False,
        hook: Callable = None,
    ) -> None:
        self.path = path
        self.entries = []
        self.copy_into_stdout = copy_into_stdout
        self.hook = hook

        # set self.file to a new file if path is not None or to stdout if it is None
        self.file = open(path, "w") if path is not None else open(os.devnull, "w")

    def write(self, entry: str) -> None:
        self.entries.append(entry)
        print(entry, file=self.file, flush=True)
        if self.copy_into_stdout:
            print(entry, file=sys.stdout, flush=True)
        if self.hook is not None:
            self.hook(entry)

    def close(self) -> None:
        self.file.close()

    def __call__(self, *args) -> None:
        for arg in args:
            self.write(str(arg))

    def write_separator(self) -> None:
        self.write("#" * 80)
