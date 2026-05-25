export async function parseJsonWithRepair(text, options = {}) {
  const attempts = [
    () => JSON.parse(text),
    () => JSON.parse(extractJsonFence(text)),
    () => JSON.parse(extractObjectBody(text))
  ];

  const errors = [];
  for (const attempt of attempts) {
    try {
      return { ok: true, value: attempt(), repaired: false, error: null };
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (typeof options.repairFn === "function") {
    try {
      const repairedText = await options.repairFn(text, errors);
      return { ok: true, value: JSON.parse(repairedText), repaired: true, error: null };
    } catch (error) {
      errors.push(error.message);
    }
  }

  return {
    ok: false,
    value: null,
    repaired: false,
    error: `JSON 解析失败：${errors.join("；")}`
  };
}

export function extractJsonFence(text = "") {
  const match = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!match) throw new Error("未找到 JSON 代码块");
  return match[1].trim();
}

export function extractObjectBody(text = "") {
  const source = String(text);
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("未找到 JSON 对象边界");
  return source.slice(start, end + 1);
}
