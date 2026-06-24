import type { WorkflowExportSchema } from '../types/workflow.types';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const JSON_MIME = 'application/json';

export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.error === 'object' && obj.error !== null) {
      const inner = obj.error as Record<string, unknown>;
      if (typeof inner.message === 'string') return inner.message;
    }
    try { return JSON.stringify(err); } catch { return 'Error desconocido'; }
  }
  return String(err);
}

let accessToken: string | null = null;
let pickerLoaded = false;
let gisLoaded = false;

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en las variables de entorno.');
  return id;
}

// ─── Carga dinámica de scripts ────────────────────────────────────────────

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensurePicker(): Promise<void> {
  if (pickerLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => {
    (window as unknown as { gapi: { load: (api: string, cb: () => void) => void } })
      .gapi.load('picker', resolve);
  });
  pickerLoaded = true;
}

async function ensureGis(): Promise<void> {
  if (gisLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gisLoaded = true;
}

// ─── Autenticación ────────────────────────────────────────────────────────

async function authenticate(): Promise<string> {
  if (accessToken) return accessToken;

  await ensureGis();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(`Error de autenticación: ${resp.error}`));
          return;
        }
        accessToken = resp.access_token;
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new Error(`Error de autenticación: ${formatError(err)}`));
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function disconnectDrive(): void {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
  }
}

export function isConnected(): boolean {
  return accessToken !== null;
}

// ─── Picker para seleccionar archivo ──────────────────────────────────────

async function openFilePicker(token: string): Promise<{ id: string; name: string } | null> {
  await ensurePicker();

  return new Promise((resolve) => {
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes(`${JSON_MIME},text/plain,application/octet-stream`);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setCallback((data: GooglePickerResponse) => {
        if (data.action === google.picker.Action.PICKED && data.docs?.length) {
          resolve({ id: data.docs[0].id, name: data.docs[0].name });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

// ─── Picker para seleccionar carpeta de destino ───────────────────────────

async function openFolderPicker(token: string): Promise<string | null> {
  await ensurePicker();

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS);
    view.setSelectFolderEnabled(true);
    view.setMimeTypes('application/vnd.google-apps.folder');

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setCallback((data: GooglePickerResponse) => {
        if (data.action === google.picker.Action.PICKED && data.docs?.length) {
          resolve(data.docs[0].id);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

// ─── Importar desde Drive ─────────────────────────────────────────────────

export async function importFromDrive(): Promise<WorkflowExportSchema | null> {
  const token = await authenticate();

  const file = await openFilePicker(token);
  if (!file) return null;

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Error al leer archivo (${resp.status}): ${errText}`);
  }

  const text = await resp.text();

  let schema: WorkflowExportSchema;
  try {
    schema = JSON.parse(text) as WorkflowExportSchema;
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }

  if (!Array.isArray(schema.nodes) || !Array.isArray(schema.edges)) {
    throw new Error('El archivo no tiene la estructura de Action Workflow (faltan nodos o aristas).');
  }

  return schema;
}

// ─── Exportar a Drive ─────────────────────────────────────────────────────

export async function exportToDrive(schema: WorkflowExportSchema): Promise<string> {
  const token = await authenticate();

  const folderId = await openFolderPicker(token);
  if (!folderId) throw new Error('No se seleccionó carpeta de destino.');

  const json = JSON.stringify(schema, null, 2);
  const blob = new Blob([json], { type: JSON_MIME });
  const fileName = `action-workflow-${new Date().toISOString().slice(0, 10)}.json`;

  const metadata = {
    name: fileName,
    mimeType: JSON_MIME,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: new Headers({ Authorization: `Bearer ${token}` }),
      body: form,
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Error al subir a Drive: ${resp.status} ${err}`);
  }

  const result = await resp.json();
  return result.id as string;
}
