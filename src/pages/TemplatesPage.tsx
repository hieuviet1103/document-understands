import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../services/api';
import {
  Plus,
  Layers,
  Edit2,
  Trash2,
  Globe,
  Lock,
  AlertCircle,
  X,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileJson,
  Upload,
} from 'lucide-react';

type OutputFormat = 'text' | 'json' | 'excel';

interface JsonField {
  name: string;
  type: string;
  description: string;
  children?: JsonField[];
  items?: JsonField | null;
}

interface ExcelColumn {
  name: string;
  description: string;
}

const defaultSchema = (format: OutputFormat) => {
  if (format === 'text') return { template: 'Invoice #{invoice_number}\nDate: {date}\nTotal: {total}' };
  if (format === 'json') return { fields: [{ name: 'field1', type: 'string', description: 'Description' }] };
  return { columns: [{ name: 'Column1', description: 'Description' }] };
};

const PRIMITIVE_TYPES = ['string', 'number', 'integer', 'boolean'] as const;
const COMPLEX_TYPES = ['array', 'object'] as const;
const ALL_FIELD_TYPES = [...PRIMITIVE_TYPES, ...COMPLEX_TYPES] as const;

/** Humanize key to a readable description (e.g. invoice_number → Invoice number). */
function humanizeKey(key: string): string {
  if (!key) return '';
  const withSpaces = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase();
}

/** Ensure every field has a non-empty description (mutates in place). */
function ensureDescriptions(fields: JsonField[]): void {
  for (const f of fields) {
    if (typeof f.description !== 'string' || f.description.trim() === '') {
      f.description = humanizeKey(f.name || 'field');
    }
    if (f.children?.length) ensureDescriptions(f.children);
    if (f.items) {
      if (typeof f.items.description !== 'string' || f.items.description.trim() === '') {
        f.items.description = humanizeKey(f.items.name || 'item');
      }
      if (f.items.children?.length) ensureDescriptions(f.items.children);
    }
  }
}

/** Check if JSON is already our template schema format: { fields: [ { name, type, ... } ] }. */
function isAlreadyTemplateSchema(json: unknown): json is { fields: unknown[] } {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return false;
  const obj = json as Record<string, unknown>;
  const fields = obj.fields;
  if (!Array.isArray(fields) || fields.length === 0) return false;
  const first = fields[0];
  return first !== null && typeof first === 'object' && 'name' in first && 'type' in first;
}

/** Normalize raw field from template-schema JSON into JsonField (keep description, children, items). */
function normalizeTemplateField(raw: unknown): JsonField {
  const validTypes: JsonField['type'][] = ['string', 'number', 'integer', 'boolean', 'object', 'array'];
  const toType = (s: unknown): JsonField['type'] =>
    (typeof s === 'string' && validTypes.includes(s as JsonField['type'])) ? (s as JsonField['type']) : 'string';
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { name: 'field', type: 'string', description: '' };
  }
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name : 'field';
  const type = toType(r.type);
  const description = typeof r.description === 'string' ? r.description : humanizeKey(name);
  const field: JsonField = { name, type, description: description || humanizeKey(name) };
  if (Array.isArray(r.children) && r.children.length > 0) {
    field.children = r.children.map((c: unknown) => normalizeTemplateField(c));
  }
  if (r.items !== null && r.items !== undefined && typeof r.items === 'object' && !Array.isArray(r.items)) {
    field.items = normalizeTemplateField(r.items);
  }
  return field;
}

/** Infer template schema (fields) from a JSON object or array. Uses key name as description when not from JSON Schema. */
function jsonToTemplateSchema(json: unknown): { fields: JsonField[] } {
  if (isAlreadyTemplateSchema(json)) {
    const fields = json.fields.map((f: unknown) => normalizeTemplateField(f));
    ensureDescriptions(fields);
    return { fields };
  }
  function inferType(value: unknown): JsonField['type'] {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }
  function valueToField(name: string, value: unknown, descriptionOverride?: string): JsonField {
    const type = inferType(value);
    const description = (descriptionOverride && descriptionOverride.trim()) ? descriptionOverride : humanizeKey(name || 'field');
    const field: JsonField = { name: name || 'field', type, description: description || humanizeKey(name || 'field') };
    if (type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      field.children = Object.keys(obj).map((k) => valueToField(k, obj[k]));
    }
    if (type === 'array' && Array.isArray(value)) {
      const first = value[0];
      field.items = first !== undefined && first !== null
        ? valueToField('item', first)
        : { name: 'item', type: 'string', description: humanizeKey('item') };
    }
    return field;
  }
  const validTypes: JsonField['type'][] = ['string', 'number', 'integer', 'boolean', 'object', 'array'];
  function toFieldType(s: string): JsonField['type'] {
    return validTypes.includes(s as JsonField['type']) ? (s as JsonField['type']) : 'string';
  }
  /** Convert JSON Schema (properties + type/description per prop) to our fields. */
  function fromJsonSchema(schema: Record<string, unknown>): { fields: JsonField[] } | null {
    const props = schema.properties as Record<string, unknown> | undefined;
    if (!props || typeof props !== 'object') return null;
    const fields: JsonField[] = [];
    for (const [key, prop] of Object.entries(props)) {
      if (typeof prop !== 'object' || prop === null) continue;
      const p = prop as Record<string, unknown>;
      const type = toFieldType((p.type as string) || 'string');
      const desc = (typeof p.description === 'string' && p.description.trim()) ? p.description : humanizeKey(key);
      const field: JsonField = { name: key, type, description: desc };
      if (type === 'object' && p.properties) {
        const child = fromJsonSchema(p as Record<string, unknown>);
        field.children = child?.fields ?? [];
      }
      if (type === 'array' && p.items && typeof p.items === 'object') {
        const itemSchema = p.items as Record<string, unknown>;
        const itemType = toFieldType((itemSchema.type as string) || 'string');
        const itemDesc = (typeof itemSchema.description === 'string' && itemSchema.description.trim())
          ? itemSchema.description
          : humanizeKey('item');
        field.items = { name: 'item', type: itemType, description: itemDesc };
        if (itemType === 'object' && itemSchema.properties) {
          const child = fromJsonSchema(itemSchema);
          if (field.items) (field.items as JsonField).children = child?.fields ?? [];
        }
      }
      fields.push(field);
    }
    return { fields };
  }
  let result: { fields: JsonField[] };
  if (json !== null && typeof json === 'object' && !Array.isArray(json)) {
    const obj = json as Record<string, unknown>;
    const fromSchema = fromJsonSchema(obj);
    if (fromSchema?.fields.length) {
      result = fromSchema;
    } else {
      result = { fields: Object.keys(obj).map((k) => valueToField(k, obj[k])) };
    }
  } else if (Array.isArray(json)) {
    const item = json[0];
    const itemsField = item !== undefined && item !== null
      ? valueToField('item', item)
      : { name: 'item', type: 'string', description: humanizeKey('item') };
    result = { fields: [{ name: 'items', type: 'array', description: humanizeKey('items'), items: itemsField }] };
  } else if (json !== null && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    result = { fields: Object.keys(obj).map((k) => valueToField(k, obj[k])) };
  } else {
    result = { fields: [valueToField('value', json)] };
  }
  ensureDescriptions(result.fields);
  return result;
}

const JsonFieldEditor: React.FC<{
  field: JsonField;
  onChange: (next: JsonField) => void;
  onRemove?: () => void;
  depth?: number;
}> = ({ field, onChange, onRemove, depth = 0 }) => {
  const { t } = useTranslation();
  const isObject = field.type === 'object';
  const isArray = field.type === 'array';
  const children = field.children ?? [];
  const itemSchema = field.items ?? null;

  const update = (patch: Partial<JsonField>) => onChange({ ...field, ...patch });

  const addChild = () =>
    update({ children: [...children, { name: '', type: 'string', description: '' }] });
  const updateChild = (i: number, next: JsonField) =>
    update({ children: children.map((c, j) => (j === i ? next : c)) });
  const removeChild = (i: number) =>
    update({ children: children.filter((_, j) => j !== i) });

  const setItemSchema = (next: JsonField | null) => update({ items: next });

  return (
    <div className="space-y-2" style={{ marginLeft: depth * 12 }}>
      <div className="flex gap-2 items-start bg-slate-50 rounded-lg p-3">
        <div className="flex-1 grid grid-cols-3 gap-2">
          <input
            placeholder={t('templates.fieldName') || 'Field name'}
            value={field.name}
            onChange={(e) => update({ name: e.target.value })}
            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={field.type}
            onChange={(e) => {
              const newType = e.target.value as JsonField['type'];
              if (newType === 'object') update({ type: newType, children: children.length ? children : [], items: undefined });
              else if (newType === 'array') update({ type: newType, items: itemSchema ?? null, children: undefined });
              else update({ type: newType, children: undefined, items: undefined });
            }}
            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ALL_FIELD_TYPES.map((ty) => (
              <option key={ty} value={ty}>{ty}</option>
            ))}
          </select>
          <input
            placeholder={t('templates.fieldDescription') || 'Description'}
            value={typeof field.description === 'string' ? field.description : ''}
            onChange={(e) => update({ description: e.target.value })}
            className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500 mt-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isObject && (
        <div className="pl-2 border-l-2 border-purple-200 space-y-2">
          <span className="text-xs font-medium text-slate-500">{t('templates.objectChildren') || 'Object fields'}</span>
          {children.map((child, i) => (
            <JsonFieldEditor
              key={i}
              field={child}
              onChange={(next) => updateChild(i, next)}
              onRemove={() => removeChild(i)}
              depth={depth + 1}
            />
          ))}
          <button
            type="button"
            onClick={addChild}
            className="py-1.5 px-2 border border-dashed border-slate-300 rounded text-slate-500 hover:border-purple-400 hover:text-purple-600 text-xs"
          >
            <Plus className="w-3 h-3 inline mr-1" />{t('templates.addChild') || 'Add child field'}
          </button>
        </div>
      )}
      {isArray && (
        <div className="pl-2 border-l-2 border-blue-200 space-y-2">
          <span className="text-xs font-medium text-slate-500">{t('templates.arrayItems') || 'Item schema (each element)'}</span>
          {itemSchema ? (
            <JsonFieldEditor
              field={itemSchema}
              onChange={setItemSchema}
              onRemove={() => setItemSchema(null)}
              depth={depth + 1}
            />
          ) : (
            <button
              type="button"
              onClick={() => setItemSchema({ name: 'item', type: 'object', description: '', children: [] })}
              className="py-1.5 px-2 border border-dashed border-slate-300 rounded text-slate-500 hover:border-blue-400 hover:text-blue-600 text-xs"
            >
              <Plus className="w-3 h-3 inline mr-1" />{t('templates.defineItemSchema') || 'Define item schema'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const TemplateModal: React.FC<{
  template?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  loading: boolean;
}> = ({ template, onClose, onSave, loading }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [format, setFormat] = useState<OutputFormat>(template?.output_format || 'json');
  const [isPublic, setIsPublic] = useState(template?.is_public || false);

  const initSchema = () => {
    if (template?.schema) return template.schema;
    return defaultSchema(format);
  };

  const [schema, setSchema] = useState<any>(initSchema);
  const [importJsonRaw, setImportJsonRaw] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const changeFormat = (f: OutputFormat) => {
    setFormat(f);
    setSchema(defaultSchema(f));
  };

  // JSON fields editor (supports nested children + array items)
  const jsonFields: JsonField[] = schema.fields || [];
  const addJsonField = () =>
    setSchema({ ...schema, fields: [...jsonFields, { name: '', type: 'string', description: '' }] });
  const updateJsonField = (i: number, next: JsonField) => {
    const fields = [...jsonFields];
    fields[i] = next;
    setSchema({ ...schema, fields });
  };
  const removeJsonField = (i: number) =>
    setSchema({ ...schema, fields: jsonFields.filter((_, idx) => idx !== i) });

  const handleImportJson = () => {
    setImportError(null);
    const raw = importJsonRaw.trim();
    if (!raw) {
      setImportError(t('templates.importJsonEmpty') || 'Paste JSON or upload a file.');
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const { fields } = jsonToTemplateSchema(parsed);
      setSchema((prev: any) => ({ ...prev, fields }));
      setImportJsonRaw('');
      setImportError(null);
    } catch (e) {
      setImportError((e as Error).message || 'Invalid JSON');
    }
  };

  const handleJsonFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '').trim();
        const parsed = JSON.parse(text) as unknown;
        const { fields } = jsonToTemplateSchema(parsed);
        setSchema((prev: any) => ({ ...prev, fields }));
        setImportJsonRaw('');
        setImportError(null);
      } catch (err) {
        setImportError((err as Error).message || 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Excel columns editor
  const excelColumns: ExcelColumn[] = schema.columns || [];
  const addExcelColumn = () =>
    setSchema({ ...schema, columns: [...excelColumns, { name: '', description: '' }] });
  const updateExcelColumn = (i: number, key: keyof ExcelColumn, val: string) => {
    const columns = [...excelColumns];
    columns[i] = { ...columns[i], [key]: val };
    setSchema({ ...schema, columns });
  };
  const removeExcelColumn = (i: number) =>
    setSchema({ ...schema, columns: excelColumns.filter((_, idx) => idx !== i) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, output_format: format, schema, is_public: isPublic });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4 flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">
            {template ? t('common.edit') : t('templates.createTemplate')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" type="button">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('templates.templateName')}</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Invoice Extractor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('templates.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Template description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('templates.outputFormat')}</label>
            <div className="flex gap-3">
              {(['text', 'json', 'excel'] as OutputFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => changeFormat(f)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                    format === f
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t(`templates.format.${f}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Schema builder */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('templates.schema')}</label>

            {format === 'text' && (
              <textarea
                value={schema.template || ''}
                onChange={(e) => setSchema({ template: e.target.value })}
                rows={5}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Invoice #{invoice_number}&#10;Date: {date}&#10;Total: {total}"
              />
            )}

            {format === 'json' && (
              <div className="space-y-3">
                {/* Import from JSON */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <FileJson className="w-4 h-4 text-purple-500" />
                    {t('templates.importFromJson') || 'Chuyển từ JSON thành schema'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-white cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleJsonFileSelect}
                        className="sr-only"
                      />
                      {t('templates.uploadJsonFile') || 'Chọn file JSON'}
                    </label>
                    <button
                      type="button"
                      title={t('templates.convertToSchema') || 'Chuyển thành schema'}
                      onClick={handleImportJson}
                      disabled={!importJsonRaw.trim()}
                      className="px-3 py-1.5 border border-purple-300 rounded-lg text-sm text-purple-700 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('templates.convertToSchema') || 'Chuyển thành schema'}
                    </button>
                  </div>
                  <textarea
                    value={importJsonRaw}
                    onChange={(e) => { setImportJsonRaw(e.target.value); setImportError(null); }}
                    placeholder='{"name": "John", "age": 30, "items": [{"id": 1}]}'
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                  {importError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {importError}
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  {t('templates.schemaHint') || 'Use type "object" for nested fields (Add child), "array" for lists (Define item schema).'}
                </p>
                {jsonFields.map((field, i) => (
                  <JsonFieldEditor
                    key={i}
                    field={field}
                    onChange={(next) => updateJsonField(i, next)}
                    onRemove={() => removeJsonField(i)}
                  />
                ))}
                <button
                  type="button"
                  onClick={addJsonField}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4 inline mr-1" />{t('templates.addField') || 'Add Field'}
                </button>
              </div>
            )}

            {format === 'excel' && (
              <div className="space-y-2">
                {excelColumns.map((col, i) => (
                  <div key={i} className="flex gap-2 items-center bg-slate-50 rounded-lg p-3">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        placeholder="Column name"
                        value={col.name}
                        onChange={(e) => updateExcelColumn(i, 'name', e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        placeholder="Description"
                        value={col.description}
                        onChange={(e) => updateExcelColumn(i, 'description', e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button type="button" onClick={() => removeExcelColumn(i)} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExcelColumn}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4 inline mr-1" />Add Column
                </button>
              </div>
            )}
          </div>

          </div>

          <div className="flex-shrink-0 border-t border-slate-200 p-6 space-y-4 bg-slate-50/50 rounded-b-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-10 h-6 rounded-full transition-colors ${isPublic ? 'bg-blue-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-4' : ''}`} />
              </button>
              <label className="text-sm text-slate-700">{t('templates.isPublic')}</label>
              {isPublic ? <Globe className="w-4 h-4 text-blue-500" /> : <Lock className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('templates.saveTemplate')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const TemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list(100, 0),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => templatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowModal(false);
      showSuccess(t('templates.createSuccess'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => templatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditTemplate(null);
      showSuccess(t('templates.updateSuccess'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDeleteId(null);
      showSuccess(t('templates.deleteSuccess'));
    },
  });

  const templates = data?.data || [];

  const formatBadge = (format: string) => {
    const colors: Record<string, string> = {
      text: 'bg-slate-100 text-slate-700',
      json: 'bg-purple-100 text-purple-700',
      excel: 'bg-green-100 text-green-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${colors[format] || colors.text}`}>
        {format}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('templates.title')}</h1>
          <p className="text-slate-500 mt-1">{templates.length} templates</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('templates.createTemplate')}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('templates.noTemplates')}</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
          >
            {t('templates.createTemplate')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl: any) => (
            <div key={tpl.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Layers className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    <h3 className="font-semibold text-slate-900 truncate">{tpl.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => setEditTemplate(tpl)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(tpl.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {tpl.description && (
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{tpl.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {formatBadge(tpl.output_format)}
                  {tpl.is_public ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <Globe className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Lock className="w-3 h-3" /> Private
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100">
                <button
                  onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                  className="w-full flex items-center justify-between px-5 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <span>Schema preview</span>
                  {expandedId === tpl.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {expandedId === tpl.id && (
                  <pre className="px-5 pb-4 text-xs text-slate-600 font-mono overflow-auto max-h-32 bg-slate-50">
                    {JSON.stringify(tpl.schema, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showModal || editTemplate) && (
        <TemplateModal
          template={editTemplate}
          onClose={() => { setShowModal(false); setEditTemplate(null); }}
          onSave={(data) => {
            if (editTemplate) {
              updateMutation.mutate({ id: editTemplate.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t('common.confirm')}</h3>
            </div>
            <p className="text-slate-600 mb-6">{t('templates.deleteConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
