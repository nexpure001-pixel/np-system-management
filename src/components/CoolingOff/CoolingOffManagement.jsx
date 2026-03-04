import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
    X,
    Star,
    AlertCircle,
    CheckCircle,
    Clock,
    Sparkles
} from 'lucide-react';
import './CoolingOffManagement.css';

const TARGET_DATE_COL_NAMES = ['商品到着日', '初回商品到着日', '初回商品発送日', '契約日'];
const PULLDOWN_KEYS = ['種別', '支払方法', '申出方法', '実績月', '実施月'];

const INITIAL_PULLDOWN_OPTIONS = {
    '種別': ['', 'クーリングオフ', '90日返品ルール適用解約', '特）中途解約', '退会', '特例2ポジキャンセル', '4ポジキャンセル', '商品キャンセル', 'キャンセル'],
    '支払方法': ['', 'カード', '振込み', 'カード/振込', '口座替', '-'],
    '実績月': ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    '実施月': ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    '申出方法': ['', 'ハガキ', '書面', 'メール', 'カスタマー', 'コンタクト', '電話', '電話・メール', '消費者センター', 'その他']
};

const DEFAULT_HEADERS = [
    'No.', '種別', '支払方法', 'お名前', '実績月', '契約日', '初回商品発送日', '解約申出日', '申出方法',
    '登録情報・伝票処理', 'カードキャンセル', '返信メール', '商品到着日', '返金処理日', '返金額', '振込口座', 'リジョン発送', '備考', '入金依頼'
];

const CoolingOffManagement = () => {
    const [headers, setHeaders] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [pulldownOptions, setPulldownOptions] = useState(INITIAL_PULLDOWN_OPTIONS);
    const [sortConfig, setSortConfig] = useState({ key: -1, direction: 'asc' });

    const idleTimerRef = useRef(null);
    const IDLE_TIMEOUT = 10 * 60 * 1000;

    useEffect(() => {
        fetchData();
        resetIdleTimer();

        const events = ['mousemove', 'mousedown', 'keypress', 'touchstart'];
        const handleActivityWrapper = () => {
            if (!isLocked) resetIdleTimer();
        };

        events.forEach(event => window.addEventListener(event, handleActivityWrapper));

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivityWrapper));
            clearTimeout(idleTimerRef.current);
        };
    }, [isLocked]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cooling_off_records')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setHeaders(data.headers || DEFAULT_HEADERS);
                setTableData(data.data || []);
                updatePulldownOptions(data.headers || DEFAULT_HEADERS, data.data || []);
            } else {
                setHeaders(DEFAULT_HEADERS);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setHeaders(DEFAULT_HEADERS);
        } finally {
            setLoading(false);
        }
    };

    const saveData = async (newHeaders, newData) => {
        try {
            const { error } = await supabase
                .from('cooling_off_records')
                .insert([{ headers: newHeaders, data: newData }]);

            if (error) throw error;
            setSaveStatus('記録を星に刻みました 🌟');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (err) {
            console.error('Save error:', err);
            setSaveStatus('更新失敗 ☄️');
        }
    };

    const resetIdleTimer = () => {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setIsLocked(true), IDLE_TIMEOUT);
    };

    const updatePulldownOptions = (currentHeaders, currentData) => {
        const newOptions = { ...INITIAL_PULLDOWN_OPTIONS };
        currentHeaders.forEach((h, c) => {
            if (PULLDOWN_KEYS.includes(h)) {
                const options = new Set(newOptions[h]);
                currentData.forEach(row => {
                    if (row[c]) options.add(row[c].trim());
                });
                newOptions[h] = Array.from(options);
            }
        });
        setPulldownOptions(newOptions);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/);
            if (lines.length === 0) return;

            let headerIndex = 0;
            for (let i = 0; i < Math.min(lines.length, 100); i++) {
                if (lines[i].includes('種別') || lines[i].includes('お名前') || lines[i].includes('入金依頼')) {
                    headerIndex = i;
                    break;
                }
            }

            const rawHeaders = parseCsvLine(lines[headerIndex]);
            let lastValidCol = rawHeaders.length - 1;
            while (lastValidCol >= 0 && !rawHeaders[lastValidCol].trim()) lastValidCol--;

            const tempHeaders = rawHeaders.slice(0, lastValidCol + 1);
            const noIdx = tempHeaders.findIndex(h => h.trim() === 'No.' || h.trim() === 'No');
            const hasReq = tempHeaders.some(h => h.trim() === '入金依頼');

            const filteredHeaders = tempHeaders.filter((_, i) => i !== noIdx);
            if (!hasReq) filteredHeaders.unshift('入金依頼');

            const newData = [];
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && !line.replace(/,/g, '').match(/^$/)) {
                    const row = parseCsvLine(line).slice(0, tempHeaders.length);
                    if (row.join('').trim().length > 0) {
                        let filteredRow = row.filter((_, idx) => idx !== noIdx);
                        if (!hasReq) {
                            filteredRow.unshift(false);
                        } else {
                            const reqColIdx = tempHeaders.findIndex(h => h.trim() === '入金依頼');
                            let actualReqIdx = noIdx !== -1 && reqColIdx > noIdx ? reqColIdx - 1 : reqColIdx;
                            if (actualReqIdx !== -1) {
                                filteredRow[actualReqIdx] = (filteredRow[actualReqIdx] === 'true' || filteredRow[actualReqIdx] === true);
                            }
                        }

                        filteredHeaders.forEach((h, c) => {
                            if (h.includes('日')) filteredRow[c] = standardizeDateStr(filteredRow[c]);
                        });
                        newData.push(filteredRow);
                    }
                }
            }

            setHeaders(filteredHeaders);
            setTableData(newData);
            updatePulldownOptions(filteredHeaders, newData);
            saveData(filteredHeaders, newData);
        };
        reader.readAsText(file);
    };

    const parseCsvLine = (text) => {
        let result = [], current = '', inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
            else current += char;
        }
        result.push(current);
        return result;
    };

    const standardizeDateStr = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
        let s = dateStr.trim();
        let parts = s.match(/(?:(\d{4})[\/\-\年])?(\d{1,2})[\/\-\月](\d{1,2})/);
        if (!parts) return s;
        let year = parts[1] ? parseInt(parts[1]) : new Date().getFullYear();
        if (year < 100) year += 2000;
        return `${year}/${String(parts[2]).padStart(2, '0')}/${String(parts[3]).padStart(2, '0')}`;
    };

    const calculateStatus = (dateStr) => {
        if (!dateStr || dateStr.trim() === '-' || dateStr.trim() === '') return 'unknown';
        let parts = dateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
        if (!parts) return 'unknown';

        const arrivalDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
        if (isNaN(arrivalDate.getTime())) return 'unknown';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        arrivalDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((today.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 20) return 'cooling';
        if (diffDays <= 90) return '90days';
        return 'expired';
    };

    const updateCell = (rIdx, cIdx, value) => {
        const newData = [...tableData];
        if (headers[cIdx].includes('日') && value) {
            value = value.replace(/-/g, '/');
        }
        newData[rIdx][cIdx] = value;
        setTableData(newData);
        saveData(headers, newData);
    };

    const addNewRecord = (formData) => {
        // Auto-increment No. if it's empty
        const newForm = [...formData];
        const noIdx = headers.indexOf('No.');
        if (noIdx !== -1 && (!newForm[noIdx] || newForm[noIdx] === '')) {
            const lastNo = tableData.length > 0 ? parseInt(tableData[0][noIdx]) : 0;
            newForm[noIdx] = isNaN(lastNo) ? tableData.length + 1 : lastNo + 1;
        }

        const newData = [newForm, ...tableData];
        setTableData(newData);
        saveData(headers, newData);
    };

    const exportCSV = () => {
        let csvContent = '\uFEFF' + headers.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',') + '\r\n';
        tableData.forEach(row => {
            csvContent += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',') + '\r\n';
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const now = new Date();
        link.href = URL.createObjectURL(blob);
        link.download = `Stella_クーリングオフ_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`;
        link.click();
    };

    const exportTransferData = () => {
        const reqIdx = headers.indexOf('入金依頼');
        if (reqIdx === -1) return alert('「入金依頼」列が見つかりません');

        const targetRows = tableData.filter(row => row[reqIdx] === true || row[reqIdx] === 'true');
        if (targetRows.length === 0) return alert('入金依頼にチェックが入っているデータがありません');

        const nameIdx = headers.findIndex(h => h.includes('お名前') || h.includes('氏名') || h === '名前');
        const amountIdx = headers.findIndex(h => h.includes('返金額') || h.includes('金額'));
        const bankIdx = headers.findIndex(h => h.includes('振込口座') || h.includes('口座') || h.includes('銀行') || h.includes('金融機関'));

        let text = `【振込依頼データ】\n出力日時: ${new Date().toLocaleString('ja-JP')}\n件数: ${targetRows.length}件\n\n`;
        text += `========================================\n\n`;
        targetRows.forEach((row, idx) => {
            text += `[${idx + 1}件目]\n`;
            text += `お名前　: ${row[nameIdx] || '（未登録）'}\n`;
            text += `返金額　: ${row[amountIdx] || '（未登録）'}\n`;
            text += `振込口座:\n${(row[bankIdx] || '（未登録）').replace(/"/g, '')}\n\n`;
            text += `----------------------------------------\n\n`;
        });

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const now = new Date();
        link.href = URL.createObjectURL(blob);
        link.download = `振込依頼データ_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.txt`;
        link.click();
    };

    const renderCellInput = (val, rIdx, cIdx) => {
        const h = headers[cIdx];
        if (h === '入金依頼') {
            return (
                <input
                    type="checkbox"
                    checked={val === true || val === 'true'}
                    onChange={(e) => updateCell(rIdx, cIdx, e.target.checked)}
                    className="w-5 h-5 cursor-pointer accent-sky-400"
                />
            );
        }
        if (h.includes('日')) {
            const yyyymmdd = val ? val.replace(/\//g, '-') : '';
            return (
                <input
                    type="date"
                    value={yyyymmdd}
                    onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                    className={`bg-transparent border-none text-inherit w-full outline-none ${!val ? 'opacity-30' : ''}`}
                />
            );
        }
        if (PULLDOWN_KEYS.includes(h)) {
            const options = pulldownOptions[h] || [];
            return (
                <select
                    value={val}
                    onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                    className="bg-transparent border-none text-inherit w-full outline-none"
                >
                    {options.map(opt => (
                        <option key={opt} value={opt} className="bg-white text-slate-700">{opt}</option>
                    ))}
                </select>
            );
        }
        return (
            <input
                type="text"
                value={val}
                onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                className="bg-transparent border-none text-inherit w-full outline-none focus:bg-white/20 px-1 rounded transition-colors"
                spellCheck="false"
            />
        );
    };

    const AddRecordRow = () => {
        const [formData, setFormData] = useState([]);

        useEffect(() => {
            setFormData(headers.map(h => (h === '入金依頼' ? false : '')));
        }, [headers]);

        const handleChange = (idx, value) => {
            const newForm = [...formData];
            if (headers[idx].includes('日') && value) value = value.replace(/-/g, '/');
            newForm[idx] = value;
            setFormData(newForm);
        };

        const handleAdd = () => {
            addNewRecord(formData);
            setFormData(headers.map(h => (h === '入金依頼' ? false : '')));
        };

        if (headers.length === 0) return null;

        return (
            <tr className="bg-white/20 sticky top-12 z-10 backdrop-blur-md shadow-sm border-b-2 border-sky-200">
                <td className="p-4 text-center">
                    <Sparkles className="w-5 h-5 text-sky-400 inline-block" />
                </td>
                {headers.map((h, i) => (
                    <td key={i} className="p-2">
                        <div className="flex gap-2 items-center">
                            {h === '入金依頼' ? (
                                <input
                                    type="checkbox"
                                    checked={formData[i] || false}
                                    onChange={(e) => handleChange(i, e.target.checked)}
                                    className="w-5 h-5 cursor-pointer accent-sky-400 mx-auto"
                                />
                            ) : h.includes('日') ? (
                                <input
                                    type="date"
                                    value={formData[i] ? formData[i].replace(/\//g, '-') : ''}
                                    onChange={(e) => handleChange(i, e.target.value)}
                                    className={`bg-white/50 border border-sky-100 rounded p-1 w-full text-sm ${!formData[i] ? 'opacity-30' : ''}`}
                                />
                            ) : PULLDOWN_KEYS.includes(h) ? (
                                <select
                                    value={formData[i] || ''}
                                    onChange={(e) => handleChange(i, e.target.value)}
                                    className="bg-white/50 border border-sky-100 rounded p-1 w-full text-sm"
                                >
                                    {(pulldownOptions[h] || []).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={formData[i] || ''}
                                    onChange={(e) => handleChange(i, e.target.value)}
                                    placeholder={h === 'No.' ? '(自動)' : '入力...'}
                                    className="bg-white/50 border border-sky-100 rounded p-1 w-full text-sm"
                                />
                            )}
                            {i === headers.length - 1 && (
                                <button onClick={handleAdd} className="btn-mystic px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                    ✨ 追加
                                </button>
                            )}
                        </div>
                    </td>
                ))}
            </tr>
        );
    };

    if (isLocked) {
        return (
            <div className="cosmic-overlay active" onClick={() => setIsLocked(false)}>
                <div className="locked-msg">
                    ✩ 神秘の魔法で保護中 ✩<br />
                    <span className="text-xl font-normal text-sky-400 mt-4 block">(画面をタップしてふたたび目覚める)</span>
                </div>
                {[...Array(30)].map((_, i) => (
                    <div
                        key={i}
                        className="shooting-star"
                        style={{
                            left: `${Math.random() * 150}vw`,
                            top: `${Math.random() * 100 - 50}vh`,
                            width: `${Math.random() * 80 + 30}px`,
                            height: `${Math.random() * 2 + 1}px`,
                            animationDuration: `${Math.random() * 3 + 1.5}s`,
                            animationDelay: `${Math.random() * 4}s`
                        }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="cooling-off-container">
            <div className="ambient-stars" />

            <header>
                <h1>Stella</h1>
                <div className="subtitle">✨ クーリングオフ・返品管理 星空システム ✨</div>
                <button onClick={() => setIsManualOpen(true)} className="btn btn-mystic manual-btn">
                    📜 使い方マニュアル
                </button>
            </header>

            <div className="glass-panel controls p-6 mb-6">
                <div className="flex gap-4">
                    <div className="relative">
                        <button className="btn btn-primary">🌠 CSV読込</button>
                        <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv" />
                    </div>
                    <button onClick={exportCSV} className="btn btn-primary">💾 保存 (CSV)</button>
                    <button onClick={exportTransferData} className="btn btn-success">💸 振込データ出力</button>
                    <button
                        onClick={() => { if (window.confirm('星の記録をクリアしますか？')) { setTableData([]); setHeaders([]); saveData([], []); } }}
                        className="btn btn-danger"
                    >
                        🧹 クリア
                    </button>
                </div>

                <div className="flex gap-8 items-center">
                    <div className="flex gap-4 text-sm font-semibold">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full status-cooling" /> クーリングオフ(20日以内)
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full status-90" /> 90日ルール(90日以内)
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full status-expired" /> 期間外
                        </div>
                    </div>
                    <button onClick={() => setIsLocked(true)} className="btn btn-mystic">🌌 宇宙へ出かける</button>
                </div>
            </div>

            <div className="glass-panel table-container">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/80 sticky top-0 z-20 shadow-sm border-b">
                            <th className="p-4 w-24">判定</th>
                            {headers.map((h, i) => (
                                <th key={i} className="p-4 whitespace-nowrap cursor-pointer hover:text-sky-600 transition-colors" onClick={() => {
                                    const dir = sortConfig.key === i && sortConfig.direction === 'asc' ? 'desc' : 'asc';
                                    setSortConfig({ key: i, direction: dir });
                                    const sorted = [...tableData].sort((a, b) => {
                                        if (a[i] < b[i]) return dir === 'asc' ? -1 : 1;
                                        if (a[i] > b[i]) return dir === 'asc' ? 1 : -1;
                                        return 0;
                                    });
                                    setTableData(sorted);
                                }}>
                                    {h} {sortConfig.key === i && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <AddRecordRow />
                        {tableData.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length + 1} className="p-20 text-center text-slate-400 italic leading-loose">
                                    <div className="flex flex-col items-center gap-4">
                                        <Sparkles className="w-8 h-8 text-sky-300 animate-pulse" />
                                        <p>上の入力欄から直接データを記入するか、<br />CSVファイルを読み込んでください... ✨</p>
                                        <p className="text-xs opacity-60 font-noto">（入力後に右端の「追加」ボタンを押すと記録が作成されます）</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            tableData.map((row, rIdx) => {
                                const arrivalDateIdx = headers.findIndex(h => TARGET_DATE_COL_NAMES.includes(h) || h.includes('到着'));
                                const status = arrivalDateIdx !== -1 ? calculateStatus(row[arrivalDateIdx]) : 'unknown';
                                const isCard = row.some(cell => cell?.toString().includes('カード'));

                                return (
                                    <tr key={rIdx} className={`border-b border-white/40 hover:bg-white/40 transition-colors ${isCard ? 'row-card-payment' : ''}`}>
                                        <td className="p-4">
                                            {status === 'cooling' && <span className="status-badge status-cooling">🌟20日以内</span>}
                                            {status === '90days' && <span className="status-badge status-90">🌙90日経過</span>}
                                            {status === 'expired' && <span className="status-badge status-expired">☄️期限切れ</span>}
                                            {status === 'unknown' && <span className="opacity-20 text-xs text-center block">--</span>}
                                        </td>
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-4 min-w-[120px]">
                                                {renderCellInput(cell, rIdx, cIdx)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {saveStatus && (
                <div className="fixed bottom-10 right-10 bg-sky-500 text-white px-6 py-3 rounded-full font-bold shadow-2xl animate-bounce z-50">
                    {saveStatus}
                </div>
            )}

            {isManualOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-sky-900/20 backdrop-blur-sm" onClick={() => setIsManualOpen(false)}>
                    <div className="bg-white/90 glass-panel p-10 rounded-3xl max-w-2xl w-full m-4 shadow-2xl border-2 border-white relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setIsManualOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-sky-500 transition-colors">
                            <X className="w-8 h-8" />
                        </button>
                        <h2 className="text-3xl font-bold text-sky-600 mb-8 border-b-2 border-sky-100 pb-4">✨ Stella 使い方ガイド</h2>
                        <div className="space-y-6 text-slate-600 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                            <section>
                                <h3 className="text-xl font-bold text-sky-500 mb-3 flex items-center gap-2">
                                    <Star className="w-5 h-5" /> 1. 星の記録（データ）の読み込み
                                </h3>
                                <p>画面左側の「🌠 CSV読込」ボタンから、管理したいCSVファイルを選択してください。<br />一度読み込んだ記録は輝き（ブラウザ）に自動保存され、次回も続きから作業できます。</p>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-sky-500 mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" /> 2. 記録の編集と追加
                                </h3>
                                <ul className="list-disc list-inside space-y-2">
                                    <li><strong>直接編集:</strong> 表のセルをタップすると、その場でデータを書き換えられます。変更は自動的に星空に保存されます。</li>
                                    <li><strong>新規追加:</strong> 表の一番上の行に新しいデータを入力し、右端の「✨追加」ボタンで新しい星の記録を追加します。</li>
                                    <li><strong>並び替え:</strong> 各列のタイトルをクリックすると、綺麗に並べ替えができます。</li>
                                </ul>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-sky-500 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5" /> 3. 振込データ出力（入金依頼）
                                </h3>
                                <p>返金処理が必要な方々の情報をまとめたテキストデータを生成します。</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li><strong>チェックを入れる:</strong> 左端の「入金依頼」にチェックを入れてください。</li>
                                    <li><strong>データ出力:</strong> 「💸 振込データ出力」ボタンを押すと、チェックした方の情報がまとまったテキストファイルが舞い降りてきます。</li>
                                </ul>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-sky-500 mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> 4. 状態の自動判定
                                </h3>
                                <p>到着日などを基準に、魔法のように自動で状態を判定します。</p>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-2 pt-2"><span className="status-badge status-cooling">🌟20日以内</span> <span>期間内（クーリングオフ可能）</span></li>
                                    <li className="flex items-center gap-2"><span className="status-badge status-90">🌙90日経過</span> <span>90日返品ルール期間</span></li>
                                    <li className="flex items-center gap-2"><span className="status-badge status-expired">☄️期限切れ</span> <span>期間超過</span></li>
                                </ul>
                                <p className="mt-4 text-sm text-pink-500 font-bold">※支払方法に「カード」が含まれる場合、行全体がふんわりとローズ色に染まり、処理忘れを優しく防ぎます。</p>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-sky-500 mb-3 flex items-center gap-2">
                                    <Clock className="w-5 h-5" /> 5. 休息（セキュリティ機能）
                                </h3>
                                <p>「🌌 宇宙へ出かける」ボタンを押すか、10分間操作がないと、美しい星のベール（スクリーンセーバー）が画面を覆い、大切な個人情報を守ります。戻る時は画面をクリックしてください。</p>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoolingOffManagement;
