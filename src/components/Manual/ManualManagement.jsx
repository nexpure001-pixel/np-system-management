import React, { useState, useEffect } from 'react';
import { Download, Eye, Layout, Settings, Save, Link as LinkIcon, Plus, FileText, ChevronRight, ExternalLink } from 'lucide-react';
import EditorCanvas from './EditorCanvas';
import TooltipEditor from './TooltipEditor';
import LinkEditor from './LinkEditor';
import { generateDownload } from './utils/export';

const ManualManagement = () => {
    const [view, setView] = useState('list'); // 'list' or 'editor'
    const [imageSrc, setImageSrc] = useState(null);
    const [hotspots, setHotspots] = useState([]);
    const [links, setLinks] = useState([]);
    const [selectedHotspotId, setSelectedHotspotId] = useState(null);
    const [selectedLinkId, setSelectedLinkId] = useState(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // Existing manuals (Hardcoded based on the 'manual' folder content)
    const existingManuals = [
        { id: 1, title: 'マニュアル 01', file: 'manualのmanual01.html', date: '2025-10-01' },
        { id: 2, title: 'マニュアル 02', file: 'manualのmanual02.html', date: '2025-11-15' },
        { id: 3, title: 'マニュアル 03', file: 'manualのmanual03.html', date: '2026-01-20' },
        { id: 4, title: '概要書面マニュアル新人向け', file: '概要書面マニュアル新人向け/index.html', date: '2026-03-02' },
        { id: 5, title: '電算システム新人向けマニュアル', file: '電算システム新人向けマニュアル/index-.html', date: '2026-03-02' },
    ];

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
        const projectData = { version: '1.1.0', imageSrc, hotspots, links };
        const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'manual-project.json';
        a.click();
        URL.revokeObjectURL(url);
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
                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all border border-slate-200">
                            <Settings size={14} /> 読込 (JSON)
                            <input type="file" className="hidden" accept=".json" onChange={handleLoadProject} />
                        </label>
                        <button onClick={handleSaveProject} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-all border border-slate-200">
                            <Save size={14} /> 保存 (JSON)
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
                    <div className="p-8 max-w-4xl mx-auto space-y-4">
                        <p className="text-slate-500 text-sm mb-6">既存のマニュアルを閲覧したり、新しいマニュアルを作成することができます。</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {existingManuals.map(manual => (
                                <div
                                    key={manual.id}
                                    onClick={() => openManual(manual.file)}
                                    className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 tracking-tight">{manual.title}</h3>
                                            <p className="text-xs text-slate-400 mt-1">最終更新: {manual.date}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-all" />
                                </div>
                            ))}

                            <div
                                onClick={() => setView('editor')}
                                className="bg-slate-50 p-5 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-center justify-center gap-3 text-slate-400 hover:text-indigo-600"
                            >
                                <Plus size={24} />
                                <span className="font-bold">新しいマニュアルを作成</span>
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
