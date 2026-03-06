import json
from typing import Dict, Any
from app.agents.base_agent import BaseAgent


class SettingsAgent(BaseAgent):
    """Agent 2 - 视觉与人设架构师：提取设定词典"""

    def __init__(self, **kwargs):
        super().__init__(agent_name="SettingsAgent", **kwargs)

    def get_system_prompt(self, context: Dict[str, Any]) -> str:
        """生成系统提示词"""
        outline = context.get('outline_data', {})

        return f"""你是一位专业的视觉设定架构师，擅长将文字描述转化为精确的视觉提示词。

你的任务是从大纲中提取并构建结构化的设定词典，为后续的AI视频生成提供视觉锚点。

核心要求：
1. 输出必须是严格的JSON格式
2. 为每个角色生成详细的视觉提示词标签（visual_prompt_tags）
3. 定义主要场景的视觉风格
4. 使用具体、可视化的描述词（避免抽象概念）
5. 确保视觉风格统一且易于AI理解

输出JSON结构：
{{
    "characters": [
        {{
            "name": "角色名",
            "visual_prompt_tags": "详细的视觉描述，包括外貌、服装、特征等，用逗号分隔",
            "personality_traits": "性格特点"
        }}
    ],
    "locations": [
        {{
            "name": "场景名",
            "visual_description": "场景的视觉描述",
            "atmosphere": "氛围感"
        }}
    ],
    "visual_style": {{
        "art_style": "画风类型（如：写实、动漫、水彩等）",
        "color_palette": "主色调",
        "lighting": "光线风格"
    }},
    "world_rules": [
        "世界观规则1",
        "世界观规则2"
    ]
}}

大纲数据：
{json.dumps(outline, ensure_ascii=False, indent=2)}
"""

    def parse_output(self, raw_output: str) -> Dict[str, Any]:
        """解析JSON输出"""
        try:
            if "```json" in raw_output:
                json_str = raw_output.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_output:
                json_str = raw_output.split("```")[1].split("```")[0].strip()
            else:
                json_str = raw_output.strip()

            return json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON output: {e}")
