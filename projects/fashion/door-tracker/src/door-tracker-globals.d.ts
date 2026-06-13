interface Document {
  getElementById(elementId: string): any;
}

interface EventTarget {
  id: string;
  value: any;
  checked: boolean;
  files: FileList | null;
  dataset: DOMStringMap;
  closest(selectors: string): any;
}

interface Window {
  __drawerBrand: any;
  __drawerRet: any;
  _doorListCollapsed: boolean;
  _doorMap: any;
  _doorTrackerBlankGuest: boolean;
  _drawerShowAllUnassigned: boolean;
  _resDoors: any[];
  _storeNotes: Record<string, any>;
  ClipboardItem: any;
  DOOR_TRACKER_DATA: any;
  DOOR_TRACKER_SUPABASE: any;
  DOOR_TRACKER_USER_ROSTER: any;
  fashionConfirm: any;
  fashionPrompt: any;
  mapboxgl: any;
  refreshCloonkCursorLabel: any;
  refreshCloonkCursorState: any;
  supabase: any;
}

declare const mapboxgl: any;
declare const XLSX: any;
declare const SEED: any;
declare const DOOR_KEY_SEED: any;
