declare const XLSX: any;
declare const JSZip: any;

interface Window {
  XLSX: any;
  JSZip: any;
  fashionConfirm?: (message: string, options?: Record<string, unknown>) => Promise<boolean>;
  refreshCloonkCursorLabel?: (target?: Element) => void;
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
  tagName: string;
}

interface HTMLElement {
  _tm?: ReturnType<typeof setTimeout>;
}
