import React, { useState, useEffect } from 'react';
import { Download, Eye, Layout, Settings, Save, Link as LinkIcon, Plus, FileText, ChevronRight, ExternalLink, Trash2, CloudUpload, Folder, Edit3, Clock } from 'lucide-react';
import EditorCanvas from './EditorCanvas';
import TooltipEditor from './TooltipEditor';
import LinkEditor from './LinkEditor';
import { generateDownload, getManualHtml } from './utils/export';
import { supabase } from '../../lib/supabase';

const ManualManagement = () => {
    const [view, setView] = useState('list'); // 'list', 'editor', 'viewer'
    const [viewerUrl, setViewerUrl] = useState('');
    const [viewerPack, setViewerPack] = useState([]); // List of files in the current pack
    const [imageSrc, setImageSrc] = useState(null);
    const [hotspots, setHotspots] = useState([]);
    const [links, setLinks] = useState([]);
    const [manualTitle, setManualTitle] = useState('新規マニュアル');
    const [editingManualId, setEditingManualId] = useState(null);
    const [managedManuals, setManagedManuals] = useState([]);
    const [selectedHotspotId, setSelectedHotspotId] = useState(null);
    const [selectedLinkId, setSelectedLinkId] = useState(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [manualCategory, setManualCategory] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [existingManuals, setExistingManuals] = useState([
        { id: 'm1', title: 'マニュアル 01', file: 'manualのmanual01.html', date: '2025-10-01', category: '未分類' },
        { id: 'm2', title: 'マニュアル 02', file: 'manualのmanual02.html', date: '2025-11-15', category: '未分類' },
        { id: 'm3', title: 'マニュアル 03', file: 'manualのmanual03.html', date: '2026-01-20', category: '未分類' },
        { id: 'm4', title: '概要書面マニュアル新人向け', file: '概要書面マニュアル新人向け/index.html', date: '2026-03-02', category: '概要書面マニュアル新人向け' },
        { id: 'm5', title: '電算システム新人向けマニュアル', file: '電算システム新人向けマニュアル/index-.html', date: '2026-03-02', category: '電算システム新人向けマニュアル' },
        { id: 'm6', title: 'サービスマニュアル (Servicemanual)', file: 'Servicemanual.html', date: '2026-03-03', category: '未分類' },
    ]);

    useEffect(() => {
        if (view === 'list') {
            fetchManagedManuals();
            fetchExistingFiles();
        }
    }, [view]);

    const fetchExistingFiles = async () => {
        try {
            const response = await fetch('/api/list-manuals');
            if (response.ok) {
                const result = await response.json();
                if (result.success) setExistingManuals(result.files);
            }
        } catch (err) {
            console.error('Failed to fetch local manual files:', err);
        }
    };

    const fetchManagedManuals = async () => {
        try {
            const { data, error } = await supabase
                .from('manuals')
                .select('*')
                .order('updated_at', { ascending: false });
            if (error) throw error;
            setManagedManuals(data || []);
        } catch (err) {
            console.error('Failed to fetch manuals:', err);
        }
    };

    const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId);
    const selectedLink = links.find(l => l.id === selectedLinkId);

    // --- Handlers ---
    const handleAddHotspot = ({ x, y }) => {
        if (selectedLinkId) setSelectedLinkId(null);
        const newId = crypto.randomUUID();
        const nextNumber = hotspots.length + 1;
        const newHotspot = {
            id: newId, x, y, type: 'info',
            icon: nextNumber.toString(),
            title: '新規項目',
            content: '説明文を入力してください...',
            note: ''
        };
        setHotspots([...hotspots, newHotspot]);
        setSelectedHotspotId(newId);
    };

    const handleUpdateHotspot = (id, updates) => {
        setHotspots(hotspots.map(h => h.id === id ? { ...h, ...updates } : h));
    };

    const handleDeleteHotspot = (id) => {
        setHotspots(hotspots.filter(h => h.id !== id));
        if (selectedHotspotId === id) setSelectedHotspotId(null);
    };

    const handleAddLink = () => {
        if (!imageSrc) return alert('まず画像をアップロードしてください。');
        const newId = crypto.randomUUID();
        const newLink = { id: newId, x: 50, y: 50, label: '次のページへ', url: '#' };
        setLinks([...links, newLink]);
        setSelectedLinkId(newId);
        setSelectedHotspotId(null);
    };

    const handleUpdateLink = (id, updates) => {
        setLinks(links.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const handleDeleteLink = (id) => {
        setLinks(links.filter(l => l.id !== id));
        if (selectedLinkId === id) setSelectedLinkId(null);
    };

    const handleSaveProject = () => {
        const projectData = { version: '1.1.0', imageSrc, hotspots, links, title: manualTitle };
        const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manualTitle || 'manual-project'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSaveToServer = async (silent = false) => {
        if (!imageSrc) {
            if (!silent) alert('保存する前にスクリーンショット画像をアップロードしてください。');
            return;
        }
        if (!manualTitle) {
            if (!silent) alert('マニュアルのタイトルを入力してください。');
            return;
        }

        if (!silent) setIsSaving(true);
        try {
            const projectData = { imageSrc, hotspots, links };
            const { data, error } = await supabase
                .from('manuals')
                .upsert({
                    id: editingManualId || crypto.randomUUID(),
                    title: manualTitle,
                    category: manualCategory || null,
                    project_data: projectData,
                    updated_at: new Date().toISOString()
                })
                .select();

            if (error) throw error;
            if (data && data[0]) {
                if (!editingManualId) setEditingManualId(data[0].id);
            }
            if (!silent) {
                alert('サーバーに保存しました。');
                setView('list');
            }
        } catch (err) {
            if (!silent) alert('サーバーへの保存に失敗しました: ' + err.message);
        } finally {
            if (!silent) setIsSaving(false);
        }
    };

    // Auto-save logic
    useEffect(() => {
        if (view === 'editor' && imageSrc) {
            const timer = setTimeout(() => {
                handleSaveToServer(true);
            }, 3000); // Auto-save after 3s of no changes
            return () => clearTimeout(timer);
        }
    }, [imageSrc, hotspots, links, manualTitle]);

    const handleEditManual = (manual) => {
        setEditingManualId(manual.id);
        setManualTitle(manual.title);
        setManualCategory(manual.category || '');
        setImageSrc(manual.project_data.imageSrc);
        setHotspots(manual.project_data.hotspots || []);
        setLinks(manual.project_data.links || []);
        setView('editor');
    };

    const handleDeleteManagedManual = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('このマニュアルを完全に削除してもよろしいですか？')) return;

        try {
            const { error } = await supabase
                .from('manuals')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setManagedManuals(managedManuals.filter(m => m.id !== id));
        } catch (err) {
            alert('削除に失敗しました: ' + err.message);
        }
    };

    const handleNewManual = () => {
        setEditingManualId(null);
        setManualCategory('');
        setImageSrc(null);
        setHotspots([]);
        setLinks([]);
        setView('editor');
    };

    const handleExportHtml = async () => {
        if (!imageSrc) return alert('画像をアップロードしてください。');

        // Ask for a filename
        const defaultFilename = manualTitle ? `${manualTitle}.html` : 'manual.html';
        const filename = window.prompt('保存するファイル名を入力してください (例: step1.html)', defaultFilename);

        if (!filename) return;

        const safeFilename = filename.endsWith('.html') ? filename : `${filename}.html`;
        const htmlContent = getManualHtml(imageSrc, hotspots, links);

        try {
            // First attempt: Save to local public/manual directory via Vite API
            const response = await fetch('/api/save-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: safeFilename, content: htmlContent })
            });

            if (response.ok) {
                const result = await response.json();
                alert(`マニュアルを自動保存しました！\n場所: public/manual/${safeFilename}`);
                fetchExistingFiles(); // Refresh the list
            } else {
                throw new Error('Local save API not available or failed');
            }
        } catch (err) {
            // Fallback: Standard browser download
            console.warn('Local save failed, falling back to download:', err);
            generateDownload(imageSrc, hotspots, links);
        }
    };

    const handleLoadProject = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.imageSrc) setImageSrc(data.imageSrc);
                if (data.hotspots) setHotspots(data.hotspots);
                if (data.links) setLinks(data.links);
            } catch (err) {
                alert('プロジェクトファイルの読み込みに失敗しました。');
            }
        };
        reader.readAsText(file);
    };

    const openManual = (filename, pack = []) => {
        setViewerUrl(`/manual/${filename}`);
        setViewerPack(pack);
        setView('viewer');
    };

    return (
        <div className="manual-container flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Header Area */}
            <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="text-indigo-600" /> マニュアル管理
                    </h2>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setView('list')}
                        >
                            マニュアル一覧
                        </button>
                        <button
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'editor' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setView('editor')}
                        >
                            マニュアル新規作成
                        </button>
                    </div>
                </div>

                {view === 'editor' && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg mr-4">
                            <span className="text-xs font-bold text-slate-400">タイトル:</span>
                            <input
                                type="text"
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 min-w-[150px]"
                                placeholder="タイトル..."
                            />
                            <div className="h-4 w-px bg-slate-200 mx-1"></div>
                            <input
                                type="text"
                                value={manualCategory}
                                onChange={(e) => setManualCategory(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-400 min-w-[120px]"
                                placeholder="カテゴリー名入力..."
                            />
                        </div>
                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all border border-slate-200">
                            <Settings size={14} /> 読込 (JSON)
                            <input type="file" className="hidden" accept=".json" onChange={handleLoadProject} />
                        </label>
                        <button onClick={() => handleSaveToServer(false)} disabled={isSaving} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-indigo-200">
                            <CloudUpload size={14} /> {isSaving ? '保存中...' : 'サーバー保存'}
                        </button>
                        <button onClick={handleExportHtml} className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-200 transition-all">
                            <Download size={14} /> HTML書出
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {view === 'list' ? (
                    <div className="p-8 max-w-6xl mx-auto space-y-12 pb-20 overflow-y-auto h-full">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Layout className="text-indigo-600" /> 編集中のプロジェクト
                                    </h3>
                                    <p className="text-slate-400 text-sm mt-1">サーバーに保存され、いつでも再編集可能な下書きや進行中のマニュアルです。</p>
                                </div>
                                <button
                                    onClick={handleNewManual}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 transition-all"
                                >
                                    <Plus size={18} /> 新規作成開始
                                </button>
                            </div>

                            <div className="space-y-10">
                                {Object.entries(
                                    managedManuals.reduce((acc, manual) => {
                                        const category = manual.category || '未分類';
                                        if (!acc[category]) acc[category] = [];
                                        acc[category].push(manual);
                                        return acc;
                                    }, {})
                                ).map(([category, items]) => (
                                    <div key={category} className="bg-white/40 backdrop-blur-xl rounded-3xl border border-white/60 p-6 shadow-xl shadow-indigo-500/5">
                                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-indigo-100/50">
                                            <h4 className="flex items-center gap-3 text-lg font-black text-slate-700 tracking-tight">
                                                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                                                    <Folder size={20} />
                                                </div>
                                                {category}
                                                <span className="text-xs font-bold bg-indigo-50 text-indigo-500 px-3 py-1 rounded-full border border-indigo-100/50">
                                                    {items.length} ページ
                                                </span>
                                            </h4>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manual Pack</div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {items.sort((a, b) => a.title.localeCompare(b.title)).map(manual => (
                                                <div
                                                    key={manual.id}
                                                    className="group bg-white/60 p-4 rounded-2xl border border-white hover:border-indigo-400 hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer relative overflow-hidden"
                                                    onClick={() => handleEditManual(manual)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                            <FileText size={20} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-600">
                                                                {manual.title}
                                                            </h3>
                                                            <p className="text-[9px] text-slate-400 mt-0.5">
                                                                更新: {new Date(manual.updated_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteManagedManual(e, manual.id);
                                                            }}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                        <ChevronRight size={14} className="text-indigo-300" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-200">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="text-slate-500" /> 完成済みのマニュアル
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">HTMLファイルとして構成済みの一括閲覧用マニュアルです。</p>
                            </div>

                            <div className="space-y-8">
                                {Object.entries(
                                    existingManuals.reduce((acc, manual) => {
                                        const category = manual.category || '未分類';
                                        if (!acc[category]) acc[category] = [];
                                        acc[category].push(manual);
                                        return acc;
                                    }, {})
                                ).map(([category, items]) => (
                                    <div key={category} className="bg-slate-100/50 rounded-2xl p-6 border border-slate-200/50">
                                        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">
                                            <Folder size={14} /> {category} ({items.length})
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {items.map(manual => (
                                                <div
                                                    key={manual.id}
                                                    onClick={() => openManual(manual.file, items)}
                                                    className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                                                            <FileText size={20} />
                                                        </div>
                                                        <div className="truncate">
                                                            <h3 className="font-bold text-slate-700 text-sm tracking-tight truncate group-hover:text-indigo-600">{manual.title}</h3>
                                                            <p className="text-[9px] text-slate-400 mt-0.5">{manual.date}</p>
                                                        </div>
                                                    </div>
                                                    <ExternalLink size={14} className="text-slate-300 group-hover:text-indigo-400 transition-all shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : view === 'viewer' ? (
                    <div className="flex flex-col h-full bg-slate-900 overflow-hidden relative">
                        {/* Viewer Header / Toolbar */}
                        <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setView('list')}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all"
                                >
                                    <ChevronRight className="rotate-180" size={14} /> 一覧に戻る
                                </button>
                                <div className="h-4 w-px bg-white/20"></div>
                                <div className="text-sm font-bold truncate max-w-md flex items-center gap-2 text-slate-300">
                                    <FileText size={16} /> Viewing: {viewerUrl.split('/').pop()}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.open(viewerUrl, '_blank')}
                                    className="p-2 text-slate-400 hover:text-white transition-all"
                                    title="別タブで開く"
                                >
                                    <ExternalLink size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Iframe & Navigation Wrapper */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Viewer Sidebar (Pack Contents) */}
                            {viewerPack.length > 1 && (
                                <div className="w-64 bg-slate-800 border-r border-white/10 overflow-y-auto shrink-0 hidden md:block">
                                    <div className="p-4 border-b border-white/5">
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Folder size={12} /> Manual Pack Contents
                                        </h5>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {viewerPack.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setViewerUrl(`/manual/${f.file}`)}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-3 ${viewerUrl.includes(f.file) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${viewerUrl.includes(f.file) ? 'bg-white' : 'bg-slate-600'}`}></div>
                                                <span className="truncate">{f.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Iframe for same-window experience */}
                            <div className="flex-1 bg-white relative">
                                <iframe
                                    src={viewerUrl}
                                    className="w-full h-full border-none"
                                    title="Manual Viewer"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full overflow-hidden relative">
                        {/* Sidebar (Editor Tools) */}
                        <div className="w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-6 shrink-0">
                            <button
                                onClick={handleAddLink}
                                className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="リンクボタンを追加"
                            >
                                <LinkIcon size={24} />
                            </button>
                            <div className="h-px w-10 bg-slate-200"></div>
                            <button
                                onClick={() => setIsPreviewMode(!isPreviewMode)}
                                className={`p-3 rounded-xl transition-all ${isPreviewMode ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                title="プレビューモード"
                            >
                                <Eye size={24} />
                            </button>
                        </div>

                        {/* Main Editor Canvas */}
                        <div className="flex-1 flex overflow-hidden relative bg-slate-100">
                            <EditorCanvas
                                imageSrc={imageSrc}
                                onImageUpload={setImageSrc}
                                hotspots={hotspots}
                                selectedHotspotId={selectedHotspotId}
                                onAddHotspot={handleAddHotspot}
                                onSelectHotspot={(id) => { setSelectedHotspotId(id); setSelectedLinkId(null); }}
                                onUpdateHotspotPosition={handleUpdateHotspot}

                                links={links}
                                selectedLinkId={selectedLinkId}
                                onSelectLink={(id) => { setSelectedLinkId(id); setSelectedHotspotId(null); }}
                                onUpdateLinkPosition={handleUpdateLink}

                                isPreviewMode={isPreviewMode}
                            />

                            {/* Properties (Right) */}
                            {selectedHotspot && !isPreviewMode && (
                                <TooltipEditor
                                    hotspot={selectedHotspot}
                                    onChange={handleUpdateHotspot}
                                    onDelete={handleDeleteHotspot}
                                    onClose={() => setSelectedHotspotId(null)}
                                />
                            )}
                            {selectedLink && !isPreviewMode && (
                                <LinkEditor
                                    link={selectedLink}
                                    onChange={handleUpdateLink}
                                    onDelete={handleDeleteLink}
                                    onClose={() => setSelectedLinkId(null)}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualManagement;
