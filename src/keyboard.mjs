const KEYS = Object.freeze(['Tab', 'Shift+Tab', 'Enter', 'Space', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Backspace', 'Delete', 'ControlOrMeta+A']);

export const tools = [
  {type: 'function', name: 'press_key', description: 'Press a supported key on the currently focused element.', strict: true, parameters: {type: 'object', properties: {key: {type: 'string', enum: [...KEYS]}}, required: ['key'], additionalProperties: false}},
  {type: 'function', name: 'type_text', description: 'Type into the currently focused element using keyboard events. Cannot select or focus an element.', strict: true, parameters: {type: 'object', properties: {text: {type: 'string'}}, required: ['text'], additionalProperties: false}}
];

export function validateAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action) || Object.keys(action).sort().join() !== 'arguments,name') throw new Error('invalid_action');
  const args = action.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('invalid_arguments');
  if (action.name === 'press_key' && Object.keys(args).join() === 'key' && KEYS.includes(args.key)) return structuredClone(action);
  if (action.name === 'type_text' && Object.keys(args).join() === 'text' && typeof args.text === 'string' && args.text.length > 0 && args.text.length <= 256 && !/[\p{Cc}\p{Cf}\p{Cs}\u2028\u2029]/u.test(args.text)) return structuredClone(action);
  throw new Error('forbidden_action');
}

// The returned interface closes over a page; the agent never receives that page.
export function createKeyboardExecutor(page, {budget = 25, afterAction = async () => {},signal} = {}) {
  if (!Number.isInteger(budget) || budget < 1 || budget > 100) throw new Error('invalid_budget');
  let used = 0;
  let active = false;
  return Object.freeze({
    get used() { return used; },
    async execute(candidate) {
      const action = validateAction(candidate);
      signal?.throwIfAborted();
      if (active) throw new Error('concurrent_action');
      if (used >= budget) throw new Error('action_budget_exhausted');
      active = true;
      used++;
      try {
        if (action.name === 'press_key') await page.keyboard.press(action.arguments.key);
        else await page.keyboard.type(action.arguments.text);
        await afterAction();
      } finally { active = false; }
      return {index: used, action};
    }
  });
}
