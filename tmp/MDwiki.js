;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){3,} *\n*/,
  blockquote: /^( *>[^\n]+(\n[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment|closed|closing) *(?:\n{2,}|\s*$)/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', /\n+(?=(?: *[-*_]){3,} *(?:\n+|$))/)
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

/**
 * Normal Block Grammar
 */

block.normal = merge({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = merge({}, block.normal, {
  fences: /^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/,
  paragraph: /^/
});

block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!' + block.gfm.fences.source.replace('\\1', '\\2') + '|')
  ();

/**
 * GFM + Tables Block Grammar
 */

block.tables = merge({}, block.gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || marked.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top) {
  var src = src.replace(/^ +$/gm, '')
    , next
    , loose
    , cap
    , bull
    , b
    , item
    , space
    , i
    , l;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        });
      }
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, '');
      this.tokens.push({
        type: 'code',
        text: !this.options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap
      });
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        lang: cap[2],
        text: cap[3]
      });
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      });
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr'
      });
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top);

      this.tokens.push({
        type: 'blockquote_end'
      });

      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      src = src.substring(cap[0].length);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i+1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item[item.length-1] === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose
            ? 'loose_item_start'
            : 'list_item_start'
        });

        // Recurse.
        this.token(item, false);

        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });

      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script',
        text: cap[0]
      });
      continue;
    }

    // def
    if (top && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1][cap[1].length-1] === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?(.*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || marked.defaults;
  this.links = links;
  this.rules = inline.normal;

  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src) {
  var out = ''
    , link
    , text
    , href
    , cap;

  while (src) {
    // escape
    if (cap = this.rules.escape.exec(src)) {
      src = src.substring(cap[0].length);
      out += cap[1];
      continue;
    }

    // autolink
    if (cap = this.rules.autolink.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[2] === '@') {
        text = cap[1][6] === ':'
          ? this.mangle(cap[1].substring(7))
          : this.mangle(cap[1]);
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      out += '<a href="'
        + href
        + '">'
        + text
        + '</a>';
      continue;
    }

    // url (gfm)
    if (cap = this.rules.url.exec(src)) {
      src = src.substring(cap[0].length);
      text = escape(cap[1]);
      href = text;
      out += '<a href="'
        + href
        + '">'
        + text
        + '</a>';
      continue;
    }

    // tag
    if (cap = this.rules.tag.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.options.sanitize
        ? escape(cap[0])
        : cap[0];
      continue;
    }

    // link
    if (cap = this.rules.link.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      });
      continue;
    }

    // reflink, nolink
    if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out += cap[0][0];
        src = cap[0].substring(1) + src;
        continue;
      }
      out += this.outputLink(cap, link);
      continue;
    }

    // strong
    if (cap = this.rules.strong.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<strong>'
        + this.output(cap[2] || cap[1])
        + '</strong>';
      continue;
    }

    // em
    if (cap = this.rules.em.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<em>'
        + this.output(cap[2] || cap[1])
        + '</em>';
      continue;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<code>'
        + escape(cap[2], true)
        + '</code>';
      continue;
    }

    // br
    if (cap = this.rules.br.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<br>';
      continue;
    }

    // del (gfm)
    if (cap = this.rules.del.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<del>'
        + this.output(cap[1])
        + '</del>';
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      src = src.substring(cap[0].length);
      out += escape(cap[0]);
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  if (cap[0][0] !== '!') {
    return '<a href="'
      + escape(link.href)
      + '"'
      + (link.title
      ? ' title="'
      + escape(link.title)
      + '"'
      : '')
      + '>'
      + this.output(cap[1])
      + '</a>';
  } else {
    return '<img src="'
      + escape(link.href)
      + '" alt="'
      + escape(cap[1])
      + '"'
      + (link.title
      ? ' title="'
      + escape(link.title)
      + '"'
      : '')
      + '>';
  }
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    .replace(/--/g, '—')
    .replace(/'([^']*)'/g, '‘$1’')
    .replace(/"([^"]*)"/g, '“$1”')
    .replace(/\.{3}/g, '…');
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || marked.defaults;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options) {
  var parser = new Parser(options);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options);
  this.tokens = src.reverse();

  var out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length-1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
  switch (this.token.type) {
    case 'space': {
      return '';
    }
    case 'hr': {
      return '<hr>\n';
    }
    case 'heading': {
      return '<h'
        + this.token.depth
        + '>'
        + this.inline.output(this.token.text)
        + '</h'
        + this.token.depth
        + '>\n';
    }
    case 'code': {
      if (this.options.highlight) {
        var code = this.options.highlight(this.token.text, this.token.lang);
        if (code != null && code !== this.token.text) {
          this.token.escaped = true;
          this.token.text = code;
        }
      }

      if (!this.token.escaped) {
        this.token.text = escape(this.token.text, true);
      }

      return '<pre><code'
        + (this.token.lang
        ? ' class="'
        + this.options.langPrefix
        + this.token.lang
        + '"'
        : '')
        + '>'
        + this.token.text
        + '</code></pre>\n';
    }
    case 'table': {
      var body = ''
        , heading
        , i
        , row
        , cell
        , j;

      // header
      body += '<thead>\n<tr>\n';
      for (i = 0; i < this.token.header.length; i++) {
        heading = this.inline.output(this.token.header[i]);
        body += this.token.align[i]
          ? '<th align="' + this.token.align[i] + '">' + heading + '</th>\n'
          : '<th>' + heading + '</th>\n';
      }
      body += '</tr>\n</thead>\n';

      // body
      body += '<tbody>\n'
      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];
        body += '<tr>\n';
        for (j = 0; j < row.length; j++) {
          cell = this.inline.output(row[j]);
          body += this.token.align[j]
            ? '<td align="' + this.token.align[j] + '">' + cell + '</td>\n'
            : '<td>' + cell + '</td>\n';
        }
        body += '</tr>\n';
      }
      body += '</tbody>\n';

      return '<table>\n'
        + body
        + '</table>\n';
    }
    case 'blockquote_start': {
      var body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return '<blockquote>\n'
        + body
        + '</blockquote>\n';
    }
    case 'list_start': {
      var type = this.token.ordered ? 'ol' : 'ul'
        , body = '';

      while (this.next().type !== 'list_end') {
        body += this.tok();
      }

      return '<'
        + type
        + '>\n'
        + body
        + '</'
        + type
        + '>\n';
    }
    case 'list_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text'
          ? this.parseText()
          : this.tok();
      }

      return '<li>'
        + body
        + '</li>\n';
    }
    case 'loose_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return '<li>'
        + body
        + '</li>\n';
    }
    case 'html': {
      return !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text;
    }
    case 'paragraph': {
      return '<p>'
        + this.inline.output(this.token.text)
        + '</p>\n';
    }
    case 'text': {
      return '<p>'
        + this.parseText()
        + '</p>\n';
    }
  }
};

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}

/**
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    if (opt) opt = merge({}, marked.defaults, opt);

    var tokens = Lexer.lex(tokens, opt)
      , highlight = opt.highlight
      , pending = 0
      , l = tokens.length
      , i = 0;

    if (!highlight || highlight.length < 3) {
      return callback(null, Parser.parse(tokens, opt));
    }

    var done = function() {
      delete opt.highlight;
      var out = Parser.parse(tokens, opt);
      opt.highlight = highlight;
      return callback(null, out);
    };

    for (; i < l; i++) {
      (function(token) {
        if (token.type !== 'code') return;
        pending++;
        return highlight(token.text, token.lang, function(err, code) {
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-'
};

/**
 * Expose
 */

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

if (typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.marked = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

(function($) {
    'use strict';

    // hide the whole page so we dont see the DOM flickering
    // will be shown upon page load complete or error
    $('html').addClass('md-hidden-load');

    $.md = {};
    // the location of the main markdown file we display
    $.md.mainHref = '';

    // the in-page anchor that is specified after the !
    $.md.inPageAnchor = '';

}(jQuery));

var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var MDwiki;
(function (MDwiki) {
    var Links;
    (function (Links) {
        var LinkRewriter = (function () {
            function LinkRewriter(domElement) {
                this.domElement = $(domElement);
            }
            LinkRewriter.processPageLinks = function (domElement, baseUrl) {
                var html = $(domElement);
                if (baseUrl === undefined) {
                    baseUrl = '';
                }
                html.find('a').not('#md-menu a').filter(function () {
                    var $this = $(this);
                    var attr = $this.attr('href');
                    if (!attr || attr.length === 0)
                        $this.removeAttr('href');
                });
                html.find('a, img').each(function (i, e) {
                    var link = $(e);
                    var isImage = false;
                    var hrefAttribute = 'href';
                    if (!link.attr(hrefAttribute)) {
                        isImage = true;
                        hrefAttribute = 'src';
                    }
                    var href = link.attr(hrefAttribute);
                    if (href && href.lastIndexOf('#!') >= 0)
                        return;
                    if (!isImage && href.startsWith('#') && !href.startsWith('#!')) {
                        link.click(function (ev) {
                            ev.preventDefault();
                            console.log("inpage anchors not yet implemented");
                        });
                    }
                    if (!MDwiki.Utils.Url.isRelativeUrl(href))
                        return;
                    if (isImage && !MDwiki.Utils.Url.isRelativePath(href))
                        return;
                    if (!isImage && MDwiki.Utils.Url.isGimmickLink(link))
                        return;
                    function build_link(url) {
                        if (MDwiki.Utils.Url.hasMarkdownFileExtension(url))
                            return '#!' + url;
                        else
                            return url;
                    }
                    var newHref = baseUrl + href;
                    if (isImage)
                        link.attr(hrefAttribute, newHref);
                    else if (MDwiki.Utils.Url.isRelativePath(href))
                        link.attr(hrefAttribute, build_link(newHref));
                    else
                        link.attr(hrefAttribute, build_link(href));
                });
            };
            return LinkRewriter;
        }());
        Links.LinkRewriter = LinkRewriter;
    })(Links = MDwiki.Links || (MDwiki.Links = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Legacy;
    (function (Legacy) {
        var PageSkeleton = (function () {
            function PageSkeleton(config, domElement) {
                this.domElement = $(domElement);
                this.config = config;
            }
            PageSkeleton.prototype.createBasicSkeleton = function () {
                this.setPageTitle();
                this.wrapParagraphText();
                this.linkImagesToSelf();
                this.groupImages();
                this.removeBreaks();
                this.addInpageAnchors();
                return;
            };
            PageSkeleton.prototype.setPageTitle = function () {
                var title = this.config.title;
                var $pageTitle = this.domElement.find('h1').eq(0);
                if ($.trim($pageTitle.toptext()).length > 0) {
                    this.domElement.find('#md-title').prepend($pageTitle);
                    title = $pageTitle.toptext();
                }
                else {
                    this.domElement.find('#md-title').remove();
                }
            };
            PageSkeleton.prototype.wrapParagraphText = function () {
                var self = this;
                this.domElement.find('p').each(function () {
                    var $p = $(this);
                    if ($.trim($p.text()).length === 0) {
                        return;
                    }
                    var image_children = $p.contents().filter(function () {
                        var $child = $(this);
                        if (this.tagName === 'A' && $child.find('img').length > 0) {
                            return true;
                        }
                        if (this.tagName === 'IMG') {
                            return true;
                        }
                        return false;
                    });
                    var templ = new Template('layout/paragraph');
                    var $inserted_node = templ.insertAfter($p);
                    var floatClass = self.getFloatClass($p);
                    if (floatClass == "md-float-left")
                        $inserted_node.find(".md-paragraph-intro").append(image_children);
                    if (floatClass == "md-float-right")
                        $inserted_node.find(".md-paragraph-outro").append(image_children);
                    $inserted_node.find("p").append($p.contents());
                    $p.remove();
                });
            };
            PageSkeleton.prototype.removeBreaks = function () {
                this.domElement.find('.md-floatenv').find('.md-text').each(function () {
                    var $first = $(this).find('*').eq(0);
                    if ($first.is('br')) {
                        $first.remove();
                    }
                });
                this.domElement.find('.md-image-group').find('br').remove();
            };
            PageSkeleton.prototype.getFloatClass = function (par) {
                var $p = $(par);
                var floatClass = '';
                var nonTextContents = $p.contents().filter(function () {
                    if (this.tagName === 'IMG' || this.tagName === 'IFRAME') {
                        return true;
                    }
                    else if (this.tagName === 'A') {
                        return $(this).find('img').length > 0;
                    }
                    else {
                        return $.trim($(this).text()).length > 0;
                    }
                });
                var elem = nonTextContents[0];
                if (elem !== undefined && elem !== null) {
                    if (elem.tagName === 'IMG' || elem.tagName === 'IFRAME') {
                        floatClass = 'md-float-left';
                    }
                    else if (elem.tagName === 'A' && $(elem).find('img').length > 0) {
                        floatClass = 'md-float-left';
                    }
                    else {
                        floatClass = 'md-float-right';
                    }
                }
                return floatClass;
            };
            PageSkeleton.prototype.groupImages = function () {
                var par = this.domElement.find('p img').parents('p');
                par.addClass('md-image-group');
            };
            PageSkeleton.prototype.linkImagesToSelf = function () {
                var self = this;
                function selectNonLinkedImages() {
                    $images = self.domElement.find('img').filter(function (index) {
                        var $parent_link = $(this).parents('a').eq(0);
                        if ($parent_link.length === 0)
                            return true;
                        var attr = $parent_link.attr('href');
                        return (attr && attr.length === 0);
                    });
                    return $images;
                }
                var $images = selectNonLinkedImages();
                return $images.each(function () {
                    var $this = $(this);
                    var img_src = $this.attr('src');
                    var img_title = $this.attr('title');
                    if (img_title === undefined) {
                        img_title = '';
                    }
                    $this.wrap('<a class="md-image-selfref" href="' + img_src + '" title="' + img_title + '"/> ');
                });
            };
            PageSkeleton.prototype.addInpageAnchors = function () {
                var config = this.config;
                function addPilcrow($heading, href) {
                    var c = config.anchorCharacter;
                    var $pilcrow = $('<span class="anchor-highlight"><a>' + c + '</a></span>');
                    $pilcrow.find('a').attr('href', href);
                    $pilcrow.hide();
                    var mouse_entered = false;
                    $heading.mouseenter(function () {
                        mouse_entered = true;
                        MDwiki.Utils.Util.wait(300).then(function () {
                            if (!mouse_entered)
                                return;
                            $pilcrow.fadeIn(200).css('display', 'inline');
                        });
                    });
                    $heading.mouseleave(function () {
                        mouse_entered = false;
                        $pilcrow.fadeOut(200);
                    });
                    $pilcrow.appendTo($heading);
                }
                function addJumpLinkToTOC($heading) {
                    var _this = this;
                    if (config.pageMenu && config.pageMenu.disable !== false)
                        return;
                    function supportedHeading(heading) {
                        var autoAnchors = config.pageMenu.useHeadings.split(',');
                        var supported = false;
                        $(autoAnchors).each(function (i, e) {
                            if (heading.toLowerCase() === e.toLowerCase()) {
                                supported = true;
                            }
                        });
                        return supported;
                    }
                    if (!supportedHeading($heading.prop("tagName")))
                        return;
                    var c = config.pageMenu.returnAnchor;
                    if (c === '')
                        return;
                    var $jumpLink = $('<a class="visible-xs visible-sm jumplink" href="#md-page-menu">' + c + '</a>');
                    $jumpLink.click(function (ev) {
                        ev.preventDefault();
                        _this.domElement.find('body').scrollTop(_this.domElement.find('#md-page-menu').position().top);
                    });
                    if ($heading.parents('#md-menu').length === 0) {
                        $jumpLink.insertAfter($heading);
                    }
                }
                this.domElement.find('h1,h2,h3,h4,h5,h6').not('#md-title h1').each(function () {
                    var $heading = $(this);
                    $heading.addClass('md-inpage-anchor');
                    var text = $heading.clone().children('.anchor-highlight').remove().end().text();
                    var href = MDwiki.Utils.Util.getInpageAnchorHref(text);
                    addPilcrow($heading, href);
                    addJumpLinkToTOC($heading);
                });
            };
            return PageSkeleton;
        }());
        Legacy.PageSkeleton = PageSkeleton;
    })(Legacy = MDwiki.Legacy || (MDwiki.Legacy = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Utils;
    (function (Utils) {
        var Url = (function () {
            function Url() {
            }
            Url.isRelativeUrl = function (url) {
                if (!url)
                    return false;
                if (url.indexOf('://') === -1) {
                    return true;
                }
                else {
                    return false;
                }
            };
            Url.isRelativePath = function (path) {
                if (path === undefined)
                    return false;
                if (path.startsWith('/'))
                    return false;
                return true;
            };
            Url.isGimmickLink = function (domAnchor) {
                if (domAnchor.toptext().indexOf('gimmick:') !== -1) {
                    return true;
                }
                else {
                    return false;
                }
            };
            Url.hasMarkdownFileExtension = function (str) {
                if (!str)
                    return false;
                var markdownExtensions = ['.md', '.markdown', '.mdown'];
                var result = false;
                var value = str.toLowerCase().split('#')[0];
                $(markdownExtensions).each(function (i, ext) {
                    if (value.toLowerCase().endsWith(ext)) {
                        result = true;
                    }
                });
                return result;
            };
            return Url;
        }());
        Utils.Url = Url;
        var Util = (function () {
            function Util() {
            }
            Util.wait = function (miliseconds) {
                return $.Deferred(function (dfd) {
                    setTimeout(dfd.resolve, miliseconds);
                });
            };
            Util.prepareLink = function (link, options) {
                options = options || {};
                var ownProtocol = window.location.protocol;
                if (options.forceSSL)
                    return 'https://' + link;
                if (options.forceHTTP)
                    return 'http://' + link;
                if (ownProtocol === 'file:') {
                    return 'http://' + link;
                }
                return '//' + link;
            };
            Util.repeatUntil = function (interval, predicate, maxRepeats) {
                maxRepeats = maxRepeats || 10;
                var dfd = $.Deferred();
                function recursive_repeat(interval, predicate, maxRepeats) {
                    if (maxRepeats === 0) {
                        dfd.reject();
                        return;
                    }
                    if (predicate()) {
                        dfd.resolve();
                        return;
                    }
                    else {
                        Util.wait(interval).always(function () {
                            recursive_repeat(interval, predicate, maxRepeats - 1);
                        });
                    }
                }
                recursive_repeat(interval, predicate, maxRepeats);
                return dfd;
            };
            Util.countDownLatch = function (capacity, min) {
                min = min || 0;
                capacity = (capacity === undefined) ? 1 : capacity;
                var dfd = $.Deferred();
                if (capacity <= min)
                    dfd.resolve();
                dfd.capacity = capacity;
                dfd.countDown = function () {
                    dfd.capacity--;
                    if (dfd.capacity <= min) {
                        dfd.resolve();
                    }
                };
                return dfd;
            };
            Util.getInpageAnchorText = function (text) {
                var subhash = text.replace(/ /g, '_');
                return subhash;
            };
            Util.getInpageAnchorHref = function (text, href) {
                href = href || $.md.mainHref;
                var subhash = this.getInpageAnchorText(text);
                return '#!' + href + '#' + subhash;
            };
            return Util;
        }());
        Utils.Util = Util;
    })(Utils = MDwiki.Utils || (MDwiki.Utils = {}));
})(MDwiki || (MDwiki = {}));
if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) === str;
    };
}
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (str) {
        return this.slice(this.length - str.length, this.length) === str;
    };
}
$.fn.extend({
    toptext: function () {
        return this.clone().children().remove().end().text();
    }
});
$.expr[':'].icontains = $.expr.createPseudo(function (arg) {
    return function (elem) {
        return $(elem).toptext().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
    };
});
var MDwiki;
(function (MDwiki) {
    var Templating;
    (function (Templating) {
        var Template = (function () {
            function Template(path) {
                this.model = {};
                if (path) {
                    while (path.startsWith('/'))
                        path = path.substring(1, path.length);
                    path = path + ".html";
                    this.templateFunction = Handlebars.templates[path];
                }
            }
            Template.prototype.render = function () {
                this.renderedTemplate = this.templateFunction(this.model);
                return this.renderedTemplate;
            };
            Template.prototype.assertTemplateIsReady = function () {
                if (!this.renderedTemplate)
                    return this.render();
            };
            Template.prototype.replace = function (node) {
                this.assertTemplateIsReady();
                var rendered_template = $(this.renderedTemplate);
                $(node).replaceWith(rendered_template);
                return rendered_template;
            };
            Template.prototype.appendTo = function (node) {
                this.assertTemplateIsReady();
                return $(this.renderedTemplate).appendTo($(node));
            };
            Template.prototype.insertAfter = function (node) {
                this.assertTemplateIsReady();
                return $(this.renderedTemplate).insertAfter(node);
            };
            Template.prototype.insertBefore = function (node) {
                this.assertTemplateIsReady();
                return $(this.renderedTemplate).insertBefore(node);
            };
            return Template;
        }());
        Templating.Template = Template;
    })(Templating = MDwiki.Templating || (MDwiki.Templating = {}));
})(MDwiki || (MDwiki = {}));
var util = MDwiki.Utils.Util;
var Template = MDwiki.Templating.Template;
var MDwiki;
(function (MDwiki) {
    var Legacy;
    (function (Legacy) {
        var Bootstrap = (function () {
            function Bootstrap(stages, config) {
                this.events = [];
                this.stages = stages;
                this.config = config;
            }
            Bootstrap.prototype.bootstrapify = function () {
                var _this = this;
                this.parseHeader();
                this.createPageSkeleton();
                this.buildMenu();
                this.changeHeading();
                this.replaceImageParagraphs();
                $('table').addClass('table').addClass('table-bordered');
                this.stages.getStage('pregimmick').subscribe(function (done) {
                    if (_this.config.useSideMenu !== false) {
                        _this.createPageContentMenu();
                    }
                    _this.addFooter();
                    _this.addAdditionalFooterText();
                    done();
                });
                this.stages.getStage('postgimmick').subscribe(function (done) {
                    _this.adjustExternalContent();
                    _this.highlightActiveLink();
                    done();
                });
            };
            Bootstrap.prototype.bind = function (ev, func) {
                $(document).bind(ev, func);
                this.events.push(ev);
            };
            Bootstrap.prototype.trigger = function (ev) {
                $(document).trigger(ev);
            };
            Bootstrap.prototype.parseHeader = function () {
                if (!this.config.parseHeader)
                    return;
                var parsedHeaders = {};
                var header = $('#md-content > pre:first-child');
                header.hide();
                var headerLines = header.text().split("\n");
                $.each(headerLines, function (n, elem) {
                    elem = elem.split(':', 2);
                    if (elem.length === 2) {
                        parsedHeaders[elem[0].trim()] = elem[1].trim();
                    }
                });
                parsedHeaders.title = parsedHeaders.title || $('#md-title h1').text();
                if (parsedHeaders.title) {
                    document.title = parsedHeaders.title;
                    $('meta[name=subject]').attr('content', parsedHeaders.title);
                }
                if (parsedHeaders.author)
                    $('meta[name=author]').attr('content', parsedHeaders.author);
                if (parsedHeaders.description)
                    $('meta[name=description]').attr('content', parsedHeaders.description);
                if (parsedHeaders.copyright)
                    $('meta[name=copyright]').attr('content', parsedHeaders.copyright);
                if (parsedHeaders.keywords)
                    $('meta[name=keywords]').attr('content', parsedHeaders.keywords);
                $('meta[name=generator]').attr('content', 'mdwiki');
            };
            Bootstrap.prototype.buildTopNav = function () {
                var _this = this;
                if ($('#md-menu').length <= 0) {
                    return;
                }
                var $menuContent = $('#md-menu').children();
                var navbar = new Template("navigation/navbar");
                navbar.appendTo('#md-menu');
                $('#md-menu ul.nav').eq(0).append($menuContent);
                $('#md-menu').prependTo('#md-all');
                var brand_text = $('#md-menu h1').toptext();
                $('#md-menu h1').remove();
                $('a.navbar-brand').text(brand_text);
                $('#md-body').css('margin-top', '70px');
                this.stages.getStage('pregimmick').subscribe(function (done) {
                    _this.check_offset_to_navbar();
                    done();
                });
            };
            Bootstrap.prototype.set_offset_to_navbar = function () {
                var height = $('#md-main-navbar').height() + 10;
                $('#md-body').css('margin-top', height + 'px');
            };
            Bootstrap.prototype.check_offset_to_navbar = function () {
                var _this = this;
                var navbar_height = 0;
                var dfd1 = util.repeatUntil(40, function () {
                    navbar_height = $('#md-main-navbar').height();
                    return (navbar_height > 35) && (navbar_height < 481);
                }, 25);
                dfd1.done(function () {
                    navbar_height = $('#md-main-navbar').height();
                    _this.set_offset_to_navbar();
                    var dfd2 = util.repeatUntil(20, function () {
                        return navbar_height !== $('#md-main-navbar').height();
                    }, 25);
                    dfd2.done(function () {
                        _this.set_offset_to_navbar();
                    });
                    util.wait(2000).done(function () {
                        _this.set_offset_to_navbar();
                    });
                });
            };
            Bootstrap.prototype.buildMenu = function () {
                if ($('#md-menu a').length === 0) {
                    return;
                }
                var h = $('#md-menu');
                h.find('> a[href=""]')
                    .attr('data-toggle', 'dropdown')
                    .addClass('dropdown-toggle')
                    .attr('href', '')
                    .append('<b class="caret"/>');
                h.find('ul').addClass('dropdown-menu');
                h.find('ul li').addClass('dropdown');
                $('#md-menu hr').each(function (i, e) {
                    var hr = $(e);
                    var prev = hr.prev();
                    var next = hr.next();
                    if (prev.is('ul') && prev.length >= 0) {
                        prev.append($('<li class="divider"/>'));
                        hr.remove();
                        if (next.is('ul')) {
                            next.find('li').appendTo(prev);
                            next.remove();
                        }
                    }
                    return;
                });
                $('#md-menu ul').each(function (i, e) {
                    var ul = $(e);
                    if (ul.find('li').length === 0) {
                        ul.remove();
                    }
                });
                $('#md-menu hr').replaceWith($('<li class="divider-vertical"/>'));
                $('#md-menu > a').wrap('<li />');
                $('#md-menu ul').each(function (i, e) {
                    var ul = $(e);
                    ul.appendTo(ul.prev());
                    ul.parent('li').addClass('dropdown');
                });
                $('#md-menu li.dropdown').find('h1, h2, h3').each(function (i, e) {
                    var $e = $(e);
                    var text = $e.toptext();
                    var header = $('<li class="dropdown-header" />');
                    header.text(text);
                    $e.replaceWith(header);
                });
                this.buildTopNav();
            };
            Bootstrap.prototype.isVisibleInViewport = function (e) {
                var el = $(e);
                var top = $(window).scrollTop();
                var bottom = top + $(window).height();
                var eltop = el.offset().top;
                var elbottom = eltop + el.height();
                return (elbottom <= bottom) && (eltop >= top);
            };
            Bootstrap.prototype.createPageContentMenu = function () {
                var _this = this;
                var $headings = $('#md-content').find(this.config.pageMenu.useHeadings);
                $headings.children().remove();
                if ($headings.length <= 1) {
                    return;
                }
                $('#md-content').removeClass('col-md-12');
                $('#md-content').addClass('col-md-9');
                $('#md-content-row').prepend('<div class="col-md-3" id="md-left-column"/>');
                var recalc_width = function () {
                    var width_left_column = $('#md-left-column').css('width');
                    $('#md-page-menu').css('width', width_left_column);
                };
                $(window).scroll(function () {
                    recalc_width();
                    var $first;
                    $('*.md-inpage-anchor').each(function (i, e) {
                        if ($first === undefined) {
                            var h = $(e);
                            if (_this.isVisibleInViewport(h)) {
                                $first = h;
                            }
                        }
                    });
                    $('#md-page-menu a').each(function (i, e) {
                        var $a = $(e);
                        if ($first && $a.toptext() === $first.toptext()) {
                            $('#md-page-menu a.active').removeClass('active');
                            $a.addClass('active');
                        }
                    });
                });
                var affixDiv = $('<div id="md-page-menu" />');
                var top_spacing = 70;
                affixDiv.affix({
                    offset: 130
                });
                affixDiv.css('top', top_spacing);
                var $pannel = $('<div class="panel panel-default"><ul class="list-group"/></div>');
                var $ul = $pannel.find("ul");
                affixDiv.append($pannel);
                function createMenuItem(heading, className) {
                    var $heading = $(heading);
                    var $a = $('<a class="list-group-item" />');
                    $a.addClass(className);
                    $a.attr('href', util.getInpageAnchorHref($heading.toptext()));
                    $a.click(function (ev) {
                        ev.preventDefault();
                        var $this = $(this);
                        var anchortext = util.getInpageAnchorText($this.toptext());
                    });
                    $a.text($heading.toptext());
                    return $a;
                }
                $($headings).each(function (i, e) {
                    var hClass = $(e).prop('tagName');
                    var currLevel = parseInt(hClass.substr(1, 1), 10);
                    var $hli = createMenuItem(e, hClass.toLowerCase() + '-nav');
                    $ul.append($hli);
                });
                $(window).resize(function () {
                    recalc_width();
                    _this.check_offset_to_navbar();
                });
                $('#md-left-column').append(affixDiv);
            };
            Bootstrap.prototype.createPageSkeleton = function () {
                $('#md-title').wrap('<div class="container" id="md-title-container"/>');
                $('#md-title').wrap('<div class="row" id="md-title-row"/>');
                $('#md-menu').wrap('<div class="container" id="md-menu-container"/>');
                $('#md-menu').wrap('<div class="row" id="md-menu-row"/>');
                $('#md-content').wrap('<div class="container" id="md-content-container"/>');
                $('#md-content').wrap('<div class="row" id="md-content-row"/>');
                $('#md-body').wrap('<div class="container" id="md-body-container"/>');
                $('#md-body').wrap('<div class="row" id="md-body-row"/>');
                $('#md-title').addClass('col-md-12');
                $('#md-content').addClass('col-md-12');
            };
            Bootstrap.prototype.changeHeading = function () {
                var jumbo = $('<div class="page-header" />');
                $('#md-title').wrapInner(jumbo);
            };
            Bootstrap.prototype.highlightActiveLink = function () {
                if ($('#md-menu').find('li').length === 0) {
                    return;
                }
                var filename = window.location.hash;
                if (filename.length === 0) {
                    filename = '#!index.md';
                }
                var selector = 'li:has(a[href="' + filename + '"])';
                $('#md-menu').find(selector).addClass('active');
            };
            Bootstrap.prototype.replaceImageParagraphs = function () {
                var $pars = $('p img').parents('p');
                $pars.each(function () {
                    var $p = $(this);
                    var $images = $(this).find('img')
                        .filter(function () {
                        return $(this).parents('a').length === 0;
                    })
                        .add($(this).find('img'))
                        .addClass('img-responsive')
                        .addClass('img-thumbnail');
                    function wrapImage($imgages, wrapElement) {
                        return $images.each(function (i, img) {
                            var $img = $(img);
                            var $parent_img = $img.parent('a');
                            if ($parent_img.length > 0)
                                $parent_img.wrap(wrapElement);
                            else
                                $img.wrap(wrapElement);
                        });
                    }
                    if ($p.hasClass('md-floatenv')) {
                        if ($images.length === 1) {
                            wrapImage($images, '<div class="col-sm-8" />');
                        }
                        else if ($images.length === 2) {
                            wrapImage($images, '<div class="col-sm-4" />');
                        }
                        else {
                            wrapImage($images, '<div class="col-sm-2" />');
                        }
                    }
                    else {
                        if ($images.length === 1) {
                            wrapImage($images, '<div class="col-sm-12" />');
                        }
                        else if ($images.length === 2) {
                            wrapImage($images, '<div class="col-sm-6" />');
                        }
                        else if ($images.length === 3) {
                            wrapImage($images, '<div class="col-sm-4" />');
                        }
                        else if ($images.length === 4) {
                            wrapImage($images, '<div class="col-sm-3" />');
                        }
                        else {
                            wrapImage($images, '<div class="col-sm-2" />');
                        }
                    }
                    $p.addClass('row');
                });
            };
            Bootstrap.prototype.adjustExternalContent = function () {
                $('iframe.md-external').not('.md-external-nowidth')
                    .attr('width', '450')
                    .css('width', '450px');
                $('iframe.md-external').not('.md-external-noheight')
                    .attr('height', '280')
                    .css('height', '280px');
                $('div.md-external').not('.md-external-noheight')
                    .css('height', '280px');
                $('div.md-external').not('.md-external-nowidth')
                    .css('width', '450px');
            };
            Bootstrap.prototype.addFooter = function () {
                var footer_template = new Template("layout/footer");
                var $rendered = footer_template.insertAfter($('#md-all'));
            };
            Bootstrap.prototype.addAdditionalFooterText = function () {
                var text = this.config.additionalFooterText;
                if (text) {
                    $('.md-copyright-footer #md-footer-additional').html(text);
                }
            };
            return Bootstrap;
        }());
        Legacy.Bootstrap = Bootstrap;
    })(Legacy = MDwiki.Legacy || (MDwiki.Legacy = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Gimmick;
    (function (Gimmick_1) {
        var GimmickHandler = (function () {
            function GimmickHandler(kind, callback) {
                this.loadStage = 'gimmick';
                this.kind = 'link';
                if (kind)
                    this.kind = kind;
                if (callback)
                    this.callback = callback;
            }
            Object.defineProperty(GimmickHandler.prototype, "gimmick", {
                get: function () {
                    return this.gimmickReference;
                },
                enumerable: true,
                configurable: true
            });
            return GimmickHandler;
        }());
        Gimmick_1.GimmickHandler = GimmickHandler;
        var ScriptResource = (function () {
            function ScriptResource(url, loadstage, finishstage) {
                if (loadstage === void 0) { loadstage = 'pregimmick'; }
                if (finishstage === void 0) { finishstage = 'gimmick'; }
                this.url = url;
                this.loadstage = loadstage;
                this.finishstage = finishstage;
            }
            return ScriptResource;
        }());
        Gimmick_1.ScriptResource = ScriptResource;
        var Gimmick = (function () {
            function Gimmick(name, handler) {
                this.handlers = [];
                this.initFunctions = $.Callbacks();
                if (arguments.length == 0) {
                    throw "name argument is required for the Gimmick constructor";
                }
                this.name = name;
                if (handler)
                    this.addHandler(handler);
            }
            Gimmick.prototype.initFunction = function (initFn) {
                this.initFunctions.add(initFn);
            };
            Gimmick.prototype.init = function (stageLoader) {
                this.initFunctions.fire(stageLoader);
            };
            Gimmick.prototype.addHandler = function (handler) {
                if (!handler.trigger)
                    handler.trigger = this.name;
                handler.gimmickReference = this;
                this.handlers.push(handler);
            };
            Gimmick.prototype.findHandler = function (kind, trigger) {
                var match = null;
                this.handlers.forEach(function (handler) {
                    if (handler.trigger == trigger && handler.kind == kind)
                        match = handler;
                });
                return match;
            };
            Gimmick.prototype.registerScriptResource = function (res) {
                var loadDone = $.Deferred();
                this.stages.getStage(res.loadstage).subscribe(function (done) {
                    if (res.url.startsWith('//') || res.url.startsWith('http')) {
                        $.getScript(res.url, function () { return loadDone.resolve(); });
                    }
                    else {
                        var script = document.createElement('script');
                        script.type = 'text/javascript';
                        script.text = res.url;
                        document.body.appendChild(script);
                        loadDone.resolve();
                    }
                    done();
                });
                this.stages.getStage(res.finishstage).subscribe(function (done) {
                    loadDone.done(function () { return done(); });
                });
            };
            return Gimmick;
        }());
        Gimmick_1.Gimmick = Gimmick;
        var GimmickLoader = (function () {
            function GimmickLoader(stageChain, domElement) {
                this.globalGimmickRegistry = [];
                this.domElement = domElement || $(document);
                this.stages = stageChain;
            }
            GimmickLoader.prototype.selectHandler = function (kind, trigger) {
                var matching_trigger_and_kind = null;
                this.globalGimmickRegistry.forEach(function (gmck) {
                    var handler = gmck.findHandler(kind, trigger);
                    if (handler != null)
                        matching_trigger_and_kind = handler;
                });
                return matching_trigger_and_kind;
            };
            GimmickLoader.prototype.findGimmick = function (name) {
                var found = this.globalGimmickRegistry.filter(function (gmck) {
                    return gmck.name == name;
                });
                if (found.length == 0)
                    return null;
                else
                    return found[0];
            };
            GimmickLoader.prototype.registerGimmick = function (gmck) {
                var already_registered = this.globalGimmickRegistry.some(function (g) { return g.name == gmck.name; });
                if (already_registered)
                    throw "A gimmick by that name is already registered";
                this.globalGimmickRegistry.push(gmck);
            };
            GimmickLoader.prototype.initializeGimmick = function (name, doneCallback) {
                var gmck = this.findGimmick(name);
                if (gmck == null)
                    return;
                gmck.init(this.stages);
                doneCallback();
            };
            GimmickLoader.prototype.initializeGimmicks = function (parser) {
                var _this = this;
                parser.singlelineReferences.forEach(function (ref) {
                    _this.stages.getStage('ready').subscribe(function (done) {
                        _this.initializeGimmick(ref.trigger, done);
                    });
                });
                parser.multilineReferences.forEach(function (ref) {
                    _this.stages.getStage('ready').subscribe(function (done) {
                        _this.initializeGimmick(ref.trigger, done);
                    });
                });
                parser.linkReferences.forEach(function (ref) {
                    _this.stages.getStage('ready').subscribe(function (done) {
                        _this.initializeGimmick(ref.trigger, done);
                    });
                });
            };
            GimmickLoader.prototype.subscribeGimmickExecution = function (parser) {
                var _this = this;
                parser.singlelineReferences.forEach(function (ref) {
                    var handler = _this.selectHandler('singleline', ref.trigger);
                    _this.stages.getStage(handler.loadStage).subscribe(function (done) {
                        handler.callback(ref, done);
                    });
                });
                parser.multilineReferences.forEach(function (ref) {
                    var handler = _this.selectHandler('multiline', ref.trigger);
                    _this.stages.getStage(handler.loadStage).subscribe(function (done) {
                        handler.callback(ref, done);
                    });
                });
                parser.linkReferences.forEach(function (ref) {
                    var handler = _this.selectHandler('link', ref.trigger);
                    _this.stages.getStage(handler.loadStage).subscribe(function (done) {
                        handler.callback(ref, done);
                    });
                });
            };
            return GimmickLoader;
        }());
        Gimmick_1.GimmickLoader = GimmickLoader;
    })(Gimmick = MDwiki.Gimmick || (MDwiki.Gimmick = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Gimmick;
    (function (Gimmick) {
        var MultilineGimmickReference = (function () {
            function MultilineGimmickReference() {
            }
            return MultilineGimmickReference;
        }());
        Gimmick.MultilineGimmickReference = MultilineGimmickReference;
        var SinglelineGimmickReference = (function () {
            function SinglelineGimmickReference() {
            }
            return SinglelineGimmickReference;
        }());
        Gimmick.SinglelineGimmickReference = SinglelineGimmickReference;
        var LinkGimmickReference = (function () {
            function LinkGimmickReference() {
            }
            return LinkGimmickReference;
        }());
        Gimmick.LinkGimmickReference = LinkGimmickReference;
        var GimmickParser = (function () {
            function GimmickParser(domElement) {
                this.multilineReferences = [];
                this.singlelineReferences = [];
                this.linkReferences = [];
                this.domElement = $(domElement);
            }
            GimmickParser.prototype.parse = function () {
                this.multilineReferences = this.getMultilineGimmicks();
                this.singlelineReferences = this.getSinglelineGimmicks();
                this.linkReferences = this.getLinkGimmicks();
            };
            GimmickParser.prototype.extractOptionsFromMagicString = function (s) {
                var gimmick_string = s.split(')', 1)[0];
                var additionalText = $.trim(s.split(")").slice(1).join(")"));
                var r = /gimmick\s?:\s*([^(\s]*)\s*\(?\s*{?(.*)\s*}?\)?/i;
                var matches = r.exec(gimmick_string);
                if (matches === null || matches[1] === undefined) {
                    return null;
                }
                var trigger = matches[1].toLowerCase();
                var args = null;
                if (matches[2] && matches[2].toLowerCase().indexOf("gimmick") != 0) {
                    var params = $.trim(matches[2].toString());
                    if (params.charAt(params.length - 1) === ')') {
                        params = params.substring(0, params.length - 1);
                    }
                    if (params.charAt(params.length - 1) === '}') {
                        params = params.substring(0, params.length - 1);
                    }
                    params = '({' + params + '})';
                    var replace_quotes = new RegExp("'", 'g');
                    params = params.replace(replace_quotes, '"');
                    try {
                        args = eval(params);
                    }
                    catch (err) {
                        $.error('error parsing argument of gimmick: ' + s + ' giving error: ' + err);
                    }
                }
                return { options: args, trigger: trigger, additionalText: additionalText };
            };
            GimmickParser.prototype.getLinkGimmicks = function () {
                var _this = this;
                var linkGimmicks = [];
                var $domLinks = this.domElement.find("a:icontains(gimmick:)");
                $.each($domLinks, function (i, link) {
                    var $link = $(link);
                    var text = $link.text();
                    var opt = _this.extractOptionsFromMagicString(text);
                    if (opt === null)
                        return;
                    var lg = new LinkGimmickReference();
                    lg.text = $link.attr('href');
                    lg.options = opt.options;
                    lg.trigger = opt.trigger;
                    lg.domElement = $link;
                    linkGimmicks.push(lg);
                });
                return linkGimmicks;
            };
            GimmickParser.prototype.getSinglelineGimmicks = function () {
                var _this = this;
                var $verbatim = this.domElement.find("code:not(pre > code)");
                var singlelineGimmicks = [];
                $.each($verbatim, function (i, e) {
                    var slg = new SinglelineGimmickReference();
                    slg.domElement = $(e);
                    var gimmickstring = $(e).text();
                    var opt = _this.extractOptionsFromMagicString(gimmickstring);
                    if (!opt)
                        return;
                    slg.trigger = opt.trigger;
                    slg.options = opt.options;
                    slg.text = opt.additionalText;
                    singlelineGimmicks.push(slg);
                });
                return singlelineGimmicks;
            };
            GimmickParser.prototype.getMultilineGimmicks = function () {
                var $verbatim = this.domElement.find("pre > code");
                var multiline_gimmicks = [];
                $.each($verbatim, function (i, e) {
                    var raw_trigger = $(e).attr('class');
                    var isMultilineGimmick = raw_trigger && raw_trigger.startsWith("gimmick:");
                    if (!isMultilineGimmick)
                        return;
                    var mlg = new MultilineGimmickReference();
                    mlg.domElement = $(e);
                    mlg.text = $(e).text().trim();
                    mlg.trigger = raw_trigger.split(':')[1];
                    multiline_gimmicks.push(mlg);
                });
                return multiline_gimmicks;
            };
            return GimmickParser;
        }());
        Gimmick.GimmickParser = GimmickParser;
    })(Gimmick = MDwiki.Gimmick || (MDwiki.Gimmick = {}));
})(MDwiki || (MDwiki = {}));
var JsxRender = (function () {
    function JsxRender() {
        var _this = this;
        this.createElement = function (tagName, attributes) {
            var children = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                children[_i - 2] = arguments[_i];
            }
            if (!tagName || typeof tagName !== 'string')
                throw new Error("tagName has to be defined, non-empty string");
            attributes = attributes || {};
            children = children || [];
            var element = document.createElement(tagName);
            for (var _a = 0, _b = Object.keys(attributes); _a < _b.length; _a++) {
                var attribute_key = _b[_a];
                var attribute_value = attributes[attribute_key];
                element.setAttribute(attribute_key, attribute_value);
            }
            for (var _c = 0, children_1 = children; _c < children_1.length; _c++) {
                var child = children_1[_c];
                _this.appendChild(element, child);
            }
            return element;
        };
        this.appendChild = function (element, child) {
            if (child instanceof HTMLElement)
                element.appendChild(child);
            else if (typeof child === 'string')
                element.appendChild(document.createTextNode(child));
            else if (child instanceof Array) {
                for (var _i = 0, child_1 = child; _i < child_1.length; _i++) {
                    var subchild = child_1[_i];
                    _this.appendChild(element, subchild);
                }
            }
        };
    }
    JsxRender.prototype.__spread = function () {
        throw "__spread not yet implemented!";
    };
    return JsxRender;
}());
window.JsxRender = new JsxRender();
var heading = "Hello world!";
var arr = [1, 2, 3];
var rendered = JsxRender.createElement("div", null, JsxRender.createElement("h1", null, heading), ['foo', 'bar'].map(function (i) { return JsxRender.createElement("h1", null, i); }));
var MDwiki;
(function (MDwiki) {
    var Util;
    (function (Util) {
        (function (LogLevel) {
            LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
            LogLevel[LogLevel["DEBUG"] = 1] = "DEBUG";
            LogLevel[LogLevel["INFO"] = 2] = "INFO";
            LogLevel[LogLevel["WARN"] = 3] = "WARN";
            LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
            LogLevel[LogLevel["FATAL"] = 5] = "FATAL";
        })(Util.LogLevel || (Util.LogLevel = {}));
        var LogLevel = Util.LogLevel;
        var Logger = (function () {
            function Logger(level) {
                this.logLevel = LogLevel.ERROR;
                this.logLevel = level;
            }
            Logger.prototype.log = function (loglevel, msg) {
                console.log('[' + loglevel.toUpperCase() + '] ' + msg);
            };
            Logger.prototype.trace = function (msg) {
                if (this.logLevel >= LogLevel.TRACE)
                    this.log('TRACE', msg);
            };
            Logger.prototype.info = function (msg) {
                if (this.logLevel >= LogLevel.INFO)
                    this.log('INFO', msg);
            };
            Logger.prototype.debug = function (msg) {
                if (this.logLevel >= LogLevel.DEBUG)
                    this.log('DEBUG', msg);
            };
            Logger.prototype.warn = function (msg) {
                if (this.logLevel >= LogLevel.WARN)
                    this.log('WARN', msg);
            };
            Logger.prototype.error = function (msg) {
                if (this.logLevel >= LogLevel.ERROR)
                    this.log('ERROR', msg);
            };
            Logger.prototype.fatal = function (msg) {
                if (this.logLevel >= LogLevel.FATAL)
                    this.log('FATAL', msg);
            };
            return Logger;
        }());
        Util.Logger = Logger;
    })(Util = MDwiki.Util || (MDwiki.Util = {}));
})(MDwiki || (MDwiki = {}));
(function ($) {
    var logger;
    if (typeof (MDwikiEnableDebug) != "undefined")
        logger = new MDwiki.Util.Logger(MDwiki.Util.LogLevel.DEBUG);
    else
        logger = new MDwiki.Util.Logger(MDwiki.Util.LogLevel.ERROR);
    $.md.getLogger = function () {
        return logger;
    };
    $.initMDwiki = function (name, registerDomReady) {
        if (registerDomReady === void 0) { registerDomReady = true; }
        var stageChain = new StageChain();
        var gimmickLoader = new GimmickLoader(stageChain);
        var wiki = new MDwiki.Core.Wiki(gimmickLoader, stageChain);
        $.md.wiki = wiki;
        if (!registerDomReady) {
            $.md.wiki.gimmicks = {};
            $.md.wiki.gimmicks.registerModule = function () { };
            $.md.wiki.gimmicks.registerGimmick = function () { };
            return;
        }
        $(document).ready(function () {
            function extractHashData() {
                var href;
                if (window.location.hash.startsWith('#!')) {
                    href = window.location.hash.substring(2);
                }
                else {
                    href = window.location.hash.substring(1);
                }
                var parser = document.createElement('a');
                parser.href = href;
                if (window.location.hostname != parser.hostname) {
                    href = 'index.md';
                }
                href = decodeURIComponent(href);
                var ex_pos = href.indexOf('#');
                if (ex_pos !== -1) {
                    $.md.inPageAnchor = href.substring(ex_pos + 1);
                    $.md.mainHref = href.substring(0, ex_pos);
                }
                else {
                    $.md.mainHref = href;
                }
            }
            function appendDefaultFilenameToHash() {
                var newHashString = '';
                var currentHashString = window.location.hash || '';
                if (currentHashString === '' ||
                    currentHashString === '#' ||
                    currentHashString === '#!') {
                    newHashString = '#!index.md';
                }
                else if (currentHashString.startsWith('#!') &&
                    currentHashString.endsWith('/')) {
                    newHashString = currentHashString + 'index.md';
                }
                if (newHashString)
                    window.location.hash = newHashString;
            }
            extractHashData();
            appendDefaultFilenameToHash();
            $(window).bind('hashchange', function () {
                window.location.reload(false);
            });
            $.md.wiki.run();
        });
    };
}(jQuery));
var MDwiki;
(function (MDwiki) {
    var Markdown;
    (function (Markdown_1) {
        var MarkdownPostprocessing = (function () {
            function MarkdownPostprocessing() {
            }
            MarkdownPostprocessing.prototype.process = function (dom) {
                var _this = this;
                dom.find("pre > code").each(function (i, code) {
                    _this.removeLangPrefix($(code));
                });
            };
            MarkdownPostprocessing.prototype.removeLangPrefix = function (code) {
                var klass = code.attr('class');
                if (klass && klass.indexOf("lang-gimmick") === 0) {
                    klass = klass.replace('lang-gimmick', 'gimmick');
                    code.attr('class', klass);
                }
            };
            return MarkdownPostprocessing;
        }());
        Markdown_1.MarkdownPostprocessing = MarkdownPostprocessing;
        var Markdown = (function () {
            function Markdown(markdownSource, options) {
                if (options === void 0) { options = {}; }
                this.defaultOptions = {
                    gfm: true,
                    tables: true,
                    breaks: true
                };
                this.markdownSource = markdownSource;
                this.options = options;
            }
            Markdown.prototype.transform = function () {
                marked.setOptions(this.options);
                var uglyHtml = marked(this.markdownSource);
                return uglyHtml;
            };
            return Markdown;
        }());
        Markdown_1.Markdown = Markdown;
        var Navbar = (function () {
            function Navbar(navbarMarkdown) {
                this.navbarMarkdown = navbarMarkdown;
                var md = new Markdown(navbarMarkdown);
                this.uglyHtml = md.transform();
            }
            Navbar.prototype.render = function () {
                var h = $("<div>" + this.uglyHtml + "</div>");
                h.find('p').each(function (i, e) {
                    var el = $(e);
                    el.replaceWith(el.html());
                });
                $('#md-menu').append(h.html());
            };
            Navbar.prototype.hideIfHasNoLinks = function () {
                var num_links = $('#md-menu a').length;
                var has_header = $('#md-menu .navbar-brand').eq(0).toptext().trim().length > 0;
                if (!has_header && num_links <= 1)
                    $('#md-menu').hide();
            };
            return Navbar;
        }());
        Markdown_1.Navbar = Navbar;
    })(Markdown = MDwiki.Markdown || (MDwiki.Markdown = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var DataModels;
    (function (DataModels) {
        var NavigationBarParser = (function () {
            function NavigationBarParser(node) {
                this.node = $(node);
                this.navbar = new NavigationBarModel();
            }
            NavigationBarParser.prototype.parse = function () {
                this.findPageTitle();
                this.findTopLevelEntries();
                return this.navbar;
            };
            NavigationBarParser.prototype.findPageTitle = function () {
                this.navbar.pageTitle = this.node.filter("h1").first().text() || "";
            };
            NavigationBarParser.prototype.findTopLevelEntries = function () {
                var _this = this;
                this.node.filter("p").find("a").each(function (i, e) {
                    var $el = $(e);
                    var toplevelentry = new ToplevelEntry();
                    toplevelentry.title = $el.text();
                    toplevelentry.href = $el.attr("href");
                    var parent_paragraph_successor = $el.parent().next();
                    if (parent_paragraph_successor.is("ul")) {
                        toplevelentry.childs = _this.findSublevelEntries(parent_paragraph_successor);
                    }
                    _this.navbar.toplevelEntries.push(toplevelentry);
                });
            };
            NavigationBarParser.prototype.findSublevelEntries = function (ul) {
                var _this = this;
                var found_sublevel_entries = [];
                $(ul).find("li").each(function (i, e) {
                    var child = $(e).children();
                    var sublevel_entry = _this.getSublevelEntry(e);
                    found_sublevel_entries.push(sublevel_entry);
                });
                return found_sublevel_entries;
            };
            NavigationBarParser.prototype.getSublevelEntry = function (el) {
                var $el = $(el);
                var entry = new SublevelEntry();
                if ($el.is("h1")) {
                    entry.seperator = true;
                }
                else if ($el.is("a")) {
                    entry.href = $el.attr("href");
                    entry.title = $el.text();
                }
                return entry;
            };
            return NavigationBarParser;
        }());
        DataModels.NavigationBarParser = NavigationBarParser;
        var NavigationBarModel = (function () {
            function NavigationBarModel() {
                this.toplevelEntries = [];
                this.pageTitle = "";
            }
            return NavigationBarModel;
        }());
        DataModels.NavigationBarModel = NavigationBarModel;
        var ToplevelEntry = (function () {
            function ToplevelEntry() {
                this.title = "";
                this.href = "";
                this.childs = [];
            }
            return ToplevelEntry;
        }());
        DataModels.ToplevelEntry = ToplevelEntry;
        var SublevelEntry = (function () {
            function SublevelEntry() {
                this.title = "";
                this.href = "";
                this.seperator = false;
            }
            return SublevelEntry;
        }());
        DataModels.SublevelEntry = SublevelEntry;
        function buildSampleMenu() {
            var navbar = new NavigationBarModel();
            var t1 = new ToplevelEntry();
            t1.title = "About";
            t1.href = "index.md";
            var t2 = new ToplevelEntry();
            t2.title = "Docs";
            t2.href = "";
            var s1 = new SublevelEntry();
            s1.title = "Quickstart";
            s1.href = "quickstart.md";
            t2.childs.push(s1);
            var s2 = new SublevelEntry();
            s2.title = "Quickstart";
            s2.href = "quickstart.md";
            t2.childs.push(s2);
            navbar.toplevelEntries.push(t1);
            navbar.toplevelEntries.push(t2);
        }
    })(DataModels = MDwiki.DataModels || (MDwiki.DataModels = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Core;
    (function (Core) {
        var Resource = (function () {
            function Resource(url, dataType) {
                if (dataType === void 0) { dataType = 'text'; }
                this.url = url;
                this.dataType = dataType;
            }
            Resource.fetch = function (url, dataType) {
                if (dataType === void 0) { dataType = 'text'; }
                var jqxhr = $.ajax({
                    url: url,
                    dataType: dataType
                });
                return jqxhr;
            };
            return Resource;
        }());
        Core.Resource = Resource;
    })(Core = MDwiki.Core || (MDwiki.Core = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Stages;
    (function (Stages) {
        var StageChain = (function () {
            function StageChain(stageNames) {
                var _this = this;
                this.defaultStageNames = ['init', 'load', 'transform', 'post_transform', 'ready', 'skel_ready',
                    'bootstrap', 'pregimmick', 'gimmick', 'postgimmick', 'all_ready',
                    'final_tests'
                ];
                this.stages = [];
                if (!stageNames)
                    stageNames = this.defaultStageNames;
                stageNames.map(function (n) { return _this.append(new Stage(n)); });
            }
            StageChain.prototype.reset = function () {
                var new_stages = [];
                for (var i = 0; i < this.stages.length; i++) {
                    var name = this.stages[i].name;
                    new_stages.push(new Stage(name));
                }
            };
            StageChain.prototype.appendArray = function (st) {
                var _this = this;
                st.map(function (s) { return _this.append(s); });
            };
            StageChain.prototype.append = function (s) {
                var len = this.stages.length;
                if (len == 0) {
                    this.stages.push(s);
                    return;
                }
                var last = this.stages[len - 1];
                last.finished().done(function () { return s.start(); });
                this.stages.push(s);
            };
            StageChain.prototype.run = function () {
                this.stages[0].start();
            };
            StageChain.prototype.getStage = function (name) {
                return this.stages.filter(function (s) { return s.name == name; })[0];
            };
            return StageChain;
        }());
        Stages.StageChain = StageChain;
        var Stage = (function () {
            function Stage(name) {
                this.allFinishedDfd = $.Deferred();
                this.started = false;
                this.numOutstanding = 0;
                this.subscribedFuncs = [];
                this.name = name;
            }
            Object.defineProperty(Stage.prototype, "isFinished", {
                get: function () {
                    return this.allFinishedDfd.state() !== 'pending';
                },
                enumerable: true,
                configurable: true
            });
            Stage.prototype.finished = function () {
                return this.allFinishedDfd.promise();
            };
            Stage.prototype.countdown = function () {
                this.numOutstanding--;
                if (this.numOutstanding == 0) {
                    this.allFinishedDfd.resolve();
                }
            };
            Stage.prototype.subscribe = function (fn) {
                var _this = this;
                if (this.isFinished)
                    throw 'Stage already finished, cannot subscribe';
                this.numOutstanding++;
                if (this.started)
                    fn(function () { return _this.countdown(); });
                else
                    this.subscribedFuncs.push(fn);
            };
            Stage.prototype.start = function () {
                var _this = this;
                console.dir("running stage " + this.name);
                this.started = true;
                if (this.numOutstanding == 0) {
                    this.allFinishedDfd.resolve();
                    return;
                }
                this.subscribedFuncs.forEach(function (subbedFn) {
                    subbedFn(function () { return _this.countdown(); });
                });
            };
            return Stage;
        }());
        Stages.Stage = Stage;
    })(Stages = MDwiki.Stages || (MDwiki.Stages = {}));
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    var Core;
    (function (Core) {
        var StringUtil = (function () {
            function StringUtil() {
            }
            StringUtil.startsWith = function (search, suffix) {
                return search.slice(0, suffix.length) == suffix;
            };
            StringUtil.endsWith = function (search, prefix) {
                return search.slice(search.length - prefix.length, search.length) == prefix;
            };
            return StringUtil;
        }());
        var Theme = (function () {
            function Theme(name, styles, scripts) {
                if (scripts === void 0) { scripts = []; }
                this.name = name;
                this.styles = styles;
                this.scripts = scripts;
            }
            Theme.prototype.onLoad = function () {
            };
            return Theme;
        }());
        var BootswatchTheme = (function (_super) {
            __extends(BootswatchTheme, _super);
            function BootswatchTheme(name) {
                _super.call(this, name, [], []);
                this.baseUrl = '//netdna.bootstrapcdn.com/bootswatch/3.0.2/';
                this.baseFilename = '/bootstrap.min.css';
                this.styles = [this.url];
            }
            Object.defineProperty(BootswatchTheme.prototype, "url", {
                get: function () {
                    return this.baseUrl + this.name + this.baseFilename;
                },
                enumerable: true,
                configurable: true
            });
            return BootswatchTheme;
        }(Theme));
        var ThemeChooser = (function () {
            function ThemeChooser() {
                this.themes = [];
                this.enableChooser = false;
            }
            Object.defineProperty(ThemeChooser.prototype, "themeNames", {
                get: function () {
                    return this.themes.map(function (t) { return t.name; });
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(ThemeChooser.prototype, "currentTheme", {
                get: function () {
                    var theme = window.localStorage.getItem("theme");
                    return theme;
                },
                set: function (val) {
                    if (val == '')
                        window.localStorage.removeItem("theme");
                    else
                        window.localStorage.setItem("theme", val);
                },
                enumerable: true,
                configurable: true
            });
            ThemeChooser.prototype.register = function (theme) {
                this.themes.push(theme);
            };
            ThemeChooser.prototype.loadDefaultTheme = function () {
                this.load(this.currentTheme);
            };
            ThemeChooser.prototype.load = function (name) {
                var target = this.themes.filter(function (t) { return t.name == name; });
                if (target.length <= 0)
                    return;
                else
                    this.applyTheme(target[0]);
            };
            ThemeChooser.prototype.applyTheme = function (theme) {
                $('link[rel=stylesheet][href*="netdna.bootstrapcdn.com"]').remove();
                var link_tag = this.createLinkTag(theme.styles[0]);
                $('head').append(link_tag);
            };
            ThemeChooser.prototype.createLinkTag = function (url) {
                return $('<link rel="stylesheet" type="text/css">').attr('href', url);
            };
            return ThemeChooser;
        }());
        var set_theme = function ($links, opt, text, tc) {
            opt.name = opt.name || text;
            $links.each(function (i, link) {
                $.md.stage('postgimmick').subscribe(function (done) {
                    if (!tc.currentTheme || tc.currentTheme == '' || tc.enableChooser == false)
                        tc.load(opt.name);
                    done();
                });
            });
            $links.remove();
        };
        function registerDefaultThemes(tc) {
            var bootswatch_theme_names = [
                'amelia', 'cerulean', 'cosmo', 'cyborg', 'flatly', 'journal',
                'readable', 'simplex', 'slate', 'spacelab', 'united', 'yeti'
            ];
            bootswatch_theme_names.map(function (name) { return tc.register(new BootswatchTheme(name)); });
        }
        var themechooser = function ($links, opt, text, tc) {
            return $links.each(function (i, e) {
                var $this = $(e);
                var $chooser = $('<a href=""></a><ul></ul>');
                $chooser.eq(0).text(text);
                $.each(tc.themeNames, function (i, themeName) {
                    var $li = $('<li></li>');
                    $chooser.eq(1).append($li);
                    var $a = $('<a/>')
                        .text(themeName)
                        .attr('href', '')
                        .click(function (ev) {
                        ev.preventDefault();
                        tc.currentTheme = themeName;
                        window.location.reload();
                    })
                        .appendTo($li);
                });
                $chooser.eq(1).append('<li class="divider" />');
                var $li = $('<li/>');
                var $a_use_default = $('<a>Use default</a>');
                $a_use_default.click(function (ev) {
                    ev.preventDefault();
                    tc.currentTheme = '';
                    window.location.reload();
                });
                $li.append($a_use_default);
                $chooser.eq(1).append($li);
                $chooser.eq(1).append('<li class="divider" />');
                $chooser.eq(1).append('<li><a href="http://www.bootswatch.com">Powered by Bootswatch</a></li>');
                $this.replaceWith($chooser);
            });
        };
    })(Core = MDwiki.Core || (MDwiki.Core = {}));
})(MDwiki || (MDwiki = {}));
var Gimmick = MDwiki.Gimmick;
var GimmickLoader = MDwiki.Gimmick.GimmickLoader;
var Links = MDwiki.Links;
var StageChain = MDwiki.Stages.StageChain;
var Stage = MDwiki.Stages.Stage;
var dummyutil = MDwiki.Utils.Url;
var MDwiki;
(function (MDwiki) {
    var Core;
    (function (Core) {
        var defaultConfig = {
            title: null,
            lineBreaks: 'gfm',
            additionalFooterText: '',
            anchorCharacter: '&para;',
            pageMenu: {
                disable: false,
                returnAnchor: "[top]",
                useHeadings: "h2"
            },
            parseHeader: false
        };
        var Wiki = (function () {
            function Wiki(gimmickLoader, stages, domElement) {
                this.config = defaultConfig;
                this.stages = stages;
                this.gimmicks = gimmickLoader;
                this.domElement = $(domElement || document);
            }
            Wiki.prototype.run = function () {
                this.registerFetchConfigAndNavigation();
                this.registerFetchMarkdown();
                this.registerPageTransformation();
                this.registerGimmickLoad();
                this.registerClearContent();
                this.registerFinalTasks();
                this.stages.run();
            };
            Wiki.prototype.registerFetchConfigAndNavigation = function () {
                var _this = this;
                this.stages.getStage('init').subscribe(function (done) {
                    var dfd1 = Core.Resource.fetch('config.json');
                    var dfd2 = Core.Resource.fetch('navigation.md');
                    dfd1.done(function (config) {
                        dfd2.done(function (nav) {
                            var data_json = JSON.parse(config);
                            _this.config = $.extend(_this.config, data_json);
                            _this.registerBuildNavigation(nav);
                            done();
                        });
                    });
                });
            };
            Wiki.prototype.registerPageTransformation = function () {
                var _this = this;
                this.stages.getStage('ready').subscribe(function (done) {
                    var page_skeleton = new MDwiki.Legacy.PageSkeleton(_this.config, document);
                    page_skeleton.createBasicSkeleton();
                    done();
                });
                this.stages.getStage('bootstrap').subscribe(function (done) {
                    var bootstrapper = new MDwiki.Legacy.Bootstrap(_this.stages, _this.config);
                    bootstrapper.bootstrapify();
                    MDwiki.Links.LinkRewriter.processPageLinks($('#md-content'), $.md.baseUrl);
                    done();
                });
            };
            Wiki.prototype.transformMarkdown = function (markdown) {
                var options = {
                    gfm: true,
                    tables: true,
                    breaks: true
                };
                if (this.config.lineBreaks === 'original')
                    options.breaks = false;
                else if (this.config.lineBreaks === 'gfm')
                    options.breaks = true;
                marked.setOptions(options);
                var transformer = new MDwiki.Markdown.Markdown(markdown, options);
                var html = transformer.transform();
                var processor = new MDwiki.Markdown.MarkdownPostprocessing();
                var $dom = $("<a/>").wrapInner($(html));
                processor.process($dom);
                var html = $dom.html();
                return html;
            };
            Wiki.prototype.registerClearContent = function () {
                this.stages.getStage('init').subscribe(function (done) {
                    $('#md-all').empty();
                    var skel = '<div id="md-body"><div id="md-title"></div><div id="md-menu">' +
                        '</div><div id="md-content"></div></div>';
                    $('#md-all').prepend($(skel));
                    done();
                });
            };
            Wiki.prototype.registerFetchMarkdown = function () {
                var _this = this;
                var md = '';
                this.stages.getStage('init').subscribe(function (done) {
                    var ajaxReq = {
                        url: $.md.mainHref,
                        dataType: 'text'
                    };
                    $.ajax(ajaxReq).done(function (data) {
                        md = data;
                        done();
                    }).fail(function () {
                        var log = $.md.getLogger();
                        log.fatal('Could not get ' + $.md.mainHref);
                        done();
                    });
                });
                this.stages.getStage('transform').subscribe(function (done) {
                    var len = $.md.mainHref.lastIndexOf('/');
                    var baseUrl = $.md.mainHref.substring(0, len + 1);
                    $.md.baseUrl = baseUrl;
                    done();
                });
                this.stages.getStage('transform').subscribe(function (done) {
                    var uglyHtml = _this.transformMarkdown(md);
                    $('#md-content').html(uglyHtml);
                    md = '';
                    done();
                });
            };
            Wiki.prototype.registerGimmickLoad = function () {
                var _this = this;
                var parser = new MDwiki.Gimmick.GimmickParser(this.domElement);
                this.stages.getStage('post_transform').subscribe(function (done) {
                    parser.parse();
                    _this.gimmicks.initializeGimmicks(parser);
                    _this.gimmicks.subscribeGimmickExecution(parser);
                    done();
                });
            };
            Wiki.prototype.registerBuildNavigation = function (navMD) {
                this.stages.getStage('transform').subscribe(function (done) {
                    if (navMD === '') {
                        var log = $.md.getLogger();
                        log.info('no navgiation.md found, not using a navbar');
                        done();
                        return;
                    }
                    var navHtml = marked(navMD);
                    var h = $('<div>' + navHtml + '</div>');
                    h.find('br').remove();
                    h.find('p').each(function (i, e) {
                        var el = $(e);
                        el.replaceWith(el.html());
                    });
                    $('#md-menu').append(h.html());
                    done();
                });
                this.stages.getStage('bootstrap').subscribe(function (done) {
                    MDwiki.Links.LinkRewriter.processPageLinks($('#md-menu'));
                    done();
                });
                this.stages.getStage('postgimmick').subscribe(function (done) {
                    done();
                });
            };
            Wiki.prototype.registerFinalTasks = function () {
                this.stages.getStage('all_ready').finished().done(function () {
                    $('html').removeClass('md-hidden-load');
                    if (typeof window['callPhantom'] === 'function') {
                        window['callPhantom']({});
                    }
                });
                this.stages.getStage('final_tests').finished().done(function () {
                    $('body').append('<span id="start-tests"></span>');
                    $('#start-tests').hide();
                });
            };
            return Wiki;
        }());
        Core.Wiki = Wiki;
    })(Core = MDwiki.Core || (MDwiki.Core = {}));
})(MDwiki || (MDwiki = {}));
//# sourceMappingURL=mdwiki_ts.js.map
!function(){var a=Handlebars.template,n=Handlebars.templates=Handlebars.templates||{};n["layout/footer.html"]=a({compiler:[7,">= 4.0.0"],main:function(a,n,t,i,e){return'\x3c!-- removing or hiding this footer is a violation of the AGPL licensing agreement\n and the additional conditions. See the LICENSE.txt file that comes with MDwiki --\x3e\n<hr>\n<div style="position: relative; margin-top: 1em;">\n    <div class="pull-right md-copyright-footer">\n        <span id="md-footer-additional"></span>\n        Website generated with <a href="http://www.mdwiki.info">MDwiki</a>\n        &copy; Timo D&ouml;rr and contributors.\n    </div>\n</div>\n'},useData:!0}),n["layout/paragraph.html"]=a({compiler:[7,">= 4.0.0"],main:function(a,n,t,i,e){return'<div class="md-text">\n    <div class="md-paragraph-intro md-float-left"></div>\n    <p class="md-paragraph-content"></p>\n    <div class="md-paragraph-outro md-float-right"></div>\n</div>\n'},useData:!0}),n["navigation/navbar.html"]=a({1:function(a,n,t,i,e){return'        <a class="navbar-brand" href="#"></a>\n'},compiler:[7,">= 4.0.0"],main:function(a,n,t,i,e){var l,r,o,s='<div id="md-main-navbar" class="navbar navbar-default navbar-fixed-top" role="navigation">\n    <div class="navbar-header">\n        <button type="button" class="navbar-toggle" data-toggle="collapse">\n            <span class="sr-only">Toggle navigation</span>\n            <span class="icon-bar"></span>\n            <span class="icon-bar"></span>\n            <span class="icon-bar"></span>\n        </button>\n';return r=null!=(r=t.pageTitle||(null!=n?n.pageTitle:n))?r:t.helperMissing,o={name:"pageTitle",hash:{},fn:a.program(1,e,0),inverse:a.noop,data:e},l="function"==typeof r?r.call(null!=n?n:a.nullContext||{},o):r,t.pageTitle||(l=t.blockHelperMissing.call(n,l,o)),null!=l&&(s+=l),s+'    </div>\n\n    <div class="collapse navbar-collapse">\n        <ul class="nav navbar-nav" />;\n        <ul class="nav navbar-nav navbar-right" />\n    </div>\n</div>\n'},useData:!0})}();
(function($) {
    'use strict';


    if (window.location.href.indexOf('SpecRunner') >= 0)
        $.initMDwiki(undefined, false);
    else
        $.initMDwiki(undefined, true);


}(jQuery));

(function($, Handlebars) {
    var templateGimmick = new MDwiki.Gimmick.Gimmick('template');
    var templateHandler = new MDwiki.Gimmick.GimmickHandler('singleline');
    templateHandler.loadStage = 'ready';

    templateHandler.callback = function(ref, done) {
        var options = ref.options;
        var view = options.view;
        var model = options.model;
        if (! (model && view)) return;

        var isMarkdown = options.view.endsWith('.md') || options.view.endsWith ('.mdt') ||
            options.view.endsWith('.mdown');

        // TODO proper url expansion
        var view_dfd = $.get(view);
        var model_dfd = $.get(model);
        // TODO error handling and call done() when model/view couldnt be loaded or parsed etc.
        $.when(view_dfd, model_dfd).then(function(viewresult, modelresult) {
            var viewdata = viewresult[0];
            var modeldata = modelresult[0];
            // this will fail as we only have handlebars runtime :( need to include full stack?
            var template = Handlebars.compile(viewdata);
            var output = template.render(modeldata);
            var new_elements;
            if (isMarkdown) {
                var html = marked(output);
                // the markdown parser will create a <p> that we don't want
                new_elements = $(html).children();
            } else {
                new_elements = $(output);
            }
            $(ref.domElement).after(new_elements);
            $(ref.domElement).remove();
            done();
        });
    };

    templateGimmick.addHandler(templateHandler);
    $.md.wiki.gimmicks.registerGimmick(templateGimmick);

})(jQuery, Handlebars);

(function($) {

    var prismGimmick = new MDwiki.Gimmick.Gimmick('prism');
    var prismHandler = new MDwiki.Gimmick.GimmickHandler('multiline');
    prismHandler.loadStage = 'ready';

    var supportedLangs = [
        'bash',
        'c',
        'coffeescript',
        'cpp',
        'csharp',
        'css',
        'go',
        'html',
        'javascript',
        'java',
        'php',
        'python',
        'ruby',
        'sass',
        'sql',
        'xml'
    ];

    prismHandler.callback = function(params, done) {
        var domElement = params.domElement;
        var trigger = params.trigger;
        var text = params.text;

        domElement.addClass("language-csharp");
        done();
    };

    function prism_highlight () {
        // marked adds lang-ruby, lang-csharp etc to the <code> block like in GFM
        var $codeblocks = $('pre code[class^=lang-]');
        $codeblocks.each(function() {
            var $this = $(this);
            var classes = $this.attr('class');
            var lang = classes.substring(5);
            if (supportedLangs.indexOf(lang) < 0) {
                return;
            }
            if (lang === 'html' || lang === 'xml') {
                lang = 'markup';
            }
            $this.removeClass(classes);
            $this.addClass('language-' + lang);
        });
        Prism.highlightAll();
    }

    prismGimmick.addHandler(prismHandler);
    $.md.wiki.gimmicks.registerGimmick(prismGimmick);
    $.md.wiki.stages.getStage('gimmick').subscribe(function(done) {
        Prism.highlightAll();
        done();
    });
}(jQuery));
