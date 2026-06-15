export async function request(baseUrl, path, options = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body, status: response.status };
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function logStep(name) {
  console.log(`  • ${name}`);
}