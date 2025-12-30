# Custom Hooks Documentation

## Overview
Custom hooks yang diekstrak dari `App.jsx` untuk mengurangi kompleksitas dan meningkatkan reusability.

## Hooks List

### 1. `useModalState`
Mengelola state untuk semua modal (Alert, Confirm, Toast).

**Returns:**
- `confirmModal`, `alertModal`, `toast` - state objects
- `showAlert()`, `closeAlert()` - alert functions
- `showConfirm()`, `closeConfirm()` - confirm functions
- `showToast()`, `setToast()` - toast functions

### 2. `useSettings`
Mengelola semua konfigurasi aplikasi (Provider, API Keys, Models).

**Returns:**
- Provider settings (OpenRouter, Groq, Ollama)
- API keys dan validation states
- Notion integration settings
- Search enrichment settings
- Advanced settings (iterativeMode, highQuality, etc.)

### 3. `useBookVerification`
Mengelola state untuk verifikasi buku.

**Returns:**
- `isbn`, `title`, `author` - input states
- `verificationResult` - hasil verifikasi
- `loading`, `error` - status states
- `resetVerification()` - reset function

### 4. `useSummaryGeneration`
Mengelola state untuk generasi summary.

**Returns:**
- `summary`, `usageStats` - summary data
- `summarizing`, `progress` - status states
- `streamingStatus`, `tokensReceived` - streaming states
- `iterativeStats` - iterative mode data
- `searchSources` - search enrichment data
- `resetSummary()` - reset function

### 5. `useLibraryManagement`
Mengelola state untuk library dan saved summaries.

**Returns:**
- `savedSummaries`, `currentBook`, `currentVariant`
- Cover edit states
- Metadata edit states
- Delete confirmation states
- `resetLibrary()` - reset function

### 6. `useHistory`
Mengelola state untuk search history.

**Returns:**
- `history`, `setHistory`
- `showHistory`, `setShowHistory`
- `copied`, `setCopied`

### 7. `useElaboration`
Mengelola state untuk elaboration panel.

**Returns:**
- `selectionContext` - selected text context
- `elaborationChat` - chat history
- `isElaborating` - loading state
- `resetElaboration()` - reset function

### 8. `useNoteManagement`
Mengelola state untuk notes dan refinement.

**Returns:**
- Note review states
- Refinement modal states
- `noteReviewTextareaRef` - textarea ref
- `resetNotes()` - reset function

### 9. `useUIState`
Mengelola UI-specific state.

**Returns:**
- `isStuck` - sticky header state
- Refs: `headerRef`, `stickySentinelRef`, `libraryContentRef`

## Usage Example

```javascript
import {
  useModalState,
  useSettings,
  useBookVerification,
  // ... other hooks
} from './hooks';

function App() {
  const { showAlert, showToast, confirmModal, alertModal, toast } = useModalState();
  const { provider, openRouterKey, setProvider } = useSettings();
  const { isbn, setIsbn, verificationResult } = useBookVerification();
  
  // ... rest of component
}
```

## Benefits
- ✅ Reduced `App.jsx` complexity
- ✅ Better code organization
- ✅ Easier testing
- ✅ Improved reusability
- ✅ Clear separation of concerns
