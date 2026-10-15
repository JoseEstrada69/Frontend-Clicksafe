'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FlashMessage } from '@/components/FlashMessage';
import { Skeleton } from '@/components/Skeleton';
import { Tabs } from '@/components/Tabs';
import { TextArea } from '@/components/TextArea';
import { TextField } from '@/components/TextField';
import { useApiQuery } from '@/hooks/useApiQuery';
import {
  createCategory,
  createPlatform,
  getAdminCategories,
  getAdminPlatforms,
  updateCategory,
  updatePlatform,
} from '@/lib/admin-api';
import { toApiError } from '@/lib/errors';
import { setFlash } from '@/lib/flash';
import type { AdminCategory, AdminPlatform } from '@/lib/types';
import panel from '../panel.module.css';
import styles from './catalogos.module.css';

type Kind = 'plataformas' | 'categorias';
type Item = AdminPlatform | AdminCategory;

const NAME_MAX = 100;
const DESCRIPTION_MAX = 255;

const TABS: { value: Kind; label: string }[] = [
  { value: 'plataformas', label: 'Plataformas' },
  { value: 'categorias', label: 'Categorías de fraude' },
];

const NOUN: Record<Kind, { one: string; article: string }> = {
  plataformas: { one: 'plataforma', article: 'la' },
  categorias: { one: 'categoría', article: 'la' },
};

/** "Otra" es fija: no se puede desactivar ni renombrar (la API también lo impide). */
function isLocked(item: Item): boolean {
  return 'esOtra' in item && item.esOtra;
}

interface Editor {
  kind: Kind;
  item: Item | null; // null = agregar
}

/** W11 · Catálogos (no se borran: solo se activan o desactivan). */
export default function CatalogsPage() {
  const panelId = useId();
  const [tab, setTab] = useState<Kind>('plataformas');
  const platforms = useApiQuery((signal) => getAdminPlatforms(signal), [], {
    isEmpty: (list) => list.length === 0,
  });
  const categories = useApiQuery((signal) => getAdminCategories(signal), [], {
    isEmpty: (list) => list.length === 0,
  });
  const query = tab === 'plataformas' ? platforms : categories;

  // ---------- Agregar / editar ----------
  const [editor, setEditor] = useState<Editor | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState('');

  function openEditor(kind: Kind, item: Item | null) {
    setEditor({ kind, item });
    setNombre(item?.nombre ?? '');
    setDescripcion(item && 'descripcion' in item ? (item.descripcion ?? '') : '');
    setFieldError('');
    setEditorError('');
  }

  async function save() {
    if (!editor || saving) return;
    const name = nombre.trim();
    const description = descripcion.trim();
    if (name.length < 1 || name.length > NAME_MAX) {
      setFieldError('El nombre debe tener de 1 a 100 caracteres.');
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      setFieldError('La descripción no puede pasar de 255 caracteres.');
      return;
    }
    setSaving(true);
    setFieldError('');
    setEditorError('');
    try {
      const { kind, item } = editor;
      if (kind === 'plataformas') {
        if (item) await updatePlatform(item.id, { nombre: name });
        else await createPlatform({ nombre: name });
      } else if (item) {
        await updateCategory(item.id, { nombre: name, descripcion: description });
      } else {
        await createCategory(description ? { nombre: name, descripcion: description } : { nombre: name });
      }
      setFlash(item ? 'Cambios guardados.' : `${capitalize(NOUN[kind].one)} agregada.`);
      setEditor(null);
      // Volver a pedir: la tabla muestra lo que confirmó el servidor
      (kind === 'plataformas' ? platforms : categories).reload();
    } catch (e) {
      setEditorError(toApiError(e).userMessage);
    }
    setSaving(false);
  }

  // ---------- Activar / desactivar ----------
  const [toggling, setToggling] = useState<{ kind: Kind; item: Item } | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [pageError, setPageError] = useState('');

  async function confirmToggle() {
    if (!toggling || toggleBusy) return;
    const { kind, item } = toggling;
    const activa = !item.activa;
    setToggleBusy(true);
    setPageError('');
    try {
      if (kind === 'plataformas') await updatePlatform(item.id, { activa });
      else await updateCategory(item.id, { activa });
      setFlash(activa ? `Se activó «${item.nombre}».` : `Se desactivó «${item.nombre}».`);
    } catch (e) {
      setPageError(toApiError(e).userMessage);
    }
    setToggling(null);
    setToggleBusy(false);
    (kind === 'plataformas' ? platforms : categories).reload();
  }

  const columns: Column<Item>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      width: 'primary',
      render: (item) => (
        <span className={styles.name}>
          {item.nombre}
          {isLocked(item) && <span className={styles.locked}>Fija</span>}
        </span>
      ),
    },
    ...(tab === 'categorias'
      ? [
          {
            key: 'descripcion',
            header: 'Descripción',
            render: (item: Item) =>
              'descripcion' in item && item.descripcion ? item.descripcion : '—',
          },
        ]
      : []),
    {
      key: 'estado',
      header: 'Estado',
      width: 'nowrap',
      render: (item) => (
        <span className={item.activa ? styles.active : styles.inactive}>
          {item.activa ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      width: 'nowrap',
      render: (item) =>
        isLocked(item) ? (
          <span className={styles.lockedNote}>
            No se puede editar ni desactivar
          </span>
        ) : (
          <span className={styles.actions}>
            <Button variant="secondary" onClick={() => openEditor(tab, item)}>
              Editar
            </Button>
            <Button
              variant={item.activa ? 'danger' : 'secondary'}
              onClick={() => setToggling({ kind: tab, item })}
            >
              {item.activa ? 'Desactivar' : 'Activar'}
            </Button>
          </span>
        ),
    },
  ];

  const noun = NOUN[tab];
  const editingNoun = editor ? NOUN[editor.kind] : noun;

  return (
    <>
      <header className={`${panel.pageHeader} ${styles.header}`}>
        <h1>Catálogos</h1>
        <Button onClick={() => openEditor(tab, null)}>
          Agregar {noun.one}
        </Button>
      </header>

      <FlashMessage />
      <div aria-live="assertive">
        {pageError && (
          <p className={styles.error} role="alert">
            {pageError}
          </p>
        )}
      </div>

      <Tabs label="Catálogo" tabs={TABS} value={tab} onChange={setTab} panelId={panelId} />

      <div id={panelId} role="tabpanel">
        {query.status === 'loading' && <Skeleton lines={5} label="Cargando catálogo…" />}
        {query.status === 'error' && query.error && (
          <ErrorBanner error={query.error} onRetry={query.reload} />
        )}
        {query.status === 'empty' && (
          <EmptyState title={`Todavía no hay ${tab === 'plataformas' ? 'plataformas' : 'categorías'}.`} />
        )}
        {query.status === 'success' && query.data && (
          <DataTable<Item>
            caption={tab === 'plataformas' ? 'Plataformas' : 'Categorías de fraude'}
            columns={columns}
            rows={query.data}
            rowKey={(item) => item.id}
          />
        )}
      </div>

      <ConfirmDialog
        open={editor !== null}
        title={editor?.item ? `Editar ${editingNoun.one}` : `Agregar ${editingNoun.one}`}
        confirmLabel={editor?.item ? 'Guardar cambios' : 'Agregar'}
        loading={saving}
        onConfirm={save}
        onCancel={() => setEditor(null)}
      >
        <div className={styles.form}>
          <TextField
            label="Nombre"
            value={nombre}
            maxLength={NAME_MAX}
            autoComplete="off"
            onChange={(e) => setNombre(e.target.value)}
            error={fieldError || undefined}
          />
          {editor?.kind === 'categorias' && (
            <TextArea
              label="Descripción (opcional)"
              value={descripcion}
              onChange={setDescripcion}
              maxLength={DESCRIPTION_MAX}
              rows={3}
            />
          )}
          <div aria-live="polite">
            {editorError && (
              <p className={styles.error} role="alert">
                {editorError}
              </p>
            )}
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={toggling !== null}
        title={
          toggling?.item.activa
            ? `¿Desactivar «${toggling.item.nombre}»?`
            : `¿Activar «${toggling?.item.nombre ?? ''}»?`
        }
        confirmLabel={toggling?.item.activa ? 'Desactivar' : 'Activar'}
        danger={toggling?.item.activa ?? false}
        loading={toggleBusy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      >
        <p>
          {toggling?.item.activa
            ? 'Ya no aparecerá al crear reportes; los reportes existentes la conservan.'
            : 'Volverá a aparecer al crear reportes.'}
        </p>
      </ConfirmDialog>
    </>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
