import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Carrega o código real, substituindo somente as fronteiras de Next e do banco.
// Os testes não leem .env.local e não fazem chamadas ao banco de produção.
export function createLoader(overrides = {}) {
  const cache = new Map();
  const root = resolve('.');
  function load(file) {
    const absolute = resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const realRequire = createRequire(absolute);
    const require = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name.startsWith('.') || name.startsWith('@/')) {
        let target = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(absolute), name);
        if (!existsSync(target)) target += '.ts';
        if (target.endsWith('.ts')) return load(target);
        return realRequire(target);
      }
      return realRequire(name);
    };
    const compiled = ts.transpileModule(readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    new Function('require', 'module', 'exports', compiled.outputText)(require, module, module.exports);
    return module.exports;
  }
  return load;
}
