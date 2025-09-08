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
Core research and reporting module for the Universal Deep Research Backend (UDR-B).

This module provides the main research functionality including:
- Query analysis and topic extraction
- Web search using Tavily API
- Content filtering and relevance scoring
- Report generation using LLMs
"""

import asyncio
import random
from typing import Any, AsyncGenerator, Dict, List

from openai import OpenAI
from tavily import TavilyClient

import items
from clients import (
    create_lm_client,
    create_tavily_client,
    get_completion,
    is_output_positive,
)
from config import get_config
from sessions import generate_session_key

# Get configuration
config = get_config()

# Use configuration values
MAX_TOPICS: int = config.research.max_topics
MAX_SEARCH_PHRASES: int = config.research.max_search_phrases


def build_research_artifacts_path(session_key: str) -> str:
    return f"instances/{session_key}.research_artifacts.jsonl"


def build_reporting_artifacts_path(session_key: str) -> str:
    return f"instances/{session_key}.reporting_artifacts.jsonl"


def make_event(
    type: str,
    description: str,
    hidden: bool = False,
    deltaSearchCount: int = 0,
    deltaQueryCount: int = 0,
    report: str | None = None,
) -> Dict[str, Any]:
    return {
        "type": type,
        "description": description,
        "hidden": hidden,
        "deltaSearchCount": deltaSearchCount,
        "deltaQueryCount": deltaQueryCount,
        **({"report": report} if report is not None else {}),
    }


async def do_research(
    session_key: str, prompt: str
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Performs research based on the provided query and yields events as they occur.

    This function handles the research phase, including:
    - Receipt and analysis of the research query
    - Planning the research approach
    - Searching for relevant information
    - Filtering and categorizing results
    - Aggregating findings into a coherent output

    Events yielded:
    - prompt_received: Initial receipt of the research query
    - prompt_analysis: Analysis of the query's requirements
    - research_planning: Planning the research approach
    - topic_exploration_started: Starting research on each topic
    - search_started: Initiating a search for each search phrase
    - search_result_processing_started: Processing the search results
    - aggregation_started: Beginning the aggregation of relevant segments
    - research_completed: Completion of the research phase

    Args:
        session_key (str): A unique identifier for the research session.
        prompt (str): The research query to process.

    Yields:
        Dict containing:
        - type (str): The event type.
        - description (str): User-friendly description of the event.
        - hidden (bool, default=False): Whether the event is hidden from the user or should be displayed.
        - deltaSearchCount (int, optional): The number of search queries performed.
        - deltaQueryCount (int, optional): The number of queries performed.
        - report (str, optional): The report produced.
    """

    research_artifacts_path: str = build_research_artifacts_path(session_key)
    items.register_item(research_artifacts_path, {"type": "prompt", "prompt": prompt})

    client = create_lm_client()
    tavily_client = create_tavily_client()

    yield make_event(
        "prompt_received",
        f"Received research request: '{prompt}'",
    )

    prompt_valid: bool = check_if_prompt_is_valid(client, prompt)
    items.register_item(
        research_artifacts_path, {"type": "prompt_validity", "valid": prompt_valid}
    )
    if not prompt_valid:
        yield make_event(
            "error",
            "It would appear that the prompt is not a valid document research prompt. Please try again with a valid prompt.",
            deltaQueryCount=1,
        )
        return

    yield {
        "type": "prompt_analysis_started",
        "description": "Analyzing the research request...",
        "hidden": False,
    }

    task_prompt, format_prompt = perform_prompt_decomposition(client, prompt)
    items.register_item(
        research_artifacts_path, {"type": "task_prompt", "task_prompt": task_prompt}
    )
    items.register_item(
        research_artifacts_path,
        {"type": "format_prompt", "format_prompt": format_prompt},
    )

    yield make_event(
        "prompt_analysis_completed",
        f"Prompt analysis completed. Will analyze the following task assignment: '{task_prompt}'.",
        deltaQueryCount=1,
    )

    topics: List[str] = generate_topics(client, task_prompt)
    items.register_item(research_artifacts_path, {"type": "topics", "topics": topics})
    yield make_event(
        "task_analysis_completed",
        f"Task analysis completed. Will be researching {len(topics)}+ topics.",
        deltaQueryCount=1,
    )

    topic_relevant_segments: dict[str, List[str]] = {}
    search_result_urls: List[str] = []
    all_results: List[Dict[str, Any]] = []
    for topic in topics:
        yield make_event(
            "topic_exploration_started",
            f"Researching '{topic}'",
        )

        search_phrases: List[str] = produce_search_phrases(client, prompt, topic)
        items.register_item(
            research_artifacts_path,
            {
                "type": "topic_search_phrases",
                "topic": topic,
                "search_phrases": search_phrases,
            },
        )

        yield make_event(
            "topic_exploration_completed",
            f"Will invoke {len(search_phrases)} search phrases to research '{topic}'.",
            deltaQueryCount=1,
        )

        topic_relevant_segments[topic] = []
        for search_phrase in search_phrases:
            yield make_event(
                "search_started",
                f"Searching for '{search_phrase}'",
            )

            search_results: List[Dict[str, Any]] = perform_search(
                tavily_client, search_phrase, research_artifacts_path
            )
            items.register_item(
                research_artifacts_path,
                {
                    "type": "topic_search_results",
                    "topic": topic,
                    "search_phrase": search_phrase,
                    "results": search_results,
                },
            )
            original_search_result_urls: List[str] = [
                result["url"]
                for result in search_results
                if result["url"] not in search_result_urls
            ]
            search_result_urls.extend(original_search_result_urls)
            original_search_results = [
                result
                for result in search_results
                if result["url"] in original_search_result_urls
            ]
            all_results.extend(original_search_results)

            yield make_event(
                "search_result_processing_started",
                f"Processing {len(original_search_result_urls)} search results.",
                deltaSearchCount=1,
            )

            for search_result in original_search_results:
                search_result_content: str = search_result["raw_content"]
                search_result_url: str = search_result["url"]
                search_result_url_index: int = search_result_urls.index(
                    search_result_url
                )
                relevant_segments: List[str] = find_relevant_segments(
                    client,
                    prompt,
                    topic,
                    search_result_content,
                    search_result_url_index,
                )
                topic_relevant_segments[topic].extend(relevant_segments)
                items.register_item(
                    research_artifacts_path,
                    {
                        "type": "topic_search_result_relevant_segments",
                        "topic": topic,
                        "search_phrase": search_phrase,
                        "search_result": search_result,
                        "relevant_segments": relevant_segments,
                    },
                )

                yield make_event(
                    "search_result_processing_completed",
                    f"Processed search result {search_result_url_index}.",
                    hidden=True,
                    deltaQueryCount=1,
                )

    yield make_event(
        "aggregation_started",
        "Aggregating relevant information for all topics.",
    )

    items.register_item(
        research_artifacts_path,
        {
            "type": "topic_relevant_segments",
            "topic_relevant_segments": topic_relevant_segments,
            "search_result_urls": search_result_urls,
        },
    )
    items.register_item(
        research_artifacts_path, {"type": "all_results", "all_results": all_results}
    )

    # sleep for 0.5s
    await asyncio.sleep(0.5)

    yield make_event(
        "research_completed",
        "Research phase completed.",
    )


async def do_reporting(session_key: str) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Generates a report based on the research findings and yields events as they occur.

    This function handles the reporting phase, including:
    - Report construction
    - Formatting and organization
    - Final delivery

    Events yielded:
    - report_building: Initial report construction
    - report_formatting: Formatting and structuring the report
    - report_done: Report completion and delivery

    Yields:
        Dict containing:
        - type (str): The event type
        - description (str): User-friendly description of the event
        - hidden (bool, default=False): Whether the event is hidden from the user or should be displayed
        - deltaSearchCount (int, optional): The number of search queries performed
        - deltaQueryCount (int, optional): The number of queries performed
        - report (str, optional): The report produced
    """

    client = create_lm_client()

    research_artifacts_path: str = build_research_artifacts_path(session_key)
    task_prompt: str = items.find_item_by_type(research_artifacts_path, "task_prompt")[
        "task_prompt"
    ]
    format_prompt: str = items.find_item_by_type(
        research_artifacts_path, "format_prompt"
    )["format_prompt"]
    topic_relevant_segments: dict[str, List[str]] = items.find_item_by_type(
        research_artifacts_path, "topic_relevant_segments"
    )["topic_relevant_segments"]
    search_result_urls: List[str] = items.find_item_by_type(
        research_artifacts_path, "topic_relevant_segments"
    )["search_result_urls"]
    all_results: List[Dict[str, Any]] = items.find_item_by_type(
        research_artifacts_path, "all_results"
    )["all_results"]

    yield make_event(
        "report_building",
        "Building the report...",
    )

    reporting_artifacts_path: str = build_reporting_artifacts_path(session_key)
    report: str = produce_report(
        client, task_prompt, format_prompt, topic_relevant_segments
    )
    items.register_item(reporting_artifacts_path, {"type": "report", "report": report})

    # Step 3: Ensure that the report is consistent and formatted correctly in Markdown
    yield make_event(
        "report_processing",
        "Formatting the report...",
        deltaQueryCount=1,
    )
    consistent_report: str = ensure_format_is_respected(
        client, task_prompt, format_prompt, report
    )
    consistent_report += "\n\n"
    consistent_report += "---\n"
    for search_result_url_index, search_result_url in enumerate(search_result_urls):
        result = next(
            (result for result in all_results if result["url"] == search_result_url),
            None,
        )
        consistent_report += f" - [[{search_result_url_index}]] [{result['title']}][{search_result_url_index}]\n"
    consistent_report += "\n\n"
    for search_result_url_index, search_result_url in enumerate(search_result_urls):
        consistent_report += f"[{search_result_url_index}]: {search_result_url}\n"
    items.register_item(
        reporting_artifacts_path,
        {"type": "consistent_report", "consistent_report": consistent_report},
    )

    yield make_event(
        "report_done",
        "Report completed.",
        report=consistent_report,
        deltaQueryCount=1,
    )


# ERRANDS
def check_if_prompt_is_valid(client: OpenAI, prompt: str) -> bool:
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that checks if a prompt is a valid deep information research prompt. A valid prompt is in English and gives a task to research one or more topics and produce a report. Invalid prompts are general language model prompts that ask simple (perhaps even yes or no) questions, ask forexplanations, or attempt to have a conversation. Examples of valid prompts: 'What was the capital of France in 1338?', 'Write a report on stock market situation on during this morning', 'Produce a thorough report on the major event happened in the Christian world on the 21st of April 2025.', 'Produce a report on the differences between the US and European economy health in 2024.', 'What is the short history of the internet?'. Examples of invalid prompts: 'Is the weather in Tokyo good?', 'ppdafsfgr hdafdf', 'Hello, how are you?', 'The following is a code. Can you please explain it to me and then simulate it?'",
        },
        {
            "role": "user",
            "content": f"Is the following prompt a valid information research prompt? Respond with 'yes' or 'no'. Do not output any other text.\n\n{prompt}\n\n Reminders: Find out if the above-given prompt is a valid information research prompt. Do not output any other text.",
        },
    ]
    return is_output_positive(get_completion(client, messages))


def perform_prompt_decomposition(client: OpenAI, prompt: str) -> List[str]:
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that decomposes a prompt into a task to be performed and a format in which the report should be produced. The output should be two prompts separated by a double-newline. The first prompt is the task to be performed, and the second prompt is the format in which the report should be produced. If there is no formatting constraint, output 'No formatting constraint' in the second prompt. Do not output any other text.",
        },
        {
            "role": "user",
            "content": f"Decompose the PROMPT into a task to be performed and a format in which the report should be produced. If there is no formatting constraint, output 'No formatting constraint' in the second prompt. Do not output any other text.\n\nEXAMPLE PROMPT:\nWrite a three-chapter report on the differences between the US and European economy health in 2024. The first chapter should be about the US economy health, the second chapter should be about the European economy health, and the third chapter should be about the differences between the two.\n\nEXAMPLE OUTPUT:\nWrite a report on the differences between the US and European economy health in 2024.\n\nThe report should be in the form of a three-chapter report. The first chapter should be about the US economy health, the second chapter should be about the European economy health, and the third chapter should be about the differences between the two.\n\nPROMPT: {prompt}\n\nReminders: The output should be two prompts separated by a double-newline. The first prompt is the task to be performed, and the second prompt is the format in which the report should be produced. If there is no formatting constraint, output 'No formatting constraint' in the second prompt. Do not output any other text.",
        },
    ]
    decomposition = get_completion(client, messages).split("\n\n")
    if len(decomposition) != 2:
        raise ValueError(
            f"Failed to perform prompt decomposition; decomposition: {decomposition}"
        )
    return decomposition


def generate_topics(client: OpenAI, prompt: str) -> List[str]:
    messages = [
        {
            "role": "system",
            "content": f"You are a helpful assistant that decomposes a prompt into a list of topics to research. The output should be a list of strings separated by newlines, each representing a topic to research. The topics should be in English and should be specific and focused. Output at most {MAX_TOPICS} topics. Examples:\n\nPrompt: What was the capital of France in 1338?\nThe capital and seat of government of France in 1338\n\nPrompt: Produce a report on the differences between the US and European economy health in 2024\nUS economy health in 2024\nEuropean economy health in 2024\nGeneral differences between the US and European economy health in 2024\n\nPrompt: What is the short history of the internet?:\nThe history of the internet\n\nPrompt: Report on US crude oil prices in relation to Gold prices in 1970-1980\nUS crude oil prices in 1970-1980\nGold prices in 1970-1980\nGold-crude oil correlation in 1970-1980",
        },
        {
            "role": "user",
            "content": f"Decompose the following prompt into a list of topics to research:\n\nPrompt: {prompt}\n\nReminders: The output should be a list of strings separated by newlines, each representing a topic to research. The topics should be in English and should be specific and focused. Do not output any other text. Output at most {MAX_TOPICS} topics.",
        },
    ]
    completion: str = get_completion(client, messages)
    completion_lines: List[str] = completion.split("\n")
    ret = [line.strip() for line in completion_lines if line.strip()]
    if len(ret) > MAX_TOPICS:
        ret = random.sample(ret, MAX_TOPICS)
    return ret


def produce_search_phrases(client: OpenAI, prompt: str, topic: str) -> List[str]:
    messages = [
        {
            "role": "system",
            "content": f"You are a helpful assistant that produces a list of search phrases for a given topic. The output should be a newline-separated list of short search phrases that can be used in e.g. Google or Bing search engines. Output at most {MAX_SEARCH_PHRASES} search phrases. Examples:\n\nTopic: The capital and seat of government of France in 1338\nSearch phrases: The capital of France in 1338, The seat of government of France in 1338, Government of France in 1338 century, Government of France in the 14th century\n\nTopic: US crude oil prices in relation to Gold prices in 1970-1980\nSearch phrases: US crude oil prices in 1970-1980, Gold prices in 1970-1980, Gold-crude oil correlation in 1970-1980, Gold-crude oil correlation\n\nTopic: {topic}\nSearch phrases:",
        },
        {
            "role": "user",
            "content": f"Produce a list of search phrases for the following topic:\n\nPrompt (added for context): {prompt}\n\nTopic: {topic}\n\nReminders: The output should be a list of search phrases for the given topic separated by newlines. The search phrases should be in English and should be specific and focused. Output at most {MAX_SEARCH_PHRASES} search phrases. Do not output any other text.",
        },
    ]
    completion: str = get_completion(client, messages)
    completion_lines: List[str] = completion.split("\n")
    ret = [line.strip() for line in completion_lines if line.strip()]
    if len(ret) > MAX_SEARCH_PHRASES:
        ret = random.sample(ret, MAX_SEARCH_PHRASES)
    return ret


def perform_search(
    client: TavilyClient, search_phrase: str, research_artifacts_path: str
) -> List[Dict[str, Any]]:
    search_response: Dict[str, Any] = client.search(
        search_phrase, include_raw_content=True
    )
    items.register_item(
        research_artifacts_path,
        {
            "type": "search_response_raw",
            "search_phrase": search_phrase,
            "response": search_response,
        },
    )
    filtered_results: List[Dict[str, Any]] = [
        result
        for result in search_response["results"]
        if result["raw_content"] is not None and result["raw_content"].strip() != ""
    ]
    items.register_item(
        research_artifacts_path,
        {
            "type": "search_response_filtered",
            "search_phrase": search_phrase,
            "response": filtered_results,
        },
    )
    return filtered_results


def find_relevant_segments(
    client: OpenAI,
    prompt: str,
    topic: str,
    search_result: str,
    search_result_url_index: int,
) -> List[str]:
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that finds relevant paragraphs in a given search result. The output should be a double-newline-separated list of relevant paragraphs. A paragraph can be a couple of sentences to dozens of sentences if they are really relevant. If there are no relevant paragraphs, just output an empty line or two and stop the generation. Do not output any other text.",
        },
        {
            "role": "user",
            "content": f"Find the sentences or paragraphs relevant to the following prompt in the following search result:\n\nSearch result: {search_result}\n\nPrompt (added for context): {prompt}\n\nTopic: {topic}\n\nReminders: The output should be a list of relevant paragraphs for the given topic separated by double-newlines. The relevant paragraphs should be in English and should be genuinely relevant to the prompt. Do not output any other text.",
        },
    ]
    ret = get_completion(client, messages).split("\n")
    ret = [line.strip() for line in ret if line.strip()]
    ret = [f"[[{search_result_url_index}]] {paragraph}" for paragraph in ret]
    return ret


def produce_report(
    client: OpenAI,
    prompt: str,
    format_prompt: str,
    topic_relevant_segments: dict[str, List[str]],
) -> str:
    topic_relevant_segments_str: str = "\n".join(
        [
            f"Topic: {topic}\n{'\n'.join(segments)}"
            for topic, segments in topic_relevant_segments.items()
        ]
    )
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that produces a report based on the aggregated per-topic relevant paragraphs while citing sources. The output should be a report in Markdown format. The report should be self-consistent and formatted correctly in Markdown. Do not output any other text.",
        },
        {
            "role": "user",
            "content": f"Produce a report based on the following aggregated per-topic relevant paragraphs. Each paragraph contains an index of a source. Make sure to refer to this index in the form [[index]] every time you rely on the information from the source. Respect the format prompt. Do not output any other text.\n\nReport prompt: {prompt}\n\nTopic relevant paragraphs: {topic_relevant_segments_str}\n\nFormat prompt: {format_prompt}\n\nReminders: The output should be a report in Markdown format. The report should be formatted correctly according to the Format prompt in Markdown. Every single mention of an information stemming from one of the sources should be accompanied by the source index in the form [[index]] (or [[index1,index2,...]]) within or after the statement of the information. A list of the source URLs to correspond to the indices will be provided separately -- do not attempt to output it. Do not output any other text.",
        },
    ]
    return get_completion(client, messages).strip()


def ensure_format_is_respected(
    client: OpenAI, prompt: str, format_prompt: str, report: str
) -> str:
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that ensures that a report is properly formatted. The output should be a report in Markdown format and follow the format prompt. The report should be formatted correctly in Markdown. Note that double horizontal rule (.e.g ==== etc.) are not supported in official Markdown. Do not output any other text.",
        },
        {
            "role": "user",
            "content": f"Ensure that the following report is properly formatted according to the format prompt. Do not output the Markdown output as code (i.e. enclosed in ```) -- just output the Markdown. Do not remove any references in the form [[index]] -- keep them in the text! The list of sources will be provided separately.\n\nReport: {report}\n\nFormat prompt: {format_prompt}\n\nReminders: The output should be a report in Markdown format. The report should be self-consistent and formatted correctly in Markdown. Do not output the Markdown output as code (i.e. enclosed in ```) -- just output the Markdown. Do not remove any references in the form [[index]] -- keep them in the text! The list of sources will be provided separately. Do not output any other text.",
        },
    ]
    return get_completion(client, messages).strip()
