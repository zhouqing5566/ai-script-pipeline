import asyncio
import httpx
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import get_settings

settings = get_settings()


class RateLimitError(Exception):
    """API速率限制异常"""
    pass


class BaseAgent(ABC):
    """Agent基类 - 实现并发控制和重试机制"""

    def __init__(
        self,
        agent_name: str,
        model: str = "gpt-4",
        temperature: float = 0.7,
        semaphore: Optional[asyncio.Semaphore] = None
    ):
        self.agent_name = agent_name
        self.model = model
        self.temperature = temperature
        self.semaphore = semaphore or asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)

    @abstractmethod
    def get_system_prompt(self, context: Dict[str, Any]) -> str:
        """
        获取系统提示词（支持动态变量注入）
        子类必须实现此方法
        """
        pass

    @abstractmethod
    def parse_output(self, raw_output: str) -> Dict[str, Any]:
        """
        解析AI输出为结构化数据
        子类必须实现此方法
        """
        pass

    @retry(
        stop=stop_after_attempt(settings.API_RETRY_MAX_ATTEMPTS),
        wait=wait_exponential(multiplier=settings.API_RETRY_BASE_DELAY, min=3, max=27),
        retry=retry_if_exception_type((RateLimitError, httpx.HTTPStatusError))
    )
    async def _call_llm_api(self, messages: list) -> str:
        """
        调用LLM API（带指数退避重试）
        """
        async with self.semaphore:  # 令牌桶限流
            try:
                # 这里使用OpenAI API作为示例
                # 实际使用时需要根据配置选择不同的API
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.model,
                            "messages": messages,
                            "temperature": self.temperature
                        }
                    )

                    if response.status_code == 429:
                        raise RateLimitError("API rate limit exceeded")

                    response.raise_for_status()
                    result = response.json()
                    return result["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as e:
                if e.response.status_code in [429, 503]:
                    raise RateLimitError(f"API error: {e.response.status_code}")
                raise

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行Agent任务

        Args:
            context: 包含动态变量的上下文字典

        Returns:
            结构化的输出数据
        """
        system_prompt = self.get_system_prompt(context)
        user_message = context.get("user_message", "")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]

        raw_output = await self._call_llm_api(messages)
        return self.parse_output(raw_output)
