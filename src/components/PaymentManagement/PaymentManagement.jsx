import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import './PaymentManagement.css';

// --- Utilities ---
const normalizeKana = (str) => {
    if (!str) return '';
    return str
        .replace(/[\u3041-\u3096]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60)) // Hiragana to Katakana
        .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // Full-width to Half-width alphanumeric
        .replace(/　/g, ' ') // Zenkaku space to Hankaku space
        .toLowerCase()
        .trim();
};

const injectSearchableData = (item) => ({
    ...item,
    _searchShimei: normalizeKana(item.shimei),
    _searchBikou: normalizeKana(item.bikou),
    _searchTouroku: normalizeKana(item.touroku_jouhou),
    _searchNyuukin: (item.nyuukin_kingaku || '').toString()
});

// --- Memoized Row Component ---
const PaymentRow = React.memo(({
    payment: p,
    isSelected,
    toggleSelectRow,
    handleInlineEdit,
    saveToDatabase,
    toggleKanryou,
    onShimeiEnter
}) => {
    // Local state for text fields to avoid $O(N)$ global state updates on every keystroke
    const [localShimei, setLocalShimei] = useState(p.shimei || '');
    const [localNyuukin, setLocalNyuukin] = useState(p.nyuukin_kingaku ? Number(p.nyuukin_kingaku).toLocaleString() : '');
    const [localKounyuu, setLocalKounyuu] = useState(p.kounyuu_kingaku ? Number(p.kounyuu_kingaku).toLocaleString() : '');
    const [localSagaku, setLocalSagaku] = useState(p.sagaku ? Number(p.sagaku).toLocaleString() : '');
    const [localBikou, setLocalBikou] = useState(p.bikou || '');

    // Sync local state if external data changes (e.g. from refresh)
    useEffect(() => {
        setLocalShimei(p.shimei || '');
        setLocalNyuukin(p.nyuukin_kingaku ? Number(p.nyuukin_kingaku).toLocaleString() : '');
        setLocalKounyuu(p.kounyuu_kingaku ? Number(p.kounyuu_kingaku).toLocaleString() : '');
        setLocalSagaku(p.sagaku ? Number(p.sagaku).toLocaleString() : '');
        setLocalBikou(p.bikou || '');
    }, [p.shimei, p.nyuukin_kingaku, p.kounyuu_kingaku, p.sagaku, p.bikou]);

    const handleShimeiBlur = () => {
        if (localShimei !== p.shimei) {
            saveToDatabase(p.id, { shimei: localShimei });
        }
    };

    const handleShimeiKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleShimeiBlur();
            if (onShimeiEnter) onShimeiEnter(p.id, p.chuumonbi);
        }
    };

    const handleNyuukinBlur = () => {
        const strVal = String(localNyuukin).replace(/,/g, '').trim();
        const cleanVal = strVal === '' ? null : Number(strVal);
        if (cleanVal !== p.nyuukin_kingaku) {
            saveToDatabase(p.id, { nyuukin_kingaku: cleanVal });
            setLocalNyuukin(cleanVal !== null ? cleanVal.toLocaleString() : ''); // Re-format
        }
    };

    const handleKounyuuBlur = () => {
        const strVal = String(localKounyuu).replace(/,/g, '').trim();
        const cleanVal = strVal === '' ? null : Number(strVal);
        if (cleanVal !== p.kounyuu_kingaku) {
            saveToDatabase(p.id, { kounyuu_kingaku: cleanVal });
            setLocalKounyuu(cleanVal !== null ? cleanVal.toLocaleString() : '');
        }
    };

    const handleSagakuBlur = () => {
        const strVal = String(localSagaku).replace(/,/g, '').trim();
        const cleanVal = strVal === '' ? null : Number(strVal);
        if (cleanVal !== p.sagaku) {
            saveToDatabase(p.id, { sagaku: cleanVal });
            setLocalSagaku(cleanVal !== null ? cleanVal.toLocaleString() : '');
        }
    };

    const handleBikouBlur = () => {
        if (localBikou !== p.bikou) {
            saveToDatabase(p.id, { bikou: localBikou });
        }
    };

    return (
        <tr className={`${p.kanryou ? 'completed-row' : ''} ${isSelected ? 'selected-row' : ''}`}>
            <td style={{ textAlign: 'center' }}>
                <label className="cute-checkbox">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(p.id)}
                    />
                    <span className="checkmark"></span>
                </label>
            </td>
            <td style={{ textAlign: 'center' }}>
                <label className="cute-checkbox">
                    <input type="checkbox" checked={p.shiharaibi_nyuuryoku} onChange={e => handleInlineEdit(p.id, 'shiharaibi_nyuuryoku', e.target.checked)} />
                    <span className="checkmark"></span>
                </label>
            </td>
            <td style={{ textAlign: 'center' }}>
                <label className="cute-checkbox">
                    <input type="checkbox" checked={p.box_idou} onChange={e => handleInlineEdit(p.id, 'box_idou', e.target.checked)} />
                    <span className="checkmark"></span>
                </label>
            </td>
            <td>
                <select className="filter-input" value={p.touroku_jouhou || ''} onChange={e => handleInlineEdit(p.id, 'touroku_jouhou', e.target.value)}>
                    <option value=""></option>
                    <option value="未注文">未注文</option>
                    <option value="未登録">未登録</option>
                    <option value="新規">新規</option>
                    <option value="追加">追加</option>
                    <option value="ランクアップ">ﾗﾝｸｱｯﾌﾟ</option>
                    <option value="新規／追加">新規/追加</option>
                    <option value="新規／ランクアップ">新規/ﾗﾝｸｱｯﾌﾟ</option>
                    <option value="追加／ランクアップ">追加/ﾗﾝｸｱｯﾌﾟ</option>
                    <option value="リピート／購入">ﾘﾋﾟｰﾄ/購入</option>
                    <option value="救済">救済</option>
                    <option value="店舗関連">店舗関連</option>
                    <option value="オートシップ">ｵｰﾄｼｯﾌﾟ</option>
                </select>
            </td>
            <td>
                <select className="filter-input input-narrow" value={p.rank_up_bikou || ''} onChange={e => handleInlineEdit(p.id, 'rank_up_bikou', e.target.value)}>
                    <option value=""></option>
                    <option value="登録">登録</option>
                    <option value="旧登録">旧登録</option>
                    <option value="申請日">申請日</option>
                    <option value="3個ok">3個ok</option>
                </select>
            </td>
            <td style={{ textAlign: 'center' }}>
                <label className="cute-checkbox">
                    <input type="checkbox" checked={p.soshikizu_kakunin} onChange={e => handleInlineEdit(p.id, 'soshikizu_kakunin', e.target.checked)} />
                    <span className="checkmark"></span>
                </label>
            </td>
            <td style={{ minWidth: '135px' }}>
                <input
                    type="date"
                    className="filter-input"
                    style={{ background: 'transparent', border: 'none', width: '100%' }}
                    value={p.chuumonbi || ''}
                    onChange={e => handleInlineEdit(p.id, 'chuumonbi', e.target.value)}
                />
            </td>
            <td>
                <input
                    type="text"
                    className="filter-input input-narrow shimei-input"
                    style={{ background: 'transparent', border: 'none', fontWeight: 'bold' }}
                    value={localShimei}
                    onChange={e => setLocalShimei(e.target.value)}
                    onBlur={handleShimeiBlur}
                    onKeyDown={handleShimeiKeyDown}
                />
            </td>
            <td style={{ textAlign: 'right' }}>
                <input
                    type="text"
                    className="filter-input input-narrow"
                    style={{ background: 'transparent', border: 'none', textAlign: 'right', fontWeight: 'bold' }}
                    value={localNyuukin}
                    onChange={e => setLocalNyuukin(e.target.value)}
                    onBlur={handleNyuukinBlur}
                />
            </td>
            <td style={{ textAlign: 'center' }}>
                <label className="cute-checkbox">
                    <input type="checkbox" checked={p.henkin_taishou || false} onChange={e => handleInlineEdit(p.id, 'henkin_taishou', e.target.checked)} />
                    <span className="checkmark"></span>
                </label>
            </td>
            <td style={{ textAlign: 'right' }}>
                <input
                    type="text"
                    className="filter-input input-narrow"
                    style={{ background: 'transparent', border: 'none', textAlign: 'right' }}
                    value={localKounyuu}
                    onChange={e => setLocalKounyuu(e.target.value)}
                    onBlur={handleKounyuuBlur}
                />
            </td>
            <td style={{ textAlign: 'right' }}>
                <input
                    type="text"
                    className="filter-input input-narrow"
                    style={{ background: 'transparent', border: 'none', textAlign: 'right' }}
                    value={localSagaku}
                    onChange={e => setLocalSagaku(e.target.value)}
                    onBlur={handleSagakuBlur}
                />
            </td>
            <td>
                <input
                    type="text"
                    className="filter-input input-narrow"
                    style={{ background: 'transparent', border: 'none' }}
                    value={localBikou}
                    onChange={e => setLocalBikou(e.target.value)}
                    onBlur={handleBikouBlur}
                />
            </td>
            <td style={{ textAlign: 'center' }}>
                <label className="cute-heart-checkbox">
                    <input type="checkbox" checked={p.kanryou} onChange={() => toggleKanryou(p.id, p.kanryou)} />
                    <i className="fa-solid fa-heart"></i>
                </label>
            </td>
        </tr>
    );
}, (prevProps, nextProps) => {
    // Only re-render if the row's data or selection status actually changed. 
    // Ignore function reference changes to prevent excessive re-renders!
    return prevProps.isSelected === nextProps.isSelected && 
           prevProps.payment === nextProps.payment;
});

const PaymentManagement = () => {
    // --- State ---
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        shiharaibi: '',
        boxIdou: '',
        touroku: '',
        soshikizu: '',
        rankUp: '',
        chuumonbi: '',
        shimei: '',
        nyuukin: '',
        bikou: '',
        kanryou: ''
    });
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isGlobalSelected, setIsGlobalSelected] = useState(false);
    const itemsPerPage = 50;
    const fileInputRef = useRef(null);

    // Debounce search query to prevent stuttering while typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Quick Add State
    const [quickAdd, setQuickAdd] = useState({
        shiharaibi_nyuuryoku: false,
        box_idou: false,
        touroku_jouhou: '',
        soshikizu_kakunin: false,
        rank_up_bikou: '',
        chuumonbi: new Date().toISOString().split('T')[0],
        shimei: '',
        nyuukin_kingaku: '',
        bikou: ''
    });

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false })
                .order('id', { ascending: true });

            if (error) throw error;

            // Pre-normalize data for fast search
            const normalizedData = (data || []).map(injectSearchableData);
            setPayments(normalizedData);
        } catch (err) {
            console.error('Failed to fetch payments:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
        // Load selection from localStorage
        const savedSelection = localStorage.getItem('payment_selection');
        if (savedSelection) {
            try {
                const ids = JSON.parse(savedSelection);
                setSelectedIds(new Set(ids));
            } catch (e) {
                console.error('Failed to parse saved selection');
            }
        }
    }, []);

    // Save selection to localStorage
    useEffect(() => {
        localStorage.setItem('payment_selection', JSON.stringify([...selectedIds]));
    }, [selectedIds]);


    // --- Handlers ---
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (jsonData.length <= 1) {
                    alert('有効なデータが見つかりませんでした。');
                    return;
                }

                const rows = jsonData.slice(1);
                const existingKeys = new Set(payments.map(p => JSON.stringify({
                    shiharaibi_nyuuryoku: p.shiharaibi_nyuuryoku,
                    box_idou: p.box_idou,
                    touroku_jouhou: p.touroku_jouhou,
                    soshikizu_kakunin: p.soshikizu_kakunin,
                    rank_up_bikou: p.rank_up_bikou,
                    chuumonbi: p.chuumonbi,
                    shimei: p.shimei,
                    nyuukin_kingaku: Number(p.nyuukin_kingaku) || 0,
                    bikou: p.bikou,
                    kanryou: p.kanryou
                })));

                const newPayments = [];
                const duplicatesInImport = new Set();
                let duplicateCount = 0;

                rows.forEach((row) => {
                    const valToString = (val) => {
                        if (val instanceof Date) return val.toISOString().split('T')[0];
                        return val !== undefined && val !== null ? String(val) : '';
                    };

                    const isChecked = (val) => val === '済' || val === true || val === 'TRUE' || val === '1' || val === 1;

                    const p = {
                        shiharaibi_nyuuryoku: isChecked(row[0]),
                        box_idou: isChecked(row[1]),
                        touroku_jouhou: valToString(row[2]),
                        rank_up_bikou: valToString(row[3]),
                        soshikizu_kakunin: isChecked(row[4]),
                        chuumonbi: valToString(row[5]) || null,
                        shimei: valToString(row[6]),
                        nyuukin_kingaku: row[7] ? Number(String(row[7]).replace(/[^\d.-]/g, '')) : null,
                        henkin_taishou: isChecked(row[8]),
                        kounyuu_kingaku: row[9] ? Number(String(row[9]).replace(/[^\d.-]/g, '')) : null,
                        sagaku: row[10] ? Number(String(row[10]).replace(/[^\d.-]/g, '')) : null,
                        bikou: valToString(row[11]),
                        kanryou: row[12] === '完了' || row[12] === '済' || isChecked(row[12])
                    };

                    if (!p.shimei && !p.nyuukin_kingaku) return;

                    const key = JSON.stringify(p);
                    if (existingKeys.has(key) || duplicatesInImport.has(key)) {
                        duplicateCount++;
                    } else {
                        newPayments.push(p);
                        duplicatesInImport.add(key);
                    }
                });

                if (newPayments.length === 0) {
                    alert(duplicateCount > 0 ? `${duplicateCount}件の重複データのみが見つかりました（新規データなし）。` : '有効なデータが見つかりませんでした。');
                    return;
                }

                let finalToInsert = newPayments;
                let confirmMsg = `${newPayments.length}件の新規データをインポートしますか？`;

                if (duplicateCount > 0) {
                    if (window.confirm(`${duplicateCount}件の重複データが見つかりました。これらをスキップして${newPayments.length}件のみインポートしますか？\n（キャンセルを押すと、重複分も含めて全件取り込みます）`)) {
                        // Skip duplicates (default behavior)
                    } else {
                        // Include duplicates - we need to re-process all rows
                        finalToInsert = rows.map(row => {
                            const valToString = (val) => {
                                if (val instanceof Date) return val.toISOString().split('T')[0];
                                return val !== undefined && val !== null ? String(val) : '';
                            };
                            const isChecked = (val) => val === '済' || val === true || val === 'TRUE' || val === '1' || val === 1;
                            return {
                                shiharaibi_nyuuryoku: isChecked(row[0]),
                                box_idou: isChecked(row[1]),
                                touroku_jouhou: valToString(row[2]),
                                rank_up_bikou: valToString(row[3]),
                                soshikizu_kakunin: isChecked(row[4]),
                                chuumonbi: valToString(row[5]) || null,
                                shimei: valToString(row[6]),
                                nyuukin_kingaku: row[7] ? Number(String(row[7]).replace(/[^\d.-]/g, '')) : null,
                                henkin_taishou: isChecked(row[8]),
                                kounyuu_kingaku: row[9] ? Number(String(row[9]).replace(/[^\d.-]/g, '')) : null,
                                sagaku: row[10] ? Number(String(row[10]).replace(/[^\d.-]/g, '')) : null,
                                bikou: valToString(row[11]),
                                kanryou: row[12] === '完了' || row[12] === '済' || isChecked(row[12])
                            };
                        }).filter(p => p.shimei || p.nyuukin_kingaku);
                        confirmMsg = `${finalToInsert.length}件のデータを全件インポートしますか？`;
                        if (!window.confirm(confirmMsg)) return;
                    }
                } else {
                    if (!window.confirm(confirmMsg)) return;
                }

                setIsLoading(true);
                try {
                    // 最終行を先頭に表示させるため、配列を反転させつつ、
                    // 作成日時にミリ秒の差をつけて並び順を固定する
                    const baseTime = new Date().getTime();
                    const reversedPayments = [...finalToInsert].reverse().map((p, index) => ({
                        ...p,
                        created_at: new Date(baseTime + index).toISOString()
                    }));

                    const { error } = await supabase.from('payments').insert(reversedPayments);
                    if (error) throw error;
                    alert('インポートが完了しました。');
                    fetchPayments();
                } catch (err) {
                    alert('インポートに失敗しました: ' + err.message);
                } finally {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('インポートに失敗しました: ' + err.message);
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleQuickAdd = async () => {
        if (!quickAdd.shimei && !quickAdd.nyuukin_kingaku) return;

        try {
            const newRecord = {
                ...quickAdd,
                nyuukin_kingaku: quickAdd.nyuukin_kingaku.toString().replace(/,/g, '') || 0,
                kounyuu_kingaku: quickAdd.kounyuu_kingaku ? Number(quickAdd.kounyuu_kingaku.toString().replace(/,/g, '')) : null,
                sagaku: quickAdd.sagaku ? Number(quickAdd.sagaku.toString().replace(/,/g, '')) : null,
                chuumonbi: quickAdd.chuumonbi || null
            };

            const { error } = await supabase.from('payments').insert([newRecord]);
            if (error) throw error;

            fetchPayments();
            setQuickAdd(prev => ({
                ...prev,
                shiharaibi_nyuuryoku: false,
                box_idou: false,
                touroku_jouhou: '',
                rank_up_bikou: '',
                soshikizu_kakunin: false,
                chuumonbi: '',
                shimei: '',
                nyuukin_kingaku: '',
                henkin_taishou: false,
                kounyuu_kingaku: '',
                sagaku: '',
                bikou: ''
            }));
        } catch (err) {
            alert('追加に失敗しました: ' + err.message);
        }
    };

    const toggleKanryou = async (id, currentStatus) => {
        // 即時UI反映 (Functional state update to avoid races)
        setPayments(prev => prev.map(p => p.id === id ? { ...p, kanryou: !currentStatus } : p));
        try {
            const { error } = await supabase
                .from('payments')
                .update({ kanryou: !currentStatus })
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            alert('更新に失敗しました');
            // Revert on error
            fetchPayments();
        }
    };

    const handleInlineEdit = async (id, field, value) => {
        // Update local state immediately for responsiveness (Functional update!)
        setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

        // Non-text fields (checkboxes, selects) save immediately
        const immediateFields = ['shiharaibi_nyuuryoku', 'box_idou', 'touroku_jouhou', 'soshikizu_kakunin', 'rank_up_bikou', 'kanryou', 'chuumonbi', 'henkin_taishou'];
        if (immediateFields.includes(field)) {
            await saveToDatabase(id, { [field]: value === '' ? null : value });
        }
    };

    const saveToDatabase = async (id, updates) => {
        setIsLoading(true);
        // Ensure global state has the updates (crucial for text blur sync!)
        setPayments(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

        try {
            const { error } = await supabase
                .from('payments')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error('Save error:', err);
            // Optional: Re-fetch if save fails to ensure UI is in sync with server
            fetchPayments();
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectRow = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
            if (isGlobalSelected) setIsGlobalSelected(false);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        const allOnPageIds = paginatedPayments.map(p => p.id);
        const isAllSelected = allOnPageIds.every(id => selectedIds.has(id));

        const newSelected = new Set(selectedIds);
        if (isAllSelected) {
            allOnPageIds.forEach(id => newSelected.delete(id));
            setIsGlobalSelected(false);
        } else {
            allOnPageIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAllFiltered = () => {
        const allFilteredIds = filteredPayments.map(p => p.id);
        setSelectedIds(new Set(allFilteredIds));
        setIsGlobalSelected(true);
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
        setIsGlobalSelected(false);
    };

    const handleExportExcel = () => {
        const header = ["支払日入力", "BOX移動", "登録情報", "ランクアップ", "組織図確認", "振込日", "氏名", "振込金額", "返金対象", "購入金額", "差額", "備考", "完了"];

        // Use selected rows if any are checked, otherwise use all filtered results
        const targets = selectedIds.size > 0
            ? filteredPayments.filter(p => selectedIds.has(p.id))
            : filteredPayments;

        if (selectedIds.size === 0 && !window.confirm('何も選択されていません。表示中のすべての行（全' + filteredPayments.length + '件）を書き出しますか？')) {
            return;
        }

        const data = targets.map(p => [
            p.shiharaibi_nyuuryoku ? '済' : '未',
            p.box_idou ? '済' : '未',
            p.touroku_jouhou,
            p.rank_up_bikou,
            p.soshikizu_kakunin ? '済' : '未',
            p.chuumonbi,
            p.shimei,
            p.nyuukin_kingaku,
            p.henkin_taishou ? '対象' : '',
            p.kounyuu_kingaku,
            p.sagaku,
            p.bikou,
            p.kanryou ? '完了' : '未'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "入金管理");
        XLSX.writeFile(wb, `入金管理_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('全ての入金データを削除してもよろしいですか？この操作は取り消せません。')) return;
        setIsLoading(true);
        try {
            // Delete all records (RLS is "Allow all" so this works if we target a non-existent condition or just delete all)
            const { error } = await supabase
                .from('payments')
                .delete()
                .neq('shimei', '___NON_EXISTENT_NAME___'); // Efficient way to target all rows

            if (error) throw error;
            setPayments([]);
            alert('全てのデータを削除しました。');
        } catch (err) {
            alert('削除に失敗しました: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCleanupDuplicates = async () => {
        if (!window.confirm('重複データを検知して削除しますか？（全く同じ内容のデータが複数ある場合、1つだけ残して削除します）')) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('payments').select('*');
            if (error) throw error;

            const seen = new Set();
            const toDelete = [];

            data.forEach(p => {
                const key = JSON.stringify({
                    shiharaibi_nyuuryoku: p.shiharaibi_nyuuryoku,
                    box_idou: p.box_idou,
                    touroku_jouhou: p.touroku_jouhou,
                    soshikizu_kakunin: p.soshikizu_kakunin,
                    rank_up_bikou: p.rank_up_bikou,
                    chuumonbi: p.chuumonbi,
                    shimei: p.shimei,
                    nyuukin_kingaku: p.nyuukin_kingaku,
                    bikou: p.bikou,
                    kanryou: p.kanryou
                });

                if (seen.has(key)) {
                    toDelete.push(p.id);
                } else {
                    seen.add(key);
                }
            });

            if (toDelete.length === 0) {
                alert('重複データは見つかりませんでした。');
                return;
            }

            if (window.confirm(`${toDelete.length}件の重複が見つかりました。削除しますか？`)) {
                const { error: delError } = await supabase
                    .from('payments')
                    .delete()
                    .in('id', toDelete);
                if (delError) throw delError;
                alert(`${toDelete.length}件の重複データを削除しました。`);
                fetchPayments();
            }
        } catch (err) {
            alert('クリーンアップに失敗しました: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Derived Data: Filtered & Sorted ---
    const filteredPayments = useMemo(() => {
        const normalizedQuery = normalizeKana(debouncedSearchQuery);

        const normFilters = {
            touroku: normalizeKana(filters.touroku),
            shimei: normalizeKana(filters.shimei),
            nyuukin: normalizeKana(filters.nyuukin)
        };

        return payments
            .filter(p => {
                const matchesGlobal = (
                    p._searchShimei.includes(normalizedQuery) ||
                    p._searchBikou.includes(normalizedQuery) ||
                    p._searchTouroku.includes(normalizedQuery)
                );

                const matchesColumns = (
                    (!filters.shiharaibi || (p.shiharaibi_nyuuryoku ? '済' : '未') === filters.shiharaibi) &&
                    (!filters.boxIdou || (p.box_idou ? '済' : '未') === filters.boxIdou) &&
                    (!normFilters.touroku || p._searchTouroku.includes(normFilters.touroku)) &&
                    (!normFilters.shimei || p._searchShimei.includes(normFilters.shimei)) &&
                    (!normFilters.nyuukin || p._searchNyuukin.includes(normFilters.nyuukin)) &&
                    (!filters.kanryou || (filters.kanryou === '完了' ? p.kanryou === true : p.kanryou === false)) ||
                    (!filters.henkin_taishou || (filters.henkin_taishou === '対象' ? p.henkin_taishou === true : p.henkin_taishou === false))
                );

                return matchesGlobal && matchesColumns;
            })
            .sort((a, b) => {
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;

                // Tie-breaker for stable sort
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                if (timeA !== timeB) return timeB - timeA; // Newer first
                return (a.id || '').localeCompare(b.id || '');
            });
    }, [payments, debouncedSearchQuery, filters, sortConfig]);

    const paginatedPayments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredPayments, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

    const handleShimeiEnter = (currentId, currentDate) => {
        const index = paginatedPayments.findIndex(p => p.id === currentId);
        // If not the last row on the page
        if (index >= 0 && index < paginatedPayments.length - 1) {
            const nextPayment = paginatedPayments[index + 1];
            
            // Only update if current date is set and next row's date is different or empty
            if (currentDate && nextPayment.chuumonbi !== currentDate) {
                handleInlineEdit(nextPayment.id, 'chuumonbi', currentDate);
            }
            
            // Move focus to the next row's name field
            setTimeout(() => {
                const inputs = document.querySelectorAll('.shimei-input');
                if (inputs[index + 1]) inputs[index + 1].focus();
            }, 50);
        }
    };

    return (
        <div className="payment-management-container">
            <header>
                <h1><i className="fa-solid fa-cloud header-icon"></i> 入金管理システム (クラウド同期版)</h1>
            </header>

            <div className="file-operations glass-panel" style={{ padding: '10px 15px', display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="secondary-btn" onClick={() => fileInputRef.current?.click()}>
                        <i className="fa-solid fa-file-import"></i> インポート (Excel/CSV)
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportFile}
                        accept=".csv, .xlsx, .xls"
                        style={{ display: 'none' }}
                    />
                    <button className="secondary-btn" onClick={handleExportExcel}>
                        <i className="fa-solid fa-file-export"></i> Excel書き出し
                    </button>
                    <button className="secondary-btn" style={{ borderColor: '#ff7979', color: '#ff7979' }} onClick={handleCleanupDuplicates}>
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 重複クリーンアップ
                    </button>
                    <button className="secondary-btn" style={{ borderColor: '#ff4757', color: '#ff4757' }} onClick={handleDeleteAll}>
                        <i className="fa-solid fa-trash-can"></i> 全データ削除
                    </button>
                </div>
                <div style={{ color: 'var(--text-color)', fontSize: '0.9em', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="glass-btn" style={{ padding: '4px 12px', fontSize: '0.85em' }} onClick={fetchPayments} disabled={isLoading}>
                        <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i> 手動同期
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`status-dot ${!isLoading ? 'online' : 'loading'}`}></span>
                        {isLoading ? '保存中...' : 'クラウド保存済み'}
                    </div>
                </div>
            </div>

            <div className="controls-area">
                <div className="search-box">
                    <i className="fa-solid fa-search"></i>
                    <input
                        type="text"
                        placeholder="氏名や備考で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {selectedIds.size > 0 && (
                    <div className="selection-banner glass-panel">
                        <i className="fa-solid fa-check-double"></i>
                        <span>
                            {isGlobalSelected ? (
                                `全 ${selectedIds.size} 件を選択中`
                            ) : (
                                `${selectedIds.size} 件を選択中`
                            )}
                        </span>
                        {!isGlobalSelected && filteredPayments.length > paginatedPayments.length && (
                            <button className="text-link-btn" onClick={handleSelectAllFiltered}>
                                検索結果の全 {filteredPayments.length} 件を選択する
                            </button>
                        )}
                        <button className="text-link-btn danger" onClick={handleClearSelection}>
                            選択解除
                        </button>
                    </div>
                )}
            </div>

            <div className="table-container glass-panel">
                <table className="cute-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={paginatedPayments.length > 0 && paginatedPayments.every(p => selectedIds.has(p.id))}
                                        onChange={toggleSelectAll}
                                    />
                                    <span className="checkmark"></span>
                                </label>
                            </th>
                            <th onClick={() => setSortConfig({ key: 'shiharaibi_nyuuryoku', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>支払日入力</th>
                            <th onClick={() => setSortConfig({ key: 'box_idou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>BOX移動</th>
                            <th onClick={() => setSortConfig({ key: 'touroku_jouhou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>登録情報</th>
                            <th onClick={() => setSortConfig({ key: 'rank_up_bikou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>ランクアップ</th>
                            <th onClick={() => setSortConfig({ key: 'soshikizu_kakunin', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>組織図確認</th>
                            <th onClick={() => setSortConfig({ key: 'chuumonbi', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>振込日</th>
                            <th onClick={() => setSortConfig({ key: 'shimei', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>氏名</th>
                            <th onClick={() => setSortConfig({ key: 'nyuukin_kingaku', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>振込金額</th>
                            <th onClick={() => setSortConfig({ key: 'henkin_taishou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>返金対象</th>
                            <th onClick={() => setSortConfig({ key: 'kounyuu_kingaku', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>購入金額</th>
                            <th onClick={() => setSortConfig({ key: 'sagaku', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>差額</th>
                            <th onClick={() => setSortConfig({ key: 'bikou', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>備考</th>
                            <th style={{ textAlign: 'center' }}>完了</th>
                        </tr>
                        <tr className="filter-row">
                            <th></th>
                            <th>
                                <select className="filter-input" value={filters.shiharaibi} onChange={e => setFilters({ ...filters, shiharaibi: e.target.value })}>
                                    <option value="">すべて</option>
                                    <option value="済">済</option>
                                    <option value="未">未</option>
                                </select>
                            </th>
                            <th>
                                <select className="filter-input" value={filters.boxIdou} onChange={e => setFilters({ ...filters, boxIdou: e.target.value })}>
                                    <option value="">すべて</option>
                                    <option value="済">済</option>
                                    <option value="未">未</option>
                                </select>
                            </th>
                            <th><input className="filter-input input-narrow" placeholder="検索" value={filters.touroku} onChange={e => setFilters({ ...filters, touroku: e.target.value })} /></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th><input className="filter-input input-narrow" placeholder="名前" value={filters.shimei} onChange={e => setFilters({ ...filters, shimei: e.target.value })} /></th>
                            <th><input className="filter-input input-narrow" placeholder="金額" value={filters.nyuukin} onChange={e => setFilters({ ...filters, nyuukin: e.target.value })} /></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th>
                                <select className="filter-input input-narrow" value={filters.kanryou} onChange={e => setFilters({ ...filters, kanryou: e.target.value })}>
                                    <option value="">すべて</option>
                                    <option value="完了">完了</option>
                                    <option value="未完了">未完了</option>
                                </select>
                            </th>
                        </tr>
                        <tr className="quick-add-row">
                            <td></td>
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.shiharaibi_nyuuryoku} onChange={e => setQuickAdd({ ...quickAdd, shiharaibi_nyuuryoku: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.box_idou} onChange={e => setQuickAdd({ ...quickAdd, box_idou: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td>
                                <select className="filter-input input-narrow" value={quickAdd.touroku_jouhou} onChange={e => setQuickAdd({ ...quickAdd, touroku_jouhou: e.target.value })}>
                                    <option value=""></option>
                                    <option value="未注文">未注文</option>
                                    <option value="未登録">未登録</option>
                                    <option value="新規">新規</option>
                                    <option value="追加">追加</option>
                                    <option value="ランクアップ">ﾗﾝｸｱｯﾌﾟ</option>
                                    <option value="新規／追加">新規/追加</option>
                                    <option value="新規／ランクアップ">新規/ﾗﾝｸｱｯﾌﾟ</option>
                                    <option value="追加／ランクアップ">追加/ﾗﾝｸｱｯﾌﾟ</option>
                                    <option value="リピート／購入">ﾘﾋﾟｰﾄ/購入</option>
                                    <option value="救済">救済</option>
                                    <option value="店舗関連">店舗関連</option>
                                    <option value="オートシップ">ｵｰﾄｼｯﾌﾟ</option>
                                </select>
                            </td>
                            <td>
                                <select className="filter-input input-narrow" value={quickAdd.rank_up_bikou} onChange={e => setQuickAdd({ ...quickAdd, rank_up_bikou: e.target.value })}>
                                    <option value=""></option>
                                    <option value="登録">登録</option>
                                    <option value="旧登録">旧登録</option>
                                    <option value="申請日">申請日</option>
                                    <option value="3個ok">3個ok</option>
                                </select>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.soshikizu_kakunin} onChange={e => setQuickAdd({ ...quickAdd, soshikizu_kakunin: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td><input type="date" className="filter-input input-narrow" value={quickAdd.chuumonbi || ''} onChange={e => setQuickAdd({ ...quickAdd, chuumonbi: e.target.value })} /></td>
                            <td><input type="text" className="filter-input input-narrow" placeholder="氏名" value={quickAdd.shimei} onChange={e => setQuickAdd({ ...quickAdd, shimei: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input input-narrow" placeholder="金額" value={quickAdd.nyuukin_kingaku} onChange={e => setQuickAdd({ ...quickAdd, nyuukin_kingaku: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td style={{ textAlign: 'center' }}>
                                <label className="cute-checkbox">
                                    <input type="checkbox" checked={quickAdd.henkin_taishou || false} onChange={e => setQuickAdd({ ...quickAdd, henkin_taishou: e.target.checked })} />
                                    <span className="checkmark"></span>
                                </label>
                            </td>
                            <td><input type="text" className="filter-input input-narrow" placeholder="購入" value={quickAdd.kounyuu_kingaku || ''} onChange={e => setQuickAdd({ ...quickAdd, kounyuu_kingaku: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input input-narrow" placeholder="差額" value={quickAdd.sagaku || ''} onChange={e => setQuickAdd({ ...quickAdd, sagaku: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td><input type="text" className="filter-input input-narrow" placeholder="備考" value={quickAdd.bikou} onChange={e => setQuickAdd({ ...quickAdd, bikou: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleQuickAdd()} /></td>
                            <td style={{ textAlign: 'center' }}>
                                <button className="primary-btn" style={{ padding: '2px 8px', fontSize: '0.7em' }} onClick={handleQuickAdd} disabled={isLoading}>追加</button>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedPayments.map(p => (
                            <PaymentRow
                                key={p.id}
                                payment={p}
                                isSelected={selectedIds.has(p.id)}
                                toggleSelectRow={toggleSelectRow}
                                handleInlineEdit={handleInlineEdit}
                                saveToDatabase={saveToDatabase}
                                toggleKanryou={toggleKanryou}
                                onShimeiEnter={handleShimeiEnter}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination-controls glass-panel">
                    <button
                        className="glass-btn secondary"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                        <i className="fa-solid fa-chevron-left"></i> 前へ
                    </button>
                    <span className="page-info">
                        <strong>{currentPage}</strong> / {totalPages} ページ
                        <span className="total-count">({filteredPayments.length}件)</span>
                    </span>
                    <button
                        className="glass-btn secondary"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                        次へ <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            )}
        </div>
    );
};

export default PaymentManagement;
