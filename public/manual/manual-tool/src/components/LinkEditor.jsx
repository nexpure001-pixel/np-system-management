import React from 'react';
import { Trash2, X, Link as LinkIcon, ExternalLink, FileSearch } from 'lucide-react';

const LinkEditor = ({ link, onChange, onDelete, onClose }) => {
    if (!link) {
        return (
            <div className="w-80 bg-slate-900 border-l border-slate-700 p-6 text-slate-400 flex flex-col items-center justify-center text-center">
                <p>編集するリンクを選択してください</p>
            </div>
        );
    }

    const handleChange = (field, value) => {
        onChange(link.id, { [field]: value });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleChange('url', file.name);
        }
    };

    return (
        <div className="w-80 bg-white/60 backdrop-blur-xl border-l border-white/40 flex flex-col h-full text-slate-800 shadow-xl z-50 overflow-y-auto">
            <div className="p-4 border-b border-white/30 flex items-center justify-between bg-white/30">
                <h2 className="font-bold text-sm tracking-wide text-slate-800">リンク設定</h2>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                    <X size={16} />
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="flex items-center justify-center p-4 bg-white/40 rounded-lg mb-6 border border-white/50 border-dashed shadow-inner">
                    <LinkIcon size={32} className="text-indigo-500 mb-2" />
                    <p className="text-xs text-slate-500 text-center w-full">ページ遷移ボタン</p>
                </div>

                {/* Label Input */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">ボタンのラベル</label>
                    <input
                        type="text"
                        value={link.label}
                        onChange={(e) => handleChange('label', e.target.value)}
                        className="w-full bg-white/50 border border-white/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors shadow-sm"
                        placeholder="次のページへ"
                    />
                </div>

                {/* URL Input */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                        遷移先 URL / ファイル名
                        <ExternalLink size={10} />
                    </label>
                    <input
                        type="text"
                        value={link.url}
                        onChange={(e) => handleChange('url', e.target.value)}
                        className="w-full bg-white/50 border border-white/50 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors font-mono text-xs shadow-sm"
                        placeholder="page2.html"
                    />
                    <div className="flex gap-2 mt-2">
                        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/50 hover:bg-white border border-white/50 rounded text-xs text-slate-600 font-bold cursor-pointer transition-colors shadow-sm">
                            <FileSearch size={14} />
                            ファイルを選択
                            <input
                                type="file"
                                className="hidden"
                                accept=".html,.htm"
                                onChange={handleFileSelect}
                            />
                        </label>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                        同じフォルダ内のHTMLファイル名（例: <code>introduction.html</code>）や、WebサイトのURLを入力できます。
                    </p>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-white/30 mt-auto">
                    <button
                        onClick={() => onDelete(link.id)}
                        className="flex items-center justify-center w-full gap-2 px-4 py-2 bg-red-100/50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-sm font-bold border border-red-200"
                    >
                        <Trash2 size={16} />
                        削除
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LinkEditor;
