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
        if (!existsSync(target)) {
          if (existsSync(target + '.ts')) target += '.ts';
          else if (existsSync(target + '.tsx')) target += '.tsx';
          else if (existsSync(resolve(target, 'index.ts'))) target = resolve(target, 'index.ts');
          else if (existsSync(resolve(target, 'index.tsx'))) target = resolve(target, 'index.tsx');
        }
        if (target.endsWith('.ts') || target.endsWith('.tsx')) return load(target);
        return realRequire(target);
      }
      return realRequire(name);
    };
    const compiled = ts.transpileModule(readFileSync(absolute, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.React,
      },
    });
    new Function('require', 'module', 'exports', 'React', compiled.outputText)(require, module, module.exports, overrides['react'] || {});
    return module.exports;
  }
  return load;
}
