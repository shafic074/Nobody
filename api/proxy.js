module.exports = async (req, res) => {
  // 1. Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. Identify the provider
  const { provider } = req.query;
  let targetUrl;
  const headers = { 'Content-Type': 'application/json' };
  let bodyToSend = req.body;

  // 3. Route to the correct upstream API
  if (provider === 'deepseek' || provider === 'deepseekPro') {
    targetUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
    headers['Authorization'] = Bearer ${process.env.NVIDIA_API_KEY};
  } else if (provider === 'groq') {
    targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
    headers['Authorization'] = Bearer ${process.env.GROQ_API_KEY};
  } else if (provider === 'openrouter') {
    targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
    headers['Authorization'] = Bearer ${process.env.OPENROUTER_API_KEY};
  } else if (provider === 'gemini') {
    // Gemini requires the model in the URL and uses a query param for the key
    const { model, ...geminiBody } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'Model is required for Gemini' });
    }
    targetUrl = https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY};
    bodyToSend = geminiBody; // Remove model from body since it's in the URL
  } else {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  // 4. Forward the request to the AI provider
  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyToSend),
    });

    // Copy status code
    res.status(upstreamResponse.status);

    // Stream the response back to the client
    if (upstreamResponse.body) {
      const reader = upstreamResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
};
