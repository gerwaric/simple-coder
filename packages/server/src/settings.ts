const DEFAULT_TOKEN_BUDGET = Number(process.env.LLM_MAX_TOKENS) || 128000;

let tokenBudget = DEFAULT_TOKEN_BUDGET;

export function getTokenBudget(): number {
  return tokenBudget;
}

export function setTokenBudget(value: number): void {
  tokenBudget = value;
}
