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
