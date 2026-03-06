import React, { useState, useEffect } from 'react';
import { Download, Eye, Layout, Settings, Save, Link as LinkIcon, Plus, FileText, ChevronRight, ExternalLink, Trash2, CloudUpload, Folder, Edit3, Clock } from 'lucide-react';
import EditorCanvas from './EditorCanvas';
import TooltipEditor from './TooltipEditor';
import LinkEditor from './LinkEditor';
import { generateDownload } from './utils/export';
import { supabase } from '../../lib/supabase';

const ManualManagement = () => {
    const [view, setView] = useState('list'); // 'list' or 'editor'
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

    // Existing manuals (Hardcoded based on the 'manual' folder content)
    const existingManuals = [
        { id: 'm1', title: 'マニュアル 01', file: 'manualのmanual01.html', date: '2025-10-01' },
        { id: 'm2', title: 'マニュアル 02', file: 'manualのmanual02.html', date: '2025-11-15' },
        { id: 'm3', title: 'マニュアル 03', file: 'manualのmanual03.html', date: '2026-01-20' },
        { id: 'm4', title: '概要書面マニュアル新人向け', file: '概要書面マニュアル新人向け/index.html', date: '2026-03-02' },
        { id: 'm5', title: '電算システム新人向けマニュアル', file: '電算システム新人向けマニュアル/index-.html', date: '2026-03-02' },
        { id: 'm6', title: 'サービスマニュアル (Servicemanual)', file: 'Servicemanual.html', date: '2026-03-03' },
    ];

    useEffect(() => {
        if (view === 'list') {
            fetchManagedManuals();
        }
    }, [view]);

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

    const handleExportHtml = () => {
        if (!imageSrc) return alert('画像をアップロードしてください。');
        generateDownload(imageSrc, hotspots, links);
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

    const openManual = (filename) => {
        window.open(`/manual/${filename}`, '_blank');
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
                                    <div key={category} className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-500 pb-2 border-b border-slate-100 uppercase tracking-widest">
                                            <Folder size={16} className="text-indigo-400" />
                                            {category}
                                            <span className="text-[10px] font-medium bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400">
                                                {items.length}
                                            </span>
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {items.map(manual => (
                                                <div
                                                    key={manual.id}
                                                    className="group bg-white p-5 rounded-2xl border border-indigo-50 border-white shadow-sm hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer relative"
                                                >
                                                    <div className="flex items-start gap-4" onClick={() => handleEditManual(manual)}>
                                                        <div className="w-14 h-14 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                                                            <CloudUpload size={28} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Project</span>
                                                            </div>
                                                            <h3 className="font-bold text-slate-800 tracking-tight mt-1 truncate group-hover:text-indigo-600">{manual.title}</h3>
                                                            <p className="text-[10px] text-slate-400 mt-1">最終更新: {new Date(manual.updated_at).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="absolute top-4 right-4 flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => handleDeleteManagedManual(e, manual.id)}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title="削除"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <ChevronRight size={18} className="text-slate-200 group-hover:text-indigo-600 transition-all translate-x-1 group-hover:translate-x-2" />
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

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {existingManuals.map(manual => (
                                    <div
                                        key={manual.id}
                                        onClick={() => openManual(manual.file)}
                                        className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-xl transition-all cursor-pointer flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-all shrink-0">
                                                <FileText size={24} />
                                            </div>
                                            <div className="truncate">
                                                <h3 className="font-bold text-slate-800 tracking-tight truncate">{manual.title}</h3>
                                                <p className="text-[10px] text-slate-400 mt-1">一式フォルダ格納済み ({manual.date})</p>
                                            </div>
                                        </div>
                                        <ExternalLink size={16} className="text-slate-300 group-hover:text-slate-600 transition-all shrink-0" />
                                    </div>
                                ))}
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
