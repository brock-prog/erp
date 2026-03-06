import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Edit2, Check, X, List } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { generateId } from '../../utils';
import type { DropdownList, DropdownItem } from '../../types';

// ─── Component ────────────────────────────────────────────────────────────────

export function DropdownManager() {
  const { state, dispatch } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(
    state.customDropdowns[0]?.id ?? null,
  );
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListKey, setNewListKey] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [showNewList, setShowNewList] = useState(false);

  const selected = state.customDropdowns.find(d => d.id === selectedId) ?? null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function save(list: DropdownList) {
    dispatch({ type: 'SET_DROPDOWN_LIST', payload: list });
  }

  function addList() {
    if (!newListName.trim()) return;
    const key = newListKey.trim() || newListName.trim().replace(/\s+/g, '_').toLowerCase();
    const id = `dl-${generateId()}`;
    const list: DropdownList = {
      id, name: newListName.trim(), systemKey: key,
      description: newListDesc.trim() || undefined, items: [],
    };
    save(list);
    setSelectedId(id);
    setNewListName(''); setNewListKey(''); setNewListDesc('');
    setShowNewList(false);
  }

  function deleteList(id: string) {
    dispatch({ type: 'DELETE_DROPDOWN_LIST', payload: id });
    if (selectedId === id) setSelectedId(state.customDropdowns.find(d => d.id !== id)?.id ?? null);
  }

  function addItem() {
    if (!selected) return;
    const id = generateId();
    const maxOrder = selected.items.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    const item: DropdownItem = { id, label: 'New Option', value: 'new_option', active: true, sortOrder: maxOrder + 1 };
    save({ ...selected, items: [...selected.items, item] });
    setEditingItemId(id);
  }

  function updateItem(itemId: string, patch: Partial<DropdownItem>) {
    if (!selected) return;
    save({ ...selected, items: selected.items.map(i => i.id === itemId ? { ...i, ...patch } : i) });
  }

  function deleteItem(itemId: string) {
    if (!selected) return;
    save({ ...selected, items: selected.items.filter(i => i.id !== itemId) });
    if (editingItemId === itemId) setEditingItemId(null);
  }

  function moveItem(itemId: string, dir: 'up' | 'down') {
    if (!selected) return;
    const sorted = [...selected.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(i => i.id === itemId);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx].sortOrder;
    const b = sorted[swapIdx].sortOrder;
    save({
      ...selected,
      items: selected.items.map(i => {
        if (i.id === sorted[idx].id) return { ...i, sortOrder: b };
        if (i.id === sorted[swapIdx].id) return { ...i, sortOrder: a };
        return i;
      }),
    });
  }

  const sortedItems = selected
    ? [...selected.items].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 h-full">
      {/* Left panel — list of dropdown groups */}
      <div className="w-64 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dropdown Lists</h3>
          <button
            onClick={() => setShowNewList(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <Plus size={12} /> New
          </button>
        </div>

        {showNewList && (
          <div className="border border-brand-200 bg-brand-50 rounded-xl p-3 space-y-2">
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30"
              placeholder="List name *"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addList(); if (e.key === 'Escape') setShowNewList(false); }}
            />
            <input
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30"
              placeholder="System key (auto from name)"
              value={newListKey}
              onChange={e => setNewListKey(e.target.value)}
            />
            <input
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30"
              placeholder="Description (optional)"
              value={newListDesc}
              onChange={e => setNewListDesc(e.target.value)}
            />
            <div className="flex gap-1.5">
              <button onClick={addList} disabled={!newListName.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 transition-colors">
                Create
              </button>
              <button onClick={() => setShowNewList(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {state.customDropdowns.map(dl => (
            <div key={dl.id} className="group relative">
              {editingListId === dl.id ? (
                <EditListNameRow
                  dl={dl}
                  onSave={(name, desc) => { save({ ...dl, name, description: desc }); setEditingListId(null); }}
                  onCancel={() => setEditingListId(null)}
                />
              ) : (
                <button
                  onClick={() => setSelectedId(dl.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
                    selectedId === dl.id
                      ? 'bg-brand-600 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <List size={13} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{dl.name}</span>
                  <span className={`text-[10px] font-normal ${selectedId === dl.id ? 'text-white/70' : 'text-gray-400'}`}>
                    {dl.items.filter(i => i.active).length}
                  </span>
                </button>
              )}
              {editingListId !== dl.id && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  <button onClick={() => setEditingListId(dl.id)}
                    className={`p-1 rounded ${selectedId === dl.id ? 'text-white/80 hover:bg-white/20' : 'text-gray-400 hover:bg-gray-200'}`}>
                    <Edit2 size={11} />
                  </button>
                  <button onClick={() => deleteList(dl.id)}
                    className={`p-1 rounded ${selectedId === dl.id ? 'text-white/80 hover:bg-red-400/30' : 'text-red-400 hover:bg-red-50'}`}>
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — items editor */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
            Select a dropdown list to edit its options
          </div>
        ) : (
          <Card padding={false}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-bold text-gray-900 text-sm">{selected.name}</div>
                {selected.description && <div className="text-xs text-gray-400 mt-0.5">{selected.description}</div>}
                <div className="text-[10px] text-gray-400 mt-0.5 font-mono">key: {selected.systemKey}</div>
              </div>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <Plus size={13} /> Add Option
              </button>
            </div>

            {/* Items table */}
            {sortedItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No options yet — click "Add Option" to get started
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sortedItems.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isFirst={idx === 0}
                    isLast={idx === sortedItems.length - 1}
                    isEditing={editingItemId === item.id}
                    onEdit={() => setEditingItemId(item.id)}
                    onDoneEdit={() => setEditingItemId(null)}
                    onChange={patch => updateItem(item.id, patch)}
                    onDelete={() => deleteItem(item.id)}
                    onMoveUp={() => moveItem(item.id, 'up')}
                    onMoveDown={() => moveItem(item.id, 'down')}
                  />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EditListNameRow({
  dl, onSave, onCancel,
}: {
  dl: DropdownList;
  onSave: (name: string, desc: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(dl.name);
  const [desc, setDesc] = useState(dl.description ?? '');
  return (
    <div className="border border-brand-200 bg-brand-50 rounded-xl p-2 space-y-1.5">
      <input autoFocus className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30"
        value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(name, desc); if (e.key === 'Escape') onCancel(); }}
      />
      <input className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30"
        value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description"
      />
      <div className="flex gap-1">
        <button onClick={() => onSave(name, desc)} className="flex-1 py-1 rounded-lg text-[11px] font-semibold bg-brand-600 text-white hover:bg-brand-700">Save</button>
        <button onClick={onCancel} className="px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:bg-gray-100">✕</button>
      </div>
    </div>
  );
}

function ItemRow({
  item, isFirst, isLast, isEditing,
  onEdit, onDoneEdit, onChange, onDelete, onMoveUp, onMoveDown,
}: {
  item: DropdownItem;
  isFirst: boolean; isLast: boolean; isEditing: boolean;
  onEdit: () => void; onDoneEdit: () => void;
  onChange: (patch: Partial<DropdownItem>) => void;
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [value, setValue] = useState(item.value);

  function commit() {
    onChange({ label: label.trim() || item.label, value: value.trim() || item.value });
    onDoneEdit();
  }

  if (isEditing) {
    return (
      <div className="px-4 py-2.5 bg-brand-50/50 flex items-center gap-3">
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Display Label</label>
            <input autoFocus
              className="w-full border border-brand-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30"
              value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onDoneEdit(); }}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Stored Value</label>
            <input
              className="w-full border border-brand-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400/30 font-mono"
              value={value} onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onDoneEdit(); }}
            />
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer flex-shrink-0">
          <input type="checkbox" checked={item.active} onChange={e => onChange({ active: e.target.checked })} className="rounded" />
          Active
        </label>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={commit} className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"><Check size={13} /></button>
          <button onClick={onDoneEdit} className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"><X size={13} /></button>
        </div>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"><Trash2 size={13} /></button>
      </div>
    );
  }

  return (
    <div className={`px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 group transition-colors ${!item.active ? 'opacity-50' : ''}`}>
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"><ChevronUp size={13} /></button>
        <button onClick={onMoveDown} disabled={isLast} className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"><ChevronDown size={13} /></button>
      </div>
      <div className="w-5 h-5 rounded-md bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-600 flex-shrink-0">
        {item.sortOrder}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800">{item.label}</div>
        <div className="text-[10px] text-gray-400 font-mono">{item.value}</div>
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        {item.active ? 'Active' : 'Hidden'}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-50 transition-colors"><Edit2 size={13} /></button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}
