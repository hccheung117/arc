#!/usr/bin/env node
import CDP from 'chrome-remote-interface';
import fs from 'node:fs';

// --- Helpers ---

const evaluate = (client, expression) =>
  client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });

const evalValue = async (client, expression) => {
  const { result, exceptionDetails } = await evaluate(client, expression);
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};

const sel = (s) => JSON.stringify(s);

// --- Commands ---

const commands = {
  // Visual
  async screenshot(client, args) {
    const file = args[0] || '/tmp/devtools-screenshot.png';
    const { data } = await client.Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return `Saved ${file}`;
  },

  async pdf(client, args) {
    const file = args[0] || '/tmp/devtools-page.pdf';
    const { data } = await client.Page.printToPDF();
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return `Saved ${file}`;
  },

  // DOM
  async html(client) {
    return evalValue(client, 'document.documentElement.outerHTML');
  },

  async query(client, args) {
    return evalValue(client, `document.querySelector(${sel(args[0])})?.outerHTML ?? 'No match'`);
  },

  async 'query-all'(client, args) {
    return evalValue(client, `[...document.querySelectorAll(${sel(args[0])})].map(e => e.outerHTML)`);
  },

  async text(client, args) {
    return evalValue(client, `document.querySelector(${sel(args[0] || 'body')})?.innerText ?? 'No match'`);
  },

  async attrs(client, args) {
    return evalValue(client, `(() => {
      const el = document.querySelector(${sel(args[0])});
      return el ? Object.fromEntries([...el.attributes].map(a => [a.name, a.value])) : null;
    })()`);
  },

  async box(client, args) {
    return evalValue(client, `(() => {
      const el = document.querySelector(${sel(args[0])});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
  },

  // JavaScript
  async eval(client, args) {
    const { result, exceptionDetails } = await evaluate(client, args.join(' '));
    if (exceptionDetails) return { error: exceptionDetails.text };
    return result.value ?? result.description ?? result.type;
  },

  // CSS
  async styles(client, args) {
    const [s, ...props] = args;
    return evalValue(client, `(() => {
      const el = document.querySelector(${sel(s)});
      if (!el) return null;
      const cs = getComputedStyle(el);
      const keys = ${props.length ? JSON.stringify(props) : '[...cs]'};
      return Object.fromEntries(keys.map(p => [p, cs.getPropertyValue(p)]));
    })()`);
  },

  // Info
  async url(client) {
    return evalValue(client, 'location.href');
  },

  async title(client) {
    return evalValue(client, 'document.title');
  },

  async cookies(client) {
    await client.Network.enable();
    return (await client.Network.getCookies()).cookies;
  },

  async storage(client, args) {
    const type = args[0] || 'local';
    return evalValue(client, `Object.fromEntries(
      Object.keys(${type}Storage).map(k => [k, ${type}Storage.getItem(k)])
    )`);
  },

  async metrics(client) {
    await client.Performance.enable();
    const { metrics } = await client.Performance.getMetrics();
    return Object.fromEntries(metrics.map(m => [m.name, m.value]));
  },

  // Accessibility
  async accessibility(client) {
    return (await client.Accessibility.getFullAXTree()).nodes;
  },

  // Monitor (event-based, listens for duration)
  async console(client, args) {
    const ms = parseInt(args[0] || '2000');
    const messages = [];
    client.Runtime.consoleAPICalled(({ type, args: a }) => {
      messages.push({ type, text: a.map(x => x.value ?? x.description ?? x.type).join(' ') });
    });
    await new Promise(r => setTimeout(r, ms));
    return messages;
  },

  async network(client, args) {
    const ms = parseInt(args[0] || '3000');
    const requests = [];
    await client.Network.enable();
    client.Network.requestWillBeSent(({ request }) => {
      requests.push({ method: request.method, url: request.url });
    });
    await new Promise(r => setTimeout(r, ms));
    return requests;
  },

  // Targets
  async targets(_client, _args, port) {
    return CDP.List({ port });
  },

  // Raw CDP
  async cdp(client, args) {
    const method = args[0];
    const params = args[1] ? JSON.parse(args.slice(1).join(' ')) : {};
    return client.send(method, params);
  },
};

// --- Output ---

const print = (val) => {
  if (val == null) return;
  process.stdout.write(typeof val === 'string' ? val + '\n' : JSON.stringify(val, null, 2) + '\n');
};

const HELP = `Usage: node devtools.mjs [--port=PORT] <command> [args...]

Visual:
  screenshot [file]              Save PNG (default: /tmp/devtools-screenshot.png)
  pdf [file]                     Save PDF

DOM:
  html                           Full page HTML
  query <selector>               Element outerHTML
  query-all <selector>           All matching elements
  text [selector]                Text content (default: body)
  attrs <selector>               Element attributes
  box <selector>                 Bounding box {x, y, width, height}

JavaScript:
  eval <expression>              Evaluate JS (supports await)

CSS:
  styles <selector> [...props]   Computed styles (optionally filter props)

Info:
  url                            Current page URL
  title                          Page title
  cookies                        All cookies
  storage [local|session]        Web storage contents
  metrics                        Performance metrics

Tree:
  accessibility                  Full accessibility tree

Monitor:
  console [ms]                   Capture console output (default: 2000ms)
  network [ms]                   Capture network requests (default: 3000ms)

Raw CDP:
  cdp <Domain.method> [json]     Any Chrome DevTools Protocol command
  targets                        List debug targets

Env: CDP_PORT (default: 9222)`;

// --- Main ---

async function main() {
  let port = parseInt(process.env.CDP_PORT || '9222');
  const rawArgs = process.argv.slice(2);

  const portIdx = rawArgs.findIndex(a => a.startsWith('--port='));
  if (portIdx !== -1) {
    port = parseInt(rawArgs.splice(portIdx, 1)[0].split('=')[1]);
  }

  const [command, ...args] = rawArgs;
  if (!command || command === 'help' || command === '--help') { console.log(HELP); return; }

  const handler = commands[command];
  if (!handler) { console.error(`Unknown command: ${command}\nRun with --help for usage`); process.exit(1); }

  // targets doesn't need a full client connection
  if (command === 'targets') { print(await handler(null, args, port)); return; }

  const client = await CDP({ port });
  try {
    await Promise.all([client.Page.enable(), client.Runtime.enable(), client.DOM.enable()]);
    print(await handler(client, args, port));
  } finally {
    await client.close();
  }
}

main().catch(err => {
  if (err.code === 'ECONNREFUSED') {
    console.error(`Cannot connect on port ${process.env.CDP_PORT || 9222}. Start app with --remote-debugging-port=${process.env.CDP_PORT || 9222}`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
