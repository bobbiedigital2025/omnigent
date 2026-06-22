import { AgentTaskType } from './agentRouter';

export interface LLMRouteResult {
  response: string;
  provider: string;
  source: 'cloud' | 'local' | 'fallback';
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const localFallbackResponse = async (prompt: string): Promise<LLMRouteResult> => {
  const normalized = prompt.toLowerCase();

  const scaffoldHints = ['scaffold', 'setup', 'build', 'bootstrap', 'initialize'];
  const hotfixHints = ['fix', 'hotfix', 'memory leak', 'leak', 'bug', 'repair'];
  const draftHints = ['draft', 'support', 'ticket', 'email', 'reply', 'response'];

  let response = 'I am ready to assist with your app workflow. Describe a task and I will help route it to the orchestrator.';

  if (scaffoldHints.some((hint) => normalized.includes(hint))) {
    response = 'I recommend starting a scaffold task to initialize a new React + Vite application skeleton with a secure local event bus.';
  } else if (hotfixHints.some((hint) => normalized.includes(hint))) {
    response = 'I recommend dispatching a hotfix task to inspect the backend runtime and apply an agent-assisted patch.';
  } else if (draftHints.some((hint) => normalized.includes(hint))) {
    response = 'I recommend using the support draft assist task to generate a response for the selected ticket.';
  }

  return {
    response,
    provider: 'local-fallback',
    source: 'fallback'
  };
};

const sendOpenAIRequest = async (prompt: string): Promise<LLMRouteResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are the Main Agent orchestrator that routes user requests to background tasks.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 250
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const body = await response.json();
  const firstChoice = body?.choices?.[0]?.message?.content;
  return {
    response: typeof firstChoice === 'string' ? firstChoice.trim() : 'OpenAI returned an invalid response.',
    provider: 'OpenAI',
    source: 'cloud'
  };
};

export const routePromptToLLM = async (prompt: string): Promise<LLMRouteResult> => {
  const provider = process.env.LLM_PROVIDER?.toLowerCase() || 'openai';

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    try {
      return await sendOpenAIRequest(prompt);
    } catch (err) {
      console.warn('OpenAI route failed, falling back:', (err as Error).message);
      return localFallbackResponse(prompt);
    }
  }

  return localFallbackResponse(prompt);
};

export const inferAgentTaskFromPrompt = (prompt: string): AgentTaskType | null => {
  const normalized = prompt.toLowerCase();

  if (/scaffold|setup|build|bootstrap|initialize/.test(normalized)) {
    return 'scaffold';
  }
  if (/fix|hotfix|memory leak|leak|bug|repair/.test(normalized)) {
    return 'hotfix';
  }
  if (/draft|support|ticket|email|reply|response/.test(normalized)) {
    return 'draft_assist';
  }

  return null;
};
