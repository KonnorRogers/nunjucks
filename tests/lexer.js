(function() {
  'use strict';

  var expect;
  var lib;
  var lexer;

  if (typeof require !== 'undefined') {
    expect = globalThis.expect;
    lib = require('../nunjucks/src/lib');
    lexer = require('../nunjucks/src/lexer');
  } else {
    expect = globalThis.expect;
    lib = nunjucks.lib;
    lexer = nunjucks.lexer;
  }

  function _hasTokens(ws, tokens, types) {
    var i;
    var type;
    var tok;
    for (i = 0; i < types.length; i++) {
      type = types[i];
      tok = tokens.nextToken();

      if (!ws) {
        while (tok && tok.type === lexer.TOKEN_WHITESPACE) {
          tok = tokens.nextToken();
        }
      }

      if (Array.isArray(type)) {
        expect(tok.type).toBe(type[0]);
        expect(tok.value).toBe(type[1]);
      } else if (lib.isObject(type)) {
        expect(tok.type).toBe(type.type);
        if (type.value != null) {
          expect(tok.value).toBe(type.value);
        }
        if (type.lineno != null) {
          expect(tok.lineno).toBe(type.lineno);
        }
        if (type.colno != null) {
          expect(tok.colno).toBe(type.colno);
        }
      } else {
        expect(tok.type).toBe(type);
      }
    }
  }

  function hasTokens(tokens /* , types */) {
    return _hasTokens(false, tokens, lib.toArray(arguments).slice(1));
  }

  function hasTokensWithWS(tokens /* , types */) {
    return _hasTokens(true, tokens, lib.toArray(arguments).slice(1));
  }

  describe('lexer', function() {
    var tok;
    var tmpl;
    var tokens;

    it('should parse template data', function() {
      tok = lexer.lex('3').nextToken();
      expect(tok.type).toBe(lexer.TOKEN_DATA);
      expect(tok.value).toBe('3');

      tmpl = 'foo bar bizzle 3 [1,2] !@#$%^&*()<>?:"{}|';
      tok = lexer.lex(tmpl).nextToken();
      expect(tok.type).toBe(lexer.TOKEN_DATA);
      expect(tok.value).toBe(tmpl);
    });

    it('should keep track of whitespace', function() {
      tokens = lexer.lex('data {% 1 2\n   3  %} data');
      hasTokensWithWS(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_BLOCK_START,
        [lexer.TOKEN_WHITESPACE, ' '],
        lexer.TOKEN_INT,
        [lexer.TOKEN_WHITESPACE, ' '],
        lexer.TOKEN_INT,
        [lexer.TOKEN_WHITESPACE, '\n   '],
        lexer.TOKEN_INT,
        [lexer.TOKEN_WHITESPACE, '  '],
        lexer.TOKEN_BLOCK_END,
        lexer.TOKEN_DATA);
    });

    it('should trim blocks', function() {
      tokens = lexer.lex('  {% if true %}\n    foo\n  {% endif %}\n', {
        trimBlocks: true
      });
      hasTokens(tokens,
        [lexer.TOKEN_DATA, '  '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BOOLEAN,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, '    foo\n  '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END);
    });

    it('should trim windows-style CRLF line endings after blocks', function() {
      tokens = lexer.lex('  {% if true %}\r\n    foo\r\n  {% endif %}\r\n', {
        trimBlocks: true
      });
      hasTokens(tokens,
        [lexer.TOKEN_DATA, '  '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BOOLEAN,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, '    foo\r\n  '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END);
    });

    it('should not trim CR after blocks', function() {
      tokens = lexer.lex('  {% if true %}\r    foo\r\n  {% endif %}\r', {
        trimBlocks: true
      });
      hasTokens(tokens,
        [lexer.TOKEN_DATA, '  '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BOOLEAN,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, '\r    foo\r\n  '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, '\r']);
    });

    it('should lstrip and trim blocks', function() {
      tokens = lexer.lex('test\n {% if true %}\n  foo\n {% endif %}\n</div>', {
        lstripBlocks: true,
        trimBlocks: true
      });
      hasTokens(tokens,
        [lexer.TOKEN_DATA, 'test\n'],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BOOLEAN,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, '  foo\n'],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, '</div>']);
    });

    it('should lstrip and not collapse whitespace between blocks', function() {
      tokens = lexer.lex('   {% t %} {% t %}', {
        lstripBlocks: true
      });
      hasTokens(tokens,
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END,
        [lexer.TOKEN_DATA, ' '],
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END);
    });


    it('should parse variable start and end', function() {
      tokens = lexer.lex('data {{ foo }} bar bizzle');
      hasTokens(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_VARIABLE_END,
        lexer.TOKEN_DATA);
    });

    it('should treat the non-breaking space as valid whitespace', function() {
      tokens = lexer.lex('{{\u00A0foo }}');
      tok = tokens.nextToken();
      tok = tokens.nextToken();
      tok = tokens.nextToken();
      expect(tok.type).toBe(lexer.TOKEN_SYMBOL);
      expect(tok.value).toBe('foo');
    });

    it('should parse block start and end', function() {
      tokens = lexer.lex('data {% foo %} bar bizzle');
      hasTokens(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_BLOCK_END,
        lexer.TOKEN_DATA);
    });

    it('should parse basic types', function() {
      tokens = lexer.lex('{{ 3 4.5 true false none foo "hello" \'boo\' r/regex/ }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_INT,
        lexer.TOKEN_FLOAT,
        lexer.TOKEN_BOOLEAN,
        lexer.TOKEN_BOOLEAN,
        lexer.TOKEN_NONE,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_STRING,
        lexer.TOKEN_STRING,
        lexer.TOKEN_REGEX,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse function calls', function() {
      tokens = lexer.lex('{{ foo(bar) }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        [lexer.TOKEN_SYMBOL, 'foo'],
        lexer.TOKEN_LEFT_PAREN,
        [lexer.TOKEN_SYMBOL, 'bar'],
        lexer.TOKEN_RIGHT_PAREN,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse groups', function() {
      tokens = lexer.lex('{{ (1, 2, 3) }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_LEFT_PAREN,
        lexer.TOKEN_INT,
        lexer.TOKEN_COMMA,
        lexer.TOKEN_INT,
        lexer.TOKEN_COMMA,
        lexer.TOKEN_INT,
        lexer.TOKEN_RIGHT_PAREN,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse arrays', function() {
      tokens = lexer.lex('{{ [1, 2, 3] }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_LEFT_BRACKET,
        lexer.TOKEN_INT,
        lexer.TOKEN_COMMA,
        lexer.TOKEN_INT,
        lexer.TOKEN_COMMA,
        lexer.TOKEN_INT,
        lexer.TOKEN_RIGHT_BRACKET,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse dicts', function() {
      tokens = lexer.lex('{{ {one:1, "two":2} }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_LEFT_CURLY,
        [lexer.TOKEN_SYMBOL, 'one'],
        lexer.TOKEN_COLON,
        [lexer.TOKEN_INT, '1'],
        lexer.TOKEN_COMMA,
        [lexer.TOKEN_STRING, 'two'],
        lexer.TOKEN_COLON,
        [lexer.TOKEN_INT, '2'],
        lexer.TOKEN_RIGHT_CURLY,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse blocks without whitespace', function() {
      tokens = lexer.lex('data{{hello}}{%if%}data');
      hasTokens(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_VARIABLE_START,
        [lexer.TOKEN_SYMBOL, 'hello'],
        lexer.TOKEN_VARIABLE_END,
        lexer.TOKEN_BLOCK_START,
        [lexer.TOKEN_SYMBOL, 'if'],
        lexer.TOKEN_BLOCK_END,
        lexer.TOKEN_DATA);
    });

    it('should parse filters', function() {
      hasTokens(lexer.lex('{{ foo|bar }}'),
        lexer.TOKEN_VARIABLE_START,
        [lexer.TOKEN_SYMBOL, 'foo'],
        lexer.TOKEN_PIPE,
        [lexer.TOKEN_SYMBOL, 'bar'],
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse operators', function() {
      hasTokens(lexer.lex('{{ 3+3-3*3/3 }}'),
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_VARIABLE_END);

      hasTokens(lexer.lex('{{ 3**4//5 }}'),
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_VARIABLE_END);

      hasTokens(lexer.lex('{{ 3 != 4 == 5 <= 6 >= 7 < 8 > 9 }}'),
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_OPERATOR,
        lexer.TOKEN_INT,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should parse comments', function() {
      tokens = lexer.lex('data data {# comment #} data');
      hasTokens(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_COMMENT,
        lexer.TOKEN_DATA);
    });

    it('should allow changing the variable start and end', function() {
      tokens = lexer.lex('data {= var =}', {
        tags: {
          variableStart: '{=',
          variableEnd: '=}'
        }
      });
      hasTokens(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should allow changing the block start and end', function() {
      tokens = lexer.lex('{= =}', {
        tags: {
          blockStart: '{=',
          blockEnd: '=}'
        }
      });
      hasTokens(tokens,
        lexer.TOKEN_BLOCK_START,
        lexer.TOKEN_BLOCK_END);
    });

    it('should allow changing the variable start and end', function() {
      tokens = lexer.lex('data {= var =}', {
        tags: {
          variableStart: '{=',
          variableEnd: '=}'
        }
      });
      hasTokens(tokens,
        lexer.TOKEN_DATA,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should allow changing the comment start and end', function() {
      tokens = lexer.lex('<!-- A comment! -->', {
        tags: {
          commentStart: '<!--',
          commentEnd: '-->'
        }
      });
      hasTokens(tokens,
        lexer.TOKEN_COMMENT);
    });

    /**
     * Test that this bug is fixed: https://github.com/mozilla/nunjucks/issues/235
     */
    it('should have individual lexer tag settings for each environment', function() {
      tokens = lexer.lex('{=', {
        tags: {
          variableStart: '{='
        }
      });
      hasTokens(tokens, lexer.TOKEN_VARIABLE_START);

      tokens = lexer.lex('{{');
      hasTokens(tokens, lexer.TOKEN_VARIABLE_START);

      tokens = lexer.lex('{{', {
        tags: {
          variableStart: '<<<'
        }
      });
      hasTokens(tokens, lexer.TOKEN_DATA);

      tokens = lexer.lex('{{');
      hasTokens(tokens, lexer.TOKEN_VARIABLE_START);
    });

    it('should parse regular expressions', function() {
      tokens = lexer.lex('{{ r/basic regex [a-z]/ }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_REGEX,
        lexer.TOKEN_VARIABLE_END);

      // A more complex regex with escaped slashes.
      tokens = lexer.lex('{{ r/{a*b} \\/regex! [0-9]\\// }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_REGEX,
        lexer.TOKEN_VARIABLE_END);

      // This one has flags.
      tokens = lexer.lex('{{ r/^x/gim }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_REGEX,
        lexer.TOKEN_VARIABLE_END);

      // This one has a valid flag then an invalid flag.
      tokens = lexer.lex('{{ r/x$/iv }}');
      hasTokens(tokens,
        lexer.TOKEN_VARIABLE_START,
        lexer.TOKEN_REGEX,
        lexer.TOKEN_SYMBOL,
        lexer.TOKEN_VARIABLE_END);
    });

    it('should keep track of token positions', function() {
      hasTokens(lexer.lex('{{ 3 != 4 == 5 <= 6 >= 7 < 8 > 9 }}'),
        {
          type: lexer.TOKEN_VARIABLE_START,
          lineno: 0,
          colno: 0,
        },
        {
          type: lexer.TOKEN_INT,
          value: '3',
          lineno: 0,
          colno: 3,
        },
        {
          type: lexer.TOKEN_OPERATOR,
          value: '!=',
          lineno: 0,
          colno: 5,
        },
        {
          type: lexer.TOKEN_INT,
          value: '4',
          lineno: 0,
          colno: 8,
        },
        {
          type: lexer.TOKEN_OPERATOR,
          value: '==',
          lineno: 0,
          colno: 10,
        },
        {
          type: lexer.TOKEN_INT,
          value: '5',
          lineno: 0,
          colno: 13,
        },
        {
          type: lexer.TOKEN_OPERATOR,
          value: '<=',
          lineno: 0,
          colno: 15,
        },
        {
          type: lexer.TOKEN_INT,
          value: '6',
          lineno: 0,
          colno: 18,
        },
        {
          type: lexer.TOKEN_OPERATOR,
          lineno: 0,
          colno: 20,
          value: '>=',
        },
        {
          type: lexer.TOKEN_INT,
          lineno: 0,
          colno: 23,
          value: '7',
        },
        {
          type: lexer.TOKEN_OPERATOR,
          value: '<',
          lineno: 0,
          colno: 25,
        },
        {
          type: lexer.TOKEN_INT,
          value: '8',
          lineno: 0,
          colno: 27,
        },
        {
          type: lexer.TOKEN_OPERATOR,
          value: '>',
          lineno: 0,
          colno: 29,
        },
        {
          type: lexer.TOKEN_INT,
          value: '9',
          lineno: 0,
          colno: 31,
        },
        {
          type: lexer.TOKEN_VARIABLE_END,
          lineno: 0,
          colno: 33,
        });

      hasTokens(lexer.lex('{% if something %}{{ value }}{% else %}{{ otherValue }}{% endif %}'),
        {
          type: lexer.TOKEN_BLOCK_START,
          lineno: 0,
          colno: 0,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'if',
          lineno: 0,
          colno: 3,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'something',
          lineno: 0,
          colno: 6,
        },
        {
          type: lexer.TOKEN_BLOCK_END,
          lineno: 0,
          colno: 16,
        },
        {
          type: lexer.TOKEN_VARIABLE_START,
          lineno: 0,
          colno: 18,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'value',
          lineno: 0,
          colno: 21,
        },
        {
          type: lexer.TOKEN_VARIABLE_END,
          lineno: 0,
          colno: 27,
        },
        {
          type: lexer.TOKEN_BLOCK_START,
          lineno: 0,
          colno: 29,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'else',
          lineno: 0,
          colno: 32,
        },
        {
          type: lexer.TOKEN_BLOCK_END,
          lineno: 0,
          colno: 37,
        },
        {
          type: lexer.TOKEN_VARIABLE_START,
          lineno: 0,
          colno: 39,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'otherValue',
          lineno: 0,
          colno: 42,
        },
        {
          type: lexer.TOKEN_VARIABLE_END,
          lineno: 0,
          colno: 53,
        },
        {
          type: lexer.TOKEN_BLOCK_START,
          lineno: 0,
          colno: 55,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'endif',
          lineno: 0,
          colno: 58,
        },
        {
          type: lexer.TOKEN_BLOCK_END,
          lineno: 0,
          colno: 64,
        });

      hasTokens(lexer.lex('{% if something %}\n{{ value }}\n{% else %}\n{{ otherValue }}\n{% endif %}'),
        {
          type: lexer.TOKEN_BLOCK_START,
          lineno: 0,
          colno: 0,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'if',
          lineno: 0,
          colno: 3,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'something',
          lineno: 0,
          colno: 6,
        },
        {
          type: lexer.TOKEN_BLOCK_END,
          lineno: 0,
          colno: 16,
        },
        {
          type: lexer.TOKEN_DATA,
          value: '\n',
        },
        {
          type: lexer.TOKEN_VARIABLE_START,
          lineno: 1,
          colno: 0,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'value',
          lineno: 1,
          colno: 3,
        },
        {
          type: lexer.TOKEN_VARIABLE_END,
          lineno: 1,
          colno: 9,
        },
        {
          type: lexer.TOKEN_DATA,
          value: '\n',
        },
        {
          type: lexer.TOKEN_BLOCK_START,
          lineno: 2,
          colno: 0,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'else',
          lineno: 2,
          colno: 3,
        },
        {
          type: lexer.TOKEN_BLOCK_END,
          lineno: 2,
          colno: 8,
        },
        {
          type: lexer.TOKEN_DATA,
          value: '\n',
        },
        {
          type: lexer.TOKEN_VARIABLE_START,
          lineno: 3,
          colno: 0,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'otherValue',
          lineno: 3,
          colno: 3,
        },
        {
          type: lexer.TOKEN_VARIABLE_END,
          lineno: 3,
          colno: 14,
        },
        {
          type: lexer.TOKEN_DATA,
          value: '\n',
        },
        {
          type: lexer.TOKEN_BLOCK_START,
          lineno: 4,
          colno: 0,
        },
        {
          type: lexer.TOKEN_SYMBOL,
          value: 'endif',
          lineno: 4,
          colno: 3,
        },
        {
          type: lexer.TOKEN_BLOCK_END,
          lineno: 4,
          colno: 9,
        });
    });

    // it("Should handle all the bizarre ways the lexer could error", function () {
    //   /**
    //   * Prefix sweep: lex every prefix of every corpus entry and assert the
    //   * invariants a language server depends on.
    //   *
    //   *   1. no throw          - a half-typed file must not crash the server
    //   *   2. no infinite loop  - every token must consume at least one char
    //   *   3. spans tile        - token[n].start === token[n-1].end, no gaps/overlaps
    //   *   4. in bounds         - 0 <= start <= end <= source.length
    //   *   5. full coverage     - the last token ends exactly at source.length
    //   *
    //   * Invariant 3 is the load-bearing one: it means offset -> token lookup can
    //   * never land in a hole, which is what completion does on every keystroke.
    //   *
    //   * Usage:  node prefix-sweep.js [path-to-lexer]
    //   */

    //   // Each entry is [label, source, opts]. Add project templates here as you
    //   // find bugs - a failing template makes a permanent regression test.
    //   const CORPUS = [
    //     ['basic output',
    //       '<h1>{{ title }}</h1>'],

    //     ['member + filter',
    //       '{{ post.data.title | upper | truncate(20) }}'],

    //     ['for loop',
    //       '{% for post in collections.posts %}\n  <a href="{{ post.url }}">{{ post.data.title }}</a>\n{% endfor %}'],

    //     ['comment',
    //       'before {# a note #} after'],

    //     ['include + extends',
    //       '{% extends "base.njk" %}\n{% block content %}hi{% endblock %}\n{% include "partials/foot.njk" %}'],

    //     ['dict and array literals',
    //       '{% set cfg = {a: 1, b: [2, 3], c: "x"} %}{{ cfg.b[0] }}'],

    //     ['inline if / is / not in',
    //       '{{ page.url if page else "" }}{{ x is defined }}{{ a not in b }}'],

    //     ['strings with escapes',
    //       `{{ "a\\"b" ~ 'c\\nd' }}`],

    //     ['whitespace control',
    //       '{%- if x -%}\n  {{- y -}}\n{%- endif -%}'],

    //     ['crlf line endings',
    //       '{% if x %}\r\n  {{ y }}\r\n{% endif %}'],

    //     ['astral char',
    //       '{{ "\u{1F600}" }} tail'],

    //     ['nested quotes in path',
    //       `{% include "a/b-c.njk" ignore missing %}`],

    //     ['operators',
    //       '{{ (a + b) * c // d ** e % f == g and not h }}'],

    //     ['adjacent holes',
    //       '{{a}}{{b}}{%if c%}{%endif%}{#x#}'],

    //     ['trailing text',
    //       '{% if x %}body{% endif %}trailing text with no tag'],
    //   ];

    //   const OPTS = [
    //     ['default', {}],
    //     ['trimBlocks', { trimBlocks: true }],
    //     ['lstripBlocks', { lstripBlocks: true }],
    //     ['both', { trimBlocks: true, lstripBlocks: true }],
    //   ];

    //   const MAX_TOKENS = 10000;

    //   function sweepOne(src, opts) {
    //     const t = lexer.lex(src, opts);
    //     const toks = [];
    //     let tok;

    //     try {
    //       while ((tok = t.nextToken())) {
    //         toks.push(tok);
    //         if (toks.length > MAX_TOKENS) {
    //           return { reason: 'infinite loop (token cap hit)', toks };
    //         }
    //       }
    //     } catch (e) {
    //       return { reason: `throw: ${e.message}`, toks };
    //     }

    //     let cursor = 0;
    //     for (const k of toks) {
    //       if (k.start === undefined || k.end === undefined) {
    //         return { reason: `token missing start/end (${k.type})`, toks };
    //       }
    //       if (k.start !== cursor) {
    //         return {
    //           reason: k.start > cursor
    //             ? `gap: ${cursor}..${k.start} uncovered before ${k.type}`
    //             : `overlap: ${k.type} starts at ${k.start}, previous ended ${cursor}`,
    //           toks,
    //         };
    //       }
    //       if (k.end < k.start) {
    //         return { reason: `inverted span on ${k.type}: ${k.start}..${k.end}`, toks };
    //       }
    //       if (k.end === k.start) {
    //         return { reason: `zero-width token ${k.type} at ${k.start}`, toks };
    //       }
    //       if (k.end > src.length) {
    //         return { reason: `out of bounds: ${k.type} end=${k.end} len=${src.length}`, toks };
    //       }
    //       cursor = k.end;
    //     }

    //     if (cursor !== src.length) {
    //       return { reason: `tail uncovered: stopped at ${cursor}, len ${src.length}`, toks };
    //     }

    //     return null;
    //   }

    //   function run() {
    //     let checked = 0;
    //     const failures = [];

    //     for (const [label, src] of CORPUS) {
    //       for (const [optLabel, opts] of OPTS) {
    //         // Group failures by reason so one root cause doesn't print 60 times.
    //         const byReason = new Map();

    //         for (let i = 0; i <= src.length; i++) {
    //           checked++;
    //           const prefix = src.slice(0, i);
    //           const fail = sweepOne(prefix, opts);
    //           if (!fail) continue;
    //           if (!byReason.has(fail.reason)) {
    //             byReason.set(fail.reason, { count: 0, first: i, prefix, toks: fail.toks });
    //           }
    //           byReason.get(fail.reason).count++;
    //         }

    //         for (const [reason, info] of byReason) {
    //           failures.push({ label, optLabel, reason, ...info });
    //         }
    //       }
    //     }

    //     for (const f of failures) {
    //       console.log(`FAIL  ${f.label} [${f.optLabel}]`);
    //       console.log(`      ${f.reason}`);
    //       console.log(`      ${f.count} prefix(es); first at length ${f.first}`);
    //       console.log(`      input: ${JSON.stringify(f.prefix)}`);
    //       if (f.toks && f.toks.length) {
    //         const tail = f.toks.slice(-4);
    //         for (const k of tail) {
    //           console.log(`        ${String(k.type).padEnd(15)} ${JSON.stringify(k.value)}  [${k.start},${k.end})`);
    //         }
    //       }
    //       console.log('');
    //     }

    //     const label = failures.length ? 'FAILED' : 'PASSED';
    //     console.log(`${label}: ${checked} prefixes checked, ${failures.length} distinct failure(s)`);
    //     return failures.length === 0 ? 0 : 1;
    //   }
    // })
  });
}());
