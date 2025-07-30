import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';


export const myProvider =
   customProvider({
      languageModels: {
        'chat-model': xai('grok-4-0709'),
        'chat-model-reasoning': wrapLanguageModel({
          model: xai('grok-4-0709'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': xai('grok-4-0709'),
      }
    });