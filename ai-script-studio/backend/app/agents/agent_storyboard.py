import json
from typing import Dict, Any
from app.agents.base_agent import BaseAgent


class StoryboardAgent(BaseAgent):
    """Agent 4 - 分镜脚本执笔：生成详细分镜（支持并发）"""

    def __init__(self, **kwargs):
        super().__init__(agent_name="StoryboardAgent", **kwargs)

    def get_system_prompt(self, context: Dict[str, Any]) -> str:
        """生成系统提示词"""
        settings = context.get('settings_data', {})
        scene_outline = context.get('scene_outline', {})
        episode_index = context.get('episode_index', 1)

        return f"""你是一位专业的分镜脚本执笔，擅长将细纲转化为精确的分镜脚本。

🚨 时长控制铁律（最高优先级）：
- 每个镜头的时长必须严格控制在10秒左右
- 绝对不允许超过15秒！
- 如果动作或对话较长，必须强制切分为多个10-15秒内的连续镜头

核心要求：
1. 输出必须是严格的JSON格式
2. 每个镜头包含：镜号、画面描述、台词、时长
3. 画面描述必须具体、可视化，直接可用于AI视频生成
4. 严禁出现心理描写、内心独白等无法视觉化的内容
5. 必须使用全局设定词典中的视觉标签保持角色一致性

输出JSON结构：
{{
    "episode_index": {episode_index},
    "shots": [
        {{
            "shot_number": 1,
            "duration": 10,
            "visual_prompt": "详细的画面描述，包含角色、动作、场景、镜头运动等",
            "dialogue": "台词内容（如无则为空字符串）",
            "camera_movement": "镜头运动（如：推进、拉远、跟随等）"
        }}
    ]
}}

全局设定词典：
{json.dumps(settings, ensure_ascii=False, indent=2)}

本集细纲：
{json.dumps(scene_outline, ensure_ascii=False, indent=2)}

请严格按照时长要求生成分镜脚本。
"""

    def parse_output(self, raw_output: str) -> Dict[str, Any]:
        """解析并验证JSON输出"""
        try:
            if "```json" in raw_output:
                json_str = raw_output.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_output:
                json_str = raw_output.split("```")[1].split("```")[0].strip()
            else:
                json_str = raw_output.strip()

            data = json.loads(json_str)

            # 验证时长
            for shot in data.get("shots", []):
                if shot.get("duration", 0) > 15:
                    raise ValueError(f"Shot {shot.get('shot_number')} exceeds 15 seconds: {shot.get('duration')}s")

            return data
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse JSON output: {e}")
