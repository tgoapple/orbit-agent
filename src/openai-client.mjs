export async function createAssistantReply({ apiKey, baseUrl, model, systemPrompt, messages, tools }) {
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to /Users/tgo/Documents/Playground/orbit-agent/.env");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      tools,
      tool_choice: tools?.length ? "auto" : undefined
    })
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Model returned non-JSON output: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const detail = data?.error?.message || text.slice(0, 300);
    throw new Error(`Model request failed: ${detail}`);
  }

  const message = data?.choices?.[0]?.message;
  if (!message) {
    throw new Error("Model returned no message.");
  }

  return message;
}
