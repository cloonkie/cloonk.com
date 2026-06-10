declare const XLSX: any;
declare const JSZip: any;

interface Window {
  XLSX: any;
  JSZip: any;
  fashionConfirm?: (message: string, options?: Record<string, unknown>) => Promise<boolean>;
  fashionPrompt?: (message: string, options?: Record<string, unknown>) => Promise<string | null>;
  fashionChoice?: (message: string, options?: Record<string, unknown>) => Promise<string | null>;
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
  closest(selectors: string): any;
}

interface Element {
  value: any;
  checked: boolean;
  disabled: boolean;
  files: FileList | null;
  dataset: DOMStringMap;
}
