import type { languages } from 'monaco-editor';

/**
 * Vue language configuration for Monaco editor
 * This provides basic Vue syntax highlighting by leveraging HTML, JavaScript, and CSS tokenizers
 * with Vue-specific enhancements for template expressions
 */
export function setupVueLanguage(monaco: typeof import('monaco-editor')) {
  // Register Vue language
  monaco.languages.register({ id: 'vue' });

  // Set Vue language configuration (brackets, comments, etc.)
  monaco.languages.setLanguageConfiguration('vue', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ['<', '>'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>', notIn: ['string'] },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: /^\s*<!--\s*#region\b.*-->/,
        end: /^\s*<!--\s*#endregion\b.*-->/,
      },
    },
  });

  // Define Vue token provider using Monarch
  // This provides syntax highlighting for Vue files
  monaco.languages.setMonarchTokensProvider('vue', {
    defaultToken: '',
    tokenPostfix: '.vue',

    keywords: [
      // Vue 3 composition API
      'defineProps',
      'defineEmits',
      'defineExpose',
      'defineSlots',
      'defineModel',
      'defineOptions',
      // Vue directives
      'v-if',
      'v-else',
      'v-else-if',
      'v-for',
      'v-on',
      'v-bind',
      'v-model',
      'v-show',
      'v-text',
      'v-html',
      'v-once',
      'v-pre',
      'v-cloak',
      'v-slot',
      'v-slot.',
      'v-slot:',
      'v-memo',
      'key',
      'ref',
      'is',
    ],

    operators: [
      '=',
      '>',
      '<',
      '!',
      '~',
      '?',
      ':',
      '==',
      '<=',
      '>=',
      '!=',
      '&&',
      '||',
      '++',
      '--',
      '+',
      '-',
      '*',
      '/',
      '&',
      '|',
      '^',
      '%',
      '<<',
      '>>',
      '>>>',
      '+=',
      '-=',
      '*=',
      '/=',
      '&=',
      '|=',
      '^=',
      '%=',
      '<<=',
      '>>=',
      '>>>=',
    ],

    // Include common symbols
    symbols: /[=><!~?:&|+\-*/^%]+/,

    // Vue template specific patterns
    templatePatterns: [
      { regex: /\{\{[\s\S]*?\}\}/, action: { token: 'tag' } },
      { regex: /\{\{/, action: { token: 'delimiter.bracket', next: '@templateExpression' } },
    ],

    tokenizer: {
      root: [
        // HTML doctype
        [/<!DOCTYPE[^>]*>/, 'meta.tag.doctype'],

        // XML declaration
        [/< \?xml.*\?>/, 'meta.tag.preprocessor.xml'],

        // HTML comments
        [/<!--[\s\S]*?-->/, 'comment'],

        // Vue script tags - handle <script> and <script setup>
        [
          /<script(\s+setup)?(\s+lang="[^"]*")?(\s+ts)?(\s+generic="[^"]*")?>/,
          { token: 'tag', next: '@scriptBlock' },
        ],

        // Vue style tags - handle <style>
        [/<style(\s+scoped)?(\s+lang="[^"]*")?>/, { token: 'tag', next: '@styleBlock' }],

        // Vue template tags
        [/<template(\s+lang="[^"]*")?>/, { token: 'tag', next: '@templateBlock' }],

        // Vue custom elements/components (self-closing)
        [/<[A-Z][a-zA-Z0-9]*(?:\.[a-z]+)*(?:-[a-z]+)*(?:\.[a-z]+)*[\s/>][^<]*/, 'tag'],

        // Vue custom elements/components
        [/<[A-Z][a-zA-Z0-9]*(?:\.[a-z]+)*(?:-[a-z]+)*/, 'tag'],

        // Standard HTML tags
        [/<[a-z][a-z0-9]*(?:-[a-z0-9]+)*[\s/>][^<]*/, 'tag'],

        // Vue binding expressions in attributes
        [/:[\w-]+=/, 'tag'],

        // Vue directives
        [/@[a-zA-Z][\w-]*/, 'tag'],

        // Vue template expressions {{ }}
        [/\{\{[\s\S]*?\}\}/, 'tag'],

        // Any other HTML-like tags
        [/<[^>]+>/, 'tag'],
      ],

      // Handle script block content (JavaScript/TypeScript)
      scriptBlock: [
        [/<\/script>/, { token: 'tag', next: '@root' }],
        // Include JavaScript tokenizer
        [/[^{}<]+/, ''],
      ],

      // Handle style block content (CSS)
      styleBlock: [
        [/<\/style>/, { token: 'tag', next: '@root' }],
        // Include CSS tokenizer - simplified
        [/[^{}<]+/, ''],
      ],

      // Handle template block content (HTML)
      templateBlock: [
        [/<\/template>/, { token: 'tag', next: '@root' }],
        // Vue directives in template
        [
          /v-if|v-else|v-else-if|v-for|v-on|v-bind|v-model|v-show|v-text|v-html|v-once|v-pre|v-cloak|v-slot/,
          'keyword',
        ],
        // Vue binding expressions
        [/:[\w-]+(?:\.[\w-]+)*(?::[\w-]+)?/, 'tag'],
        // Vue event handlers
        [/@[\w-]+(?:\.[\w-]+)*/, 'tag'],
        // Vue template expressions
        [/\{\{[\s\S]*?\}\}/, 'tag'],
        // Include HTML tokenizer - simplified
        [/[^{}<]+/, ''],
      ],

      // Handle template expressions {{ }}
      templateExpression: [
        [/\}\}/, { token: 'delimiter.bracket', next: '@root' }],
        [/[^}]+/, ''],
      ],
    },
  } as languages.IMonarchLanguage);
}

/**
 * Alternative: Simply map Vue to HTML for better out-of-box syntax highlighting
 * This uses Monaco's built-in HTML tokenizer which is more mature
 */
export function setupVueAsHtml(monaco: typeof import('monaco-editor')) {
  // For Vue files, we can use HTML tokenizer for basic highlighting
  // This is a simpler approach that leverages Monaco's strong HTML support
  monaco.languages.register({ id: 'vue' });

  monaco.languages.setLanguageConfiguration('vue', {
    comments: {
      lineComment: '//',
      blockComment: ['/*', '*/'],
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] },
    ],
  });

  // Use HTML tokenizer for Vue - this provides good syntax highlighting
  // for template, script, and style sections
  // This version embeds JS/TS/CSS for script/style blocks.
  monaco.languages.setMonarchTokensProvider('vue', {
    defaultToken: '',
    tokenPostfix: '.html',

    keywords: [
      // Vue directives
      'v-if',
      'v-else',
      'v-else-if',
      'v-for',
      'v-on',
      'v-bind',
      'v-model',
      'v-show',
      'v-text',
      'v-html',
      'v-once',
      'v-pre',
      'v-cloak',
      'v-slot',
      'v-memo',
      // Vue 3 Composition API
      'defineProps',
      'defineEmits',
      'defineExpose',
      'defineOptions',
      'defineModel',
      // Common Vue attributes
      'ref',
      'computed',
      'watch',
      'watchEffect',
      'onMounted',
      'onUnmounted',
      'onBeforeMount',
      'onUpdated',
      'onBeforeUpdate',
      'onBeforeUnmount',
      'onErrorCaptured',
      'provide',
      'inject',
    ],

    operators: [
      '=',
      '>',
      '<',
      '!',
      '~',
      '?',
      ':',
      '==',
      '<=',
      '>=',
      '!=',
      '&&',
      '||',
      '++',
      '--',
      '+',
      '-',
      '*',
      '/',
    ],

    tokenizer: {
      root: [
        // Vue script setup tag with special handling
        [
          /<script(\s+setup)?(\s+lang="(ts|typescript)")?>/,
          {
            token: 'tag',
            next: '@scriptSetupBlock',
            nextEmbedded: 'text/typescript',
          },
        ],
        // Script tag with explicit TypeScript
        [
          /<script(\s+lang="(ts|typescript)")?>/,
          {
            token: 'tag',
            next: '@scriptBlock',
            nextEmbedded: 'text/typescript',
          },
        ],
        // Script tag with explicit JavaScript
        [
          /<script(\s+lang="(js|javascript)")?>/,
          {
            token: 'tag',
            next: '@scriptBlock',
            nextEmbedded: 'text/javascript',
          },
        ],
        // Regular script tag
        [
          /<script>/,
          {
            token: 'tag',
            next: '@scriptBlock',
            nextEmbedded: 'text/javascript',
          },
        ],
        [/<\/script>/, { token: 'tag', next: '@root' }],

        // Style tag
        [
          /<style(\s+[^>]*)?>/,
          {
            token: 'tag',
            next: '@styleBlock',
            nextEmbedded: 'text/css',
          },
        ],
        [/<\/style>/, { token: 'tag', next: '@root' }],

        // Template tag
        [/<template>/, { token: 'tag', next: '@templateBlock' }],
        [/<\/template>/, { token: 'tag', next: '@root' }],

        // HTML doctype
        [/<!DOCTYPE[^>]*>/, 'meta.tag.doctype'],

        // HTML comments
        [/<!--[\s\S]*?-->/, 'comment'],

        // Vue template expressions {{ }}
        [/\{\{[\s\S]*?\}\}/, 'tag'],

        // Vue directives
        [/:[\w-]+/, 'attribute.name'],
        [/@[\w-]+/, 'attribute.name'],
        [/v-[\w-]+/, 'keyword'],

        // HTML tags
        [/<[a-z][a-z0-9]*(?:-[a-z0-9]+)*[\s/>]/, 'tag'],
        [/<\/[a-z][a-z0-9]*>/, 'tag'],

        // Any other content
        [/[^{}<]+/, ''],
      ],

      scriptSetupBlock: [
        [/<\/script>/, { token: 'tag', next: '@root', nextEmbedded: '@pop' }],
        // TypeScript/JavaScript content
        [/[^{}<]+/, ''],
      ],

      scriptBlock: [
        [/<\/script>/, { token: 'tag', next: '@root', nextEmbedded: '@pop' }],
        [/[^{}<]+/, ''],
      ],

      styleBlock: [
        [/<\/style>/, { token: 'tag', next: '@root', nextEmbedded: '@pop' }],
        [/[^{}<]+/, ''],
      ],

      templateBlock: [
        [/<\/template>/, { token: 'tag', next: '@root' }],
        // Vue specific syntax in template
        [/:[\w-]+/, 'attribute.name'],
        [/@[\w-]+/, 'attribute.name'],
        [/v-[\w-]+/, 'keyword'],
        [/\{\{[\s\S]*?\}\}/, 'tag'],
        // HTML tags
        [/<[a-z][a-z0-9]*(?:-[a-z0-9]+)*[\s/>]/, 'tag'],
        [/<\/[a-z][a-z0-9]*>/, 'tag'],
        [/[^{}<]+/, ''],
      ],
    },
  } as languages.IMonarchLanguage);
}
