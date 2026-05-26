import { extractTaskJsonCandidate } from "./json-extractor.js";

export async function parseJsonWithRepair(text, options = {}) {
  const extracted = extractTaskJsonCandidate(text, options.taskType);
  const candidate = extracted.candidate || String(text || "");
  const errors = [];
  try {
    return {
      ok: true,
      value: JSON.parse(candidate),
      repaired: false,
      error: null,
      extractionMethod: extracted.extractionMethod,
      extractionWarnings: extracted.warnings,
      jsonRepairAttempted: false,
      jsonRepairError: null,
      parseErrorPosition: null
    };
  } catch (error) {
    errors.push(error.message);
  }

  if (typeof options.repairFn === "function") {
    try {
      const repairedText = await options.repairFn(candidate || text, errors);
      const repairedExtraction = extractTaskJsonCandidate(repairedText, options.taskType);
      return {
        ok: true,
        value: JSON.parse(repairedExtraction.candidate || repairedText),
        repaired: true,
        error: null,
        extractionMethod: repairedExtraction.extractionMethod === "none" ? extracted.extractionMethod : repairedExtraction.extractionMethod,
        extractionWarnings: [...extracted.warnings, ...repairedExtraction.warnings],
        jsonRepairAttempted: true,
        jsonRepairError: null,
        parseErrorPosition: parseErrorPosition(errors[0])
      };
    } catch (error) {
      errors.push(error.message);
      return {
        ok: false,
        value: null,
        repaired: false,
        error: `JSON 解析失败：${errors.join("；")}`,
        extractionMethod: extracted.extractionMethod,
        extractionWarnings: extracted.warnings,
        jsonRepairAttempted: true,
        jsonRepairError: error.message,
        parseErrorPosition: parseErrorPosition(errors[0])
      };
    }
  }

  return {
    ok: false,
    value: null,
    repaired: false,
    error: `JSON 解析失败：${errors.join("；")}${extracted.warnings.length ? `；${extracted.warnings.join("；")}` : ""}`,
    extractionMethod: extracted.extractionMethod,
    extractionWarnings: extracted.warnings,
    jsonRepairAttempted: false,
    jsonRepairError: null,
    parseErrorPosition: parseErrorPosition(errors[0])
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

function parseErrorPosition(message = "") {
  const match = String(message).match(/position\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}
