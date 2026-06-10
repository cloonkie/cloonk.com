declare const XLSX: any;

interface Window {
  XLSX: any;
  fashionConfirm?: (message: string, options?: Record<string, unknown>) => Promise<boolean>;
}

interface Document {
  getElementById(elementId: string): any;
}

interface EventTarget {
  value: any;
  checked: boolean;
  files: FileList | null;
  dataset: DOMStringMap;
  closest(selectors: string): any;
}

interface HTMLElement {
  _tm?: ReturnType<typeof setTimeout>;
}
