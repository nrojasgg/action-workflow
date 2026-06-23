import type { WorkflowExportSchema } from '../types/workflow.types';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const JSON_MIME = 'application/json';

declare const gapi: {
  load: (api: string, callback: () => void) => void;
  client: {
    init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
    drive: {
      files: {
        get: (params: { fileId: string; alt: string }) => Promise<{ body: string; result?: unknown }>;
      };
    };
  };
};

function formatError(err: unknown): string {
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

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let gapiLoaded = false;
let gisLoaded = false;

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en las variables de entorno.');
  return id;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_GOOGLE_API_KEY;
  if (!key) throw new Error('Falta VITE_GOOGLE_API_KEY en las variables de entorno.');
  return key;
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

async function ensureGapi(): Promise<void> {
  if (gapiLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise<void>((resolve) => gapi.load('client:picker', resolve));
  await gapi.client.init({
    apiKey: getApiKey(),
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiLoaded = true;
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
    tokenClient = google.accounts.oauth2.initTokenClient({
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

// ─── Picker para seleccionar archivo JSON ─────────────────────────────────

async function openFilePicker(token: string): Promise<{ id: string; name: string } | null> {
  await ensureGapi();

  return new Promise((resolve) => {
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes(`${JSON_MIME},text/plain`);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(getApiKey())
      .setCallback((data: GooglePickerResponse) => {
        if (data.action === google.picker.Action.PICKED && data.docs?.length) {
          resolve({ id: data.docs[0].id, name: data.docs[0].name });
        } else {
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
  await ensureGapi();

  const file = await openFilePicker(token);
  if (!file) return null;

  const resp = await gapi.client.drive.files.get({
    fileId: file.id,
    alt: 'media',
  });

  const text = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.result ?? resp.body);
  const schema = JSON.parse(text) as WorkflowExportSchema;

  if (!Array.isArray(schema.nodes) || !Array.isArray(schema.edges)) {
    throw new Error('El archivo seleccionado no tiene la estructura válida de Action Workflow.');
  }

  return schema;
}

// ─── Exportar a Drive ─────────────────────────────────────────────────────

export async function exportToDrive(schema: WorkflowExportSchema): Promise<string> {
  const token = await authenticate();
  await ensureGapi();

  const json = JSON.stringify(schema, null, 2);
  const blob = new Blob([json], { type: JSON_MIME });
  const fileName = `action-workflow-${new Date().toISOString().slice(0, 10)}.json`;

  const metadata = {
    name: fileName,
    mimeType: JSON_MIME,
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
