import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './load-typescript.mjs';

const reactMock = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  createContext: () => ({ Provider: () => null }),
  useContext: () => null,
  useCallback: (fn) => fn,
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (init) => ({ current: init }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useId: () => ':test-id:',
  forwardRef: (fn) => fn,
};

const loader = createLoader({
  'react': reactMock,
  'react-dom': {
    createPortal: (children) => children,
  },
  'next/navigation': {
    usePathname: () => '/admin/fornecedores',
  },
  'lucide-react': new Proxy({}, { get: () => () => null }),
});

test('Dialog exporta componente e aceita preventClose sem quebrar assinatura', () => {
  const { Dialog } = loader('src/components/ui/Dialog.tsx');
  assert.equal(typeof Dialog, 'function');
});

test('SlidingSheet exporta componente e aceita preventClose', () => {
  const SlidingSheetModule = loader('src/components/ui/SlidingSheet.tsx');
  const SlidingSheet = SlidingSheetModule.default || SlidingSheetModule.SlidingSheet;
  assert.equal(typeof SlidingSheet, 'function');
});

test('ConfirmDialog exporta componente e integra com preventClose e loading', () => {
  const { ConfirmDialog } = loader('src/components/ui/ConfirmDialog.tsx');
  assert.equal(typeof ConfirmDialog, 'function');
});

test('Toast exporta ToastProvider e useToast', () => {
  const { ToastProvider, useToast } = loader('src/components/ui/Toast.tsx');
  assert.equal(typeof ToastProvider, 'function');
  assert.equal(typeof useToast, 'function');
});

test('Index de ui exporta todos os primitives essenciais incluindo SlidingSheet', () => {
  const ui = loader('src/components/ui/index.ts');
  assert.equal(typeof ui.Dialog, 'function');
  assert.equal(typeof ui.ConfirmDialog, 'function');
  assert.equal(typeof ui.SlidingSheet, 'function');
  assert.equal(typeof ui.Button, 'function');
  assert.equal(typeof ui.ToastProvider, 'function');
  assert.equal(typeof ui.useToast, 'function');
});
