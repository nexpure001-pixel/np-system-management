import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    X,
    Star,
    AlertCircle,
    CheckCircle,
    Clock,
    Sparkles,
    Plus
} from 'lucide-react';
import './CoolingOffManagement.css';

const TARGET_DATE_COL_NAMES = ['商品到着日', '初回商品到着日', '初回商品発送日', '契約日'];
const INITIAL_PULLDOWN_OPTIONS = {
    '支払方法': ['', 'カード', '振り込み'],
    '対応方法': ['', 'カード決済取消', '返金対応'],
    '申出方法': ['', 'ハガキ', '書面', 'メール', 'カスタマー', 'コンタクト', '電話', '電話・メール', '消費者センター', 'その他'],
    'コミッション発生': ['', 'あり', 'なし']
};

const DASHBOARD_COLUMNS = [
    'No.', 'お名前', '申出方法', '対応方法', '商品本社返送日', 'カード決済取消日or返金日', 
    '登録変更3項目', '伝票処理', '最終メール送信', 'リジョン発送', '完了'
];

const DEFAULT_HEADERS = [
    ...DASHBOARD_COLUMNS,
    '種別', '支払方法', '実績月', '契約日', '初回商品到着日', '解約申出日', '返金処理日', '返金額', '振込口座', '備考', '返金依頼', '経過日数',
    'コミッション発生', 'ステイタス変更', 'クーリングオフ日付入力', '口座情報クリア'
];

const CoolingOffManagement = () => {
    const [headers, setHeaders] = useState(DEFAULT_HEADERS);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: -1, direction: 'asc' });
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const [pulldownOptions, setPulldownOptions] = useState(INITIAL_PULLDOWN_OPTIONS);
    const [editingRowIdx, setEditingRowIdx] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editingRow, setEditingRow] = useState(null);



    useEffect(() => {
        fetchData();
    }, []);


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

            if (data && data.headers && data.headers.length > 0) {
                setHeaders(data.headers);
                setTableData(data.data || []);
                updatePulldownOptions(data.headers, data.data || []);
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


    const updatePulldownOptions = (currentHeaders, currentData) => {
        const newOptions = { ...INITIAL_PULLDOWN_OPTIONS };
        const pulldownKeys = Object.keys(INITIAL_PULLDOWN_OPTIONS);
        currentHeaders.forEach((h, c) => {
            if (pulldownKeys.includes(h)) {
                const options = new Set(newOptions[h]);
                currentData.forEach(row => {
                    if (row[c]) options.add(row[c].trim());
                });
                newOptions[h] = Array.from(options);
            }
        });
        newOptions['コミッション発生'] = INITIAL_PULLDOWN_OPTIONS['コミッション発生'];
        setPulldownOptions(newOptions);
    };

    // --- Modal Handlers ---
    const openAddModal = () => {
        setEditingRowIdx(null);
        setEditingRow(headers.map(h => (h === '入金依頼' ? false : '')));
        setIsDetailModalOpen(true);
    };

    const openDetailModal = (rIdx) => {
        setEditingRowIdx(rIdx);
        setEditingRow([...tableData[rIdx]]);
        setIsDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setEditingRowIdx(null);
        setEditingRow(null);
    };

    const handleModalFieldChange = (hName, val) => {
        if (!editingRow) return;
        const newRow = [...editingRow];
        const idx = headers.indexOf(hName);
        if (idx !== -1) {
            newRow[idx] = val;
            
            // Auto logic
            if (['ステイタス変更', 'クーリングオフ日付入力', '口座情報クリア'].includes(hName)) {
                const sIdx = headers.indexOf('ステイタス変更');
                const dIdx = headers.indexOf('クーリングオフ日付入力');
                const cIdx = headers.indexOf('口座情報クリア');
                const isStatus = hName === 'ステイタス変更' ? val : (sIdx !== -1 && newRow[sIdx] === true);
                const isDate = hName === 'クーリングオフ日付入力' ? val : (dIdx !== -1 && newRow[dIdx] === true);
                const isClear = hName === '口座情報クリア' ? val : (cIdx !== -1 && newRow[cIdx] === true);
                
                const regIdx = headers.indexOf('登録変更3項目');
                if (regIdx !== -1) {
                    newRow[regIdx] = (isStatus && isDate && isClear);
                }
            }
            setEditingRow(newRow);
        }
    };

    const handleDetailSave = (e) => {
        e.preventDefault();
        let newData;
        
        if (editingRowIdx === null) {
            // 新規追加
            const newForm = [...editingRow];
            const noIdx = headers.indexOf('No.');
            if (noIdx !== -1 && (!newForm[noIdx] || newForm[noIdx] === '')) {
                const lastNo = tableData.length > 0 ? Math.max(...tableData.map(r => parseInt(r[noIdx]) || 0)) : 0;
                newForm[noIdx] = lastNo + 1;
            }
            newData = [newForm, ...tableData];
        } else {
            // 更新
            newData = [...tableData];
            newData[editingRowIdx] = editingRow;
        }

        setTableData(newData);
        saveData(headers, newData);
        closeDetailModal();
    };

    const getEditingStatus = () => {
        if (!editingRow) return { state: 'unknown', text: '--', color: '' };
        const arriveIdx = headers.indexOf('初回商品到着日');
        const contractIdx = headers.indexOf('契約日');
        const endIdx = headers.indexOf('解約申出日');
        
        const startDateStr = (arriveIdx !== -1 && editingRow[arriveIdx]) ? editingRow[arriveIdx] : editingRow[contractIdx];
        const endDateStr = endIdx !== -1 ? editingRow[endIdx] : null;
        
        if (!startDateStr) return { state: 'unknown', text: '--', color: '' };
        
        const { state } = calculateStatus(startDateStr, endDateStr);
        if (state === 'cooling') return { text: '【クーリングオフ】', color: 'text-sky-500 font-bold' };
        if (state === '90days') return { text: '【190日返品ルール】', color: 'text-emerald-500 font-bold' };
        if (state === 'expired') return { text: '☄️期限切れ', color: 'text-rose-500 font-bold' };
        return { text: '--', color: 'text-slate-400 font-bold' };
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

    const calculateStatus = (startDateStr, endDateStr) => {
        if (!startDateStr || startDateStr.trim() === '-' || startDateStr.trim() === '') return { state: 'unknown', days: null };
        let startParts = startDateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
        if (!startParts) return { state: 'unknown', days: null };

        const startDate = new Date(parseInt(startParts[1]), parseInt(startParts[2]) - 1, parseInt(startParts[3]));
        if (isNaN(startDate.getTime())) return { state: 'unknown', days: null };

        let endDate = new Date(); // 未記入の場合は今日を終点とする
        endDate.setHours(0, 0, 0, 0);

        if (endDateStr && endDateStr.trim() !== '-' && endDateStr.trim() !== '') {
            let endParts = endDateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
            if (endParts) {
                const parsedEndDate = new Date(parseInt(endParts[1]), parseInt(endParts[2]) - 1, parseInt(endParts[3]));
                if (!isNaN(parsedEndDate.getTime())) {
                    endDate = parsedEndDate;
                }
            }
        }

        startDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 20) return { state: 'cooling', days: diffDays };
        if (diffDays <= 90) return { state: '90days', days: diffDays };
        return { state: 'expired', days: diffDays };
    };

    const getStats = () => {
        const total = tableData.length;
        const compIdx = headers.indexOf('完了');
        const methodIdx = headers.indexOf('対応方法');
        const shippingIdx = headers.indexOf('リジョン発送');

        const cardRefundPending = tableData.filter(row => {
            const isTarget = row[methodIdx] === 'カード決済取消' || row[methodIdx] === '返金対応';
            const isNotCompleted = compIdx !== -1 && !(row[compIdx] === true || row[compIdx] === 'true');
            return isTarget && isNotCompleted;
        }).length;

        const regionNotShipped = tableData.filter(row => {
            return shippingIdx !== -1 && !(row[shippingIdx] === true || row[shippingIdx] === 'true');
        }).length;

        const notCompleted = tableData.filter(row => {
            return compIdx !== -1 && !(row[compIdx] === true || row[compIdx] === 'true');
        }).length;

        return { total, cardRefundPending, regionNotShipped, notCompleted };
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
        // 詳細モーダル側で統合されたため、こちらは将来的に削除可能ですが互換性のために維持
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
        if (['登録変更3項目', '伝票処理', '最終メール送信', 'リジョン発送'].includes(h)) {
            return (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={val === true || val === 'true'}
                        readOnly
                        onChange={() => {}}
                        className="w-5 h-5 cursor-default accent-sky-400"
                        title="詳細・編集モーダルから変更してください"
                    />
                </div>
            );
        }
        if (h === '完了') {
            const isCompleted = val === true || val === 'true';
            return (
                <div className="flex justify-center">
                    <button 
                        onClick={() => updateCell(rIdx, cIdx, !isCompleted)}
                        className={`transition-colors ${isCompleted ? 'text-yellow-400' : 'text-slate-300'} hover:scale-110 active:scale-95`}
                    >
                        <Star size={24} fill={isCompleted ? "currentColor" : "none"} />
                    </button>
                </div>
            );
        }
        if (h === '経過日数') {
            return (
                <div className="text-center font-bold text-slate-500">
                    {val || '--'}
                </div>
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
        if (Object.keys(pulldownOptions).includes(h)) {
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

    const AddRecordForm = () => {
        const [formData, setFormData] = useState([]);

        useEffect(() => {
            if (headers.length > 0 && formData.length === 0) {
                setFormData(headers.map(h => (h === '入金依頼' ? false : '')));
            }
        }, [headers]);

        const handleChange = (idx, value) => {
            const newForm = [...formData];
            if (headers[idx].includes('日') && value) value = value.replace(/-/g, '/');
            newForm[idx] = value;
            setFormData(newForm);
        };

        const handleAdd = () => {
            if (formData.every(v => v === '' || v === false)) return alert('内容を入力してください。');
            addNewRecord(formData);
            setFormData(headers.map(h => (h === '入金依頼' ? false : '')));
        };

        if (!headers || headers.length === 0) return (
            <div style={{ padding: '20px', border: '5px solid black', background: 'white', color: 'black', fontWeight: 'bold' }}>
                エラー: 項目設定が読み込めません。管理者に連絡してください。
            </div>
        );

        return (
            <div style={{
                background: 'white',
                border: '2px solid black',
                padding: '16px',
                marginBottom: '24px',
                boxShadow: '6px 6px 0px 0px rgba(56, 189, 248, 0.2)',
                position: 'relative',
                zIndex: 100,
                width: '100%',
                borderRadius: '0px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0369a1', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={20} className="text-sky-500" /> 新規記入
                    </h2>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 12px', fontWeight: '700', color: '#0369a1', fontSize: '11px', borderRadius: '0px' }}>
                        項目を入力 ✨
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {[...DASHBOARD_COLUMNS, '契約日', '初回商品発送日', '解約申出日'].map((h) => {
                        const i = headers.indexOf(h);
                        if (i === -1 || h === '経過日数') return null;
                        return (
                            <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginLeft: '2px' }}>{h}</label>
                                {h.includes('日') ? (
                                    <input
                                        type="date"
                                        value={formData[i] ? formData[i].replace(/\//g, '-') : ''}
                                        onChange={(e) => handleChange(i, e.target.value)}
                                        style={{
                                            background: 'white',
                                            border: '2px solid black',
                                            padding: '8px',
                                            fontSize: '13px',
                                            color: 'black',
                                            fontWeight: '600',
                                            outline: 'none',
                                            borderRadius: '0px'
                                        }}
                                    />
                                ) : Object.keys(pulldownOptions).includes(h) ? (
                                    <select
                                        value={formData[i] || ''}
                                        onChange={(e) => handleChange(i, e.target.value)}
                                        style={{
                                            background: 'white',
                                            border: '2px solid black',
                                            padding: '8px',
                                            fontSize: '13px',
                                            color: 'black',
                                            fontWeight: '600',
                                            outline: 'none',
                                            appearance: 'auto',
                                            borderRadius: '0px'
                                        }}
                                    >
                                        {(pulldownOptions[h] || []).map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : ['登録変更3項目', '伝票処理', '最終メール送信', 'リジョン発送', '完了'].includes(h) ? (
                                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData[i] === true}
                                            onChange={(e) => handleChange(i, e.target.checked)}
                                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                        />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData[i] || ''}
                                        onChange={(e) => handleChange(i, e.target.value)}
                                        placeholder={h === 'No.' ? '(自動)' : `${h}...`}
                                        style={{
                                            background: 'white',
                                            border: '2px solid black',
                                            padding: '8px',
                                            fontSize: '13px',
                                            color: 'black',
                                            fontWeight: '600',
                                            outline: 'none',
                                            borderRadius: '0px'
                                        }}
                                        spellCheck="false"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleAdd}
                        style={{
                            background: '#0369a1',
                            color: 'white',
                            padding: '10px 28px',
                            fontSize: '14px',
                            fontWeight: '800',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '0px',
                            boxShadow: '0 4px 10px rgba(3, 105, 161, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Sparkles size={18} /> 保存する
                    </button>
                </div>
            </div>
        );
    };


    return (
        <div className="cooling-off-container">
            <div className="ambient-stars" />

            <header>
                <h1>Stella</h1>
                <div className="subtitle">✨ クーリングオフ・返品管理 星空システム ✨</div>
                <div className="flex gap-3 justify-center mt-4">
                    <button onClick={openAddModal} className="glass-btn">+ 新規追加</button>
                    <button onClick={() => setIsManualOpen(true)} className="btn btn-mystic manual-btn">
                        📜 使い方マニュアル
                    </button>
                </div>
            </header>

            {/* 旧 AddRecordForm は削除（詳細モーダルに統合） */}

            <div className="stats-grid">
                {(() => {
                    const stats = getStats();
                    return (
                        <>
                            <div className="glass-panel stat-card">
                                <h3>【全件数】</h3>
                                <div className="value">{stats.total}</div>
                            </div>
                            <div className="glass-panel stat-card">
                                <h3>【カード決済取消or返金未完了】</h3>
                                <div className="value">{stats.cardRefundPending}</div>
                            </div>
                            <div className="glass-panel stat-card">
                                <h3>【リジョン未発送】</h3>
                                <div className="value">{stats.regionNotShipped}</div>
                            </div>
                            <div className="glass-panel stat-card">
                                <h3>【未完了】</h3>
                                <div className="value">{stats.notCompleted}</div>
                            </div>
                        </>
                    );
                })()}
            </div>

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
                            <div className="w-4 h-4 rounded-full status-cooling" /> 【クーリングオフ】
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full status-90" /> 【90日返品ルール】
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full status-expired" /> 期間外
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-panel table-container">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/80 sticky top-0 z-20 shadow-sm border-b text-sky-900 font-extrabold text-[13px]">
                            <th className="p-4 w-20">判定</th>
                            {DASHBOARD_COLUMNS.map((colName) => {
                                const i = headers.indexOf(colName);
                                if (i === -1) return null;
                                return (
                                    <th key={colName} className="p-4 whitespace-nowrap cursor-pointer hover:text-sky-600 transition-colors" onClick={() => {
                                        const dir = sortConfig.key === i && sortConfig.direction === 'asc' ? 'desc' : 'asc';
                                        setSortConfig({ key: i, direction: dir });
                                        const sorted = [...tableData].sort((a, b) => {
                                            if (a[i] < b[i]) return dir === 'asc' ? -1 : 1;
                                            if (a[i] > b[i]) return dir === 'asc' ? 1 : -1;
                                            return 0;
                                        });
                                        setTableData(sorted);
                                    }}>
                                        {colName} {sortConfig.key === i && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                    </th>
                                );
                            })}
                            <th className="p-4 whitespace-nowrap">アクション</th>
                            <th className="p-4 w-24 text-center">経過日数</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length + 2} className="p-20 text-center text-slate-400 italic leading-loose">
                                    <div className="flex flex-col items-center gap-4">
                                        <Sparkles className="w-8 h-8 text-sky-300 animate-pulse" />
                                        <p>データがありません。画面上部の入力欄から記入するか、<br />CSVファイルを読み込んでください。</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            tableData.map((row, rIdx) => {
                                const arriveIdx = headers.indexOf('初回商品到着日');
                                const contractIdx = headers.indexOf('契約日');
                                const startDateStr = (arriveIdx !== -1 && row[arriveIdx]) ? row[arriveIdx] : (contractIdx !== -1 ? row[contractIdx] : null);
                                
                                const endDateIdx = headers.findIndex(h => h.includes('解約申出日'));
                                const endDateStr = endDateIdx !== -1 ? row[endDateIdx] : null;
                                
                                const { state: status, days: diffDays } = startDateStr ? calculateStatus(startDateStr, endDateStr) : { state: 'unknown', days: null };
                                const isCard = row.some(cell => cell?.toString().includes('カード'));
                                const compIdx = headers.indexOf('完了');
                                const isCompleted = compIdx !== -1 && (row[compIdx] === true || row[compIdx] === 'true');

                                return (
                                    <tr key={rIdx} className={`border-b border-white/40 transition-colors text-[13px] ${isCompleted ? 'bg-slate-200/50 opacity-60 grayscale text-slate-500' : isCard ? 'row-card-payment hover:bg-white/40' : 'hover:bg-white/40'}`}>
                                        <td className="p-4">
                                            {status === 'cooling' && <span className="status-badge status-cooling">【クーリングオフ】</span>}
                                            {status === '90days' && <span className="status-badge status-90">【90日返品ルール】</span>}
                                            {status === 'expired' && <span className="status-badge status-expired">☄️期限切れ</span>}
                                            {status === 'unknown' && <span className="opacity-20 text-xs text-center block">--</span>}
                                        </td>
                                        {DASHBOARD_COLUMNS.map((colName) => {
                                            const i = headers.indexOf(colName);
                                            if (i === -1) return null;
                                            const cell = row[i];
                                            
                                            return (
                                                <td key={colName} className="p-4 min-w-[120px]">
                                                    {renderCellInput(cell, rIdx, i)}
                                                </td>
                                            );
                                        })}
                                        <td className="p-4 text-center">
                                            <button 
                                                className="btn btn-mystic text-[10px] py-1 px-2 whitespace-nowrap"
                                                onClick={() => openDetailModal(rIdx)}
                                            >
                                                詳細・編集
                                            </button>
                                        </td>
                                        <td className="p-4 text-center font-bold text-slate-600">
                                            {diffDays !== null ? `${diffDays}日` : '--'}
                                        </td>
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

            {isDetailModalOpen && editingRow && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-sky-900/40 backdrop-blur-sm" onClick={closeDetailModal}>
                    <div className="bg-white/95 glass-panel p-8 detail-modal-content w-full mx-4 shadow-2xl border-2 border-white relative overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <button onClick={closeDetailModal} className="absolute top-6 right-6 text-slate-400 hover:text-sky-500 transition-colors z-10 bg-white/50 rounded-full p-2">
                            <X className="w-6 h-6" />
                        </button>
                        
                        <h2 className="text-2xl font-black text-slate-700 mb-6 flex items-center gap-3 border-b-2 border-slate-100 pb-4">
                            <Sparkles className="w-6 h-6 text-sky-400" /> {editingRowIdx === null ? 'クーリングオフの新規登録' : 'クーリングオフの詳細'}
                        </h2>

                        <form onSubmit={handleDetailSave} className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-8 pb-8">
                                {/* 基本情報 */}
                                <section className="bg-sky-50/50 p-6 border border-sky-100">
                                    <h3 className="text-sm font-bold text-sky-600 uppercase tracking-widest mb-4">基本情報</h3>
                                    <div className="grid grid-cols-3 gap-6">
                                        <DetailField label="判定" value={getEditingStatus().text} readonly />
                                        <DetailField label="No." value={editingRow[headers.indexOf('No.')] || ''} readonly />
                                        <DetailField label="お名前" type="text" value={editingRow[headers.indexOf('お名前')]} onChange={(v)=>handleModalFieldChange('お名前', v)} />
                                        
                                        <DetailField label="契約日" type="date" value={editingRow[headers.indexOf('契約日')]} onChange={(v)=>handleModalFieldChange('契約日', v)} />
                                        <DetailField label="初回商品到着日" type="date" value={editingRow[headers.indexOf('初回商品到着日')]} onChange={(v)=>handleModalFieldChange('初回商品到着日', v)} />
                                        <DetailField label="解約申出日" type="date" value={editingRow[headers.indexOf('解約申出日')]} onChange={(v)=>handleModalFieldChange('解約申出日', v)} />
                                        
                                        <DetailField label="申出方法" type="select" options={pulldownOptions['申出方法']} value={editingRow[headers.indexOf('申出方法')]} onChange={(v)=>handleModalFieldChange('申出方法', v)} />
                                        <DetailField label="コミッション発生" type="select" options={pulldownOptions['コミッション発生']} value={editingRow[headers.indexOf('コミッション発生')]} onChange={(v)=>handleModalFieldChange('コミッション発生', v)} />
                                    </div>
                                </section>

                                {/* 金銭関係 */}
                                <section className="bg-emerald-50/50 p-6 border border-emerald-100">
                                    <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4">金銭関係</h3>
                                    <div className="grid grid-cols-3 gap-6">
                                        <DetailField label="支払い方法" type="select" options={pulldownOptions['支払方法']} value={editingRow[headers.indexOf('支払方法')]} onChange={(v)=>handleModalFieldChange('支払方法', v)} />
                                        <DetailField label="対応方法" type="select" options={pulldownOptions['対応方法']} value={editingRow[headers.indexOf('対応方法')]} onChange={(v)=>handleModalFieldChange('対応方法', v)} />
                                        <DetailField label="商品本社返送日" type="date" value={editingRow[headers.indexOf('商品本社返送日')]} onChange={(v)=>handleModalFieldChange('商品本社返送日', v)} />
                                        
                                        <DetailField label="カード決済取消日or返金日" type="date" value={editingRow[headers.indexOf('カード決済取消日or返金日')]} onChange={(v)=>handleModalFieldChange('カード決済取消日or返金日', v)} />
                                        <DetailField label="返金額" type="text" value={editingRow[headers.indexOf('返金額')]} onChange={(v)=>handleModalFieldChange('返金額', v)} />
                                        <DetailField label="振込口座情報" type="text" value={editingRow[headers.indexOf('振込口座')]} onChange={(v)=>handleModalFieldChange('振込口座', v)} />
                                    </div>
                                </section>

                                {/* 処理確認 */}
                                <section className="bg-purple-50/50 p-6 border border-purple-100">
                                    <h3 className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-4">処理確認</h3>
                                    <div className="grid grid-cols-3 gap-6">
                                        <DetailField label="ステイタス変更" type="checkbox" value={editingRow[headers.indexOf('ステイタス変更')]} onChange={(v)=>handleModalFieldChange('ステイタス変更', v)} />
                                        <DetailField label="クーリングオフ日付入力" type="checkbox" value={editingRow[headers.indexOf('クーリングオフ日付入力')]} onChange={(v)=>handleModalFieldChange('クーリングオフ日付入力', v)} />
                                        <DetailField label="口座情報クリア" type="checkbox" value={editingRow[headers.indexOf('口座情報クリア')]} onChange={(v)=>handleModalFieldChange('口座情報クリア', v)} />
                                        
                                        <DetailField label="伝票処理" type="checkbox" value={editingRow[headers.indexOf('伝票処理')]} onChange={(v)=>handleModalFieldChange('伝票処理', v)} />
                                        <DetailField label="返金依頼" type="checkbox" value={editingRow[headers.indexOf('返金依頼')]} onChange={(v)=>handleModalFieldChange('返金依頼', v)} />
                                        <DetailField label="最終メール送信" type="checkbox" value={editingRow[headers.indexOf('最終メール送信')]} onChange={(v)=>handleModalFieldChange('最終メール送信', v)} />
                                        
                                        <DetailField label="リジョン発送" type="checkbox" value={editingRow[headers.indexOf('リジョン発送')]} onChange={(v)=>handleModalFieldChange('リジョン発送', v)} />
                                    </div>
                                </section>

                                {/* その他・備考 */}
                                <section className="bg-slate-50/50 p-6 border border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-4">その他・備考</h3>
                                    <DetailField label="備考" type="textarea" value={editingRow[headers.indexOf('備考')]} onChange={(v)=>handleModalFieldChange('備考', v)} />
                                </section>
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-4 bg-white/80 sticky bottom-0 z-20 pb-2">
                                <button type="button" onClick={closeDetailModal} className="px-6 py-2.5 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">キャンセル</button>
                                <button type="submit" className="px-6 py-2.5 font-bold text-white bg-sky-500 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-200 disabled:opacity-50">保存する</button>
                            </div>
                        </form>
                    </div>
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
                                <p>「初回商品到着日」から「解約申出日」（未記入の場合は今日）までの日数を計算し、自動で状態を判定します。</p>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-2 pt-2"><span className="status-badge status-cooling">🌟20日以内</span> <span>期間内（クーリングオフ可能）</span></li>
                                    <li className="flex items-center gap-2"><span className="status-badge status-90">🌙90日</span> <span>90日返品ルール期間</span></li>
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

const DetailField = ({ label, type = 'text', value, onChange, readonly = false, options = [] }) => {
    return (
        <div className="flex flex-col gap-1.5">
            <label className={`${type === 'checkbox' ? 'text-[13px]' : 'text-[11px]'} font-bold text-slate-500 uppercase tracking-wider`}>{label}</label>
            {type === 'checkbox' ? (
                <div className="flex items-center h-[42px] px-3 bg-white border-2 border-slate-200 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
                    <label className="cute-checkbox scale-110 origin-left">
                        <input type="checkbox" checked={value === true} onChange={(e) => !readonly && onChange(e.target.checked)} disabled={readonly} />
                        <span className="checkmark" style={readonly ? {opacity:0.5}: {}}></span>
                    </label>
                </div>
            ) : type === 'select' ? (
                <select 
                    className="bg-white border-2 border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    value={value || ''} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={readonly}
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            ) : type === 'textarea' ? (
                <textarea 
                    className="bg-white border-2 border-slate-200 px-4 py-3 text-[13px] font-bold text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 transition-all w-full min-h-[100px] resize-y disabled:bg-slate-50 disabled:text-slate-400"
                    value={value || ''} 
                    onChange={e => onChange(e.target.value)}
                    disabled={readonly}
                />
            ) : (
                <div className="relative w-full">
                    <input 
                        type={type}
                        className="bg-white border-2 border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 transition-all w-full disabled:bg-slate-50 disabled:text-slate-400 data-[readonly=true]:border-transparent data-[readonly=true]:bg-transparent data-[readonly=true]:px-0"
                        value={type==='date' && value ? value.replace(/\//g, '-') : (value || '')} 
                        onChange={e => onChange(e.target.value)}
                        disabled={readonly}
                        data-readonly={readonly}
                        readOnly={readonly}
                    />
                </div>
            )}
        </div>
    );
};

export default CoolingOffManagement;
