import json
from typing import Dict, Any
from app.agents.base_agent import BaseAgent


class OutlineAgent(BaseAgent):
    """Agent 1 - 总控编剧：生成整体大纲"""

    def __init__(self, **kwargs):
        super().__init__(agent_name="OutlineAgent", **kwargs)

    def get_system_prompt(self, context: Dict[str, Any]) -> str:
        """生成系统提示词"""
        return f"""你是一位资深的剧本总控编剧，擅长构建完整的故事大纲。

你的任务是根据用户提供的核心创意，创作一个完整的季播/系列剧大纲。

核心要求：
1. 输出必须是严格的JSON格式
2. 包含整体故事主线、核心矛盾、主要角色
3. 规划至少3-5集的内容走向
4. 每集都要有明确的情绪高潮点和悬念钩子
5. 确保故事具有视觉化潜力（避免纯心理描写）

输出JSON结构：
{{
    "title": "剧集标题",
    "genre": "题材类型",
    "premise": "核心设定（1-2句话）",
    "main_conflict": "核心矛盾",
    "characters": [
        {{
            "name": "角色名",
            "role": "角色定位",
            "brief": "简要描述"
        }}
    ],
    "episodes_outline": [
        {{
            "episode_number": 1,
            "title": "集标题",
            "synopsis": "剧情概要",
            "emotional_peak": "情绪高潮点",
            "cliffhanger": "悬念钩子"
        }}
    ]
}}

用户创意：
{context.get('core_premise', '')}

题材类型：
{context.get('genre', '未指定')}

对标作品：
{context.get('reference_works', '无')}
"""

    def parse_output(self, raw_output: str) -> Dict[str, Any]:
        """解析JSON输出"""
        try:
            # 尝试提取JSON（处理可能的markdown代码块）
            if "```json" in raw_output:
                json_str = raw_output.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_output:
                json_str = raw_output.split("```")[1].split("```")[0].strip()
            else:
                json_str = raw_output.strip()

            return json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON output: {e}\nRaw output: {raw_output}")
