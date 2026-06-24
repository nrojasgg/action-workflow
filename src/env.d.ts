/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(): void;
      }
      interface TokenResponse {
        access_token: string;
        expires_in: number;
        token_type: string;
        scope: string;
        error?: string;
      }
      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (tokenResponse: TokenResponse) => void;
        error_callback?: (error: unknown) => void;
      }
      function initTokenClient(config: TokenClientConfig): TokenClient;
      function revoke(token: string, callback?: () => void): void;
    }
  }
}

interface GooglePickerResponse {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    mimeType: string;
  }>;
}

declare namespace google.picker {
  const Action: { PICKED: string; CANCEL: string; LOADED: string };
  const ViewId: { DOCS: string; FOLDERS: string };
  class View {
    constructor(viewId: string);
    setMimeTypes(mimeTypes: string): View;
  }
  class DocsView {
    constructor(viewId: string);
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setMimeTypes(mimeTypes: string): DocsView;
  }
  class PickerBuilder {
    addView(view: View | DocsView): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setCallback(callback: (data: GooglePickerResponse) => void): PickerBuilder;
    build(): GooglePicker;
  }
}
