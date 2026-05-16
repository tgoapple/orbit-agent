export async function createOllamaReply({ baseUrl, model, systemPrompt, messages, tools }) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      stream: false,
      tools,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    })
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Ollama returned non-JSON output: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const detail = data?.error || text.slice(0, 300);
    throw new Error(`Ollama request failed: ${detail}`);
  }

  const message = data?.message;
  if (!message) {
    throw new Error("Ollama returned no message.");
  }

  return {
    content: message.content || "",
    tool_calls: Array.isArray(message.tool_calls)
      ? message.tool_calls.map((toolCall, index) => ({
          id: toolCall.id || `ollama-tool-${index + 1}`,
          type: "function",
          function: {
            name: toolCall.function?.name,
            arguments: JSON.stringify(toolCall.function?.arguments || {})
          }
        }))
      : []
  };
}
