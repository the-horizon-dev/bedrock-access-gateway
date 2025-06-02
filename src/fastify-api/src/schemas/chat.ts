import { Type } from '@sinclair/typebox';

export const Message = Type.Object({
  role: Type.Union([
    Type.Literal('system'),
    Type.Literal('user'),
    Type.Literal('assistant'),
    Type.Literal('function'),
    Type.Literal('tool')
  ]),
  content: Type.Union([Type.String(), Type.Array(Type.Any())]),
  name: Type.Optional(Type.String()),
  function_call: Type.Optional(Type.Object({
    name: Type.String(),
    arguments: Type.String()
  })),
  tool_calls: Type.Optional(Type.Array(Type.Object({
    id: Type.String(),
    type: Type.Literal('function'),
    function: Type.Object({
      name: Type.String(),
      arguments: Type.String()
    })
  })))
});

export const ChatRequest = Type.Object({
  model: Type.String({
    description: 'ID of the model to use. You can use OpenAI model names (e.g., gpt-4) or Anthropic model IDs.'
  }),
  messages: Type.Array(Message, {
    description: 'A list of messages comprising the conversation so far.'
  }),
  stream: Type.Optional(Type.Boolean({
    default: false,
    description: 'If set, partial message deltas will be sent as server-sent events.'
  })),
  temperature: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 2,
    default: 1,
    description: 'Sampling temperature between 0 and 2.'
  })),
  top_p: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 1,
    default: 1,
    description: 'Nucleus sampling parameter.'
  })),
  n: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 1,
    default: 1,
    description: 'Number of completions (currently only 1 is supported).'
  })),
  max_tokens: Type.Optional(Type.Integer({
    minimum: 1,
    description: 'Maximum number of tokens to generate.'
  })),
  presence_penalty: Type.Optional(Type.Number({
    minimum: -2,
    maximum: 2,
    default: 0
  })),
  frequency_penalty: Type.Optional(Type.Number({
    minimum: -2,
    maximum: 2,
    default: 0
  })),
  logit_bias: Type.Optional(Type.Record(Type.String(), Type.Number())),
  user: Type.Optional(Type.String()),
  stop: Type.Optional(Type.Union([
    Type.String(),
    Type.Array(Type.String(), { maxItems: 4 })
  ]))
});

export const Choice = Type.Object({
  index: Type.Integer(),
  message: Type.Object({
    role: Type.Literal('assistant'),
    content: Type.String()
  }),
  finish_reason: Type.Union([
    Type.Literal('stop'),
    Type.Literal('length'),
    Type.Literal('tool_calls'),
    Type.Literal('content_filter'),
    Type.Null()
  ])
});

export const Usage = Type.Object({
  prompt_tokens: Type.Integer(),
  completion_tokens: Type.Integer(),
  total_tokens: Type.Integer()
});

export const ChatResponse = Type.Object({
  id: Type.String(),
  object: Type.Literal('chat.completion'),
  created: Type.Integer(),
  model: Type.String(),
  choices: Type.Array(Choice),
  usage: Usage,
  system_fingerprint: Type.Optional(Type.String())
});

export const ChatChunk = Type.Object({
  id: Type.String(),
  object: Type.Literal('chat.completion.chunk'),
  created: Type.Integer(),
  model: Type.String(),
  choices: Type.Array(Type.Object({
    index: Type.Integer(),
    delta: Type.Object({
      role: Type.Optional(Type.Literal('assistant')),
      content: Type.Optional(Type.String())
    }),
    finish_reason: Type.Optional(Type.Union([
      Type.Literal('stop'),
      Type.Literal('length'),
      Type.Literal('tool_calls'),
      Type.Literal('content_filter'),
      Type.Null()
    ]))
  }))
});