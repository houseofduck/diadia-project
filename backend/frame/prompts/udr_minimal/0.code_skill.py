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
def send_message(type, description, **kwargs):
    """
    Sends a message by appending it to the global `__messages` list.

    This function creates a message dictionary with a specified type and description,
    along with any additional keyword arguments provided. The constructed message is
    then added to the global `__messages` list for further processing or logging.

    Args:
        type (str): The type of the message (e.g., "error", "info", "warning").
        description (str): A brief description of the message content.
        **kwargs: Additional key-value pairs to include in the message dictionary.

    Raises:
        NameError: If the global variable `__messages` is not defined.

    Example:
        send_message(
            type="info",
            description="Process completed successfully",
            report="Reporting information" # optional, added for this particular example
        )
    """
    global __messages
    message = {"type": type, "description": description, **kwargs}
    __messages.append(message)
