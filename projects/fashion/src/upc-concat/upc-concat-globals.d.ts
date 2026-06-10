declare const XLSX: any;

interface Window {
  XLSX: any;
  fashionConfirm?: (message: string, options?: Record<string, unknown>) => Promise<boolean>;
  fashionPrompt?: (message: string, options?: Record<string, unknown>) => Promise<string | null>;
}

interface Document {
  getElementById(elementId: string): any;
}

interface EventTarget {
  value: any;
  checked: boolean;
  disabled: boolean;
  files: FileList | null;
  dataset: DOMStringMap;
  closest(selectors: string): Element | null;
}

interface Element {
  value: any;
  checked: boolean;
  disabled: boolean;
  files: FileList | null;
  dataset: DOMStringMap;
}

interface HTMLElement {
  _colspan?: number;
}
